/**
 * Surakshit Vault State & High-Performance Synchronization Context
 * Implements in-memory indexing, category bucketing, instant search caching, and atomic batch sync via typed apiClient.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { memoryStore } from '../storage/memory-store';
import { encryptAesGcm, decryptAesGcm } from '../crypto/aes';
import { bytesToBase64, base64ToBytes, bytesToUtf8, utf8ToBytes } from '../crypto/encoding';
import { createEncryptedBackup, restoreEncryptedBackup } from '../crypto/backup';
import { computeItemFingerprint } from '../utils/importers';
import { perfTracker } from '../utils/performance';
import { apiClient, ApiClientError } from '../api/client';
import { logger } from '../utils/logger';
import type { VaultItem, DecryptedVault } from '../types/vault';

export interface BatchImportReport {
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  totalVaultItems: number;
}

interface IndexedItem {
  item: VaultItem;
  searchStr: string;
}

interface VaultContextType {
  items: VaultItem[];
  filteredItems: VaultItem[];
  folders: string[];
  selectedItem: VaultItem | null;
  selectedCategory: string;
  selectedFolder: string | null;
  searchQuery: string;
  isSyncing: boolean;
  syncError: string | null;
  conflictState: {
    hasConflict: boolean;
    serverRevision?: number;
    serverItems?: VaultItem[];
  } | null;
  setSelectedItem: (item: VaultItem | null) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedFolder: (folder: string | null) => void;
  setSearchQuery: (query: string) => void;
  addItem: (item: Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<VaultItem>;
  importBatch: (newItems: VaultItem[], newFolders: string[], overwriteDuplicates?: boolean) => Promise<BatchImportReport>;
  updateItem: (item: VaultItem) => Promise<void>;
  deleteItem: (id: string, permanent?: boolean) => Promise<void>;
  bulkDeleteItems: (ids: string[], permanent?: boolean) => Promise<void>;
  bulkMoveToFolder: (ids: string[], folder: string | undefined) => Promise<void>;
  bulkToggleFavorite: (ids: string[], favorite: boolean) => Promise<void>;
  deleteAllItems: () => Promise<void>;
  restoreItem: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  addFolder: (name: string) => Promise<void>;
  syncVault: () => Promise<boolean>;
  resolveConflict: (choice: 'local' | 'remote' | 'merge') => Promise<void>;
  exportEncryptedBackup: (backupPassword: string) => Promise<string>;
  importEncryptedBackup: (backupJson: string, backupPassword: string) => Promise<void>;
}

const VaultContext = createContext<VaultContextType | null>(null);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vaultData, setVaultData] = useState<DecryptedVault | null>(memoryStore.getVault());
  const [selectedItem, setSelectedItem] = useState<VaultItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [conflictState, setConflictState] = useState<{
    hasConflict: boolean;
    serverRevision?: number;
    serverItems?: VaultItem[];
  } | null>(null);

  // Subscribe to memoryStore updates
  useEffect(() => {
    const unsubscribe = memoryStore.subscribe(() => {
      const currentVault = memoryStore.getVault();
      setVaultData(currentVault);
      if (!currentVault) {
        setSelectedItem(null);
      }
    });
    return unsubscribe;
  }, []);

  const items = useMemo(() => vaultData?.items ?? [], [vaultData]);
  const folders = useMemo(() => vaultData?.folders ?? [], [vaultData]);

  // Search Index
  const indexedItems = useMemo<IndexedItem[]>(() => {
    perfTracker.startMeasure('index_vault_items');
    const result = items.map((item) => {
      let tokens = `${item.name} ${item.type} ${item.folder || ''}`;
      if (item.type === 'login') {
        tokens += ` ${item.username || ''} ${(item.urls || []).join(' ')}`;
      } else if (item.type === 'note') {
        tokens += ` ${item.content || ''}`;
      } else if (item.type === 'card') {
        tokens += ` ${item.cardholderName || ''} ${item.cardNumber ? item.cardNumber.slice(-4) : ''}`;
      } else if (item.type === 'identity') {
        tokens += ` ${item.firstName || ''} ${item.lastName || ''} ${item.email || ''}`;
      }
      if (item.tags && item.tags.length > 0) {
        tokens += ` ${item.tags.join(' ')}`;
      }

      return {
        item,
        searchStr: tokens.toLowerCase(),
      };
    });
    perfTracker.endMeasure('index_vault_items');
    return result;
  }, [items]);

  // Categorized Buckets
  const categoryBuckets = useMemo(() => {
    const active = indexedItems.filter((i) => !i.item.trash);
    const trash = indexedItems.filter((i) => i.item.trash);

    const folderMap = new Map<string, IndexedItem[]>();
    for (const f of folders) {
      folderMap.set(f, []);
    }

    const logins: IndexedItem[] = [];
    const notes: IndexedItem[] = [];
    const cards: IndexedItem[] = [];
    const identities: IndexedItem[] = [];
    const favorites: IndexedItem[] = [];

    for (const entry of active) {
      const itm = entry.item;
      if (itm.favorite) favorites.push(entry);
      if (itm.type === 'login') logins.push(entry);
      else if (itm.type === 'note') notes.push(entry);
      else if (itm.type === 'card') cards.push(entry);
      else if (itm.type === 'identity') identities.push(entry);

      if (itm.folder && folderMap.has(itm.folder)) {
        folderMap.get(itm.folder)!.push(entry);
      }
    }

    return {
      all: active,
      trash,
      favorites,
      logins,
      notes,
      cards,
      identities,
      folderMap,
    };
  }, [indexedItems, folders]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    perfTracker.startMeasure('search_query_eval');

    let pool: IndexedItem[];
    if (selectedCategory === 'trash') {
      pool = categoryBuckets.trash;
    } else if (selectedCategory === 'folder' && selectedFolder) {
      pool = categoryBuckets.folderMap.get(selectedFolder) || [];
    } else if (selectedCategory === 'favorites') {
      pool = categoryBuckets.favorites;
    } else if (selectedCategory === 'logins') {
      pool = categoryBuckets.logins;
    } else if (selectedCategory === 'notes') {
      pool = categoryBuckets.notes;
    } else if (selectedCategory === 'cards') {
      pool = categoryBuckets.cards;
    } else if (selectedCategory === 'identities') {
      pool = categoryBuckets.identities;
    } else {
      pool = categoryBuckets.all;
    }

    const cleanQuery = searchQuery.trim().toLowerCase();
    let resultItems: VaultItem[];

    if (!cleanQuery) {
      resultItems = pool.map((e) => e.item);
    } else {
      resultItems = pool
        .filter((entry) => entry.searchStr.includes(cleanQuery))
        .map((entry) => entry.item);
    }

    perfTracker.endMeasure('search_query_eval');
    return resultItems;
  }, [categoryBuckets, selectedCategory, selectedFolder, searchQuery]);

  // Synchronize encrypted vault via typed apiClient
  const syncVault = useCallback(async (): Promise<boolean> => {
    const vek = memoryStore.getVaultKey();
    const vault = memoryStore.getVault();
    const currentRevision = memoryStore.getRevision();

    if (!vek || !vault) return false;

    setIsSyncing(true);
    setSyncError(null);

    try {
      perfTracker.startMeasure('sync_encrypt_vault');
      const jsonBytes = utf8ToBytes(JSON.stringify(vault));
      const { ciphertext, iv } = await encryptAesGcm(jsonBytes, vek);
      perfTracker.endMeasure('sync_encrypt_vault');

      const resData = await apiClient.vault.sync({
        expectedRevision: currentRevision,
        encryptedPayload: bytesToBase64(ciphertext),
        iv: bytesToBase64(iv),
      });

      memoryStore.setVault(vault, resData.revision, memoryStore.getVaultId() || '');
      logger.info('Surakshit Vault synchronized successfully. Revision:', resData.revision);
      return true;
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.status === 409) {
        logger.warn('Sync conflict detected, fetching remote revision');
        const conflictDetails: any = err.details || {};

        let serverItems: VaultItem[] = [];
        if (conflictDetails.encryptedPayload && conflictDetails.iv) {
          try {
            const sIv = base64ToBytes(conflictDetails.iv);
            const sCipher = base64ToBytes(conflictDetails.encryptedPayload);
            const decrypted = await decryptAesGcm(sCipher, vek, sIv);
            const sVault: DecryptedVault = JSON.parse(bytesToUtf8(decrypted));
            serverItems = sVault.items;
          } catch {
            // Ignored
          }
        }

        setConflictState({
          hasConflict: true,
          serverRevision: conflictDetails.currentRevision,
          serverItems,
        });
        return false;
      }

      const msg = err instanceof ApiClientError ? err.message : (err instanceof Error ? err.message : 'Synchronization failed');
      setSyncError(msg);
      logger.error('Vault synchronization failed', err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Conflict Resolution
  const resolveConflict = async (choice: 'local' | 'remote' | 'merge') => {
    if (!conflictState) return;

    const vek = memoryStore.getVaultKey();
    const localVault = memoryStore.getVault();
    if (!vek || !localVault) return;

    let resolvedItems: VaultItem[] = localVault.items;

    if (choice === 'remote' && conflictState.serverItems) {
      resolvedItems = conflictState.serverItems;
    } else if (choice === 'merge' && conflictState.serverItems) {
      const localMap = new Map(localVault.items.map((i) => [i.id, i]));
      for (const item of conflictState.serverItems) {
        const local = localMap.get(item.id);
        if (!local || item.updatedAt > local.updatedAt) {
          localMap.set(item.id, item);
        }
      }
      resolvedItems = Array.from(localMap.values());
    }

    const updatedVault: DecryptedVault = {
      ...localVault,
      items: resolvedItems,
      updatedAt: Date.now(),
    };

    memoryStore.setVault(updatedVault, conflictState.serverRevision || 1, memoryStore.getVaultId() || '');
    setConflictState(null);
    await syncVault();
  };

  // Add Single Item
  const addItem = async (
    itemData: Omit<VaultItem, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<VaultItem> => {
    const now = Date.now();
    const newItem: VaultItem = {
      ...itemData,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as VaultItem;

    memoryStore.updateItems((prev) => ({
      ...prev,
      items: [newItem, ...prev.items],
      updatedAt: now,
    }));

    setSelectedItem(newItem);
    await syncVault();
    return newItem;
  };

  // Batch Import
  const importBatch = async (
    newItems: VaultItem[],
    newFolders: string[],
    overwriteDuplicates: boolean = false
  ): Promise<BatchImportReport> => {
    const now = Date.now();
    let importedCount = 0;
    let duplicateCount = 0;
    let totalItems = 0;

    memoryStore.updateItems((prev) => {
      const existingFingerprints = new Set(prev.items.map((i) => computeItemFingerprint(i)));
      const itemsToAdd: VaultItem[] = [];

      for (const item of newItems) {
        const fp = computeItemFingerprint(item);
        if (existingFingerprints.has(fp) && !overwriteDuplicates) {
          duplicateCount++;
        } else {
          existingFingerprints.add(fp);
          itemsToAdd.push({
            ...item,
            id: item.id || crypto.randomUUID(),
            createdAt: item.createdAt || now,
            updatedAt: now,
          });
          importedCount++;
        }
      }

      const mergedFolders = Array.from(
        new Set([
          ...prev.folders,
          ...newFolders.filter((f) => f && typeof f === 'string' && f.trim().length > 0),
          ...itemsToAdd.map((i) => i.folder).filter((f): f is string => Boolean(f && f.trim())),
        ])
      );

      const updatedList = [...itemsToAdd, ...prev.items];
      totalItems = updatedList.length;

      return {
        ...prev,
        folders: mergedFolders,
        items: updatedList,
        updatedAt: now,
      };
    });

    await syncVault();

    return {
      importedCount,
      skippedCount: duplicateCount,
      duplicateCount,
      totalVaultItems: totalItems,
    };
  };

  // Update Item
  const updateItem = async (updated: VaultItem) => {
    const now = Date.now();
    const itemWithTime = { ...updated, updatedAt: now };

    memoryStore.updateItems((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === updated.id ? itemWithTime : item)),
      updatedAt: now,
    }));

    setSelectedItem(itemWithTime);
    await syncVault();
  };

  // Delete Single Item
  const deleteItem = async (id: string, permanent: boolean = false) => {
    const now = Date.now();
    if (permanent) {
      memoryStore.updateItems((prev) => ({
        ...prev,
        items: prev.items.filter((item) => item.id !== id),
        updatedAt: now,
      }));
    } else {
      memoryStore.updateItems((prev) => ({
        ...prev,
        items: prev.items.map((item) => (item.id === id ? { ...item, trash: true, updatedAt: now } : item)),
        updatedAt: now,
      }));
    }

    if (selectedItem?.id === id) {
      setSelectedItem(null);
    }
    await syncVault();
  };

  // Bulk Delete
  const bulkDeleteItems = async (ids: string[], permanent: boolean = false) => {
    const idSet = new Set(ids);
    const now = Date.now();

    memoryStore.updateItems((prev) => {
      if (permanent) {
        return {
          ...prev,
          items: prev.items.filter((item) => !idSet.has(item.id)),
          updatedAt: now,
        };
      } else {
        return {
          ...prev,
          items: prev.items.map((item) => (idSet.has(item.id) ? { ...item, trash: true, updatedAt: now } : item)),
          updatedAt: now,
        };
      }
    });

    if (selectedItem && idSet.has(selectedItem.id)) {
      setSelectedItem(null);
    }

    await syncVault();
  };

  // Bulk Move to Folder
  const bulkMoveToFolder = async (ids: string[], folder: string | undefined) => {
    const idSet = new Set(ids);
    const now = Date.now();

    memoryStore.updateItems((prev) => {
      const mergedFolders = folder && !prev.folders.includes(folder) ? [...prev.folders, folder] : prev.folders;
      return {
        ...prev,
        folders: mergedFolders,
        items: prev.items.map((item) => (idSet.has(item.id) ? { ...item, folder, updatedAt: now } : item)),
        updatedAt: now,
      };
    });

    await syncVault();
  };

  // Bulk Toggle Favorite
  const bulkToggleFavorite = async (ids: string[], favorite: boolean) => {
    const idSet = new Set(ids);
    const now = Date.now();

    memoryStore.updateItems((prev) => ({
      ...prev,
      items: prev.items.map((item) => (idSet.has(item.id) ? { ...item, favorite, updatedAt: now } : item)),
      updatedAt: now,
    }));

    await syncVault();
  };

  // Delete All Items
  const deleteAllItems = async () => {
    const now = Date.now();
    memoryStore.updateItems((prev) => ({
      ...prev,
      items: [],
      updatedAt: now,
    }));
    setSelectedItem(null);
    await syncVault();
  };

  // Restore Item
  const restoreItem = async (id: string) => {
    const now = Date.now();
    memoryStore.updateItems((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, trash: false, updatedAt: now } : item)),
      updatedAt: now,
    }));
    await syncVault();
  };

  // Toggle Favorite
  const toggleFavorite = async (id: string) => {
    const now = Date.now();
    memoryStore.updateItems((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, favorite: !item.favorite, updatedAt: now } : item)),
      updatedAt: now,
    }));
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => (prev ? { ...prev, favorite: !prev.favorite } : null));
    }
    await syncVault();
  };

  // Add Folder
  const addFolder = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    memoryStore.updateItems((prev) => {
      if (prev.folders.includes(trimmed)) return prev;
      return {
        ...prev,
        folders: [...prev.folders, trimmed],
        updatedAt: Date.now(),
      };
    });
    await syncVault();
  };

  // Export Encrypted Backup
  const exportEncryptedBackup = async (backupPassword: string): Promise<string> => {
    const vault = memoryStore.getVault();
    if (!vault) throw new Error('No unlocked vault available to backup');
    return createEncryptedBackup(vault, backupPassword);
  };

  // Import Encrypted Backup
  const importEncryptedBackup = async (backupJson: string, backupPassword: string) => {
    const restoredVault = await restoreEncryptedBackup<DecryptedVault>(backupJson, backupPassword);
    if (!restoredVault.items || !Array.isArray(restoredVault.items)) {
      throw new Error('Invalid vault structure in backup');
    }

    const now = Date.now();
    memoryStore.updateItems((prev) => {
      const existingMap = new Map(prev.items.map((i) => [i.id, i]));
      for (const item of restoredVault.items) {
        existingMap.set(item.id, item);
      }
      const mergedFolders = Array.from(new Set([...prev.folders, ...(restoredVault.folders || [])]));
      return {
        ...prev,
        items: Array.from(existingMap.values()),
        folders: mergedFolders,
        updatedAt: now,
      };
    });

    await syncVault();
  };

  return (
    <VaultContext.Provider
      value={{
        items,
        filteredItems,
        folders,
        selectedItem,
        selectedCategory,
        selectedFolder,
        searchQuery,
        isSyncing,
        syncError,
        conflictState,
        setSelectedItem,
        setSelectedCategory,
        setSelectedFolder,
        setSearchQuery,
        addItem,
        importBatch,
        updateItem,
        deleteItem,
        bulkDeleteItems,
        bulkMoveToFolder,
        bulkToggleFavorite,
        deleteAllItems,
        restoreItem,
        toggleFavorite,
        addFolder,
        syncVault,
        resolveConflict,
        exportEncryptedBackup,
        importEncryptedBackup,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
