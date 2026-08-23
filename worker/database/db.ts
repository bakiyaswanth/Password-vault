/**
 * AegisVault D1 Database Helper Functions
 */

import type { DbUser, DbVault, DbVaultRevision, DbSession } from '../types';

export class Database {
  constructor(private readonly db: D1Database) {}

  async getUserByEmailLookupHash(emailLookupHash: string): Promise<DbUser | null> {
    const res = await this.db
      .prepare('SELECT * FROM users WHERE email_lookup_hash = ?')
      .bind(emailLookupHash)
      .first<DbUser>();
    return res ?? null;
  }

  async getUserById(id: string): Promise<DbUser | null> {
    const res = await this.db
      .prepare('SELECT * FROM users WHERE id = ?')
      .bind(id)
      .first<DbUser>();
    return res ?? null;
  }

  async createUser(user: DbUser, initialVault: DbVault): Promise<void> {
    const batch = [
      this.db
        .prepare(
          `INSERT INTO users (
            id, email_lookup_hash, kdf_salt, kdf_params, auth_verifier,
            encrypted_vault_key, encrypted_recovery_key, recovery_salt, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          user.id,
          user.email_lookup_hash,
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

  async getVaultByUserId(userId: string): Promise<DbVault | null> {
    const res = await this.db
      .prepare('SELECT * FROM vaults WHERE user_id = ?')
      .bind(userId)
      .first<DbVault>();
    return res ?? null;
  }

  async updateVault(
    vault: DbVault,
    newRevision: number,
    encryptedPayload: string,
    iv: string,
    now: number
  ): Promise<boolean> {
    // 1. Insert historical revision
    const revId = crypto.randomUUID();
    const batch = [
      this.db
        .prepare(
          `INSERT INTO vault_revisions (
            id, vault_id, user_id, revision, crypto_version, encrypted_payload, iv, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          revId,
          vault.id,
          vault.user_id,
          vault.current_revision,
          vault.crypto_version,
          vault.encrypted_payload,
          vault.iv,
          now
        ),
      this.db
        .prepare(
          `UPDATE vaults
           SET current_revision = ?, encrypted_payload = ?, iv = ?, updated_at = ?
           WHERE id = ? AND current_revision = ?`
        )
        .bind(newRevision, encryptedPayload, iv, now, vault.id, vault.current_revision),
    ];

    const results = await this.db.batch(batch);
    // Check if the UPDATE affected at least 1 row (Optimistic Concurrency Check)
    return results[1].meta.changes > 0;
  }

  async getVaultRevisions(vaultId: string, limit: number = 20): Promise<Array<Pick<DbVaultRevision, 'id' | 'revision' | 'created_at'>>> {
    const res = await this.db
      .prepare('SELECT id, revision, created_at FROM vault_revisions WHERE vault_id = ? ORDER BY revision DESC LIMIT ?')
      .bind(vaultId, limit)
      .all<Pick<DbVaultRevision, 'id' | 'revision' | 'created_at'>>();
    return res.results ?? [];
  }

  async getVaultRevision(vaultId: string, revision: number): Promise<DbVaultRevision | null> {
    const res = await this.db
      .prepare('SELECT * FROM vault_revisions WHERE vault_id = ? AND revision = ?')
      .bind(vaultId, revision)
      .first<DbVaultRevision>();
    return res ?? null;
  }

  async createSession(session: DbSession): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO sessions (
          id, user_id, token_hash, user_agent, ip_hash, expires_at, created_at, last_active_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        session.id,
        session.user_id,
        session.token_hash,
        session.user_agent,
        session.ip_hash,
        session.expires_at,
        session.created_at,
        session.last_active_at
      )
      .run();
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DbSession | null> {
    const res = await this.db
      .prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .bind(tokenHash, Date.now())
      .first<DbSession>();
    return res ?? null;
  }

  async updateSessionActivity(sessionId: string, now: number): Promise<void> {
    await this.db
      .prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?')
      .bind(now, sessionId)
      .run();
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run();
  }

  async getSessionsByUserId(userId: string): Promise<DbSession[]> {
    const res = await this.db
      .prepare('SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_active_at DESC')
      .bind(userId, Date.now())
      .all<DbSession>();
    return res.results ?? [];
  }

  async deleteSessionByIdAndUserId(sessionId: string, userId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .run();
  }

  async deleteUser(userId: string): Promise<void> {
    // Foreign key CASCADE will delete sessions, vaults, revisions
    await this.db
      .prepare('DELETE FROM users WHERE id = ?')
      .bind(userId)
      .run();
  }
}
