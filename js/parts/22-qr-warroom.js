
function _applyImportedMissionState(state) {
  APP_MODE = state.appMode || (state.missionActive ? 'operational' : 'prep');
  S.missionStart = state.missionStart || null;
  S.missionActive = !!state.missionActive;
  S.fireMode = !!state.fireMode;
  const golden = $('gh-chip'); if (golden) golden.style.display = S.missionActive ? '' : 'none';
  const fireToggle = $('fire-toggle-btn'); if (fireToggle) fireToggle.style.display = S.missionActive ? '' : 'none';
  const navFire = $('nav-fire'); if (navFire) navFire.style.display = S.missionActive ? 'flex' : 'none';
  const voiceBtn = $('voice-btn'); if (voiceBtn) voiceBtn.style.display = S.missionActive ? '' : 'none';
  const phase = $('tb-phase');
  if (phase) {
    if (S.missionActive) {
      phase.textContent = 'ACTIVE';
      phase.className = 'tb-phase ph-active';
    } else if (APP_MODE === 'post') {
      phase.textContent = 'POST';
      phase.className = 'tb-phase ph-post';
    } else {
      phase.textContent = 'PREP';
      phase.className = 'tb-phase ph-prep';
    }
  }
  const sub = $('tb-sub');
  if (sub) sub.textContent = S.missionActive ? `אר"ן פעיל — ${S.casualties.length} פצועים` : 'מוכנות צוות / כוח / ציוד';
  updateNavMode();
  updateSitHeader();
  if (S.missionActive) {
    startGoldenHour();
    startReassessReminders();
    startSAPulse();
    if (typeof initVoice === 'function') initVoice();
  }
}

function _importStatePacket(packet) {
  const state = packet.state || packet;
  const importedCasualties = state.casualties || state.cas || [];
  const importedTimeline = state.timeline || state.tl || [];
  if (!confirm(`ייבא ${importedCasualties.length} פגועים + ${importedTimeline.length} אירועי timeline?\nהמצב הנוכחי יוחלף.`)) return;
  S.force = Array.isArray(state.force) ? state.force : [];
  S.casualties = importedCasualties.map(_normalizeImportedCasualty);
  S.timeline = Array.isArray(importedTimeline) ? importedTimeline : [];
  S.comms = state.comms ? { ...state.comms } : {};
  S.supplies = { ...S.supplies, ...(state.supplies || {}) };
  S.role = state.role || null;
  S.opMode = state.opMode || null;
  S.missionType = state.missionType || null;
  S.view = state.view || S.view;
  if (state.evac && typeof S_evac !== 'undefined' && S_evac) {
    Object.assign(S_evac, state.evac);
  }
  _applyImportedMissionState(state);
  renderForceList();
  renderWarRoom();
  renderTimeline();
  populateSupply();
  renderBloodScreen();
  renderMedAlloc();
  renderEvacPriority();
  showToast(`✓ ייובאו ${S.casualties.length} פגועים`);
  stopQRScan();
  goScreen(S.missionActive ? 'sc-war' : 'sc-prep'); setNav(S.missionActive ? 1 : 0);
  saveState();
}

function importScannedQR() {
  if (!_scannedJSON && !_scannedPacket) { showToast('אין נתונים לייבוא'); return; }
  try {
    const packet = _scannedPacket || JSON.parse(_scannedJSON);
    if (packet.kind === QR_PACKET_KIND_MESH) {
      meshApplyPayload(packet);
      stopQRScan();
      return;
    }
    if (packet.kind === QR_PACKET_KIND_STATE || packet.state || packet.cas) {
      _importStatePacket(packet);
      return;
    }
    if (packet.kind === 'single_casualty' && packet.casualty) {
      const c = _normalizeImportedCasualty(packet.casualty);
      const existing = S.casualties.find(x => x.id == c.id);
      if (existing) {
        if (!confirm(`פגוע "${c.name}" כבר קיים. להחליף?`)) { stopQRScan(); return; }
        Object.assign(existing, c);
        showToast(`✓ עודכן: ${c.name}`);
      } else {
        S.casualties.push(c);
        showToast(`✓ נוסף: ${c.name}`);
      }
      renderWarRoom();
      stopQRScan();
      goScreen(S.missionActive ? 'sc-war' : 'sc-prep');
      saveState();
      return;
    }
    showToast('פורמט לא תקין');
  } catch (e) { showToast('שגיאת JSON: ' + e.message); }
}

function stopScanStream() {
  if (_scanAnimId) { cancelAnimationFrame(_scanAnimId); _scanAnimId = null; }
  if (_scanStream) {
    _scanStream.getTracks().forEach(t => t.stop());
    _scanStream = null;
  }
}

function stopQRScan() {
  stopScanStream();
  const overlay = $('qr-scan-overlay');
  if (overlay) overlay.style.display = 'none';
  _resetQRScanState();
}

