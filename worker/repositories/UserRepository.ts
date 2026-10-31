/**
 * User Data Access Repository
 */

import type { DbUser, DbVault } from '../types';

export class UserRepository {
  constructor(private readonly db: D1Database) {}

  async findById(id: string): Promise<DbUser | null> {
    const res = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<DbUser>();
    return res ?? null;
  }

  /**
   * Resolves a login identifier hash to exactly one account. Usernames and emails share one
   * lookup namespace, so a hash matching two rows is ambiguous and must not pick either.
   */
  async findByIdentifierLookupHash(lookupHash: string): Promise<DbUser | null> {
    const rows = await this.findAllByLookupHash(lookupHash);
    if (rows.length > 1) {
      console.error('[Auth] Ambiguous identifier lookup hash matches multiple accounts; refusing to resolve');
      return null;
    }
    return rows[0] ?? null;
  }

  /** Up to two accounts whose username OR email lookup hash equals `lookupHash`. */
  async findAllByLookupHash(lookupHash: string): Promise<DbUser[]> {
    const res = await this.db
      .prepare('SELECT * FROM users WHERE email_lookup_hash = ? OR username_lookup_hash = ? LIMIT 2')
      .bind(lookupHash, lookupHash)
      .all<DbUser>();
    return res.results ?? [];
  }

  async findByUsernameLookupHash(usernameLookupHash: string): Promise<DbUser | null> {
    const res = await this.db
      .prepare('SELECT * FROM users WHERE username_lookup_hash = ?')
      .bind(usernameLookupHash)
      .first<DbUser>();
    return res ?? null;
  }

  async findByEmailLookupHash(emailLookupHash: string): Promise<DbUser | null> {
    const res = await this.db
      .prepare('SELECT * FROM users WHERE email_lookup_hash = ?')
      .bind(emailLookupHash)
      .first<DbUser>();
    return res ?? null;
  }

  async findByUsername(username: string): Promise<DbUser | null> {
    const res = await this.db
      .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
      .bind(username.trim())
      .first<DbUser>();
    return res ?? null;
  }

  async createUserWithInitialVault(user: DbUser, initialVault: DbVault): Promise<void> {
    const batch = [
      this.db
        .prepare(
          `INSERT INTO users (
            id, username, email, email_lookup_hash, username_lookup_hash,
            kdf_salt, kdf_params, auth_verifier, encrypted_vault_key,
            encrypted_recovery_key, recovery_salt, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          user.id,
          user.username,
          user.email,
          user.email_lookup_hash,
          user.username_lookup_hash,
          user.kdf_salt,
          user.kdf_params,
          user.auth_verifier,
          user.encrypted_vault_key,
          user.encrypted_recovery_key,
          user.recovery_salt,
          user.created_at,
          user.updated_at
        ),
      this.db
        .prepare(
          `INSERT INTO vaults (
            id, user_id, current_revision, crypto_version, encrypted_payload, iv, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          initialVault.id,
          initialVault.user_id,
          initialVault.current_revision,
          initialVault.crypto_version,
          initialVault.encrypted_payload,
          initialVault.iv,
          initialVault.updated_at
        ),
    ];
    await this.db.batch(batch);
  }

  async updateEmail(userId: string, email: string, emailLookupHash: string, now: number): Promise<void> {
    await this.db
      .prepare('UPDATE users SET email = ?, email_lookup_hash = ?, updated_at = ? WHERE id = ?')
      .bind(email, emailLookupHash, now, userId)
      .run();
  }

  async upgradeVerifier(userId: string, previous: string, protectedVerifier: string, now: number): Promise<void> {
    // Conditional on the old value so a concurrent upgrade cannot be overwritten with a stale one.
    await this.db
      .prepare('UPDATE users SET auth_verifier = ?, updated_at = ? WHERE id = ? AND auth_verifier = ?')
      .bind(protectedVerifier, now, userId, previous)
      .run();
  }

  async deleteUser(userId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM users WHERE id = ?')
      .bind(userId)
      .run();
  }
}
