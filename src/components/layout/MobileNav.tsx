import React from 'react';
import { Home, Sparkles, Settings, Plus } from 'lucide-react';

export interface MobileNavProps {
  activeTab: 'vault' | 'generator' | 'settings';
  onTabChange: (tab: 'vault' | 'generator' | 'settings') => void;
  onOpenNewItem: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onTabChange,
  onOpenNewItem,
}) => {
  return (
    <nav className="sm:hidden h-14 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-around px-2 shrink-0 z-20 select-none">
      <button
        type="button"
        onClick={() => onTabChange('vault')}
        className={`flex flex-col items-center justify-center p-1 text-[10px] font-medium transition-colors ${
          activeTab === 'vault'
            ? 'text-vault-600 dark:text-vault-400 font-bold'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <Home className="w-5 h-5 mb-0.5" />
        <span>Vault</span>
      </button>

      {/* Floating Add button */}
      <button
        type="button"
        onClick={onOpenNewItem}
        className="w-10 h-10 rounded-full bg-vault-600 text-white flex items-center justify-center shadow-lg shadow-vault-600/30 active:scale-95 transition-transform"
        title="New Item"
      >
        <Plus className="w-5 h-5" />
      </button>

      <button
        type="button"
        onClick={() => onTabChange('generator')}
        className={`flex flex-col items-center justify-center p-1 text-[10px] font-medium transition-colors ${
          activeTab === 'generator'
            ? 'text-vault-600 dark:text-vault-400 font-bold'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <Sparkles className="w-5 h-5 mb-0.5" />
        <span>Generator</span>
      </button>

      <button
        type="button"
        onClick={() => onTabChange('settings')}
        className={`flex flex-col items-center justify-center p-1 text-[10px] font-medium transition-colors ${
          activeTab === 'settings'
            ? 'text-vault-600 dark:text-vault-400 font-bold'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
        }`}
      >
        <Settings className="w-5 h-5 mb-0.5" />
        <span>Settings</span>
      </button>
    </nav>
  );
};
