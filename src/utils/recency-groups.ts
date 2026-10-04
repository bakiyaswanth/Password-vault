/**
 * Groups items into Proton Pass–style recency sections
 * (Today / Yesterday / Last week / Last month / Older) by when they were last used.
 */

import type { VaultItem } from '../types/vault';

export interface RecencyGroup {
  label: string;
  items: VaultItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function recencyLabel(usedAt: number, now: number): string {
  const today = startOfLocalDay(now);
  if (usedAt >= today) return 'Today';
  if (usedAt >= today - DAY_MS) return 'Yesterday';
  if (usedAt >= today - 7 * DAY_MS) return 'Last week';
  if (usedAt >= today - 30 * DAY_MS) return 'Last month';
  return 'Older';
}

/**
 * Only items that have been used are included, newest first.
 * `usedAtFor` allows a frozen snapshot so the list doesn't reorder while the user clicks through it.
 */
export function groupByRecency(
  items: VaultItem[],
  now: number,
  usedAtFor: (item: VaultItem) => number | undefined = (item) => item.lastUsedAt
): RecencyGroup[] {
  const used = items
    .map((item) => ({ item, at: usedAtFor(item) }))
    .filter((e): e is { item: VaultItem; at: number } => typeof e.at === 'number' && e.at > 0)
    .sort((a, b) => b.at - a.at);

  const groups: RecencyGroup[] = [];
  for (const { item, at } of used) {
    const label = recencyLabel(at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
