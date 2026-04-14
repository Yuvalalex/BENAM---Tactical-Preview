/**
 * Equipment, decision tree, and injury metadata types.
 */

import { type InjuryType } from './enums';

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

export interface EquipmentItem {
  readonly k: string;
  readonly label: string;
}

export interface EquipmentCategory {
  readonly k: string;
  readonly label: string;
  readonly items: readonly EquipmentItem[];
}

// ---------------------------------------------------------------------------
// Decision tree types (MARCH protocol)
// ---------------------------------------------------------------------------

export interface DecisionNode {
  readonly q?: string;
  readonly action?: string;
  readonly yes?: string;
  readonly no?: string;
  readonly done?: boolean;
  readonly next?: string;
}

export interface DecisionPhase {
  readonly label: string;
  readonly color: string;
  readonly nodes: Record<string, DecisionNode>;
}

// ---------------------------------------------------------------------------
// Injury metadata
// ---------------------------------------------------------------------------

export interface InjuryTypeMetadata {
  readonly k: InjuryType;
  readonly color: string;
  readonly icon: string;
}
