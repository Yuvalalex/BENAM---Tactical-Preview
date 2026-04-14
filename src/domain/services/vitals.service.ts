/**
 * Vitals Monitoring Service.
 *
 * Manages vital sign recording, history tracking, and trend analysis.
 * Pure business logic with no DOM dependencies.
 */

import { type Vitals, type Casualty } from '../../core/types';
import { DEFAULT_VITALS, MEDICAL } from '../../core/constants';

export enum VitalsTrend {
  STABLE = 'STABLE',
  IMPROVING = 'IMPROVING',
  DETERIORATING = 'DETERIORATING',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
}

export interface VitalsSnapshot {
  readonly vitals: Vitals;
  readonly timestamp: number;
}

export interface VitalsAnalysis {
  readonly current: Vitals;
  readonly historyCount: number;
  readonly pulseTrend: VitalsTrend;
  readonly spo2Trend: VitalsTrend;
  readonly gcsTrend: VitalsTrend;
  readonly overallStatus: 'STABLE' | 'WARNING' | 'CRITICAL';
}

export class VitalsService {
  /**
   * Create a default (empty) vitals object.
   */
  createDefault(): Vitals {
    return { ...DEFAULT_VITALS };
  }

  /**
   * Merge new readings into existing vitals (non-empty fields only).
   */
  mergeReadings(existing: Vitals, update: Partial<Vitals>): Vitals {
    return {
      pulse: update.pulse || existing.pulse,
      spo2: update.spo2 || existing.spo2,
      bp: update.bp || existing.bp,
      rr: update.rr || existing.rr,
      gcs: update.gcs || existing.gcs,
      avpu: update.avpu || existing.avpu,
    };
  }

  /**
   * Analyze vitals trend from history.
   */
  analyzeTrend(history: readonly Vitals[]): VitalsAnalysis {
    const current = history.length > 0 ? history[history.length - 1] : this.createDefault();

    if (history.length < 2) {
      return {
        current,
        historyCount: history.length,
        pulseTrend: VitalsTrend.INSUFFICIENT_DATA,
        spo2Trend: VitalsTrend.INSUFFICIENT_DATA,
        gcsTrend: VitalsTrend.INSUFFICIENT_DATA,
        overallStatus: 'STABLE',
      };
    }

    const prev = history[history.length - 2];
    const pulseTrend = this.numericTrend(prev.pulse, current.pulse, 'lower-better');
    const spo2Trend = this.numericTrend(prev.spo2, current.spo2, 'higher-better');
    const gcsTrend = this.numericTrend(prev.gcs, current.gcs, 'higher-better');

    const overallStatus = this.deriveOverallStatus(current, pulseTrend, spo2Trend, gcsTrend);

    return {
      current,
      historyCount: history.length,
      pulseTrend,
      spo2Trend,
      gcsTrend,
      overallStatus,
    };
  }

  /**
   * Check if vitals indicate a critical state.
   */
  isCritical(vitals: Vitals): boolean {
    const pulse = parseInt(vitals.pulse, 10);
    const spo2 = parseInt(vitals.spo2, 10);
    const gcs = parseInt(vitals.gcs, 10);

    if (!isNaN(pulse) && (pulse > 120 || pulse < 50)) return true;
    if (!isNaN(spo2) && spo2 < 90) return true;
    if (!isNaN(gcs) && gcs < 9) return true;

    return false;
  }

  /**
   * Maximum history entries to store.
   */
  get maxHistory(): number {
    return MEDICAL.MAX_VITALS_HISTORY;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private numericTrend(
    prev: string,
    current: string,
    direction: 'higher-better' | 'lower-better',
  ): VitalsTrend {
    const p = parseInt(prev, 10);
    const c = parseInt(current, 10);

    if (isNaN(p) || isNaN(c)) return VitalsTrend.INSUFFICIENT_DATA;

    const diff = c - p;
    if (Math.abs(diff) < 2) return VitalsTrend.STABLE;

    if (direction === 'higher-better') {
      return diff > 0 ? VitalsTrend.IMPROVING : VitalsTrend.DETERIORATING;
    }
    return diff < 0 ? VitalsTrend.IMPROVING : VitalsTrend.DETERIORATING;
  }

  private deriveOverallStatus(
    vitals: Vitals,
    ...trends: VitalsTrend[]
  ): 'STABLE' | 'WARNING' | 'CRITICAL' {
    if (this.isCritical(vitals)) return 'CRITICAL';
    if (trends.some((t) => t === VitalsTrend.DETERIORATING)) return 'WARNING';
    return 'STABLE';
  }
}
