export function startQrScan() {
  if (typeof window.startQRScan === 'function') {
    return window.startQRScan();
  }
  return undefined;
}

export function stopQrScan() {
  if (typeof window.stopQRScan === 'function') {
    return window.stopQRScan();
  }
  return undefined;
}

export function toggleScanTorch() {
  if (typeof window.toggleScanTorch === 'function') {
    return window.toggleScanTorch();
  }
  return undefined;
}

export function handleScanRaw(rawPayload) {
  if (typeof window._handleScanResult === 'function') {
    return window._handleScanResult(rawPayload);
  }
  return undefined;
}

export function initQrScanCoreService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.qrScanCoreService = {
    startQrScan,
    stopQrScan,
    toggleScanTorch,
    handleScanRaw,
  };
}