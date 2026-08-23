import React, { useState } from 'react';
import { Lock, LogOut, AlertCircle, ShieldCheck } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { RecoveryModal } from './RecoveryModal';
import { useAuth } from '../../context/AuthContext';

export const UnlockView: React.FC = () => {
  const [masterPassword, setMasterPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

  const { unlock, logout, isLoading, error: authError } = useAuth();

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!masterPassword) {
      setLocalError('Please enter your master password to unlock.');
      return;
    }

    await unlock(masterPassword);
  };

  const activeError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 transition-colors">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-vault-600 text-white shadow-lg shadow-vault-600/25 mb-1">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Surakshit Vault Locked
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter your master password to decrypt your personal vault.
          </p>
        </div>

        {/* Unlock Card */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xl shadow-gray-200/50 dark:shadow-none space-y-6">
          <form onSubmit={handleUnlock} className="space-y-4">
            <Input
              label="Master Password"
              isPassword
              placeholder="Enter master password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              required
              autoFocus
            />

            {activeError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{activeError}</span>
              </div>
            )}

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              type="submit"
              isLoading={isLoading}
              leftIcon={<Lock className="w-4 h-4" />}
            >
              Unlock Vault
            </Button>
          </form>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800 text-xs">
            <button
              type="button"
              onClick={() => setIsRecoveryOpen(true)}
              className="text-vault-600 hover:text-vault-700 dark:text-vault-400 font-medium"
            >
              Recover with 24 words
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-1 text-gray-500 hover:text-red-600 dark:text-gray-400 font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-gray-400">
          <p>Memory state is zeroized until unlocked.</p>
        </div>
      </div>

      <RecoveryModal isOpen={isRecoveryOpen} onClose={() => setIsRecoveryOpen(false)} />
    </div>
  );
};
