import React, { useState, lazy, Suspense } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ItemList } from '../../features/vault/ItemList';
import { ItemDetail } from '../../features/vault/ItemDetail';
import { SettingsView } from '../../features/settings/SettingsView';
import { ResizableDivider } from '../common/ResizableDivider';
import { useVault } from '../../context/VaultContext';
import { useAuth } from '../../context/AuthContext';
import { useAutoLock, type AutoLockTimeout } from '../../hooks/useAutoLock';
import { useResizableSplit } from '../../hooks/useResizableSplit';
import type { VaultItem } from '../../types/vault';

// Lazy-loaded modal components for instant initial startup
const ItemEditor = lazy(() =>
  import('../../features/vault/ItemEditor').then((m) => ({ default: m.ItemEditor }))
);
const PasswordGeneratorModal = lazy(() =>
  import('../../features/generator/PasswordGeneratorModal').then((m) => ({
    default: m.PasswordGeneratorModal,
  }))
);
const UserDashboardModal = lazy(() =>
  import('../../features/dashboard/UserDashboardModal').then((m) => ({
    default: m.UserDashboardModal,
  }))
);
const DeleteAllModal = lazy(() =>
  import('../../features/vault/DeleteAllModal').then((m) => ({ default: m.DeleteAllModal }))
);
const ImportModal = lazy(() =>
  import('../../features/settings/ImportModal').then((m) => ({ default: m.ImportModal }))
);
const ExportModal = lazy(() =>
  import('../../features/settings/ExportModal').then((m) => ({ default: m.ExportModal }))
);
const ConflictModal = lazy(() =>
  import('../../features/sync/ConflictModal').then((m) => ({ default: m.ConflictModal }))
);
const RecoveryPhraseModal = lazy(() =>
  import('../../features/auth/RecoveryPhraseModal').then((m) => ({
    default: m.RecoveryPhraseModal,
  }))
);

