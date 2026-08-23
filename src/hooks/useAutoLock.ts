/**
 * AegisVault Auto-Lock Hook
 * Automatically zeroes in-memory vault state on user inactivity or tab blur.
 */

import { useEffect, useRef, useCallback } from 'react';

export type AutoLockTimeout = 1 | 5 | 15 | 30 | 0; // minutes, 0 = Never

export function useAutoLock(
  timeoutMinutes: AutoLockTimeout,
  lockOnBlur: boolean,
  onLock: () => void
) {
  const timerRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (timeoutMinutes > 0) {
      const ms = timeoutMinutes * 60 * 1000;
      timerRef.current = window.setTimeout(() => {
        onLock();
      }, ms);
    }
  }, [timeoutMinutes, onLock]);

  useEffect(() => {
    resetTimer();

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => resetTimer();

    for (const event of activityEvents) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    const handleVisibilityChange = () => {
      if (document.hidden && lockOnBlur) {
        onLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      for (const event of activityEvents) {
        window.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetTimer, lockOnBlur, onLock]);

  return { resetTimer };
}
