/**
 * Typed EventBus — decoupled inter-module communication.
 *
 * Replaces direct function calls between unrelated modules with a
 * publish/subscribe pattern. Critical for maintaining loose coupling
 * as the monolithic app.js is broken into feature modules.
 *
 * Features:
 * - Typed event payloads via EventMap
 * - Priority-ordered listeners
 * - One-time subscriptions
 * - Wildcard listeners (for logging/debugging)
 * - Async emission support
 */

import type { CasualtyId, TriagePriority, Timestamp } from '../types';

// ---------------------------------------------------------------------------
// Event map — add new events as features are migrated
// ---------------------------------------------------------------------------

export interface EventMap {
  // Casualty lifecycle
  'casualty:added': { id: CasualtyId; name: string };
  'casualty:updated': { id: CasualtyId; fields: string[] };
  'casualty:removed': { id: CasualtyId };
  'casualty:triage-changed': { id: CasualtyId; from: TriagePriority; to: TriagePriority };
  'casualty:escalated': { id: CasualtyId; from: TriagePriority; to: TriagePriority };

  // Treatment events
  'treatment:applied': { casId: CasualtyId; type: string; time: string };
  'treatment:tq-started': { casId: CasualtyId; timestamp: Timestamp };
  'treatment:vitals-recorded': { casId: CasualtyId };

  // Mission lifecycle
  'mission:started': { timestamp: Timestamp };
  'mission:ended': { timestamp: Timestamp; duration: number };
  'mission:mode-changed': { mode: string };

  // Sync events
  'mesh:exported': { size: number; chunks: number };
  'mesh:imported': { casualties: number; merged: number };
  'qr:scan-complete': { chunks: number };

  // Supply events
  'supply:used': { item: string; remaining: number };
  'supply:low': { item: string; remaining: number; threshold: number };

  // Timeline
  'timeline:entry-added': { casId: CasualtyId | 'sys'; what: string };

  // UI / Navigation
  'screen:changed': { from: string; to: string };
  'drawer:opened': { casId: CasualtyId };
  'drawer:closed': Record<string, never>;

  // Alerts
  'alert:ai-advisor': { count: number };
  'alert:golden-hour': { casId: CasualtyId; minutesElapsed: number };
  'alert:golden-hour-half': { minutesElapsed: number };
  'alert:golden-hour-critical': { minutesElapsed: number };
  'alert:tq-warning': { casId: CasualtyId; secondsElapsed: number };
  'alert:reassess-t1': { names: string[] };
  'alert:sa-pulse': { minutesSinceAck: number };
  'alert:heli-arrived': Record<string, never>;

  // Background service ticks
  'bg:clock-tick': { time: string };
  'bg:golden-hour-tick': { elapsedSec: number; ghRemainSec: number; txaRemainSec: number };
  'bg:tq-tick': { entries: ReadonlyArray<{ casId: CasualtyId; elapsedSec: number }> };
  'bg:heli-tick': { remainSec: number };
  'bg:stats-refresh': Record<string, never>;
  'bg:map-refresh': Record<string, never>;
  'bg:service-error': { service: string; error: string };

  // Auto-escalation
  'casualty:auto-escalated': { id: CasualtyId; reason: string };

  // State persistence
  'state:saved': { timestamp: Timestamp };
  'state:restored': { timestamp: Timestamp };
  'state:cleared': Record<string, never>;

  // Wildcard (for debugging)
  '*': { event: string; payload: unknown };
}

export type EventName = keyof EventMap;

// ---------------------------------------------------------------------------
// Listener types
// ---------------------------------------------------------------------------

type Listener<T> = (payload: T) => void | Promise<void>;

interface ListenerEntry<T = unknown> {
  fn: Listener<T>;
  once: boolean;
  priority: number;
}

// ---------------------------------------------------------------------------
// EventBus implementation
// ---------------------------------------------------------------------------

export class EventBus {
  private listeners = new Map<string, ListenerEntry[]>();
  private emitCount = 0;

  /**
   * Subscribe to an event.
   * Returns an unsubscribe function.
   */
  on<K extends EventName>(
    event: K,
    listener: Listener<EventMap[K]>,
    options: { priority?: number } = {},
  ): () => void {
    return this.addListener(event, listener, false, options.priority ?? 0);
  }

  /**
   * Subscribe to an event, auto-removing after first invocation.
   */
  once<K extends EventName>(
    event: K,
    listener: Listener<EventMap[K]>,
  ): () => void {
    return this.addListener(event, listener, true, 0);
  }

  /**
   * Emit an event synchronously. Listeners are invoked in priority order.
   */
  emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    this.emitCount++;
    this.invokeListeners(event, payload);

    // Notify wildcard listeners
    if (event !== '*') {
      this.invokeListeners('*', { event, payload } as EventMap['*']);
    }
  }

  /**
   * Emit an event and await all async listeners.
   */
  async emitAsync<K extends EventName>(event: K, payload: EventMap[K]): Promise<void> {
    this.emitCount++;
    await this.invokeListenersAsync(event, payload);

    if (event !== '*') {
      await this.invokeListenersAsync('*', { event, payload } as EventMap['*']);
    }
  }

  /**
   * Remove all listeners for a specific event, or all listeners entirely.
   */
  off(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Number of registered listeners across all events.
   */
  get listenerCount(): number {
    let count = 0;
    for (const entries of this.listeners.values()) {
      count += entries.length;
    }
    return count;
  }

  /**
   * Total events emitted since creation.
   */
  get totalEmits(): number {
    return this.emitCount;
  }

  // -------------------------------------------------------------------------
  // Private
  // -------------------------------------------------------------------------

  private addListener<T>(
    event: string,
    fn: Listener<T>,
    once: boolean,
    priority: number,
  ): () => void {
    const entry: ListenerEntry = { fn: fn as Listener<unknown>, once, priority };
    const entries = this.listeners.get(event) ?? [];
    entries.push(entry);
    entries.sort((a, b) => b.priority - a.priority);
    this.listeners.set(event, entries);

    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(entry);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  private invokeListeners(event: string, payload: unknown): void {
    const entries = this.listeners.get(event);
    if (!entries || entries.length === 0) return;

    const toRemove: ListenerEntry[] = [];
    for (const entry of entries) {
      try {
        entry.fn(payload);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
      if (entry.once) toRemove.push(entry);
    }

    for (const entry of toRemove) {
      const idx = entries.indexOf(entry);
      if (idx >= 0) entries.splice(idx, 1);
    }
  }

  private async invokeListenersAsync(event: string, payload: unknown): Promise<void> {
    const entries = this.listeners.get(event);
    if (!entries || entries.length === 0) return;

    const toRemove: ListenerEntry[] = [];
    for (const entry of entries) {
      try {
        await entry.fn(payload);
      } catch (err) {
        console.error(`[EventBus] Error in async listener for "${event}":`, err);
      }
      if (entry.once) toRemove.push(entry);
    }

    for (const entry of toRemove) {
      const idx = entries.indexOf(entry);
      if (idx >= 0) entries.splice(idx, 1);
    }
  }
}
