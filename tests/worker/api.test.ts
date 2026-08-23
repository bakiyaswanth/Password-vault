import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../worker/index';
import { hashToken } from '../../worker/middleware/auth';
import type { Env } from '../../worker/types';

// In-memory mock SQLite D1 Database for high-speed deterministic integration testing
class MockD1Database {
  private users: Map<string, any> = new Map();
  private vaults: Map<string, any> = new Map();
  private revisions: any[] = [];
  private sessions: Map<string, any> = new Map();
  private rateLimits: Map<string, any> = new Map();

  prepare(query: string) {
    const self = this;
    return {
      bind(...params: any[]) {
        return {
          async first<T = any>(): Promise<T | null> {
            if (query.includes('FROM users WHERE email_lookup_hash = ? OR username_lookup_hash = ?')) {
              const hash1 = params[0];
              const hash2 = params[1];
              for (const u of self.users.values()) {
                if (u.email_lookup_hash === hash1 || u.username_lookup_hash === hash2) return u as T;
              }
              return null;
            }
            if (query.includes('FROM users WHERE email_lookup_hash = ?')) {
              const hash = params[0];
              for (const u of self.users.values()) {
                if (u.email_lookup_hash === hash) return u as T;
              }
              return null;
            }
            if (query.includes('FROM users WHERE username_lookup_hash = ?')) {
              const hash = params[0];
              for (const u of self.users.values()) {
                if (u.username_lookup_hash === hash) return u as T;
              }
              return null;
            }
            if (query.includes('FROM users WHERE LOWER(username) = LOWER(?)')) {
              const uname = (params[0] || '').toLowerCase();
              for (const u of self.users.values()) {
                if ((u.username || '').toLowerCase() === uname) return u as T;
              }
              return null;
            }
            if (query.includes('FROM users WHERE id = ?')) {
              return (self.users.get(params[0]) || null) as T;
            }
            if (query.includes('FROM vaults WHERE user_id = ?')) {
              for (const v of self.vaults.values()) {
                if (v.user_id === params[0]) return v as T;
              }
              return null;
            }
            if (query.includes('FROM sessions WHERE token_hash = ?')) {
              const hash = params[0];
              const s = self.sessions.get(hash);
              if (s && s.expires_at > params[1]) return s as T;
              return null;
            }
            if (query.includes('FROM rate_limits WHERE key = ?')) {
              return (self.rateLimits.get(params[0]) || null) as T;
            }
            if (query.includes('FROM vault_revisions WHERE vault_id = ? AND revision = ?')) {
              const rev = self.revisions.find((r) => r.vault_id === params[0] && r.revision === params[1]);
              return (rev || null) as T;
            }
            return null;
          },
          async all<T = any>(): Promise<{ results: T[] }> {
            if (query.includes('FROM sessions WHERE user_id = ?')) {
              const list = Array.from(self.sessions.values()).filter((s) => s.user_id === params[0]);
              return { results: list as T[] };
            }
            if (query.includes('FROM vault_revisions WHERE vault_id = ?')) {
              const list = self.revisions.filter((r) => r.vault_id === params[0]);
              return { results: list as T[] };
            }
            return { results: [] };
          },
          async run() {
            if (query.includes('UPDATE users SET email = ?, email_lookup_hash = ?')) {
              const user = self.users.get(params[3]);
              if (user) {
                user.email = params[0];
                user.email_lookup_hash = params[1];
                user.updated_at = params[2];
              }
            }
            if (query.includes('INSERT INTO sessions')) {
              const s = {
                id: params[0],
                user_id: params[1],
                token_hash: params[2],
                user_agent: params[3],
                ip_hash: params[4],
                expires_at: params[5],
                created_at: params[6],
                last_active_at: params[7],
              };
              self.sessions.set(s.token_hash, s);
            }
            if (query.includes('DELETE FROM sessions WHERE token_hash = ?')) {
              self.sessions.delete(params[0]);
            }
            if (query.includes('DELETE FROM sessions WHERE id = ?')) {
              for (const [k, v] of self.sessions.entries()) {
                if (v.id === params[0]) self.sessions.delete(k);
              }
            }
            if (query.includes('DELETE FROM users WHERE id = ?')) {
              self.users.delete(params[0]);
              for (const [k, v] of self.vaults.entries()) {
                if (v.user_id === params[0]) self.vaults.delete(k);
              }
            }
            if (query.includes('INSERT OR REPLACE INTO rate_limits')) {
              self.rateLimits.set(params[0], { count: params[1], reset_at: params[2] });
            }
            if (query.includes('UPDATE rate_limits SET count = count + 1')) {
              const curr = self.rateLimits.get(params[0]);
              if (curr) curr.count += 1;
            }
            return { meta: { changes: 1 } };
          },
        };
      },
    };
  }

  async batch(_statements: any[]) {
    return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
  }

  injectUser(user: any, vault?: any) {
    this.users.set(user.id, user);
    if (vault) this.vaults.set(vault.id, vault);
  }

  injectSession(session: any) {
    this.sessions.set(session.token_hash, session);
  }
}

