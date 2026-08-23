/**
 * AegisVault HKDF-SHA256 Key Derivation & Domain Separation
 * Utilizes standard HKDF (RFC 5869) to derive separate cryptographically independent keys.
 */

import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes } from './encoding';
import { CryptoError } from './errors';

// Standard Domain Separation Contexts
export const HKDF_INFO_AUTH_KEY = 'aegis-auth-key-v1';
export const HKDF_INFO_KEK = 'aegis-kek-v1';
export const HKDF_INFO_RECOVERY_KEK = 'aegis-recovery-kek-v1';

/**
 * Derives a domain-separated subkey using HKDF-SHA256.
 *
 * @param ikm Input Keying Material (e.g. Master Derivation Key)
 * @param info Domain separation string
 * @param length Length of output key in bytes (default 32 bytes = 256 bits)
 * @param salt Optional salt (if omitted, zero-filled hash-length salt is used per RFC 5869)
 */
export function deriveKeyWithHkdf(
  ikm: Uint8Array,
  info: string,
  length: number = 32,
  salt?: Uint8Array
): Uint8Array {
  if (ikm.byteLength < 16) {
    throw new CryptoError('Input keying material must be at least 16 bytes', 'INVALID_IKM');
  }
  const infoBytes = utf8ToBytes(info);
  return hkdf(sha256, ikm, salt, infoBytes, length);
}
