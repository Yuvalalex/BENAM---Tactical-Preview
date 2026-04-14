// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
function _getNavigationModule() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.navigation ? window.BENAM_LEGACY.navigation : null;
}

function goScreen(id) {
  const navigation = _getNavigationModule();
  if (navigation && navigation.goScreen) return navigation.goScreen(id);
  // Keep only one active screen to avoid overlapping layouts after rapid feature clicks.
  document.querySelectorAll('.screen.active').forEach(sc => {
    if (sc.id !== id) sc.classList.remove('active', 'screen-exit');
  });
  const next = $(id);
  if (next) {
    next.classList.add('active');
  }
  updateTopbarWarMenu(id);
  $('content').scrollTop = 0;
  // Show/hide FAB based on screen (always show on War Room)
  const fab = $('wr-fab');
  if (fab) {
    if (id === 'sc-war') { fab.style.display = 'flex'; fab.classList.add('active'); }
    else { fab.style.display = 'none'; fab.classList.remove('active'); }
  }
}

function updateTopbarWarMenu(activeScreenId) {
  const navigation = _getNavigationModule();
  if (navigation && navigation.updateTopbarWarMenu) return navigation.updateTopbarWarMenu(activeScreenId);
  const onWar = activeScreenId === 'sc-war';
  document.querySelectorAll('.tb-war-only').forEach(el => {
    el.style.display = onWar ? 'block' : 'none';
  });
}
function setNav(i) {
  const navigation = _getNavigationModule();
  if (navigation && navigation.setNav) return navigation.setNav(i);
  document.querySelectorAll('#bottomnav .nav-btn').forEach(b => b.classList.remove('active'));
  const b = $('nav' + i); if (b) b.classList.add('active');
}

// ═══ SUB-TAB NAVIGATION ═══════════════════════════
function setPrepTab(tab) {
  const navigation = _getNavigationModule();
  if (navigation && navigation.setPrepTab) return navigation.setPrepTab(tab);
  // Toggle prep group visibility via class
  document.querySelectorAll('.prep-grp').forEach(el => {
    el.classList.toggle('grp-hide', !el.classList.contains('prep-grp-' + tab));
  });
  // Update active sub-tab button
  document.querySelectorAll('#prep-sub-tabs .sub-tab').forEach(b => b.classList.remove('active'));
  const tabs = document.querySelectorAll('#prep-sub-tabs .sub-tab');
  const idx = { comms: 0, force: 1, evac: 2 }[tab] || 0;
  if (tabs[idx]) tabs[idx].classList.add('active');
  $('content').scrollTop = 0;
}

function setStatsTab(tab) {
  const navigation = _getNavigationModule();
  if (navigation && navigation.setStatsTab) return navigation.setStatsTab(tab);
  document.querySelectorAll('.stats-grp').forEach(el => {
    el.classList.toggle('grp-hide', !el.classList.contains('stats-grp-' + tab));
  });
  document.querySelectorAll('#stats-sub-tabs .sub-tab').forEach(b => b.classList.remove('active'));
  const tabs = document.querySelectorAll('#stats-sub-tabs .sub-tab');
  const idx = { perf: 0, export: 1 }[tab] || 0;
  if (tabs[idx]) tabs[idx].classList.add('active');
  $('content').scrollTop = 0;
}

function goReportTools() {
  const navigation = _getNavigationModule();
  if (navigation && navigation.goReportTools) return navigation.goReportTools();
  // Open sc-report as a sub-screen from war room
  populateQRPick(); populateSupply(); autoGenReport(); renderBloodScreen(); renderMedAlloc(); renderEvacPriority();
  goScreen('sc-report');
  resetReportViewToTop();
}

function resetReportViewToTop() {
  const navigation = _getNavigationModule();
  if (navigation && navigation.resetReportViewToTop) return navigation.resetReportViewToTop();
  const box = $('report-txt');
  if (box) box.scrollTop = 0;
  const content = $('content');
  if (content) content.scrollTop = 0;
}

function openTimelineTools() {
  const navigation = _getNavigationModule();
  if (navigation && navigation.openTimelineTools) return navigation.openTimelineTools();
  navGuard(2, 'sc-stats', function () { renderStats(); renderTimeline(); renderGantt(); populateQRPick(); populateSupply(); renderBloodScreen(); renderMedAlloc(); renderEvacPriority(); });
}

function openRadioReportTools() {
  const navigation = _getNavigationModule();
  if (navigation && navigation.openRadioReportTools) return navigation.openRadioReportTools();
  openRadioTemplates();
}

// ═══════════════════════════════════════════════════
// WAR ROOM VIEW MODES
// ═══════════════════════════════════════════════════
let currentWarView = 'cards';
function setWarView(mode) {
  currentWarView = mode;
  ['cards', 'matrix', 'triage', 'march', 'blood'].forEach(v => {
    const el = $('wr-view-' + v); if (el) el.style.display = (v === mode) ? '' : 'none';
  });
  document.querySelectorAll('.vmode-btn').forEach(b => {
    b.classList.toggle('vmode-active', b.dataset.view === mode);
  });
  if (mode === 'matrix') renderMatrixView();
  else if (mode === 'triage') renderTriageBoardView();
  else if (mode === 'march') renderMarchView();
  else if (mode === 'blood') renderBloodQuickView();
}

