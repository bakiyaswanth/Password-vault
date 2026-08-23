import { describe, it, expect } from 'vitest';
import {
  generatePassword,
  generatePassphrase,
  calculatePasswordEntropy,
} from '../../src/crypto/password-gen';

describe('Password & Passphrase Generator', () => {
  it('generates passwords of exact requested length', () => {
    const p1 = generatePassword({ length: 16 });
    const p2 = generatePassword({ length: 32 });
    const p3 = generatePassword({ length: 64 });

    expect(p1.length).toBe(16);
    expect(p2.length).toBe(32);
    expect(p3.length).toBe(64);
  });

  it('guarantees inclusion of enabled character sets', () => {
    const password = generatePassword({
      length: 24,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
    });

    expect(/[A-Z]/.test(password)).toBe(true);
    expect(/[a-z]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(password)).toBe(true);
  });

  it('excludes ambiguous characters when requested', () => {
    for (let i = 0; i < 20; i++) {
      const password = generatePassword({
        length: 50,
        excludeAmbiguous: true,
      });

      expect(password).not.toMatch(/[O0Il1|]/);
    }
  });

  it('generates memorable multi-word passphrases', () => {
    const phrase = generatePassphrase({
      wordCount: 4,
      separator: '-',
      capitalize: true,
      includeNumber: true,
    });

    const parts = phrase.split('-');
    expect(parts.length).toBe(4);
    expect(/[0-9]/.test(phrase)).toBe(true);
  });

  it('accurately calculates password entropy and strength', () => {
    const weak = calculatePasswordEntropy('123456');
    expect(weak.strength).toBe('very-weak');

    const strong = calculatePasswordEntropy('X#9qL$2mK@8vP!4zB*7w');
    expect(strong.strength).toBe('very-strong');
    expect(strong.entropyBits).toBeGreaterThan(100);
  });
});
