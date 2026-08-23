import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  Sun,
  Moon,
  CloudAlert,
  Loader2,
  Settings,
  Plus,
  User,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';

export interface HeaderProps {
  onOpenGenerator: () => void;
  onOpenNewItem: () => void;
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isSettingsOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenGenerator,
  onOpenNewItem,
  onOpenSettings,
  onOpenDashboard,
  isDarkMode,
  onToggleDarkMode,
  isSettingsOpen,
}) => {
  const { user, lock, logout } = useAuth();
  const { isSyncing, syncError } = useVault();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const displayUsername = user?.username || (user?.email ? user.email.split('@')[0] : 'Surakshit User');

  return (
    <header className="h-14 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 flex items-center justify-between shrink-0 z-20">
      {/* Brand & Sync Status */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-vault-600 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm tracking-tight text-gray-900 dark:text-white hidden sm:inline">
            Surakshit Vault
          </span>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300">
          {isSyncing ? (
            <>
              <Loader2 className="w-3 h-3 text-vault-600 animate-spin" />
              <span className="hidden md:inline">Syncing...</span>
            </>
          ) : syncError ? (
            <>
              <CloudAlert className="w-3 h-3 text-red-500" />
              <span className="text-red-500 hidden md:inline">Sync Error</span>
            </>
          ) : (
            <>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="hidden md:inline">Zero-Knowledge Synced</span>
            </>
          )}
        </div>
      </div>

      {/* Quick Actions & Profile Menu */}
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={onOpenNewItem}
          className="hidden sm:inline-flex"
        >
          New Item
        </Button>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Sparkles className="w-3.5 h-3.5 text-vault-600" />}
          onClick={onOpenGenerator}
          title="Password Generator"
        >
          <span className="hidden md:inline">Generator</span>
        </Button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400 transition-colors"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className={`p-2 rounded-lg transition-colors ${
            isSettingsOpen
              ? 'bg-vault-100 text-vault-700 dark:bg-vault-950 dark:text-vault-300'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-400'
          }`}
          title="Security & Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Lock Vault button */}
        <Button
          variant="shield"
          size="sm"
          leftIcon={<Lock className="w-3.5 h-3.5" />}
          onClick={lock}
          title="Lock Vault & Zeroize Memory"
        >
          Lock
        </Button>

        {/* Profile Avatar / User Dashboard Dropdown */}
        <div className="relative ml-1">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="w-8 h-8 rounded-full bg-vault-100 dark:bg-vault-950 border border-vault-300 dark:border-vault-800 flex items-center justify-center text-vault-700 dark:text-vault-300 hover:ring-2 hover:ring-vault-500 transition-all"
            title="Account & Dashboard"
          >
            <User className="w-4 h-4" />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl py-2 z-30 text-xs animate-fade-in divide-y divide-gray-100 dark:divide-gray-800">
              <div className="px-3.5 py-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Signed in as</span>
                <span className="font-semibold text-gray-900 dark:text-white truncate block text-[12px] mt-0.5">
                  {displayUsername}
                </span>
                {user?.email && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate block mt-0.5">
                    {user.email}
                  </span>
                )}
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenDashboard();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 font-medium text-gray-700 dark:text-gray-200"
                >
                  <LayoutDashboard className="w-4 h-4 text-vault-600" />
                  <span>Account Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2.5 font-medium text-gray-700 dark:text-gray-200"
                >
                  <Settings className="w-4 h-4 text-gray-500" />
                  <span>Security & Settings</span>
                </button>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2.5 font-semibold text-red-600 dark:text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
