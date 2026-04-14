/**
 * Application-wide constants for BENAM.
 *
 * All magic numbers, configuration values, and lookup tables are centralized
 * here. Legacy code in app.js has duplicated these — during migration, new
 * modules import from this file and legacy code is progressively updated.
 */

import {
  BloodType,
  InjuryType,
  TriagePriority,
  MissionType,
  UserRole,
  type InjuryTypeMetadata,
  type EquipmentCategory,
  type SupplyInventory,
} from '../types';

// ---------------------------------------------------------------------------
// Medical thresholds
// ---------------------------------------------------------------------------

export const MEDICAL = Object.freeze({
  TXA_WINDOW_MIN: 180,
  TXA_WARN_THRESHOLD: 60,
  /** CoTCCC 2023: TQ critical alert at 60 minutes */
  TQ_CRITICAL_SEC: 3600,
  /** CoTCCC 2023: TQ warning alert at 45 minutes */
  TQ_WARN_SEC: 2700,
  MAX_VITALS_HISTORY: 10,
  MAX_TIMELINE_EVENTS: 500,
}) satisfies Record<string, number>;

// ---------------------------------------------------------------------------
// Triage configuration
// ---------------------------------------------------------------------------

export const TRIAGE_PRIORITY_ORDER: readonly TriagePriority[] = [
  TriagePriority.T1,
  TriagePriority.T2,
  TriagePriority.T3,
  TriagePriority.T4,
];

export const TRIAGE_SORT_VALUE: Record<TriagePriority, number> = {
  [TriagePriority.T1]: 1,
  [TriagePriority.T2]: 2,
  [TriagePriority.T3]: 3,
  [TriagePriority.T4]: 4,
};

export const TRIAGE_COLORS: Record<TriagePriority, string> = {
  [TriagePriority.T1]: 'var(--red2)',
  [TriagePriority.T2]: 'var(--orange2)',
  [TriagePriority.T3]: 'var(--green2)',
  [TriagePriority.T4]: '#333',
};

export const TRIAGE_LABELS: Record<TriagePriority, string> = {
  [TriagePriority.T1]: 'IMMEDIATE',
  [TriagePriority.T2]: 'DELAYED',
  [TriagePriority.T3]: 'MINIMAL',
  [TriagePriority.T4]: 'EXPECTANT',
};

// ---------------------------------------------------------------------------
// Blood type compatibility
// ---------------------------------------------------------------------------

export const ALL_BLOOD_TYPES: readonly BloodType[] = [
  BloodType.O_NEG,
  BloodType.O_POS,
  BloodType.A_NEG,
  BloodType.A_POS,
  BloodType.B_NEG,
  BloodType.B_POS,
  BloodType.AB_NEG,
  BloodType.AB_POS,
];

export const BLOOD_COMPATIBILITY: Readonly<Record<BloodType, readonly BloodType[]>> = {
  [BloodType.O_NEG]: ALL_BLOOD_TYPES,
  [BloodType.O_POS]: [BloodType.O_POS, BloodType.A_POS, BloodType.B_POS, BloodType.AB_POS],
  [BloodType.A_NEG]: [BloodType.A_NEG, BloodType.A_POS, BloodType.AB_NEG, BloodType.AB_POS],
  [BloodType.A_POS]: [BloodType.A_POS, BloodType.AB_POS],
  [BloodType.B_NEG]: [BloodType.B_NEG, BloodType.B_POS, BloodType.AB_NEG, BloodType.AB_POS],
  [BloodType.B_POS]: [BloodType.B_POS, BloodType.AB_POS],
  [BloodType.AB_NEG]: [BloodType.AB_NEG, BloodType.AB_POS],
  [BloodType.AB_POS]: [BloodType.AB_POS],
};

// ---------------------------------------------------------------------------
// Injury types
// ---------------------------------------------------------------------------

export const INJURY_TYPES: readonly InjuryTypeMetadata[] = [
  { k: InjuryType.PENETRATING, color: '#c82828', icon: '🔴' },
  { k: InjuryType.SUPERFICIAL, color: '#d06018', icon: '🟠' },
  { k: InjuryType.FRACTURE, color: '#c89010', icon: '🟡' },
  { k: InjuryType.BURN, color: '#8b4513', icon: '🟤' },
  { k: InjuryType.HEMORRHAGE, color: '#8b0000', icon: '⬛' },
  { k: InjuryType.BLAST, color: '#4a4a8a', icon: '🔵' },
  { k: InjuryType.OTHER, color: '#406040', icon: '✏️' },
];

// ---------------------------------------------------------------------------
// Body zones
// ---------------------------------------------------------------------------

export const BODY_ZONES_FRONT = [
  'head', 'neck', 'chest', 'left-arm', 'right-arm', 'abdomen', 'left-leg', 'right-leg',
] as const;

export const BODY_ZONES_BACK = [
  'nape', 'left-back', 'right-back', 'left-buttock', 'right-buttock',
] as const;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.COMMANDER]: 'commander',
  [UserRole.MEDIC]: 'medic',
  [UserRole.DOC]: 'doc',
  [UserRole.PARAMEDIC]: 'paramedic',
};

export const MEDIC_RANK: Readonly<Record<string, number>> = {
  'רופא': 5,
  'פראמדיק': 4,
  'חובש': 3,
  'מח"ר': 2,
  'לורם': 1,
};

