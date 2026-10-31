/**
 * Authentication Input Validation Helpers
 */

import { AppError } from '../errors/AppError';
import type { RegisterDto, LoginDto, UpdateEmailDto } from '../types';

export function validateUsername(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw AppError.validation('Username is required and must be a string');
  }
  const username = raw.trim();
  if (username.length < 3 || username.length > 30) {
    throw AppError.validation('Username must be between 3 and 30 characters long');
  }
  if (username.includes('@')) {
    throw AppError.validation('Username cannot contain the @ character');
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
    throw AppError.validation('Username can only contain letters, numbers, dots, dashes, and underscores');
  }
  return username;
}

export function validateEmail(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  if (typeof raw !== 'string') {
    throw AppError.validation('Email must be a string if provided');
  }
  const email = raw.trim();
  if (email.length === 0) {
    return null;
  }
  if (email.length > 254) {
    throw AppError.validation('Email address is too long');
  }
  // Standard RFC-compatible email format check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(email)) {
    throw AppError.validation('Invalid email address format');
  }
  return email.toLowerCase();
}

// Mirrors src/crypto/kdf-policy.ts. Missing fields fall back to the client defaults.
const KDF_LIMITS: Record<string, { min: number; max: number; fallback: number }> = {
  memoryKiB: { min: 65536, max: 1048576, fallback: 65536 },
  iterations: { min: 3, max: 20, fallback: 3 },
  parallelism: { min: 1, max: 16, fallback: 4 },
  keyLengthBytes: { min: 32, max: 32, fallback: 32 },
};

export function validateKdfParams(params: Record<string, unknown>): void {
  for (const [name, { min, max, fallback }] of Object.entries(KDF_LIMITS)) {
    const value = params[name] ?? fallback;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw AppError.validation(`kdfParams.${name} must be an integer between ${min} and ${max}`);
    }
  }
}

export function validatePrelogin(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw AppError.validation('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;
  const lookupHash = b.identifierLookupHash || b.emailLookupHash;

  if (typeof lookupHash !== 'string' || lookupHash.trim().length === 0) {
    throw AppError.validation('Lookup identifier hash is required');
  }

  return lookupHash.trim().toLowerCase();
}

export function validateRegistration(body: unknown): RegisterDto {
  if (!body || typeof body !== 'object') {
    throw AppError.validation('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;

  const username = validateUsername(b.username);
  const email = validateEmail(b.email);

  if (typeof b.kdfSalt !== 'string' || !b.kdfSalt) {
    throw AppError.validation('kdfSalt is required and must be a non-empty string');
  }
  if (!b.kdfParams || typeof b.kdfParams !== 'object') {
    throw AppError.validation('kdfParams is required and must be an object');
  }
  validateKdfParams(b.kdfParams as Record<string, unknown>);
  if (typeof b.authVerifier !== 'string' || !b.authVerifier) {
    throw AppError.validation('authVerifier is required and must be a non-empty string');
  }
  if (typeof b.encryptedVaultKey !== 'string' || !b.encryptedVaultKey) {
    throw AppError.validation('encryptedVaultKey is required and must be a non-empty string');
  }
  if (typeof b.initialEncryptedVault !== 'string' || !b.initialEncryptedVault) {
    throw AppError.validation('initialEncryptedVault is required and must be a non-empty string');
  }
  if (typeof b.initialIv !== 'string' || !b.initialIv) {
    throw AppError.validation('initialIv is required and must be a non-empty string');
  }

  return {
    username,
    email: email || undefined,
    usernameLookupHash: typeof b.usernameLookupHash === 'string' ? b.usernameLookupHash.trim().toLowerCase() : undefined,
    emailLookupHash: typeof b.emailLookupHash === 'string' ? b.emailLookupHash.trim().toLowerCase() : undefined,
    kdfSalt: b.kdfSalt,
    kdfParams: b.kdfParams as Record<string, unknown>,
    authVerifier: b.authVerifier,
    encryptedVaultKey: b.encryptedVaultKey,
    encryptedRecoveryKey: typeof b.encryptedRecoveryKey === 'string' ? b.encryptedRecoveryKey : undefined,
    recoverySalt: typeof b.recoverySalt === 'string' ? b.recoverySalt : undefined,
    initialEncryptedVault: b.initialEncryptedVault,
    initialIv: b.initialIv,
  };
}

export function validateLogin(body: unknown): LoginDto {
  if (!body || typeof body !== 'object') {
    throw AppError.validation('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;
  const lookupHash = b.identifierLookupHash || b.emailLookupHash;

  if (typeof lookupHash !== 'string' || lookupHash.trim().length === 0) {
    throw AppError.validation('Identifier lookup hash is required');
  }
  if (typeof b.authProof !== 'string' || b.authProof.trim().length === 0) {
    throw AppError.validation('authProof is required and must be a non-empty string');
  }

  return {
    identifierLookupHash: lookupHash.trim().toLowerCase(),
    authProof: b.authProof,
  };
}

export function validateUpdateEmail(body: unknown): UpdateEmailDto {
  if (!body || typeof body !== 'object') {
    throw AppError.validation('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;
  const email = validateEmail(b.email);

  if (!email) {
    throw AppError.validation('A valid non-empty email address is required');
  }

  return {
    email,
    emailLookupHash: typeof b.emailLookupHash === 'string' ? b.emailLookupHash.trim().toLowerCase() : undefined,
  };
}