function renderMatrixView() {
  const tb = $('matrix-tbody'); if (!tb) return;
  if (!S.casualties.length) { tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:16px">אין פגועים</td></tr>'; return; }
  tb.innerHTML = S.casualties.map((c, i) => {
    const v = c.vitals || {};
    const tq = c.tqStart ? formatTQ(Date.now() - c.tqStart) : '—';
    const txDone = c.txList ? c.txList.length : 0;
    return `<tr class="mt-${c.priority.toLowerCase()}" onclick="jumpToCas(${c.id})" style="cursor:pointer">
      <td style="font-weight:700;color:var(--muted2)">${i + 1}</td>
      <td style="text-align:right;font-weight:700">${escHTML(c.name)}</td>
      <td><span class="prio pt${c.priority[1]}">${c.priority}</span></td>
      <td style="font-family:var(--font-mono)">${v.pulse || '—'}</td>
      <td style="font-family:var(--font-mono)">${v.bp || '—'}</td>
      <td style="font-family:var(--font-mono)">${v.spo2 || '—'}</td>
      <td style="font-family:var(--font-mono)">${tq}</td>
      <td style="font-size:10px">${txDone ? txDone + ' טיפולים' : '—'}</td>
    </tr>`;
  }).join('');
}

function renderTriageBoardView() {
  const cols = { T1: $('tb-col-t1'), T2: $('tb-col-t2'), T3: $('tb-col-t3'), T4: $('tb-col-t4') };
  Object.values(cols).forEach(col => {
    if (!col) return;
    const hdr = col.querySelector('.tb-col-hdr');
    while (col.firstChild) col.removeChild(col.firstChild); if (hdr) col.appendChild(hdr);
  });
  S.casualties.forEach(c => {
    const col = cols[c.priority]; if (!col) return;
    const card = document.createElement('div');
    card.className = 'tb-card';
    card.onclick = () => jumpToCas(c.id);
    const v = c.vitals || {};
    const tq = c.tqStart ? formatTQ(Date.now() - c.tqStart) : '';
    card.innerHTML = `<div class="tb-card-name">${escHTML(c.name)}</div>
      <div class="tb-card-meta">${c.blood ? '🩸' + escHTML(c.blood) : ''} ${v.pulse ? '❤️' + v.pulse : ''} ${tq ? '⏱' + tq : ''}</div>`;
    col.appendChild(card);
  });
}

function renderMarchView() {
  const tb = $('march-tbody'); if (!tb) return;
  if (!S.casualties.length) { tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:16px">אין פגועים</td></tr>'; return; }
  tb.innerHTML = S.casualties.map(c => {
    const txTypes = (c.txList || []).map(t => String((t && t.type) || '').toLowerCase());
    const marchState = {
      m: txTypes.some(t => t.includes('tq') || t.includes('tourniquet') || t.includes('wound') || t.includes('hemostatic')),
      a: txTypes.some(t => t.includes('npa') || t.includes('airway') || t.includes('cric')),
      r: txTypes.some(t => t.includes('chest') || t.includes('seal') || t.includes('needle')),
      c: txTypes.some(t => t.includes('iv') || t.includes('txa') || t.includes('blood') || t.includes('fluid')),
      h: txTypes.some(t => t.includes('hypo') || t.includes('blanket') || t.includes('warm'))
    };
    function dot(done) { return done ? '<span class="march-dot march-dot-done">✓</span>' : '<span class="march-dot march-dot-na">—</span>'; }
    return `<tr onclick="jumpToCas(${c.id})" style="cursor:pointer">
      <td style="text-align:right;font-weight:700">${escHTML(c.name)}</td>
      <td><span class="prio pt${c.priority[1]}">${c.priority}</span></td>
      <td>${dot(marchState.m)}</td>
      <td>${dot(marchState.a)}</td>
      <td>${dot(marchState.r)}</td>
      <td>${dot(marchState.c)}</td>
      <td>${dot(marchState.h)}</td>
    </tr>`;
  }).join('');
}

function renderBloodQuickView() {
  const el = $('blood-quick-view'); if (!el) return;
  const withBlood = S.force.filter(f => f.blood);
  if (!withBlood.length) { el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px 0;text-align:center">הוסף לוחמים עם סוג דם לצפייה</div>'; return; }
  const groups = {}; withBlood.forEach(f => { if (!groups[f.blood]) groups[f.blood] = []; groups[f.blood].push(f); });
  let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
  Object.entries(groups).forEach(([bg, members]) => {
    html += `<div style="background:var(--s2);border:1px solid #440000;border-radius:8px;padding:10px">
      <div style="font-size:18px;font-weight:900;color:var(--red3);text-align:center">${escHTML(bg)}</div>
      <div style="font-size:10px;color:var(--muted2);text-align:center;margin-top:2px">${members.length} תורמים</div>
      <div style="margin-top:6px">${members.map(m => '<div style="font-size:10px;color:var(--white);padding:1px 0">' + escHTML(m.name) + '</div>').join('')}</div>
    </div>`;
  });
  html += '</div>';
  el.innerHTML = html;
}

function formatTQ(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

// ═══════════════════════════════════════════════════
// BADGE UPDATES
// ═══════════════════════════════════════════════════
function updateBadges() {
  // T1 count badge on nav1 (War Room)
  const t1Count = S.casualties.filter(c => c.priority === 'T1').length;
  const b1 = $('badge-t1');
  if (b1) { b1.textContent = t1Count; b1.style.display = t1Count ? 'flex' : 'none'; }
  // Pending evac badge on nav2
  const evacCount = S.casualties.filter(c => c.priority !== 'T4' && !c.evacuated).length;
  const b2 = $('badge-evac');
  if (b2) { b2.textContent = evacCount; b2.style.display = evacCount ? 'flex' : 'none'; }
}

// ═══════════════════════════════════════════════════