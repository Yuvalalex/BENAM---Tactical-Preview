/**
 * Storage Adapter — Abstract interface for persistent storage.
 *
 * Decouples business logic from localStorage/IndexedDB/etc.
 * During migration, the default implementation wraps localStorage
 * (matching legacy behavior). Can be swapped for IndexedDB later.
 */

import { type Result, Ok, Err, AppError, ErrorCode, ErrorSeverity } from '../../core/errors';

export interface StorageAdapter {
  get<T>(key: string): Result<T | null>;
  set<T>(key: string, value: T): Result<void>;
  remove(key: string): Result<void>;
  clear(): Result<void>;
  has(key: string): boolean;
  keys(): string[];
}

/**
 * LocalStorage implementation of StorageAdapter.
 *
 * Wraps localStorage with error handling and JSON serialization.
 * This matches the legacy `localStorage.getItem('benam_state')` pattern
 * used throughout app.js.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly prefix: string;

  constructor(prefix = 'benam_') {
    this.prefix = prefix;
  }

  get<T>(key: string): Result<T | null> {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (raw === null) return Ok(null);

      const parsed = JSON.parse(raw) as T;
      return Ok(parsed);
    } catch (e) {
      return Err(
        new AppError(ErrorCode.STORAGE_READ, `Failed to read key: ${key}`, {
          severity: ErrorSeverity.MEDIUM,
          cause: e instanceof Error ? e : undefined,
          context: { key },
        }),
      );
    }
  }

  set<T>(key: string, value: T): Result<void> {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.prefix + key, serialized);
      return Ok(undefined);
    } catch (e) {
      const isQuota =
        e instanceof DOMException &&
        (e.name === 'QuotaExceededError' || e.code === 22);

      return Err(
        new AppError(
          isQuota ? ErrorCode.STORAGE_QUOTA : ErrorCode.STORAGE_WRITE,
          isQuota
            ? `Storage quota exceeded writing key: ${key}`
            : `Failed to write key: ${key}`,
          {
            severity: isQuota ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM,
            cause: e instanceof Error ? e : undefined,
            context: { key },
          },
        ),
      );
    }
  }

  remove(key: string): Result<void> {
    try {
      localStorage.removeItem(this.prefix + key);
      return Ok(undefined);
    } catch (e) {
      return Err(
        new AppError(ErrorCode.STORAGE_WRITE, `Failed to remove key: ${key}`, {
          cause: e instanceof Error ? e : undefined,
          context: { key },
        }),
      );
    }
  }

  clear(): Result<void> {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      return Ok(undefined);
    } catch (e) {
      return Err(
        new AppError(ErrorCode.STORAGE_WRITE, 'Failed to clear storage', {
          severity: ErrorSeverity.HIGH,
          cause: e instanceof Error ? e : undefined,
        }),
      );
    }
  }

  has(key: string): boolean {
    return localStorage.getItem(this.prefix + key) !== null;
  }

  keys(): string[] {
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) {
        result.push(key.slice(this.prefix.length));
      }
    }
    return result;
  }
}
