import React, { useState } from 'react';
import { Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  exportBitwardenJson,
  exportBitwardenCsv,
  exportProtonPassJson,
  type ImportExportFormat,
} from '../../utils/importers';
import { useVault } from '../../context/VaultContext';
import { memoryStore } from '../../storage/memory-store';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { exportEncryptedBackup, items } = useVault();
  const [selectedFormat, setSelectedFormat] = useState<ImportExportFormat>('bitwarden-json');
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSuccess(false);

    const vault = memoryStore.getVault();
    if (!vault) {
      setError('No decrypted vault loaded');
      return;
    }

    setIsExporting(true);
    try {
      let content = '';
      let filename = `surakshit-vault-export-${new Date().toISOString().slice(0, 10)}`;
      let mimeType = 'application/json';

      if (selectedFormat === 'surakshit-encrypted') {
        if (backupPassword.length < 8) {
          setError('Backup password must be at least 8 characters.');
          setIsExporting(false);
          return;
        }
        if (backupPassword !== confirmPassword) {
          setError('Passwords do not match.');
          setIsExporting(false);
          return;
        }
        content = await exportEncryptedBackup(backupPassword);
        filename += '.surakshit';
      } else if (selectedFormat === 'bitwarden-json') {
        content = exportBitwardenJson(vault);
        filename += '-bitwarden.json';
      } else if (selectedFormat === 'bitwarden-csv') {
        content = exportBitwardenCsv(vault);
        filename += '-bitwarden.csv';
        mimeType = 'text/csv';
      } else if (selectedFormat === 'protonpass-json') {
        content = exportProtonPassJson(vault);
        filename += '-protonpass.json';
      }

      // Trigger file download in browser
      const blob = new Blob([content], { type: mimeType });
      const element = document.createElement('a');
      element.href = URL.createObjectURL(blob);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      setIsSuccess(true);
      setBackupPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setIsSuccess(false);
        setError(null);
        onClose();
      }}
      title="Export Surakshit Vault"
      description="Export your items in Bitwarden, Proton Pass, or Zero-Knowledge Encrypted format."
      maxWidth="md"
    >
      <form onSubmit={handleExport} className="space-y-4">
        {/* Format Selector */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Export Format
          </label>
          <select
            value={selectedFormat}
            onChange={(e) => {
              setSelectedFormat(e.target.value as ImportExportFormat);
              setError(null);
              setIsSuccess(false);
            }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-vault-500"
          >
            <option value="bitwarden-json">Bitwarden (JSON) — Standard</option>
            <option value="bitwarden-csv">Bitwarden (CSV)</option>
            <option value="protonpass-json">Proton Pass (JSON)</option>
            <option value="surakshit-encrypted">Surakshit Vault Encrypted (.surakshit) — Zero-Knowledge</option>
          </select>
        </div>

        {/* Warning if unencrypted format selected */}
        {selectedFormat !== 'surakshit-encrypted' && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Warning: Unencrypted JSON/CSV exports contain plaintext credentials. Ensure you store this file securely or delete it after importing into another manager.
            </span>
          </div>
        )}

        {/* Password inputs if encrypted format */}
        {selectedFormat === 'surakshit-encrypted' && (
          <div className="space-y-3 pt-1">
            <Input
              label="Backup Password"
              placeholder="Enter strong encryption password"
              isPassword
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm Password"
              placeholder="Confirm password"
              isPassword
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium">
            {error}
          </div>
        )}

        {isSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Export generated and downloaded successfully!</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="shield"
            type="submit"
            isLoading={isExporting}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Download Export ({items.filter((i) => !i.trash).length} items)
          </Button>
        </div>
      </form>
    </Modal>
  );
};
