/**
 * AegisVault Argon2id Key Derivation Function
 * Uses WebAssembly-accelerated Argon2id via hash-wasm.
 * Defaults: 64 MiB memory, 3 iterations, 4 parallelism lanes, 256-bit output.
 */

import { argon2id } from 'hash-wasm';
import { bytesToBase64, base64ToBytes } from './encoding';
import { KdfError } from './errors';
import type { Argon2Params } from './types';

export const DEFAULT_ARGON2_PARAMS: Omit<Argon2Params, 'salt'> = {
  memoryKiB: 65536, // 64 MiB
  iterations: 3,
  parallelism: 4,
  keyLengthBytes: 32, // 256 bits
};

/**
 * Derives a 256-bit Master Derivation Key using Argon2id.
 */
export async function deriveMasterKeyArgon2id(
  password: string,
  salt: Uint8Array | string,
  customParams?: Partial<Omit<Argon2Params, 'salt'>>
): Promise<{ key: Uint8Array; params: Argon2Params }> {
  try {
    const saltBytes = typeof salt === 'string' ? base64ToBytes(salt) : salt;
    if (saltBytes.byteLength < 16) {
      throw new KdfError('Salt must be at least 16 bytes');
    }

    const params: Argon2Params = {
      memoryKiB: customParams?.memoryKiB ?? DEFAULT_ARGON2_PARAMS.memoryKiB,
      iterations: customParams?.iterations ?? DEFAULT_ARGON2_PARAMS.iterations,
      parallelism: customParams?.parallelism ?? DEFAULT_ARGON2_PARAMS.parallelism,
      keyLengthBytes: customParams?.keyLengthBytes ?? DEFAULT_ARGON2_PARAMS.keyLengthBytes,
      salt: typeof salt === 'string' ? salt : bytesToBase64(saltBytes),
    };

    const derivedKey = await argon2id({
      password,
      salt: saltBytes,
      iterations: params.iterations,
      memorySize: params.memoryKiB,
      parallelism: params.parallelism,
      hashLength: params.keyLengthBytes,
      outputType: 'binary',
    });

    return {
      key: derivedKey,
      params,
    };
  } catch (err: unknown) {
    if (err instanceof KdfError) throw err;
    const msg = err instanceof Error ? err.message : 'Unknown Argon2id failure';
    throw new KdfError(`Argon2id derivation failed: ${msg}`);
  }
}
