function readLegacyGlobal(name) {
  if (window[name] !== undefined) {
    return window[name];
  }
  try {
    return window.eval(`typeof ${name} === 'undefined' ? undefined : ${name}`);
  } catch (_) {
    return undefined;
  }
}

export function getState() {
  if (window.BENAM_LEGACY?.getState) {
    return window.BENAM_LEGACY.getState();
  }

  if (typeof window.getLegacyState === 'function') {
    const getterState = window.getLegacyState();
    if (getterState) {
      return getterState;
    }
  }

  return window.S || readLegacyGlobal('S');
}

export function getStorageKey() {
  if (typeof window._storageKey === 'function') {
    return window._storageKey();
  }

  const state = getState();
  return state?.opMode === 'training' ? 'benam_s_training' : 'benam_s';
}

export function saveState() {
  if (typeof window.saveState === 'function') {
    return window.saveState();
  }

  return undefined;
}

export function loadState() {
  if (typeof window.loadState === 'function') {
    return window.loadState();
  }

  return undefined;
}

export function getCasualties() {
  return getState()?.casualties || [];
}

export function getForceRoster() {
  return getState()?.force || [];
}

export function getTimelineEntries() {
  return getState()?.timeline || [];
}

export function getSupplies() {
  return getState()?.supplies || {};
}

export function getMissionSnapshot() {
  const state = getState();
  if (!state) {
    return null;
  }

  return {
    missionActive: !!state.missionActive,
    missionStart: state.missionStart || null,
    role: state.role || null,
    opMode: state.opMode || null,
    missionType: state.missionType || null,
  };
}

export function initStateService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.stateService = {
    getState,
    getStorageKey,
    saveState,
    loadState,
    getCasualties,
    getForceRoster,
    getTimelineEntries,
    getSupplies,
    getMissionSnapshot,
  };
}