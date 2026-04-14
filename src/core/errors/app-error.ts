/**
 * Structured error system for BENAM.
 *
 * Replaces ad-hoc try/catch + console.error patterns with a typed hierarchy
 * that supports error codes, context, recovery hints, and chaining.
 *
 * All domain/data/presentation errors should extend AppError or use the
 * Result<T> type to propagate failures without throwing.
 */

// ---------------------------------------------------------------------------
// Error codes (exhaustive enum — add new codes as features grow)
// ---------------------------------------------------------------------------

export enum ErrorCode {
  // General
  UNKNOWN = 'UNKNOWN',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_STATE = 'INVALID_STATE',

  // Storage
  STORAGE_READ = 'STORAGE_READ',
  STORAGE_WRITE = 'STORAGE_WRITE',
  STORAGE_QUOTA = 'STORAGE_QUOTA',
  STORAGE_CORRUPT = 'STORAGE_CORRUPT',

  // Sync / QR
  QR_ENCODE = 'QR_ENCODE',
  QR_DECODE = 'QR_DECODE',
  MESH_INVALID_PAYLOAD = 'MESH_INVALID_PAYLOAD',
  MESH_MERGE_CONFLICT = 'MESH_MERGE_CONFLICT',

  // Domain
  TRIAGE_INVALID = 'TRIAGE_INVALID',
  CASUALTY_DUPLICATE = 'CASUALTY_DUPLICATE',
  MARCH_INVALID_SCORE = 'MARCH_INVALID_SCORE',
  SUPPLY_INSUFFICIENT = 'SUPPLY_INSUFFICIENT',
  EVAC_NO_SLOT = 'EVAC_NO_SLOT',

  // Platform
  CAMERA_DENIED = 'CAMERA_DENIED',
  CAMERA_UNAVAILABLE = 'CAMERA_UNAVAILABLE',
  VIBRATION_UNSUPPORTED = 'VIBRATION_UNSUPPORTED',
  SHARE_UNSUPPORTED = 'SHARE_UNSUPPORTED',
}

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export enum ErrorSeverity {
  /** User can continue, no data loss */
  LOW = 'LOW',
  /** Feature degraded but app functional */
  MEDIUM = 'MEDIUM',
  /** Critical failure, immediate attention needed */
  HIGH = 'HIGH',
  /** Data corruption or irrecoverable state */
  CRITICAL = 'CRITICAL',
}

// ---------------------------------------------------------------------------
// AppError class
// ---------------------------------------------------------------------------

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly severity: ErrorSeverity;
  readonly context: Record<string, unknown>;
  readonly timestamp: number;
  readonly recoveryHint?: string;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      severity?: ErrorSeverity;
      cause?: Error;
      context?: Record<string, unknown>;
      recoveryHint?: string;
    } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.severity = options.severity ?? ErrorSeverity.MEDIUM;
    this.context = options.context ?? {};
    this.timestamp = Date.now();
    this.recoveryHint = options.recoveryHint;
  }

  /**
   * Serialize for logging or transmission.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      recoveryHint: this.recoveryHint,
      stack: this.stack,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }

  /**
   * Factory: wrap an unknown caught value into an AppError.
   */
  static from(error: unknown, code = ErrorCode.UNKNOWN): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof Error) {
      return new AppError(code, error.message, { cause: error });
    }
    return new AppError(code, String(error));
  }
}
