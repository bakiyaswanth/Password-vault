import { describe, it, expect } from 'vitest';
import {
  encryptAesGcm,
  decryptAesGcm,
  encryptJson,
  decryptJson,
} from '../../src/crypto/aes';
import { getRandomBytes } from '../../src/crypto/random';
import { utf8ToBytes, bytesToUtf8 } from '../../src/crypto/encoding';
import { DecryptionError, InvalidKeyError } from '../../src/crypto/errors';

describe('AES-256-GCM Cryptographic Engine', () => {
  it('encrypts and decrypts raw bytes correctly', async () => {
    const key = getRandomBytes(32);
    const originalText = 'Zero-Knowledge Secret 123! 🛡️';
    const plaintext = utf8ToBytes(originalText);

    const { ciphertext, iv } = await encryptAesGcm(plaintext, key);
    expect(ciphertext).toBeInstanceOf(Uint8Array);
    expect(iv.length).toBe(12);

    const decryptedBytes = await decryptAesGcm(ciphertext, key, iv);
    const decryptedText = bytesToUtf8(decryptedBytes);
    expect(decryptedText).toBe(originalText);
  });

  it('fails decryption if an incorrect key is used', async () => {
    const key1 = getRandomBytes(32);
    const key2 = getRandomBytes(32);
    const plaintext = utf8ToBytes('Confidential Data');

    const { ciphertext, iv } = await encryptAesGcm(plaintext, key1);

    await expect(decryptAesGcm(ciphertext, key2, iv)).rejects.toThrow(DecryptionError);
  });

  it('fails decryption if the IV is modified', async () => {
    const key = getRandomBytes(32);
    const plaintext = utf8ToBytes('Protected Data');
    const { ciphertext, iv } = await encryptAesGcm(plaintext, key);

    const tamperedIv = new Uint8Array(iv);
    tamperedIv[0] ^= 0xff; // Flip bits

    await expect(decryptAesGcm(ciphertext, key, tamperedIv)).rejects.toThrow(DecryptionError);
  });

  it('fails decryption if the ciphertext is tampered', async () => {
    const key = getRandomBytes(32);
    const plaintext = utf8ToBytes('Payload Data');
    const { ciphertext, iv } = await encryptAesGcm(plaintext, key);

    const tamperedCiphertext = new Uint8Array(ciphertext);
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0x01; // Tamper auth tag or body

    await expect(decryptAesGcm(tamperedCiphertext, key, iv)).rejects.toThrow(DecryptionError);
  });

  it('generates unique IVs on successive encryptions with the same key', async () => {
    const key = getRandomBytes(32);
    const plaintext = utf8ToBytes('Repeated Message');

    const enc1 = await encryptAesGcm(plaintext, key);
    const enc2 = await encryptAesGcm(plaintext, key);

    expect(enc1.iv).not.toEqual(enc2.iv);
    expect(enc1.ciphertext).not.toEqual(enc2.ciphertext);
  });

  it('validates key and IV lengths strictly', async () => {
    const invalidKey = getRandomBytes(16); // 128-bit key not allowed
    const validKey = getRandomBytes(32);
    const invalidIv = getRandomBytes(16); // 16-byte IV not allowed for AES-GCM 96-bit
    const plaintext = utf8ToBytes('Test');

    await expect(encryptAesGcm(plaintext, invalidKey)).rejects.toThrow(InvalidKeyError);
    await expect(encryptAesGcm(plaintext, validKey, invalidIv)).rejects.toThrow(InvalidKeyError);
  });

  it('encrypts and decrypts complex JSON structures', async () => {
    const key = getRandomBytes(32);
    const vaultItem = {
      id: 'item-123',
      name: 'GitHub Account',
      username: 'developer@example.com',
      password: 'super-secret-password-123',
      tags: ['dev', 'git'],
      favorite: true,
      customFields: [{ label: 'PIN', value: '4321' }],
    };

    const blob = await encryptJson(vaultItem, key);
    expect(blob.metadata.version).toBe(1);
    expect(blob.metadata.algorithm).toBe('AES-256-GCM');
    expect(typeof blob.ciphertext).toBe('string');

    const decryptedItem = await decryptJson<typeof vaultItem>(blob, key);
    expect(decryptedItem).toEqual(vaultItem);
  });
});
