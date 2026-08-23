-- Surakshit Vault Database Migration: 0001_initial_schema.sql
-- Zero-knowledge schema for Cloudflare D1 (SQLite)

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  email_lookup_hash TEXT,
  username_lookup_hash TEXT NOT NULL,
  kdf_salt TEXT NOT NULL,
  kdf_params TEXT NOT NULL,
  auth_verifier TEXT NOT NULL,
  encrypted_vault_key TEXT NOT NULL,
  encrypted_recovery_key TEXT,
  recovery_salt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lookup ON users(email_lookup_hash) WHERE email_lookup_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lookup ON users(username_lookup_hash) WHERE username_lookup_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 2. Vaults Table (Active state)
CREATE TABLE IF NOT EXISTS vaults (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  current_revision INTEGER NOT NULL DEFAULT 1,
  crypto_version INTEGER NOT NULL DEFAULT 1,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Vault Revisions Table (Version History & Optimistic Concurrency)
CREATE TABLE IF NOT EXISTS vault_revisions (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  crypto_version INTEGER NOT NULL,
  encrypted_payload TEXT NOT NULL,
  iv TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (vault_id) REFERENCES vaults(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_revisions_vault_rev ON vault_revisions(vault_id, revision DESC);

-- 4. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- 5. WebAuthn Credentials Table (Passkeys)
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_name TEXT,
  transports TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user_id ON webauthn_credentials(user_id);

-- 6. Rate Limiting Table
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
