import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Key,
  FileText,
  CreditCard,
  User,
  Star,
  Plus,
  Shield,
  X,
  CheckSquare,
  Square,
  Trash2,
  Folder,
  Check,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { BulkDeleteModal } from './BulkDeleteModal';
import { useVault } from '../../context/VaultContext';
import { perfTracker } from '../../utils/performance';
import { groupByRecency } from '../../utils/recency-groups';
import type { VaultItem } from '../../types/vault';

export interface ItemListProps {
  items: VaultItem[];
  selectedItem: VaultItem | null;
  onSelectItem: (item: VaultItem) => void;
  onAddNewItem: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeCategory: string;
}

// 1. High-Performance Memoized Row Component
const ItemRow = React.memo(
  ({
    item,
    isSelected,
    isChecked,
    onSelect,
    onToggleCheck,
    hasActiveSelection,
  }: {
    item: VaultItem;
    isSelected: boolean;
    isChecked: boolean;
    onSelect: (item: VaultItem) => void;
    onToggleCheck: (e: React.MouseEvent, id: string) => void;
    hasActiveSelection: boolean;
  }) => {
    const getItemIcon = (type: VaultItem['type']) => {
      switch (type) {
        case 'login':
          return <Key className="w-4 h-4 text-vault-600 dark:text-vault-400" />;
        case 'note':
          return <FileText className="w-4 h-4 text-amber-500" />;
        case 'card':
          return <CreditCard className="w-4 h-4 text-emerald-500" />;
        case 'identity':
          return <User className="w-4 h-4 text-purple-500" />;
        default:
          return <Shield className="w-4 h-4 text-gray-500" />;
      }
    };

    const getSubtitle = (itm: VaultItem) => {
      switch (itm.type) {
        case 'login':
          return itm.username || (itm.urls?.[0] ? itm.urls[0] : 'Login credentials');
        case 'note':
          return itm.content.slice(0, 35) + (itm.content.length > 35 ? '...' : '');
        case 'card':
          return `•••• ${itm.cardNumber.slice(-4)}`;
        case 'identity':
          return `${itm.firstName} ${itm.lastName}`;
        default:
          return 'Custom item';
      }
    };

    return (
      <div
        onClick={() => {
          perfTracker.startMeasure('item_selection_latency');
          onSelect(item);
          perfTracker.endMeasure('item_selection_latency');
        }}
        className={`w-full text-left p-3.5 transition-all flex items-start gap-3 cursor-pointer group ${
          isSelected
            ? 'bg-vault-50 dark:bg-vault-950/80 border-l-4 border-l-vault-600 dark:border-l-vault-400'
            : 'hover:bg-white dark:hover:bg-gray-800 border-l-4 border-l-transparent'
        }`}
      >
        {/* Selection Checkbox (Proton Pass & Bitwarden style) */}
        <button
          type="button"
          onClick={(e) => onToggleCheck(e, item.id)}
          className={`mt-1 p-0.5 rounded text-gray-400 hover:text-vault-600 dark:hover:text-vault-400 transition-colors ${
            isChecked || hasActiveSelection
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
          title={isChecked ? 'Deselect' : 'Select'}
        >
          {isChecked ? (
            <div className="w-4 h-4 rounded bg-vault-600 text-white flex items-center justify-center shadow-2xs">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
          ) : (
            <div className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800" />
          )}
        </button>

        {/* Item Icon */}
        <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
          {getItemIcon(item.type)}
        </div>

        {/* Item Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="font-semibold text-xs text-gray-900 dark:text-gray-100 truncate">
              {item.name}
            </span>
            {item.favorite && (
              <Star className="w-3 h-3 fill-amber-500 text-amber-500 shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5 font-mono">
            {getSubtitle(item)}
          </p>
        </div>
      </div>
    );
  }
);

ItemRow.displayName = 'ItemRow';

export const ItemList: React.FC<ItemListProps> = ({
  items,
  selectedItem,
  onSelectItem,
  onAddNewItem,
  searchQuery,
  onSearchChange,
  activeCategory,
}) => {
  const { bulkDeleteItems, bulkMoveToFolder, bulkToggleFavorite, folders } = useVault();

  // Multi-selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isMoveFolderDropdownOpen, setIsMoveFolderDropdownOpen] = useState(false);

  // All / Recent tabs (Proton Pass style). Search results are always relevance-ranked, so tabs hide while searching.
  const [viewMode, setViewMode] = useState<'all' | 'recent'>('all');
  const showTabs = !searchQuery.trim() && activeCategory !== 'trash';
  const isRecentView = showTabs && viewMode === 'recent';

  // Freeze last-used times when the Recent tab opens so opening an item doesn't jump it to the top mid-browse.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const recentSnapshot = useMemo(() => {
    const snap = new Map<string, number | undefined>();
    if (isRecentView) for (const i of itemsRef.current) snap.set(i.id, i.lastUsedAt);
    return snap;
  }, [isRecentView]);

  const recentGroups = useMemo(
    () =>
      isRecentView
        ? groupByRecency(items, Date.now(), (i) => (recentSnapshot.has(i.id) ? recentSnapshot.get(i.id) : i.lastUsedAt))
        : [],
    [isRecentView, items, recentSnapshot]
  );
  const visibleItems = useMemo(
    () => (isRecentView ? recentGroups.flatMap((g) => g.items) : items),
    [isRecentView, recentGroups, items]
  );

  const isAllSelected = visibleItems.length > 0 && visibleItems.every((i) => selectedIds.has(i.id));
  const isPartiallySelected = selectedIds.size > 0 && !isAllSelected;

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleItems.map((i) => i.id)));
    }
  }, [isAllSelected, visibleItems]);

  const handleToggleItemCheckbox = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleBulkMove = async (targetFolder: string | undefined) => {
    await bulkMoveToFolder(Array.from(selectedIds), targetFolder);
    setIsMoveFolderDropdownOpen(false);
    setSelectedIds(new Set());
  };

  const handleBulkFavorite = async (fav: boolean) => {
    await bulkToggleFavorite(Array.from(selectedIds), fav);
    setSelectedIds(new Set());
  };

  const handleBulkDeleteConfirm = async (permanent: boolean) => {
    await bulkDeleteItems(Array.from(selectedIds), permanent);
    setSelectedIds(new Set());
  };

  const selectedItemsList = useMemo(
    () => items.filter((i) => selectedIds.has(i.id)),
    [items, selectedIds]
  );

  return (
    <div className="h-full flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 relative">
      {/* Search & Header */}
      <div className="p-3.5 border-b border-gray-200 dark:border-gray-800 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search decrypted vault..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-vault-500"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={onAddNewItem}
            className="p-2 rounded-lg bg-vault-600 text-white hover:bg-vault-700 dark:bg-vault-500 shadow-sm transition-all shrink-0"
            title="Add New Item"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showTabs && (
          <div className="flex items-center gap-1.5" role="tablist">
            {(['all', 'recent'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  viewMode === mode
                    ? 'bg-vault-600 text-white dark:bg-vault-500'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {mode === 'all' ? `All (${items.length})` : 'Recent'}
              </button>
            ))}
          </div>
        )}

        {/* Selection Bar / Category Filter Header */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 px-0.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-200 transition-colors font-medium"
              title={isAllSelected ? 'Deselect All' : 'Select All in View'}
            >
              {isAllSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-vault-600 dark:text-vault-400" />
              ) : isPartiallySelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-gray-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span className="capitalize font-semibold">{activeCategory}</span>
            </button>
            <span className="font-mono">({visibleItems.length})</span>
          </div>

          {selectedIds.size > 0 && (
            <span className="text-vault-600 dark:text-vault-400 font-semibold font-mono">
              {selectedIds.size} selected
            </span>
          )}
        </div>
      </div>

      {/* Floating/Sticky Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="p-2.5 bg-vault-600 text-white flex items-center justify-between text-xs shadow-md z-10 animate-fade-in shrink-0">
          <div className="flex items-center gap-2 font-semibold font-mono">
            <span>{selectedIds.size} selected</span>
          </div>

          <div className="flex items-center gap-1">
            {/* Move to Folder */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMoveFolderDropdownOpen(!isMoveFolderDropdownOpen)}
                className="p-1.5 rounded-lg bg-vault-700/70 hover:bg-vault-700 text-white transition-colors"
                title="Move selected to folder"
              >
                <Folder className="w-3.5 h-3.5" />
              </button>

              {isMoveFolderDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl py-1 z-30 text-xs text-gray-900 dark:text-gray-100">
                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-gray-400">
                    Move to Folder:
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBulkMove(undefined)}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
                  >
                    (No Folder)
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => handleBulkMove(f)}
                      className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1.5 truncate"
                    >
                      <Folder className="w-3 h-3 text-vault-600 shrink-0" />
                      <span className="truncate">{f}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Favorite toggle */}
            <button
              type="button"
              onClick={() => handleBulkFavorite(true)}
              className="p-1.5 rounded-lg bg-vault-700/70 hover:bg-vault-700 text-white transition-colors"
              title="Add selected to favorites"
            >
              <Star className="w-3.5 h-3.5" />
            </button>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)}
              className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Delete selected items"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Deselect All */}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 rounded-lg bg-vault-700/70 hover:bg-vault-700 text-white transition-colors"
              title="Deselect All"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* High-Performance Items Scrollable List with Row-Level Memoization */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60 will-change-scroll">
        {isRecentView ? (
          recentGroups.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              <p>No recently used items yet.</p>
              <p className="mt-1">Items you open or copy from will appear here.</p>
            </div>
          ) : (
            recentGroups.map((group) => (
              <section key={group.label}>
                <h3 className="sticky top-0 z-[1] px-3.5 pt-3 pb-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm">
                  {group.label}
                </h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {group.items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      isSelected={selectedItem?.id === item.id}
                      isChecked={selectedIds.has(item.id)}
                      onSelect={onSelectItem}
                      onToggleCheck={handleToggleItemCheckbox}
                      hasActiveSelection={selectedIds.size > 0}
                    />
                  ))}
                </div>
              </section>
            ))
          )
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 space-y-3">
            <p>No items found.</p>
            {activeCategory !== 'trash' && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={onAddNewItem}
              >
                Create First Item
              </Button>
            )}
          </div>
        ) : (
          items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              isSelected={selectedItem?.id === item.id}
              isChecked={selectedIds.has(item.id)}
              onSelect={onSelectItem}
              onToggleCheck={handleToggleItemCheckbox}
              hasActiveSelection={selectedIds.size > 0}
            />
          ))
        )}
      </div>

      {/* Bulk Delete Modal */}
      <BulkDeleteModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        selectedItems={selectedItemsList}
        onConfirmDelete={handleBulkDeleteConfirm}
        isTrashView={activeCategory === 'trash'}
      />
    </div>
  );
};
