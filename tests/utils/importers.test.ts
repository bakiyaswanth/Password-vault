import { describe, it, expect } from 'vitest';
import {
  parseBitwardenJson,
  exportBitwardenJson,
  parseBitwardenCsv,
  exportBitwardenCsv,
  parseProtonPassJson,
  exportProtonPassJson,
  parseChromeCsv,
  autoDetectAndImport,
  computeItemFingerprint,
} from '../../src/utils/importers';
import type { DecryptedVault, LoginItem, SecureNoteItem, CreditCardItem } from '../../src/types/vault';

describe('Surakshit Vault Multi-Format Importer & Exporter Engine', () => {
  const sampleDecryptedVault: DecryptedVault = {
    version: 1,
    folders: ['Personal', 'Work', 'Finance'],
    updatedAt: Date.now(),
    items: [
      {
        id: 'item-1',
        type: 'login',
        name: 'GitHub Account',
        username: 'dev@example.com',
        password: 'SuperSecretPassword123!',
        urls: ['https://github.com', 'https://api.github.com'],
        totpSecret: 'JBSWY3DPEHPK3PXP',
        notes: 'Personal developer credentials',
        folder: 'Personal',
        favorite: true,
        trash: false,
        customFields: [{ id: 'f-1', label: 'Security PIN', value: '9988', type: 'hidden' }],
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      } as LoginItem,
      {
        id: 'item-2',
        type: 'note',
        name: 'Server Recovery Keys',
        content: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG...',
        folder: 'Work',
        favorite: false,
        trash: false,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      } as SecureNoteItem,
      {
        id: 'item-3',
        type: 'card',
        name: 'Primary Debit Card',
        cardholderName: 'Alice Johnson',
        cardNumber: '4111222233334444',
        expirationMonth: '12',
        expirationYear: '2028',
        cvv: '123',
        pin: '4321',
        folder: 'Finance',
        favorite: false,
        trash: false,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      } as CreditCardItem,
    ],
  };

  it('exports and imports Bitwarden standard JSON accurately (round-trip)', () => {
    const bwJsonString = exportBitwardenJson(sampleDecryptedVault);
    expect(typeof bwJsonString).toBe('string');
    expect(bwJsonString).toContain('"encrypted": false');
    expect(bwJsonString).toContain('GitHub Account');

    const importedResult = parseBitwardenJson(bwJsonString);
    expect(importedResult.formatDetected).toBe('Bitwarden JSON');
    expect(importedResult.validItems.length).toBe(3);
    expect(importedResult.foldersCreated).toContain('Personal');
    expect(importedResult.foldersCreated).toContain('Work');
    expect(importedResult.foldersCreated).toContain('Finance');

    const login = importedResult.validItems.find((i) => i.type === 'login') as LoginItem;
    expect(login).toBeDefined();
    expect(login.name).toBe('GitHub Account');
    expect(login.username).toBe('dev@example.com');
    expect(login.password).toBe('SuperSecretPassword123!');
    expect(login.totpSecret).toBe('JBSWY3DPEHPK3PXP');
    expect(login.urls).toContain('https://github.com');
    expect(login.folder).toBe('Personal');
    expect(login.favorite).toBe(true);

    const note = importedResult.validItems.find((i) => i.type === 'note') as SecureNoteItem;
    expect(note).toBeDefined();
    expect(note.name).toBe('Server Recovery Keys');
    expect(note.folder).toBe('Work');
    expect(note.content).toContain('ssh-ed25519');

    const card = importedResult.validItems.find((i) => i.type === 'card') as CreditCardItem;
    expect(card).toBeDefined();
    expect(card.cardholderName).toBe('Alice Johnson');
    expect(card.cardNumber).toBe('4111222233334444');
    expect(card.folder).toBe('Finance');
  });

  it('successfully imports 542+ Bitwarden passwords and preserves Personal and Work folders', () => {
    // Generate a realistic 542-item Bitwarden export with folders
    const folders = [
      { id: 'folder-personal', name: 'Personal' },
      { id: 'folder-work', name: 'Work' },
      { id: 'folder-finance', name: 'Finance' },
    ];

    const items = [];
    for (let i = 1; i <= 542; i++) {
      const folderId = i <= 200 ? 'folder-personal' : i <= 400 ? 'folder-work' : 'folder-finance';
      items.push({
        id: `bw-uuid-${i}`,
        type: 1,
        name: `Account #${i} ${i % 2 === 0 ? 'Google' : 'AWS'}`,
        folderId,
        favorite: i % 10 === 0,
        login: {
          username: `user_${i}@example.com`,
          password: `P@ssword_${i}_${crypto.randomUUID()}`,
          uris: [{ uri: `https://app${i}.example.com/login` }],
          totp: i % 5 === 0 ? 'JBSWY3DPEHPK3PXP' : null,
        },
        notes: `Confidential credentials for service ${i}`,
      });
    }

    const exportPayload = JSON.stringify({
      encrypted: false,
      folders,
      items,
    });

    const startTime = performance.now();
    const result = parseBitwardenJson(exportPayload);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(150); // Under 150ms for 542 items
    expect(result.totalDetected).toBe(542);
    expect(result.validItems.length).toBe(542);
    expect(result.failedCount).toBe(0);
    expect(result.foldersCreated).toContain('Personal');
    expect(result.foldersCreated).toContain('Work');
    expect(result.foldersCreated).toContain('Finance');

    expect(result.folderItemCounts['Personal']).toBe(200);
    expect(result.folderItemCounts['Work']).toBe(200);
    expect(result.folderItemCounts['Finance']).toBe(142);

    // Verify item folder assignments
    const item1 = result.validItems[0] as LoginItem;
    expect(item1.folder).toBe('Personal');
    expect(item1.username).toBe('user_1@example.com');

    const item250 = result.validItems[249] as LoginItem;
    expect(item250.folder).toBe('Work');

    const item450 = result.validItems[449] as LoginItem;
    expect(item450.folder).toBe('Finance');
  });

  it('isolates failed records without interrupting the remaining items', () => {
    const mixedPayload = JSON.stringify({
      encrypted: false,
      folders: [{ id: 'f1', name: 'Work' }],
      items: [
        { name: 'Valid Item 1', folderId: 'f1', login: { username: 'user1', password: 'p1' } },
        null, // Malformed item
        { name: 'Valid Item 2', folderId: 'f1', login: { username: 'user2', password: 'p2' } },
      ],
    });

    const result = parseBitwardenJson(mixedPayload);
    expect(result.totalDetected).toBe(3);
    expect(result.validItems.length).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.failedItems[0].error).toBeDefined();
  });

  it('computes consistent fingerprints for duplicate prevention', () => {
    const itemA: Partial<LoginItem> = {
      type: 'login',
      name: 'GitHub',
      username: 'user@example.com',
      urls: ['https://github.com'],
      folder: 'Personal',
    };
    const itemB: Partial<LoginItem> = {
      type: 'login',
      name: '  github  ',
      username: 'USER@EXAMPLE.COM',
      urls: ['https://github.com'],
      folder: 'personal',
    };

    expect(computeItemFingerprint(itemA)).toBe(computeItemFingerprint(itemB));
  });

  it('exports and imports Bitwarden CSV format with folder mapping', () => {
    const csvString = exportBitwardenCsv(sampleDecryptedVault);
    expect(csvString).toContain('login_username');
    expect(csvString).toContain('GitHub Account');

    const importedResult = parseBitwardenCsv(csvString);
    expect(importedResult.formatDetected).toBe('Bitwarden CSV');
    expect(importedResult.validItems.length).toBe(3);
    expect(importedResult.foldersCreated).toContain('Personal');
    expect(importedResult.foldersCreated).toContain('Work');
  });

  it('exports and imports Proton Pass JSON structure', () => {
    const protonJsonString = exportProtonPassJson(sampleDecryptedVault);
    expect(protonJsonString).toContain('"vaults"');
    expect(protonJsonString).toContain('GitHub Account');

    const importedResult = parseProtonPassJson(protonJsonString);
    expect(importedResult.formatDetected).toBe('Proton Pass JSON');
    expect(importedResult.validItems.length).toBe(3);
  });

  it('parses generic Chrome / CSV exports', () => {
    const chromeCsv = `name,url,username,password,note\nAmazon,https://amazon.com,user@test.com,Pass123!,Shopping account`;
    const result = parseChromeCsv(chromeCsv);

    expect(result.validItems.length).toBe(1);
    const item = result.validItems[0] as LoginItem;
    expect(item.name).toBe('Amazon');
    expect(item.username).toBe('user@test.com');
    expect(item.password).toBe('Pass123!');
    expect(item.urls).toContain('https://amazon.com');
  });

  it('auto-detects Bitwarden JSON and preserves folders automatically', () => {
    const sampleBw = JSON.stringify({
      encrypted: false,
      folders: [{ id: 'f-work', name: 'Work' }],
      items: [{ name: 'Jira', folderId: 'f-work', login: { username: 'dev@work.com', password: 'secretpassword' } }],
    });

    const result = autoDetectAndImport(sampleBw);
    expect(result.formatDetected).toBe('Bitwarden JSON');
    expect(result.validItems.length).toBe(1);
    expect(result.validItems[0].folder).toBe('Work');
  });
});
