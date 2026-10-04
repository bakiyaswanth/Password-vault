import { describe, it, expect } from 'vitest';
import { rankSearchResults, applyUsage, matchScore, USAGE_COLLAPSE_WINDOW_MS } from '../../src/utils/search-ranking';
import type { LoginItem, VaultItem } from '../../src/types/vault';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function login(name: string, urls: string[] = [], extra: Partial<LoginItem> = {}): LoginItem {
  return {
    id: name,
    type: 'login',
    name,
    username: '',
    password: 'x',
    urls,
    favorite: false,
    trash: false,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

const entry = (item: VaultItem) => ({
  item,
  searchStr: `${item.name} ${item.type} ${item.type === 'login' ? `${item.username} ${item.urls.join(' ')}` : ''}`.toLowerCase(),
});

const names = (items: VaultItem[]) => items.map((i) => i.name);

describe('search ranking', () => {
  it('excludes non-matching items', () => {
    const r = rankSearchResults([entry(login('GitHub')), entry(login('Gmail'))], 'git', NOW);
    expect(names(r)).toEqual(['GitHub']);
  });

  it('ranks name prefix above incidental matches', () => {
    const r = rankSearchResults(
      [entry(login('My mail', [], { username: 'proton-fan' })), entry(login('Proton'))],
      'proton',
      NOW
    );
    expect(names(r)).toEqual(['Proton', 'My mail']);
  });

  it('matches URL domain labels, e.g. "proton" → account.proton.com', () => {
    const item = login('Work account', ['https://account.proton.com/login']);
    expect(matchScore(item, 'proton')).toBeGreaterThan(0);
    expect(names(rankSearchResults([entry(item)], 'proton', NOW))).toEqual(['Work account']);
  });

  it('puts a recently used match above an equally good unused one', () => {
    const a = login('Proton Mail', ['https://mail.proton.me']);
    const b = login('Proton Account', ['https://account.proton.me'], { lastUsedAt: NOW - 60_000, useCount: 3 });
    expect(names(rankSearchResults([entry(a), entry(b)], 'proton', NOW))).toEqual(['Proton Account', 'Proton Mail']);
  });

  it('recency fades: a use from months ago barely helps', () => {
    const stale = login('Proton Old', [], { lastUsedAt: NOW - 180 * DAY, useCount: 1 });
    const fresh = login('Proton New', [], { lastUsedAt: NOW - DAY, useCount: 1 });
    expect(names(rankSearchResults([entry(stale), entry(fresh)], 'proton', NOW))).toEqual(['Proton New', 'Proton Old']);
  });

  it('usage does not overpower a much better text match', () => {
    const exact = login('proton');
    const weak = login('Notes', [], { username: 'someproton', lastUsedAt: NOW, useCount: 50 });
    expect(names(rankSearchResults([entry(weak), entry(exact)], 'proton', NOW))[0]).toBe('proton');
  });

  it('uses the supplied usage snapshot instead of live item fields', () => {
    const a = login('Proton A', [], { lastUsedAt: NOW, useCount: 10 });
    const b = login('Proton B');
    const snapshot = new Map([[b.id, { lastUsedAt: NOW, useCount: 10 }]]);
    const r = rankSearchResults([entry(a), entry(b)], 'proton', NOW, (i) => snapshot.get(i.id) ?? {});
    expect(names(r)).toEqual(['Proton B', 'Proton A']);
  });

  it('supports multi-word queries matching different fields', () => {
    const item = login('Work', ['https://account.proton.com']);
    expect(names(rankSearchResults([entry(item)], 'work proton', NOW))).toEqual(['Work']);
  });
});

describe('applyUsage', () => {
  it('increments count and sets lastUsedAt without touching updatedAt', () => {
    const used = applyUsage(login('A', [], { updatedAt: 5 }), NOW);
    expect(used).toMatchObject({ lastUsedAt: NOW, useCount: 1, updatedAt: 5 });
  });

  it('collapses rapid repeats (open then copy) into one use', () => {
    const once = applyUsage(login('A'), NOW);
    const twice = applyUsage(once, NOW + 5_000);
    expect(twice.useCount).toBe(1);
    expect(twice.lastUsedAt).toBe(NOW + 5_000);
    const later = applyUsage(twice, NOW + 5_000 + USAGE_COLLAPSE_WINDOW_MS);
    expect(later.useCount).toBe(2);
  });
});
