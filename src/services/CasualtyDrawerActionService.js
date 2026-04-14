import { getCasualtyById, getCasualtiesSortedByPriority } from './CasualtyService.js';
import { getState, saveState } from './StateService.js';

export function getTopPriorityCasualtyByPriority(priority) {
  return getCasualtiesSortedByPriority().find((casualty) => casualty.priority === priority) || null;
}

export function getActionTargetCasualty(currentDrawerCasualtyId, priority = 'T1') {
  if (currentDrawerCasualtyId) {
    const currentCasualty = getCasualtyById(currentDrawerCasualtyId);
    if (currentCasualty) {
      return currentCasualty;
    }
  }

  return getTopPriorityCasualtyByPriority(priority);
}

export function deleteCasualtyById(casualtyId) {
  const state = getState();
  if (!state) {
    return null;
  }

  const casualty = getCasualtyById(casualtyId);
  if (!casualty) {
    return null;
  }

  state.casualties = state.casualties.filter((item) => item.id != casualtyId);
  saveState();
  return casualty;
}

export function assignBuddyToCasualty(casualtyId, forceMemberId) {
  const state = getState();
  if (!state) {
    return null;
  }

  const casualty = getCasualtyById(casualtyId);
  const forceMember = (state.force || []).find((member) => member.id == forceMemberId);

  if (!casualty || !forceMember) {
    return null;
  }

  casualty.buddyName = forceMember.name;
  casualty.buddyId = forceMemberId;
  saveState();

  return {
    casualty,
    forceMember,
  };
}

export function appendImmediateTreatment(casualtyId, treatmentType, marchLetter) {
  const casualty = getCasualtyById(casualtyId);
  if (!casualty) {
    return null;
  }

  casualty.txList.push({ type: treatmentType, time: window.nowTime(), ms: Date.now() });
  casualty.march[marchLetter] = (casualty.march[marchLetter] || 0) + 1;
  saveState();

  return casualty;
}

export function markCasualtyExpectant(casualtyId) {
  const casualty = getCasualtyById(casualtyId);
  if (!casualty) {
    return null;
  }

  casualty.priority = 'T4';
  saveState();
  return casualty;
}

export function initCasualtyDrawerActionService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.drawerActionService = {
    getTopPriorityCasualtyByPriority,
    getActionTargetCasualty,
    deleteCasualtyById,
    assignBuddyToCasualty,
    appendImmediateTreatment,
    markCasualtyExpectant,
  };
}