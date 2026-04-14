/**
 * DI token constants.
 *
 * Using string constants instead of Symbol to allow debugging, logging,
 * and serialization. All service tokens are declared here so there is
 * a single inventory of what can be resolved.
 */

// Core infrastructure
export const DI_TOKENS = {
  // Events
  EventBus: 'EventBus',

  // Storage / Data layer
  StorageAdapter: 'StorageAdapter',
  StateRepository: 'StateRepository',
  CasualtyRepository: 'CasualtyRepository',
  ForceRepository: 'ForceRepository',
  TimelineRepository: 'TimelineRepository',
  SupplyRepository: 'SupplyRepository',
  CommsRepository: 'CommsRepository',

  // Domain services
  CasualtyService: 'CasualtyService',
  TriageService: 'TriageService',
  MarchService: 'MarchService',
  EvacuationService: 'EvacuationService',
  BloodService: 'BloodService',
  VitalsService: 'VitalsService',
  MeshSyncService: 'MeshSyncService',
  QRService: 'QRService', // Not yet implemented
  TimelineService: 'TimelineService',
  SupplyService: 'SupplyService',
  AIAdvisorService: 'AIAdvisorService', // Not yet implemented
  ReportService: 'ReportService', // Not yet implemented
  TrainingService: 'TrainingService', // Not yet implemented

  // Feature facades
  CasualtyFacade: 'CasualtyFacade',
  TriageFacade: 'TriageFacade',
  EvacuationFacade: 'EvacuationFacade',
  CommsSyncFacade: 'CommsSyncFacade',

  // Presentation
  AppStore: 'AppStore',
  ScreenManager: 'ScreenManager',
  ActionDelegator: 'ActionDelegator',

  // Background services
  BackgroundServiceManager: 'BackgroundServiceManager',
} as const;

export type DIToken = (typeof DI_TOKENS)[keyof typeof DI_TOKENS];
