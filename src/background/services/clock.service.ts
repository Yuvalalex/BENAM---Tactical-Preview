/**
 * ClockService — Emits formatted time string every second.
 * Replaces legacy app.js line 560 setInterval.
 */

import type { EventBus } from '../../core/events';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export class ClockService implements BackgroundService {
  readonly name = 'Clock';
  readonly intervalMs = 1000;
  readonly lifecycle: ServiceLifecycle = 'always';

  constructor(private readonly eventBus: EventBus) {}

  tick(): void {
    const now = new Date();
    const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
    this.eventBus.emit('bg:clock-tick', { time });
  }
}
