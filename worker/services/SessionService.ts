/**
 * Session Business Logic Service
 */

import { UserRepository } from '../repositories/UserRepository';
import { SessionRepository } from '../repositories/SessionRepository';

export class SessionService {
  private userRepo: UserRepository;
  private sessionRepo: SessionRepository;

  constructor(db: D1Database) {
    this.userRepo = new UserRepository(db);
    this.sessionRepo = new SessionRepository(db);
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.sessionRepo.findByUserId(userId);

    const formatted = sessions.map((s) => ({
      id: s.id,
      userAgent: s.user_agent,
      createdAt: s.created_at,
      lastActiveAt: s.last_active_at,
      expiresAt: s.expires_at,
      isCurrent: s.id === currentSessionId,
    }));

    return { sessions: formatted };
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.sessionRepo.deleteByIdAndUserId(sessionId, userId);
    return { success: true, message: 'Session revoked successfully' };
  }

  async purgeAccount(userId: string) {
    await this.userRepo.deleteUser(userId);
    return {
      cookieHeader: 'aegis_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0',
      response: { success: true, message: 'Account and encrypted vault permanently deleted' },
    };
  }
}
