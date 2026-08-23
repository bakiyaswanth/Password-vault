/**
 * Session Data Access Repository
 */

import type { DbSession } from '../types';

export class SessionRepository {
  constructor(private readonly db: D1Database) {}

  async create(session: DbSession): Promise<void> {
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

  async findByTokenHash(tokenHash: string): Promise<DbSession | null> {
    const res = await this.db
      .prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?')
      .bind(tokenHash, Date.now())
      .first<DbSession>();
    return res ?? null;
  }

  async updateLastActive(sessionId: string, now: number): Promise<void> {
    await this.db
      .prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?')
      .bind(now, sessionId)
      .run();
  }

  async deleteByTokenHash(tokenHash: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(tokenHash)
      .run();
  }

  async findByUserId(userId: string): Promise<DbSession[]> {
    const res = await this.db
      .prepare('SELECT * FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_active_at DESC')
      .bind(userId, Date.now())
      .all<DbSession>();
    return res.results ?? [];
  }

  async deleteByIdAndUserId(sessionId: string, userId: string): Promise<void> {
    await this.db
      .prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?')
      .bind(sessionId, userId)
      .run();
  }
}
