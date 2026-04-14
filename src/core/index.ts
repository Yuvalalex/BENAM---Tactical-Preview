/**
 * Core module barrel export.
 *
 * Single import point for all core infrastructure:
 *   import { container, EventBus, AppError, Ok, Err } from '@core';
 */

// Types
export * from './types';

// Constants
export * from './constants';

// Dependency injection
export { container, DI_TOKENS } from './di';
export type { DIContainer, DIToken } from './di';

// Error handling
export {
  AppError,
  ErrorCode,
  ErrorSeverity,
  Ok,
  Err,
  unwrap,
  unwrapOr,
  mapResult,
  flatMap,
  tryCatch,
  tryCatchAsync,
} from './errors';
export type { Result } from './errors';

// Events
export { EventBus } from './events';
export type { EventMap, EventName } from './events';

// Utilities
export {
  generateId,
  generateShortId,
  fnv1aHash,
  formatTime,
  formatTimeSeconds,
  formatElapsed,
  elapsedMinutes,
  elapsedSeconds,
  formatTimeAgo,
  isWithinWindow,
  isNonEmptyString,
  isValidPriority,
  isValidBloodType,
  isValidMarchScore,
  isValidMarch,
  isValidMeshPayload,
  isValidCasualty,
  clamp,
  sanitizeHTML,
  safeJSONParse,
} from './utils';
