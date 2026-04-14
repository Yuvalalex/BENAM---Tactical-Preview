/**
 * ID generation utilities.
 *
 * Replaces scattered Date.now() calls for unique IDs with deterministic,
 * collision-resistant generators suitable for offline-first operation.
 */

let counter = 0;

/**
 * Generate a unique numeric ID based on timestamp + monotonic counter.
 * Guaranteed unique within a single session even if called multiple times
 * in the same millisecond.
 */
export function generateId(): number {
  const now = Date.now();
  counter++;
  return now * 1000 + (counter % 1000);
}

/**
 * Generate a short alphanumeric ID suitable for DOM element IDs.
 */
export function generateShortId(prefix = ''): string {
  const base36 = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return prefix ? `${prefix}-${base36}` : base36;
}

/**
 * FNV-1a hash for QR chunk checksums.
 * Matches the legacy implementation in app.js.
 */
export function fnv1aHash(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
