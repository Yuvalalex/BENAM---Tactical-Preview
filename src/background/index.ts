/**
 * Background services barrel export and registration.
 */

import type { DIContainer } from '../core/di/container';
import { DI_TOKENS } from '../core/di/tokens';
import type { EventBus } from '../core/events';
import type { AppStore } from '../presentation/store/app-store';

import { BackgroundServiceManager } from './background-service-manager';
import {
  ClockService,
  GoldenHourService,
  ReassessService,
  TQMonitorService,
  HeliCountdownService,
  SAPulseService,
  AutoEscalationService,
  StatsRefreshService,
  MapRefreshService,
} from './services';

export { BackgroundServiceManager } from './background-service-manager';
export type { BackgroundService, ServiceStatus } from './background-service';
export * from './services';

/** Register the BackgroundServiceManager and all 9 services in DI. */
export function registerBackgroundServices(c: DIContainer): void {
  const eventBus = c.resolve<EventBus>(DI_TOKENS.EventBus);
  const store = c.resolve<AppStore>(DI_TOKENS.AppStore);

  c.registerSingleton(DI_TOKENS.BackgroundServiceManager, () => {
    const mgr = new BackgroundServiceManager(eventBus);
    mgr.register(new ClockService(eventBus));
    mgr.register(new GoldenHourService(store, eventBus));
    mgr.register(new ReassessService(store, eventBus));
    mgr.register(new TQMonitorService(store, eventBus));
    mgr.register(new HeliCountdownService(eventBus));
    mgr.register(new SAPulseService(store, eventBus));
    mgr.register(new AutoEscalationService(store, eventBus));
    mgr.register(new StatsRefreshService(eventBus));
    mgr.register(new MapRefreshService(eventBus));
    return mgr;
  });
}
