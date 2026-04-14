export function importScannedQrPayload() {
  if (typeof window.importScannedQR === 'function') {
    return window.importScannedQR();
  }
  return undefined;
}

export function importPastedState() {
  if (typeof window.doImportState === 'function') {
    return window.doImportState();
  }
  return undefined;
}

export function importPacket(packet) {
  if (typeof window._importStatePacket === 'function') {
    return window._importStatePacket(packet);
  }
  return undefined;
}

export function initQrImportService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.qrImportService = {
    importScannedQrPayload,
    importPastedState,
    importPacket,
  };
}