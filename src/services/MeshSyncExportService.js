export function exportMeshDelta() {
  if (typeof window.meshExport === 'function') {
    return window.meshExport();
  }
  return undefined;
}

export function shareMeshExport() {
  if (typeof window.meshShareExport === 'function') {
    return window.meshShareExport();
  }
  return undefined;
}

export function copyMeshJson() {
  if (typeof window.meshCopyJSON === 'function') {
    return window.meshCopyJSON();
  }
  return undefined;
}

export function showMeshQr() {
  if (typeof window.meshShowQR === 'function') {
    return window.meshShowQR();
  }
  return undefined;
}

export function initMeshSyncExportService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.meshSyncExportService = {
    exportMeshDelta,
    shareMeshExport,
    copyMeshJson,
    showMeshQr,
  };
}