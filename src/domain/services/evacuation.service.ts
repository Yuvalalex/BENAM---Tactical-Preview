/**
 * Evacuation Service — 9-LINE MEDEVAC, evacuation pipeline, slot management.
 *
 * Pure business logic for managing casualty evacuation lifecycle.
 */

import {
  type Casualty,
  type CasualtyId,
  type CommsData,
  type EvacPipeline,
  TriagePriority,
  EvacStage,
} from '../../core/types';
import { formatTime } from '../../core/utils';

export interface EvacSlot {
  readonly id: number;
  readonly casId: CasualtyId | null;
}

export interface NineLineReport {
  readonly location: string;
  readonly frequency: string;
  readonly heloFrequency: string;
  readonly patientCounts: Record<TriagePriority, number>;
  readonly specialEquipment: string[];
  readonly lzCoordinates: string;
  readonly security: string;
  readonly marking: string;
  readonly nationality: string;
  readonly terrain: string;
  readonly casualties: readonly Casualty[];
  readonly generatedAt: string;
  readonly unit: string;
}

export class EvacuationService {
  private readonly maxSlots = 4;

  /**
   * Create an empty evacuation pipeline.
   */
  createPipeline(): EvacPipeline {
    return {
      stage: EvacStage.INJURY,
      times: { injury: '', hospital: '', done: '' },
    };
  }

  /**
   * Advance a pipeline to the next stage.
   */
  advanceStage(pipeline: EvacPipeline): EvacPipeline {
    const now = formatTime();

    switch (pipeline.stage) {
      case EvacStage.INJURY:
        return {
          stage: EvacStage.HOSPITAL,
          times: { ...pipeline.times, injury: now },
        };
      case EvacStage.HOSPITAL:
        return {
          stage: EvacStage.DONE,
          times: { ...pipeline.times, hospital: now },
        };
      case EvacStage.DONE:
        return {
          ...pipeline,
          times: { ...pipeline.times, done: now },
        };
      default:
        return pipeline;
    }
  }

  /**
   * Create initial evacuation slots (empty).
   */
  createSlots(): EvacSlot[] {
    return Array.from({ length: this.maxSlots }, (_, i) => ({
      id: i + 1,
      casId: null,
    }));
  }

  /**
   * Assign a casualty to the first available slot.
   */
  assignToSlot(
    slots: readonly EvacSlot[],
    casId: CasualtyId,
  ): EvacSlot[] | null {
    const mutable = slots.map((s) => ({ ...s }));
    const emptySlot = mutable.find((s) => s.casId === null);
    if (!emptySlot) return null;
    emptySlot.casId = casId;
    return mutable;
  }

  /**
   * Remove a casualty from their slot.
   */
  removeFromSlot(
    slots: readonly EvacSlot[],
    casId: CasualtyId,
  ): EvacSlot[] {
    return slots.map((s) =>
      s.casId === casId ? { ...s, casId: null } : { ...s },
    );
  }

  /**
   * Build a 9-LINE MEDEVAC report from current state.
   */
  buildNineLine(
    casualties: readonly Casualty[],
    comms: CommsData,
  ): NineLineReport {
    const counts: Record<TriagePriority, number> = {
      [TriagePriority.T1]: 0,
      [TriagePriority.T2]: 0,
      [TriagePriority.T3]: 0,
      [TriagePriority.T4]: 0,
    };

    const allergies: string[] = [];
    for (const cas of casualties) {
      counts[cas.priority]++;
      if (cas.allergy) {
        allergies.push(`${cas.name}(${cas.allergy})`);
      }
    }

    return {
      location: comms.lz1 || 'TBD',
      frequency: comms.mahup || 'TBD',
      heloFrequency: comms.helo || 'TBD',
      patientCounts: counts,
      specialEquipment: allergies,
      lzCoordinates: comms.lz1 || 'TBD',
      security: 'UNKNOWN',
      marking: 'PENDING',
      nationality: 'IDF',
      terrain: 'FLAT',
      casualties,
      generatedAt: formatTime(),
      unit: comms.unit || '',
    };
  }

  /**
   * Prioritize evacuation order (T1 first, then by time added).
   */
  prioritizeEvacOrder(casualties: readonly Casualty[]): Casualty[] {
    const evacuable = casualties.filter(
      (c) => c.priority !== TriagePriority.T4 && !c.evacuated,
    );

    return [...evacuable].sort((a, b) => {
      const pA = a.priority === TriagePriority.T1 ? 0 : a.priority === TriagePriority.T2 ? 1 : 2;
      const pB = b.priority === TriagePriority.T1 ? 0 : b.priority === TriagePriority.T2 ? 1 : 2;
      if (pA !== pB) return pA - pB;
      return a._addedAt - b._addedAt;
    });
  }
}
