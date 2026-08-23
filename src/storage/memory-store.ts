/**
 * AegisVault Ephemeral In-Memory Store
 * Sensitive decrypted items and Vault Encryption Keys (VEK) are held ONLY in memory.
 * Never writes unencrypted data to localStorage or sessionStorage.
 * Supports explicit zeroization on lock.
 */

import type { DecryptedVault } from '../types/vault';

type Listener = () => void;

class EphemeralMemoryStore {
  private vaultKey: Uint8Array | null = null;
  private vault: DecryptedVault | null = null;
  private revision: number = 1;
  private vaultId: string | null = null;
  private listeners: Set<Listener> = new Set();

  setVaultKey(key: Uint8Array) {
    this.vaultKey = new Uint8Array(key);
    this.notify();
  }

  getVaultKey(): Uint8Array | null {
    return this.vaultKey;
  }

  hasVaultKey(): boolean {
    return this.vaultKey !== null && this.vaultKey.byteLength === 32;
  }

  setVault(vault: DecryptedVault, revision: number, vaultId: string) {
    this.vault = vault;
    this.revision = revision;
    this.vaultId = vaultId;
    this.notify();
  }

  getVault(): DecryptedVault | null {
    return this.vault;
  }

  getRevision(): number {
    return this.revision;
  }

  getVaultId(): string | null {
    return this.vaultId;
  }

  updateItems(updater: (currentItems: DecryptedVault) => DecryptedVault) {
    if (!this.vault) return;
    this.vault = updater(this.vault);
    this.notify();
  }

  /**
   * Overwrites the encryption key in memory and clears all decrypted vault items.
   */
  zeroize() {
    if (this.vaultKey) {
      this.vaultKey.fill(0); // Overwrite with zeros
      this.vaultKey = null;
    }
    this.vault = null;
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Memory store listener error', err);
      }
    }
  }
}

export const memoryStore = new EphemeralMemoryStore();
