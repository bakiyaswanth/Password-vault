import { describe, it, expect } from 'vitest';
import { groupByRecency, recencyLabel } from '../../src/utils/recency-groups';
import { parseProtonPassJson } from '../../src/utils/importers';
import type { LoginItem } from '../../src/types/vault';

const DAY = 24 * 60 * 60 * 1000;
// Fixed local noon so day boundaries are deterministic regardless of timezone.
const NOW = new Date(2026, 9, 4, 12, 0, 0).getTime();

const login = (name: string, lastUsedAt?: number): LoginItem => ({
  id: name,
  type: 'login',
  name,
  username: '',
  password: '',
  urls: [],
  favorite: false,
  trash: false,
  createdAt: 0,
  updatedAt: 0,
  lastUsedAt,
});

describe('recency grouping', () => {
  it('labels by local calendar day boundaries', () => {
    expect(recencyLabel(NOW - 60_000, NOW)).toBe('Today');
    expect(recencyLabel(new Date(2026, 9, 4, 0, 5).getTime(), NOW)).toBe('Today');
    expect(recencyLabel(new Date(2026, 9, 3, 23, 55).getTime(), NOW)).toBe('Yesterday');
    expect(recencyLabel(NOW - 5 * DAY, NOW)).toBe('Last week');
    expect(recencyLabel(NOW - 20 * DAY, NOW)).toBe('Last month');
    expect(recencyLabel(NOW - 90 * DAY, NOW)).toBe('Older');
  });

  it('groups newest first and drops never-used items', () => {
    const groups = groupByRecency(
      [login('old', NOW - 90 * DAY), login('never'), login('a', NOW - 1000), login('b', NOW - 2000), login('wk', NOW - 3 * DAY)],
      NOW
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.name)])).toEqual([
      ['Today', ['a', 'b']],
      ['Last week', ['wk']],
      ['Older', ['old']],
    ]);
  });

  it('respects a frozen usage snapshot', () => {
    const items = [login('a', NOW), login('b', NOW - 1000)];
    const frozen = new Map([['a', NOW - 5000], ['b', NOW - 1000]]);
    const groups = groupByRecency(items, NOW, (i) => frozen.get(i.id));
    expect(groups[0].items.map((i) => i.name)).toEqual(['b', 'a']);
  });
});

describe('Proton Pass real export item (no usage history in export)', () => {
  it('parses a real autosaved login and leaves lastUsedAt unset', () => {
    const realItem = {
      itemId: 'beHx',
      shareId: '',
      folderId: null,
      data: {
        metadata: { name: 'web.webex.com', note: 'Autosaved on https://web.webex.com/', itemUuid: 'ee3da22d' },
        extraFields: [],
        type: 'login',
        content: {
          itemEmail: '',
          password: '',
          totpUri: '',
          passkeys: [],
          itemUsername: '',
          autofillUrls: [{ url: 'https://web.webex.com/', mode: 0 }],
          urls: ['https://web.webex.com/'],
        },
      },
      state: 1,
      aliasEmail: null,
      contentFormatVersion: 7,
      createTime: 1786680426,
      modifyTime: 1786680444,
      pinned: false,
      shareCount: 0,
      files: [],
    };
    const result = parseProtonPassJson(JSON.stringify({ vaults: { s: { name: 'Personal', items: [realItem] } } }));
    expect(result.failedCount).toBe(0);
    const item = result.validItems[0] as LoginItem;
    expect(item).toMatchObject({
      type: 'login',
      name: 'web.webex.com',
      urls: ['https://web.webex.com/'],
      notes: 'Autosaved on https://web.webex.com/',
      createdAt: 1786680426 * 1000,
      updatedAt: 1786680444 * 1000,
      trash: false,
      favorite: false,
    });
    // Empty TOTP string must not become a bogus secret.
    expect(item.totpSecret).toBeUndefined();
    expect(item.lastUsedAt).toBeUndefined();
  });
});
