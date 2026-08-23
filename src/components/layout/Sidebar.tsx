import React, { useState } from 'react';
import {
  Home,
  Key,
  FileText,
  CreditCard,
  User,
  Star,
  Trash2,
  Folder,
  Plus,
  Settings,
  LayoutDashboard,
} from 'lucide-react';
import { useVault } from '../../context/VaultContext';

export interface SidebarProps {
  onSelectCategory: (category: string) => void;
  onSelectFolder: (folder: string | null) => void;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
  activeCategory: string;
  activeFolder: string | null;
  isSettingsActive: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectCategory,
  onSelectFolder,
  onOpenSettings,
  onOpenDashboard,
  activeCategory,
  activeFolder,
  isSettingsActive,
}) => {
  const { items, folders, addFolder } = useVault();
  const [newFolderName, setNewFolderName] = useState('');
  const [isAddingFolder, setIsAddingFolder] = useState(false);

  const activeItems = items.filter((i) => !i.trash);
  const trashCount = items.filter((i) => i.trash).length;

  const categories = [
    {
      id: 'all',
      label: 'Home / All Items',
      icon: <Home className="w-4 h-4 text-vault-600 dark:text-vault-400" />,
      count: activeItems.length,
    },
    {
      id: 'favorites',
      label: 'Favorites',
      icon: <Star className="w-4 h-4 text-amber-500" />,
      count: activeItems.filter((i) => i.favorite).length,
    },
    {
      id: 'logins',
      label: 'Logins',
      icon: <Key className="w-4 h-4 text-vault-600 dark:text-vault-400" />,
      count: activeItems.filter((i) => i.type === 'login').length,
    },
    {
      id: 'notes',
      label: 'Secure Notes',
      icon: <FileText className="w-4 h-4 text-amber-500" />,
      count: activeItems.filter((i) => i.type === 'note').length,
    },
    {
      id: 'cards',
      label: 'Credit Cards',
      icon: <CreditCard className="w-4 h-4 text-emerald-500" />,
      count: activeItems.filter((i) => i.type === 'card').length,
    },
    {
      id: 'identities',
      label: 'Identities',
      icon: <User className="w-4 h-4 text-purple-500" />,
      count: activeItems.filter((i) => i.type === 'identity').length,
    },
    {
      id: 'trash',
      label: 'Trash',
      icon: <Trash2 className="w-4 h-4 text-gray-400" />,
      count: trashCount,
    },
  ];

  const handleAddFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFolderName.trim()) {
      await addFolder(newFolderName.trim());
      setNewFolderName('');
      setIsAddingFolder(false);
    }
  };

  return (
    <aside className="w-60 h-full border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col shrink-0 select-none justify-between">
      {/* Categories Navigation */}
      <div className="p-3 space-y-1 overflow-y-auto flex-1">
        <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-1.5 block">
          Vault Navigation
        </span>

        {categories.map((cat) => {
          const isActive = !isSettingsActive && activeCategory === cat.id && !activeFolder;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                onSelectFolder(null);
                onSelectCategory(cat.id);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-vault-50 text-vault-700 dark:bg-vault-950/50 dark:text-vault-300 font-bold shadow-2xs'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {cat.icon}
                <span>{cat.label}</span>
              </div>
              <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                {cat.count}
              </span>
            </button>
          );
        })}

        {/* Folders Section */}
        <div className="pt-4 space-y-1">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Folders
            </span>
            <button
              type="button"
              onClick={() => setIsAddingFolder(!isAddingFolder)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded"
              title="Add Folder"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {isAddingFolder && (
            <form onSubmit={handleAddFolderSubmit} className="px-2 py-1">
              <input
                type="text"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-vault-500 text-gray-900 dark:text-gray-100"
                autoFocus
              />
            </form>
          )}

          {folders.map((f) => {
            const isFolderActive = !isSettingsActive && activeFolder === f;
            const count = activeItems.filter((i) => i.folder === f).length;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  onSelectCategory('folder');
                  onSelectFolder(f);
                }}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isFolderActive
                    ? 'bg-vault-50 text-vault-700 dark:bg-vault-950/50 dark:text-vault-300 font-bold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Folder className="w-3.5 h-3.5 text-vault-600 dark:text-vault-400 shrink-0" />
                  <span className="truncate">{f}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Preferences & Account Navigation */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1 bg-gray-50/50 dark:bg-gray-950/30">
        <button
          type="button"
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            isSettingsActive
              ? 'bg-vault-50 text-vault-700 dark:bg-vault-950/50 dark:text-vault-300 font-bold shadow-2xs'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Settings className="w-4 h-4 text-gray-500" />
          <span>Settings & Security</span>
        </button>

        <button
          type="button"
          onClick={onOpenDashboard}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-all"
        >
          <LayoutDashboard className="w-4 h-4 text-vault-600" />
          <span>Account Dashboard</span>
        </button>
      </div>
    </aside>
  );
};
