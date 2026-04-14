import './styles/main.css';
import { syncLegacyRuntime } from './services/LegacyRuntimeService.js';
import { initLegacyAudit } from './core/LegacyAudit.js';
import { initStateService } from './services/StateService.js';
import { initCasualtyService } from './services/CasualtyService.js';
import { initCasualtyCreationService } from './services/CasualtyCreationService.js';
import { initCasualtyDrawerActionService } from './services/CasualtyDrawerActionService.js';
import { initMissionLifecycleService } from './services/MissionLifecycleService.js';
import { initQrExportCoreService } from './services/QrExportCoreService.js';
import { initQrScanCoreService } from './services/QrScanCoreService.js';
import { initQrImportService } from './services/QrImportService.js';
import { initMeshSyncExportService } from './services/MeshSyncExportService.js';
import { initMeshSyncMergeService } from './services/MeshSyncMergeService.js';
import { initIndexedDbService } from './services/IndexedDbService.js';
import { initPinSecurityService } from './services/PinSecurityService.js';
import { initLegacyGlobalAliasService } from './services/LegacyGlobalAliasService.js';
import { initCasualtyCreationComponent } from './components/CasualtyCreationComponent.js';
import { initCasualtyBodyMapSection } from './components/CasualtyBodyMapSection.js';
import { initCasualtyMarchProtocolSection } from './components/CasualtyMarchProtocolSection.js';
import { initOverlayTemplateComponent } from './components/templates/OverlayTemplateComponent.js';
import { initModalOverlayTemplateComponent } from './components/templates/ModalOverlayTemplateComponent.js';
import { initNavigationComponent } from './components/NavigationComponent.js';
import { initCasualtyDrawerComponent } from './components/CasualtyDrawerComponent.js';
import { initCasualtyDrawerSections } from './components/CasualtyDrawerSections.js';

function bootstrapModuleRuntime() {
  // 1. Mount templates FIRST (so legacy runtime can find elements on load)
  initOverlayTemplateComponent();
  initModalOverlayTemplateComponent();

  // 2. Sync legacy & state
  syncLegacyRuntime();
  initLegacyGlobalAliasService();
  initLegacyAudit();
  initStateService();
  initCasualtyService();
  initCasualtyCreationService();
  initCasualtyDrawerActionService();
  initMissionLifecycleService();
  initQrExportCoreService();
  initQrScanCoreService();
  initQrImportService();
  initMeshSyncExportService();
  initMeshSyncMergeService();
  initIndexedDbService();
  initPinSecurityService();

  // 3. Components
  initCasualtyCreationComponent();
  initCasualtyBodyMapSection();
  initCasualtyMarchProtocolSection();
  initNavigationComponent();
  initCasualtyDrawerComponent();
  initCasualtyDrawerSections();

  import('./main.ts').catch((error) => {
    console.error('[BENAM] Failed to load TypeScript bootstrap', error);
  });
}

if (document.readyState === 'complete') {
  bootstrapModuleRuntime();
} else {
  window.addEventListener('load', bootstrapModuleRuntime, { once: true });
}