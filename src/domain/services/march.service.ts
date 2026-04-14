/**
 * MARCH Protocol Service — Massive hemorrhage, Airway, Respiration,
 * Circulation, Hypothermia assessment and scoring.
 *
 * Pure business logic extracted from the MARCH-related functions in
 * legacy app.js. No DOM dependencies.
 */

import {
  type MarchScores,
  type Casualty,
  MarchCategory,
} from '../../core/types';
import { DEFAULT_MARCH } from '../../core/constants';
import { clamp } from '../../core/utils';

export interface MarchAssessment {
  readonly totalScore: number;
  readonly maxCategory: MarchCategory;
  readonly maxScore: number;
  readonly criticalCategories: MarchCategory[];
  readonly recommendation: string;
}

export class MarchService {
  /**
   * Calculate total MARCH score (sum of all categories).
   */
  totalScore(march: MarchScores): number {
    return march.M + march.A + march.R + march.C + march.H;
  }

  /**
   * Find the category with the highest (worst) score.
   */
  worstCategory(march: MarchScores): { category: MarchCategory; score: number } {
    const entries: [MarchCategory, number][] = [
      [MarchCategory.M, march.M],
      [MarchCategory.A, march.A],
      [MarchCategory.R, march.R],
      [MarchCategory.C, march.C],
      [MarchCategory.H, march.H],
    ];

    entries.sort((a, b) => b[1] - a[1]);
    return { category: entries[0][0], score: entries[0][1] };
  }

  /**
   * Per-category critical thresholds per MARCH-PAWS protocol.
   * M and A are immediately life-threatening at lower scores.
   */
  private static readonly CRITICAL_THRESHOLDS: Record<MarchCategory, number> = {
    [MarchCategory.M]: 2,
    [MarchCategory.A]: 2,
    [MarchCategory.R]: 3,
    [MarchCategory.C]: 3,
    [MarchCategory.H]: 3,
  };

  /**
   * Get all categories at or above their category-specific threshold.
   * Per MARCH-PAWS: M and A trigger at 2, R/C/H at 3.
   */
  criticalCategories(march: MarchScores, thresholdOverride?: number): MarchCategory[] {
    const result: MarchCategory[] = [];
    const thresholds = MarchService.CRITICAL_THRESHOLDS;
    if (march.M >= (thresholdOverride ?? thresholds[MarchCategory.M])) result.push(MarchCategory.M);
    if (march.A >= (thresholdOverride ?? thresholds[MarchCategory.A])) result.push(MarchCategory.A);
    if (march.R >= (thresholdOverride ?? thresholds[MarchCategory.R])) result.push(MarchCategory.R);
    if (march.C >= (thresholdOverride ?? thresholds[MarchCategory.C])) result.push(MarchCategory.C);
    if (march.H >= (thresholdOverride ?? thresholds[MarchCategory.H])) result.push(MarchCategory.H);
    return result;
  }

  /**
   * Full MARCH assessment with recommendation text.
   */
  assess(march: MarchScores): MarchAssessment {
    const total = this.totalScore(march);
    const worst = this.worstCategory(march);
    const critical = this.criticalCategories(march);

    let recommendation: string;
    if (total === 0) {
      recommendation = 'No MARCH deficits identified';
    } else if (worst.score >= 4) {
      recommendation = `Critical: ${worst.category} requires immediate intervention`;
    } else if (critical.length > 0) {
      recommendation = `Priority treatment: ${critical.join(', ')}`;
    } else {
      recommendation = 'Monitor and reassess';
    }

    return {
      totalScore: total,
      maxCategory: worst.category,
      maxScore: worst.score,
      criticalCategories: critical,
      recommendation,
    };
  }

  /**
   * Merge two MARCH scores by taking the worst (highest) value per category.
   * Used in mesh sync conflict resolution.
   */
  mergeWorstScore(a: MarchScores, b: MarchScores): MarchScores {
    return {
      M: Math.max(a.M, b.M),
      A: Math.max(a.A, b.A),
      R: Math.max(a.R, b.R),
      C: Math.max(a.C, b.C),
      H: Math.max(a.H, b.H),
    };
  }

  /**
   * Update a single category score, clamping to 0-5.
   */
  updateScore(march: MarchScores, category: MarchCategory, score: number): MarchScores {
    return {
      ...march,
      [category]: clamp(score, 0, 5),
    };
  }

  /**
   * Create default (empty) MARCH scores.
   */
  createDefault(): MarchScores {
    return { ...DEFAULT_MARCH };
  }

  /**
   * Get the MARCH category labels for display.
   */
  getCategoryLabels(): Record<MarchCategory, string> {
    return {
      [MarchCategory.M]: 'Massive Hemorrhage',
      [MarchCategory.A]: 'Airway',
      [MarchCategory.R]: 'Respiration',
      [MarchCategory.C]: 'Circulation',
      [MarchCategory.H]: 'Hypothermia',
    };
  }
}
