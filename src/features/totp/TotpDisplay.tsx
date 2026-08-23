import React, { useState, useEffect } from 'react';
import { Copy, Check, Clock, AlertTriangle } from 'lucide-react';
import { generateTotp } from '../../crypto/totp';
import { useClipboard } from '../../hooks/useClipboard';

export const TotpDisplay: React.FC<{ secret: string; label?: string }> = ({ secret, label }) => {
  const [totpData, setTotpData] = useState<{
    code: string;
    secondsRemaining: number;
    progressPercent: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { copyToClipboard, isCopied } = useClipboard(30);

  useEffect(() => {
    if (!secret) {
      setTotpData(null);
      return;
    }

    const updateCode = () => {
      try {
        const result = generateTotp({ secret });
        setTotpData(result);
        setError(null);
      } catch (err: unknown) {
        setError('Invalid TOTP secret key');
        setTotpData(null);
      }
    };

    updateCode();
    const interval = window.setInterval(updateCode, 1000);
    return () => window.clearInterval(interval);
  }, [secret]);

  if (!secret) return null;

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-medium">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!totpData) return null;

  const formattedCode =
    totpData.code.length === 6
      ? `${totpData.code.slice(0, 3)} ${totpData.code.slice(3)}`
      : `${totpData.code.slice(0, 4)} ${totpData.code.slice(4)}`;

  const isExpiringSoon = totpData.secondsRemaining <= 5;

  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-vault-50/50 dark:bg-gray-800/60 border border-vault-100 dark:border-gray-700">
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>One-Time Password (TOTP)</span>
          {label && <span className="text-gray-400">• {label}</span>}
        </div>
        <div className="font-mono text-2xl font-bold tracking-widest text-vault-900 dark:text-vault-100 select-all">
          {formattedCode}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Animated Timer Circle */}
        <div className="relative w-8 h-8 flex items-center justify-center">
          <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-gray-200 dark:text-gray-700"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={`transition-all duration-1000 ease-linear ${
                isExpiringSoon ? 'text-red-500' : 'text-vault-600 dark:text-vault-400'
              }`}
              strokeDasharray={`${totpData.progressPercent}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span
            className={`absolute text-xs font-semibold ${
              isExpiringSoon ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'
            }`}
          >
            {totpData.secondsRemaining}
          </span>
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={() => copyToClipboard(totpData.code, 'totp-code')}
          className="p-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 shadow-sm transition-colors"
          title="Copy TOTP Code"
        >
          {isCopied('totp-code') ? (
            <Check className="w-4 h-4 text-emerald-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
