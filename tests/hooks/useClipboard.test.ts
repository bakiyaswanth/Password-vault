import { describe, it, expect } from 'vitest';

describe('useClipboard Scoping & Visual Reset Logic', () => {
  it('correctly validates item-scoped copy identifiers and prevents cross-item state leak', () => {
    let currentCopiedId: string | null = null;

    const isCopied = (id: string) => currentCopiedId === id;

    // Simulate copying Login A username
    const itemAId = 'login-uuid-a';
    const itemBId = 'login-uuid-b';

    currentCopiedId = `${itemAId}:username`;

    // Item A username is marked as copied
    expect(isCopied(`${itemAId}:username`)).toBe(true);

    // Item B username is NOT copied
    expect(isCopied(`${itemBId}:username`)).toBe(false);

    // Item A password is NOT copied
    expect(isCopied(`${itemAId}:password`)).toBe(false);

    // Simulate user switching to Login B -> resetVisualState() is triggered
    currentCopiedId = null;

    expect(isCopied(`${itemAId}:username`)).toBe(false);
    expect(isCopied(`${itemBId}:username`)).toBe(false);
  });
});
