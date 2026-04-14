/**
 * GoldenHourService — Tracks golden hour (60 min) and TXA window (180 min).
 * Emits tick data every second and milestone alerts at 30 min and 55 min.
 * Replaces legacy app.js line 1492 setInterval.
 */

import type { EventBus } from '../../core/events';
import type { AppStore } from '../../presentation/store/app-store';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

const GOLDEN_HOUR_SEC = 3600;
const TXA_WINDOW_SEC = 10800;
const HALF_WAY_SEC = 1800;
const CRITICAL_SEC = 3300;

export class GoldenHourService implements BackgroundService {
  readonly name = 'GoldenHour';
  readonly intervalMs = 1000;
  readonly lifecycle: ServiceLifecycle = 'mission';

  private halfEmitted = false;
  private criticalEmitted = false;

  constructor(
    private readonly store: AppStore,
    private readonly eventBus: EventBus,
  ) {}

  tick(): void {
    const state = this.store.getState();
    if (!state.missionStart) return;

    const elapsedSec = Math.floor((Date.now() - state.missionStart) / 1000);
    const ghRemainSec = Math.max(0, GOLDEN_HOUR_SEC - elapsedSec);
    const txaRemainSec = Math.max(0, TXA_WINDOW_SEC - elapsedSec);

    this.eventBus.emit('bg:golden-hour-tick', {
      elapsedSec, ghRemainSec, txaRemainSec,
    });

    this.checkMilestones(elapsedSec);
  }

  private checkMilestones(elapsedSec: number): void {
    if (!this.halfEmitted && elapsedSec >= HALF_WAY_SEC) {
      this.halfEmitted = true;
      this.eventBus.emit('alert:golden-hour-half', {
        minutesElapsed: Math.floor(elapsedSec / 60),
      });
    }
    if (!this.criticalEmitted && elapsedSec >= CRITICAL_SEC) {
      this.criticalEmitted = true;
      this.eventBus.emit('alert:golden-hour-critical', {
        minutesElapsed: Math.floor(elapsedSec / 60),
      });
    }
  }
}
