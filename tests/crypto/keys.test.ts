import { describe, it, expect } from 'vitest';
import {
  generateVaultKey,
  deriveKeysFromMasterPassword,
  wrapVaultKey,
  unwrapVaultKey,
  computeAuthVerifier,
} from '../../src/crypto/keys';
import { getRandomBytes } from '../../src/crypto/random';
import { timingSafeEqual } from '../../src/crypto/encoding';
import { DecryptionError } from '../../src/crypto/errors';

describe('Key Hierarchy & Wrapping Engine', () => {
  it('generates a 256-bit random VEK', () => {
    const vek1 = generateVaultKey();
    const vek2 = generateVaultKey();

    expect(vek1.length).toBe(32);
    expect(vek2.length).toBe(32);
    expect(timingSafeEqual(vek1, vek2)).toBe(false);
  });

  it('derives masterKey, authKey, and KEK correctly from master password', async () => {
    const salt = getRandomBytes(32);
    const result = await deriveKeysFromMasterPassword('MySecretPassphrase123!', salt, {
      memoryKiB: 1024,
      iterations: 2,
      parallelism: 1,
    });

    expect(result.masterKey.length).toBe(32);
    expect(result.authKey.length).toBe(32);
    expect(result.kek.length).toBe(32);
    expect(result.kdfParams).toBeDefined();

    const verifier = computeAuthVerifier(result.authKey);
    expect(typeof verifier).toBe('string');
    expect(verifier.length).toBe(64); // 256-bit hex string
  });

  it('wraps and unwraps the VEK using KEK', async () => {
    const vek = generateVaultKey();
    const kek = getRandomBytes(32);

    const wrappedBlob = await wrapVaultKey(vek, kek);
    expect(wrappedBlob.metadata.version).toBe(1);
    expect(wrappedBlob.metadata.algorithm).toBe('AES-256-GCM');

    const unwrappedVek = await unwrapVaultKey(wrappedBlob, kek);
    expect(timingSafeEqual(vek, unwrappedVek)).toBe(true);
  });

  it('fails to unwrap VEK if wrong KEK is provided', async () => {
    const vek = generateVaultKey();
    const kek1 = getRandomBytes(32);
    const kek2 = getRandomBytes(32);

    const wrappedBlob = await wrapVaultKey(vek, kek1);

    await expect(unwrapVaultKey(wrappedBlob, kek2)).rejects.toThrow(DecryptionError);
  });
});
