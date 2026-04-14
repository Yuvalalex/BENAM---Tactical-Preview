/**
 * Triage Service — Priority classification and sorting logic.
 *
 * Extracts all triage-related business rules from legacy app.js into a
 * pure, testable service with no DOM or state dependencies.
 */

import {
  type Casualty,
  type CasualtyId,
  TriagePriority,
} from '../../core/types';
import {
  TRIAGE_SORT_VALUE,
  TRIAGE_COLORS,
  TRIAGE_LABELS,
  TRIAGE_PRIORITY_ORDER,
} from '../../core/constants';

export interface TriageSummary {
  readonly total: number;
  readonly byPriority: Record<TriagePriority, number>;
  readonly percentages: Record<TriagePriority, number>;
}

export class TriageService {
  /**
   * Sort casualties by triage priority (T1 first, T4 last).
   * Secondary sort by time added (earliest first).
   */
  sortByPriority(casualties: readonly Casualty[]): Casualty[] {
    return [...casualties].sort((a, b) => {
      const pDiff = TRIAGE_SORT_VALUE[a.priority] - TRIAGE_SORT_VALUE[b.priority];
      if (pDiff !== 0) return pDiff;
      return a._addedAt - b._addedAt;
    });
  }

  /**
   * Filter casualties by one or more priorities.
   */
  filterByPriority(
    casualties: readonly Casualty[],
    priorities: TriagePriority | TriagePriority[],
  ): Casualty[] {
    const set = new Set(Array.isArray(priorities) ? priorities : [priorities]);
    return casualties.filter((c) => set.has(c.priority));
  }

  /**
   * Get triage summary (counts and percentages per priority).
   */
  summarize(casualties: readonly Casualty[]): TriageSummary {
    const byPriority = {
      [TriagePriority.T1]: 0,
      [TriagePriority.T2]: 0,
      [TriagePriority.T3]: 0,
      [TriagePriority.T4]: 0,
    };

    for (const cas of casualties) {
      if (cas.priority in byPriority) {
        byPriority[cas.priority]++;
      }
    }

    const total = casualties.length;
    const percentages = {
      [TriagePriority.T1]: total ? Math.round((byPriority[TriagePriority.T1] / total) * 100) : 0,
      [TriagePriority.T2]: total ? Math.round((byPriority[TriagePriority.T2] / total) * 100) : 0,
      [TriagePriority.T3]: total ? Math.round((byPriority[TriagePriority.T3] / total) * 100) : 0,
      [TriagePriority.T4]: total ? Math.round((byPriority[TriagePriority.T4] / total) * 100) : 0,
    };

    return { total, byPriority, percentages };
  }

  /**
   * Determine if a casualty should be escalated from T2 to T1.
   * Rules: deteriorating vitals, no treatment after threshold, critical MARCH score.
   */
  shouldEscalate(casualty: Casualty, elapsedMinutes: number): boolean {
    if (casualty.priority !== TriagePriority.T2) return false;

    const marchMax = Math.max(
      casualty.march.M,
      casualty.march.A,
      casualty.march.R,
      casualty.march.C,
      casualty.march.H,
    );

    if (marchMax >= 4) return true;
    if (casualty.txList.length === 0 && elapsedMinutes > 30) return true;

    return false;
  }

  /**
   * Get display color for a priority level.
   */
  getColor(priority: TriagePriority): string {
    return TRIAGE_COLORS[priority] ?? '#666';
  }

  /**
   * Get display label for a priority level.
   */
  getLabel(priority: TriagePriority): string {
    return TRIAGE_LABELS[priority] ?? 'UNKNOWN';
  }

  /**
   * Get all priority levels in order.
   */
  getPriorityOrder(): readonly TriagePriority[] {
    return TRIAGE_PRIORITY_ORDER;
  }

  /**
   * Find the highest-priority casualty (lowest T number).
   */
  findMostUrgent(casualties: readonly Casualty[]): Casualty | undefined {
    if (casualties.length === 0) return undefined;
    return this.sortByPriority(casualties)[0];
  }

  /**
   * Count untreated casualties (no treatments applied).
   */
  countUntreated(casualties: readonly Casualty[]): number {
    return casualties.filter((c) => c.txList.length === 0).length;
  }
}
