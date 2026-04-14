/**
 * ReassessService — Periodic reminder to re-evaluate T1 casualties.
 * Emits alert every 10 minutes with list of T1 casualty names.
 * Replaces legacy app.js line 1522 setInterval.
 */

import type { EventBus } from '../../core/events';
import type { AppStore } from '../../presentation/store/app-store';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

const TEN_MINUTES_MS = 600_000;

export class ReassessService implements BackgroundService {
  readonly name = 'Reassess';
  readonly intervalMs = TEN_MINUTES_MS;
  readonly lifecycle: ServiceLifecycle = 'mission';

  constructor(
    private readonly store: AppStore,
    private readonly eventBus: EventBus,
  ) {}

  tick(): void {
    const { casualties } = this.store.getState();
    if (!casualties) return;

    const t1Names = casualties
      .filter((c) => c.priority === 'T1')
      .map((c) => c.name);

    if (t1Names.length > 0) {
      this.eventBus.emit('alert:reassess-t1', { names: t1Names });
    }
  }
}
