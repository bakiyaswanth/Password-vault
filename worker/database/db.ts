/**
 * Surakshit Vault Database Facade & Repository Factory
 */

import { UserRepository } from '../repositories/UserRepository';
import { VaultRepository } from '../repositories/VaultRepository';
import { SessionRepository } from '../repositories/SessionRepository';
import type { DbUser, DbVault, DbVaultRevision, DbSession } from '../types';

export class Database {
  public readonly users: UserRepository;
  public readonly vaults: VaultRepository;
  public readonly sessions: SessionRepository;

  constructor(db: D1Database) {
    this.users = new UserRepository(db);
    this.vaults = new VaultRepository(db);
    this.sessions = new SessionRepository(db);
  }

  // Backward-compatible delegates
  async getUserByIdentifierLookupHash(lookupHash: string): Promise<DbUser | null> {
    return this.users.findByIdentifierLookupHash(lookupHash);
  }

  async getUserByEmailLookupHash(emailLookupHash: string): Promise<DbUser | null> {
    return this.users.findByEmailLookupHash(emailLookupHash);
  }

  async getUserByUsernameLookupHash(usernameLookupHash: string): Promise<DbUser | null> {
    return this.users.findByUsernameLookupHash(usernameLookupHash);
  }

  async getUserByUsername(username: string): Promise<DbUser | null> {
    return this.users.findByUsername(username);
  }

  async getUserById(id: string): Promise<DbUser | null> {
    return this.users.findById(id);
  }

  async updateUserEmail(userId: string, email: string, emailLookupHash: string, now: number): Promise<void> {
    return this.users.updateEmail(userId, email, emailLookupHash, now);
  }

  async createUser(user: DbUser, initialVault: DbVault): Promise<void> {
    return this.users.createUserWithInitialVault(user, initialVault);
  }

  async getVaultByUserId(userId: string): Promise<DbVault | null> {
    return this.vaults.findByUserId(userId);
  }

  async updateVault(
    vault: DbVault,
    newRevision: number,
    encryptedPayload: string,
    iv: string,
    now: number
  ): Promise<boolean> {
    return this.vaults.updateVaultWithRevision(vault, newRevision, encryptedPayload, iv, now);
  }

  async getVaultRevisions(vaultId: string, limit: number = 20): Promise<Array<Pick<DbVaultRevision, 'id' | 'revision' | 'created_at'>>> {
    return this.vaults.getRevisions(vaultId, limit);
  }

  async getVaultRevision(vaultId: string, revision: number): Promise<DbVaultRevision | null> {
    return this.vaults.getRevision(vaultId, revision);
  }

  async createSession(session: DbSession): Promise<void> {
    return this.sessions.create(session);
  }

  async getSessionByTokenHash(tokenHash: string): Promise<DbSession | null> {
    return this.sessions.findByTokenHash(tokenHash);
  }

  async updateSessionActivity(sessionId: string, now: number): Promise<void> {
    return this.sessions.updateLastActive(sessionId, now);
  }

  async deleteSession(tokenHash: string): Promise<void> {
    return this.sessions.deleteByTokenHash(tokenHash);
  }

  async getSessionsByUserId(userId: string): Promise<DbSession[]> {
    return this.sessions.findByUserId(userId);
  }

  async deleteSessionByIdAndUserId(sessionId: string, userId: string): Promise<void> {
    return this.sessions.deleteByIdAndUserId(sessionId, userId);
  }

  async deleteUser(userId: string): Promise<void> {
    return this.users.deleteUser(userId);
  }
}
