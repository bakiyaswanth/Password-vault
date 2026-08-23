/**
 * AegisVault AES-256-GCM Encryption and Decryption
 * Implements authenticated encryption with associated data (AEAD) using Web Crypto API.
 */

import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from './encoding';
import { DecryptionError, InvalidKeyError } from './errors';
import { generateIv } from './random';
import type { EncryptedBlobV1 } from './types';

/**
 * Encrypts raw bytes using AES-256-GCM.
 *
 * @param plaintext Data to encrypt
 * @param key 256-bit (32-byte) key
 * @param iv Optional 96-bit (12-byte) IV (generated automatically if not provided)
 * @returns Ciphertext with appended 128-bit authentication tag, and the IV used
 */
export async function encryptAesGcm(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv?: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  if (key.byteLength !== 32) {
    throw new InvalidKeyError('AES-256-GCM requires a 32-byte (256-bit) key');
  }

  const nonce = iv ?? generateIv(12);
  if (nonce.byteLength !== 12) {
    throw new InvalidKeyError('AES-GCM requires a 12-byte (96-bit) IV');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as unknown as BufferSource,
      tagLength: 128,
    },
    cryptoKey,
    plaintext as unknown as BufferSource
  );

  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    iv: nonce,
  };
}

/**
 * Decrypts raw bytes using AES-256-GCM.
 *
 * @param ciphertextWithTag Ciphertext including 128-bit authentication tag
 * @param key 256-bit (32-byte) key
 * @param iv 96-bit (12-byte) IV
 * @returns Decrypted plaintext bytes
 */
export async function decryptAesGcm(
  ciphertextWithTag: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  if (key.byteLength !== 32) {
    throw new InvalidKeyError('AES-256-GCM requires a 32-byte (256-bit) key');
  }
  if (iv.byteLength !== 12) {
    throw new InvalidKeyError('AES-GCM requires a 12-byte (96-bit) IV');
  }

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key as unknown as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        tagLength: 128,
      },
      cryptoKey,
      ciphertextWithTag as unknown as BufferSource
    );

    return new Uint8Array(decryptedBuffer);
  } catch (err: unknown) {
    throw new DecryptionError(
      'AES-GCM Decryption failed: invalid key, corrupted ciphertext, or altered authentication tag'
    );
  }
}

/**
 * Encrypts an arbitrary JSON-serializable object into an EncryptedBlobV1 structure.
 */
export async function encryptJson(data: unknown, key: Uint8Array): Promise<EncryptedBlobV1> {
  const jsonString = JSON.stringify(data);
  const plaintextBytes = utf8ToBytes(jsonString);
  const { ciphertext, iv } = await encryptAesGcm(plaintextBytes, key);

  return {
    metadata: {
      version: 1,
      algorithm: 'AES-256-GCM',
      keyDerivation: {
        kdf: 'Argon2id',
        params: {
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
 * Decrypts an EncryptedBlobV1 structure back into a typed JavaScript object.
 */
export async function decryptJson<T>(blob: EncryptedBlobV1, key: Uint8Array): Promise<T> {
  if (blob.metadata.version !== 1) {
    throw new DecryptionError(`Unsupported crypto version: ${blob.metadata.version}`);
  }
  if (blob.metadata.algorithm !== 'AES-256-GCM') {
    throw new DecryptionError(`Unsupported algorithm: ${blob.metadata.algorithm}`);
  }

  const iv = base64ToBytes(blob.metadata.iv);
  const ciphertextBytes = base64ToBytes(blob.ciphertext);
  const decryptedBytes = await decryptAesGcm(ciphertextBytes, key, iv);
  const jsonString = bytesToUtf8(decryptedBytes);

  return JSON.parse(jsonString) as T;
}