export const AppLayout: React.FC = () => {
  const { lock, recoveryPhraseCreated, clearRecoveryPhraseModal } = useAuth();
  const {
    items,
    filteredItems,
    selectedItem,
    setSelectedItem,
    selectedCategory,
    setSelectedCategory,
    selectedFolder,
    setSelectedFolder,
    searchQuery,
    setSearchQuery,
    addItem,
    updateItem,
    deleteItem,
    deleteAllItems,
    restoreItem,
    toggleFavorite,
    folders,
  } = useVault();

  // Settings & Auto-lock configuration
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockTimeout>(5);
  const [lockOnBlur, setLockOnBlur] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return (
      window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  });

  // Resizable split-panel hook for list and detail view
  const {
    listWidth,
    isDragging,
    isMaximized,
    containerRef,
    handleMouseDown,
    handleToggleMaximize,
  } = useResizableSplit({
    minWidth: 240,
    maxWidth: 620,
    minDetailWidth: 350,
    defaultWidth: 340,
  });

  // Navigation states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'vault' | 'generator' | 'settings'>('vault');

  // Auto-lock hook
  useAutoLock(autoLockMinutes, lockOnBlur, lock);

  // Dark mode effect
  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleOpenNewItem = () => {
    setEditingItem(null);
    setIsEditorOpen(true);
  };

  const handleEditItem = (item: VaultItem) => {
    setEditingItem(item);
    setIsEditorOpen(true);
  };

  const handleSaveItem = async (itemData: any) => {
    if (editingItem) {
      await updateItem(itemData);
    } else {
      await addItem(itemData);
    }
  };

  const handleReturnToVault = () => {
    setIsSettingsOpen(false);
    setMobileTab('vault');
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans select-none">
      {/* Top Application Header */}
      <Header
        onOpenGenerator={() => setIsGeneratorOpen(true)}
        onOpenNewItem={handleOpenNewItem}
        onOpenSettings={() => {
          setIsSettingsOpen(!isSettingsOpen);
          setMobileTab(isSettingsOpen ? 'vault' : 'settings');
        }}
        onOpenDashboard={() => setIsDashboardOpen(true)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        isSettingsOpen={isSettingsOpen}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Left Sidebar — Always persistent for instant navigation */}
        <div className="hidden md:block">
          <Sidebar
            activeCategory={selectedCategory}
            activeFolder={selectedFolder}
            isSettingsActive={isSettingsOpen}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              handleReturnToVault();
            }}
            onSelectFolder={(folder) => {
              setSelectedFolder(folder);
              handleReturnToVault();
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenDashboard={() => setIsDashboardOpen(true)}
          />
        </div>

        {/* Dynamic Center/Right Content Area */}
        {isSettingsOpen || mobileTab === 'settings' ? (
          <div className="flex-1 overflow-hidden">
            <SettingsView
              autoLockMinutes={autoLockMinutes}
              onAutoLockChange={setAutoLockMinutes}
              lockOnBlur={lockOnBlur}
              onLockOnBlurChange={setLockOnBlur}
              onBackToVault={handleReturnToVault}
            />
          </div>
        ) : (
          <div ref={containerRef} className="flex-1 flex overflow-hidden">
            {/* Item List Column with Multi-Select & Resizable Split Width */}
            <div
              style={{
                width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${listWidth}px` : undefined,
              }}
              className={`w-full md:shrink-0 h-full ${
                selectedItem ? 'hidden md:block' : 'block'
              }`}
            >
              <ItemList
                items={filteredItems}
                selectedItem={selectedItem}
                onSelectItem={(item) => setSelectedItem(item)}
                onAddNewItem={handleOpenNewItem}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                activeCategory={selectedFolder || selectedCategory}
              />
            </div>

            {/* Resizable Divider Slider */}
            <ResizableDivider
              onMouseDown={handleMouseDown}
              onDoubleClick={handleToggleMaximize}
              isDragging={isDragging}
              isMaximized={isMaximized}
              onToggleMaximize={handleToggleMaximize}
            />

            {/* Item Detail Column */}
            <div
              className={`flex-1 h-full overflow-hidden ${
                !selectedItem ? 'hidden md:block' : 'block'
              }`}
            >
              <ItemDetail
                item={selectedItem}
                onEdit={handleEditItem}
                onDelete={deleteItem}
                onRestore={restoreItem}
                onToggleFavorite={toggleFavorite}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeTab={mobileTab}
        onTabChange={(tab) => {
          setMobileTab(tab);
          if (tab === 'settings') setIsSettingsOpen(true);
          else if (tab === 'generator') setIsGeneratorOpen(true);
          else setIsSettingsOpen(false);
        }}
        onOpenNewItem={handleOpenNewItem}
      />

      {/* Lazy-Loaded Modals wrapped in lightweight Suspense */}
      <Suspense fallback={null}>
        {isEditorOpen && (
          <ItemEditor
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            onSave={handleSaveItem}
            initialItem={editingItem}
            folders={folders}
          />
        )}

        {(isGeneratorOpen || mobileTab === 'generator') && (
          <PasswordGeneratorModal
            isOpen={isGeneratorOpen || mobileTab === 'generator'}
            onClose={() => {
              setIsGeneratorOpen(false);
              if (mobileTab === 'generator') setMobileTab('vault');
            }}
          />
        )}

        {isDashboardOpen && (
          <UserDashboardModal
            isOpen={isDashboardOpen}
            onClose={() => setIsDashboardOpen(false)}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenExport={() => setIsExportOpen(true)}
            onOpenDeleteAll={() => setIsDeleteAllOpen(true)}
          />
        )}

        {isDeleteAllOpen && (
          <DeleteAllModal
            isOpen={isDeleteAllOpen}
            onClose={() => setIsDeleteAllOpen(false)}
            totalItemsCount={items.length}
            onConfirmDeleteAll={deleteAllItems}
          />
        )}

        {isImportOpen && (
          <ImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
        )}

        {isExportOpen && (
          <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />
        )}

        <ConflictModal />

        {recoveryPhraseCreated && (
          <RecoveryPhraseModal
            phrase={recoveryPhraseCreated}
            isOpen={true}
            onClose={clearRecoveryPhraseModal}
          />
        )}
      </Suspense>
    </div>
  );
};
