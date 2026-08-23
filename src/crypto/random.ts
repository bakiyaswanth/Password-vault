/**
 * AegisVault Cryptographically Secure Pseudo-Random Number Generator (CSPRNG)
 * Strictly utilizes crypto.getRandomValues(). NEVER uses Math.random().
 */

import { CryptoError } from './errors';

/**
 * Returns a cryptographically secure Uint8Array of the requested length.
 */
export function getRandomBytes(length: number): Uint8Array {
  if (length <= 0 || !Number.isInteger(length)) {
    throw new CryptoError('Length must be a positive integer', 'INVALID_LENGTH');
  }
  const bytes = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    throw new CryptoError('Web Crypto API getRandomValues is not available in this environment', 'NO_CSPRNG');
  }
  return bytes;
}

/**
 * Generates an unbiased random integer in the range [min, max] inclusive.
 * Uses rejection sampling to eliminate modulo bias.
 */
export function getRandomInt(min: number, max: number): number {
  if (min > max) {
    throw new CryptoError('min cannot be greater than max', 'INVALID_RANGE');
  }
  if (min === max) {
    return min;
  }
  const range = max - min + 1;
  const maxAllowed = Math.floor(0xffffffff / range) * range;
  const buffer = new Uint32Array(1);

  while (true) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < maxAllowed) {
      return min + (buffer[0] % range);
    }
  }
}

/**
 * Generates a random alphanumeric string with CSPRNG.
 */
export function getRandomAlphanumeric(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    const idx = getRandomInt(0, charset.length - 1);
    result += charset[idx];
  }
  return result;
}

/**
 * Generates a secure random 32-byte (256-bit) salt.
 */
export function generateSalt(lengthBytes: number = 32): Uint8Array {
  return getRandomBytes(lengthBytes);
}

/**
 * Generates a standard 12-byte (96-bit) initialization vector for AES-GCM.
 */
export function generateIv(lengthBytes: number = 12): Uint8Array {
  return getRandomBytes(lengthBytes);
}
