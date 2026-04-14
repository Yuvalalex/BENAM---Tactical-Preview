import { getForceRoster } from './StateService.js';

export function getForceMemberPrefill(forceMemberId) {
  return getForceRoster().find((member) => member.id == forceMemberId) || null;
}

export function createCasualtyRecord({
  name,
  identifier,
  weightKg,
  bloodType,
  allergy,
  priority,
  mechanisms,
  nextCasualtyId,
  nowTime,
  nowTimestamp,
}) {
  return {
    id: nextCasualtyId,
    name,
    idNum: identifier,
    kg: Number.parseFloat(weightKg) || 70,
    blood: bloodType,
    allergy,
    priority,
    mech: mechanisms,
    time: nowTime,
    tqStart: null,
    txList: [],
    injuries: [],
    photos: [],
    vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
    fluids: [],
    fluidTotal: 0,
    march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
    vitalsHistory: [],
    _addedAt: nowTimestamp,
    evacType: '',
    medic: '',
    buddyName: '',
  };
}

export function initCasualtyCreationService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.casualtyCreationService = {
    getForceMemberPrefill,
    createCasualtyRecord,
  };
}