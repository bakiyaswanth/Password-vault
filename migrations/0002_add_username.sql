-- Surakshit Vault Database Migration: 0002_add_username.sql
-- Adds public username and optional email support with partial unique index

ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN username_lookup_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lookup ON users(username_lookup_hash) WHERE username_lookup_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lookup ON users(email_lookup_hash) WHERE email_lookup_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
