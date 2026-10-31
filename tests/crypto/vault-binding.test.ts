import { describe, it, expect, beforeEach } from 'vitest';
import {
  decryptVaultForRevision,
  encryptVaultForRevision,
  recordSeenRevision,
  VaultRollbackError,
  type FreshnessStore,
} from '../../src/crypto/vault-binding';
import { encryptAesGcm } from '../../src/crypto/aes';
import { generateVaultKey } from '../../src/crypto/keys';
import { bytesToUtf8, utf8ToBytes } from '../../src/crypto/encoding';

class MemStore implements FreshnessStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const VAULT = 'vault-1';
let vek: Uint8Array;
let store: MemStore;

beforeEach(() => {
  vek = generateVaultKey();
  store = new MemStore();
});

const enc = (text: string, rev: number) => encryptVaultForRevision(utf8ToBytes(text), vek, rev);

describe('Fix 3: vault ciphertext bound to revision', () => {
  it('round-trips a vault for its revision', async () => {
    const { ciphertext, iv } = await enc('v2', 2);
    const { plaintext, legacy } = await decryptVaultForRevision(ciphertext, vek, iv, 2, VAULT, store);
    expect(bytesToUtf8(plaintext)).toBe('v2');
    expect(legacy).toBe(false);
  });

  it('rejects an old ciphertext relabelled as a newer revision', async () => {
    const old = await enc('v1-with-deleted-item', 1);
    recordSeenRevision(VAULT, 1, store);
    await expect(decryptVaultForRevision(old.ciphertext, vek, old.iv, 2, VAULT, store)).rejects.toBeInstanceOf(VaultRollbackError);
  });

  it('refuses a revision lower than one already seen on this device', async () => {
    recordSeenRevision(VAULT, 5, store);
    const v3 = await enc('v3', 3);
    await expect(decryptVaultForRevision(v3.ciphertext, vek, v3.iv, 3, VAULT, store)).rejects.toThrow(/older than revision 5/);
  });

  it('still loads a legacy (unbound) vault on a device that never saw a bound save', async () => {
    const legacy = await encryptAesGcm(utf8ToBytes('legacy'), vek);
    const res = await decryptVaultForRevision(legacy.ciphertext, vek, legacy.iv, 4, VAULT, store);
    expect(bytesToUtf8(res.plaintext)).toBe('legacy');
    expect(res.legacy).toBe(true);
  });

  it('rejects a legacy (unbound) payload once a bound save has been seen', async () => {
    recordSeenRevision(VAULT, 4, store);
    const legacy = await encryptAesGcm(utf8ToBytes('legacy'), vek);
    await expect(decryptVaultForRevision(legacy.ciphertext, vek, legacy.iv, 4, VAULT, store)).rejects.toBeInstanceOf(VaultRollbackError);
  });

  it('records the highest revision seen after a successful bound load', async () => {
    const v7 = await enc('v7', 7);
    await decryptVaultForRevision(v7.ciphertext, vek, v7.iv, 7, VAULT, store);
    expect(store.getItem(`surakshit_vault_rev:${VAULT}`)).toBe('7');
  });
});
