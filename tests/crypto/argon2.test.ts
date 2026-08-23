import { describe, it, expect } from 'vitest';
import { deriveMasterKeyArgon2id } from '../../src/crypto/argon2';
import { getRandomBytes } from '../../src/crypto/random';
import { timingSafeEqual } from '../../src/crypto/encoding';

describe('Argon2id Key Derivation Engine', () => {
  it('derives a consistent 256-bit key from the same password and salt', async () => {
    const password = 'MasterPassword_2026!#$';
    const salt = getRandomBytes(32);

    // Fast parameters for test runner speed while maintaining Argon2id logic
    const params = { memoryKiB: 1024, iterations: 2, parallelism: 1, keyLengthBytes: 32 };

    const { key: key1 } = await deriveMasterKeyArgon2id(password, salt, params);
    const { key: key2 } = await deriveMasterKeyArgon2id(password, salt, params);

    expect(key1.length).toBe(32);
    expect(key2.length).toBe(32);
    expect(timingSafeEqual(key1, key2)).toBe(true);
  });

  it('produces different keys for different passwords with the same salt', async () => {
    const salt = getRandomBytes(32);
    const params = { memoryKiB: 1024, iterations: 2, parallelism: 1, keyLengthBytes: 32 };

    const { key: key1 } = await deriveMasterKeyArgon2id('PasswordOne', salt, params);
    const { key: key2 } = await deriveMasterKeyArgon2id('PasswordTwo', salt, params);

    expect(timingSafeEqual(key1, key2)).toBe(false);
  });

  it('produces different keys for the same password with different salts', async () => {
    const salt1 = getRandomBytes(32);
    const salt2 = getRandomBytes(32);
    const params = { memoryKiB: 1024, iterations: 2, parallelism: 1, keyLengthBytes: 32 };

    const { key: key1 } = await deriveMasterKeyArgon2id('SamePassword', salt1, params);
    const { key: key2 } = await deriveMasterKeyArgon2id('SamePassword', salt2, params);

    expect(timingSafeEqual(key1, key2)).toBe(false);
  });
});
