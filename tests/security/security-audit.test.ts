import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../worker/index';
import { hashToken } from '../../worker/middleware/auth';
import type { Env } from '../../worker/types';

class MockSecurityDb {
  public users: Map<string, any> = new Map();
  public vaults: Map<string, any> = new Map();
  public sessions: Map<string, any> = new Map();
  public rateLimits: Map<string, any> = new Map();

  prepare(query: string) {
    const self = this;
    return {
      bind(...params: any[]) {
        return {
          async first<T = any>(): Promise<T | null> {
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
              const s = self.sessions.get(params[0]);
              if (s && s.expires_at > params[1]) return s as T;
              return null;
            }
            if (query.includes('FROM rate_limits WHERE key = ?')) {
              return (self.rateLimits.get(params[0]) || null) as T;
            }
            return null;
          },
          async all<T = any>(): Promise<{ results: T[] }> {
            if (query.includes('FROM sessions WHERE user_id = ?')) {
              const list = Array.from(self.sessions.values()).filter((s) => s.user_id === params[0]);
              return { results: list as T[] };
            }
            return { results: [] };
          },
          async run() {
            if (query.includes('DELETE FROM sessions WHERE id = ? AND user_id = ?')) {
              const [sessionId, userId] = params;
              for (const [k, v] of self.sessions.entries()) {
                if (v.id === sessionId && v.user_id === userId) {
                  self.sessions.delete(k);
                }
              }
            }
            return { meta: { changes: 1 } };
          },
        };
      },
    };
  }

  async batch(_statements: any[]) {
    return [{ meta: { changes: 1 } }];
  }
}

describe('Security & Authorization Audit Tests (ASVS Baseline)', () => {
  let mockDb: MockSecurityDb;
  let env: Env;

  const userA = {
    id: 'user-a-uuid',
    username: 'alice',
    email: 'alice@example.com',
    email_lookup_hash: 'hash-alice-email',
    username_lookup_hash: 'hash-alice-uname',
    kdf_salt: 'salt-a',
    kdf_params: '{}',
    auth_verifier: 'verifier-a',
    encrypted_vault_key: 'key-a',
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const userB = {
    id: 'user-b-uuid',
    username: 'bob',
    email: 'bob@example.com',
    email_lookup_hash: 'hash-bob-email',
    username_lookup_hash: 'hash-bob-uname',
    kdf_salt: 'salt-b',
    kdf_params: '{}',
    auth_verifier: 'verifier-b',
    encrypted_vault_key: 'key-b',
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const vaultA = {
    id: 'vault-a-uuid',
    user_id: 'user-a-uuid',
    current_revision: 1,
    crypto_version: 1,
    encrypted_payload: 'alice-secret-vault-payload',
    iv: 'iv-a',
    updated_at: Date.now(),
  };

  const vaultB = {
    id: 'vault-b-uuid',
    user_id: 'user-b-uuid',
    current_revision: 1,
    crypto_version: 1,
    encrypted_payload: 'bob-secret-vault-payload',
    iv: 'iv-b',
    updated_at: Date.now(),
  };

  let tokenA: string;
  let tokenB: string;

  beforeEach(async () => {
    mockDb = new MockSecurityDb();
    env = {
      DB: mockDb as unknown as D1Database,
      ENVIRONMENT: 'production',
      SERVER_PEPPER: 'prod-pepper',
      CORS_ORIGIN: 'https://surakshit-vault.pages.dev',
    };

    mockDb.users.set(userA.id, userA);
    mockDb.users.set(userB.id, userB);
    mockDb.vaults.set(vaultA.id, vaultA);
    mockDb.vaults.set(vaultB.id, vaultB);

    tokenA = 'alice-bearer-token';
    tokenB = 'bob-bearer-token';

    const hashA = await hashToken(tokenA);
    const hashB = await hashToken(tokenB);

    mockDb.sessions.set(hashA, {
      id: 'session-a-id',
      user_id: userA.id,
      token_hash: hashA,
      user_agent: 'Alice Browser',
      ip_hash: 'ip',
      expires_at: Date.now() + 100000,
      created_at: Date.now(),
      last_active_at: Date.now(),
    });

    mockDb.sessions.set(hashB, {
      id: 'session-b-id',
      user_id: userB.id,
      token_hash: hashB,
      user_agent: 'Bob Browser',
      ip_hash: 'ip',
      expires_at: Date.now() + 100000,
      created_at: Date.now(),
      last_active_at: Date.now(),
    });
  });

  it('BOLA / IDOR Prevention: User A can only retrieve User A vault and NEVER User B vault', async () => {
    const req = new Request('http://localhost/api/vault', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.encryptedPayload).toBe('alice-secret-vault-payload');
    expect(data.encryptedPayload).not.toBe('bob-secret-vault-payload');
  });

  it('Session Authorization: User A cannot revoke User B session', async () => {
    const req = new Request('http://localhost/api/sessions/session-b-id', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);

    // Bob session must still exist
    const bobTokenHash = await hashToken(tokenB);
    expect(mockDb.sessions.has(bobTokenHash)).toBe(true);
  });

  it('Unauthenticated requests are rejected with 401 UNAUTHORIZED', async () => {
    const req = new Request('http://localhost/api/vault', {
      method: 'GET',
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
    const data = (await res.json()) as any;
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('Security Headers are present on API responses', async () => {
    const req = new Request('http://localhost/api/health');
    const res = await app.fetch(req, env);

    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
  });
});
