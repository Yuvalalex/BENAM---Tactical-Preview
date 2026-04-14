/**
 * BackgroundServiceManager — Centralized lifecycle control for all
 * interval-based background services.
 *
 * Replaces 15+ raw setInterval calls scattered across legacy code
 * with a single managed registry. Each service is wrapped with
 * try/catch in its tick, error counting, and clean start/stop.
 */

import type { EventBus } from '../core/events';
import type {
  BackgroundService,
  ServiceLifecycle,
  ServiceStatus,
} from './background-service';

interface ManagedEntry {
  service: BackgroundService;
  timerId: ReturnType<typeof setInterval> | null;
  tickCount: number;
  lastTickAt: number;
  errorCount: number;
}

export class BackgroundServiceManager {
  private readonly entries = new Map<string, ManagedEntry>();
  private readonly eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /** Register a service. No-op if name already registered. */
  register(service: BackgroundService): void {
    if (this.entries.has(service.name)) return;
    this.entries.set(service.name, {
      service,
      timerId: null,
      tickCount: 0,
      lastTickAt: 0,
      errorCount: 0,
    });
  }

  /** Start all registered services. */
  startAll(): void {
    for (const entry of this.entries.values()) {
      this.startEntry(entry);
    }
  }

  /** Start only services matching the given lifecycle. */
  startByLifecycle(lifecycle: ServiceLifecycle): void {
    for (const entry of this.entries.values()) {
      if (entry.service.lifecycle === lifecycle) {
        this.startEntry(entry);
      }
    }
  }

  /** Stop all running services. */
  stopAll(): void {
    for (const entry of this.entries.values()) {
      this.stopEntry(entry);
    }
  }

  /** Stop only services matching the given lifecycle. */
  stopByLifecycle(lifecycle: ServiceLifecycle): void {
    for (const entry of this.entries.values()) {
      if (entry.service.lifecycle === lifecycle) {
        this.stopEntry(entry);
      }
    }
  }

  /** Get status snapshot for all registered services. */
  getStatus(): ServiceStatus[] {
    const result: ServiceStatus[] = [];
    for (const entry of this.entries.values()) {
      result.push({
        name: entry.service.name,
        running: entry.timerId !== null,
        lifecycle: entry.service.lifecycle,
        intervalMs: entry.service.intervalMs,
        tickCount: entry.tickCount,
        lastTickAt: entry.lastTickAt,
        errorCount: entry.errorCount,
      });
    }
    return result;
  }

  /** Number of registered services. */
  get size(): number {
    return this.entries.size;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private startEntry(entry: ManagedEntry): void {
    if (entry.timerId !== null) return;
    entry.timerId = setInterval(
      () => this.safeTick(entry),
      entry.service.intervalMs,
    );
  }

  private stopEntry(entry: ManagedEntry): void {
    if (entry.timerId === null) return;
    clearInterval(entry.timerId);
    entry.timerId = null;
  }

  private safeTick(entry: ManagedEntry): void {
    try {
      entry.service.tick();
      entry.tickCount++;
      entry.lastTickAt = Date.now();
    } catch (err) {
      entry.errorCount++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[BG] ${entry.service.name} tick error #${entry.errorCount}:`,
        message,
      );
      this.eventBus.emit('bg:service-error', {
        service: entry.service.name,
        error: message,
      });
    }
  }
}
