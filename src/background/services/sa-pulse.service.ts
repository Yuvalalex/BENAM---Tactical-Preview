/**
 * SAPulseService — Situation awareness pulse timer.
 * Alerts commander if no acknowledgment for 8+ minutes.
 * Replaces legacy app.js line 6196 setInterval.
 */

import type { EventBus } from '../../core/events';
import type { AppStore } from '../../presentation/store/app-store';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

const SA_THRESHOLD_MIN = 8;
const ONE_MINUTE_MS = 60_000;

export class SAPulseService implements BackgroundService {
  readonly name = 'SAPulse';
  readonly intervalMs = ONE_MINUTE_MS;
  readonly lifecycle: ServiceLifecycle = 'mission';

  private lastAck = Date.now();

  constructor(
    private readonly store: AppStore,
    private readonly eventBus: EventBus,
  ) {}

  /** Call when commander acknowledges SA status. */
  acknowledge(): void {
    this.lastAck = Date.now();
  }

  tick(): void {
    const state = this.store.getState();
    if (!state.missionActive) return;

    const sinceAck = (Date.now() - this.lastAck) / ONE_MINUTE_MS;
    if (sinceAck > SA_THRESHOLD_MIN) {
      this.eventBus.emit('alert:sa-pulse', {
        minutesSinceAck: Math.floor(sinceAck),
      });
    }
  }
}
