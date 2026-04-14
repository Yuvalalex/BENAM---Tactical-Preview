/**
 * RetryPolicy — Exponential backoff for critical operations.
 *
 * Used primarily for storage writes where localStorage may temporarily
 * fail (quota exceeded, private browsing restrictions, etc.).
 */

import { AppError, ErrorCode, ErrorSeverity } from './app-error';
import { type Result, Ok, Err } from './result';

export interface RetryOptions {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly errorCode: ErrorCode;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 16000,
  errorCode: ErrorCode.UNKNOWN,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeDelay(attempt: number, base: number, max: number): number {
  const exponential = base * Math.pow(2, attempt);
  return Math.min(exponential, max);
}

/** Retry a synchronous function with exponential backoff. */
export async function retryAsync<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<Result<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const value = await fn();
      return Ok(value);
    } catch (err) {
      lastError = err;
      if (attempt < opts.maxRetries) {
        const ms = computeDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);
        await delay(ms);
      }
    }
  }

  return Err(new AppError(opts.errorCode, `Failed after ${opts.maxRetries + 1} attempts`, {
    severity: ErrorSeverity.HIGH,
    cause: lastError instanceof Error ? lastError : undefined,
    context: { maxRetries: opts.maxRetries },
  }));
}

/** Retry a synchronous function (no delay, immediate retries). */
export function retrySync<T>(
  fn: () => T,
  maxRetries = 3,
  errorCode = ErrorCode.UNKNOWN,
): Result<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return Ok(fn());
    } catch (err) {
      lastError = err;
    }
  }

  return Err(new AppError(errorCode, `Failed after ${maxRetries + 1} attempts`, {
    severity: ErrorSeverity.HIGH,
    cause: lastError instanceof Error ? lastError : undefined,
  }));
}
