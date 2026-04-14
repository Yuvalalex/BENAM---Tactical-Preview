/**
 * Feature modules barrel export and registration.
 *
 * Each feature module is a Facade that orchestrates domain services,
 * state management, and event emission for a specific business domain.
 */

import type { DIContainer } from '../core/di/container';
import { DI_TOKENS } from '../core/di/tokens';
import type { EventBus } from '../core/events';
import type { AppStore } from '../presentation/store/app-store';
import type { CasualtyService } from '../domain/services/casualty.service';
import type { TriageService } from '../domain/services/triage.service';
import type { EvacuationService } from '../domain/services/evacuation.service';
import type { MeshSyncService } from '../domain/services/mesh-sync.service';

import { CasualtyFacade } from './casualty';
import { TriageFacade } from './triage';
import { EvacuationFacade } from './evacuation';
import { CommsSyncFacade } from './comms-sync';

export { CasualtyFacade } from './casualty';
export { TriageFacade } from './triage';
export { EvacuationFacade } from './evacuation';
export { CommsSyncFacade } from './comms-sync';

/** Register all feature module facades in the DI container. */
export function registerFeatureModules(c: DIContainer): void {
  const eventBus = c.resolve<EventBus>(DI_TOKENS.EventBus);
  const store = c.resolve<AppStore>(DI_TOKENS.AppStore);

  c.registerSingleton(DI_TOKENS.CasualtyFacade, () => {
    const svc = c.resolve<CasualtyService>(DI_TOKENS.CasualtyService);
    return new CasualtyFacade(store, svc, eventBus);
  });

  c.registerSingleton(DI_TOKENS.TriageFacade, () => {
    const casualtySvc = c.resolve<CasualtyService>(DI_TOKENS.CasualtyService);
    const triageSvc = c.resolve<TriageService>(DI_TOKENS.TriageService);
    return new TriageFacade(store, casualtySvc, triageSvc, eventBus);
  });

  c.registerSingleton(DI_TOKENS.EvacuationFacade, () => {
    const casualtySvc = c.resolve<CasualtyService>(DI_TOKENS.CasualtyService);
    const evacSvc = c.resolve<EvacuationService>(DI_TOKENS.EvacuationService);
    return new EvacuationFacade(store, casualtySvc, evacSvc, eventBus);
  });

  c.registerSingleton(DI_TOKENS.CommsSyncFacade, () => {
    const meshSvc = c.resolve<MeshSyncService>(DI_TOKENS.MeshSyncService);
    return new CommsSyncFacade(store, meshSvc, eventBus);
  });
}
