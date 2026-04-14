/**
 * CasualtyFacade — High-level API for casualty operations.
 *
 * Orchestrates domain services and state management for
 * casualty CRUD, treatments, and vitals recording.
 */

import type { EventBus } from '../../core/events';
import type {
  Casualty,
  CasualtyId,
  Vitals,
  Timestamp,
} from '../../core/types';
import type { AppStore } from '../../presentation/store/app-store';
import type { CasualtyService, CreateCasualtyParams } from '../../domain/services/casualty.service';

export class CasualtyFacade {
  constructor(
    private readonly store: AppStore,
    private readonly casualtyService: CasualtyService,
    private readonly eventBus: EventBus,
  ) {}

  /** Create and add a new casualty to state. */
  addCasualty(params: CreateCasualtyParams): Casualty {
    const cas = this.casualtyService.create(params);
    this.store.dispatch((state) => ({
      casualties: [...state.casualties, cas],
    }));
    this.eventBus.emit('casualty:added', { id: cas.id, name: cas.name });
    return cas;
  }

  /** Update fields on an existing casualty. */
  updateCasualty(id: CasualtyId, updates: Partial<Casualty>): boolean {
    const state = this.store.getState();
    const cas = this.casualtyService.findById(state.casualties, id);
    if (!cas) return false;

    const updated = this.casualtyService.update(cas, updates);
    this.replaceCasualty(id, updated);
    const fields = Object.keys(updates);
    this.eventBus.emit('casualty:updated', { id, fields });
    return true;
  }

  /** Add a treatment to a casualty. */
  addTreatment(casId: CasualtyId, type: string): boolean {
    const cas = this.findCasualty(casId);
    if (!cas) return false;

    const updated = this.casualtyService.addTreatment(cas, type);
    this.replaceCasualty(casId, updated);
    const tx = updated.txList[updated.txList.length - 1];
    this.eventBus.emit('treatment:applied', {
      casId, type, time: tx.time,
    });
    return true;
  }

  /** Record a vitals snapshot for a casualty. */
  recordVitals(casId: CasualtyId, vitals: Vitals): boolean {
    const cas = this.findCasualty(casId);
    if (!cas) return false;

    const updated = this.casualtyService.recordVitals(cas, vitals);
    this.replaceCasualty(casId, updated);
    this.eventBus.emit('treatment:vitals-recorded', { casId });
    return true;
  }

  /** Start tourniquet timer for a casualty. */
  startTQ(casId: CasualtyId): boolean {
    const cas = this.findCasualty(casId);
    if (!cas) return false;

    const updated = this.casualtyService.startTQ(cas);
    this.replaceCasualty(casId, updated);
    this.eventBus.emit('treatment:tq-started', {
      casId, timestamp: updated.tqStart as Timestamp,
    });
    return true;
  }

  /** Remove a casualty from state. */
  removeCasualty(casId: CasualtyId): boolean {
    const state = this.store.getState();
    const exists = this.casualtyService.findById(state.casualties, casId);
    if (!exists) return false;

    this.store.dispatch((s) => ({
      casualties: this.casualtyService.remove(s.casualties, casId),
    }));
    this.eventBus.emit('casualty:removed', { id: casId });
    return true;
  }

  /** Get a casualty by ID from current state. */
  getCasualty(id: CasualtyId): Casualty | undefined {
    return this.casualtyService.findById(
      this.store.getState().casualties, id,
    );
  }

  /** Get all casualties from current state. */
  getAllCasualties(): readonly Casualty[] {
    return this.store.getState().casualties;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private findCasualty(id: CasualtyId): Casualty | undefined {
    return this.casualtyService.findById(
      this.store.getState().casualties, id,
    );
  }

  private replaceCasualty(id: CasualtyId, updated: Casualty): void {
    this.store.dispatch((state) => ({
      casualties: state.casualties.map(
        (c) => (c.id === id ? updated : c),
      ),
    }));
  }
}
