import React, { useState, useRef } from 'react';
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Folder,
  FileCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  FileUp,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  autoDetectAndImport,
  parseBitwardenJson,
  parseBitwardenCsv,
  parseProtonPassJson,
  parseProtonPassZip,
  parseChromeCsv,
  type ImportExportFormat,
  type DetailedImportResult,
} from '../../utils/importers';
import { useVault } from '../../context/VaultContext';

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose }) => {
  const { importBatch, importEncryptedBackup } = useVault();
  const [selectedFormat, setSelectedFormat] = useState<ImportExportFormat>('bitwarden-json');
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [encryptedPassword, setEncryptedPassword] = useState<string>('');
  const [overwriteDuplicates, setOverwriteDuplicates] = useState<boolean>(false);
  const [parsedPreview, setParsedPreview] = useState<DetailedImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importPhase, setImportPhase] = useState<string>('');
  const [finalReport, setFinalReport] = useState<{
    totalDetected: number;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    foldersCreated: string[];
    folderItemCounts: Record<string, number>;
    failedItems: any[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setFileName(file.name);
    setFileSize(
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
        : `${(file.size / 1024).toFixed(1)} KB`
    );
    setError(null);
    setParsedPreview(null);
    setFinalReport(null);
    setImportProgress(0);

    const isZip = /\.zip$/i.test(file.name) || selectedFormat === 'protonpass-zip';
    if (isZip) {
      if (selectedFormat !== 'protonpass-zip') setSelectedFormat('protonpass-zip');
      const zipReader = new FileReader();
      zipReader.onload = (event) => {
        try {
          const bytes = new Uint8Array(event.target?.result as ArrayBuffer);
          const result = parseProtonPassZip(bytes);
          // Non-empty marker so the Import button enables; the parsed preview is used for import.
          setFileContent(file.name);
          setParsedPreview(result);
        } catch (err: unknown) {
          setFileContent('');
          setError(err instanceof Error ? err.message : 'Failed to read Proton Pass zip.');
        }
      };
      zipReader.readAsArrayBuffer(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setFileContent(text);

      if (selectedFormat !== 'surakshit-encrypted') {
        try {
          let result: DetailedImportResult;
          if (selectedFormat === 'bitwarden-json') {
            result = parseBitwardenJson(text);
          } else if (selectedFormat === 'bitwarden-csv') {
            result = parseBitwardenCsv(text);
          } else if (selectedFormat === 'protonpass-json') {
            result = parseProtonPassJson(text);
          } else if (selectedFormat === 'chrome-csv') {
            result = parseChromeCsv(text);
          } else {
            result = autoDetectAndImport(text, selectedFormat);
          }
          setParsedPreview(result);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to parse file. Please verify format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleExecuteImport = async () => {
    if (!fileContent) {
      setError('Please select a file to import.');
      return;
    }

    setIsImporting(true);
    setError(null);
    setImportProgress(10);
    setImportPhase('Parsing credentials & folder hierarchies...');

    try {
      if (selectedFormat === 'surakshit-encrypted') {
        if (!encryptedPassword) {
          setError('Decryption password is required for Surakshit Encrypted backup.');
          setIsImporting(false);
          return;
        }
        setImportPhase('Decrypting and verifying backup integrity...');
        setImportProgress(50);
        await importEncryptedBackup(fileContent, encryptedPassword);
        setImportProgress(100);
        setFinalReport({
          totalDetected: parsedPreview?.totalDetected || 1,
          importedCount: parsedPreview?.totalDetected || 1,
          skippedCount: 0,
          failedCount: 0,
          foldersCreated: [],
          folderItemCounts: {},
          failedItems: [],
        });
      } else {
        const parsed = parsedPreview || autoDetectAndImport(fileContent, selectedFormat);
        if (selectedFormat === 'protonpass-zip' && !parsedPreview) {
          throw new Error('Please select a valid Proton Pass zip export.');
        }

        setImportProgress(40);
        setImportPhase(`Mapping ${parsed.validItems.length} items to ${parsed.allFolders.length} folders...`);

        // Yield to allow UI progress bar render
        await new Promise((resolve) => setTimeout(resolve, 50));

        setImportProgress(75);
        setImportPhase('Encrypting snapshot and synchronizing with Surakshit Zero-Knowledge Cloud...');

        const report = await importBatch(parsed.validItems, parsed.allFolders, overwriteDuplicates);

        setImportProgress(100);
        setImportPhase('Import complete!');

        setFinalReport({
          totalDetected: parsed.totalDetected,
          importedCount: report.importedCount,
          skippedCount: report.skippedCount,
          failedCount: parsed.failedCount,
          foldersCreated: parsed.foldersCreated,
          folderItemCounts: parsed.folderItemCounts,
          failedItems: parsed.failedItems,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRetryFailedOnly = async () => {
    if (!finalReport || finalReport.failedItems.length === 0) return;
    setIsImporting(true);
    setError(null);
    try {
      const retryCandidates = finalReport.failedItems.map((f) => ({
        id: crypto.randomUUID(),
        type: 'login' as const,
        name: f.name || 'Recovered Item',
        username: '',
        password: '',
        urls: [],
        notes: typeof f.raw === 'string' ? f.raw : JSON.stringify(f.raw),
        trash: false,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const retryReport = await importBatch(retryCandidates, []);
      setFinalReport((prev) =>
        prev
          ? {
              ...prev,
              importedCount: prev.importedCount + retryReport.importedCount,
              failedCount: 0,
              failedItems: [],
            }
          : null
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setFinalReport(null);
        setFileContent('');
        setFileName('');
        setFileSize('');
        setParsedPreview(null);
        setError(null);
        setImportProgress(0);
        onClose();
      }}
      title="Import to Surakshit Vault"
      description="Instant, atomic migration from Bitwarden, Proton Pass, Chrome, or Surakshit Encrypted backups."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Step 1: Format Selector */}
        {!finalReport && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Source Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => {
                setSelectedFormat(e.target.value as ImportExportFormat);
                setParsedPreview(null);
                setError(null);
                setFinalReport(null);
              }}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-vault-500"
            >
              <option value="bitwarden-json">Bitwarden (JSON) — Recommended / Default</option>
              <option value="bitwarden-csv">Bitwarden (CSV)</option>
              <option value="protonpass-zip">Proton Pass (ZIP export)</option>
              <option value="protonpass-json">Proton Pass (JSON)</option>
              <option value="protonpass-csv">Proton Pass (CSV)</option>
              <option value="chrome-csv">Chrome / Generic Password (CSV)</option>
              <option value="surakshit-encrypted">Surakshit Vault Encrypted (.aegisvault / .surakshit)</option>
            </select>
          </div>
        )}

        {/* Step 2: File Upload Zone */}
        {!finalReport && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Select File
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,.zip,.aegisvault,.surakshit,.txt"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group ${
                isDragOver
                  ? 'border-vault-500 bg-vault-50/80 dark:bg-vault-950/60 ring-2 ring-vault-400/30'
                  : fileName
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-400'
                  : 'border-gray-300 dark:border-gray-700 hover:border-vault-500 dark:hover:border-vault-400 bg-gray-50/60 dark:bg-gray-950/40 hover:bg-white dark:hover:bg-gray-900/60'
              }`}
            >
              {fileName ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white font-mono">
                      {fileName}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {fileSize} • Click anywhere to choose a different file
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-10 h-10 rounded-full bg-vault-100 dark:bg-vault-950/60 text-vault-600 dark:text-vault-400 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <FileUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      Browse your file
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      or drag and drop your file here
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-mono pt-1">
                    Supports .json, .csv, .zip, .surakshit, .aegisvault
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Password input for encrypted format */}
        {selectedFormat === 'surakshit-encrypted' && !finalReport && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Backup Decryption Password
            </label>
            <input
              type="password"
              placeholder="Password entered during backup export"
              value={encryptedPassword}
              onChange={(e) => setEncryptedPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-vault-500"
            />
          </div>
        )}

        {/* Options & Overwrite Duplicates */}
        {!finalReport && parsedPreview && (
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={overwriteDuplicates}
              onChange={(e) => setOverwriteDuplicates(e.target.checked)}
              className="rounded text-vault-600 focus:ring-vault-500"
            />
            <span>Overwrite existing passwords if identical fingerprint is detected</span>
          </label>
        )}

        {/* Pre-Import Inspection Card */}
        {parsedPreview && !finalReport && (
          <div className="p-4 rounded-xl bg-vault-50/50 dark:bg-vault-950/40 border border-vault-200 dark:border-vault-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Format: {parsedPreview.formatDetected}
              </span>
              <Badge variant="blue" size="sm">
                {parsedPreview.totalDetected} records detected
              </Badge>
            </div>

            {/* Folder breakdown badges */}
            {parsedPreview.allFolders.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block uppercase tracking-wider">
                  Preserved Folder Structure:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {parsedPreview.allFolders.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-800 dark:text-gray-200 font-medium"
                    >
                      <Folder className="w-3 h-3 text-vault-600 dark:text-vault-400" />
                      <span>{f}</span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        ({parsedPreview.folderItemCounts[f] || 0})
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Real-time Progress Bar */}
        {isImporting && (
          <div className="space-y-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-vault-600" />
                {importPhase}
              </span>
              <span className="font-mono">{importProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-vault-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${importProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Final Detailed Completion Report */}
        {finalReport && (
          <div className="space-y-4 p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Import Summary — Surakshit Vault
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  All valid records have been encrypted and synchronized into your vault.
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
              <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">Total Detected</span>
                <span className="text-lg font-bold font-mono text-gray-900 dark:text-white">
                  {finalReport.totalDetected}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                  Successfully Imported
                </span>
                <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {finalReport.importedCount}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <span className="text-[10px] uppercase font-bold text-amber-500 block">Duplicates Skipped</span>
                <span className="text-lg font-bold font-mono text-amber-500">
                  {finalReport.skippedCount}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                <span className="text-[10px] uppercase font-bold text-red-500 block">Failed Records</span>
                <span className="text-lg font-bold font-mono text-red-500">
                  {finalReport.failedCount}
                </span>
              </div>
            </div>

            {/* Folders Summary */}
            {finalReport.foldersCreated.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-vault-600" />
                  Preserved Folder Distribution:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {finalReport.foldersCreated.map((f) => (
                    <Badge key={f} variant="gray" size="sm">
                      {f}: {finalReport.folderItemCounts[f] || 0} items
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Items Table & Retry Button */}
            {finalReport.failedItems.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {finalReport.failedItems.length} records had formatting errors:
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    onClick={handleRetryFailedOnly}
                    isLoading={isImporting}
                  >
                    Retry Failed as Notes
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-red-200 dark:border-red-900 p-2 text-xs space-y-1 bg-white dark:bg-gray-900">
                  {finalReport.failedItems.map((f, i) => (
                    <div key={i} className="text-red-600 dark:text-red-400 font-mono text-[11px]">
                      • {f.name}: {f.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Controls */}
        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button
            variant="secondary"
            onClick={() => {
              setFinalReport(null);
              setFileContent('');
              setFileName('');
              setFileSize('');
              setParsedPreview(null);
              setError(null);
              onClose();
            }}
          >
            {finalReport ? 'Done' : 'Cancel'}
          </Button>

          {!finalReport && (
            <Button
              variant="primary"
              disabled={!fileContent || isImporting}
              isLoading={isImporting}
              onClick={handleExecuteImport}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Import {parsedPreview ? `(${parsedPreview.totalDetected} Items)` : ''}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