// ---------------------------------------------------------------------------
// Mission labels
// ---------------------------------------------------------------------------

export const MISSION_LABELS: Record<MissionType, string> = {
  [MissionType.OPEN]: 'Open Area',
  [MissionType.URBAN]: 'Urban',
  [MissionType.RUINS]: 'Ruins',
  [MissionType.LMS]: 'LMS',
  [MissionType.BASE]: 'Base',
};

// ---------------------------------------------------------------------------
// Default supply inventory
// ---------------------------------------------------------------------------

export const DEFAULT_SUPPLIES: Readonly<SupplyInventory> = Object.freeze({
  TQ: 4,
  Asherman: 2,
  Gauze: 10,
  TXA: 4,
  'NaCl 500': 6,
  Morphine: 3,
  Ketamine: 3,
  NPA: 2,
  Hyfin: 3,
  Bandaids: 20,
});

// ---------------------------------------------------------------------------
// Default vitals
// ---------------------------------------------------------------------------

export const DEFAULT_VITALS = Object.freeze({
  pulse: '',
  spo2: '',
  bp: '',
  rr: '',
  gcs: '15',
  avpu: 'U',
});

// ---------------------------------------------------------------------------
// Default MARCH scores
// ---------------------------------------------------------------------------

export const DEFAULT_MARCH = Object.freeze({
  M: 0,
  A: 0,
  R: 0,
  C: 0,
  H: 0,
});

// ---------------------------------------------------------------------------
// Equipment categories
// ---------------------------------------------------------------------------

export const EQUIPMENT_CATEGORIES: readonly EquipmentCategory[] = [
  {
    k: 'medical',
    label: 'Medical',
    items: [
      { k: 'TQ', label: 'Tourniquet (TQ)' },
      { k: 'Chest Seal', label: 'Chest Seal / Hyfin' },
      { k: 'Bandage', label: 'Pressure Bandage' },
      { k: 'Gauze', label: 'Gauze / QuikClot' },
      { k: 'NPA', label: 'NPA + Lubricant' },
      { k: 'IV', label: 'IV Kit + Infusion' },
      { k: 'TXA', label: 'TXA Ampoule' },
      { k: 'Morphine', label: 'Morphine / Ketamine' },
      { k: 'NaCl', label: 'NaCl 500ml' },
      { k: 'Blanket', label: 'Shock Blanket' },
      { k: 'Gloves', label: 'Gloves' },
      { k: 'SAM', label: 'SAM Splint' },
      { k: 'Defib', label: 'AED Defibrillator' },
    ],
  },
  {
    k: 'weapons',
    label: 'Weapons & Ammo',
    items: [
      { k: 'M16', label: 'M16 / M4' },
      { k: 'Negev', label: 'Negev (MG)' },
      { k: 'Tavor', label: 'Tavor' },
      { k: 'Galil', label: 'Galil ACE' },
      { k: 'Ammo', label: 'Ammo x6 Magazines' },
      { k: 'Grenade', label: 'Grenade' },
      { k: 'Smoke', label: 'Smoke Grenade' },
      { k: 'AT', label: 'RPG / LAW / MATADOR' },
      { k: 'Pistol', label: 'Pistol + Magazine' },
    ],
  },
  {
    k: 'combat-gear',
    label: 'Combat Gear',
    items: [
      { k: 'Vest', label: 'Combat Vest' },
      { k: 'Helmet', label: 'Combat Helmet' },
      { k: 'NVG', label: 'Night Vision (NVG)' },
      { k: 'Radio', label: 'Radio' },
      { k: 'GPS', label: 'Handheld GPS' },
      { k: 'Torch', label: 'Tactical Torch' },
      { k: 'Binos', label: 'Binoculars' },
      { k: 'Marker', label: 'IR Marker / Laser' },
    ],
  },
  {
    k: 'logistics',
    label: 'Logistics',
    items: [
      { k: 'Water', label: 'Water 3L' },
      { k: 'Food', label: 'Field Rations' },
      { k: 'Battery', label: 'Spare Batteries' },
      { k: 'Map', label: 'Map + Pencil' },
      { k: 'Poncho', label: 'Poncho / Blanket' },
    ],
  },
];

// ---------------------------------------------------------------------------
// AI advisor thresholds
// ---------------------------------------------------------------------------

export const AI_TACTICAL_THRESHOLDS = Object.freeze({
  tqWatchMin: 30,
  tqDangerMin: 45,
  tqCriticalMin: 60,
  txaAdvisorDelayMin: 5,
  txaActionDelayMin: 3,
  t2DeteriorationMin: 30,
  noTreatmentMin: 10,
  hypothermiaAlertMin: 15,
  nineLineMissingMin: 20,
  goldenHourWarnMin: 50,
  goldenHourCriticalMin: 60,
  casPerMedicWarn: 3,
  maxVisibleAlerts: 8,
});

// ---------------------------------------------------------------------------
// QR sync constants
// ---------------------------------------------------------------------------

export const QR_CHUNK_SIZE = 800;
export const QR_ERROR_CORRECTION = 'L';

// ---------------------------------------------------------------------------
// Timeline color map (CSS variable lookup)
// ---------------------------------------------------------------------------

export const TIMELINE_DOT_COLORS: Readonly<Record<string, string>> = {
  red: 'var(--red3)',
  amber: 'var(--amber3)',
  green: 'var(--green3)',
  olive: 'var(--olive3)',
  muted: 'var(--muted)',
};
