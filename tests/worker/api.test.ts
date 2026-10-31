import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../worker/index';
import { hashToken } from '../../worker/middleware/auth';
import type { Env } from '../../worker/types';
import { MockD1Database, lookupHash, TEST_KDF } from './mock-d1';

describe('Worker Backend API & Standard Error Responses', () => {
  let mockDb: MockD1Database;
  let env: Env;

  beforeEach(() => {
    mockDb = new MockD1Database();
    env = {
      DB: mockDb as unknown as D1Database,
      ENVIRONMENT: 'test',
      SERVER_PEPPER: 'test-pepper-12345',
      VERIFIER_KEY: 'test-verifier-key-0123456789abcdef',
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
        kdfParams: TEST_KDF,
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
        kdfParams: TEST_KDF,
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
      username_lookup_hash: await lookupHash('dev-user'),
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
        kdfParams: TEST_KDF,
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
      email_lookup_hash: await lookupHash('taken@example.com'),
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
