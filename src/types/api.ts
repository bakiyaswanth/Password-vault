/**
 * Surakshit Vault API Request & Response Types & Contracts
 */

import type { Argon2Params } from '../crypto/types';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface PreloginRequest {
  identifierLookupHash: string;
  emailLookupHash?: string;
}

export interface PreloginResponse {
  exists: boolean;
  kdfSalt: string;
  kdfParams: Argon2Params;
}

export interface RegisterRequest {
  username: string;
  usernameLookupHash?: string;
  email?: string;
  emailLookupHash?: string;
  kdfSalt: string;
  kdfParams: Argon2Params;
  authVerifier: string;
  encryptedVaultKey: string;
  encryptedRecoveryKey?: string;
  recoverySalt?: string;
  initialEncryptedVault: string;
  initialIv: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

export interface LoginRequest {
  identifierLookupHash: string;
  emailLookupHash?: string;
  authProof: string;
}

export interface LoginResponse {
  success: boolean;
  user: {
    id: string;
    username: string;
    email: string;
    kdfSalt: string;
    kdfParams: Argon2Params;
    encryptedVaultKey: string;
    hasRecoveryKey: boolean;
  };
  sessionToken: string;
}

export interface UpdateEmailRequest {
  email: string;
  emailLookupHash?: string;
}

export interface UpdateEmailResponse {
  success: boolean;
  message: string;
  email: string;
}

export interface MeResponse {
  authenticated: boolean;
  user: {
    id: string;
    username: string;
    email: string;
    kdfSalt: string;
    kdfParams: Argon2Params;
    encryptedVaultKey: string;
    hasRecoveryKey: boolean;
  };
}

export interface RecoverResponse {
  encryptedRecoveryKey: string;
  recoverySalt: string;
}

export interface VaultResponse {
  vaultId: string;
  revision: number;
  cryptoVersion: number;
  encryptedPayload: string;
  iv: string;
  updatedAt: number;
}

export interface SyncVaultRequest {
  expectedRevision: number;
  encryptedPayload: string;
  iv: string;
}

export interface SyncVaultResponse {
  success: boolean;
  revision: number;
  updatedAt: number;
}

export interface SyncConflictResponse {
  error: {
    code: string;
    message: string;
    details?: {
      currentRevision?: number;
      encryptedPayload?: string;
      iv?: string;
    };
  };
  currentRevision?: number;
  encryptedPayload?: string;
  iv?: string;
}

export interface SessionItem {
  id: string;
  userAgent: string | null;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  isCurrent: boolean;
}

export interface SessionsResponse {
  sessions: SessionItem[];
}
