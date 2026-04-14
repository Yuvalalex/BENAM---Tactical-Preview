/**
 * TriageFacade — High-level API for triage operations.
 *
 * Orchestrates priority changes, escalation checks, and
 * triage summary queries against current application state.
 */

import type { EventBus } from '../../core/events';
import type {
  Casualty,
  CasualtyId,
  TriagePriority,
} from '../../core/types';
import type { AppStore } from '../../presentation/store/app-store';
import type { CasualtyService } from '../../domain/services/casualty.service';
import type { TriageService, TriageSummary } from '../../domain/services/triage.service';

export class TriageFacade {
  constructor(
    private readonly store: AppStore,
    private readonly casualtyService: CasualtyService,
    private readonly triageService: TriageService,
    private readonly eventBus: EventBus,
  ) {}

  /** Change a casualty's triage priority. */
  changePriority(casId: CasualtyId, priority: TriagePriority): boolean {
    const state = this.store.getState();
    const cas = this.casualtyService.findById(state.casualties, casId);
    if (!cas) return false;

    const from = cas.priority;
    if (from === priority) return true;

    const updated = this.casualtyService.changePriority(cas, priority);
    this.store.dispatch((s) => ({
      casualties: s.casualties.map((c) => (c.id === casId ? updated : c)),
    }));

    this.eventBus.emit('casualty:triage-changed', {
      id: casId, from, to: priority,
    });

    if (updated.escalated && !cas.escalated) {
      this.eventBus.emit('casualty:escalated', {
        id: casId, from, to: priority,
      });
    }

    return true;
  }

  /** Get triage summary for all current casualties. */
  getSummary(): TriageSummary {
    return this.triageService.summarize(
      this.store.getState().casualties,
    );
  }

  /** Check all T2 casualties for escalation to T1. */
  checkEscalations(elapsedMinutes: number): CasualtyId[] {
    const { casualties } = this.store.getState();
    const escalated: CasualtyId[] = [];

    for (const cas of casualties) {
      if (this.triageService.shouldEscalate(cas, elapsedMinutes)) {
        escalated.push(cas.id);
      }
    }

    return escalated;
  }

  /** Get all casualties sorted by triage priority. */
  sortCasualties(): Casualty[] {
    return this.triageService.sortByPriority(
      this.store.getState().casualties,
    );
  }

  /** Find the most urgent casualty in current state. */
  findMostUrgent(): Casualty | undefined {
    return this.triageService.findMostUrgent(
      this.store.getState().casualties,
    );
  }
}
