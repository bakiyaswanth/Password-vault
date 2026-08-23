/**
 * AegisVault Cloudflare Worker Type Definitions
 */

export interface Env {
  DB: D1Database;
  ENVIRONMENT?: string;
  CORS_ORIGIN?: string;
  SERVER_PEPPER?: string;
  SESSION_SECRET?: string;
}

export interface DbUser {
  id: string;
  email_lookup_hash: string;
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
