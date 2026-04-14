/**
 * AutoEscalationService — Promotes T2 casualties to T1 when criteria met.
 *
 * Criteria (matches legacy app.js line 6618):
 * - Age > 12 minutes since added
 * - SpO2 < 90
 * - Pulse < 50 or > 140
 * - GCS < 10
 *
 * Dispatches state update via AppStore and emits escalation event.
 */

import type { EventBus } from '../../core/events';
import type { AppStore } from '../../presentation/store/app-store';
import { TriagePriority } from '../../core/types';
import type { Casualty, CasualtyId } from '../../core/types';
import type { BackgroundService, ServiceLifecycle } from '../background-service';

const AGE_THRESHOLD_MIN = 12;
const SPO2_MIN = 90;
const PULSE_LOW = 50;
const PULSE_HIGH = 140;
const GCS_MIN = 10;

export class AutoEscalationService implements BackgroundService {
  readonly name = 'AutoEscalation';
  readonly intervalMs = 30_000;
  readonly lifecycle: ServiceLifecycle = 'mission';

  constructor(
    private readonly store: AppStore,
    private readonly eventBus: EventBus,
  ) {}

  tick(): void {
    const state = this.store.getState();
    if (!state.missionActive || !state.casualties) return;

    const now = Date.now();
    const toEscalate: CasualtyId[] = [];

    for (const cas of state.casualties) {
      if (cas.priority !== 'T2' || cas.escalated) continue;
      const reason = this.checkCriteria(cas, now);
      if (reason) {
        toEscalate.push(cas.id);
        this.eventBus.emit('casualty:auto-escalated', {
          id: cas.id, reason,
        });
      }
    }

    if (toEscalate.length > 0) {
      this.applyEscalations(toEscalate);
    }
  }

  private checkCriteria(cas: Casualty, now: number): string | null {
    const ageMin = ((now - (cas._addedAt ?? now)) / 60_000);
    if (ageMin > AGE_THRESHOLD_MIN) return `age ${Math.floor(ageMin)}min`;

    const v = cas.vitals;
    if (!v) return null;
    const spo2 = typeof v.spo2 === 'number' ? v.spo2 : parseInt(String(v.spo2)) || 99;
    const pulse = typeof v.pulse === 'number' ? v.pulse : parseInt(String(v.pulse)) || 70;
    const gcs = typeof v.gcs === 'number' ? v.gcs : parseInt(String(v.gcs)) || 15;

    if (spo2 < SPO2_MIN) return `SpO2 ${spo2}`;
    if (pulse < PULSE_LOW || pulse > PULSE_HIGH) return `pulse ${pulse}`;
    if (gcs < GCS_MIN) return `GCS ${gcs}`;
    return null;
  }

  private applyEscalations(ids: CasualtyId[]): void {
    const idSet = new Set(ids);
    this.store.dispatch((state) => ({
      casualties: state.casualties.map((c) =>
        idSet.has(c.id)
          ? { ...c, priority: TriagePriority.T1, escalated: true }
          : c,
      ),
    }));
  }
}
