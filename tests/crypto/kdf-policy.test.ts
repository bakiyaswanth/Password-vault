import { describe, it, expect } from 'vitest';
import { assertSafeArgon2Params } from '../../src/crypto/kdf-policy';
import { DEFAULT_ARGON2_PARAMS } from '../../src/crypto/argon2';
import { KdfError } from '../../src/crypto/errors';

describe('Fix 2: Argon2id parameter policy for untrusted params', () => {
  it('accepts the defaults every account was registered with', () => {
    expect(assertSafeArgon2Params(DEFAULT_ARGON2_PARAMS)).toEqual(DEFAULT_ARGON2_PARAMS);
    expect(assertSafeArgon2Params(undefined)).toEqual(DEFAULT_ARGON2_PARAMS);
  });

  it.each([
    [{ memoryKiB: 8, iterations: 1, parallelism: 1 }],
    [{ ...DEFAULT_ARGON2_PARAMS, memoryKiB: 65535 }],
    [{ ...DEFAULT_ARGON2_PARAMS, iterations: 2 }],
    [{ ...DEFAULT_ARGON2_PARAMS, parallelism: 0 }],
    [{ ...DEFAULT_ARGON2_PARAMS, keyLengthBytes: 16 }],
  ])('rejects downgraded params %j', (params) => {
    expect(() => assertSafeArgon2Params(params)).toThrow(KdfError);
  });

  it.each([
    [{ ...DEFAULT_ARGON2_PARAMS, memoryKiB: 4 * 1024 * 1024 }],
    [{ ...DEFAULT_ARGON2_PARAMS, iterations: 1000 }],
    [{ ...DEFAULT_ARGON2_PARAMS, iterations: '3' }],
    [{ ...DEFAULT_ARGON2_PARAMS, memoryKiB: 65536.5 }],
  ])('rejects oversized or malformed params %j', (params) => {
    expect(() => assertSafeArgon2Params(params as any)).toThrow(KdfError);
  });
});
