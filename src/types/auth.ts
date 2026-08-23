/**
 * AegisVault Authentication & Session Types
 */

import type { Argon2Params, EncryptedBlobV1 } from '../crypto/types';

export interface AuthUser {
  id: string;
  emailLookupHash: string;
  kdfSalt: string;
  kdfParams: Argon2Params;
  encryptedVaultKey: EncryptedBlobV1;
  hasRecoveryKey: boolean;
}

export type VaultLockState = 'locked' | 'unlocked' | 'unregistered';

export interface SessionDevice {
  id: string;
  userAgent: string | null;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  isCurrent: boolean;
}
