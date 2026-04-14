/**
 * TQMonitorService — Tracks tourniquet elapsed time for all casualties.
 * Emits per-casualty TQ data every second and alerts at 60 min.
 * Replaces legacy app.js line 1865 setInterval.
 */

import type { EventBus } from '../../core/events';
import type { AppStore } from '../../presentation/store/app-store';
import type { CasualtyId } from '../../core/types';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

const TQ_CRITICAL_MIN = 60;
const COOLDOWN_MS = 60_000;

export class TQMonitorService implements BackgroundService {
  readonly name = 'TQMonitor';
  readonly intervalMs = 1000;
  readonly lifecycle: ServiceLifecycle = 'always';

  private readonly alertCooldown = new Map<CasualtyId, number>();

  constructor(
    private readonly store: AppStore,
    private readonly eventBus: EventBus,
  ) {
    // Wire cleanup to casualty removal to prevent memory leaks
    this.eventBus.on('casualty:removed', (data) => {
      this.onCasualtyRemoved(data.id);
    });
  }

  /**
   * Clean up alertCooldown entries when a casualty is removed.
   * Prevents Map from growing unbounded over long sessions.
   */
  onCasualtyRemoved(casId: CasualtyId): void {
    this.alertCooldown.delete(casId);
  }

  tick(): void {
    const { casualties } = this.store.getState();
    if (!casualties) return;

    const now = Date.now();
    const entries: Array<{ casId: CasualtyId; elapsedSec: number }> = [];

    for (const cas of casualties) {
      if (!cas.tqStart) continue;
      const elapsedSec = Math.floor((now - cas.tqStart) / 1000);
      entries.push({ casId: cas.id, elapsedSec });
      this.checkCritical(cas.id, elapsedSec, now);
    }

    if (entries.length > 0) {
      this.eventBus.emit('bg:tq-tick', { entries });
    }
  }

  private checkCritical(
    casId: CasualtyId,
    elapsedSec: number,
    now: number,
  ): void {
    const minutes = Math.floor(elapsedSec / 60);
    if (minutes < TQ_CRITICAL_MIN) return;

    const lastAlert = this.alertCooldown.get(casId) ?? 0;
    if (now - lastAlert < COOLDOWN_MS) return;

    this.alertCooldown.set(casId, now);
    this.eventBus.emit('alert:tq-warning', {
      casId, secondsElapsed: elapsedSec,
    });
  }
}
