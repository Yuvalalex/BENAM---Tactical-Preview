import { getState, saveState } from './StateService.js';

export function startMission() {
  if (typeof window.startMission === 'function') {
    return window.startMission();
  }

  const state = getState();
  if (!state) {
    return undefined;
  }

  state.missionStart = Date.now();
  state.missionActive = true;
  saveState();
  return state;
}

export function endMission() {
  if (typeof window.endMission === 'function') {
    return window.endMission();
  }

  const state = getState();
  if (!state) {
    return undefined;
  }

  state.missionActive = false;
  saveState();
  return state;
}

export function toggleMissionQuick() {
  if (typeof window.toggleMissionQuick === 'function') {
    return window.toggleMissionQuick();
  }

  const state = getState();
  if (!state) {
    return undefined;
  }

  return state.missionActive ? endMission() : startMission();
}

export function resetMissionData() {
  if (typeof window.resetMission === 'function') {
    return window.resetMission();
  }

  const state = getState();
  if (!state) {
    return undefined;
  }

  state.casualties = [];
  state.timeline = [];
  state.missionStart = null;
  state.missionActive = false;
  saveState();
  return state;
}

export function initMissionLifecycleService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.missionLifecycleService = {
    startMission,
    endMission,
    toggleMissionQuick,
    resetMissionData,
  };
}