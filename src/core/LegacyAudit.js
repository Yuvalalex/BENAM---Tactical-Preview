/**
 * LegacyAudit
 * Reports which legacy globals are available at runtime,
 * and which src/ services are already decoupled from legacy.
 *
 * Helps track gradual decoupling progress from js/app.js + js/enhancements.js.
 * Access results via: window.BENAM_LEGACY_AUDIT
 */

// Functions expected from legacy that src/ services already own full implementations for
const DECOUPLED = [
  'hashPin',       // PinSecurityService — own bcrypt-lite impl
  'verifyPin',     // PinSecurityService — own impl
  'openIDB',       // IndexedDbService — own IDBFactory impl
  'saveToIDB',     // IndexedDbService — own impl
  'loadFromIDB',   // IndexedDbService — own impl
];

// Functions that src/ services DELEGATE to legacy (still tightly coupled)
const DELEGATED = [
  // Mission
  'startMission', 'endMission', 'toggleMissionQuick', 'resetMissionData',
  // QR
  'utf8ToBase64', 'hashText', 'buildQrBundle', 'closeQRExport',
  // QR Scan
  'startQRScan', 'stopQRScan', 'toggleScanTorch',
  // QR Import
  'importScannedQR', 'doImportState', '_importStatePacket',
  // Mesh
  'meshExport', 'meshShareExport', 'meshCopyJSON', 'meshShowQR',
  'openMeshSync', 'saveMesh', 'meshApplyPayload', 'applyMeshImport', 'renderMeshStatus',
  // Nav
  'showScreen', 'showSubTab',
  // Casualty
  'openCasDrawer', 'closeCasDrawer', 'saveCasDrawer',
  // Modal overlays
  'closeSTART', 'closeMassSort', 'closeHospHandoff', 'closeGuided', 'closeDTree',
  'openSAPulse', 'openTacticalMap', 'tmapAutoLayout', 'tmapAddLZ', 'tmapToggleGrid',
  'runOfflineAI', 'togAITMech', 'renderReferenceLibrary', 'closeReferenceLibrary',
  'renderEvacSlots', 'renderEvacPriority', 'autoAssignEvacSlots', 'addEvacSlot', 'setHeliETA',
  'meshScanQR', 'meshApplyImport',
  'closeSwipeMode', 'swipeNav',
  'msortAssign', 'msortNext',
  'triggerQRImageScan', 'toggleQRPasteArea', 'importPastedQR',
  'copyExportJSON', 'shareStateViaWebShare', 'downloadStateJSON',
  'confirmInjury', 'cancelInjury',
  'print101',
  'closeModalOutside',
  'guidedNext',
  'swipeMode',
];

function auditLegacyGlobals() {
  const available = [];
  const missing = [];

  for (const fn of [...DECOUPLED, ...DELEGATED]) {
    if (typeof window[fn] === 'function') {
      available.push(fn);
    } else {
      missing.push(fn);
    }
  }

  const decouplePct = Math.round(DECOUPLED.filter(fn => typeof window[fn] === 'function' ? false : true).length / DECOUPLED.length * 100);

  const audit = {
    available,
    missing,
    decoupled: DECOUPLED,
    delegated: DELEGATED,
    decouplePct,
    legacyScriptPresent: !!document.getElementById('legacy-app-script'),
  };

  window.BENAM_LEGACY_AUDIT = audit;

  if (missing.length > 0) {
    console.warn(`[BENAM/LegacyAudit] ${missing.length} expected globals not found:`, missing);
  }
  console.info(`[BENAM/LegacyAudit] ${available.length}/${available.length + missing.length} globals available | Decoupled: ${DECOUPLED.length} functions`);

  return audit;
}

export function initLegacyAudit() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', auditLegacyGlobals);
  } else {
    auditLegacyGlobals();
  }
}
