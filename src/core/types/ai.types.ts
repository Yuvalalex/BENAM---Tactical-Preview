/**
 * AI Advisor types for tactical decision support.
 */

export interface AIAlert {
  readonly p: number;
  readonly icon: string;
  readonly text: string;
  readonly color: string;
}

export interface AITacticalThresholds {
  readonly tqWatchMin: number;
  readonly tqDangerMin: number;
  readonly tqCriticalMin: number;
  readonly txaAdvisorDelayMin: number;
  readonly txaActionDelayMin: number;
  readonly t2DeteriorationMin: number;
  readonly noTreatmentMin: number;
  readonly hypothermiaAlertMin: number;
  readonly nineLineMissingMin: number;
  readonly goldenHourWarnMin: number;
  readonly goldenHourCriticalMin: number;
  readonly casPerMedicWarn: number;
  readonly maxVisibleAlerts: number;
}
