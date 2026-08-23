import { describe, it, expect } from 'vitest';
import { deriveKeyWithHkdf, HKDF_INFO_AUTH_KEY, HKDF_INFO_KEK, HKDF_INFO_RECOVERY_KEK } from '../../src/crypto/hkdf';
import { getRandomBytes } from '../../src/crypto/random';
import { timingSafeEqual } from '../../src/crypto/encoding';

describe('HKDF-SHA256 Domain Separation', () => {
  it('derives mutually distinct keys from the same input keying material', () => {
    const masterKey = getRandomBytes(32);

    const authKey = deriveKeyWithHkdf(masterKey, HKDF_INFO_AUTH_KEY, 32);
    const kek = deriveKeyWithHkdf(masterKey, HKDF_INFO_KEK, 32);
    const recoveryKek = deriveKeyWithHkdf(masterKey, HKDF_INFO_RECOVERY_KEK, 32);

    expect(authKey.length).toBe(32);
    expect(kek.length).toBe(32);
    expect(recoveryKek.length).toBe(32);

    expect(timingSafeEqual(authKey, kek)).toBe(false);
    expect(timingSafeEqual(authKey, recoveryKek)).toBe(false);
    expect(timingSafeEqual(kek, recoveryKek)).toBe(false);
  });

  it('is deterministic for identical inputs', () => {
    const masterKey = getRandomBytes(32);

    const k1 = deriveKeyWithHkdf(masterKey, HKDF_INFO_KEK, 32);
    const k2 = deriveKeyWithHkdf(masterKey, HKDF_INFO_KEK, 32);

    expect(timingSafeEqual(k1, k2)).toBe(true);
  });
});
