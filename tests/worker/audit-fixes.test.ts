/**
 * Regression tests for the run-1 security audit leads.
 * Each describe block maps to one audit fingerprint.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../../worker/index';
import type { Env } from '../../worker/types';
import { MockD1Database, lookupHash, TEST_KDF } from './mock-d1';

const ORIGIN = 'https://surakshit-vault.pages.dev';

let db: MockD1Database;
let env: Env;

beforeEach(() => {
  db = new MockD1Database();
  env = {
    DB: db as unknown as D1Database,
    ENVIRONMENT: 'production',
    CORS_ORIGIN: ORIGIN,
    SERVER_PEPPER: 'test-pepper-0123456789',
    VERIFIER_KEY: 'test-verifier-key-0123456789abcdef',
  };
});

function api(path: string, body?: unknown, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return app.fetch(
    new Request(`${ORIGIN}${path}`, {
      method: init.method ?? (body !== undefined ? 'POST' : 'GET'),
      ...init,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env
  );
}

function registration(username: string, proof: string, extra: Record<string, unknown> = {}) {
  return {
    username,
    kdfSalt: 'c2FsdHNhbHRzYWx0c2FsdA==',
    kdfParams: TEST_KDF,
    authVerifier: proof,
    encryptedVaultKey: '{"k":1}',
    initialEncryptedVault: 'cGF5bG9hZA==',
    initialIv: 'aXZpdml2aXZpdml2',
    ...extra,
  };
}

async function register(username: string, proof: string, extra: Record<string, unknown> = {}) {
  return api('/api/auth/register', registration(username, proof, extra));
}

async function login(identifier: string, proof: string) {
  return api('/api/auth/login', { identifierLookupHash: await lookupHash(identifier), authProof: proof });
}

const userBy = (name: string) => [...db.users.values()].find((u) => u.username === name)!;

describe('Fix 1: stored auth_verifier is not a login credential', () => {
  it('stores an HMAC-protected verifier, not the raw proof', async () => {
    expect((await register('alice', 'proof-alice')).status).toBe(201);
    const stored = userBy('alice').auth_verifier as string;
    expect(stored.startsWith('h1:')).toBe(true);
    expect(stored).not.toContain('proof-alice');
  });

  it('logs in with the real proof but rejects the stored database value', async () => {
    await register('alice', 'proof-alice');
    expect((await login('alice', 'proof-alice')).status).toBe(200);
    expect((await login('alice', userBy('alice').auth_verifier)).status).toBe(401);
  });

  it('accepts a legacy raw verifier once and upgrades it in place', async () => {
    db.injectUser({
      id: 'legacy-1',
      username: 'legacy',
      email: null,
      email_lookup_hash: null,
      username_lookup_hash: await lookupHash('legacy'),
      kdf_salt: 's',
      kdf_params: JSON.stringify(TEST_KDF),
      auth_verifier: 'legacy-raw-proof',
      encrypted_vault_key: '{}',
      encrypted_recovery_key: null,
      recovery_salt: null,
      created_at: 1,
      updated_at: 1,
    });
    expect((await login('legacy', 'legacy-raw-proof')).status).toBe(200);
    expect(db.users.get('legacy-1')!.auth_verifier.startsWith('h1:')).toBe(true);
    // Still works after upgrade, and the old raw value no longer matches the stored one.
    expect((await login('legacy', 'legacy-raw-proof')).status).toBe(200);
  });

  it('fails closed when VERIFIER_KEY is missing', async () => {
    delete env.VERIFIER_KEY;
    const res = await register('alice', 'proof-alice');
    expect(res.status).toBe(500);
    expect(db.users.size).toBe(0);
  });

  it('fails closed on prelogin when SERVER_PEPPER is missing (no default pepper)', async () => {
    delete env.SERVER_PEPPER;
    const res = await api('/api/auth/prelogin', { identifierLookupHash: await lookupHash('nobody') });
    expect(res.status).toBe(500);
  });
});
