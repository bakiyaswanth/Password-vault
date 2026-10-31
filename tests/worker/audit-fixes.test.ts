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

describe('Fix 2: server rejects weak KDF params at registration', () => {
  it('rejects a downgraded kdfParams object', async () => {
    const res = await register('weak', 'p', { kdfParams: { memoryKiB: 8, iterations: 1, parallelism: 1, keyLengthBytes: 32 } });
    expect(res.status).toBe(400);
    expect(db.users.size).toBe(0);
  });

  it('accepts the default params', async () => {
    expect((await register('strong', 'p')).status).toBe(201);
  });
});

describe('Fix 4: identifier lookup hashes are server-computed and unique across columns', () => {
  async function sessionFor(username: string, proof: string) {
    const res = await login(username, proof);
    expect(res.status).toBe(200);
    return ((await res.json()) as any).sessionToken as string;
  }

  it('ignores client-supplied lookup hashes and stores sha256(lower(identifier))', async () => {
    await register('Alice', 'p', { usernameLookupHash: 'attacker-chosen', email: 'A@X.test', emailLookupHash: 'also-chosen' });
    const u = userBy('Alice');
    expect(u.username_lookup_hash).toBe(await lookupHash('alice'));
    expect(u.email_lookup_hash).toBe(await lookupHash('a@x.test'));
  });

  it('rejects registering an email whose hash equals an existing username hash', async () => {
    await register('victim', 'pv');
    // Pre-fix attack: claim the victim's username hash as this account's email hash.
    const res = await register('mallory', 'pm', { email: 'victim', emailLookupHash: await lookupHash('victim') });
    // 'victim' is not a valid email, so the server rejects it; and a client hash alone is ignored.
    expect([400, 409]).toContain(res.status);
    expect((await login('victim', 'pv')).status).toBe(200);
  });

  it('rejects a new username that collides with an existing email hash', async () => {
    await register('owner', 'po', { email: 'shared@x.test' });
    // Usernames cannot contain @, so construct the collision via a pre-existing row instead.
    db.injectUser({ ...userBy('owner'), id: 'other', username: 'other', username_lookup_hash: await lookupHash('other'), email: null, email_lookup_hash: await lookupHash('newname') });
    expect((await register('newname', 'pn')).status).toBe(409);
  });

  it('PUT /api/auth/email cannot claim a hash used by another account in either column', async () => {
    await register('victim', 'pv', { email: 'victim@x.test' });
    await register('mallory', 'pm');
    const token = await sessionFor('mallory', 'pm');
    const res = await api('/api/auth/email', { email: 'victim@x.test', emailLookupHash: await lookupHash('victim') }, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(409);
    expect(userBy('mallory').email_lookup_hash).toBeNull();
    expect((await login('victim', 'pv')).status).toBe(200);
  });

  it('PUT /api/auth/email stores the server-computed hash and no longer claims verification', async () => {
    await register('bob', 'pb');
    const token = await sessionFor('bob', 'pb');
    const res = await api('/api/auth/email', { email: 'bob@x.test', emailLookupHash: 'forged' }, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).message).not.toMatch(/verified/i);
    expect(userBy('bob').email_lookup_hash).toBe(await lookupHash('bob@x.test'));
  });

  it('refuses to resolve an identifier hash that matches two accounts', async () => {
    await register('alice', 'pa');
    // Simulate a pre-existing collision written before this fix.
    db.injectUser({ ...userBy('alice'), id: 'squatter', username: 'squatter', username_lookup_hash: 'x', email_lookup_hash: await lookupHash('alice') });
    expect((await login('alice', 'pa')).status).toBe(401);
    const pre = (await (await api('/api/auth/prelogin', { identifierLookupHash: await lookupHash('alice') })).json()) as any;
    expect(pre.exists).toBe(false);
  });
});

describe('Fix 5: bounded vault payloads and revision retention', () => {
  async function authed() {
    await register('carol', 'pc');
    const res = await login('carol', 'pc');
    return ((await res.json()) as any).sessionToken as string;
  }
  const sync = (token: string, expectedRevision: number, encryptedPayload: string, iv = 'aXZpdml2aXZpdml2') =>
    api('/api/vault', { expectedRevision, encryptedPayload, iv }, { method: 'PUT', headers: { Authorization: `Bearer ${token}` } });

  it('rejects an encryptedPayload above the cap with 413', async () => {
    const token = await authed();
    const res = await sync(token, 1, 'A'.repeat(1_500_001));
    expect(res.status).toBe(413);
    expect(((await res.json()) as any).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects a request body above the 2 MB limit before parsing', async () => {
    const token = await authed();
    const res = await sync(token, 1, 'A'.repeat(2 * 1024 * 1024 + 10));
    expect(res.status).toBe(413);
  });

  it('rejects an oversized iv', async () => {
    const token = await authed();
    expect((await sync(token, 1, 'cGF5', 'x'.repeat(65))).status).toBe(400);
  });

  it('rejects an oversized initial vault at registration', async () => {
    expect((await register('big', 'p', { initialEncryptedVault: 'A'.repeat(1_500_001) })).status).toBe(413);
  });

  it('keeps only the newest 20 revisions after many saves', async () => {
    const token = await authed();
    for (let rev = 1; rev <= 25; rev++) {
      expect((await sync(token, rev, `cGF5bG9hZC0${rev}`)).status).toBe(200);
    }
    const kept = db.revisions.map((r) => r.revision).sort((a, b) => a - b);
    expect(kept).toHaveLength(20);
    expect(kept[0]).toBe(6);
    expect(kept[kept.length - 1]).toBe(25);
  });
});
