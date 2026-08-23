/**
 * Authentication Business Logic Service
 */

import { AppError } from '../errors/AppError';
import { UserRepository } from '../repositories/UserRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import { hashToken } from '../middleware/auth';
import type { DbUser, DbVault, DbSession, RegisterDto, LoginDto, UpdateEmailDto } from '../types';

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export class AuthService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;

  constructor(db: D1Database) {
    this.userRepo = new UserRepository(db);
    this.sessionRepo = new SessionRepository(db);
  }

  async getPrelogin(lookupHash: string, serverPepper: string = 'default-pepper') {
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
    // 1. Calculate / ensure username lookup hash
    let usernameHash = dto.usernameLookupHash;
    if (!usernameHash) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dto.username.toLowerCase()));
      usernameHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Check username collision
    const existingUserByUsername = await this.userRepo.findByUsernameLookupHash(usernameHash);
    if (existingUserByUsername) {
      throw AppError.conflict('An account with this username already exists');
    }

    // Check email collision if email provided
    let emailHash: string | null = null;
    if (dto.email) {
      emailHash = dto.emailLookupHash || null;
      if (!emailHash) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dto.email.toLowerCase()));
        emailHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }

      const existingUserByEmail = await this.userRepo.findByEmailLookupHash(emailHash);
      if (existingUserByEmail) {
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
      auth_verifier: dto.authVerifier,
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

    const user = await this.userRepo.findByIdentifierLookupHash(lookupHash);

    if (!user || !timingSafeEqualStr(user.auth_verifier, dto.authProof)) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Create session
    const rawTokenBytes = new Uint8Array(32);
    crypto.getRandomValues(rawTokenBytes);
    const token = Array.from(rawTokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const tokenHash = await hashToken(token);

    const now = Date.now();
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
    let emailHash = dto.emailLookupHash;
    if (!emailHash) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dto.email.toLowerCase()));
      emailHash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    const existing = await this.userRepo.findByEmailLookupHash(emailHash);
    if (existing && existing.id !== user.id) {
      throw AppError.conflict('This email address is already associated with another account');
    }

    const now = Date.now();
    await this.userRepo.updateEmail(user.id, dto.email, emailHash, now);

    return {
      success: true,
      message: 'Email address added and verified successfully',
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
