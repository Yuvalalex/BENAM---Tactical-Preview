/**
 * Legacy Bridge — Bidirectional communication between TypeScript modules and legacy globals.
 *
 * During incremental migration, legacy code (app.js, enhancements.js) lives in the global
 * scope with a single mutable state object `window.S`. New TypeScript modules are structured
 * around clean architecture. This bridge allows:
 *
 * 1. TS modules to read/write legacy state via typed accessors
 * 2. Legacy code to call into new TS services via `window.BENAM`
 * 3. Gradual function-by-function migration without breaking existing behavior
 *
 * This file will grow during Phase 1-5 as services are registered, then shrink
 * during Phase 8 cleanup when legacy code is removed entirely.
 */

// ---------------------------------------------------------------------------
// Type declarations for legacy globals
// ---------------------------------------------------------------------------

/**
 * Minimal type overlay for legacy global state object `S`.
 * This will be progressively refined as we extract domain types in Phase 1.
 */
interface LegacyState {
  mode: string;
  role: string;
  missionStarted: boolean;
  missionTime: number;
  casualties: Record<string, unknown>[];
  force: Record<string, unknown>[];
  timeline: Record<string, unknown>[];
  supplies: Record<string, unknown>;
  comms: Record<string, unknown>;
  meshReceived: Record<string, unknown>[];
  [key: string]: unknown;
}

/**
 * BENAM namespace exposed on `window` for legacy → TS interop.
 * Services registered here become available to legacy onclick handlers.
 */
interface BENAMNamespace {
  version: string;
  initialized: boolean;
  services: Record<string, unknown>;
}

interface BENAMLegacyNamespace {
  getState?: () => LegacyState | undefined;
  getMedicalConstants?: () => unknown;
  getBloodCompatibility?: () => unknown;
  getBloodTypes?: () => unknown;
  dom?: Record<string, unknown>;
}

// Extend the global Window interface
declare global {
  interface Window {
    S: LegacyState;
    BENAM: BENAMNamespace;
    BENAM_LEGACY?: BENAMLegacyNamespace;
    // Legacy functions called by TS presentation layer
    goScreen?: (id: string) => void;
    setNav?: (index: number) => void;
    saveState?: () => void;
    loadState?: () => void;
    getLegacyState?: () => LegacyState | undefined;
  }
}

// ---------------------------------------------------------------------------
// Bridge initialization
// ---------------------------------------------------------------------------

const BRIDGE_VERSION = '0.1.0';

function readLegacyLexicalState(): LegacyState | undefined {
  try {
    return window.eval('typeof S === "undefined" ? undefined : S') as LegacyState | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Initialize the BENAM namespace on window.
 * Safe to call multiple times — will not overwrite existing namespace.
 */
export function initBridge(): void {
  if (window.BENAM?.initialized) {
    console.warn('[BENAM Bridge] Already initialized, skipping.');
    return;
  }

  window.BENAM = {
    version: BRIDGE_VERSION,
    initialized: true,
    services: {},
  };

  console.log(`[BENAM Bridge] v${BRIDGE_VERSION} initialized`);
}

// ---------------------------------------------------------------------------
// Legacy state accessors (typed wrappers around window.S)
// ---------------------------------------------------------------------------

/**
 * Get a reference to the legacy state object.
 * Returns undefined if legacy code hasn't initialized yet.
 */
export function getLegacyState(): LegacyState | undefined {
  if (window.BENAM_LEGACY?.getState) {
    return window.BENAM_LEGACY.getState() as LegacyState | undefined;
  }

  return window.S || readLegacyLexicalState();
}

/**
 * Check if legacy state is available (app.js has loaded and initialized S).
 */
export function isLegacyReady(): boolean {
  const legacyState = getLegacyState();
  return typeof legacyState === 'object' && legacyState !== null;
}

// ---------------------------------------------------------------------------
// Service registration (used in Phase 2+ to expose TS services to legacy)
// ---------------------------------------------------------------------------

/**
 * Register a service on the BENAM namespace so legacy code can access it.
 *
 * @example
 * ```ts
 * registerService('triage', new TriageService());
 * // Legacy code: window.BENAM.services.triage.calculatePriority(...)
 * ```
 */
export function registerService(name: string, service: unknown): void {
  if (!window.BENAM) {
    console.error('[BENAM Bridge] Cannot register service before bridge init');
    return;
  }
  window.BENAM.services[name] = service;
  console.log(`[BENAM Bridge] Service registered: ${name}`);
}

/**
 * Retrieve a registered service by name.
 */
export function getService<T = unknown>(name: string): T | undefined {
  return window.BENAM?.services[name] as T | undefined;
}

// ---------------------------------------------------------------------------
// Export bridge API
// ---------------------------------------------------------------------------

export const bridge = {
  init: initBridge,
  getLegacyState,
  isLegacyReady,
  registerService,
  getService,
} as const;
