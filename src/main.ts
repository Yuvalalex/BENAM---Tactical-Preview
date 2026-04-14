/**
 * BENAM — Battlefield Emergency Network & Aid Manager
 * TypeScript entry point (Vite module)
 *
 * Bootstraps the TS architecture alongside legacy vanilla JS.
 * Load order: vendor → app.js → enhancements.js → THIS FILE
 */

import { initBridge, isLegacyReady, registerService } from './legacy-bridge';

// Core
import { container, DI_TOKENS } from './core/di';
import { EventBus } from './core/events';

// Domain services
import {
  TriageService,
  MarchService,
  BloodService,
  VitalsService,
  EvacuationService,
  SupplyService,
  TimelineService,
  MeshSyncService,
  CasualtyService,
} from './domain';

// Data layer
import { LocalStorageAdapter, StateRepository } from './data';

// Presentation layer
import { AppStore, ScreenManager, ActionDelegator } from './presentation';

// Feature modules
import {
  registerFeatureModules,
  CasualtyFacade,
  TriageFacade,
  EvacuationFacade,
  CommsSyncFacade,
} from './features';

// Background services
import { registerBackgroundServices, BackgroundServiceManager } from './background';

// ---------------------------------------------------------------------------
// Registration helpers (each under 30 lines)
// ---------------------------------------------------------------------------

function registerCore(): void {
  container.registerSingleton(DI_TOKENS.EventBus, () => new EventBus());
}

function registerDataLayer(): void {
  container.registerSingleton(
    DI_TOKENS.StorageAdapter,
    () => new LocalStorageAdapter(),
  );
  container.registerSingleton(
    DI_TOKENS.StateRepository,
    () => new StateRepository(container.resolve(DI_TOKENS.StorageAdapter)),
  );
}

function registerDomainServices(): void {
  container.registerSingleton(DI_TOKENS.CasualtyService, () => new CasualtyService());
  container.registerSingleton(DI_TOKENS.TriageService, () => new TriageService());
  container.registerSingleton(DI_TOKENS.MarchService, () => new MarchService());
  container.registerSingleton(DI_TOKENS.BloodService, () => new BloodService());
  container.registerSingleton(DI_TOKENS.VitalsService, () => new VitalsService());
  container.registerSingleton(DI_TOKENS.EvacuationService, () => new EvacuationService());
  container.registerSingleton(DI_TOKENS.SupplyService, () => new SupplyService());
  container.registerSingleton(DI_TOKENS.TimelineService, () => new TimelineService());
  container.registerSingleton(DI_TOKENS.MeshSyncService, () => new MeshSyncService());
}

function registerPresentation(): void {
  const eventBus = container.resolve<EventBus>(DI_TOKENS.EventBus);

  container.registerSingleton(
    DI_TOKENS.AppStore,
    () => new AppStore(eventBus),
  );
  container.registerSingleton(
    DI_TOKENS.ScreenManager,
    () => new ScreenManager(eventBus),
  );
  container.registerSingleton(
    DI_TOKENS.ActionDelegator,
    () => new ActionDelegator(),
  );
}

function exposeToBridge(): void {
  registerService('eventBus', container.resolve<EventBus>(DI_TOKENS.EventBus));
  registerService('casualty', container.resolve<CasualtyService>(DI_TOKENS.CasualtyService));
  registerService('triage', container.resolve<TriageService>(DI_TOKENS.TriageService));
  registerService('march', container.resolve<MarchService>(DI_TOKENS.MarchService));
  registerService('blood', container.resolve<BloodService>(DI_TOKENS.BloodService));
  registerService('vitals', container.resolve<VitalsService>(DI_TOKENS.VitalsService));
  registerService('evacuation', container.resolve<EvacuationService>(DI_TOKENS.EvacuationService));
  registerService('supply', container.resolve<SupplyService>(DI_TOKENS.SupplyService));
  registerService('timeline', container.resolve<TimelineService>(DI_TOKENS.TimelineService));
  registerService('meshSync', container.resolve<MeshSyncService>(DI_TOKENS.MeshSyncService));
  registerService('store', container.resolve<AppStore>(DI_TOKENS.AppStore));
  registerService('screen', container.resolve<ScreenManager>(DI_TOKENS.ScreenManager));
  registerService('actions', container.resolve<ActionDelegator>(DI_TOKENS.ActionDelegator));
}

function exposeFeaturesToBridge(): void {
  registerService('modules.casualty', container.resolve<CasualtyFacade>(DI_TOKENS.CasualtyFacade));
  registerService('modules.triage', container.resolve<TriageFacade>(DI_TOKENS.TriageFacade));
  registerService('modules.evacuation', container.resolve<EvacuationFacade>(DI_TOKENS.EvacuationFacade));
  registerService('modules.commsSync', container.resolve<CommsSyncFacade>(DI_TOKENS.CommsSyncFacade));
  registerService('backgroundManager', container.resolve<BackgroundServiceManager>(DI_TOKENS.BackgroundServiceManager));
}

function initPresentation(): void {
  const store = container.resolve<AppStore>(DI_TOKENS.AppStore);
  const screen = container.resolve<ScreenManager>(DI_TOKENS.ScreenManager);
  const delegator = container.resolve<ActionDelegator>(DI_TOKENS.ActionDelegator);

  screen.init();
  delegator.init();
  store.startSyncPolling();
}

function hasLegacyStateSource(): boolean {
  if (isLegacyReady()) {
    return true;
  }

  if (window.BENAM_LEGACY?.getState?.()) {
    return true;
  }

  try {
    return typeof window.eval('typeof S === "undefined" ? undefined : S') === 'object';
  } catch {
    return false;
  }
}

function reportLegacyBridgeStatus(): void {
  const logReady = (attempt: number = 0): void => {
    if (hasLegacyStateSource()) {
      console.log('[BENAM] Legacy state (S) detected — bridge active');
      return;
    }

    if (attempt >= 6) {
      console.info('[BENAM] Legacy bridge running in deferred mode');
      return;
    }

    window.setTimeout(() => logReady(attempt + 1), 120);
  };

  logReady();
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function bootstrap(): void {
  console.log('[BENAM] TypeScript module loading...');
  initBridge();

  registerCore();
  registerDataLayer();
  registerDomainServices();
  registerPresentation();
  registerFeatureModules(container);
  registerBackgroundServices(container);
  exposeToBridge();
  exposeFeaturesToBridge();
  initPresentation();
  reportLegacyBridgeStatus();

  const count = container.listTokens().length;
  console.log(`[BENAM] Initialized — ${count} services registered`);
}

// ---------------------------------------------------------------------------
// Execute bootstrap when DOM is ready
// ---------------------------------------------------------------------------

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
