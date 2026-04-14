/**
 * StatsRefreshService — Emits periodic refresh signal for stats grid.
 * Presentation layer subscribes and updates only when stats screen is visible.
 * Replaces legacy app.js line 6601 setInterval.
 */

import type { EventBus } from '../../core/events';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

export class StatsRefreshService implements BackgroundService {
  readonly name = 'StatsRefresh';
  readonly intervalMs = 10_000;
  readonly lifecycle: ServiceLifecycle = 'always';

  constructor(private readonly eventBus: EventBus) {}

  tick(): void {
    this.eventBus.emit('bg:stats-refresh', {});
  }
}
