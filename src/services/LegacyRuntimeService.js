import { BLOOD_COMPATIBILITY_MATRIX, ALL_BLOOD_TYPES } from '../constants/BloodCompatibilityMatrix.js';
import { MEDICAL_CONSTANTS } from '../constants/MedicalConstants.js';
import { escapeHtml, getElement, padTwoDigits } from '../utils/DomHelper.js';

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

function ensureLegacyNamespace() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.getState = () => {
    if (typeof window.getLegacyState === 'function') {
      const getterState = window.getLegacyState();
      if (getterState) {
        return getterState;
      }
    }

    return window.S || readLegacyGlobal('S');
  };
  window.BENAM_LEGACY.getMedicalConstants = () => window.MEDICAL || readLegacyGlobal('MEDICAL') || MEDICAL_CONSTANTS;
  window.BENAM_LEGACY.getBloodCompatibility = () => window.BLOOD_COMPAT || readLegacyGlobal('BLOOD_COMPAT') || BLOOD_COMPATIBILITY_MATRIX;
  window.BENAM_LEGACY.getBloodTypes = () => window.ALL_BT || readLegacyGlobal('ALL_BT') || ALL_BLOOD_TYPES;
  window.BENAM_LEGACY.dom = {
    getElement,
    padTwoDigits,
    escapeHtml,
  };
}

export function syncLegacyRuntime() {
  const getterState = typeof window.getLegacyState === 'function' ? window.getLegacyState() : undefined;
  const lexicalState = readLegacyGlobal('S');
  const resolvedState = getterState || lexicalState;

  if (!window.S && resolvedState) {
    window.S = resolvedState;
  }

  if (!window.S && typeof window.loadState === 'function') {
    try {
      window.loadState();
    } catch (error) {
      console.error('[BENAM] Failed to restore legacy state before bridge init', error);
    }
  }

  if (!window.MEDICAL) {
    window.MEDICAL = readLegacyGlobal('MEDICAL') || MEDICAL_CONSTANTS;
  }

  if (!window.BLOOD_COMPAT) {
    window.BLOOD_COMPAT = readLegacyGlobal('BLOOD_COMPAT') || BLOOD_COMPATIBILITY_MATRIX;
  }

  if (!window.ALL_BT) {
    window.ALL_BT = readLegacyGlobal('ALL_BT') || ALL_BLOOD_TYPES;
  }

  ensureLegacyNamespace();
}