import { describe, it, expect, beforeEach } from 'vitest';
import { memoryStore } from '../../src/storage/memory-store';
import type { DecryptedVault, LoginItem, SecureNoteItem, CreditCardItem } from '../../src/types/vault';

describe('Bulk Vault Actions & Selection Engine', () => {
  beforeEach(() => {
    const sampleVault: DecryptedVault = {
      version: 1,
      folders: ['Personal', 'Work'],
      updatedAt: Date.now(),
      items: [
        {
          id: 'item-1',
          type: 'login',
          name: 'Personal Email',
          username: 'me@personal.com',
          password: 'pass1',
          urls: ['https://mail.com'],
          folder: 'Personal',
          favorite: false,
          trash: false,
          createdAt: 1000,
          updatedAt: 1000,
        } as LoginItem,
        {
          id: 'item-2',
          type: 'login',
          name: 'Work Jira',
          username: 'me@work.com',
          password: 'pass2',
          urls: ['https://jira.com'],
          folder: 'Work',
          favorite: false,
          trash: false,
          createdAt: 1000,
          updatedAt: 1000,
        } as LoginItem,
        {
          id: 'item-3',
          type: 'note',
          name: 'Server Config',
          content: 'api_key=xyz',
          folder: 'Work',
          favorite: true,
          trash: false,
          createdAt: 1000,
          updatedAt: 1000,
        } as SecureNoteItem,
        {
          id: 'item-4',
          type: 'card',
          name: 'Corporate Card',
          cardholderName: 'John Doe',
          cardNumber: '4000123456789010',
          expirationMonth: '12',
          expirationYear: '2028',
          cvv: '999',
          folder: 'Work',
          favorite: false,
          trash: false,
          createdAt: 1000,
          updatedAt: 1000,
        } as CreditCardItem,
      ],
    };

    memoryStore.setVault(sampleVault, 1, 'vault-test-1');
  });

  it('bulk deletes multiple items to trash in a single atomic state update', () => {
    const idsToDelete = ['item-1', 'item-3'];

    memoryStore.updateItems((prev) => ({
      ...prev,
      items: prev.items.map((i) => (idsToDelete.includes(i.id) ? { ...i, trash: true } : i)),
    }));

    const vault = memoryStore.getVault();
    expect(vault).toBeDefined();
    expect(vault?.items.filter((i) => i.trash).length).toBe(2);
    expect(vault?.items.find((i) => i.id === 'item-1')?.trash).toBe(true);
    expect(vault?.items.find((i) => i.id === 'item-2')?.trash).toBe(false);
    expect(vault?.items.find((i) => i.id === 'item-3')?.trash).toBe(true);
  });

  it('bulk moves multiple items to a new folder', () => {
    const idsToMove = ['item-1', 'item-2'];
    const targetFolder = 'Archive';

    memoryStore.updateItems((prev) => ({
      ...prev,
      folders: [...prev.folders, targetFolder],
      items: prev.items.map((i) => (idsToMove.includes(i.id) ? { ...i, folder: targetFolder } : i)),
    }));

    const vault = memoryStore.getVault();
    expect(vault?.folders).toContain('Archive');
    expect(vault?.items.find((i) => i.id === 'item-1')?.folder).toBe('Archive');
    expect(vault?.items.find((i) => i.id === 'item-2')?.folder).toBe('Archive');
    expect(vault?.items.find((i) => i.id === 'item-4')?.folder).toBe('Work');
  });

  it('bulk toggles favorite status on selected items', () => {
    const idsToFavorite = ['item-1', 'item-2', 'item-4'];

    memoryStore.updateItems((prev) => ({
      ...prev,
      items: prev.items.map((i) => (idsToFavorite.includes(i.id) ? { ...i, favorite: true } : i)),
    }));

    const vault = memoryStore.getVault();
    expect(vault?.items.find((i) => i.id === 'item-1')?.favorite).toBe(true);
    expect(vault?.items.find((i) => i.id === 'item-2')?.favorite).toBe(true);
    expect(vault?.items.find((i) => i.id === 'item-4')?.favorite).toBe(true);
  });

  it('erases all vault items in nuclear wipe', () => {
    memoryStore.updateItems((prev) => ({
      ...prev,
      items: [],
    }));

    const vault = memoryStore.getVault();
    expect(vault?.items.length).toBe(0);
  });
});
