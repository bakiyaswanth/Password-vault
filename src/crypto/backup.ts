/**
 * AegisVault Encrypted Backup Export & Import Engine
 * Never exports plaintext. All backups are authenticated and encrypted with AES-256-GCM + Argon2id.
 */

import { sha256 } from '@noble/hashes/sha256';
import { deriveMasterKeyArgon2id } from './argon2';
import { encryptAesGcm, decryptAesGcm } from './aes';
import { bytesToBase64, base64ToBytes, bytesToHex, bytesToUtf8, utf8ToBytes } from './encoding';
import { getRandomBytes } from './random';
import { BackupIntegrityError, DecryptionError } from './errors';
import type { BackupPayloadV1, EncryptedBlobV1 } from './types';

const BACKUP_MAGIC = 'AEGISVAULT_BACKUP_V1';

/**
 * Creates an encrypted backup payload from plaintext vault items using a dedicated backup password.
 */
export async function createEncryptedBackup(
  vaultData: unknown,
  backupPassword: string
): Promise<string> {
  const salt = getRandomBytes(32);
  const { key: backupKey, params } = await deriveMasterKeyArgon2id(backupPassword, salt, {
    memoryKiB: 65536,
    iterations: 3,
    parallelism: 4,
    keyLengthBytes: 32,
  });

  const plaintextJson = JSON.stringify(vaultData);
  const plaintextBytes = utf8ToBytes(plaintextJson);
  const iv = getRandomBytes(12);
  const { ciphertext } = await encryptAesGcm(plaintextBytes, backupKey, iv);

  const ciphertextBase64 = bytesToBase64(ciphertext);
  const checksum = bytesToHex(sha256(utf8ToBytes(ciphertextBase64)));

  const encryptedBlob: EncryptedBlobV1 = {
    metadata: {
      version: 1,
      algorithm: 'AES-256-GCM',
      keyDerivation: {
        kdf: 'Argon2id',
        params,
      },
      iv: bytesToBase64(iv),
      tagLengthBits: 128,
      createdAt: Date.now(),
    },
    ciphertext: ciphertextBase64,
  };

  const payload: BackupPayloadV1 = {
    magic: BACKUP_MAGIC,
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    encryptedBlob,
    checksum,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Validates, decrypts, and restores vault data from an encrypted backup string.
 */
export async function restoreEncryptedBackup<T>(
  backupJson: string,
  backupPassword: string
): Promise<T> {
  let payload: BackupPayloadV1;
  try {
    payload = JSON.parse(backupJson);
  } catch {
    throw new BackupIntegrityError('Invalid JSON format in backup file');
  }

  if (payload.magic !== BACKUP_MAGIC) {
    throw new BackupIntegrityError('Unsupported or invalid backup file format');
  }

  // Integrity Check: Checksum verification
  const computedChecksum = bytesToHex(sha256(utf8ToBytes(payload.encryptedBlob.ciphertext)));
  if (computedChecksum !== payload.checksum) {
    throw new BackupIntegrityError('Backup checksum mismatch: File has been tampered with or corrupted');
  }

  const { metadata, ciphertext } = payload.encryptedBlob;
  const salt = base64ToBytes(metadata.keyDerivation.params.salt);

  const { key: backupKey } = await deriveMasterKeyArgon2id(
    backupPassword,
    salt,
    metadata.keyDerivation.params
  );

  const iv = base64ToBytes(metadata.iv);
  const ciphertextBytes = base64ToBytes(ciphertext);

  try {
    const decryptedBytes = await decryptAesGcm(ciphertextBytes, backupKey, iv);
    const jsonStr = bytesToUtf8(decryptedBytes);
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new DecryptionError('Failed to decrypt backup: Incorrect password or corrupted backup file');
  }
}
