-- Surakshit Vault Database Migration: 0002_add_username.sql
-- Safely migrates the users table to support public usernames and optional email

PRAGMA foreign_keys = OFF;

-- 1. Create a temporary table with the new schema (optional email + public username)
CREATE TABLE IF NOT EXISTS users_v2 (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT,
  email_lookup_hash TEXT,
  username_lookup_hash TEXT,
  kdf_salt TEXT NOT NULL,
  kdf_params TEXT NOT NULL,
  auth_verifier TEXT NOT NULL,
  encrypted_vault_key TEXT NOT NULL,
  encrypted_recovery_key TEXT,
  recovery_salt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Migrate existing user records (preserving credentials, salts, and encrypted vault keys)
INSERT OR IGNORE INTO users_v2 (
  id, email_lookup_hash, kdf_salt, kdf_params, auth_verifier,
  encrypted_vault_key, encrypted_recovery_key, recovery_salt, created_at, updated_at
)
SELECT id, email_lookup_hash, kdf_salt, kdf_params, auth_verifier,
       encrypted_vault_key, encrypted_recovery_key, recovery_salt, created_at, updated_at
FROM users;

-- 3. Drop old table and rename the new table to users
DROP TABLE IF EXISTS users;
ALTER TABLE users_v2 RENAME TO users;

-- 4. Create partial unique indices
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lookup ON users(email_lookup_hash) WHERE email_lookup_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lookup ON users(username_lookup_hash) WHERE username_lookup_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

PRAGMA foreign_keys = ON;
