import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Key,
  FileText,
  CreditCard,
  Folder,
  LogOut,
  Upload,
  Download,
  Mail,
  Lock,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';

export interface UserDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenImport: () => void;
  onOpenExport: () => void;
  onOpenDeleteAll: () => void;
}

export const UserDashboardModal: React.FC<UserDashboardModalProps> = ({
  isOpen,
  onClose,
  onOpenImport,
  onOpenExport,
  onOpenDeleteAll,
}) => {
  const { user, logout, addEmail } = useAuth();
  const { items = [], folders = [] } = useVault();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Adding email later state
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const safeItems = Array.isArray(items) ? items : [];
  const safeFolders = Array.isArray(folders) ? folders : [];

  const activeItems = safeItems.filter((i) => !i.trash);
  const loginsCount = activeItems.filter((i) => i.type === 'login').length;
  const notesCount = activeItems.filter((i) => i.type === 'note').length;
  const cardsCount = activeItems.filter((i) => i.type === 'card').length;
  const identitiesCount = activeItems.filter((i) => i.type === 'identity').length;
  const trashCount = safeItems.filter((i) => i.trash).length;

  const displayUsername = user?.username || 'Surakshit User';
  const hasEmail = Boolean(user?.email && user.email.trim().length > 0);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const trimmed = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailLoading(true);
    try {
      const res = await addEmail(trimmed);
      if (res.success) {
        setIsAddingEmail(false);
        setEmailInput('');
      } else {
        setEmailError(res.error || 'Failed to add email address.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Account & Performance Dashboard"
      description="Overview of your zero-knowledge profile and vault metrics."
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* 1. User Profile Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-vault-900 to-vault-950 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-13 h-13 rounded-2xl bg-vault-700/60 border border-vault-500/30 flex items-center justify-center text-vault-200 shrink-0">
              <User className="w-7 h-7" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-bold text-lg text-white truncate">{displayUsername}</span>
                <Badge variant="green" size="sm">
                  Active Session
                </Badge>
              </div>

              {/* Email Status */}
              <div className="flex items-center gap-2 text-xs sm:text-sm text-vault-300 flex-wrap">
                <Mail className="w-4 h-4 text-vault-400 shrink-0" />
                {hasEmail ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{user?.email}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-vault-400 italic">Email: Not added</span>
                    {!isAddingEmail && (
                      <button
                        type="button"
                        onClick={() => setIsAddingEmail(true)}
                        className="text-xs font-semibold text-vault-200 hover:text-white bg-vault-800/90 hover:bg-vault-700 px-2.5 py-1 rounded-lg border border-vault-600/40 transition-colors shrink-0 shadow-2xs"
                      >
                        + Add Email
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            isLoading={isLoggingOut}
            onClick={handleLogout}
            leftIcon={<LogOut className="w-4 h-4" />}
            className="shrink-0"
          >
            Log Out
          </Button>
        </div>

        {/* Inline Add Email Form if opened */}
        {isAddingEmail && !hasEmail && (
          <form onSubmit={handleSaveEmail} className="p-4 rounded-xl border border-vault-500/40 bg-vault-50/50 dark:bg-vault-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-vault-600" />
                Add Email Address to Account
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingEmail(false);
                  setEmailError(null);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Adding an email allows signing in with your email address in addition to your username.
            </p>

            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" variant="primary" size="sm" isLoading={emailLoading}>
                Save Email
              </Button>
            </div>

            {emailError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{emailError}</span>
              </div>
            )}
          </form>
        )}

        {/* 2. Vault Statistics Section */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
            Vault Statistics ({activeItems.length} Total Items, {safeFolders.length} Folders)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Logins Card */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-between gap-2 min-w-0 transition-all hover:bg-gray-100/60 dark:hover:bg-gray-800/60">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                  Logins
                </span>
                <div className="p-1.5 rounded-lg bg-vault-100 dark:bg-vault-950/60 text-vault-600 dark:text-vault-400 shrink-0">
                  <Key className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                {loginsCount}
              </span>
            </div>

            {/* Notes Card */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-between gap-2 min-w-0 transition-all hover:bg-gray-100/60 dark:hover:bg-gray-800/60">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                  Notes
                </span>
                <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                {notesCount}
              </span>
            </div>

            {/* Cards Card */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-between gap-2 min-w-0 transition-all hover:bg-gray-100/60 dark:hover:bg-gray-800/60">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                  Cards
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                {cardsCount}
              </span>
            </div>

            {/* Identities Card */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-between gap-2 min-w-0 transition-all hover:bg-gray-100/60 dark:hover:bg-gray-800/60">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                  Identities
                </span>
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                {identitiesCount}
              </span>
            </div>

            {/* Folders Card */}
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 flex flex-col justify-between gap-2 min-w-0 col-span-2 sm:col-span-1 transition-all hover:bg-gray-100/60 dark:hover:bg-gray-800/60">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 truncate">
                  Folders
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <Folder className="w-4 h-4" />
                </div>
              </div>
              <span className="text-xl font-bold font-mono text-gray-900 dark:text-white">
                {safeFolders.length}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Simplified Security Summary */}
        <div className="p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
            <span>Zero-Knowledge Protection</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Your vault data is encrypted locally on your device before synchronization. Your master password and encryption keys are never stored in plaintext on our servers.
          </p>
          <div className="pt-1 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-5 gap-y-1.5">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-vault-600" />
              AES-256-GCM encryption
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-vault-600" />
              Argon2id key derivation
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-vault-600" />
              Zero-knowledge architecture
            </span>
          </div>
        </div>

        {/* 4. Vault Utilities */}
        <div className="p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-3">
          <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 block">
            Vault Utilities
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => {
                onClose();
                onOpenImport();
              }}
            >
              Import Data
            </Button>

            <Button
              variant="secondary"
              size="md"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => {
                onClose();
                onOpenExport();
              }}
            >
              Export Vault
            </Button>

            <Button
              variant="danger"
              size="md"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={() => {
                onClose();
                onOpenDeleteAll();
              }}
            >
              Wipe Vault Items
            </Button>
          </div>
        </div>

        {/* 5. Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800 text-xs sm:text-sm text-gray-400">
          <span>{trashCount} items in Trash</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close Dashboard
          </Button>
        </div>
      </div>
    </Modal>
  );
};
