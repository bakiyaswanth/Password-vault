/**
 * AegisVault API Request & Response Types
 */

import type { Argon2Params } from '../crypto/types';

export interface PreloginResponse {
  exists: boolean;
  kdfSalt: string;
  kdfParams: Argon2Params;
}

export interface RegisterRequest {
  emailLookupHash: string;
  kdfSalt: string;
  kdfParams: Argon2Params;
  authVerifier: string;
  encryptedVaultKey: string;
  encryptedRecoveryKey?: string;
  recoverySalt?: string;
  initialEncryptedVault: string;
  initialIv: string;
}

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    kdfSalt: string;
    kdfParams: Argon2Params;
    encryptedVaultKey: string;
    hasRecoveryKey: boolean;
  };
  sessionToken: string;
}

export interface VaultResponse {
  vaultId: string;
  revision: number;
  cryptoVersion: number;
  encryptedPayload: string;
  iv: string;
  updatedAt: number;
}
