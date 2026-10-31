/**
 * Server-side protection of the client auth verifier.
 *
 * The client sends sha256(authKey) as its login proof. Storing that value raw would let
 * anyone who reads the users table log in as any user, so it is stored as
 * `h1:` + HMAC-SHA256(VERIFIER_KEY, proof). Rows written before this change hold the raw
 * proof (no prefix); they are accepted once and upgraded on the next successful login.
 */

import { AppError } from '../errors/AppError';
import type { Env } from '../types';

const PREFIX = 'h1:';

export function requireSecret(env: Env, name: 'VERIFIER_KEY' | 'SERVER_PEPPER'): string {
  const value = env[name];
  if (!value || value.length < 16) {
    // Fail closed: never fall back to a guessable default.
    console.error(`[Config] Missing or too-short secret ${name}`);
    throw AppError.internal('Server is not configured correctly. Please contact the administrator.');
  }
  return value;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  // Compare over the longer length so the loop count does not depend on which input is shorter.
  const len = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

export async function protectVerifier(proof: string, key: string): Promise<string> {
  return PREFIX + (await hmacHex(key, proof));
}

export async function checkVerifier(
  stored: string,
  proof: string,
  key: string
): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (stored.startsWith(PREFIX)) {
    return { ok: timingSafeEqualStr(stored, await protectVerifier(proof, key)), needsUpgrade: false };
  }
  // Legacy raw verifier: accept, then caller rewrites it in protected form.
  const ok = timingSafeEqualStr(stored, proof);
  return { ok, needsUpgrade: ok };
}
