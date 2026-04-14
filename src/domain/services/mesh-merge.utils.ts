/**
 * Pure merge utility functions for mesh sync operations.
 *
 * Stateless helpers extracted from MeshSyncService to
 * keep the service file under the 300-line limit.
 */

import {
  type MarchScores,
  type TimelineEvent,
  type SupplyInventory,
} from '../../core/types';

/** Deduplicate collections by a computed string key. */
export function deduplicateByKey<T>(
  local: readonly T[],
  incoming: readonly T[],
  keyFn: (item: T) => string,
): T[] {
  const result = [...local];
  const keys = new Set(local.map(keyFn));

  for (const item of incoming) {
    const key = keyFn(item);
    if (!keys.has(key)) {
      result.push(item);
      keys.add(key);
    }
  }

  return result;
}

/** Take the worst (highest) score for each MARCH category. */
export function mergeWorstMarch(
  a: MarchScores,
  b: MarchScores,
): MarchScores {
  return {
    M: Math.max(a.M, b.M),
    A: Math.max(a.A, b.A),
    R: Math.max(a.R, b.R),
    C: Math.max(a.C, b.C),
    H: Math.max(a.H, b.H),
  };
}

/** Merge two timelines with deduplication by composite key. */
export function mergeTimelines(
  local: readonly TimelineEvent[],
  incoming: readonly TimelineEvent[],
): TimelineEvent[] {
  const combined = [...local, ...incoming];
  const seen = new Set<string>();
  const result: TimelineEvent[] = [];

  for (const event of combined) {
    const key = `${event.ms ?? event.time}-${event.who ?? event.name}-${event.what}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(event);
    }
  }

  return result.sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
}

/** Merge two supply inventories by taking the max of each item. */
export function mergeSupplies(
  local: Readonly<SupplyInventory>,
  incoming: Readonly<SupplyInventory>,
): SupplyInventory {
  const keys = new Set([
    ...Object.keys(local),
    ...Object.keys(incoming),
  ]);
  const result: Record<string, number> = {};

  for (const key of keys) {
    result[key] = Math.max(local[key] ?? 0, incoming[key] ?? 0);
  }

  return result as SupplyInventory;
}
