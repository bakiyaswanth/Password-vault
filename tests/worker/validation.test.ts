import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validateEmail,
  validatePrelogin,
  validateRegistration,
  validateLogin,
  validateUpdateEmail,
} from '../../worker/validation/auth';
import { validateSyncVault, validateRevisionNumber } from '../../worker/validation/vault';
import { AppError } from '../../worker/errors/AppError';

describe('Server-side Input Validation & Error Handling', () => {
  describe('Username Validation', () => {
    it('accepts valid usernames', () => {
      expect(validateUsername('dev-user')).toBe('dev-user');
      expect(validateUsername('Alice_123.')).toBe('Alice_123.');
      expect(validateUsername('  bob-99  ')).toBe('bob-99');
    });

    it('rejects usernames with @ symbols', () => {
      expect(() => validateUsername('dev@user')).toThrow(AppError);
    });

    it('rejects too short or too long usernames', () => {
      expect(() => validateUsername('ab')).toThrow(AppError);
      expect(() => validateUsername('a'.repeat(31))).toThrow(AppError);
    });

    it('rejects invalid characters in username', () => {
      expect(() => validateUsername('dev user with spaces')).toThrow(AppError);
      expect(() => validateUsername('dev$user')).toThrow(AppError);
    });
  });

  describe('Email Validation', () => {
    it('returns null for omitted or empty email', () => {
      expect(validateEmail(undefined)).toBeNull();
      expect(validateEmail(null)).toBeNull();
      expect(validateEmail('')).toBeNull();
      expect(validateEmail('   ')).toBeNull();
    });

    it('normalizes valid emails to lowercase', () => {
      expect(validateEmail('User@Example.COM')).toBe('user@example.com');
      expect(validateEmail('  alice.bob+tag@domain.org  ')).toBe('alice.bob+tag@domain.org');
    });

    it('rejects malformed email formats', () => {
      expect(() => validateEmail('not-an-email')).toThrow(AppError);
      expect(() => validateEmail('user@')).toThrow(AppError);
      expect(() => validateEmail('@domain.com')).toThrow(AppError);
    });
  });

  describe('Prelogin Validation', () => {
    it('extracts and validates identifier lookup hash', () => {
      expect(validatePrelogin({ identifierLookupHash: 'hash123' })).toBe('hash123');
      expect(validatePrelogin({ emailLookupHash: 'hash456' })).toBe('hash456');
    });

    it('throws error when identifier lookup hash is missing', () => {
      expect(() => validatePrelogin({})).toThrow(AppError);
      expect(() => validatePrelogin({ identifierLookupHash: '' })).toThrow(AppError);
    });
  });

  describe('Registration Payload Validation', () => {
    it('validates full registration object', () => {
      const validPayload = {
        username: 'dev-user',
        email: 'user@example.com',
        kdfSalt: 'salt',
        kdfParams: { memoryKiB: 65536 },
        authVerifier: 'verifier',
        encryptedVaultKey: 'key',
        initialEncryptedVault: 'payload',
        initialIv: 'iv',
      };

      const dto = validateRegistration(validPayload);
      expect(dto.username).toBe('dev-user');
      expect(dto.email).toBe('user@example.com');
      expect(dto.kdfSalt).toBe('salt');
    });

    it('throws validation error when required params are missing', () => {
      expect(() => validateRegistration({})).toThrow(AppError);
      expect(() => validateRegistration({ username: 'dev-user' })).toThrow(AppError);
    });
  });

  describe('Login Payload Validation', () => {
    it('validates correct login DTO', () => {
      const dto = validateLogin({ identifierLookupHash: 'id-hash', authProof: 'proof123' });
      expect(dto.identifierLookupHash).toBe('id-hash');
      expect(dto.authProof).toBe('proof123');
    });

    it('rejects missing proof or lookup hash', () => {
      expect(() => validateLogin({ identifierLookupHash: 'id-hash' })).toThrow(AppError);
      expect(() => validateLogin({ authProof: 'proof123' })).toThrow(AppError);
    });
  });

  describe('Update Email Validation', () => {
    it('validates valid update email request', () => {
      const dto = validateUpdateEmail({ email: 'new@example.com', emailLookupHash: 'emailhash' });
      expect(dto.email).toBe('new@example.com');
      expect(dto.emailLookupHash).toBe('emailhash');
    });

    it('rejects empty or invalid email for update', () => {
      expect(() => validateUpdateEmail({ email: '' })).toThrow(AppError);
      expect(() => validateUpdateEmail({ email: 'not-valid' })).toThrow(AppError);
    });
  });

  describe('Vault Sync & Revision Validation', () => {
    it('validates sync payload and revision integer', () => {
      const validSync = {
        expectedRevision: 2,
        encryptedPayload: 'blob',
        iv: 'ivblob',
      };

      const dto = validateSyncVault(validSync);
      expect(dto.expectedRevision).toBe(2);
      expect(dto.encryptedPayload).toBe('blob');

      expect(validateRevisionNumber('5')).toBe(5);
      expect(validateRevisionNumber(10)).toBe(10);
    });

    it('rejects negative or malformed revisions', () => {
      expect(() => validateRevisionNumber('-1')).toThrow(AppError);
      expect(() => validateRevisionNumber('invalid')).toThrow(AppError);
    });
  });
});
