/**
 * Search relevance ranking with recency/frequency boosting.
 *
 * Mirrors the Proton Pass behaviour where items you recently opened or copied
 * from surface first for a matching query (e.g. typing "proton" puts the
 * account.proton.com login you used this morning above older matches).
 * Pure functions only — usage data lives encrypted inside the vault blob.
 */

import type { VaultItem } from '../types/vault';

export interface ItemUsage {
  lastUsedAt?: number;
  useCount?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Recency boost halves roughly every ~10 days (e^(-days/14)). */
const RECENCY_DECAY_DAYS = 14;
const MAX_RECENCY_BOOST = 40;
const MAX_FREQUENCY_BOOST = 20;
/** Repeated opens/copies of the same item inside this window count as one use. */
export const USAGE_COLLAPSE_WINDOW_MS = 60 * 1000;

function hostnameOf(url: string): string {
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return '';
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).hostname.replace(/^www\./, '');
  } catch {
    return trimmed.replace(/^www\./, '');
  }
}

function textScore(text: string, q: string, exact: number, prefix: number, word: number, contains: number): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  if (t === q) return exact;
  if (t.startsWith(q)) return prefix;
  if (t.split(/[\s._@\-/]+/).some((w) => w.startsWith(q))) return word;
  if (t.includes(q)) return contains;
  return 0;
}

/** How well the item's own fields match the query (0 = only matched via secondary text). */
export function matchScore(item: VaultItem, q: string): number {
  let best = textScore(item.name, q, 100, 80, 60, 40);

  if (item.type === 'login') {
    for (const url of item.urls || []) {
      const host = hostnameOf(url);
      // Domain labels: "account.proton.com" → ["account", "proton", "com"]
      const labelHit = host.split('.').some((l) => l.startsWith(q));
      const hostScore = host === q ? 75 : host.startsWith(q) ? 65 : labelHit ? 55 : host.includes(q) ? 35 : 0;
      best = Math.max(best, hostScore);
    }
    best = Math.max(best, textScore(item.username, q, 35, 30, 25, 15));
  } else if (item.type === 'identity') {
    best = Math.max(best, textScore(item.email, q, 35, 30, 25, 15));
  }

  return best;
}

/** Boost for items used recently and often. */
export function usageBoost(usage: ItemUsage, now: number): number {
  let boost = 0;
  if (usage.lastUsedAt) {
    const ageDays = Math.max(0, now - usage.lastUsedAt) / DAY_MS;
    boost += MAX_RECENCY_BOOST * Math.exp(-ageDays / RECENCY_DECAY_DAYS);
  }
  if (usage.useCount && usage.useCount > 0) {
    boost += Math.min(Math.log2(1 + usage.useCount) * 5, MAX_FREQUENCY_BOOST);
  }
  return boost;
}

/** True when every whitespace-separated term appears in the indexed search string. */
export function matchesQuery(searchStr: string, q: string): boolean {
  if (searchStr.includes(q)) return true;
  const terms = q.split(/\s+/).filter(Boolean);
  return terms.length > 1 && terms.every((t) => searchStr.includes(t));
}

/**
 * Filter and rank entries for a non-empty, lower-cased query.
 * `usageFor` lets callers supply a frozen usage snapshot so the list does not
 * reshuffle while the user clicks through results.
 */
export function rankSearchResults<T extends { item: VaultItem; searchStr: string }>(
  entries: T[],
  query: string,
  now: number,
  usageFor: (item: VaultItem) => ItemUsage = (item) => item
): VaultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries.map((e) => e.item);

  const scored: { item: VaultItem; score: number; lastUsedAt: number }[] = [];
  for (const entry of entries) {
    if (!matchesQuery(entry.searchStr, q)) continue;
    const usage = usageFor(entry.item);
    // Secondary-text-only matches (notes body, folder, tags…) still rank above nothing.
    const base = Math.max(matchScore(entry.item, q), 10);
    const score = base + usageBoost(usage, now) + (entry.item.favorite ? 5 : 0);
    scored.push({ item: entry.item, score, lastUsedAt: usage.lastUsedAt || 0 });
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.lastUsedAt - a.lastUsedAt ||
      a.item.name.localeCompare(b.item.name)
  );
  return scored.map((s) => s.item);
}

/** Apply one recorded use to an item, collapsing rapid repeats into a single count. */
export function applyUsage<T extends VaultItem>(item: T, now: number): T {
  const recent = item.lastUsedAt !== undefined && now - item.lastUsedAt < USAGE_COLLAPSE_WINDOW_MS;
  return {
    ...item,
    lastUsedAt: now,
    useCount: recent ? item.useCount || 1 : (item.useCount || 0) + 1,
  };
}
