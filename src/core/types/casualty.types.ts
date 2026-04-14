/**
 * Casualty-related types and core identifiers.
 *
 * Contains the Casualty entity — the central domain object — plus
 * all supporting value objects (MarchScores, Vitals, Injury, etc.)
 * and shared ID type aliases.
 */

import {
  type TriagePriority,
  type BloodType,
  type InjuryType,
  type BodySide,
  type EvacStage,
} from './enums';

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export type CasualtyId = number;
export type ForceId = number;
export type CommsLogId = number;
export type Timestamp = number;

// ---------------------------------------------------------------------------
// Value objects
// ---------------------------------------------------------------------------

export interface MarchScores {
  readonly M: number;
  readonly A: number;
  readonly R: number;
  readonly C: number;
  readonly H: number;
}

export interface Vitals {
  readonly pulse: string;
  readonly spo2: string;
  readonly bp: string;
  readonly rr: string;
  readonly gcs: string;
  readonly avpu: string;
}

export interface BodyCoordinate {
  readonly cx: number;
  readonly cy: number;
}

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

export interface Injury {
  readonly type: InjuryType;
  readonly zone: string;
  readonly cx: number;
  readonly cy: number;
  readonly side: BodySide;
}

export interface Treatment {
  readonly type: string;
  readonly time: string;
}

export interface Fluid {
  readonly type: string;
  readonly time: string;
}

export interface EvacPipeline {
  readonly stage: EvacStage;
  readonly times: {
    readonly injury: string;
    readonly hospital: string;
    readonly done: string;
  };
}

export interface Casualty {
  readonly id: CasualtyId;
  readonly name: string;
  readonly idNum: string;
  readonly kg: number;
  readonly blood: BloodType | string;
  readonly allergy: string;
  readonly priority: TriagePriority;
  readonly time: string;
  readonly tqStart: Timestamp | null;
  readonly txList: readonly Treatment[];
  readonly injuries: readonly Injury[];
  readonly vitals: Vitals;
  readonly vitalsHistory: readonly Vitals[];
  readonly march: MarchScores;
  readonly fluids: readonly Fluid[];
  readonly fluidTotal: number;
  readonly medic: string;
  readonly buddyName: string;
  readonly evacType: string;
  readonly escalated: boolean;
  readonly evacuated: boolean;
  readonly evacPipeline: EvacPipeline;
  readonly mech: readonly string[];
  readonly photos: readonly (string | Blob)[];
  readonly notes: string;
  readonly gps: string;
  readonly _addedAt: Timestamp;
}
