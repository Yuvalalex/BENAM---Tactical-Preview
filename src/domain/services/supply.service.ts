/**
 * Supply Management Service.
 *
 * Tracks medical supply consumption, generates low-supply alerts,
 * and calculates supply adequacy against casualty needs.
 */

import { type SupplyInventory } from '../../core/types';
import { DEFAULT_SUPPLIES } from '../../core/constants';

export interface SupplyAlert {
  readonly item: string;
  readonly remaining: number;
  readonly threshold: number;
  readonly severity: 'low' | 'critical' | 'depleted';
}

export class SupplyService {
  private readonly lowThresholds: Record<string, number> = {
    TQ: 2,
    Asherman: 1,
    Gauze: 3,
    TXA: 2,
    'NaCl 500': 2,
    Morphine: 1,
    Ketamine: 1,
    NPA: 1,
    Hyfin: 1,
    Bandaids: 5,
  };

  /**
   * Create default supply inventory.
   */
  createDefault(): SupplyInventory {
    return { ...DEFAULT_SUPPLIES };
  }

  /**
   * Consume a supply item, returning the updated inventory.
   * Returns null if insufficient supply.
   */
  consume(
    inventory: Readonly<SupplyInventory>,
    item: string,
    quantity = 1,
  ): SupplyInventory | null {
    const current = inventory[item] ?? 0;
    if (current < quantity) return null;

    return {
      ...inventory,
      [item]: current - quantity,
    };
  }

  /**
   * Add to a supply item (resupply).
   */
  resupply(
    inventory: Readonly<SupplyInventory>,
    item: string,
    quantity: number,
  ): SupplyInventory {
    const current = inventory[item] ?? 0;
    return {
      ...inventory,
      [item]: current + quantity,
    };
  }

  /**
   * Merge two inventories by taking the maximum of each item.
   * Used in mesh sync.
   */
  mergeMax(a: Readonly<SupplyInventory>, b: Readonly<SupplyInventory>): SupplyInventory {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const result: Record<string, number> = {};

    for (const key of keys) {
      result[key] = Math.max(a[key] ?? 0, b[key] ?? 0);
    }

    return result as SupplyInventory;
  }

  /**
   * Check all supply levels and return items at or below threshold.
   */
  checkLevels(inventory: Readonly<SupplyInventory>): SupplyAlert[] {
    const alerts: SupplyAlert[] = [];

    for (const [item, threshold] of Object.entries(this.lowThresholds)) {
      const remaining = inventory[item] ?? 0;

      if (remaining === 0) {
        alerts.push({ item, remaining, threshold, severity: 'depleted' });
      } else if (remaining <= Math.floor(threshold / 2)) {
        alerts.push({ item, remaining, threshold, severity: 'critical' });
      } else if (remaining <= threshold) {
        alerts.push({ item, remaining, threshold, severity: 'low' });
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { depleted: 0, critical: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Calculate total items across all supply types.
   */
  totalItems(inventory: Readonly<SupplyInventory>): number {
    return Object.values(inventory).reduce((sum, n) => sum + (typeof n === 'number' ? n : 0), 0);
  }
}
