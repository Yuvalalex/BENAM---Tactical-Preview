import { getElement } from '../utils/DomHelper.js';

function callGlobal(name, ...args) {
  if (typeof window[name] === 'function') {
    return window[name](...args);
  }

  return undefined;
}

export function goScreen(screenId) {
  document.querySelectorAll('.screen.active').forEach((screen) => {
    if (screen.id !== screenId) {
      screen.classList.remove('active', 'screen-exit');
    }
  });

  const nextScreen = getElement(screenId);
  if (nextScreen) {
    nextScreen.classList.add('active');
  }

  updateTopbarWarMenu(screenId);

  const content = getElement('content');
  if (content) {
    content.scrollTop = 0;
  }
}

export function updateTopbarWarMenu(activeScreenId) {
  const onWarScreen = activeScreenId === 'sc-war';
  document.querySelectorAll('.tb-war-only').forEach((element) => {
    element.style.display = onWarScreen ? 'block' : 'none';
  });
}

export function setNav(index) {
  document.querySelectorAll('#bottomnav .nav-btn').forEach((button) => button.classList.remove('active'));
  const activeButton = getElement(`nav${index}`);
  if (activeButton) {
    activeButton.classList.add('active');
  }
}

export function setPrepTab(tab) {
  document.querySelectorAll('.prep-grp').forEach((element) => {
    element.classList.toggle('grp-hide', !element.classList.contains(`prep-grp-${tab}`));
  });

  document.querySelectorAll('#prep-sub-tabs .sub-tab').forEach((button) => button.classList.remove('active'));

  const tabs = document.querySelectorAll('#prep-sub-tabs .sub-tab');
  const tabIndex = { comms: 0, force: 1, evac: 2 }[tab] || 0;
  if (tabs[tabIndex]) {
    tabs[tabIndex].classList.add('active');
  }

  const content = getElement('content');
  if (content) {
    content.scrollTop = 0;
  }
}

export function setStatsTab(tab) {
  document.querySelectorAll('.stats-grp').forEach((element) => {
    element.classList.toggle('grp-hide', !element.classList.contains(`stats-grp-${tab}`));
  });

  document.querySelectorAll('#stats-sub-tabs .sub-tab').forEach((button) => button.classList.remove('active'));

  const tabs = document.querySelectorAll('#stats-sub-tabs .sub-tab');
  const tabIndex = { perf: 0, export: 1 }[tab] || 0;
  if (tabs[tabIndex]) {
    tabs[tabIndex].classList.add('active');
  }

  const content = getElement('content');
  if (content) {
    content.scrollTop = 0;
  }
}

export function resetReportViewToTop() {
  const reportText = getElement('report-txt');
  if (reportText) {
    reportText.scrollTop = 0;
  }

  const content = getElement('content');
  if (content) {
    content.scrollTop = 0;
  }
}

export function goReportTools() {
  callGlobal('populateQRPick');
  callGlobal('populateSupply');
  callGlobal('autoGenReport');
  callGlobal('renderBloodScreen');
  callGlobal('renderMedAlloc');
  callGlobal('renderEvacPriority');
  goScreen('sc-report');
  resetReportViewToTop();
}

export function openTimelineTools() {
  callGlobal('navGuard', 2, 'sc-stats', function onTimelineToolsOpen() {
    callGlobal('renderStats');
    callGlobal('renderTimeline');
    callGlobal('renderGantt');
  });
}

export function openRadioReportTools() {
  callGlobal('openRadioTemplates');
}

export function openUserSettings() {
  goScreen('sc-role');
  setNav(-1);
}

export function toggleTopbarMenu() {
  const menu = getElement('tb-menu');
  if (!menu) {
    return;
  }

  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

export function closeTopbarMenu() {
  const menu = getElement('tb-menu');
  if (menu) {
    menu.style.display = 'none';
  }
}

export function initNavigationComponent() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.navigation = {
    goScreen,
    updateTopbarWarMenu,
    setNav,
    setPrepTab,
    setStatsTab,
    resetReportViewToTop,
    goReportTools,
    openTimelineTools,
    openRadioReportTools,
    openUserSettings,
    toggleTopbarMenu,
    closeTopbarMenu,
  };
}