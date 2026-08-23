/**
 * AegisVault Cryptographic Type Definitions
 * Version: 1.0.0
 */

export type CryptoAlgorithm = 'AES-256-GCM';
export type KdfAlgorithm = 'Argon2id';

export interface Argon2Params {
  memoryKiB: number;     // e.g. 65536 = 64 MiB
  iterations: number;    // e.g. 3
  parallelism: number;   // e.g. 4
  salt: string;          // Base64 encoded 32 bytes
  keyLengthBytes: number;// e.g. 32 (256 bits)
}

export interface CryptoMetadataV1 {
  version: 1;
  algorithm: CryptoAlgorithm;
  keyDerivation: {
    kdf: KdfAlgorithm;
    params: Argon2Params;
  };
  iv: string;            // Base64 encoded 12 bytes (96-bit nonce)
  tagLengthBits: 128;    // 128-bit authentication tag
  createdAt: number;     // Unix timestamp ms
}

export interface EncryptedBlobV1 {
  metadata: CryptoMetadataV1;
  ciphertext: string;    // Base64 encoded ciphertext including auth tag
}

export interface DerivedKeys {
  masterKey: Uint8Array; // Derived from Argon2id
  authKey: Uint8Array;   // HKDF('aegis-auth-key-v1')
  kek: Uint8Array;       // HKDF('aegis-kek-v1')
}

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export interface PassphraseGeneratorOptions {
  wordCount: number;
  separator: string;
  capitalize: boolean;
  includeNumber: boolean;
}

export interface TotpOptions {
  secret: string;        // Base32 encoded secret
  digits?: 6 | 8;
  periodSeconds?: number;// Default 30s
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512';
  timestamp?: number;    // ms timestamp
}

export interface TotpResult {
  code: string;
  secondsRemaining: number;
  periodSeconds: number;
  progressPercent: number;
}

export interface BackupPayloadV1 {
  magic: 'AEGISVAULT_BACKUP_V1';
  exportedAt: number;
  appVersion: string;
  encryptedBlob: EncryptedBlobV1;
  checksum: string; // SHA-256 hex checksum of ciphertext
}
