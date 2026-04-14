/**
 * HeliCountdownService — Tracks helicopter ETA countdown.
 * Emits remaining seconds every tick and an arrival alert.
 * Replaces legacy app.js line 3734 setInterval.
 *
 * Note: Legacy evac state lives in the separate S_evac global,
 * not in the main AppState. Accessed via window until Phase 8 migration.
 */

import type { EventBus } from '../../core/events';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

interface LegacyEvacState {
  heliETA: number | null;
  heliSetAt: number | null;
}

function readEvacState(): LegacyEvacState | null {
  const s = (window as unknown as Record<string, unknown>)['S_evac'];
  if (!s || typeof s !== 'object') return null;
  return s as LegacyEvacState;
}

export class HeliCountdownService implements BackgroundService {
  readonly name = 'HeliCountdown';
  readonly intervalMs = 1000;
  readonly lifecycle: ServiceLifecycle = 'always';

  private arrivedEmitted = false;

  constructor(private readonly eventBus: EventBus) {}

  tick(): void {
    const evac = readEvacState();
    if (!evac?.heliETA || !evac.heliSetAt) return;

    const elapsed = Math.floor((Date.now() - evac.heliSetAt) / 1000);
    const remainSec = Math.max(0, evac.heliETA * 60 - elapsed);

    this.eventBus.emit('bg:heli-tick', { remainSec });

    if (remainSec <= 0 && !this.arrivedEmitted) {
      this.arrivedEmitted = true;
      this.eventBus.emit('alert:heli-arrived', {});
    }
    if (remainSec > 0) {
      this.arrivedEmitted = false;
    }
  }
}
