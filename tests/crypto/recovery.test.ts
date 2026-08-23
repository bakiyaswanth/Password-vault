import { describe, it, expect } from 'vitest';
import {
  generateRecoveryPhrase,
  deriveRecoveryKek,
  wrapRecoveryVaultKey,
  unwrapRecoveryVaultKey,
} from '../../src/crypto/recovery';
import { generateVaultKey } from '../../src/crypto/keys';
import { getRandomBytes } from '../../src/crypto/random';
import { bytesToBase64, timingSafeEqual } from '../../src/crypto/encoding';
import { DecryptionError } from '../../src/crypto/errors';

describe('Emergency Recovery System', () => {
  it('generates a 24-word recovery phrase', () => {
    const phrase = generateRecoveryPhrase();
    const words = phrase.split(' ');
    expect(words.length).toBe(24);
  });

  it('wraps and recovers the VEK using the recovery phrase', async () => {
    const vek = generateVaultKey();
    const phrase = generateRecoveryPhrase();
    const salt = getRandomBytes(32);
    const saltBase64 = bytesToBase64(salt);

    const { recoveryKek, params } = await deriveRecoveryKek(phrase, salt);
    const wrappedBlob = await wrapRecoveryVaultKey(vek, recoveryKek, params);

    const recoveredVek = await unwrapRecoveryVaultKey(phrase, wrappedBlob, saltBase64);
    expect(timingSafeEqual(vek, recoveredVek)).toBe(true);
  });

  it('fails recovery when given an incorrect phrase', async () => {
    const vek = generateVaultKey();
    const phrase1 = generateRecoveryPhrase();
    const phrase2 = generateRecoveryPhrase();
    const salt = getRandomBytes(32);
    const saltBase64 = bytesToBase64(salt);

    const { recoveryKek, params } = await deriveRecoveryKek(phrase1, salt);
    const wrappedBlob = await wrapRecoveryVaultKey(vek, recoveryKek, params);

    await expect(unwrapRecoveryVaultKey(phrase2, wrappedBlob, saltBase64)).rejects.toThrow(
      DecryptionError
    );
  });
});
