import { APP_MODES } from './AppModeConstants.js';

export const MISSION_PHASES = Object.freeze({
  PREP: { label: 'PREP', className: 'ph-prep', mode: APP_MODES.PREP },
  ACTIVE: { label: 'ACTIVE', className: 'ph-active', mode: APP_MODES.OPERATIONAL },
  POST: { label: 'POST', className: 'ph-post', mode: APP_MODES.POST },
});

export const MISSION_KEYS = Object.freeze({
  START: 'missionStart',
  ACTIVE: 'missionActive',
  TYPE: 'missionType',
});