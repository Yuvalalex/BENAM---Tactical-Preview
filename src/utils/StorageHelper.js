export function getStorageJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setStorageJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeStorageKey(key) {
  localStorage.removeItem(key);
}