describe('Worker Backend API & Standard Error Responses', () => {
  let mockDb: MockD1Database;
  let env: Env;

  beforeEach(() => {
    mockDb = new MockD1Database();
    env = {
      DB: mockDb as unknown as D1Database,
      ENVIRONMENT: 'test',
      SERVER_PEPPER: 'test-pepper-12345',
      CORS_ORIGIN: 'http://localhost:3000',
    };
  });

  it('GET /api/health returns 200 with zero-knowledge indicator', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.zeroKnowledge).toBe(true);
  });

  it('POST /api/auth/register creates user with username only and NO email', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'coder-bob',
        usernameLookupHash: 'bob-uname-hash',
        kdfSalt: 'salt-bob',
        kdfParams: { iterations: 3 },
        authVerifier: 'verifier-bob',
        encryptedVaultKey: 'key-bob',
        initialEncryptedVault: 'payload-bob',
        initialIv: 'iv-bob',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.user.username).toBe('coder-bob');
    expect(data.user.email).toBe('');
  });

  it('POST /api/auth/register creates user with username AND email', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'alice-crypto',
        email: 'alice@example.com',
        usernameLookupHash: 'alice-uname-hash',
        emailLookupHash: 'alice-email-hash',
        kdfSalt: 'salt-alice',
        kdfParams: { iterations: 3 },
        authVerifier: 'verifier-alice',
        encryptedVaultKey: 'key-alice',
        initialEncryptedVault: 'payload-alice',
        initialIv: 'iv-alice',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(201);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.user.username).toBe('alice-crypto');
    expect(data.user.email).toBe('alice@example.com');
  });

  it('POST /api/auth/register rejects duplicate username with CONFLICT code', async () => {
    const existing = {
      id: 'user-exist',
      username: 'dev-user',
      email: null,
      email_lookup_hash: null,
      username_lookup_hash: 'hash-dev-user',
      kdf_salt: 'salt',
      kdf_params: '{}',
      auth_verifier: 'verifier',
      encrypted_vault_key: 'key',
      encrypted_recovery_key: null,
      recovery_salt: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    mockDb.injectUser(existing);

    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'dev-user',
        usernameLookupHash: 'hash-dev-user',
        kdfSalt: 'salt',
        kdfParams: { iterations: 3 },
        authVerifier: 'verifier',
        encryptedVaultKey: 'key',
        initialEncryptedVault: 'payload',
        initialIv: 'iv',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('CONFLICT');
    expect(data.error.message).toContain('username already exists');
  });

  it('PUT /api/auth/email allows user to add email later', async () => {
    const user = {
      id: 'user-1',
      username: 'dev-user',
      email: null,
      email_lookup_hash: null,
      username_lookup_hash: 'hash-uname',
      kdf_salt: 'salt123',
      kdf_params: JSON.stringify({ iterations: 3 }),
      auth_verifier: 'proof',
      encrypted_vault_key: 'key',
      encrypted_recovery_key: null,
      recovery_salt: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const rawToken = 'my-valid-raw-token';
    const tokenHash = await hashToken(rawToken);

    const session = {
      id: 'session-1',
      user_id: 'user-1',
      token_hash: tokenHash,
      user_agent: 'Test Browser',
      ip_hash: 'ip',
      expires_at: Date.now() + 100000,
      created_at: Date.now(),
      last_active_at: Date.now(),
    };

    mockDb.injectUser(user);
    mockDb.injectSession(session);

    const req = new Request('http://localhost/api/auth/email', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${rawToken}`,
      },
      body: JSON.stringify({
        email: 'user@example.com',
        emailLookupHash: 'hash-email-new',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.email).toBe('user@example.com');
  });

  it('PUT /api/auth/email rejects duplicate email already registered', async () => {
    const otherUser = {
      id: 'user-other',
      username: 'other-user',
      email: 'taken@example.com',
      email_lookup_hash: 'hash-taken-email',
      username_lookup_hash: 'hash-other-uname',
      kdf_salt: 'salt',
      kdf_params: '{}',
      auth_verifier: 'verifier',
      encrypted_vault_key: 'key',
      encrypted_recovery_key: null,
      recovery_salt: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const user = {
      id: 'user-2',
      username: 'current-user',
      email: null,
      email_lookup_hash: null,
      username_lookup_hash: 'hash-curr-uname',
      kdf_salt: 'salt',
      kdf_params: '{}',
      auth_verifier: 'verifier',
      encrypted_vault_key: 'key',
      encrypted_recovery_key: null,
      recovery_salt: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const rawToken = 'user-2-raw-token';
    const tokenHash = await hashToken(rawToken);

    const session = {
      id: 'session-2',
      user_id: 'user-2',
      token_hash: tokenHash,
      user_agent: 'Test Browser',
      ip_hash: 'ip',
      expires_at: Date.now() + 100000,
      created_at: Date.now(),
      last_active_at: Date.now(),
    };

    mockDb.injectUser(otherUser);
    mockDb.injectUser(user);
    mockDb.injectSession(session);

    const req = new Request('http://localhost/api/auth/email', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${rawToken}`,
      },
      body: JSON.stringify({
        email: 'taken@example.com',
        emailLookupHash: 'hash-taken-email',
      }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(409);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('CONFLICT');
    expect(data.error.message).toContain('already associated with another account');
  });
});
