/**
 * Vault Input Validation Helpers
 */

import { AppError } from '../errors/AppError';
import type { SyncVaultDto } from '../types';

/** Max base64 length of one encrypted vault (~1.1 MB of ciphertext). */
export const MAX_VAULT_PAYLOAD_CHARS = 1_500_000;
/** A base64 12-byte AES-GCM IV is 16 chars; leave headroom but bound it. */
export const MAX_IV_CHARS = 64;

export function assertVaultBlobSize(payload: string, iv: string): void {
  if (payload.length > MAX_VAULT_PAYLOAD_CHARS) {
    throw AppError.payloadTooLarge(`Encrypted vault exceeds the ${MAX_VAULT_PAYLOAD_CHARS}-character limit`);
  }
  if (iv.length > MAX_IV_CHARS) {
    throw AppError.validation(`iv must be at most ${MAX_IV_CHARS} characters`);
  }
}

export function validateSyncVault(body: unknown): SyncVaultDto {
  if (!body || typeof body !== 'object') {
    throw AppError.validation('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;

  if (typeof b.expectedRevision !== 'number' || !Number.isInteger(b.expectedRevision) || b.expectedRevision < 0) {
    throw AppError.validation('expectedRevision is required and must be a non-negative integer');
  }
  if (typeof b.encryptedPayload !== 'string' || b.encryptedPayload.trim().length === 0) {
    throw AppError.validation('encryptedPayload is required and must be a non-empty base64 string');
  }
  if (typeof b.iv !== 'string' || b.iv.trim().length === 0) {
    throw AppError.validation('iv is required and must be a non-empty base64 string');
  }
  assertVaultBlobSize(b.encryptedPayload, b.iv);

  return {
    expectedRevision: b.expectedRevision,
    encryptedPayload: b.encryptedPayload,
    iv: b.iv,
  };
}

export function validateRevisionNumber(param: unknown): number {
  if (typeof param !== 'string' && typeof param !== 'number') {
    throw AppError.validation('Invalid revision parameter');
  }
  const rev = typeof param === 'number' ? param : parseInt(param, 10);
  if (isNaN(rev) || rev < 1) {
    throw AppError.validation('Revision must be a positive integer');
  }
  return rev;
}
