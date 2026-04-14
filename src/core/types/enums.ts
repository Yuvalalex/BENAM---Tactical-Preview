/**
 * Core enums for BENAM domain types.
 *
 * Centralized enum definitions used across all layers.
 * Hebrew string values match legacy app.js for backward compatibility.
 */

export enum TriagePriority {
  T1 = 'T1',
  T2 = 'T2',
  T3 = 'T3',
  T4 = 'T4',
}

export enum MarchCategory {
  M = 'M',
  A = 'A',
  R = 'R',
  C = 'C',
  H = 'H',
}

export enum BloodType {
  O_NEG = 'O-',
  O_POS = 'O+',
  A_NEG = 'A-',
  A_POS = 'A+',
  B_NEG = 'B-',
  B_POS = 'B+',
  AB_NEG = 'AB-',
  AB_POS = 'AB+',
}

export enum InjuryType {
  PENETRATING = '\u05D7\u05D3\u05D9\u05E8\u05E0\u05D9',
  SUPERFICIAL = '\u05E9\u05D8\u05D7\u05D9',
  FRACTURE = '\u05E9\u05D1\u05E8',
  BURN = '\u05DB\u05D5\u05D5\u05D9\u05D4',
  HEMORRHAGE = '\u05D3\u05D9\u05DE\u05D5\u05DD',
  BLAST = '\u05D1\u05DC\u05D0\u05E1\u05D8',
  OTHER = '\u05D0\u05D7\u05E8',
}

export enum BodySide {
  FRONT = 'front',
  BACK = 'back',
}

export enum EvacStage {
  INJURY = 'injury',
  HOSPITAL = 'hospital',
  DONE = 'done',
}

export enum UserRole {
  COMMANDER = 'commander',
  MEDIC = 'medic',
  DOC = 'doc',
  PARAMEDIC = 'paramedic',
}

export enum OperationMode {
  TRAINING = 'training',
  OPERATIONAL = 'operational',
}

export enum MissionType {
  OPEN = 'open',
  URBAN = 'urban',
  RUINS = 'ruins',
  LMS = 'lms',
  BASE = 'base',
}

export enum AVPU {
  ALERT = 'A',
  VERBAL = 'V',
  PAIN = 'P',
  UNRESPONSIVE = 'U',
}

export enum LZStatus {
  STANDBY = 'standby',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

export enum TimelineColor {
  RED = 'red',
  AMBER = 'amber',
  GREEN = 'green',
  OLIVE = 'olive',
  MUTED = 'muted',
}

export enum QRPacketKind {
  STATE = 'BENAM_STATE',
  MESH = 'BENAM_MESH',
}
