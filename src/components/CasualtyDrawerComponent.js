import { getAdjacentCasualtyId as getAdjacentCasualtyIdFromService } from '../services/CasualtyService.js';
import { getElement } from '../utils/DomHelper.js';

export function openCasualtyDrawer(casualtyId, renderDrawer) {
  if (typeof renderDrawer === 'function') {
    renderDrawer(casualtyId);
  }

  const drawer = getElement('cas-drawer');
  if (drawer) {
    drawer.classList.add('open');
  }

  const overlay = getElement('drawer-overlay');
  if (overlay) {
    overlay.classList.add('show');
  }

  const floatingActionButton = getElement('wr-fab');
  if (floatingActionButton) {
    floatingActionButton.classList.add('active');
  }
}

export function closeCasualtyDrawer(closeFireSheet) {
  const drawer = getElement('cas-drawer');
  if (drawer) {
    drawer.classList.remove('open');
  }

  const overlay = getElement('drawer-overlay');
  if (overlay) {
    overlay.classList.remove('show');
  }

  if (typeof closeFireSheet === 'function') {
    closeFireSheet();
  }

  const floatingActionButton = getElement('wr-fab');
  if (floatingActionButton) {
    floatingActionButton.classList.remove('active', 'open');
  }
}

export function getAdjacentCasualtyId(currentCasualtyId, direction) {
  return getAdjacentCasualtyIdFromService(currentCasualtyId, direction);
}

export function toggleFireActionSheet(isOpen, currentDrawerCasualtyId) {
  const nextOpenState = !isOpen;
  const fireSheet = getElement('fire-sheet');
  if (fireSheet) {
    fireSheet.classList.toggle('open', nextOpenState);
  }

  const floatingActionButton = getElement('wr-fab');
  if (floatingActionButton) {
    floatingActionButton.classList.toggle('open', nextOpenState);
  }

  const overlay = getElement('drawer-overlay');
  if (overlay) {
    overlay.classList.toggle('show', nextOpenState && !currentDrawerCasualtyId);
  }

  return nextOpenState;
}

export function closeFireActionSheet(currentDrawerCasualtyId) {
  const fireSheet = getElement('fire-sheet');
  if (fireSheet) {
    fireSheet.classList.remove('open');
  }

  const floatingActionButton = getElement('wr-fab');
  if (floatingActionButton) {
    floatingActionButton.classList.remove('open');
  }

  if (!currentDrawerCasualtyId) {
    const overlay = getElement('drawer-overlay');
    if (overlay) {
      overlay.classList.remove('show');
    }
  }
}

export function initCasualtyDrawerComponent() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.casualtyDrawer = {
    openCasualtyDrawer,
    closeCasualtyDrawer,
    getAdjacentCasualtyId,
    toggleFireActionSheet,
    closeFireActionSheet,
  };
}