/**
 * BackgroundService — Interface for managed interval-based services.
 *
 * Each service encapsulates a single recurring task (tick logic) that
 * the BackgroundServiceManager starts/stops as a group. Services emit
 * events via EventBus rather than touching DOM directly.
 */

/** Lifecycle category determines when a service runs. */
export type ServiceLifecycle = 'always' | 'mission';

/** Contract for all managed background services. */
export interface BackgroundService {
  readonly name: string;
  readonly intervalMs: number;
  readonly lifecycle: ServiceLifecycle;
  tick(): void;
}

/** Runtime status snapshot for monitoring/debugging. */
export interface ServiceStatus {
  readonly name: string;
  readonly running: boolean;
  readonly lifecycle: ServiceLifecycle;
  readonly intervalMs: number;
  readonly tickCount: number;
  readonly lastTickAt: number;
  readonly errorCount: number;
}
