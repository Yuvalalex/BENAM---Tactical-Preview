import { verifyPin } from './PinSecurityService.js';
import { openDatabase, saveRecord, loadRecord } from './IndexedDbService.js';
import { resetMissionData } from './MissionLifecycleService.js';
import { utf8ToBase64, hashText, buildQrBundle } from './QrExportCoreService.js';
import { applyMeshImport } from './MeshSyncMergeService.js';
import { goScreen, setPrepTab, setStatsTab, closeTopbarMenu } from '../components/NavigationComponent.js';
import { openCasualtyDrawer, closeCasualtyDrawer } from '../components/CasualtyDrawerComponent.js';

function registerGlobalIfMissing(name, impl) {
  if (typeof window[name] !== 'function') {
    window[name] = impl;
  }
}

function resolveRenderDrawer() {
  if (typeof window.renderDrawer === 'function') {
    return window.renderDrawer;
  }
  return undefined;
}

function resolveCloseFireSheet() {
  if (typeof window.closeFireSheet === 'function') {
    return window.closeFireSheet;
  }
  return undefined;
}

function resolveSaveDrawer() {
  if (typeof window.saveCas === 'function') {
    return window.saveCas;
  }
  if (typeof window.saveDrawer === 'function') {
    return window.saveDrawer;
  }
  if (typeof window.saveCasualtyDrawer === 'function') {
    return window.saveCasualtyDrawer;
  }
  return () => undefined;
}

function showSubTabCompat(tab, scope) {
  if (scope === 'stats') {
    return setStatsTab(tab);
  }

  if (scope === 'prep') {
    return setPrepTab(tab);
  }

  if (tab === 'perf' || tab === 'export') {
    return setStatsTab(tab);
  }

  return setPrepTab(tab);
}

export function initLegacyGlobalAliasService() {
  registerGlobalIfMissing('verifyPin', verifyPin);
  registerGlobalIfMissing('openIDB', openDatabase);
  registerGlobalIfMissing('saveToIDB', saveRecord);
  registerGlobalIfMissing('loadFromIDB', loadRecord);
  registerGlobalIfMissing('resetMissionData', resetMissionData);

  registerGlobalIfMissing('utf8ToBase64', utf8ToBase64);
  registerGlobalIfMissing('hashText', hashText);
  registerGlobalIfMissing('buildQrBundle', buildQrBundle);

  registerGlobalIfMissing('applyMeshImport', applyMeshImport);

  registerGlobalIfMissing('showScreen', function showScreenCompat(screenId, navIndex) {
    goScreen(screenId);
    if (Number.isInteger(navIndex) && typeof window.setNav === 'function') {
      window.setNav(navIndex);
    }
  });

  registerGlobalIfMissing('showSubTab', showSubTabCompat);

  registerGlobalIfMissing('openCasDrawer', function openCasDrawerCompat(casualtyId) {
    return openCasualtyDrawer(casualtyId, resolveRenderDrawer());
  });

  registerGlobalIfMissing('closeCasDrawer', function closeCasDrawerCompat() {
    return closeCasualtyDrawer(resolveCloseFireSheet());
  });

  registerGlobalIfMissing('saveCasDrawer', function saveCasDrawerCompat() {
    return resolveSaveDrawer()();
  });

  registerGlobalIfMissing('swipeMode', function swipeModeCompat() {
    if (typeof window.openSwipeMode === 'function') {
      return window.openSwipeMode();
    }
    return undefined;
  });

  registerGlobalIfMissing('toggleLanguage', function toggleLanguageCompat() { return window.toggleLanguage?.(); });
  registerGlobalIfMissing('setLanguage', function setLanguageCompat(l) { return window.setLanguage?.(l); });
  registerGlobalIfMissing('toggleFullscreen', function toggleFullscreenCompat() { return window.toggleFullscreen?.(); });
  registerGlobalIfMissing('closeTopbarMenu', closeTopbarMenu);
  registerGlobalIfMissing('openOperationsList', function openOpsCompat() { return window.openOperationsList?.(); });
  registerGlobalIfMissing('startDynamicTraining', function startTrainingCompat(d) { return window.startDynamicTraining?.(d); });

  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.globalAliasService = {
    verifyPin: window.verifyPin,
    openIDB: window.openIDB,
    saveToIDB: window.saveToIDB,
    loadFromIDB: window.loadFromIDB,
    resetMissionData: window.resetMissionData,
    utf8ToBase64: window.utf8ToBase64,
    hashText: window.hashText,
    buildQrBundle: window.buildQrBundle,
    applyMeshImport: window.applyMeshImport,
    showScreen: window.showScreen,
    showSubTab: window.showSubTab,
    openCasDrawer: window.openCasDrawer,
    closeCasDrawer: window.closeCasDrawer,
    saveCasDrawer: window.saveCasDrawer,
    swipeMode: window.swipeMode,
  };
}
