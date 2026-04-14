export const EVACUATION_STAGES = Object.freeze([
  { key: 'triage', label: 'Triage', color: '#c82828' },
  { key: 'stabilization', label: 'Stabilization', color: '#c89010' },
  { key: 'packaging', label: 'Packaging', color: '#3f7f2f' },
  { key: 'transport', label: 'Transport', color: '#2d5bd8' },
  { key: 'handoff', label: 'Handoff', color: '#6f5aa5' },
  { key: 'complete', label: 'Complete', color: '#4a6640' },
]);

export const EVACUATION_STAGE_INDEX = Object.freeze(
  EVACUATION_STAGES.reduce((acc, stage, index) => {
    acc[stage.key] = index;
    return acc;
  }, {}),
);