/**
 * Validation utilities for domain data.
 *
 * Pure functions that validate shapes, ranges, and constraints.
 * Used by domain services and repository mappers to ensure data integrity.
 */

import { TriagePriority, BloodType, QRPacketKind } from '../types';

/**
 * Validate that a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate a triage priority value.
 */
export function isValidPriority(value: unknown): value is TriagePriority {
  return (
    typeof value === 'string' &&
    Object.values(TriagePriority).includes(value as TriagePriority)
  );
}

/**
 * Validate a blood type value.
 */
export function isValidBloodType(value: unknown): value is BloodType {
  return (
    typeof value === 'string' &&
    Object.values(BloodType).includes(value as BloodType)
  );
}

/**
 * Validate a MARCH score (0-5 inclusive).
 */
export function isValidMarchScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 5;
}

/**
 * Validate a complete MARCH object.
 */
export function isValidMarch(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const march = obj as Record<string, unknown>;
  return ['M', 'A', 'R', 'C', 'H'].every((k) => isValidMarchScore(march[k]));
}

/**
 * Validate a mesh/QR payload has the expected structure.
 */
export function isValidMeshPayload(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const payload = obj as Record<string, unknown>;

  return (
    (payload.kind === QRPacketKind.STATE || payload.kind === QRPacketKind.MESH) &&
    typeof payload.exportedAt === 'number' &&
    Array.isArray(payload.casualties)
  );
}

/**
 * Validate a casualty object has minimum required fields.
 */
export function isValidCasualty(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const cas = obj as Record<string, unknown>;

  return (
    typeof cas.id === 'number' &&
    isNonEmptyString(cas.name) &&
    isValidPriority(cas.priority)
  );
}

/**
 * Clamp a number to a range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize a string for safe HTML insertion (basic XSS prevention).
 */
export function sanitizeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Safely parse JSON, returning null on failure instead of throwing.
 */
export function safeJSONParse<T = unknown>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