function doImportState() {
  const txt = ($('import-state-txt')?.value || '').trim();
  if (!txt) { showToast('הכנס JSON לייבוא'); return; }
  try {
    const d = JSON.parse(txt);
    if (!d.v || !d.cas) { showToast('פורמט לא תקין'); return; }
    if (!confirm(`ייבא ${d.cas.length} פגועים + ${d.tl?.length || 0} אירועי timeline?\nהמצב הנוכחי יוחלף.`)) return;
    S.casualties = d.cas;
    S.timeline = d.tl || S.timeline;
    if (d.mission && !S.missionStart) {
      S.missionStart = d.mission;
      S.missionActive = true;
      { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display=''; }
      const _ftb = $('fire-toggle-btn'); if (_ftb) _ftb.style.display = '';
      { const _nf = $('nav-fire'); if (_nf) _nf.style.display = 'flex'; }
      { const vb = $('voice-btn'); if (vb) vb.style.display = ''; }
      const ph = $('tb-phase'); if (ph) { ph.textContent = 'ACTIVE'; ph.className = 'tb-phase ph-active'; }
      startGoldenHour(); startReassessReminders(); if (typeof initVoice === 'function') initVoice();
    }
    if (d.comms) S.comms = d.comms;
    renderWarRoom();
    showToast(`✓ ייובאו ${d.cas.length} פגועים`);
    goScreen('sc-war'); setNav(1);
    saveState();
  } catch (e) { showToast('שגיאת JSON: ' + e.message); }
}

