import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseProtonPassZip, parseProtonPassJson } from '../../src/utils/importers';
import type { LoginItem, CreditCardItem, IdentityItem } from '../../src/types/vault';

const protonExport = {
  version: '1.21.0',
  userId: 'u1',
  encrypted: false,
  vaults: {
    shareA: {
      name: 'Personal',
      items: [
        {
          itemId: 'i1',
          shareId: 'shareA',
          state: 1,
          pinned: true,
          createTime: 1700000000,
          modifyTime: 1700000100,
          data: {
            type: 'login',
            metadata: { name: 'GitHub', note: 'work acct', itemUuid: 'x' },
            extraFields: [{ fieldName: 'Recovery', type: 'hidden', data: { content: 'abc' } }],
            content: {
              itemEmail: 'me@example.com',
              itemUsername: '',
              password: 's3cret',
              urls: ['https://github.com'],
              totpUri: 'otpauth://totp/x?secret=JBSWY3DP',
            },
          },
        },
        {
          itemId: 'i2',
          state: 2,
          data: {
            type: 'creditCard',
            metadata: { name: 'Visa', note: '' },
            extraFields: [],
            content: {
              cardholderName: 'Jane Doe',
              number: '4111 1111 1111 1111',
              verificationNumber: '123',
              expirationDate: '2030-07',
              pin: '9999',
            },
          },
        },
      ],
    },
    shareB: {
      name: 'Family',
      items: [
        {
          itemId: 'i3',
          state: 1,
          data: {
            type: 'identity',
            metadata: { name: 'Me', note: '' },
            extraFields: [],
            content: { fullName: 'Jane Q Doe', email: 'jane@example.com', city: 'Pune' },
          },
        },
      ],
    },
  },
};

function makeZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) entries[k] = strToU8(v);
  return zipSync(entries);
}

describe('Proton Pass ZIP import', () => {
  it('parses data.json inside a Proton Pass zip export', () => {
    const result = parseProtonPassZip(makeZip({ 'Proton Pass/data.json': JSON.stringify(protonExport) }));

    expect(result.formatDetected).toBe('Proton Pass ZIP');
    expect(result.totalDetected).toBe(3);
    expect(result.validItems).toHaveLength(3);
    expect(result.allFolders.sort()).toEqual(['Family', 'Personal']);

    const login = result.validItems.find((i) => i.type === 'login') as LoginItem;
    expect(login.username).toBe('me@example.com');
    expect(login.password).toBe('s3cret');
    expect(login.urls).toEqual(['https://github.com']);
    expect(login.favorite).toBe(true);
    expect(login.customFields?.[0]).toMatchObject({ label: 'Recovery', value: 'abc', type: 'hidden' });
    expect(login.createdAt).toBe(1700000000 * 1000);

    const card = result.validItems.find((i) => i.type === 'card') as CreditCardItem;
    expect(card.cardNumber).toBe('4111111111111111');
    expect(card.expirationMonth).toBe('07');
    expect(card.expirationYear).toBe('2030');
    expect(card.cvv).toBe('123');
    expect(card.trash).toBe(true);

    const identity = result.validItems.find((i) => i.type === 'identity') as IdentityItem;
    expect(identity.firstName).toBe('Jane');
    expect(identity.lastName).toBe('Q Doe');
    expect(identity.folder).toBe('Family');
  });

  it('rejects PGP-encrypted exports with a clear message', () => {
    expect(() => parseProtonPassZip(makeZip({ 'Proton Pass/data.pgp': '-----BEGIN PGP MESSAGE-----' }))).toThrow(
      /PGP-encrypted/
    );
  });

  it('rejects zips without data.json', () => {
    expect(() => parseProtonPassZip(makeZip({ 'readme.txt': 'hi' }))).toThrow(/No data.json/);
  });

  it('rejects non-zip bytes', () => {
    expect(() => parseProtonPassZip(strToU8('not a zip'))).toThrow(/Could not read/);
  });

  it('still supports legacy array-shaped vaults JSON', () => {
    const result = parseProtonPassJson(
      JSON.stringify({ vaults: [{ name: 'V', items: [{ type: 'note', data: { metadata: { name: 'N' }, content: { note: 'x' } } }] }] })
    );
    expect(result.validItems).toHaveLength(1);
  });
});
