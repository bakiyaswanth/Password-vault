import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  Clock,
  Laptop,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  RefreshCw,
  FileCode2,
  ArrowLeft,
  ShieldCheck,
  User,
  Mail,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useVault } from '../../context/VaultContext';
import { apiClient } from '../../api/client';
import type { SessionItem } from '../../types/api';

const ImportModal = lazy(() =>
  import('./ImportModal').then((m) => ({ default: m.ImportModal }))
);
const ExportModal = lazy(() =>
  import('./ExportModal').then((m) => ({ default: m.ExportModal }))
);

export interface SettingsViewProps {
  autoLockMinutes: number;
  onAutoLockChange: (mins: any) => void;
  lockOnBlur: boolean;
  onLockOnBlurChange: (val: boolean) => void;
  onBackToVault: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  autoLockMinutes,
  onAutoLockChange,
  lockOnBlur,
  onLockOnBlurChange,
  onBackToVault,
}) => {
  const { user, logout, addEmail } = useAuth();
  const { items } = useVault();

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Add Email state
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Account Purge state
  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  const hasEmail = Boolean(user?.email && user.email.trim().length > 0);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await apiClient.sessions.list();
      setSessions(data.sessions || []);
    } catch {
      // Graceful error fallback
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevokeSession = async (id: string) => {
    try {
      await apiClient.sessions.revoke(id);
      setSessions(sessions.filter((s) => s.id !== id));
    } catch {
      // Ignored
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
        setEmailError(res.error || 'Failed to add email.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handlePurgeAccount = async () => {
    if (purgeConfirmText !== 'DELETE') return;
    setIsPurging(true);
    try {
      await apiClient.sessions.purgeAccount();
      await logout();
    } catch {
      setIsPurging(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto">
      {/* Top Breadcrumb & Clear Back to Vault Action */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToVault}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors shadow-2xs group"
          >
            <ArrowLeft className="w-4 h-4 text-vault-600 dark:text-vault-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Vault</span>
          </button>
          <span className="text-xs text-gray-400">/</span>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">Settings & Security</span>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Surakshit Zero-Knowledge Encrypted</span>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Security & Settings</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Manage your account profile, email recovery, auto-lock timers, active sessions, and data import/export.
        </p>
      </div>

      {/* 1. Account & Profile Settings Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-vault-100 dark:bg-vault-950 text-vault-600 dark:text-vault-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Account Profile & Identifiers</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage your public username and linked email address.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Username Card */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Username</span>
            <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>{user?.username || 'User'}</span>
              <Badge variant="blue" size="sm">Primary ID</Badge>
            </div>
            <p className="text-[11px] text-gray-400">Your unique public identifier for sign-in.</p>
          </div>

          {/* Email Status Card */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Email Address</span>
            {hasEmail ? (
              <div>
                <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-500" />
                  <span>{user?.email}</span>
                  <Badge variant="green" size="sm">Verified</Badge>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Enables email-based sign in and account alerts.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email: Not added</span>
                  </div>
                  {!isAddingEmail && (
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => setIsAddingEmail(true)}
                    >
                      Add Email
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Notice: Email recovery is unavailable until you add and verify an email address.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Inline Add Email Form */}
        {isAddingEmail && !hasEmail && (
          <form onSubmit={handleSaveEmail} className="p-4 rounded-xl border border-vault-500/40 bg-vault-50/50 dark:bg-vault-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-vault-600" />
                Add and Verify Email Address
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
      </div>

      {/* 2. Auto-Lock Settings */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-vault-100 dark:bg-vault-950 text-vault-600 dark:text-vault-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Auto-Lock Timeout</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Zeroizes in-memory vault state after a period of inactivity.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
          {[
            { label: '1 Minute', value: 1 },
            { label: '5 Minutes (Default)', value: 5 },
            { label: '15 Minutes', value: 15 },
            { label: '30 Minutes', value: 30 },
            { label: 'Never (Risky)', value: 0 },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onAutoLockChange(opt.value)}
              className={`p-3 rounded-xl border text-xs font-semibold transition-all text-center ${
                autoLockMinutes === opt.value
                  ? 'border-vault-600 bg-vault-50 dark:bg-vault-950/40 text-vault-700 dark:text-vault-300 ring-2 ring-vault-600/20'
                  : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2.5 pt-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={lockOnBlur}
            onChange={(e) => onLockOnBlurChange(e.target.checked)}
            className="rounded text-vault-600 focus:ring-vault-500"
          />
          <span className="font-medium">Lock vault immediately when switching tabs or window blur</span>
        </label>
      </div>

      {/* 3. Import & Export Hub */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
            <FileCode2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Import & Export Hub</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Compatible with Bitwarden (JSON & CSV), Proton Pass, 1Password, Chrome, and Surakshit Encrypted formats.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Import Card */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
              <Upload className="w-4 h-4 text-vault-600" />
              <span>Import Credentials</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Instant, atomic import from Bitwarden JSON (default), Bitwarden CSV, Proton Pass, or Chrome CSV with folder preservation.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={() => setIsImportModalOpen(true)}
            >
              Open Import Wizard
            </Button>
          </div>

          {/* Export Card */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Export Vault ({items.filter((i) => !i.trash).length} items)</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Export in Bitwarden JSON, Bitwarden CSV, Proton Pass JSON, or Zero-Knowledge Encrypted format.
            </p>
            <Button
              variant="shield"
              size="sm"
              className="w-full"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={() => setIsExportModalOpen(true)}
            >
              Export Options
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Active Devices & Sessions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Active Sessions</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Devices authorized to access your encrypted vault revisions.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin' : ''}`} />}
            onClick={fetchSessions}
          >
            Refresh
          </Button>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
          {sessions.map((s) => (
            <div key={s.id} className="py-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {s.userAgent || 'Web Client'}
                  </span>
                  {s.isCurrent && (
                    <Badge variant="green" size="sm">
                      Current Device
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-gray-400">
                  Last active: {new Date(s.lastActiveAt).toLocaleString()}
                </span>
              </div>
              {!s.isCurrent && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRevokeSession(s.id)}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5. Danger Zone - Purge Account */}
      <div className="bg-red-50/40 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/50 p-6 space-y-4">
        <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold">Danger Zone</h3>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Permanently destroy your encrypted vault and delete your account from Cloudflare D1.
            </p>
          </div>
        </div>

        <Button
          variant="danger"
          size="sm"
          leftIcon={<Trash2 className="w-4 h-4" />}
          onClick={() => setIsPurgeModalOpen(true)}
        >
          Delete Account & Purge Vault
        </Button>
      </div>

      {/* Lazy Modals */}
      <Suspense fallback={null}>
        {isImportModalOpen && (
          <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
        )}
        {isExportModalOpen && (
          <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} />
        )}
      </Suspense>

      <Modal
        isOpen={isPurgeModalOpen}
        onClose={() => setIsPurgeModalOpen(false)}
        title="Permanently Delete Account?"
        description="This action cannot be undone. All encrypted records, revisions, and sessions in D1 will be immediately destroyed."
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Type <span className="font-mono font-bold text-red-600">DELETE</span> below to confirm permanent destruction of your vault:
          </p>

          <Input
            placeholder="Type DELETE"
            value={purgeConfirmText}
            onChange={(e) => setPurgeConfirmText(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Button variant="secondary" onClick={() => setIsPurgeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={purgeConfirmText !== 'DELETE'}
              isLoading={isPurging}
              onClick={handlePurgeAccount}
            >
              Destroy Vault
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
