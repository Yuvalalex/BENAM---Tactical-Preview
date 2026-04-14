/**
 * MapRefreshService — Emits periodic refresh signal for tactical map.
 * Presentation layer subscribes and updates only when map overlay is open.
 * Replaces legacy app.js line 5616 setInterval.
 */

import type { EventBus } from '../../core/events';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

export class MapRefreshService implements BackgroundService {
  readonly name = 'MapRefresh';
  readonly intervalMs = 5000;
  readonly lifecycle: ServiceLifecycle = 'always';

  constructor(private readonly eventBus: EventBus) {}

  tick(): void {
    this.eventBus.emit('bg:map-refresh', {});
  }
}
