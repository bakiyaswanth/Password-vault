import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../worker/index';
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
            if (query.includes('FROM users WHERE email_lookup_hash = ?')) {
              const hash = params[0];
              for (const u of self.users.values()) {
                if (u.email_lookup_hash === hash) return u as T;
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

  async batch(statements: any[]) {
    const results: any[] = [];
    for (const stmt of statements) {
      if (stmt && stmt.bind) {
        // execute
      }
      results.push({ meta: { changes: 1 } });
    }
    return results;
  }

  // Direct injection for test setup
  injectUser(user: any, vault: any) {
    this.users.set(user.id, user);
    this.vaults.set(vault.id, vault);
  }
}

describe('Worker Backend API Endpoints', () => {
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

  it('POST /api/auth/prelogin returns fake salt for non-existent user to prevent enumeration', async () => {
    const req = new Request('http://localhost/api/auth/prelogin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailLookupHash: 'non-existent-hash-123' }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.exists).toBe(false);
    expect(typeof data.kdfSalt).toBe('string');
  });

  it('POST /api/auth/login authenticates with valid proof and returns session', async () => {
    const user = {
      id: 'user-1',
      email_lookup_hash: 'known-hash',
      kdf_salt: 'salt123',
      kdf_params: JSON.stringify({ iterations: 3 }),
      auth_verifier: 'correct-proof-hash',
      encrypted_vault_key: 'encrypted-key-blob',
      encrypted_recovery_key: null,
      recovery_salt: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    const vault = {
      id: 'vault-1',
      user_id: 'user-1',
      current_revision: 1,
      crypto_version: 1,
      encrypted_payload: 'encrypted-items',
      iv: 'iv-123',
      updated_at: Date.now(),
    };
    mockDb.injectUser(user, vault);

    // Valid login
    const reqValid = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailLookupHash: 'known-hash', authProof: 'correct-proof-hash' }),
    });

    const resValid = await app.fetch(reqValid, env);
    expect(resValid.status).toBe(200);
    const dataValid = (await resValid.json()) as any;
    expect(dataValid.success).toBe(true);
    expect(dataValid.user.encryptedVaultKey).toBe('encrypted-key-blob');
    expect(dataValid.sessionToken).toBeDefined();

    // Invalid login
    const reqInvalid = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailLookupHash: 'known-hash', authProof: 'wrong-proof-hash' }),
    });

    const resInvalid = await app.fetch(reqInvalid, env);
    expect(resInvalid.status).toBe(401);
  });

  it('GET /api/vault rejects unauthenticated requests', async () => {
    const req = new Request('http://localhost/api/vault');
    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
  });
});
