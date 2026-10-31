/**
 * Argon2id parameter policy for parameters that come from outside the client
 * (server prelogin / me responses, backup files).
 *
 * Floors equal the defaults every account was created with, so they never lock out a
 * legitimate user, while a malicious server can no longer downgrade the KDF to make the
 * master password cheap to brute-force. Caps stop a crafted value from freezing the tab.
 */

import { DEFAULT_ARGON2_PARAMS } from './argon2';
import { KdfError } from './errors';
import type { Argon2Params } from './types';

export const ARGON2_LIMITS = {
  memoryKiB: { min: 65536, max: 1048576 }, // 64 MiB .. 1 GiB
  iterations: { min: 3, max: 20 },
  parallelism: { min: 1, max: 16 },
  keyLengthBytes: { min: 32, max: 32 },
} as const;

type Untrusted = Partial<Record<keyof typeof ARGON2_LIMITS, unknown>> | null | undefined;

export function assertSafeArgon2Params(input: Untrusted): Omit<Argon2Params, 'salt'> {
  const resolved = {
    memoryKiB: input?.memoryKiB ?? DEFAULT_ARGON2_PARAMS.memoryKiB,
    iterations: input?.iterations ?? DEFAULT_ARGON2_PARAMS.iterations,
    parallelism: input?.parallelism ?? DEFAULT_ARGON2_PARAMS.parallelism,
    keyLengthBytes: input?.keyLengthBytes ?? DEFAULT_ARGON2_PARAMS.keyLengthBytes,
  };
  for (const [name, { min, max }] of Object.entries(ARGON2_LIMITS)) {
    const value = resolved[name as keyof typeof resolved];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new KdfError(
        `Refusing unsafe key-derivation settings from server or file (${name}=${String(value)}). ` +
          'This may indicate a compromised server.'
      );
    }
  }
  return resolved as Omit<Argon2Params, 'salt'>;
}
