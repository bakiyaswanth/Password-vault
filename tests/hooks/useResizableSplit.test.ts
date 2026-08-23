import { describe, it, expect, beforeEach } from 'vitest';

// Node test environment mock for localStorage
class LocalStorageMock {
  private store: Record<string, string> = {};

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

const mockLocalStorage = new LocalStorageMock();

describe('useResizableSplit LocalStorage & Dimension Clamping Logic', () => {
  const STORAGE_KEY = 'surakshit_vault_list_width';
  const MIN_WIDTH = 240;
  const MAX_WIDTH = 620;
  const DEFAULT_WIDTH = 340;

  beforeEach(() => {
    mockLocalStorage.clear();
  });

  const getInitialWidth = (storageKey = STORAGE_KEY, min = MIN_WIDTH, max = MAX_WIDTH, def = DEFAULT_WIDTH) => {
    try {
      const saved = mockLocalStorage.getItem(storageKey);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= min && val <= max) {
          return val;
        }
      }
    } catch {
      // Ignored
    }
    return def;
  };

  const clampWidth = (rawWidth: number, containerWidth: number, minDetail = 350, min = MIN_WIDTH, max = MAX_WIDTH) => {
    const dynamicMaxWidth = Math.min(max, containerWidth - minDetail);
    return Math.max(min, Math.min(rawWidth, dynamicMaxWidth));
  };

  it('loads default width when no localStorage preference is set', () => {
    expect(getInitialWidth()).toBe(340);
  });

  it('restores valid saved preference from localStorage', () => {
    mockLocalStorage.setItem(STORAGE_KEY, '450');
    expect(getInitialWidth()).toBe(450);
  });

  it('falls back to default width when saved value is corrupted or out of bounds', () => {
    mockLocalStorage.setItem(STORAGE_KEY, 'invalid');
    expect(getInitialWidth()).toBe(340);

    mockLocalStorage.setItem(STORAGE_KEY, '99999');
    expect(getInitialWidth()).toBe(340);

    mockLocalStorage.setItem(STORAGE_KEY, '50');
    expect(getInitialWidth()).toBe(340);
  });

  it('clamps raw mouse drag positions within safe boundaries', () => {
    const containerWidth = 1200; // 1200px viewport container

    // Left boundary
    expect(clampWidth(100, containerWidth)).toBe(240); // Clamped to MIN_WIDTH

    // Normal dragging
    expect(clampWidth(400, containerWidth)).toBe(400);

    // Right boundary on wide display
    expect(clampWidth(800, containerWidth)).toBe(620); // Clamped to MAX_WIDTH

    // Narrow display (containerWidth = 700px, minDetail = 350px => dynamic max is 350px)
    expect(clampWidth(500, 700)).toBe(350);
  });
});
