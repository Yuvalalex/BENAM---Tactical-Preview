export function openMeshSync() {
  if (typeof window.openMeshSync === 'function') {
    return window.openMeshSync();
  }
  return undefined;
}

export function queueMeshDelta(casualtyId, type, data) {
  if (typeof window.saveMesh === 'function') {
    return window.saveMesh(casualtyId, type, data);
  }
  return undefined;
}

export function applyMeshPayload(payload) {
  if (typeof window.meshApplyPayload === 'function') {
    return window.meshApplyPayload(payload);
  }
  return undefined;
}

export function applyMeshImport() {
  if (typeof window.meshApplyImport === 'function') {
    return window.meshApplyImport();
  }
  return undefined;
}

export function renderMeshStatus() {
  if (typeof window.renderMeshStatus === 'function') {
    return window.renderMeshStatus();
  }
  return undefined;
}

export function initMeshSyncMergeService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.meshSyncMergeService = {
    openMeshSync,
    queueMeshDelta,
    applyMeshPayload,
    applyMeshImport,
    renderMeshStatus,
  };
}