import { getState } from './StateService.js';

const PRIORITY_ORDER = {
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

export function getCasualties() {
  return getState()?.casualties || [];
}

export function getCasualtyById(casualtyId) {
  return getCasualties().find((casualty) => casualty.id == casualtyId) || null;
}

export function ensureCasualtyDefaults(casualty) {
  if (!casualty) {
    return null;
  }

  if (!casualty.vitals || typeof casualty.vitals !== 'object') {
    casualty.vitals = { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' };
  }

  if (!Array.isArray(casualty.mech)) {
    casualty.mech = [];
  }

  if (!Array.isArray(casualty.injuries)) {
    casualty.injuries = [];
  }

  if (!Array.isArray(casualty.photos)) {
    casualty.photos = [];
  }

  if (!Array.isArray(casualty.txList)) {
    casualty.txList = [];
  }

  if (!Array.isArray(casualty.fluids)) {
    casualty.fluids = [];
  }

  if (!Array.isArray(casualty.vitalsHistory)) {
    casualty.vitalsHistory = [];
  }

  if (!casualty.march || typeof casualty.march !== 'object') {
    casualty.march = { M: 0, A: 0, R: 0, C: 0, H: 0 };
  }

  if (typeof casualty.fluidTotal !== 'number') {
    casualty.fluidTotal = 0;
  }

  return casualty;
}

export function getNormalizedCasualtyById(casualtyId) {
  return ensureCasualtyDefaults(getCasualtyById(casualtyId));
}

export function getPriorityRank(priority) {
  return PRIORITY_ORDER[priority] || 5;
}

export function getCasualtiesSortedByPriority() {
  return [...getCasualties()].sort((left, right) => getPriorityRank(left.priority) - getPriorityRank(right.priority));
}

export function getAdjacentCasualtyId(currentCasualtyId, direction) {
  const sortedCasualties = getCasualtiesSortedByPriority();
  const currentIndex = sortedCasualties.findIndex((casualty) => casualty.id == currentCasualtyId);
  const nextCasualty = sortedCasualties[currentIndex + direction];
  return nextCasualty ? nextCasualty.id : null;
}

export function getHighestPriorityCasualty() {
  return getCasualtiesSortedByPriority()[0] || null;
}

export function initCasualtyService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.casualtyService = {
    getCasualties,
    getCasualtyById,
    getNormalizedCasualtyById,
    ensureCasualtyDefaults,
    getPriorityRank,
    getCasualtiesSortedByPriority,
    getAdjacentCasualtyId,
    getHighestPriorityCasualty,
  };
}