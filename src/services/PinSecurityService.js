import { getState } from './StateService.js';

const PIN_KEY = 'benam_pin';
const PIN_ATTEMPTS_KEY = 'benam_pin_attempts';
const PIN_LOCKOUT_KEY = 'benam_pin_lockout';

export function hashPin(pin) {
  if (typeof window.hashPin === 'function') {
    return window.hashPin(pin);
  }

  let hash = 5381;
  const value = String(pin || '');
  for (let round = 0; round < 100; round += 1) {
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) + hash + round) ^ value.charCodeAt(i);
      hash |= 0;
    }
  }
  return `pin2_${Math.abs(hash).toString(36)}`;
}

export function getPinLockStatus() {
  const lockUntil = Number.parseInt(localStorage.getItem(PIN_LOCKOUT_KEY) || '0', 10);
  const now = Date.now();
  return {
    locked: lockUntil > now,
    remainingSeconds: lockUntil > now ? Math.ceil((lockUntil - now) / 1000) : 0,
    attempts: Number.parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) || '0', 10),
  };
}

export function hasConfiguredPin() {
  return !!localStorage.getItem(PIN_KEY);
}

export function verifyPin(pin) {
  const status = getPinLockStatus();
  if (status.locked) {
    return { ok: false, reason: 'locked', ...status };
  }

  const stored = localStorage.getItem(PIN_KEY);
  const hashed = hashPin(pin);

  if (!stored) {
    localStorage.setItem(PIN_KEY, hashed);
    localStorage.setItem(PIN_ATTEMPTS_KEY, '0');
    localStorage.removeItem(PIN_LOCKOUT_KEY);
    return { ok: true, created: true };
  }

  if (stored === hashed) {
    localStorage.setItem(PIN_ATTEMPTS_KEY, '0');
    localStorage.removeItem(PIN_LOCKOUT_KEY);
    return { ok: true, created: false };
  }

  const attempts = status.attempts + 1;
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(attempts));
  if (attempts >= 5) {
    const lockUntil = Date.now() + 60000;
    localStorage.setItem(PIN_LOCKOUT_KEY, String(lockUntil));
  }

  return { ok: false, reason: 'invalid', attempts };
}

export function canSkipPin() {
  const state = getState();
  return state?.opMode === 'training';
}

export function resetConfiguredPin() {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(PIN_ATTEMPTS_KEY);
  localStorage.removeItem(PIN_LOCKOUT_KEY);
}

export function initPinSecurityService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.pinSecurityService = {
    hashPin,
    getPinLockStatus,
    hasConfiguredPin,
    verifyPin,
    canSkipPin,
    resetConfiguredPin,
  };
}