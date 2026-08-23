/**
 * AegisVault Cryptographic Encoding Utilities
 * Provides constant-time comparison, Base64/Base64URL, Hex, and UTF-8 encoding functions.
 */

import { CryptoError } from './errors';

/**
 * Converts a Uint8Array to a standard Base64 string.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string to a Uint8Array.
 */
export function base64ToBytes(base64: string): Uint8Array {
  try {
    const binary = atob(base64.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new CryptoError('Invalid Base64 string provided', 'INVALID_BASE64');
  }
}

/**
 * Converts a Uint8Array to a URL-safe Base64 string (no padding, - and _).
 */
export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Converts a URL-safe Base64 string to a Uint8Array.
 */
export function base64UrlToBytes(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64ToBytes(base64);
}

/**
 * Converts a Uint8Array to a lowercase Hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a Hex string to a Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.trim().toLowerCase();
  if (cleanHex.length % 2 !== 0) {
    throw new CryptoError('Invalid Hex string length', 'INVALID_HEX');
  }
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    const byte = parseInt(cleanHex.substring(i, i + 2), 16);
    if (isNaN(byte)) {
      throw new CryptoError('Invalid character in Hex string', 'INVALID_HEX');
    }
    bytes[i / 2] = byte;
  }
  return bytes;
}

/**
 * Converts a UTF-8 string to a Uint8Array.
 */
export function utf8ToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Converts a Uint8Array to a UTF-8 string.
 */
export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/**
 * Constant-time comparison of two byte arrays to protect against timing attacks.
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
