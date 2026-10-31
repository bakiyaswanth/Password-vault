/**
 * Surakshit Vault Cloudflare Worker Core Types & Contracts
 */

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  CORS_ORIGIN?: string;
  SERVER_PEPPER?: string;
  /** Secret used to HMAC stored auth verifiers. Required; set with `wrangler pages secret put VERIFIER_KEY`. */
  VERIFIER_KEY?: string;
  SESSION_SECRET?: string;
}

export interface DbUser {
  id: string;
  username: string | null;
  email: string | null;
  email_lookup_hash: string | null;
  username_lookup_hash: string | null;
  kdf_salt: string;
  kdf_params: string;
  auth_verifier: string;
  encrypted_vault_key: string;
  encrypted_recovery_key: string | null;
  recovery_salt: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbVault {
  id: string;
  user_id: string;
  current_revision: number;
  crypto_version: number;
  encrypted_payload: string;
  iv: string;
  updated_at: number;
}

export interface DbVaultRevision {
  id: string;
  vault_id: string;
  user_id: string;
  revision: number;
  crypto_version: number;
  encrypted_payload: string;
  iv: string;
  created_at: number;
}

export interface DbSession {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent: string | null;
  ip_hash: string | null;
  expires_at: number;
  created_at: number;
  last_active_at: number;
}

export interface Variables {
  user?: DbUser;
  session?: DbSession;
}

// Request & Response DTOs
export interface PreloginDto {
  identifierLookupHash?: string;
  emailLookupHash?: string;
}

export interface RegisterDto {
  username: string;
  usernameLookupHash?: string;
  email?: string;
  emailLookupHash?: string;
  kdfSalt: string;
  kdfParams: Record<string, unknown>;
  authVerifier: string;
  encryptedVaultKey: string;
  encryptedRecoveryKey?: string;
  recoverySalt?: string;
  initialEncryptedVault: string;
  initialIv: string;
}

export interface LoginDto {
  identifierLookupHash?: string;
  emailLookupHash?: string;
  authProof: string;
}

export interface UpdateEmailDto {
  email: string;
  emailLookupHash?: string;
}

export interface SyncVaultDto {
  expectedRevision: number;
  encryptedPayload: string;
  iv: string;
}
