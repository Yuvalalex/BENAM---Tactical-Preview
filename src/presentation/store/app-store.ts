/**
 * AppStore — Reactive wrapper around the legacy global state object S.
 *
 * Provides typed read/write access to window.S with change notification,
 * event emission, and periodic sync polling. S remains the source of truth
 * during the migration; AppStore does NOT own state.
 */

import type { AppState, Timestamp } from '../../core/types';
import type { EventBus } from '../../core/events';

/** Callback invoked whenever state changes. */
export type StateListener = (state: AppState) => void;

/** Function that produces a partial update given current state. */
export type StateUpdater = (state: AppState) => Partial<AppState>;

export class AppStore {
  private readonly eventBus: EventBus;
  private readonly listeners = new Set<StateListener>();
  private lastSnapshotJson = '';
  private syncTimer: ReturnType<typeof setInterval> | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Read the current application state (typed view of window.S). */
  getState(): AppState {
    return this.readLegacy();
  }

  /**
   * Apply a partial update to legacy state, persist, and notify.
   * The updater receives current state and returns fields to merge.
   */
  dispatch(updater: StateUpdater): void {
    const current = this.readLegacy();
    const patch = updater(current);
    this.applyPatch(patch);
    this.invokeLegacySave();
    this.snapshot();
    this.notifyAll();
    this.eventBus.emit('state:saved', { timestamp: Date.now() as Timestamp });
  }

  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /**
   * Detect external mutations to window.S (from legacy code) and
   * notify listeners if the state has changed since last check.
   */
  syncFromLegacy(): void {
    const json = this.currentJson();
    if (json !== this.lastSnapshotJson) {
      this.lastSnapshotJson = json;
      this.notifyAll();
    }
  }

  /** Start periodic polling for legacy-side mutations. */
  startSyncPolling(intervalMs = 2000): void {
    this.stopSyncPolling();
    this.syncTimer = setInterval(() => this.syncFromLegacy(), intervalMs);
  }

  /** Stop the sync polling timer. */
  stopSyncPolling(): void {
    if (this.syncTimer !== null) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /** Clean up resources. Call when app shuts down. */
  destroy(): void {
    this.stopSyncPolling();
    this.listeners.clear();
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private readLegacy(): AppState {
    // Intentional cast: window.S is the AppState-shaped object
    // created by legacy code. The cast is safe at the boundary.
    return window.S as unknown as AppState;
  }

  private applyPatch(patch: Partial<AppState>): void {
    if (!window.S) return;
    Object.assign(window.S, patch);
  }

  private invokeLegacySave(): void {
    if (typeof window.saveState === 'function') {
      window.saveState();
    }
  }

  private snapshot(): void {
    this.lastSnapshotJson = this.currentJson();
  }

  private currentJson(): string {
    if (!window.S) return '';
    const s = window.S;
    // Compare only key mutable fields for performance
    return JSON.stringify([
      s.casualties?.length,
      s.missionActive,
      s.timeline?.length,
    ]);
  }

  private notifyAll(): void {
    const state = this.readLegacy();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[AppStore] Listener error:', err);
      }
    }
  }
}
