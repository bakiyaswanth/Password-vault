/**
 * Authentication Business Logic Service
 */

import { AppError } from '../errors/AppError';
import { UserRepository } from '../repositories/UserRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import { hashToken } from '../middleware/auth';
import { checkVerifier, protectVerifier } from './verifier';
import type { DbUser, DbVault, DbSession, RegisterDto, LoginDto, UpdateEmailDto } from '../types';

export interface AuthSecrets {
  verifierKey: string;
  serverPepper: string;
}

/**
 * sha256(lower(trim(identifier))) as hex. Identical to the client's computeLookupHash, so hashes
 * stored by earlier client-supplied values stay valid. Always computed server-side: client-supplied
 * lookup hashes are ignored so an account cannot claim another identifier's hash.
 */
export async function computeLookupHash(identifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identifier.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;

  constructor(db: D1Database, private readonly secrets?: AuthSecrets) {
    this.userRepo = new UserRepository(db);
    this.sessionRepo = new SessionRepository(db);
  }

  private requireSecrets(): AuthSecrets {
    if (!this.secrets) throw new Error('AuthService secrets not provided');
    return this.secrets;
  }

  async getPrelogin(lookupHash: string) {
    const { serverPepper } = this.requireSecrets();
    const user = await this.userRepo.findByIdentifierLookupHash(lookupHash);

    if (user) {
      return {
        exists: true,
        kdfSalt: user.kdf_salt,
        kdfParams: JSON.parse(user.kdf_params),
      };
    }

    // Deterministic fake salt to prevent account enumeration
    const fakeSaltBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`salt:${serverPepper}:${lookupHash}`)
    );
    const fakeSaltBase64 = btoa(String.fromCharCode(...new Uint8Array(fakeSaltBuffer)));

    return {
      exists: false,
      kdfSalt: fakeSaltBase64,
      kdfParams: {
        memoryKiB: 65536,
        iterations: 3,
        parallelism: 4,
        salt: fakeSaltBase64,
        keyLengthBytes: 32,
      },
    };
  }

  async register(dto: RegisterDto) {
    const { verifierKey } = this.requireSecrets();

    // Lookup hashes share one namespace across the username and email columns, so each new
    // identifier must be unused in BOTH columns.
    const usernameHash = await computeLookupHash(dto.username);
    if ((await this.userRepo.findAllByLookupHash(usernameHash)).length > 0) {
      throw AppError.conflict('An account with this username already exists');
    }

    let emailHash: string | null = null;
    if (dto.email) {
      emailHash = await computeLookupHash(dto.email);
      if (emailHash === usernameHash || (await this.userRepo.findAllByLookupHash(emailHash)).length > 0) {
        throw AppError.conflict('An account with this email already exists');
      }
    }

    const now = Date.now();
    const userId = crypto.randomUUID();
    const vaultId = crypto.randomUUID();

    const user: DbUser = {
      id: userId,
      username: dto.username,
      email: dto.email || null,
      email_lookup_hash: emailHash,
      username_lookup_hash: usernameHash,
      kdf_salt: dto.kdfSalt,
      kdf_params: JSON.stringify(dto.kdfParams),
      auth_verifier: await protectVerifier(dto.authVerifier, verifierKey),
      encrypted_vault_key: dto.encryptedVaultKey,
      encrypted_recovery_key: dto.encryptedRecoveryKey || null,
      recovery_salt: dto.recoverySalt || null,
      created_at: now,
      updated_at: now,
    };

    const initialVault: DbVault = {
      id: vaultId,
      user_id: userId,
      current_revision: 1,
      crypto_version: 1,
      encrypted_payload: dto.initialEncryptedVault,
      iv: dto.initialIv,
      updated_at: now,
    };

    await this.userRepo.createUserWithInitialVault(user, initialVault);

    return {
      success: true,
      message: 'User registered successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email || '',
      },
    };
  }

  async login(
    dto: LoginDto,
    meta: { userAgent: string | null; ip: string; isProd: boolean }
  ) {
    const lookupHash = dto.identifierLookupHash || dto.emailLookupHash;
    if (!lookupHash) {
      throw AppError.validation('Identifier lookup hash is required');
    }

    const { verifierKey } = this.requireSecrets();
    const user = await this.userRepo.findByIdentifierLookupHash(lookupHash);
    const check = user ? await checkVerifier(user.auth_verifier, dto.authProof, verifierKey) : null;

    if (!user || !check?.ok) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const now = Date.now();
    if (check.needsUpgrade) {
      // Legacy row stored the raw proof; replace it with the protected form.
      await this.userRepo.upgradeVerifier(user.id, user.auth_verifier, await protectVerifier(dto.authProof, verifierKey), now);
    }

    // Create session
    const rawTokenBytes = new Uint8Array(32);
    crypto.getRandomValues(rawTokenBytes);
    const token = Array.from(rawTokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await hashToken(token);

    const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
    const ipHash = await hashToken(meta.ip);

    const session: DbSession = {
      id: crypto.randomUUID(),
      user_id: user.id,
      token_hash: tokenHash,
      user_agent: meta.userAgent,
      ip_hash: ipHash,
      expires_at: expiresAt,
      created_at: now,
      last_active_at: now,
    };

    await this.sessionRepo.create(session);

    const cookieOptions = [
      `aegis_session=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${7 * 24 * 60 * 60}`,
      meta.isProd ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    return {
      cookieHeader: cookieOptions,
      response: {
        success: true,
        user: {
          id: user.id,
          username: user.username || (user.email ? user.email.split('@')[0] : 'User'),
          email: user.email || '',
          kdfSalt: user.kdf_salt,
          kdfParams: JSON.parse(user.kdf_params),
          encryptedVaultKey: user.encrypted_vault_key,
          hasRecoveryKey: !!user.encrypted_recovery_key,
        },
        sessionToken: token,
      },
    };
  }

  async updateEmail(user: DbUser, dto: UpdateEmailDto) {
    const emailHash = await computeLookupHash(dto.email);

    // Reject if the hash is used by any OTHER account in either column (e.g. another user's
    // username), which would otherwise make that user's identifier ambiguous.
    const holders = await this.userRepo.findAllByLookupHash(emailHash);
    if (holders.some((h) => h.id !== user.id)) {
      throw AppError.conflict('This email address is already associated with another account');
    }

    const now = Date.now();
    await this.userRepo.updateEmail(user.id, dto.email, emailHash, now);

    return {
      success: true,
      // Ownership is not verified (no email delivery); do not claim it is.
      message: 'Email address added successfully',
      email: dto.email,
    };
  }

  async logout(token: string | null) {
    if (token) {
      const tokenHash = await hashToken(token);
      await this.sessionRepo.deleteByTokenHash(tokenHash);
    }
    return {
      cookieHeader: 'aegis_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
      response: { success: true, message: 'Logged out successfully' },
    };
  }

  getMe(user: DbUser) {
    return {
      authenticated: true,
      user: {
        id: user.id,
        username: user.username || (user.email ? user.email.split('@')[0] : 'User'),
        email: user.email || '',
        kdfSalt: user.kdf_salt,
        kdfParams: JSON.parse(user.kdf_params),
        encryptedVaultKey: user.encrypted_vault_key,
        hasRecoveryKey: !!user.encrypted_recovery_key,
      },
    };
  }

  async recover(lookupHash: string) {
    const user = await this.userRepo.findByIdentifierLookupHash(lookupHash);

    if (!user || !user.encrypted_recovery_key || !user.recovery_salt) {
      throw AppError.notFound('No recovery key registered for this account');
    }

    return {
      encryptedRecoveryKey: user.encrypted_recovery_key,
      recoverySalt: user.recovery_salt,
    };
  }
}
