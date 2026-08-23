/**
 * Vault Data Access Repository
 */

import type { DbVault, DbVaultRevision } from '../types';

export class VaultRepository {
  constructor(private readonly db: D1Database) {}

  async findByUserId(userId: string): Promise<DbVault | null> {
    const res = await this.db
      .prepare('SELECT * FROM vaults WHERE user_id = ?')
      .bind(userId)
      .first<DbVault>();
    return res ?? null;
  }

  async updateVaultWithRevision(
    vault: DbVault,
    newRevision: number,
    encryptedPayload: string,
    iv: string,
    now: number
  ): Promise<boolean> {
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
    return results[1].meta.changes > 0;
  }

  async getRevisions(vaultId: string, limit: number = 20): Promise<Array<Pick<DbVaultRevision, 'id' | 'revision' | 'created_at'>>> {
    const res = await this.db
      .prepare('SELECT id, revision, created_at FROM vault_revisions WHERE vault_id = ? ORDER BY revision DESC LIMIT ?')
      .bind(vaultId, limit)
      .all<Pick<DbVaultRevision, 'id' | 'revision' | 'created_at'>>();
    return res.results ?? [];
  }

  async getRevision(vaultId: string, revision: number): Promise<DbVaultRevision | null> {
    const res = await this.db
      .prepare('SELECT * FROM vault_revisions WHERE vault_id = ? AND revision = ?')
      .bind(vaultId, revision)
      .first<DbVaultRevision>();
    return res ?? null;
  }
}
