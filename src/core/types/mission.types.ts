/**
 * Mission, force, communication, and application state types.
 *
 * Contains types for the overall application state, force members,
 * timeline events, communications, supply inventory, and mesh sync.
 */

import {
  type UserRole,
  type OperationMode,
  type MissionType,
  type BloodType,
  type TimelineColor,
  type LZStatus,
  type QRPacketKind,
} from './enums';

import {
  type CasualtyId,
  type ForceId,
  type CommsLogId,
  type Timestamp,
  type Casualty,
  type Vitals,
} from './casualty.types';

// ---------------------------------------------------------------------------
// Force
// ---------------------------------------------------------------------------

export interface ForceMember {
  readonly id: ForceId;
  readonly name: string;
  readonly idNum: string;
  readonly kg: number;
  readonly blood: BloodType | string;
  readonly ironNum: string;
  readonly ironPair: string;
  readonly allergy: string;
  readonly role: string;
  readonly equip: readonly string[];
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  readonly casId: CasualtyId | 'sys';
  readonly name: string;
  readonly what: string;
  readonly color: TimelineColor;
  readonly time: string;
  readonly ms?: Timestamp;
  readonly who?: string;
}

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export interface CommsData {
  readonly unit: string;
  readonly mahup: string;
  readonly helo: string;
  readonly lz1: string;
  readonly lz2: string;
}

export interface CommsLogEntry {
  readonly id: CommsLogId;
  readonly time: string;
  readonly type: string;
  readonly content: string;
}

export interface LZStatusEntry {
  readonly status: LZStatus;
  readonly responsible: string;
}

// ---------------------------------------------------------------------------
// Supply inventory
// ---------------------------------------------------------------------------

export interface SupplyInventory {
  readonly TQ: number;
  readonly Asherman: number;
  readonly Gauze: number;
  readonly TXA: number;
  readonly 'NaCl 500': number;
  readonly Morphine: number;
  readonly Ketamine: number;
  readonly NPA: number;
  readonly Hyfin: number;
  readonly Bandaids: number;
  readonly [key: string]: number;
}

// ---------------------------------------------------------------------------
// Mesh / QR sync types
// ---------------------------------------------------------------------------

export interface MeshPayload {
  readonly kind: QRPacketKind;
  readonly format: string;
  readonly unit: string;
  readonly exportedAt: Timestamp;
  readonly sincets: Timestamp;
  readonly casualties: readonly Casualty[];
  readonly timeline: readonly TimelineEvent[];
  readonly comms: CommsData;
  readonly supplies: SupplyInventory;
  readonly missionStart: Timestamp | null;
}

export interface QRBundle {
  readonly json: string;
  readonly chunks: readonly string[];
  readonly size: number;
  readonly hash: string;
}

// ---------------------------------------------------------------------------
// Application state (mirrors legacy S object)
// ---------------------------------------------------------------------------

export interface AppState {
  readonly force: readonly ForceMember[];
  readonly casualties: readonly Casualty[];
  readonly timeline: readonly TimelineEvent[];
  readonly comms: CommsData;
  readonly supplies: SupplyInventory;
  readonly view: string;
  readonly role: UserRole | null;
  readonly opMode: OperationMode | null;
  readonly missionType: MissionType | null;
  readonly missionStart: Timestamp | null;
  readonly missionActive: boolean;
  readonly fireMode: boolean;
  readonly commsLog: readonly CommsLogEntry[];
  readonly lzStatus: Record<string, LZStatusEntry>;
  readonly medicAssignment: Record<string, string>;
  readonly meshReceived: readonly MeshPayload[];
}
