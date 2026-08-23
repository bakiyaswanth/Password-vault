import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Check, ShieldCheck, KeyRound, BookOpen } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import {
  generatePassword,
  generatePassphrase,
  DEFAULT_GENERATOR_OPTIONS,
  DEFAULT_PASSPHRASE_OPTIONS,
} from '../../crypto/password-gen';
import { useClipboard } from '../../hooks/useClipboard';

export interface PasswordGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPassword?: (password: string) => void;
}

export const PasswordGeneratorModal: React.FC<PasswordGeneratorModalProps> = ({
  isOpen,
  onClose,
  onSelectPassword,
}) => {
  const [mode, setMode] = useState<'password' | 'passphrase'>('password');
  const [generatedValue, setGeneratedValue] = useState<string>('');

  // Password options
  const [passOptions, setPassOptions] = useState(DEFAULT_GENERATOR_OPTIONS);

  // Passphrase options
  const [phraseOptions, setPhraseOptions] = useState(DEFAULT_PASSPHRASE_OPTIONS);

  const { copyToClipboard, isCopied } = useClipboard(30);

  const handleGenerate = useCallback(() => {
    if (mode === 'password') {
      const p = generatePassword(passOptions);
      setGeneratedValue(p);
    } else {
      const p = generatePassphrase(phraseOptions);
      setGeneratedValue(p);
    }
  }, [mode, passOptions, phraseOptions]);

  useEffect(() => {
    if (isOpen) {
      handleGenerate();
    }
  }, [isOpen, handleGenerate]);

  const handleCopy = () => {
    copyToClipboard(generatedValue, 'gen-modal');
  };

  const handleApply = () => {
    if (onSelectPassword) {
      onSelectPassword(generatedValue);
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Password Generator"
      description="Cryptographically secure randomness generated client-side"
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Mode Selector */}
        <div className="flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${
              mode === 'password'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setMode('password')}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Random Password
          </button>
          <button
            type="button"
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${
              mode === 'passphrase'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
            onClick={() => setMode('passphrase')}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Memorable Passphrase
          </button>
        </div>

        {/* Generated Output Display */}
        <div className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-base font-medium break-all text-gray-900 dark:text-gray-100 select-all pr-12">
              {generatedValue}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 absolute right-3 top-3">
              <button
                type="button"
                onClick={handleGenerate}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                title="Regenerate"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/50 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                title="Copy to clipboard"
              >
                {isCopied('gen-modal') ? (
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <PasswordStrengthMeter password={generatedValue} />
        </div>

        {/* Options */}
        {mode === 'password' ? (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                <span>Length: {passOptions.length} characters</span>
                <span className="text-gray-400">Min 8, Max 64</span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                value={passOptions.length}
                onChange={(e) => setPassOptions({ ...passOptions, length: parseInt(e.target.value, 10) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-vault-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={passOptions.uppercase}
                  onChange={(e) => setPassOptions({ ...passOptions, uppercase: e.target.checked })}
                  className="rounded text-vault-600 focus:ring-vault-500"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200">A-Z (Uppercase)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={passOptions.lowercase}
                  onChange={(e) => setPassOptions({ ...passOptions, lowercase: e.target.checked })}
                  className="rounded text-vault-600 focus:ring-vault-500"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200">a-z (Lowercase)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={passOptions.numbers}
                  onChange={(e) => setPassOptions({ ...passOptions, numbers: e.target.checked })}
                  className="rounded text-vault-600 focus:ring-vault-500"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200">0-9 (Numbers)</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={passOptions.symbols}
                  onChange={(e) => setPassOptions({ ...passOptions, symbols: e.target.checked })}
                  className="rounded text-vault-600 focus:ring-vault-500"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200">!@#$% (Symbols)</span>
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={passOptions.excludeAmbiguous}
                onChange={(e) => setPassOptions({ ...passOptions, excludeAmbiguous: e.target.checked })}
                className="rounded text-vault-600 focus:ring-vault-500"
              />
              <span>Avoid ambiguous characters (e.g. 0, O, 1, l, I)</span>
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                <span>Words: {phraseOptions.wordCount}</span>
                <span className="text-gray-400">Min 3, Max 10</span>
              </div>
              <input
                type="range"
                min="3"
                max="10"
                value={phraseOptions.wordCount}
                onChange={(e) => setPhraseOptions({ ...phraseOptions, wordCount: parseInt(e.target.value, 10) })}
                className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-vault-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={phraseOptions.capitalize}
                  onChange={(e) => setPhraseOptions({ ...phraseOptions, capitalize: e.target.checked })}
                  className="rounded text-vault-600 focus:ring-vault-500"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200">Capitalize Words</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <input
                  type="checkbox"
                  checked={phraseOptions.includeNumber}
                  onChange={(e) => setPhraseOptions({ ...phraseOptions, includeNumber: e.target.checked })}
                  className="rounded text-vault-600 focus:ring-vault-500"
                />
                <span className="font-medium text-gray-800 dark:text-gray-200">Include Number</span>
              </label>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="shield" leftIcon={<Copy className="w-4 h-4" />} onClick={handleCopy}>
            Copy Password
          </Button>
          {onSelectPassword && (
            <Button variant="primary" leftIcon={<ShieldCheck className="w-4 h-4" />} onClick={handleApply}>
              Use in Item
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
