import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseResizableSplitOptions {
  minWidth?: number;
  maxWidth?: number;
  minDetailWidth?: number;
  defaultWidth?: number;
  storageKey?: string;
}

export function useResizableSplit({
  minWidth = 240,
  maxWidth = 640,
  minDetailWidth = 340,
  defaultWidth = 340,
  storageKey = 'surakshit_vault_list_width',
}: UseResizableSplitOptions = {}) {
  const [listWidth, setListWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= minWidth && val <= maxWidth) {
          return val;
        }
      }
    } catch {
      // Ignored
    }
    return defaultWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousWidthRef = useRef<number>(listWidth);
  const rafRef = useRef<number | null>(null);
  const latestWidthRef = useRef<number>(listWidth);

  latestWidthRef.current = listWidth;

  // Start dragging handler (supports Mouse and Touch)
  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Double click maximize/restore handler
  const handleToggleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore
      const restored = previousWidthRef.current || defaultWidth;
      setListWidth(restored);
      setIsMaximized(false);
      try {
        localStorage.setItem(storageKey, restored.toString());
      } catch {}
    } else {
      // Maximize detail (shrink list to minimum)
      previousWidthRef.current = listWidth;
      setListWidth(minWidth);
      setIsMaximized(true);
      try {
        localStorage.setItem(storageKey, minWidth.toString());
      } catch {}
    }
  }, [isMaximized, listWidth, minWidth, defaultWidth, storageKey]);

  useEffect(() => {
    if (!isDragging) return;

    // Super smooth drag: lock cursor, prevent text selection
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.classList.add('resizing-active');

    const updateWidth = (clientX: number) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const rawWidth = clientX - containerRect.left;

      const dynamicMaxWidth = Math.min(maxWidth, containerRect.width - minDetailWidth);
      const clampedWidth = Math.max(minWidth, Math.min(rawWidth, dynamicMaxWidth));

      // Batch via requestAnimationFrame for silky 60fps/120fps hardware-accelerated tracking
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = requestAnimationFrame(() => {
        setListWidth(clampedWidth);
        if (clampedWidth > minWidth) {
          setIsMaximized(false);
        }
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateWidth(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        updateWidth(e.touches[0].clientX);
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing-active');

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }

      // Persist user preference
      try {
        localStorage.setItem(storageKey, latestWidthRef.current.toString());
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.classList.remove('resizing-active');
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDragging, minWidth, maxWidth, minDetailWidth, storageKey]);

  return {
    listWidth,
    isDragging,
    isMaximized,
    containerRef,
    handleMouseDown,
    handleToggleMaximize,
    setListWidth,
  };
}
