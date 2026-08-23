/**
 * AegisVault Key Management & Wrapping
 * Manages Vault Encryption Keys (VEK), Key Encryption Keys (KEK), and Authentication Keys.
 */

import { sha256 } from '@noble/hashes/sha256';
import { deriveMasterKeyArgon2id } from './argon2';
import { encryptAesGcm, decryptAesGcm } from './aes';
import { bytesToBase64, base64ToBytes, bytesToHex } from './encoding';
import { deriveKeyWithHkdf, HKDF_INFO_AUTH_KEY, HKDF_INFO_KEK } from './hkdf';
import { getRandomBytes, generateIv } from './random';
import { DecryptionError, InvalidKeyError } from './errors';
import type { Argon2Params, DerivedKeys, EncryptedBlobV1 } from './types';

/**
 * Generates a fresh, cryptographically secure 256-bit Vault Encryption Key (VEK).
 */
export function generateVaultKey(): Uint8Array {
  return getRandomBytes(32);
}

/**
 * Derives Master Derivation Key, AuthKey, and KEK from a Master Password and Salt.
 */
export async function deriveKeysFromMasterPassword(
  password: string,
  salt: Uint8Array | string,
  customParams?: Partial<Omit<Argon2Params, 'salt'>>
): Promise<DerivedKeys & { kdfParams: Argon2Params }> {
  const { key: masterKey, params } = await deriveMasterKeyArgon2id(password, salt, customParams);

  const authKey = deriveKeyWithHkdf(masterKey, HKDF_INFO_AUTH_KEY, 32);
  const kek = deriveKeyWithHkdf(masterKey, HKDF_INFO_KEK, 32);

  return {
    masterKey,
    authKey,
    kek,
    kdfParams: params,
  };
}

/**
 * Wraps (encrypts) the Vault Encryption Key (VEK) using the Key Encryption Key (KEK).
 */
export async function wrapVaultKey(
  vaultKey: Uint8Array,
  kek: Uint8Array,
  kdfParams?: Argon2Params
): Promise<EncryptedBlobV1> {
  if (vaultKey.byteLength !== 32) {
    throw new InvalidKeyError('Vault key must be exactly 32 bytes (256 bits)');
  }
  if (kek.byteLength !== 32) {
    throw new InvalidKeyError('Key encryption key (KEK) must be exactly 32 bytes (256 bits)');
  }

  const iv = generateIv(12);
  const { ciphertext } = await encryptAesGcm(vaultKey, kek, iv);

  return {
    metadata: {
      version: 1,
      algorithm: 'AES-256-GCM',
      keyDerivation: {
        kdf: 'Argon2id',
        params: kdfParams ?? {
          memoryKiB: 65536,
          iterations: 3,
          parallelism: 4,
          salt: '',
          keyLengthBytes: 32,
        },
      },
      iv: bytesToBase64(iv),
      tagLengthBits: 128,
      createdAt: Date.now(),
    },
    ciphertext: bytesToBase64(ciphertext),
  };
}

/**
 * Unwraps (decrypts) the Vault Encryption Key (VEK) using the Key Encryption Key (KEK).
 */
export async function unwrapVaultKey(
  wrappedBlob: EncryptedBlobV1,
  kek: Uint8Array
): Promise<Uint8Array> {
  if (wrappedBlob.metadata.version !== 1) {
    throw new DecryptionError(`Unsupported crypto version: ${wrappedBlob.metadata.version}`);
  }

  const iv = base64ToBytes(wrappedBlob.metadata.iv);
  const ciphertextBytes = base64ToBytes(wrappedBlob.ciphertext);

  const unwrappedKey = await decryptAesGcm(ciphertextBytes, kek, iv);
  if (unwrappedKey.byteLength !== 32) {
    throw new InvalidKeyError('Unwrapped key has invalid length');
  }

  return unwrappedKey;
}

/**
 * Computes an authentication proof/verifier from AuthKey to send to the server.
 * The raw AuthKey never leaves the client; only a SHA-256 digest is transmitted.
 */
export function computeAuthVerifier(authKey: Uint8Array): string {
  const hash = sha256(authKey);
  return bytesToHex(hash);
}
