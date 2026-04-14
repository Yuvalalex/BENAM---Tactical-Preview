/**
 * Result<T, E> — Railway-oriented error handling.
 *
 * Functions that can fail return Result instead of throwing.
 * Callers pattern-match on `ok` to decide the happy/error path.
 *
 * Benefits over try/catch:
 * - Explicit failure paths visible in function signatures
 * - No accidental swallowing of errors
 * - Composable via map/flatMap chains
 * - Zero runtime cost (plain objects, no class instantiation)
 */

import { AppError, ErrorCode } from './app-error';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Unwrap a Result, throwing the error if it failed.
 * Use sparingly — prefer pattern matching via `if (result.ok)`.
 */
export function unwrap<T>(result: Result<T>): T {
  if (result.ok) return result.value;
  throw result.error;
}

/**
 * Unwrap a Result, returning a fallback value on failure.
 */
export function unwrapOr<T>(result: Result<T>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

/**
 * Map the success value of a Result.
 */
export function mapResult<T, U, E = AppError>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? { ok: true, value: fn(result.value) } : result;
}

/**
 * Chain Results (flatMap / bind).
 */
export function flatMap<T, U, E = AppError>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  return result.ok ? fn(result.value) : result;
}

/**
 * Execute a function and wrap the result/error in a Result.
 */
export function tryCatch<T>(fn: () => T, code = ErrorCode.UNKNOWN): Result<T> {
  try {
    return Ok(fn());
  } catch (e) {
    return Err(AppError.from(e, code));
  }
}

/**
 * Async version of tryCatch.
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>,
  code = ErrorCode.UNKNOWN,
): Promise<Result<T>> {
  try {
    return Ok(await fn());
  } catch (e) {
    return Err(AppError.from(e, code));
  }
}
