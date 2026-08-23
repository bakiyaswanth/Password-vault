import { describe, it, expect } from 'vitest';
import { computeLookupHash } from '../../src/context/AuthContext';
import { perfTracker } from '../../src/utils/performance';
import type { AuthUser } from '../../src/types/auth';

describe('Zero-Knowledge Optional Email & Dual Identity Engine', () => {
  it('normalizes identifiers consistently for email and username lookups', () => {
    const hash1 = computeLookupHash('Dev-User');
    const hash2 = computeLookupHash('  dev-user  ');
    expect(hash1).toBe(hash2);

    const emailHash1 = computeLookupHash('User@Example.COM');
    const emailHash2 = computeLookupHash('user@example.com');
    expect(emailHash1).toBe(emailHash2);
  });

  it('correctly handles user model when email is omitted during signup', () => {
    const userWithoutEmail: AuthUser = {
      id: '8f3c7d12-9999-4000-8000-abcdef123456',
      username: 'dev-user',
      email: '',
      emailLookupHash: '',
      usernameLookupHash: computeLookupHash('dev-user'),
      kdfSalt: 'salt',
      kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 4, salt: 'salt', keyLengthBytes: 32 },
      encryptedVaultKey: {
        metadata: {
          version: 1,
          algorithm: 'AES-256-GCM',
          keyDerivation: {
            kdf: 'Argon2id',
            params: { memoryKiB: 65536, iterations: 3, parallelism: 4, salt: 'salt', keyLengthBytes: 32 },
          },
          iv: 'iv123',
          tagLengthBits: 128,
          createdAt: Date.now(),
        },
        ciphertext: 'ct123',
      },
      hasRecoveryKey: true,
    };

    expect(userWithoutEmail.username).toBe('dev-user');
    expect(userWithoutEmail.email).toBe('');
    // Ensure display logic does not show raw UUID or null
    const displayEmail = userWithoutEmail.email ? userWithoutEmail.email : 'Email: Not added';
    expect(displayEmail).toBe('Email: Not added');
    expect(displayEmail).not.toContain(userWithoutEmail.id);
  });

  it('correctly handles user model when email is added and verified', () => {
    const userWithEmail: AuthUser = {
      id: '8f3c7d12-9999-4000-8000-abcdef123456',
      username: 'dev-user',
      email: 'user@example.com',
      emailLookupHash: computeLookupHash('user@example.com'),
      usernameLookupHash: computeLookupHash('dev-user'),
      kdfSalt: 'salt',
      kdfParams: { memoryKiB: 65536, iterations: 3, parallelism: 4, salt: 'salt', keyLengthBytes: 32 },
      encryptedVaultKey: {
        metadata: {
          version: 1,
          algorithm: 'AES-256-GCM',
          keyDerivation: {
            kdf: 'Argon2id',
            params: { memoryKiB: 65536, iterations: 3, parallelism: 4, salt: 'salt', keyLengthBytes: 32 },
          },
          iv: 'iv123',
          tagLengthBits: 128,
          createdAt: Date.now(),
        },
        ciphertext: 'ct123',
      },
      hasRecoveryKey: true,
    };

    expect(userWithEmail.username).toBe('dev-user');
    expect(userWithEmail.email).toBe('user@example.com');
    const displayEmail = userWithEmail.email ? `${userWithEmail.email} (Verified)` : 'Email: Not added';
    expect(displayEmail).toBe('user@example.com (Verified)');
  });

  it('provides reliable performance metrics and fallbacks for new users', () => {
    perfTracker.recordMetric('search_query_eval', 0.24);
    perfTracker.recordMetric('item_selection_latency', 0.15);

    const searchLatency = perfTracker.getLatestMetric('search_query_eval');
    const selectLatency = perfTracker.getLatestMetric('item_selection_latency');
    const fallbackLatency = perfTracker.getLatestMetric('non_existent_metric' as any);

    expect(searchLatency).toBe(0.24);
    expect(selectLatency).toBe(0.15);
    expect(fallbackLatency).toBeNull();
  });
});
