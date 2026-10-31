/**
 * Vault ciphertext freshness binding.
 *
 * Each vault save is AES-GCM encrypted with associated data naming the revision the server
 * will assign it (always current + 1). A server or DB writer therefore cannot relabel an old
 * ciphertext as a newer revision, and this device refuses any revision lower than the
 * highest one it has already seen.
 *
 * Migration: vaults written before this change have no associated data. They still decrypt
 * until this device has seen one bound save for that vault; from then on an unbound payload
 * is rejected, so the server cannot replay a pre-upgrade copy. A brand-new device has no
 * history and cannot detect a rollback on its first load.
 */

import { decryptAesGcm, encryptAesGcm } from './aes';
import { utf8ToBytes } from './encoding';
import { CryptoError } from './errors';

export class VaultRollbackError extends CryptoError {
  constructor(message: string) {
    super(message, 'VAULT_ROLLBACK');
    this.name = 'VaultRollbackError';
  }
}

export interface FreshnessStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStore(): FreshnessStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Not secret: only the highest revision number seen and whether binding is required. */
const revKey = (vaultId: string) => `surakshit_vault_rev:${vaultId}`;
const boundKey = (vaultId: string) => `surakshit_vault_bound:${vaultId}`;

export function vaultAad(revision: number): Uint8Array {
  return utf8ToBytes(`surakshit-vault/v1/rev:${revision}`);
}

export async function encryptVaultForRevision(plaintext: Uint8Array, vek: Uint8Array, revision: number) {
  return encryptAesGcm(plaintext, vek, undefined, vaultAad(revision));
}

export function recordSeenRevision(vaultId: string, revision: number, store = defaultStore()): void {
  if (!store || !vaultId) return;
  const prev = Number(store.getItem(revKey(vaultId)) || 0);
  if (revision > prev) store.setItem(revKey(vaultId), String(revision));
  store.setItem(boundKey(vaultId), '1');
}

/**
 * Decrypts a vault served by the server for `revision`, enforcing binding and monotonicity.
 * Returns whether the payload was a legacy (unbound) one.
 */
export async function decryptVaultForRevision(
  ciphertext: Uint8Array,
  vek: Uint8Array,
  iv: Uint8Array,
  revision: number,
  vaultId: string,
  store = defaultStore()
): Promise<{ plaintext: Uint8Array; legacy: boolean }> {
  const highest = store && vaultId ? Number(store.getItem(revKey(vaultId)) || 0) : 0;
  if (revision < highest) {
    throw new VaultRollbackError(
      `Server returned vault revision ${revision}, older than revision ${highest} already seen on this device. ` +
        'Refusing to load a rolled-back vault.'
    );
  }

  try {
    const plaintext = await decryptAesGcm(ciphertext, vek, iv, vaultAad(revision));
    recordSeenRevision(vaultId, revision, store);
    return { plaintext, legacy: false };
  } catch {
    // Not bound to this revision: only acceptable for a pre-upgrade vault on a device that has
    // never seen a bound save for it.
    if (store && vaultId && store.getItem(boundKey(vaultId)) === '1') {
      throw new VaultRollbackError(
        'Vault data from the server does not match its revision. It may have been replaced with an older copy.'
      );
    }
    const plaintext = await decryptAesGcm(ciphertext, vek, iv);
    return { plaintext, legacy: true };
  }
}
