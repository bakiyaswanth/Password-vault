/**
 * AegisVault RFC 6238 TOTP (Time-Based One-Time Password) Engine
 * Implements client-side TOTP calculation with HMAC-SHA1, HMAC-SHA256, and HMAC-SHA512.
 */

import { hmac } from '@noble/hashes/hmac';
import { sha1 } from '@noble/hashes/sha1';
import { sha256 } from '@noble/hashes/sha256';
import { sha512 } from '@noble/hashes/sha512';
import { CryptoError } from './errors';
import type { TotpOptions, TotpResult } from './types';

// RFC 4648 Base32 alphabet
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes an RFC 4648 Base32 string into raw bytes.
 */
export function base32ToBytes(base32Str: string): Uint8Array {
  const clean = base32Str.toUpperCase().replace(/[\s=-]/g, '');
  if (!clean) {
    throw new CryptoError('Base32 secret cannot be empty', 'INVALID_BASE32');
  }

  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const val = BASE32_CHARS.indexOf(char);
    if (val === -1) {
      throw new CryptoError(`Invalid Base32 character: ${char}`, 'INVALID_BASE32');
    }

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Computes a TOTP code for a given secret and options per RFC 6238.
 */
export function generateTotp(options: TotpOptions): TotpResult {
  const digits = options.digits ?? 6;
  const period = options.periodSeconds ?? 30;
  const algorithm = options.algorithm ?? 'SHA-1';
  const timestamp = options.timestamp ?? Date.now();

  const secretBytes = base32ToBytes(options.secret);
  const epochSeconds = Math.floor(timestamp / 1000);
  const timeStep = Math.floor(epochSeconds / period);

  const secondsRemaining = period - (epochSeconds % period);
  const progressPercent = Math.round((secondsRemaining / period) * 100);

  // 8-byte big-endian counter
  const counterBytes = new Uint8Array(8);
  let temp = timeStep;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  let hashFn = sha1;
  if (algorithm === 'SHA-256') hashFn = sha256;
  if (algorithm === 'SHA-512') hashFn = sha512;

  const hmacResult = hmac(hashFn, secretBytes, counterBytes);

  // Dynamic Truncation (RFC 4226)
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binaryCode =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const modulo = Math.pow(10, digits);
  const code = (binaryCode % modulo).toString().padStart(digits, '0');

  return {
    code,
    secondsRemaining,
    periodSeconds: period,
    progressPercent,
  };
}

export interface ParsedOtpAuth {
  type: 'totp';
  label: string;
  issuer?: string;
  secret: string;
  algorithm?: 'SHA-1' | 'SHA-256' | 'SHA-512';
  digits?: 6 | 8;
  period?: number;
}

/**
 * Parses standard otpauth://totp/... URIs (e.g. from QR codes).
 */
export function parseOtpAuthUri(uri: string): ParsedOtpAuth {
  if (!uri.startsWith('otpauth://totp/')) {
    throw new CryptoError('Invalid OTPAuth URI format', 'INVALID_OTPAUTH');
  }

  const url = new URL(uri);
  const label = decodeURIComponent(url.pathname.replace(/^\/totp\/?/, ''));
  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new CryptoError('OTPAuth URI is missing secret parameter', 'INVALID_OTPAUTH');
  }

  const issuer = url.searchParams.get('issuer') || undefined;
  const digitsStr = url.searchParams.get('digits');
  const periodStr = url.searchParams.get('period');
  const algoStr = url.searchParams.get('algorithm')?.toUpperCase();

  const digits = digitsStr === '8' ? 8 : 6;
  const period = periodStr ? parseInt(periodStr, 10) : 30;

  let algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512' = 'SHA-1';
  if (algoStr === 'SHA256' || algoStr === 'SHA-256') algorithm = 'SHA-256';
  if (algoStr === 'SHA512' || algoStr === 'SHA-512') algorithm = 'SHA-512';

  return {
    type: 'totp',
    label,
    issuer,
    secret,
    algorithm,
    digits,
    period,
  };
}
