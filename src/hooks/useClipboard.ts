/**
 * Surakshit Vault Secure Clipboard Hook
 * Copies sensitive credentials with visual confirmation and auto-clears clipboard after 30 seconds.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

export function useClipboard(autoClearSeconds: number = 30) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (countdownRef.current) window.clearInterval(countdownRef.current);
    timerRef.current = null;
    countdownRef.current = null;
    setSecondsLeft(0);
    setCopiedId(null);
  }, []);

  const resetVisualState = useCallback(() => {
    setCopiedId(null);
    setSecondsLeft(0);
  }, []);

  const copyToClipboard = useCallback(
    async (text: string, identifier: string = 'default') => {
      clearTimer();

      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(identifier);
        setSecondsLeft(autoClearSeconds);

        // Countdown interval
        countdownRef.current = window.setInterval(() => {
          setSecondsLeft((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) window.clearInterval(countdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Auto clear clipboard after delay
        timerRef.current = window.setTimeout(async () => {
          try {
            // Overwrite clipboard with empty string
            await navigator.clipboard.writeText('');
          } catch {
            // Ignore if permission denied
          }
          clearTimer();
        }, autoClearSeconds * 1000);

        return true;
      } catch (err) {
        console.error('Failed to copy to clipboard', err);
        return false;
      }
    },
    [autoClearSeconds, clearTimer]
  );

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return {
    copyToClipboard,
    copiedId,
    secondsLeft,
    isCopied: (id: string) => copiedId === id,
    resetVisualState,
    clearTimer,
  };
}