function downloadStateJSON() {
  const minimal = {
    v: 1, t: Date.now(),
    comms: S.comms,
    cas: S.casualties.map(c => ({ ...c, photos: [] })),
    tl: S.timeline,
    mission: S.missionStart,
    force: S.force, supplies: S.supplies
  };
  const blob = new Blob([JSON.stringify(minimal, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `benam-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('✓ מוריד קובץ JSON...');
}

function resetMission() {
  if (!confirm('מחק את כל הנתונים ואפס מצב?\nלא ניתן לבטל פעולה זו.')) return;
  localStorage.removeItem('benam_s');
  localStorage.removeItem('benam_s_training');
  location.reload();
}

// ═══════════════════════════════════════════════════
// 🏥 WAR ROOM — COCKPIT MODEL
// ═══════════════════════════════════════════════════
let _wrMoreOpen = false;
function toggleWRMore() {
  // Redirected to new tools menu (see enhancements.js)
  const tm = $('tools-menu');
  if (tm) tm.style.display = tm.style.display === 'block' ? 'none' : 'block';
}

// ── Triage strip update with animated rings ──
let _currentWarFilter = 'all';
function updateTriageStrip() {
  const total = S.casualties.length || 1;
  const circ = 94.25; // 2*PI*15
  ['T1', 'T2', 'T3', 'T4'].forEach(p => {
    const n = S.casualties.filter(c => c.priority === p).length;
    const el = $(`ts-${p.toLowerCase()}`);
    if (el) el.textContent = n;
    const ring = document.getElementById(`ring-${p.toLowerCase()}`);
    if (ring) {
      const pct = n / total;
      ring.setAttribute('stroke-dashoffset', circ * (1 - pct));
    }
  });
  // Update SA header
  updateSitHeader();
}

function updateSitHeader() {
  // Mission timer
  const timerEl = $('sit-timer-val');
  const chipEl = $('sit-mission-timer');
  if (timerEl && S.missionStart) {
    const el = Math.floor((Date.now() - S.missionStart) / 1000);
    const m = Math.floor(el / 60), s = el % 60;
    timerEl.textContent = p2(m) + ':' + p2(s);
    if (chipEl) {
      chipEl.classList.toggle('ok', el < 1800);
      chipEl.classList.toggle('warn', el >= 1800 && el < 3000);
    }
  }
  // Active medics
  const medicEl = $('sit-medic-count');
  if (medicEl) {
    const medics = new Set(S.casualties.map(c => c.medic).filter(Boolean));
    medicEl.textContent = medics.size;
  }
  // Supply counts
  const tqCountEl = $('sit-tq-count');
  const txaCountEl = $('sit-txa-count');
  if (tqCountEl && S.supplies) {
    const tqUsed = S.casualties.filter(c => c.tqStart).length;
    const tqTotal = (S.supplies.tq || 0);
    tqCountEl.textContent = Math.max(0, tqTotal - tqUsed);
    const txaUsed = S.casualties.filter(c => (c.txList || []).some(t => String((t && t.type) || '').toLowerCase().includes('txa'))).length;
    txaCountEl.textContent = Math.max(0, (S.supplies.txa || 0) - txaUsed);
    const supplyChip = $('sit-supply');
    if (supplyChip) {
      const low = (tqTotal - tqUsed) <= 1 || (S.supplies.txa || 0) - txaUsed <= 0;
      supplyChip.classList.toggle('crit', low);
    }
  }
  // Evac ETA countdown
  const evacEtaEl = $('sit-evac-eta');
  const evacValEl = $('sit-evac-val');
  if (evacEtaEl && evacValEl) {
    if (S.evacEta && S.evacEta > Date.now()) {
      evacEtaEl.style.display = '';
      const rem = Math.floor((S.evacEta - Date.now()) / 1000);
      const em = Math.floor(rem / 60), es = rem % 60;
      evacValEl.textContent = p2(em) + ':' + p2(es);
      evacEtaEl.classList.toggle('crit', rem < 120);
    } else if (S.evacEta) {
      evacEtaEl.style.display = '';
      evacValEl.textContent = 'הגיע!';
      evacEtaEl.classList.add('crit');
    } else {
      evacEtaEl.style.display = 'none';
    }
  }
  // Topbar readiness badge
  _updateTopbarReadiness();
}

function _updateTopbarReadiness() {
  const badge = $('tb-readiness-badge');
  const valEl = $('tb-readiness-val');
  if (!badge || !valEl) return;
  if (!S.missionStart) { badge.style.display = 'none'; return; }
  badge.style.display = '';
  // Calculate readiness from checklist state
  const checks = S.readinessChecks || {};
  const total = Object.keys(checks).length || 1;
  const done = Object.values(checks).filter(Boolean).length;
  const pct = Math.round((done / total) * 100);
  valEl.textContent = '';
  badge.style.borderColor = pct >= 80 ? 'var(--olive3)' : pct >= 50 ? 'var(--amber2)' : 'var(--red2)';
  badge.style.color = pct >= 80 ? 'var(--olive3)' : pct >= 50 ? 'var(--amber2)' : 'var(--red3)';
}

// ── War Room filter ──
function setWarFilter(f) {
  _currentWarFilter = f;
  document.querySelectorAll('.wr-filter-chip').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  renderWarRoom();
}
function applyWarFilter(list) {
  if (_currentWarFilter === 'all') return list;
  return list.filter(c => {
    switch (_currentWarFilter) {
      case 'needs-tx': return !c.txList || c.txList.length === 0;
      case 'tq-active': return !!c.tqStart;
      case 'no-medic': return !c.medic;
      case 'deteriorating': { const t = getDeteriorationTrend(c); return t.level === 'severe' || t.level === 'mild'; }
      default: return true;
    }
  });
}

function scrollToPrio(p) {
  const el = document.querySelector(`.cas-card-${p.toLowerCase()}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── Adaptive card renderer ──
let _prevCasIds = new Set();
function renderWarRoom() {
  syncMissionAutoState();
  updateTriageStrip();
  checkDeteriorationAI();

  const list = $('cas-list'); if (!list) return;
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const filtered = applyWarFilter(sorted);
  $('cas-count').textContent = sorted.length ? `(${filtered.length}/${sorted.length})` : '';

  if (!sorted.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">🏥</div>
      <div class="empty-state-title">אין פגועים</div>
      <div class="empty-state-sub">הוסף פגוע חדש עם ⊕ או הפעל מיון מהיר עם START</div>
      <button class="empty-state-btn" onclick="openAddCas()">⊕ הוסף פגוע</button>
    </div>`;
    _prevCasIds = new Set();
    return;
  }

  const newIds = new Set(filtered.map(c => c.id));
  list.innerHTML = filtered.map(c => {
    try {
      const isNew = !_prevCasIds.has(c.id);
      const card = renderAdaptiveCard(c);
      // Wrap in entry animation class for new cards
      if (isNew) return card.replace(/class="cas-card-t/, `class="cas-card-new cas-card-t`);
      return card;
    } catch (e) { console.error('card err', c.id, e); return `<div style="background:var(--crit-bg);border:1px solid var(--red2);border-radius:8px;padding:8px 12px;font-size:11px;color:var(--red3);cursor:pointer" onclick="jumpToCas(${c.id})">${escHTML(c.name || '?')} — שגיאת טעינה</div>`; }
  }).join('');
  _prevCasIds = newIds;

  // TQ live timers + critical pulse
  sorted.filter(c => c.tqStart).forEach(c => {
    const tqEl = document.getElementById(`tq-inline-${c.id}`);
    if (tqEl) {
      const m = Math.floor((Date.now() - c.tqStart) / 60000);
      tqEl.textContent = `TQ ${m}′`;
      tqEl.style.color = m > 45 ? 'var(--red3)' : m > 30 ? 'var(--amber3)' : 'var(--olive3)';
      if (m > 30) tqEl.classList.add('tq-crit-pulse');
      else tqEl.classList.remove('tq-crit-pulse');
    }
  });

  // Init card swipe on touch devices
  initCardSwipe();

  // Refresh active alternate view if not cards
  if (currentWarView === 'matrix') renderMatrixView();
  else if (currentWarView === 'triage') renderTriageBoardView();
  else if (currentWarView === 'march') renderMarchView();
  else if (currentWarView === 'blood') renderBloodQuickView();

  updateBadges();
}