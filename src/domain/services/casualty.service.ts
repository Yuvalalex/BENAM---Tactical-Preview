/**
 * Casualty Service — Core casualty CRUD and business operations.
 *
 * Centralized logic for creating, updating, and querying casualties.
 * All mutation operations return new objects (immutable pattern).
 */

import {
  type Casualty,
  type CasualtyId,
  type Vitals,
  type MarchScores,
  type Treatment,
  type Injury,
  type EvacPipeline,
  TriagePriority,
  EvacStage,
  BloodType,
} from '../../core/types';
import { DEFAULT_VITALS, DEFAULT_MARCH } from '../../core/constants';
import { generateId, formatTime } from '../../core/utils';

export interface CreateCasualtyParams {
  readonly name: string;
  readonly priority?: TriagePriority;
  readonly blood?: string;
  readonly kg?: number;
  readonly idNum?: string;
  readonly allergy?: string;
}

export class CasualtyService {
  /**
   * Create a new casualty with defaults.
   */
  create(params: CreateCasualtyParams): Casualty {
    return {
      id: generateId(),
      name: params.name,
      idNum: params.idNum ?? '',
      kg: params.kg ?? 70,
      blood: params.blood ?? '',
      allergy: params.allergy ?? '',
      priority: params.priority ?? TriagePriority.T2,
      time: formatTime(),
      tqStart: null,
      txList: [],
      injuries: [],
      vitals: { ...DEFAULT_VITALS },
      vitalsHistory: [],
      march: { ...DEFAULT_MARCH },
      fluids: [],
      fluidTotal: 0,
      medic: '',
      buddyName: '',
      evacType: '',
      escalated: false,
      evacuated: false,
      evacPipeline: {
        stage: EvacStage.INJURY,
        times: { injury: '', hospital: '', done: '' },
      },
      mech: [],
      photos: [],
      notes: '',
      gps: '',
      _addedAt: Date.now(),
    };
  }

  /**
   * Update specific fields on a casualty (immutable).
   */
  update(casualty: Casualty, updates: Partial<Casualty>): Casualty {
    return { ...casualty, ...updates };
  }

  /**
   * Add a treatment to a casualty.
   */
  addTreatment(casualty: Casualty, type: string): Casualty {
    const treatment: Treatment = { type, time: formatTime() };
    return {
      ...casualty,
      txList: [...casualty.txList, treatment],
    };
  }

  /**
   * Add an injury to a casualty.
   */
  addInjury(casualty: Casualty, injury: Injury): Casualty {
    return {
      ...casualty,
      injuries: [...casualty.injuries, injury],
    };
  }

  /**
   * Record a vitals snapshot.
   */
  recordVitals(casualty: Casualty, vitals: Vitals): Casualty {
    const history = [...casualty.vitalsHistory, casualty.vitals];
    const trimmedHistory = history.length > 10 ? history.slice(-10) : history;

    return {
      ...casualty,
      vitals,
      vitalsHistory: trimmedHistory,
    };
  }

  /**
   * Update MARCH scores.
   */
  updateMarch(casualty: Casualty, march: MarchScores): Casualty {
    return { ...casualty, march };
  }

  /**
   * Change triage priority.
   */
  changePriority(casualty: Casualty, priority: TriagePriority): Casualty {
    const escalated =
      casualty.priority === TriagePriority.T2 && priority === TriagePriority.T1;

    return {
      ...casualty,
      priority,
      escalated: escalated || casualty.escalated,
    };
  }

  /**
   * Start tourniquet timer.
   */
  startTQ(casualty: Casualty): Casualty {
    return {
      ...casualty,
      tqStart: Date.now(),
      txList: [...casualty.txList, { type: 'TQ', time: formatTime() }],
    };
  }

  /**
   * Add fluid administration.
   */
  addFluid(casualty: Casualty, fluidType: string, mlAmount: number): Casualty {
    return {
      ...casualty,
      fluids: [...casualty.fluids, { type: fluidType, time: formatTime() }],
      fluidTotal: casualty.fluidTotal + mlAmount,
    };
  }

  /**
   * Assign a medic to a casualty.
   */
  assignMedic(casualty: Casualty, medicName: string): Casualty {
    return { ...casualty, medic: medicName };
  }

  /**
   * Find a casualty by ID in a list.
   */
  findById(casualties: readonly Casualty[], id: CasualtyId): Casualty | undefined {
    return casualties.find((c) => c.id === id);
  }

  /**
   * Find a casualty by name (case-insensitive).
   */
  findByName(casualties: readonly Casualty[], name: string): Casualty | undefined {
    const normalized = name.trim().toLowerCase();
    return casualties.find((c) => c.name.trim().toLowerCase() === normalized);
  }

  /**
   * Remove a casualty by ID.
   */
  remove(casualties: readonly Casualty[], id: CasualtyId): Casualty[] {
    return casualties.filter((c) => c.id !== id);
  }

  /**
   * Get casualties without assigned medics.
   */
  unassigned(casualties: readonly Casualty[]): Casualty[] {
    return casualties.filter((c) => !c.medic);
  }

  /**
   * Get casualties with active tourniquet.
   */
  withActiveTQ(casualties: readonly Casualty[]): Casualty[] {
    return casualties.filter((c) => c.tqStart !== null);
  }
}
