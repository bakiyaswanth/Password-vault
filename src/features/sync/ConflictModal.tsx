import React from 'react';
import { AlertCircle, GitMerge, Download, Upload } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { useVault } from '../../context/VaultContext';

export const ConflictModal: React.FC = () => {
  const { conflictState, resolveConflict } = useVault();

  if (!conflictState?.hasConflict) return null;

  return (
    <Modal
      isOpen={conflictState.hasConflict}
      onClose={() => {}} // Block dismissal without choice
      title="Synchronization Conflict Detected"
      description="Another device or browser session updated your encrypted vault while you were editing."
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>
            Because AegisVault is zero-knowledge, the server cannot automatically merge encrypted data without seeing your plaintext. Please select how you want your client to resolve this conflict.
          </span>
        </div>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => resolveConflict('merge')}
            className="w-full text-left p-3.5 rounded-xl border border-vault-300 dark:border-vault-700 bg-vault-50/50 dark:bg-vault-950/40 hover:bg-vault-100/60 dark:hover:bg-vault-900/50 transition-all flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-vault-600 text-white shrink-0">
              <GitMerge className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                Smart Merge (Recommended)
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Combines both vaults client-side, preserving the newest version of each item.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => resolveConflict('local')}
            className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 shrink-0">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">
                Keep This Device's Changes
              </span>
              <span className="text-[11px] text-gray-400">
                Overwrites remote changes with this device's current vault.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => resolveConflict('remote')}
            className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all flex items-center gap-3"
          >
            <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 shrink-0">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block">
                Use Remote Version
              </span>
              <span className="text-[11px] text-gray-400">
                Discards local changes and reloads the remote revision.
              </span>
            </div>
          </button>
        </div>
      </div>
    </Modal>
  );
};
