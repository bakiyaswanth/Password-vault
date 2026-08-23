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

  // Start dragging handler
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Double click maximize/restore handler
  const handleToggleMaximize = useCallback(() => {
    if (isMaximized) {
      // Restore
      setListWidth(previousWidthRef.current || defaultWidth);
      setIsMaximized(false);
      try {
        localStorage.setItem(storageKey, (previousWidthRef.current || defaultWidth).toString());
      } catch {
        // Ignored
      }
    } else {
      // Maximize detail (shrink list to minimum)
      previousWidthRef.current = listWidth;
      setListWidth(minWidth);
      setIsMaximized(true);
      try {
        localStorage.setItem(storageKey, minWidth.toString());
      } catch {
        // Ignored
      }
    }
  }, [isMaximized, listWidth, minWidth, defaultWidth, storageKey]);

  useEffect(() => {
    if (!isDragging) return;

    // Add drag-active styles to body to prevent text selection and keep col-resize cursor
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const rawWidth = e.clientX - containerRect.left;

      const dynamicMaxWidth = Math.min(maxWidth, containerRect.width - minDetailWidth);
      const clampedWidth = Math.max(minWidth, Math.min(rawWidth, dynamicMaxWidth));

      setListWidth(clampedWidth);
      if (clampedWidth > minWidth) {
        setIsMaximized(false);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Persist user preference
      try {
        localStorage.setItem(storageKey, listWidth.toString());
      } catch {
        // Ignored
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, listWidth, minWidth, maxWidth, minDetailWidth, storageKey]);

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
