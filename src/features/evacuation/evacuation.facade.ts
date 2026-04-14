/**
 * EvacuationFacade — High-level API for evacuation operations.
 *
 * Orchestrates 9-LINE MEDEVAC generation, evacuation pipeline
 * advancement, and prioritized evacuation ordering.
 */

import type { EventBus } from '../../core/events';
import type { Casualty, CasualtyId } from '../../core/types';
import type { AppStore } from '../../presentation/store/app-store';
import type { CasualtyService } from '../../domain/services/casualty.service';
import type {
  EvacuationService,
  NineLineReport,
  EvacSlot,
} from '../../domain/services/evacuation.service';

export class EvacuationFacade {
  private slots: EvacSlot[];

  constructor(
    private readonly store: AppStore,
    private readonly casualtyService: CasualtyService,
    private readonly evacuationService: EvacuationService,
    private readonly eventBus: EventBus,
  ) {
    this.slots = this.evacuationService.createSlots();
  }

  /** Build a 9-LINE MEDEVAC report from current state. */
  buildNineLine(): NineLineReport {
    const state = this.store.getState();
    return this.evacuationService.buildNineLine(
      state.casualties,
      state.comms,
    );
  }

  /** Assign a casualty to the first available evac slot. */
  assignToSlot(casId: CasualtyId): boolean {
    const result = this.evacuationService.assignToSlot(this.slots, casId);
    if (!result) return false;
    this.slots = result;
    return true;
  }

  /** Remove a casualty from their evac slot. */
  removeFromSlot(casId: CasualtyId): void {
    this.slots = this.evacuationService.removeFromSlot(this.slots, casId);
  }

  /** Get current evac slot assignments. */
  getSlots(): readonly EvacSlot[] {
    return this.slots;
  }

  /** Advance a casualty's evacuation pipeline to the next stage. */
  advancePipeline(casId: CasualtyId): boolean {
    const state = this.store.getState();
    const cas = this.casualtyService.findById(state.casualties, casId);
    if (!cas) return false;

    const newPipeline = this.evacuationService.advanceStage(
      cas.evacPipeline,
    );
    this.store.dispatch((s) => ({
      casualties: s.casualties.map((c) =>
        c.id === casId ? { ...c, evacPipeline: newPipeline } : c,
      ),
    }));
    return true;
  }

  /** Get prioritized evacuation order for non-T4, non-evacuated. */
  getEvacOrder(): Casualty[] {
    return this.evacuationService.prioritizeEvacOrder(
      this.store.getState().casualties,
    );
  }
}
