import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Download, AlertTriangle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { useClipboard } from '../../hooks/useClipboard';

export const RecoveryPhraseModal: React.FC<{
  phrase: string;
  isOpen: boolean;
  onClose: () => void;
}> = ({ phrase, isOpen, onClose }) => {
  const [confirmedSaved, setConfirmedSaved] = useState(false);
  const { copyToClipboard, isCopied } = useClipboard(60);

  const words = phrase.split(' ');

  const handleDownload = () => {
    const file = new Blob([phrase], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const element = document.createElement('a');
    element.href = url;
    element.download = 'surakshit-vault-emergency-recovery-key.txt';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (confirmedSaved) onClose();
      }}
      title="Save Emergency Recovery Key"
      description="This 24-word phrase is the ONLY way to recover your vault if you lose your master password."
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Surakshit Vault has no backdoor. If you lose both your master password and this recovery phrase, your encrypted data cannot be decrypted by anyone.
          </span>
        </div>

        {/* Word Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 p-4 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 font-mono text-xs">
          {words.map((word, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              <span className="text-gray-400 text-[10px] w-4 text-right select-none">
                {idx + 1}.
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{word}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            leftIcon={isCopied('rec-phrase') ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            onClick={() => copyToClipboard(phrase, 'rec-phrase')}
          >
            {isCopied('rec-phrase') ? 'Copied' : 'Copy Phrase'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
          >
            Download Key File
          </Button>
        </div>

        {/* Checkbox confirmation */}
        <label className="flex items-start gap-2.5 p-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 text-xs">
          <input
            type="checkbox"
            checked={confirmedSaved}
            onChange={(e) => setConfirmedSaved(e.target.checked)}
            className="rounded text-vault-600 focus:ring-vault-500 mt-0.5"
          />
          <span className="font-medium text-gray-800 dark:text-gray-200">
            I have saved this recovery key in a secure location (e.g. password manager backup or written on paper in a safe).
          </span>
        </label>

        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
          <Button
            variant="primary"
            disabled={!confirmedSaved}
            leftIcon={<ShieldCheck className="w-4 h-4" />}
            onClick={onClose}
          >
            Continue to Vault
          </Button>
        </div>
      </div>
    </Modal>
  );
};
