/**
 * AegisVault Cryptographic Errors
 * Safe error types that never leak passwords, keys, or plaintext data.
 */

export class CryptoError extends Error {
  constructor(message: string, public readonly code: string = 'CRYPTO_ERROR') {
    super(message);
    this.name = 'CryptoError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DecryptionError extends CryptoError {
  constructor(message: string = 'Decryption failed: invalid key, tampered ciphertext, or corrupted data.') {
    super(message, 'DECRYPTION_FAILED');
    this.name = 'DecryptionError';
  }
}

export class AuthenticationError extends CryptoError {
  constructor(message: string = 'Authentication failed: invalid credentials or proof.') {
    super(message, 'AUTHENTICATION_FAILED');
    this.name = 'AuthenticationError';
  }
}

export class TamperError extends CryptoError {
  constructor(message: string = 'Integrity verification failed: cryptographic payload was altered or corrupted.') {
    super(message, 'INTEGRITY_CHECK_FAILED');
    this.name = 'TamperError';
  }
}

export class InvalidKeyError extends CryptoError {
  constructor(message: string = 'Cryptographic key length or format is invalid.') {
    super(message, 'INVALID_KEY');
    this.name = 'InvalidKeyError';
  }
}

export class KdfError extends CryptoError {
  constructor(message: string = 'Key derivation function failed.') {
    super(message, 'KDF_FAILED');
    this.name = 'KdfError';
  }
}

export class BackupIntegrityError extends CryptoError {
  constructor(message: string = 'Backup file is corrupted, invalid, or has an incorrect checksum.') {
    super(message, 'BACKUP_CORRUPTED');
    this.name = 'BackupIntegrityError';
  }
}
