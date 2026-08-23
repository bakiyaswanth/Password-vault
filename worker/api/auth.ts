/**
 * AegisVault Authentication API Routes
 */

import { Hono } from 'hono';
import { Database } from '../database/db';
import { hashToken, extractToken, requireAuth } from '../middleware/auth';
import { rateLimiter } from '../middleware/rate-limit';
import type { Env, Variables, DbUser, DbVault, DbSession } from '../types';

export const authRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Constant-time string comparison for auth proof verification
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// 1. Pre-login: Fetch KDF salt and parameters
authRouter.post('/prelogin', rateLimiter({ maxRequests: 20, windowSeconds: 60 }), async (c) => {
  const body = await c.req.json<{ emailLookupHash: string }>();
  if (!body.emailLookupHash || typeof body.emailLookupHash !== 'string') {
    return c.json({ error: 'Validation Error', message: 'emailLookupHash is required' }, 400);
  }

  const db = new Database(c.env.DB);
  const user = await db.getUserByEmailLookupHash(body.emailLookupHash);

  if (user) {
    return c.json({
      exists: true,
      kdfSalt: user.kdf_salt,
      kdfParams: JSON.parse(user.kdf_params),
    });
  }

  // To prevent account enumeration: return deterministic fake salt
  const fakeSaltBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`salt:${c.env.SERVER_PEPPER || 'default-pepper'}:${body.emailLookupHash}`)
  );
  const fakeSaltBase64 = btoa(String.fromCharCode(...new Uint8Array(fakeSaltBuffer)));

  return c.json({
    exists: false,
    kdfSalt: fakeSaltBase64,
    kdfParams: {
      memoryKiB: 65536,
      iterations: 3,
      parallelism: 4,
      salt: fakeSaltBase64,
      keyLengthBytes: 32,
    },
  });
});

// 2. Register new account
authRouter.post('/register', rateLimiter({ maxRequests: 5, windowSeconds: 300 }), async (c) => {
  const body = await c.req.json<{
    emailLookupHash: string;
    kdfSalt: string;
    kdfParams: Record<string, unknown>;
    authVerifier: string;
    encryptedVaultKey: string;
    encryptedRecoveryKey?: string;
    recoverySalt?: string;
    initialEncryptedVault: string;
    initialIv: string;
  }>();

  if (
    !body.emailLookupHash ||
    !body.kdfSalt ||
    !body.kdfParams ||
    !body.authVerifier ||
    !body.encryptedVaultKey ||
    !body.initialEncryptedVault ||
    !body.initialIv
  ) {
    return c.json({ error: 'Validation Error', message: 'Missing required registration parameters' }, 400);
  }

  const db = new Database(c.env.DB);
  const existing = await db.getUserByEmailLookupHash(body.emailLookupHash);
  if (existing) {
    return c.json({ error: 'Conflict', message: 'An account with this identifier already exists' }, 409);
  }

  const now = Date.now();
  const userId = crypto.randomUUID();
  const vaultId = crypto.randomUUID();

  const user: DbUser = {
    id: userId,
    email_lookup_hash: body.emailLookupHash,
    kdf_salt: body.kdfSalt,
    kdf_params: JSON.stringify(body.kdfParams),
    auth_verifier: body.authVerifier,
    encrypted_vault_key: body.encryptedVaultKey,
    encrypted_recovery_key: body.encryptedRecoveryKey || null,
    recovery_salt: body.recoverySalt || null,
    created_at: now,
    updated_at: now,
  };

  const initialVault: DbVault = {
    id: vaultId,
    user_id: userId,
    current_revision: 1,
    crypto_version: 1,
    encrypted_payload: body.initialEncryptedVault,
    iv: body.initialIv,
    updated_at: now,
  };

  await db.createUser(user, initialVault);

  return c.json({
    success: true,
    message: 'User registered successfully',
    userId,
  }, 201);
});

// 3. Login
authRouter.post('/login', rateLimiter({ maxRequests: 10, windowSeconds: 60 }), async (c) => {
  const body = await c.req.json<{ emailLookupHash: string; authProof: string }>();
  if (!body.emailLookupHash || !body.authProof) {
    return c.json({ error: 'Validation Error', message: 'Missing emailLookupHash or authProof' }, 400);
  }

  const db = new Database(c.env.DB);
  const user = await db.getUserByEmailLookupHash(body.emailLookupHash);

  if (!user || !timingSafeEqualStr(user.auth_verifier, body.authProof)) {
    return c.json({ error: 'Unauthorized', message: 'Invalid credentials' }, 401);
  }

  // Create session
  const rawTokenBytes = new Uint8Array(32);
  crypto.getRandomValues(rawTokenBytes);
  const token = Array.from(rawTokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const tokenHash = await hashToken(token);

  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
  const userAgent = c.req.header('User-Agent') || null;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '127.0.0.1';
  const ipHash = await hashToken(ip);

  const session: DbSession = {
    id: crypto.randomUUID(),
    user_id: user.id,
    token_hash: tokenHash,
    user_agent: userAgent,
    ip_hash: ipHash,
    expires_at: expiresAt,
    created_at: now,
    last_active_at: now,
  };

  await db.createSession(session);

  // Set HttpOnly, Secure, SameSite=Strict cookie
  const isProd = c.env.ENVIRONMENT === 'production';
  const cookieOptions = [
    `aegis_session=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${7 * 24 * 60 * 60}`,
    isProd ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  c.header('Set-Cookie', cookieOptions);

  return c.json({
    success: true,
    user: {
      id: user.id,
      kdfSalt: user.kdf_salt,
      kdfParams: JSON.parse(user.kdf_params),
      encryptedVaultKey: user.encrypted_vault_key,
      hasRecoveryKey: !!user.encrypted_recovery_key,
    },
    sessionToken: token, // Also returned for non-cookie API clients
  });
});

// 4. Logout
authRouter.post('/logout', async (c) => {
  const token = extractToken(c);
  if (token) {
    const tokenHash = await hashToken(token);
    const db = new Database(c.env.DB);
    await db.deleteSession(tokenHash);
  }

  // Clear cookie
  c.header('Set-Cookie', 'aegis_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  return c.json({ success: true, message: 'Logged out successfully' });
});

// 5. Check session status
authRouter.get('/me', requireAuth, async (c) => {
  const user = c.get('user')!;
  return c.json({
    authenticated: true,
    user: {
      id: user.id,
      kdfSalt: user.kdf_salt,
      kdfParams: JSON.parse(user.kdf_params),
      encryptedVaultKey: user.encrypted_vault_key,
      hasRecoveryKey: !!user.encrypted_recovery_key,
    },
  });
});

// 6. Recovery Material Fetch
authRouter.post('/recover', rateLimiter({ maxRequests: 5, windowSeconds: 300 }), async (c) => {
  const body = await c.req.json<{ emailLookupHash: string }>();
  if (!body.emailLookupHash) {
    return c.json({ error: 'Validation Error', message: 'emailLookupHash is required' }, 400);
  }

  const db = new Database(c.env.DB);
  const user = await db.getUserByEmailLookupHash(body.emailLookupHash);

  if (!user || !user.encrypted_recovery_key || !user.recovery_salt) {
    return c.json({ error: 'Not Found', message: 'No recovery key registered for this account' }, 404);
  }

  return c.json({
    encryptedRecoveryKey: user.encrypted_recovery_key,
    recoverySalt: user.recovery_salt,
  });
});
