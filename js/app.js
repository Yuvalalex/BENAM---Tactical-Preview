// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
const ALL_BT = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const BLOOD_COMPAT = {
  'O-': ALL_BT, 'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'], 'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'], 'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'], 'AB+': ['AB+']
};
const S = {
  force: [], comms: {}, casualties: [], timeline: [],
  missionStart: null, missionActive: false, fireMode: false,
  supplies: { TQ: 4, Asherman: 2, Gauze: 10, TXA: 4, 'NaCl 500': 6, Morphine: 3, Ketamine: 3, NPA: 2, Hyfin: 3, Bandaids: 20 },
  view: 'cards', pendingFireAction: null,
  role: null, opMode: null, missionType: null,
  operations: [], leadership: {}, commsLog: [],
  prefs: {
    nightMode: false,
    voiceEnabled: true,
    autoSync: true,
    tqThreshold: 45, // min
    fontSize: 'normal',
    hapticFeedback: true,
    pinTimeout: 15, // min
    radioName: ''
  }
};
if (typeof window !== 'undefined') {
  window.S = S;
  window.getLegacyState = () => S;
  window.ALL_BT = ALL_BT;
  window.BLOOD_COMPAT = BLOOD_COMPAT;
}
// ── PERSISTENCE ────────────────────────────────────────
function _storageKey() {
  return S.opMode === 'training' ? 'benam_s_training' : 'benam_s';
}
const _STATE_SCHEMA_VERSION = 2;
function saveState() {
  let data = '';
  try {
    data = JSON.stringify({
      _schemaVersion: _STATE_SCHEMA_VERSION,
      force: S.force,
      casualties: S.casualties,
      timeline: S.timeline,
      comms: S.comms, supplies: S.supplies,
      missionStart: S.missionStart, missionActive: S.missionActive,
      role: S.role, opMode: S.opMode, missionType: S.missionType,
      operations: S.operations || [], 
      currentOperationId: S.currentOperationId || null,
      leadership: S.leadership || {},
      // Enhancement fields persisted
      commsLog: S.commsLog || [],
      lzStatus: S.lzStatus || {},
      medicAssignment: S.medicAssignment || {},
      evacEta: S.evacEta || null,
      readinessChecks: S.readinessChecks || {},
      prefs: S.prefs || { nightMode: false, voiceEnabled: true, autoSync: true, tqThreshold: 45, fontSize: 'normal', hapticFeedback: true, pinTimeout: 15, radioName: '' }
    });
    const key = _storageKey();
    // Backup previous state before overwriting
    const prev = localStorage.getItem(key);
    if (prev) {
      try { localStorage.setItem(key + '_backup', prev); } catch (_) { /* backup is best-effort */ }
    }
    if (typeof updateOperationStats === 'function') updateOperationStats();
    localStorage.setItem(key, data);
    // Photo persistence warning (once per session)
    const hasPhotos = (S.casualties || []).some(c => c.photos && c.photos.length > 0);
    if (hasPhotos && !saveState._photoWarned) {
      saveState._photoWarned = true;
      showToast('📸 תמונות לא נשמרות בין הפעלות — העבר/שתף לפני סגירה', 6000);
    }
  } catch (e) {
    console.error('saveState failed:', e);
    if (e.name === 'QuotaExceededError') {
      // Emergency pruning: strip photos first, then trim vitals history and timeline
      try {
        const slim = JSON.parse(data);
        slim.casualties = (slim.casualties || []).map(c => ({
          ...c,
          photos: [],
          vitalsHistory: (c.vitalsHistory || []).slice(-3),
        }));
        slim.timeline = (slim.timeline || []).slice(-50);
        localStorage.setItem(key, JSON.stringify(slim));
        showToast('⚠ Storage full — old data trimmed automatically', 5000);
      } catch (e2) {
        showToast('⛔ STORAGE FULL — DATA AT RISK — clear old missions', 8000);
      }
    }
  }
}
function _tryParseState(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}
function loadState() {
  try {
    const key = _storageKey();
    let raw = localStorage.getItem(key);
    if (!raw) raw = localStorage.getItem('benam_s');
    if (!raw) raw = localStorage.getItem('benam_s_training');
    if (!raw) return;
    let p = _tryParseState(raw);
    // If corrupted, try backup
    if (!p) {
      console.warn('[loadState] Primary state corrupted, trying backup...');
      const backupRaw = localStorage.getItem(key + '_backup') || localStorage.getItem('benam_s_backup');
      p = _tryParseState(backupRaw);
      if (p) {
        showToast('⚠ נתונים שוחזרו מגיבוי — בדוק תקינות', 8000);
      } else {
        showToast('⚠ שגיאה בטעינת נתונים — לא ניתן לשחזר', 8000);
        return;
      }
    }
    if (p.force) S.force = p.force;
    if (p.casualties) S.casualties = p.casualties.map(c => {
      // Migrate old saved states: fill any missing fields with defaults
      const nc = {
        vitalsHistory: [], photos: [], injuries: [],
        tqStart: null, txList: [], fluids: [], fluidTotal: 0,
        allergy: '', medic: '', buddyName: '', idNum: '', evacType: '',
        mech: [], blood: '', kg: 70, name: '?',
        timeOfInjury: null,
        vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
        march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
        ...c,
        _addedAt: c._addedAt || (c.id > 1000000000000 ? c.id : Date.now()),
        priority: c.priority || 'T3',
      };
      if (!nc.vitals || typeof nc.vitals !== 'object') nc.vitals = { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' };
      if (!Array.isArray(nc.mech)) nc.mech = [];
      if (!Array.isArray(nc.injuries)) nc.injuries = [];
      if (!Array.isArray(nc.txList)) nc.txList = [];
      nc.march = Object.assign({ M: 0, A: 0, R: 0, C: 0, H: 0 }, c.march || {});
      return nc;
    });
    if (p.timeline) S.timeline = p.timeline;
    if (p.comms) Object.assign(S.comms, p.comms);
    if (p.supplies) Object.assign(S.supplies, p.supplies);
    if (p.missionStart) S.missionStart = p.missionStart;
    // Restore enhancement fields
    if (p.commsLog) S.commsLog = p.commsLog;
    if (p.lzStatus) S.lzStatus = p.lzStatus;
    if (p.medicAssignment) S.medicAssignment = p.medicAssignment;
    if (p.operations) S.operations = p.operations;
    if (p.currentOperationId) S.currentOperationId = p.currentOperationId;
    if (p.leadership) S.leadership = p.leadership;
    if (p.evacEta) S.evacEta = p.evacEta;
    if (p.readinessChecks) S.readinessChecks = p.readinessChecks;
    if (p.prefs) S.prefs = Object.assign(S.prefs, p.prefs);
    if (p.missionActive) {
      S.missionActive = true;
      APP_MODE = 'operational';
      const _gb = document.getElementById('gh-chip'); if (_gb) _gb.style.display = '';
      const _ftb = document.getElementById('fire-toggle-btn'); if (_ftb) _ftb.style.display = '';
      const _nf = document.getElementById('nav-fire'); if (_nf) _nf.style.display = 'flex';
      { const vb = document.getElementById('voice-btn'); if (vb) vb.style.display = ''; }
      const ph = document.getElementById('tb-phase');
      if (ph) { ph.textContent = 'ACTIVE'; ph.className = 'tb-phase ph-active'; }
      const _tbsub = document.getElementById('tb-sub'); if (_tbsub) _tbsub.textContent = `אר"ן פעיל — ${S.casualties.length} פצועים`;
      startGoldenHour(); startReassessReminders(); startSAPulse();
    }
    updateSitHeader();
    renderForceList(); renderWarRoom(); renderTimeline();
    if (p.role) S.role = p.role;
    if (p.opMode) S.opMode = p.opMode;
    if (p.missionType) S.missionType = p.missionType;
    if (S.role && S.opMode && S.missionType) {
      applyRoleFilter();
      updateTrainingBanner();
      if (!S.missionActive) { goScreen('sc-prep'); setNav(0); }
    }
    if (S.missionActive) showToast('✓ שוחזר — ' + S.casualties.length + ' פגועים');
  } catch (e) {
    console.error('[loadState] Critical error:', e);
    showToast('⚠ שגיאה בטעינת נתונים — נסה לרענן', 8000);
  }
}
// ─────────────────────────────────────────────────
let guidedSteps = [], guidedIdx = 0, guidedCasId = null;

// ═══ APP MODE STATE ═══════════════════════════════
// prep → operational → post
var APP_MODE = 'prep'; // 'prep' | 'operational' | 'post'

function updateNavMode() {
  const nav0 = $('nav0'), nav1 = $('nav1'), nav2 = $('nav2');
  [nav0, nav1, nav2].forEach(b => { if (b) { b.style.pointerEvents = 'auto'; } });

  const topbar = $('topbar-normal');
  if (topbar) { topbar.classList.remove('topbar-active', 'topbar-post'); }

  // Keep tab icons readable in all modes.
  [nav0, nav1, nav2].forEach(b => { if (b) b.style.opacity = '1'; });
  if (APP_MODE === 'operational') {
    if (topbar) topbar.classList.add('topbar-active');
  } else if (APP_MODE === 'post') {
    if (topbar) topbar.classList.add('topbar-post');
  }
}

function navGuard(idx, screenId, cb) {
  // War Room is also useful in prep for planning and review.
  goScreen(screenId); setNav(idx);
  if (cb) cb();
  updateBadges();
}
const MEDIC_RANK = { 'רופא': 5, 'פראמדיק': 4, 'חובש': 3, 'מח"ר': 2, 'לורם': 1 };

function getMedicLevel(role) { return MEDIC_RANK[role] || 0; }

function getMedicRoster() {
  return (S.force || []).filter(f => f && getMedicLevel(f.role) > 0)
    .sort((a, b) => getMedicLevel(b?.role) - getMedicLevel(a?.role));
}

function getActiveCasForMedicAlloc() {
  return S.casualties.filter(c => {
    const st = c?.evacPipeline?.stage || '';
    return c.priority !== 'T4' && !c.evacuated && st !== 'hospital' && st !== 'done';
  });
}

function medicCapacity(m) {
  const lvl = getMedicLevel(m?.role);
  if (lvl >= 5) return 5;
  if (lvl >= 4) return 4;
  if (lvl >= 3) return 3;
  return 2;
}

function casLoadWeight(c) {
  return ({ T1: 3, T2: 2, T3: 1 }[c.priority] || 1);
}

function buildMedicLoadMap(casualties, medics) {
  const byMedic = {};
  medics.forEach(m => { byMedic[m.name] = 0; });
  casualties.forEach(c => {
    if (c.medic && byMedic[c.medic] !== undefined) byMedic[c.medic] += casLoadWeight(c);
  });
  return byMedic;
}

function autoBalanceMedicAllocation() {
  const medics = getMedicRoster();
  const casualties = [...getActiveCasForMedicAlloc()];
  if (!medics.length) { showToast('אין גורמי רפואה בכוח'); return; }
  if (!casualties.length) { showToast('אין פגועים פעילים לשיבוץ'); return; }

  const byMedic = {};
  medics.forEach(m => { byMedic[m.name] = 0; });

  casualties.sort((a, b) => {
    const pa = ({ T1: 100, T2: 60, T3: 20 }[a.priority] || 0) + (a.tqStart ? 8 : 0);
    const pb = ({ T1: 100, T2: 60, T3: 20 }[b.priority] || 0) + (b.tqStart ? 8 : 0);
    return pb - pa;
  });

  casualties.forEach(c => {
    const ranked = [...medics].sort((m1, m2) => {
      const r1 = byMedic[m1.name] / Math.max(1, medicCapacity(m1));
      const r2 = byMedic[m2.name] / Math.max(1, medicCapacity(m2));
      if (r1 !== r2) return r1 - r2;
      return getMedicLevel(m2.role) - getMedicLevel(m1.role);
    });
    const best = ranked[0];
    c.medic = best.name;
    byMedic[best.name] += casLoadWeight(c);
  });

  saveState();
  renderWarRoom();
  renderMedAlloc();
  openMedicAllocView();
  showToast(`⚡ איזון אוטומטי הושלם (${casualties.length} פצועים)`);
}

function renderMedAlloc() {
  const el = $('med-alloc'); if (!el) return;
  const medics = getMedicRoster();
  const casualties = [...getActiveCasForMedicAlloc()].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const loadMap = buildMedicLoadMap(casualties, medics);

  if (!medics.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--red3);padding:8px 0;font-weight:700">⚠️ אין גורמי רפואה בכוח!</div>';
    return;
  }
  if (!casualties.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px 0">אין פגועים פעילים</div>';
    return;
  }

  // Assign: highest medic → most critical casualty, round-robin for extras
  const assignments = [];
  casualties.forEach((c, i) => {
    const medic = medics[i % medics.length];
    const isBest = i < medics.length;
    assignments.push({ cas: c, medic, isBest });
  });

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${assignments.map(({ cas, medic, isBest }) => `
        <div style="background:var(--s2);border:1px solid ${cas.priority === 'T1' ? 'var(--red2)' : cas.priority === 'T2' ? 'var(--amber)' : 'var(--b0)'};border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px">
          <span class="prio pt${cas.priority[1]}" style="font-size:10px;flex-shrink:0">${cas.priority}</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700">${escHTML(cas.name)}</div>
            <div style="font-size:9px;color:var(--muted)">${cas.mech.join('/')}</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:11px;font-weight:700;color:${isBest ? 'var(--green3)' : 'var(--olive3)'}">${escHTML(medic.name)}</div>
            <div style="font-size:8px;color:var(--olive3)">${medic.role} · ${loadMap[medic.name] || 0}/${medicCapacity(medic)}</div>
          </div>
          <button class="btn btn-xs btn-ghost" onclick="quickReassignMedic(${cas.id})">↔</button>
          <button class="btn btn-xs btn-olive" onclick="assignMedic(${cas.id},'${escHTML(medic.name)}')">✓</button>
        </div>`).join('')}
      ${medics.length > casualties.length ? `
        <div style="font-size:10px;color:var(--olive3);padding:4px 0">
          ✓ ${medics.slice(casualties.length).map(m => `${escHTML(m.name)} (${m.role})`).join(', ')} — זמינים
        </div>`: ''}
    </div>`;
}

function assignMedic(casId, medicName) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.medic = medicName;
  addTL(casId, c.name, `🩺 שובץ: ${medicName}`, 'olive');
  renderWarRoom();
  renderMedAlloc();
  saveState();
  if (_drawerCasId == casId) renderDrawer(casId);
  showToast(`✓ ${medicName} → ${c.name}`);
}

// ═══ EVACUATION PRIORITY ENGINE ════════════════════
function calcEvacScore(c) {
  return calcEvacScoreDetailed(c).score;
}

function getEvacStage(c) {
  if (c?.evacPipeline?.stage) return c.evacPipeline.stage;
  // Legacy saved states may have only `evacuated` without pipeline stage.
  // Treat them as hospital stage so they can still be managed in queue.
  return c?.evacuated ? 'hospital' : 'injury';
}

function getEvacCandidates() {
  const base = (S.casualties || []).filter(c => c.priority !== 'T4');
  const strict = base.filter(c => getEvacStage(c) !== 'done');
  return { base, strict };
}

function getEvacStageLabel(stage) {
  return ({
    injury: 'פציעה',
    collection: 'איסוף',
    pickup: 'העמסה',
    transit: 'בדרך',
    hospital: 'בבית חולים',
    done: 'פונה'
  }[stage] || 'פציעה');
}

function getEvacStageColor(stage) {
  return ({
    injury: 'var(--red3)',
    collection: 'var(--amber3)',
    pickup: 'var(--olive3)',
    transit: 'var(--olive3)',
    hospital: 'var(--green3)',
    done: 'var(--green3)'
  }[stage] || 'var(--muted2)');
}

function calcEvacScoreDetailed(c) {
  let score = 0;
  const reasons = [];
  const p = { 'T1': 100, 'T2': 60, 'T3': 20, 'T4': 0 }[c.priority] || 0;
  score += p;
  if (c.priority === 'T1') reasons.push('T1 קריטי');

  if (c.tqStart) {
    const m = Math.floor((Date.now() - c.tqStart) / 60000);
    if (m > 30) { score += 40; reasons.push(`TQ ${m}′`); }
    else if (m > 15) { score += 20; reasons.push(`TQ ${m}′`); }
  }

  const gcs = parseInt(c.vitals?.gcs) || 15;
  if (gcs <= 8) { score += 30; reasons.push('GCS נמוך'); }
  else if (gcs <= 12) { score += 15; reasons.push('GCS גבולי'); }

  const spo2 = parseInt(c.vitals?.spo2) || 98;
  if (spo2 < 90) { score += 25; reasons.push('SpO2 נמוך'); }
  else if (spo2 < 94) { score += 10; reasons.push('SpO2 90-93'); }

  const pulse = parseInt(c.vitals?.pulse) || 72;
  if (pulse > 120 || pulse < 50) { score += 20; reasons.push('דופק חריג'); }

  if (!(c.txList || []).length) { score += 15; reasons.push('ללא טיפול'); }
  if (!c.medic) { score += 10; reasons.push('ללא מטפל'); }
  if (!c.evacType) { score += 8; reasons.push('סוג פינוי לא הוגדר'); }

  const stage = getEvacStage(c);
  const stageBoost = { injury: 12, collection: 8, pickup: 4, transit: 2, hospital: -20, done: -40 }[stage] || 0;
  score += stageBoost;

  // Simple deterioration detector from last two vitals snapshots.
  const vh = c.vitalsHistory || [];
  if (vh.length >= 2) {
    const a = vh[vh.length - 2] || {};
    const b = vh[vh.length - 1] || {};
    const pa = parseInt(a.pulse), pb = parseInt(b.pulse), sa = parseInt(a.spo2), sb = parseInt(b.spo2);
    const pulseJump = !isNaN(pa) && !isNaN(pb) && (pb - pa >= 20);
    const spo2Drop = !isNaN(sa) && !isNaN(sb) && (sa - sb >= 4);
    if (pulseJump || spo2Drop) {
      score += 12;
      reasons.push('מגמת הידרדרות');
    }
  }

  score = Math.max(0, Math.min(220, score));
  return { score, reasons, stage };
}

function ensureEvacPipeline(c) {
  if (!c.evacPipeline) c.evacPipeline = { stage: 'injury', times: { injury: nowTime() } };
}

function advanceEvacStage(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  ensureEvacPipeline(c);
  const flow = ['injury', 'collection', 'pickup', 'transit', 'hospital', 'done'];
  const cur = getEvacStage(c);
  const idx = flow.indexOf(cur);
  if (idx === -1 || idx === flow.length - 1) { showToast('הפינוי כבר הושלם'); return; }
  const next = flow[idx + 1];
  c.evacPipeline.stage = next;
  c.evacPipeline.times[next] = nowTime();
  c.evacuated = (next === 'hospital' || next === 'done');
  addTL(casId, c.name, `🚁 פינוי: ${getEvacStageLabel(next)}`, 'blue');
  saveState();
  renderWarRoom();
  renderEvacPriority();
  if ($('evac-modal')?.style.display === 'block') renderEvacSlots();
  showToast(`🚁 ${c.name} → ${getEvacStageLabel(next)}`);
}

function renderEvacPriority() {
  const el = $('evac-priority-list'); if (!el) return;
  const active = S.casualties.filter(c => c.priority !== 'T4' && getEvacStage(c) !== 'done');
  if (!active.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px 0">אין פגועים פעילים</div>';
    return;
  }
  const ranked = [...active].sort((a, b) => calcEvacScoreDetailed(b).score - calcEvacScoreDetailed(a).score);
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:5px">
      ${ranked.map((c, i) => {
    const d = calcEvacScoreDetailed(c);
    const sc = d.score;
    const reasons = d.reasons;
    const stageLbl = getEvacStageLabel(d.stage);
    const stageClr = getEvacStageColor(d.stage);
    return `<div style="background:var(--s2);border:1px solid ${i === 0 ? 'var(--red2)' : i === 1 ? 'var(--amber)' : 'var(--b0)'};border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px">
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${i === 0 ? 'var(--red3)' : i === 1 ? 'var(--amber3)' : 'var(--muted2)'};min-width:22px">${i + 1}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${escHTML(c.name)}
              <span style="font-size:9px;padding:1px 6px;border-radius:10px;background:rgba(255,255,255,.04);color:${stageClr};border:1px solid var(--b0)">${stageLbl}</span>
            </div>
            <div style="font-size:9px;color:var(--muted2);margin-top:2px">${(reasons.slice(0, 4).join(' · ') || c.priority)}</div>
            <div style="display:flex;gap:4px;margin-top:5px">
              <button class="btn btn-xs btn-ghost" style="font-size:9px;min-height:20px" onclick="advanceEvacStage(${c.id})">שלב ▶</button>
              <button class="btn btn-xs btn-ghost" style="font-size:9px;min-height:20px" onclick="openEvacPipeline(${c.id})">Pipeline</button>
            </div>
          </div>
          <span class="prio pt${c.priority[1]}" style="font-size:10px">${c.priority}</span>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--olive3)">${sc}pt</div>
        </div>`;
  }).join('')}
    </div>`;
}

// ═══ AUTO 9-LINE ════════════════════════════════════
function autoGenReport() {
  if (!S.casualties.length) return;
  genReport();
}

// ═══ TIMELINE FILTER ════════════════════════════════
let _tlFilter = null;

function renderTimeline() {
  const listFull = $('timeline-list');
  const listStats = $('timeline-list-stats');
  if (!S.timeline.length) {
    if (listFull) listFull.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">טרום אירוע</div>';
    if (listStats) listStats.innerHTML = '<div style="text-align:center;padding:15px;color:var(--muted);font-size:11px">אין אירועים רשומים</div>';
    return;
  }

  // Build filter chips
  const names = [...new Set(S.timeline.map(t => t.name).filter(n => n !== 'SYSTEM'))];
  const filterHTML = `
    <div style="display:flex;gap:5px;padding:4px 10px 8px;overflow-x:auto;flex-wrap:nowrap">
      <button class="btn btn-xs ${_tlFilter === null ? 'btn-olive' : 'btn-ghost'}" onclick="_tlFilter=null;renderTimeline()">הכל</button>
      ${names.map(n => `<button class="btn btn-xs ${_tlFilter === n ? 'btn-olive' : 'btn-ghost'}" style="white-space:nowrap" onclick="_tlFilter='${escHTML(n)}';renderTimeline()">${escHTML(n)}</button>`).join('')}
    </div>`;

  const filtered = _tlFilter ? S.timeline.filter(t => t.name === _tlFilter || t.name === 'SYSTEM') : S.timeline;
  const dotClr = { red: 'var(--red3)', amber: 'var(--amber3)', green: 'var(--green3)', olive: 'var(--olive3)', muted: 'var(--muted)' };

  const itemsHTML = filtered.map(t => `
    <div class="tl-item" onclick="_tlFilter='${escHTML(t.name)}';renderTimeline()" style="cursor:pointer; padding: 10px 14px">
      <div class="tl-time" style="width:45px">${t.time}</div>
      <div class="tl-dot" style="background:${dotClr[t.color] || 'var(--muted)'}; width:8px; height:8px; margin-top:5px"></div>
      <div style="flex:1">
        <div class="tl-who" style="color:${_tlFilter === t.name ? 'var(--olive3)' : 'inherit'}; font-size:12px">${escHTML(t.name)}</div>
        <div class="tl-what" style="font-size:11px; color:var(--muted2)">${escHTML(t.what)}</div>
      </div>
    </div>`).reverse().join('');

  if (listFull) listFull.innerHTML = filterHTML + itemsHTML;
  if (listStats) listStats.innerHTML = itemsHTML;

  // Update Notification Center while we're at it
  renderUpdateCenter();
}

function renderUpdateCenter() {
  const el = $('stat-updates-list');
  if (!el) return;
  const alerts = [];
  
  // Check for critical TQs
  S.casualties.forEach(c => {
    if (c.tqStart) {
      const mins = Math.floor((Date.now() - c.tqStart) / 60000);
      if (mins > 45) alerts.push({ type: 'crit', msg: `🔴 TQ על ${c.name} מעל 45 דק' (${mins} דק')` });
      else if (mins > 30) alerts.push({ type: 'warn', msg: `⚠️ TQ על ${c.name} כבר ${mins} דק' - בדוק שחרור` });
    }
    // Check for vitals
    if (c.vitalsHistory && c.vitalsHistory.length > 1) {
       const v1 = c.vitalsHistory[c.vitalsHistory.length-1];
       const v2 = c.vitalsHistory[c.vitalsHistory.length-2];
       if (parseInt(v1.v.pulse) > parseInt(v2.v.pulse) + 20) alerts.push({ type: 'warn', msg: `📈 עליית דופק חדה אצל ${c.name}` });
    }
  });

  if (!alerts.length) {
    el.innerHTML = '<div style="font-size:11px; color:var(--muted); text-align:center; padding:10px">✅ אין התראות מבצעיות חדשות</div>';
    return;
  }

  el.innerHTML = alerts.map(a => `
    <div style="background:${a.type==='crit'?'rgba(200,40,40,0.1)':'rgba(200,150,0,0.05)'}; border:1px solid ${a.type==='crit'?'var(--red2)':'var(--amber)'}; padding:10px; border-radius:8px; font-size:12px; font-weight:700; color:var(--white)">
      ${a.msg}
    </div>
  `).join('');
}

// ═══ GANTT CHART (תחקיר) ════════════════════════════
function renderGantt() {
  const el = $('gantt-chart'); if (!el) return;
  if (!S.missionStart || !S.casualties.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:12px">הפעל אר"ן עם פגועים לגרף Gantt</div>';
    return;
  }
  const now = Date.now();
  const dur = Math.max(600000, now - S.missionStart); // Min 10 min scale
  const W = el.offsetWidth || 340;
  const MARGIN_LEFT = 50; // Room for names
  const CHART_W = W - MARGIN_LEFT - 10;
  const scale = t => MARGIN_LEFT + Math.round(((t - S.missionStart) / dur) * CHART_W);
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const H_ROW = 28, PAD_TOP = 5;

  const svgH = sorted.length * H_ROW + 55; // More headroom for legend
  const stepMin = dur < 3600000 ? 10 : 30;
  const ticks = [];
  for (let m = 0; m * 60000 <= dur; m += stepMin) ticks.push(m);

  let svg = `<svg width="${W}" height="${svgH}" style="overflow:visible;display:block;font-family:inherit">`;

  // Time axis grid & labels
  ticks.forEach(m => {
    const x = scale(S.missionStart + m * 60000);
    svg += `<line x1="${x}" y1="${PAD_TOP}" x2="${x}" y2="${sorted.length * H_ROW + PAD_TOP}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${sorted.length * H_ROW + PAD_TOP + 16}" font-size="8" fill="var(--muted2)" text-anchor="middle">${m}′</text>`;
  });

  // Background bands & Names
  sorted.forEach((c, i) => {
    const y = i * H_ROW + PAD_TOP;
    const bg = c.priority === 'T1' ? 'rgba(200,40,40,.08)' : c.priority === 'T2' ? 'rgba(215,160,0,.06)' : 'rgba(80,140,80,.05)';
    svg += `<rect x="0" y="${y}" width="${W}" height="${H_ROW - 4}" fill="${bg}" rx="4"/>`;
    svg += `<text x="6" y="${y + 16}" font-size="10" fill="${c.priority==='T1'?'var(--red3)':c.priority==='T2'?'var(--amber3)':'var(--olive3)'}" font-weight="700" style="text-shadow:0 1px 2px rgba(0,0,0,.5)">${escHTML(c.name.split(' ')[0])}</text>`;
  });

  // Events on timeline
  sorted.forEach((c, i) => {
    const y = i * H_ROW + PAD_TOP;
    const centerY = y + (H_ROW - 4) / 2;

    // Added marker
    if (c._addedAt) {
      const x = scale(c._addedAt);
      svg += `<circle cx="${x}" cy="${centerY}" r="5" fill="${pClr(c.priority)}" stroke="#fff" stroke-width="1.5"/>`;
    }

    // TQ Duration highlight
    if (c.tqStart) {
      const xStart = scale(c.tqStart);
      const tqEnd = Math.min(now, c.tqStart + 120 * 60000);
      const xEnd = scale(tqEnd);
      const barW = Math.max(4, xEnd - xStart);
      const tqM = Math.floor((now - c.tqStart) / 60000);
      const barClr = tqM > 60 ? 'var(--red3)' : tqM > 45 ? 'var(--red2)' : 'var(--amber3)';
      svg += `<rect x="${xStart}" y="${centerY - 4}" width="${barW}" height="8" fill="${barClr}" opacity=".35" rx="2"/>`;
      svg += `<rect x="${xStart - 1.5}" y="${centerY - 7}" width="3" height="14" fill="${barClr}" rx="1"/>`;
    }

    // Treatments
    c.txList.forEach(tx => {
      if (!tx.ms) return;
      const x = scale(tx.ms);
      const isTXA = tx.type.toLowerCase().includes('txa');
      svg += `<circle cx="${x}" cy="${centerY}" r="3.5" fill="${isTXA ? 'var(--amber3)' : '#4a9eff'}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>`;
    });
  });

  // Legend at bottom
  const legY = svgH - 12;
  const legItems = [
    { n: 'מגע', c: 'var(--olive3)', r: 5 },
    { n: 'TQ', c: 'var(--red3)', r: 4, type:'rect' },
    { n: 'TXA', c: 'var(--amber3)', r: 3.5 },
    { n: 'טיפול', c: '#4a9eff', r: 3.5 }
  ];
  let curX = 10;
  legItems.forEach(item => {
    if(item.type==='rect') svg += `<rect x="${curX}" y="${legY-6}" width="3" height="12" fill="${item.c}" rx="1"/>`;
    else svg += `<circle cx="${curX+4}" cy="${legY}" r="${item.r}" fill="${item.c}"/>`;
    svg += `<text x="${curX + 12}" y="${legY + 4}" font-size="9" fill="var(--muted2)" font-weight="700">${item.n}</text>`;
    curX += 45;
  });

  svg += `</svg>`;
  el.innerHTML = svg;
}
var mechSel = [];
var voiceRecog = null, voiceActive = false;
var reassessIntervals = {};

// ═══════════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════════
function p2(n) { return String(n).padStart(2, '0'); }
setInterval(() => {
  try {
    if (document.hidden) return;
    const n = new Date();
    $('clock').textContent = `${p2(n.getHours())}:${p2(n.getMinutes())}:${p2(n.getSeconds())}`;
  } catch (_) {}
}, 1000);

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
function $(id) { return document.getElementById(id); }
function escHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
var _casIdCounter = Date.now() + Math.floor(Math.random() * 100000);
function nextCasId() { return ++_casIdCounter; }
const MEDICAL = Object.freeze({
  TXA_WINDOW_MIN: 180, TXA_WARN_THRESHOLD: 60,
  TQ_CRITICAL_SEC: 3000, TQ_WARN_SEC: 2400,
  MAX_VITALS_HISTORY: 10, MAX_TIMELINE_EVENTS: 500
});
if (typeof window !== 'undefined') {
  window.MEDICAL = MEDICAL;
  window.nextCasId = nextCasId;
  window.$ = $;
  window.showToast = showToast;
  window.prioDot = prioDot;
  window.nowTime = nowTime;
  window.addTL = addTL;
  window.getSelectVal = getSelectVal;
}

// ══ ROLE / MODE SETUP ══════════════════════════════
const ROLE_LABELS = { commander: 'מפקד', medic: 'חובש', doc: 'רופא', paramedic: 'פראמדיק' };
const MISSION_LABELS = { open: 'ארן פתוח', urban: 'עירוני', ruins: 'חורבות', lms: 'LMS', base: 'כוננות' };

function selectMode(m) {
  S.opMode = m;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`[data-mode="${m}"]`);
  if (btn) btn.classList.add('selected');
  tryEnableContinue();
}
function selectRole(r) {
  S.role = r;
  document.querySelectorAll('[data-role]').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`[data-role="${r}"]`);
  if (btn) btn.classList.add('selected');
  tryEnableContinue();
}
function selectMission(m) {
  S.missionType = m;
  document.querySelectorAll('[data-mission]').forEach(b => b.classList.remove('selected'));
  const btn = document.querySelector(`[data-mission="${m}"]`);
  if (btn) btn.classList.add('selected');
  tryEnableContinue();
}
function tryEnableContinue() {
  const btn = $('role-continue-btn'); if (!btn) return;
  const ready = S.role && S.opMode && S.missionType;
  btn.style.opacity = ready ? '1' : '.4';
  btn.style.pointerEvents = ready ? 'auto' : 'none';
}
function confirmRoleSetup() {
  applyRoleFilter();
  updateTrainingBanner();
  applyModeFilter();
  // Show MCE activate button in banner when operational
  const mceBtn = $('mce-activate-btn');
  if (mceBtn && S.opMode === 'operational' && !S.missionActive) mceBtn.style.display = '';
  // Load mode-specific saved state if available
  const key = S.opMode === 'training' ? 'benam_s_training' : 'benam_s';
  const raw = localStorage.getItem(key);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p.force) S.force = p.force;
      if (p.casualties) S.casualties = p.casualties;
      if (p.timeline) S.timeline = p.timeline;
      if (p.comms) Object.assign(S.comms, p.comms);
      if (p.supplies) Object.assign(S.supplies, p.supplies);
      S.missionStart = p.missionStart || null;
      S.missionActive = !!p.missionActive;
      renderForceList(); renderWarRoom(); renderTimeline();
    } catch (e) { }
  }
  goScreen('sc-prep'); setNav(0);
  if (S.opMode === 'training') setTimeout(() => openTraining(), 400);
}

function updateTrainingBanner() {
  let banner = $('training-mode-banner');
  if (S.opMode === 'training') {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'training-mode-banner';
      banner.style.cssText = 'background:linear-gradient(90deg,var(--blue2),var(--blue));color:var(--olive3);text-align:center;font-size:11px;font-weight:700;padding:4px 0;letter-spacing:.1em;position:sticky;top:0;z-index:400';
      banner.textContent = '🎓 מצב אימון — נתונים לא מבצעיים';
      const content = $('content');
      if (content) content.parentNode.insertBefore(banner, content);
    }
    banner.style.display = '';
    document.body.classList.add('training-mode');
  } else {
    if (banner) banner.style.display = 'none';
    document.body.classList.remove('training-mode');
  }
}
function skipRoleSetup() {
  S.role = 'paramedic'; S.opMode = 'operational'; S.missionType = 'open';
  applyRoleFilter();
  goScreen('sc-prep'); setNav(0);
}
function applyRoleFilter() {
  const el = $('role-badge');
  if (el) {
    const label = ROLE_LABELS[S.role] || '';
    const modeIcon = S.opMode === 'training' ? '🎓' : '⚔';
    el.textContent = `${label} ${modeIcon}`;
    el.style.display = '';
    el.style.borderColor = S.opMode === 'training' ? 'var(--blue2)' : 'var(--b1)';
    el.style.color = S.opMode === 'training' ? 'var(--olive3)' : 'var(--olive3)';
    el.title = `תפקיד: ${label}\nמצב: ${S.opMode === 'training' ? 'אימון' : 'מבצעי'}\nסוג: ${MISSION_LABELS[S.missionType] || S.missionType || ''}`;
  }
  saveState();
}
// ═══════════════════════════════════════════════════
function initials(name) { return (name || '').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase(); }
function prioN(p) { return { T1: 1, T2: 2, T3: 3, T4: 4 }[p] || 5; }
function prioLabel(p) { return { T1: 'קריטי — URGENT', T2: 'דחוף — DELAYED', T3: 'קל — MINIMAL', T4: 'EXPECTANT' }[p] || p; }
function prioDot(p) { return { T1: 'red', T2: 'amber', T3: 'green', T4: '' }[p] || 'green'; }
function pClr(p) { return { T1: 'var(--red2)', T2: 'var(--orange2)', T3: 'var(--green2)', T4: '#333' }[p] || 'var(--olive)'; }
function nowTime() { const n = new Date(); return `${p2(n.getHours())}:${p2(n.getMinutes())}`; }
function nowTimeSec() { const n = new Date(); return `${p2(n.getHours())}:${p2(n.getMinutes())}:${p2(n.getSeconds())}`; }
let _tlSaveTimer = null;
function addTL(casId, name, what, color) { S.timeline.unshift({ casId, name, what, color, time: nowTimeSec() }); if (S.timeline.length > MEDICAL.MAX_TIMELINE_EVENTS) S.timeline.length = MEDICAL.MAX_TIMELINE_EVENTS; clearTimeout(_tlSaveTimer); _tlSaveTimer = setTimeout(saveState, 2000); }
function showToast(msg, dur = 2400) {
  // Remove any existing toast
  document.querySelectorAll('.toast').forEach(t => { t.remove(); });
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.setAttribute('aria-live', 'polite');
  t.textContent = msg;
  document.body.appendChild(t);
  const dismiss = () => { t.classList.add('toast-exit'); t.addEventListener('animationend', () => t.remove(), { once: true }); };
  setTimeout(dismiss, dur);
  t.addEventListener('click', dismiss);
}
function vibrateAlert(msg) {
  if (navigator.vibrate) navigator.vibrate([600, 200, 600, 200, 600]);
  showToast('⚠ ' + msg, 3500);
}
// Haptic feedback helper
function haptic(style) {
  if (!navigator.vibrate) return;
  if (style === 'light') navigator.vibrate(10);
  else if (style === 'medium') navigator.vibrate(25);
  else if (style === 'heavy') navigator.vibrate([40, 30, 40]);
  else if (style === 'success') navigator.vibrate([10, 50, 10]);
  else if (style === 'error') navigator.vibrate([50, 30, 50, 30, 50]);
}
// כאשר בוחרים "אחר" ב-select — מציג שדה הערה חופשית
function showOtherNote(sel) {
  const noteId = sel.dataset.noteId;
  if (!noteId) return;
  const note = document.getElementById(noteId);
  if (!note) return;
  note.classList.toggle('show', sel.value === 'אחר');
  if (sel.value === 'אחר') setTimeout(() => note.focus(), 50);
}
// מחזיר את הערך הסופי מ-select: אם "אחר" — מחזיר את תוכן שדה ההערה
function getSelectVal(selId, noteId) {
  const sel = document.getElementById(selId);
  if (!sel) return '';
  if (sel.value === 'אחר') {
    const note = document.getElementById(noteId);
    return note ? note.value.trim() || 'אחר' : 'אחר';
  }
  return sel.value;
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      showToast('❌ לא ניתן להפעיל מסך מלא');
    });
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

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
// FIRE MODE
// ═══════════════════════════════════════════════════
function toggleFireMode() {
  S.fireMode = !S.fireMode;
  $('topbar-normal').style.display = S.fireMode ? 'none' : 'flex';
  $('topbar-fire').style.display = S.fireMode ? 'flex' : 'none';
  const nav = $('bottomnav');
  nav.className = S.fireMode ? 'fire-nav' : '';
  if (S.fireMode) {
    goScreen('sc-fire'); setNav(1);
    populateFireCasSelector();
  } else {
    goScreen('sc-war'); setNav(1);
  }
}

function populateFireCasSelector() {
  const btns = $('fire-cas-btns');
  const sel = $('fire-cas-selector');
  if (!btns || !sel) return;
  if (!S.casualties.length) { sel.style.display = 'none'; return; }
  sel.style.display = '';
  btns.textContent = '';
  btns.insertAdjacentHTML('afterbegin', S.casualties.map(c => `
    <button class="btn btn-lg btn-ghost btn-full" onclick="selectFireCas(${c.id})" style="justify-content:flex-start;gap:10px;border-color:${pClr(c.priority)}">
      <span class="prio pt${c.priority[1]}">${c.priority}</span> ${escHTML(c.name)}
      <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
    </button>`).join(''));
}
let selectedFireCasId = null;
function selectFireCas(id) {
  selectedFireCasId = id;
  const c = S.casualties.find(x => x.id == id);
  if (c) showToast('✓ נבחר: ' + c.name);
}

function getFireTarget() {
  if (selectedFireCasId) return S.casualties.find(c => c.id == selectedFireCasId);
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  return sorted[0] || null;
}

function fireTQ() {
  const c = getFireTarget();
  if (!c) { showToast('בחר פגוע תחילה'); return; }
  if (!c.tqStart) c.tqStart = Date.now();
  c.txList.push({ type: 'TQ', time: nowTime() });
  addTL(c.id, c.name, 'TQ הוחל — טיימר הופעל 🩹', 'red');
  saveState(); renderWarRoom(); if (typeof updateTopStats === 'function') updateTopStats();
  showToast(`✓ TQ — ${c.name}`);
  vibrateAlert('TQ הוחל! רשום זמן!');
}
function fireTXA() {
  const c = getFireTarget();
  if (!c) { showToast('בחר פגוע תחילה'); return; }
  if (checkAllergy(c.id, 'TXA')) return;
  c.txList.push({ type: 'TXA 1g', time: nowTime() });
  addTL(c.id, c.name, 'TXA 1g ניתן 💉', 'amber');
  saveState(); renderWarRoom(); if (typeof updateTopStats === 'function') updateTopStats();
  showToast(`✓ TXA — ${c.name}`);
}
function fireCasevac() {
  genReport();
  goScreen('sc-report');
  resetReportViewToTop();
  toggleFireMode();
}
function fireExpectant() {
  const c = getFireTarget();
  if (!c) { showToast('בחר פגוע תחילה'); return; }
  c.priority = 'T4';
  addTL(c.id, c.name, 'T4 EXPECTANT — המשך לבא ⬛', '');
  saveState(); renderWarRoom(); if (typeof updateTopStats === 'function') updateTopStats();
  showToast(`T4 EXPECTANT — ${c.name}`);
}

// ═══════════════════════════════════════════════════
// WAR ROOM INLINE FIRE PANEL
// ═══════════════════════════════════════════════════
let _wrFireOpen = false;
function toggleWrFirePanel() {
  _wrFireOpen = !_wrFireOpen;
  const panel = $('wr-fire-panel');
  if (!panel) return;
  panel.style.display = _wrFireOpen ? 'block' : 'none';
  const btn = $('wr-fire-btn');
  if (btn) btn.style.background = _wrFireOpen ? '#800' : 'var(--red2)';
  if (_wrFireOpen) updateWrFirePanel();
}
function updateWrFirePanel() {
  const pills = $('wr-fire-cas-pills');
  if (!pills) return;
  if (!S.casualties.length) {
    pills.innerHTML = '<div style="font-size:10px;color:var(--muted)">אין פגועים — לחץ ＋ פגוע</div>';
  } else {
    pills.innerHTML = S.casualties.map(c => {
      const sel = selectedFireCasId == c.id;
      return `<button class="btn btn-xs" onclick="selectFireCas(${c.id});updateWrFirePanel()" style="padding:2px 8px;font-size:10px;border-color:${pClr(c.priority)};${sel ? 'background:' + pClr(c.priority) + ';color:#fff' : 'color:var(--muted2)'}">
        <span style="font-weight:900">${c.priority}</span> ${escHTML(c.name)}
      </button>`;
    }).join('');
  }
  // Update next best action if available
  const nextEl = $('wr-fire-next');
  if (nextEl && typeof _nextAction !== 'undefined' && _nextAction) {
    nextEl.style.display = 'block';
    const txt = $('wr-fire-next-text');
    const ico = $('wr-fire-next-icon');
    if (txt) txt.textContent = _nextAction.text || '—';
    if (ico) ico.textContent = _nextAction.icon || '⚡';
  }
}

// ═══════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════
function openModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeModal() { 
  $('overlay').classList.remove('on'); 
  document.body.style.overflow = '';
}
function closeModalOutside(e) { 
  if (e.target === $('overlay')) {
    $('overlay').classList.remove('on');
    document.body.style.overflow = '';
  }
}
function forceClose() { $('overlay').classList.remove('on'); }

// ─── safe setter helper ───
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }

// ═══════════════════════════════════════════════════
// COMMS
// ═══════════════════════════════════════════════════
function saveComms() {
  const unit = $('p-unit'), mahup = $('p-mahup'), helo = $('p-helo'), lz1 = $('p-lz1'), lz2 = $('p-lz2');
  if (!unit) return; // Not on prep screen
  S.comms = { unit: unit.value, mahup: mahup ? mahup.value : '', helo: helo ? helo.value : '', lz1: lz1 ? lz1.value : '', lz2: lz2 ? lz2.value : '' };
  showToast('תדרים נשמרו ✓');
}

// ═══════════════════════════════════════════════════
// FORCE ROSTER
// ═══════════════════════════════════════════════════
// ── EQUIPMENT BY CATEGORY ──
const EQUIP_CATS = [
  {
    k: 'רפואה', label: '🏥 רפואה', items: [
      { k: 'TQ', label: 'חוסם עורק (TQ)' },
      { k: 'Chest Seal', label: 'Chest Seal / Hyfin' },
      { k: 'Bandage', label: 'תחבושת לחץ' },
      { k: 'Gauze', label: 'Gauze / QuikClot' },
      { k: 'NPA', label: 'NPA + לובריקנט' },
      { k: 'IV', label: 'IV kit + עירוי' },
      { k: 'TXA', label: 'TXA אמפולה' },
      { k: 'Morphine', label: 'מורפין / קטמין' },
      { k: 'NaCl', label: 'NaCl 500ml' },
      { k: 'Blanket', label: 'שמיכת הלם' },
      { k: 'Gloves', label: 'כפפות' },
      { k: 'SAM', label: 'SAM Splint / גבס' },
      { k: 'Defib', label: 'AED דפיברילטור' },
    ]
  },
  {
    k: 'נשק', label: '🔫 נשק ותחמושת', items: [
      { k: 'M16', label: 'M16 / M4' },
      { k: 'Negev', label: 'נגב (מקלע)' },
      { k: 'Tavor', label: 'טאבור' },
      { k: 'Galil', label: 'גליל ACE' },
      { k: 'Mag338', label: 'מגזין .338' },
      { k: 'Ammo', label: 'תחמושת × 6 מגזינים' },
      { k: 'Grenade', label: 'רימון יד' },
      { k: 'Smoke', label: 'רימון עשן' },
      { k: 'AT', label: 'RPG / לאו / מטול' },
      { k: 'Pistol', label: 'אקדח + מגזין' },
      { k: 'Knife', label: 'סכין / בלייד' },
    ]
  },
  {
    k: 'ציוד קרב', label: '⚙️ ציוד קרב', items: [
      { k: 'Vest', label: 'אפוד קרב / יוס' },
      { k: 'Helmet', label: 'קסדת קרב' },
      { k: 'NVG', label: 'ראיית לילה NVG' },
      { k: 'Radio', label: 'רדיו / קשר' },
      { k: 'GPS', label: 'GPS ידני' },
      { k: 'Rope', label: 'חבל / קרבינר' },
      { k: 'Torch', label: 'פנס טקטי' },
      { k: 'Binos', label: 'משקפת' },
      { k: 'Marker', label: 'IR Marker / לייזר' },
    ]
  },
  {
    k: 'לוגיסטיקה', label: '🎒 לוגיסטיקה', items: [
      { k: 'Water', label: 'מים 3 ליטר' },
      { k: 'Food', label: 'מנות שטח / נ.ש.' },
      { k: 'Battery', label: 'סוללות רזרב' },
      { k: 'Map', label: 'מפה + עפרון' },
      { k: 'Carabiner', label: 'קרבינר' },
      { k: 'Poncho', label: 'פונצ\'ו / שמיכה' },
      { k: 'Cuffs', label: 'אזיקונים' },
    ]
  },
];

// Flat list derived from EQUIP_CATS — used by force roster display
const EQUIP_LIST = EQUIP_CATS.flatMap(cat => cat.items.map(item => ({ ...item, cat: cat.k })));

// Role → default equipment presets
const ROLE_PRESETS = {
  'לוחם': ['TQ', 'Chest Seal', 'Bandage', 'Gauze', 'M16', 'Ammo', 'Grenade', 'Vest', 'Helmet', 'Water'],
  'חובש': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'Blanket', 'Gloves', 'SAM', 'M16', 'Vest', 'Helmet'],
  'מפקד': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Grenade', 'Radio', 'GPS', 'NVG', 'Vest', 'Helmet', 'Binos', 'Map'],
  'נהג': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Pistol', 'Radio', 'Water', 'Vest', 'Helmet'],
  'נגביסט': ['Negev', 'Ammo', 'Ammo', 'Ammo', 'Grenade', 'TQ', 'Chest Seal', 'Bandage', 'Vest', 'Helmet', 'Water'],
  'צלם': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Radio', 'Marker', 'Battery', 'Vest', 'Helmet'],
  'מ"מ': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Grenade', 'Radio', 'GPS', 'NVG', 'Binos', 'Map', 'Vest', 'Helmet'],
  'קמ"ן': ['TQ', 'Chest Seal', 'Bandage', 'Galil', 'Ammo', 'Grenade', 'Smoke', 'Radio', 'GPS', 'Binos', 'Vest', 'Helmet'],
  'טנקיסט': ['TQ', 'Chest Seal', 'Bandage', 'Pistol', 'Radio', 'Helmet', 'NVG', 'Water'],
  'חי"ר': ['TQ', 'Chest Seal', 'Bandage', 'Gauze', 'Tavor', 'Ammo', 'Grenade', 'Vest', 'Helmet', 'Water'],
  'הנדסה קרבית': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'AT', 'Rope', 'Carabiner', 'Vest', 'Helmet'],
  'רופא': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'Blanket', 'Gloves', 'SAM', 'M16', 'Vest', 'Helmet', 'Radio', 'GPS'],
  'לוחם רפואה': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'M16', 'Vest', 'Helmet'],
  'מפקד חוליה רפואית': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'Radio', 'GPS', 'Vest', 'Helmet'],
  'פאראמדיק': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'Blanket', 'Gloves', 'SAM', 'Radio', 'GPS', 'Vest', 'Helmet'],
};

function openAddForce() {
  _equipSel = new Set();
  const roleOpts = Object.keys(ROLE_PRESETS).map(r => `<option value="${r}">${r}</option>`).join('');
  openModal('הוסף לוחם לכוח', `
    <div class="pad col">
      <input class="inp" id="f-name" placeholder="שם מלא">
      <div class="row"><input class="inp" id="f-id" placeholder="מ.א." style="flex:1"><input class="inp" id="f-kg" placeholder='ק"ג' type="number" style="width:80px"></div>
      <div class="row"><input class="inp" id="f-iron" placeholder="🔢 מספר ברזל" style="flex:1"><input class="inp" id="f-iron-pair" placeholder="👥 צמד ברזל" style="flex:1"></div>
      <select class="inp" id="f-blood"><option value="">סוג דם</option>${ALL_BT.map(b => `<option>${b}</option>`).join('')}</select>
      <select class="inp" id="f-allergy" data-note-id="f-allergy-note" onchange="showOtherNote(this)">
        <option value="">אלרגיות — ללא</option>
        <option value="פניצילין">פניצילין (PENC)</option>
        <option value="NSAIDs">NSAIDs</option>
        <option value="קטמין">קטמין</option>
        <option value="מורפין">מורפין</option>
        <option value="סולפה">סולפה</option>
        <option value="אחר">אחר — הזן הערה</option>
      </select>
      <textarea class="other-note" id="f-allergy-note" rows="2" placeholder="פרט אלרגיה..."></textarea>
      
      <div style="display:flex;gap:6px">
        <input class="inp" id="f-meds" placeholder="💊 תרופות קבועות" style="flex:1">
        <input class="inp" id="f-vaccines" placeholder="💉 חיסונים" style="flex:1">
      </div>

      <div style="font-size:10px;color:var(--olive3);font-weight:700;letter-spacing:.06em">תפקיד / פקל</div>
      <select class="inp" id="f-role" onchange="applyRolePreset(this.value)">
        <option value="">— בחר תפקיד —</option>
        ${roleOpts}
        <option value="אחר">אחר</option>
      </select>
      <input class="inp" id="f-role-custom" placeholder="תפקיד מותאם..." style="display:none;font-size:12px">

      <div style="font-size:10px;color:var(--olive3);font-weight:700;letter-spacing:.06em;margin-top:4px">🎒 ציוד — לחץ לסימון</div>
      ${EQUIP_CATS.map(cat => `
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted2);padding:5px 0 3px;border-bottom:1px solid var(--b0);margin-bottom:4px">${cat.label}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px" id="equip-cat-${cat.k}">
            ${cat.items.map(e => `
              <div class="eq-row" data-ek="${e.k}" onclick="togEquipRow(this,'${e.k}')"
                style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:var(--s3);border:1px solid var(--b0);border-radius:4px;cursor:pointer;transition:all .1s">
                <div class="eq-cb" style="width:18px;height:18px;border-radius:3px;border:2px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0"></div>
                <div style="font-size:11px;line-height:1.2">${e.label}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      <input class="inp" id="f-equip-custom" placeholder="ציוד נוסף — חופשי" style="font-size:12px">
      <button class="btn btn-lg btn-olive btn-full" onclick="saveForce()">הוסף לכוח ✓</button>
    </div>`);
}

function applyRolePreset(role) {
  // show/hide custom field
  const cust = $('f-role-custom');
  if (cust) cust.style.display = role === 'אחר' ? '' : 'none';
  // clear all
  _equipSel.clear();
  document.querySelectorAll('.eq-row').forEach(r => {
    r.style.borderColor = 'var(--b0)'; r.style.background = 'var(--s3)';
    const cb = r.querySelector('.eq-cb');
    cb.textContent = ''; cb.style.background = ''; cb.style.borderColor = 'var(--b1)';
  });
  // apply preset
  const preset = ROLE_PRESETS[role] || [];
  preset.forEach(k => {
    const row = document.querySelector(`.eq-row[data-ek="${k}"]`);
    if (row && !_equipSel.has(k)) togEquipRow(row, k);
  });
}

let _equipSel = new Set();
function togEquipRow(row, key) {
  if (_equipSel.has(key)) {
    _equipSel.delete(key);
    row.style.borderColor = 'var(--b0)'; row.style.background = 'var(--s3)';
    const cb = row.querySelector('.eq-cb');
    cb.textContent = ''; cb.style.background = ''; cb.style.borderColor = 'var(--b1)';
  } else {
    _equipSel.add(key);
    row.style.borderColor = 'var(--olive3)'; row.style.background = 'var(--b0)';
    const cb = row.querySelector('.eq-cb');
    cb.textContent = '✓'; cb.style.background = 'var(--green2)'; cb.style.borderColor = 'var(--green3)';
  }
}

// keep old togEquip as alias
function togEquip(row, key) { togEquipRow(row, key); }

function addForceMember(member) {
  S.force.push(member);
  saveState();
}

function saveForce() {
  const name = $('f-name').value.trim();
  if (!name) { alert('חסר שם'); return; }
  let role = $('f-role').value;
  if (role === 'אחר') role = ($('f-role-custom')?.value.trim()) || 'אחר';
  const equip = [..._equipSel];
  const custom = ($('f-equip-custom')?.value || '').trim();
  if (custom) equip.push(custom);
  _equipSel = new Set();
  addForceMember({
    id: Date.now(), name, idNum: $('f-id').value, kg: parseFloat($('f-kg').value) || 70,
    blood: $('f-blood').value,
    ironNum: ($('f-iron')?.value || '').trim(),
    ironPair: ($('f-iron-pair')?.value || '').trim(),
    allergy: getSelectVal('f-allergy', 'f-allergy-note'),
    meds: ($('f-meds')?.value || '').trim(),
    vaccines: ($('f-vaccines')?.value || '').trim(),
    role, equip
  });
  renderForceList(); renderCompatTable(); forceClose();
}

function renderForceList() {
  $('force-count').textContent = S.force.length + ' לוחמים';
  // Sort
  let list = [...S.force];
  if (_forceSort === 'role') list.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
  else if (_forceSort === 'blood') list.sort((a, b) => (a.blood || '').localeCompare(b.blood || ''));
  else list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  // Filter
  if (_forceFilterRole) list = list.filter(f => f.role === _forceFilterRole);

  if (_forceViewMode === 'table') {
    $('force-list').innerHTML = `<table style="width:100%;font-size:11px;border-collapse:collapse">
      <thead><tr style="background:var(--s3);font-size:9px;color:var(--muted2)"><th style="padding:4px">Name</th><th>Role</th><th>Blood</th><th>Kg</th><th></th></tr></thead>
      <tbody>${list.map(f => `<tr style="border-bottom:1px solid var(--b0)">
        <td style="padding:4px;font-weight:700">${escHTML(f.name)}</td><td style="color:var(--muted)">${f.role || ''}</td>
        <td><span class="tag tag-blood">${escHTML(f.blood || '?')}</span></td><td>${f.kg}</td>
        <td style="white-space:nowrap"><button class="btn btn-xs btn-ghost" onclick="editForce(${f.id})" style="font-size:9px;min-height:18px;padding:0 4px">✏️</button><button class="btn btn-xs btn-ghost" onclick="removeForce(${f.id})" style="color:var(--red3);font-size:9px;min-height:18px;padding:0 4px">✕</button></td>
      </tr>`).join('')}</tbody></table>`;
  } else {
    $('force-list').innerHTML = list.map(f => `
    <div onclick="openForceDetail(${f.id})" style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;cursor:pointer">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--olive);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${initials(f.name)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${escHTML(f.name)} <span style="font-size:10px;color:var(--muted)">${f.role || ''}</span></div>
          <div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">
            <span class="tag tag-blood">${escHTML(f.blood || '?')}</span>
            ${f.allergy ? `<span class="tag tag-allergy">⚠ ${escHTML(f.allergy)}</span>` : ''}
            <span class="tag tag-kg">${f.kg}kg</span>
            ${f.ironNum ? `<span style="font-size:9px;padding:2px 6px;background:var(--s1);border:1px solid var(--amber);border-radius:3px;color:var(--amber3)">🔢 ${escHTML(f.ironNum)}</span>` : ''}
            ${f.ironPair ? `<span style="font-size:9px;padding:2px 6px;background:var(--s1);border:1px solid var(--blue2);border-radius:3px;color:var(--olive3)">👥 ${escHTML(f.ironPair)}</span>` : ''}
          </div>
        </div>
        <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();editForce(${f.id})" style="padding:0 6px;min-height:22px;border-color:var(--olive3);color:var(--olive3);font-size:10px">✏️</button>
        <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();removeForce(${f.id})" style="padding:0 6px;min-height:22px;border-color:var(--red2);color:var(--red3);font-size:10px">✕</button>
        <button class="btn btn-xs btn-red" onclick="activateCasFromForce(${f.id})">פצוע ▶</button>
      </div>
      ${f.equip && f.equip.length ? `
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;padding-top:6px;border-top:1px solid var(--b0)">
          <span style="font-size:9px;color:var(--muted);align-self:center;margin-left:2px">🎒</span>
          ${f.equip.map(k => { const e = EQUIP_LIST.find(x => x.k === k); return `<span style="font-size:9px;padding:2px 6px;background:var(--s3);border:1px solid var(--b1);border-radius:3px;color:var(--muted2)">${e ? e.label : k}</span>`; }).join('')}
        </div>`: ''}
    </div>`).join('');
  }
  // Also update prep enhancements
  if (typeof updateEvacOrder === 'function') updateEvacOrder();
  renderLeadership();
  if (typeof updateReadiness === 'function') updateReadiness();
  if (typeof updateEquipSummary === 'function') updateEquipSummary();
}
function openAssignLeader() {
  if (!S.force.length) { showToast('⚠️ הוסף לוחמים תחילה'); return; }
  const roles = ['מפקד כוח', 'סגן מפקד', 'קצין רפואה', 'חובש בכיר', 'אחראי קשר'];
  openModal('🎖️ הגדר בעל תפקיד', `
    <div class="pad col" style="gap:12px">
      <label class="card-lbl">בחר תפקיד</label>
      <select class="inp" id="l-role">
        ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
      </select>
      <label class="card-lbl">בחר לוחם</label>
      <select class="inp" id="l-fid">
        ${S.force.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
      </select>
      <button class="btn btn-lg btn-olive btn-full" onclick="saveLeader()">שמור</button>
    </div>
  `);
}

function saveLeader() {
  const role = $('l-role').value;
  const fid = $('l-fid').value;
  if (!S.leadership) S.leadership = {};
  S.leadership[role] = fid;
  saveState(); closeModal(); renderLeadership();
}

function renderLeadership() {
  const el = $('leadership-list'); if (!el) return;
  const l = S.leadership || {};
  const entries = Object.entries(l);
  el.innerHTML = entries.map(([role, fid]) => {
    const f = S.force.find(x => x.id == fid);
    if (!f) return '';
    return `<div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:10px">
      <div style="font-size:11px;font-weight:700;flex:1">${role}: <span style="color:var(--olive3)">${f.name}</span></div>
      <button class="btn btn-xs btn-ghost" onclick="deleteLeader('${role}')" style="color:var(--red3);border:none">✕</button>
    </div>`;
  }).join('');
}

function deleteLeader(role) { delete S.leadership[role]; saveState(); renderLeadership(); }
if (typeof window !== 'undefined') {
  window.openForceDetail = openForceDetail;
  window.openAssignLeader = openAssignLeader;
  window.deleteLeader = deleteLeader;
  window.saveLeader = saveLeader;
}

function activateCasFromForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  openAddCas(f);
}

function openForceDetail(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;

  const equipList = (f.equip || []).map(k => {
    const e = EQUIP_LIST.find(x => x.k === k);
    return `<div style="font-size:12px;padding:4px 8px;background:var(--s3);border:1px solid var(--b1);border-radius:4px">${e ? e.label : k}</div>`;
  }).join('');

  openModal(`כרטיס לוחם: ${f.name}`, `
    <div class="pad col" style="gap:16px">
      <div class="row" style="align-items:center;gap:12px">
        <div style="width:50px;height:50px;border-radius:50%;background:var(--olive);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px">${initials(f.name)}</div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:900">${f.name}</div>
          <div style="font-size:13px;color:var(--olive3);font-weight:600">${f.role || 'ללא תפקיד'}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="card-sm">
          <div class="card-lbl">מ.א.</div>
          <div class="card-val">${f.idNum || '—'}</div>
        </div>
        <div class="card-sm">
          <div class="card-lbl">משקל</div>
          <div class="card-val">${f.kg}kg</div>
        </div>
        <div class="card-sm">
          <div class="card-lbl">דגם ברזל</div>
          <div class="card-val">${f.ironNum || '—'}</div>
        </div>
        <div class="card-sm">
          <div class="card-lbl">צמד ברזל</div>
          <div class="card-val">${f.ironPair || '—'}</div>
        </div>
      </div>

      <div class="sec" style="margin:0;padding:4px 0;border-bottom:1px solid var(--b0)">מידע רפואי</div>
      <div class="col" style="gap:8px">
        <div class="row" style="justify-content:space-between">
          <span style="font-size:12px;color:var(--muted)">סוג דם:</span>
          <span class="tag tag-blood">${f.blood || '?'}</span>
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <span style="font-size:12px;color:var(--muted)">אלרגיות:</span>
          <span style="font-size:12px;font-weight:700;color:${f.allergy ? 'var(--red3)' : 'var(--green3)'}">${f.allergy || 'ללא'}</span>
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <span style="font-size:12px;color:var(--muted)">תרופות:</span>
          <span style="font-size:12px;font-weight:700">${f.meds || 'ללא'}</span>
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <span style="font-size:12px;color:var(--muted)">חיסונים:</span>
          <span style="font-size:12px;font-weight:700">${f.vaccines || 'ללא'}</span>
        </div>
      </div>

      <div class="sec" style="margin:0;padding:4px 0;border-bottom:1px solid var(--b0)">ציוד אישי</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${equipList || '<div style="font-size:12px;color:var(--muted)">אין ציוד רשום</div>'}
      </div>

      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-lg btn-ghost" style="flex:1" onclick="closeModal();editForce(${f.id})">ערוך פרטים ✏️</button>
        <button class="btn btn-lg btn-red" style="flex:1" onclick="closeModal();activateCasFromForce(${f.id})">הפוך לפצוע ▶</button>
      </div>
    </div>
  `);
}

function removeForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  if (!confirm(`הסר את ${f.name} מהכוח?`)) return;
  S.force = S.force.filter(x => x.id !== fid);
  renderForceList(); renderCompatTable(); saveState();
  showToast(`✓ ${f.name} הוסר מהכוח`);
}

function clearAllForce() {
  if (!S.force.length) { showToast('הכוח ריק'); return; }
  if (!confirm(`מחק את כל ${S.force.length} הלוחמים מהכוח?\nלא ניתן לבטל.`)) return;
  S.force = [];
  renderForceList(); renderCompatTable(); saveState();
  showToast('✓ כל הכוח נמחק');
}

// ═══════════════════════════════════════════════════
// COMPAT TABLE
// ═══════════════════════════════════════════════════
function renderCompatTable() {
  if (!$('compat-table')) return;
  let h = `<table class="compat-matrix"><tr><th></th>${ALL_BT.map(b => `<th>${b}</th>`).join('')}</tr>`;
  ALL_BT.forEach(donor => {
    const cg = BLOOD_COMPAT[donor] || [];
    h += `<tr><td style="font-weight:700;color:var(--amber2)">${donor}</td>`;
    ALL_BT.forEach(r => {
      h += donor === r ? `<td class="compat-self">●</td>` : cg.includes(r) ? `<td class="compat-yes">✓</td>` : `<td class="compat-no">–</td>`;
    });
    h += '</tr>';
  });
  $('compat-table').innerHTML = h;
}
renderCompatTable();
// Set initial nav state
setTimeout(updateNavMode, 100);
// Restore persisted state
if (typeof window !== 'undefined') {
  window.openForceDetail = openForceDetail;
  window.openAssignLeader = openAssignLeader;
  window.deleteLeader = deleteLeader;
  window.saveLeader = saveLeader;
  window.renderLeadership = renderLeadership;
  window.editForce = editForce;
  window.removeForce = removeForce;
  window.clearAllForce = clearAllForce;
}
setTimeout(loadState, 200);
// ═══════════════════════════════════════════════════
// OPERATIONS MANAGEMENT — Command & Control
// ═══════════════════════════════════════════════════

function getDefaultOperation() {
  if (!S.operations) S.operations = [];
  return S.operations.find(o => o.id === 'op-default');
}

function ensureDefaultOperation() {
  if (!S.operations) S.operations = [];
  let def = getDefaultOperation();
  if (!def) {
    def = {
      id: 'op-default',
      name: 'מבצע ראשי (ברירת מחדל)',
      location: 'בסיס ראשי',
      date: new Date().toLocaleDateString('he-IL'),
      status: 'active',
      parent: null,
      cachedStats: { casualties: 0, t1: 0, evacuated: 0 },
      incidents: [],
      state: {
        force: [],
        casualties: [],
        timeline: [],
        comms: {},
        supplies: Object.assign({}, S.supplies || {}),
        missionStart: null,
        missionActive: false,
        leadership: {},
        commsLog: [],
        lzStatus: {},
        medicAssignment: {},
        evacEta: null,
        readinessChecks: {},
        prefs: Object.assign({}, S.prefs || {})
      }
    };
    S.operations.unshift(def);
  }
  if (!S.currentOperationId) {
    S.currentOperationId = def.id;
  }
  return def;
}

function cloneOperationState(src) {
  if (!src) return null;
  return {
    force: JSON.parse(JSON.stringify(src.force || [])),
    casualties: JSON.parse(JSON.stringify(src.casualties || [])),
    timeline: JSON.parse(JSON.stringify(src.timeline || [])),
    comms: JSON.parse(JSON.stringify(src.comms || {})),
    supplies: JSON.parse(JSON.stringify(src.supplies || {})),
    missionStart: src.missionStart || null,
    missionActive: !!src.missionActive,
    leadership: JSON.parse(JSON.stringify(src.leadership || {})),
    commsLog: JSON.parse(JSON.stringify(src.commsLog || [])),
    lzStatus: JSON.parse(JSON.stringify(src.lzStatus || {})),
    medicAssignment: JSON.parse(JSON.stringify(src.medicAssignment || {})),
    evacEta: src.evacEta || null,
    readinessChecks: JSON.parse(JSON.stringify(src.readinessChecks || {})),
    prefs: JSON.parse(JSON.stringify(src.prefs || {}))
  };
}

function commitCurrentOperation() {
  if (!S.currentOperationId || !S.operations) return;
  const current = S.operations.find(o => o.id === S.currentOperationId);
  if (!current) return;
  current.state = cloneOperationState({
    force: S.force,
    casualties: S.casualties,
    timeline: S.timeline,
    comms: S.comms,
    supplies: S.supplies,
    missionStart: S.missionStart,
    missionActive: S.missionActive,
    leadership: S.leadership,
    commsLog: S.commsLog,
    lzStatus: S.lzStatus,
    medicAssignment: S.medicAssignment,
    evacEta: S.evacEta,
    readinessChecks: S.readinessChecks,
    prefs: S.prefs
  });
  aggregateDefaultOperation();
}

function applyOperationToState(op) {
  if (!op || !op.state) return;
  S.force = JSON.parse(JSON.stringify(op.state.force || []));
  S.casualties = JSON.parse(JSON.stringify(op.state.casualties || []));
  S.timeline = JSON.parse(JSON.stringify(op.state.timeline || []));
  S.comms = JSON.parse(JSON.stringify(op.state.comms || {}));
  S.supplies = JSON.parse(JSON.stringify(op.state.supplies || (S.supplies || {})));
  S.missionStart = op.state.missionStart || null;
  S.missionActive = !!op.state.missionActive;
  S.leadership = JSON.parse(JSON.stringify(op.state.leadership || {}));
  S.commsLog = JSON.parse(JSON.stringify(op.state.commsLog || []));
  S.lzStatus = JSON.parse(JSON.stringify(op.state.lzStatus || {}));
  S.medicAssignment = JSON.parse(JSON.stringify(op.state.medicAssignment || []));
  S.evacEta = op.state.evacEta || null;
  S.readinessChecks = JSON.parse(JSON.stringify(op.state.readinessChecks || {}));
  S.prefs = JSON.parse(JSON.stringify(op.state.prefs || S.prefs || {}));
}

function aggregateDefaultOperation() {
  const def = getDefaultOperation();
  if (!def) return;

  const mergedForce = [];
  const mergedCasualties = [];
  const forceIds = new Set();
  const casIds = new Set();

  for (const op of S.operations) {
    if (!op || !op.state || op.id === def.id) continue;
    for (const f of op.state.force || []) {
      if (f && f.id != null && !forceIds.has(f.id)) {
        forceIds.add(f.id);
        mergedForce.push(JSON.parse(JSON.stringify(f)));
      }
    }
    for (const c of op.state.casualties || []) {
      if (c && c.id != null && !casIds.has(c.id)) {
        casIds.add(c.id);
        mergedCasualties.push(JSON.parse(JSON.stringify(c)));
      }
    }
  }

  def.state.force = mergedForce;
  def.state.casualties = mergedCasualties;
}

function openOperationsList() {
  try {
    ensureDefaultOperation();
    const ops = S.operations || [];
    const activeOpId = S.currentOperationId;

    const opHtml = ops.map(o => {
      const isActive = o.id === activeOpId;
      const statusClr = o.status === 'archived' ? 'var(--muted)' : isActive ? 'var(--green2)' : 'var(--amber)';
      const statusIcon = isActive ? '📡' : o.status === 'archived' ? '📦' : '📂';
      
      // Calc stats for the card
      const casCount = o.cachedStats?.casualties || 0;
      const t1Count = o.cachedStats?.t1 || 0;
      const evacCount = o.cachedStats?.evacuated || 0;
      const progress = casCount > 0 ? Math.round((evacCount / casCount) * 100) : 0;

      return `
        <div class="card op-card ${isActive ? 'op-active' : ''}" style="margin:0 0 16px; border-left: 5px solid ${statusClr}; position:relative; overflow:visible; background:${isActive ? 'linear-gradient(135deg, rgba(26,42,26,0.9), rgba(10,10,10,0.95))' : 'rgba(255,255,255,0.02)'}; backdrop-filter:blur(10px); border-radius:18px; box-shadow:${isActive ? '0 10px 40px rgba(40,130,40,0.25)' : 'none'}">
          ${isActive ? '<div class="op-pulse-tag">📡 LIVE SECURE LINK</div>' : ''}
          <div class="pad col" style="gap:12px">
            <div style="display:flex; justify-content:space-between; align-items:flex-start">
              <div style="flex:1">
                <div style="font-size:18px; font-weight:900; color:var(--white); margin-bottom:4px; letter-spacing:0.5px">${escHTML(o.name)}</div>
                <div style="font-size:11px; color:var(--muted2); font-family:var(--font-mono); opacity:0.8">📍 ${o.location || 'מרחב משימה'} • ${o.date}</div>
              </div>
              <div style="font-size:24px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">${statusIcon}</div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; background:rgba(255,255,255,0.04); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.05)">
              <div class="col" style="gap:4px; align-items:center">
                <div style="font-size:18px; font-weight:900; color:var(--white)">${casCount}</div>
                <div style="font-size:9px; color:var(--muted); font-weight:700; text-transform:uppercase">פגועים</div>
              </div>
              <div class="col" style="gap:4px; align-items:center">
                <div style="font-size:18px; font-weight:900; color:var(--red3); text-shadow:0 0 10px rgba(230,40,40,0.3)">${t1Count}</div>
                <div style="font-size:9px; color:var(--muted); font-weight:700; text-transform:uppercase">T1</div>
              </div>
              <div class="col" style="gap:4px; align-items:center">
                <div style="font-size:18px; font-weight:900; color:var(--green3)">${evacCount}</div>
                <div style="font-size:9px; color:var(--muted); font-weight:700; text-transform:uppercase">פונו</div>
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:10px">
              <div style="flex:1; height:6px; background:rgba(0,0,0,0.3); border-radius:3px; overflow:hidden; border:1px solid rgba(255,255,255,0.05)">
                <div style="width:${progress}%; height:100%; background:linear-gradient(90deg, ${statusClr}, #fff); box-shadow:0 0 10px ${statusClr}"></div>
              </div>
              <div style="font-size:11px; color:var(--white); font-weight:900; font-family:var(--font-mono)">${progress}%</div>
            </div>

            <div style="display:flex; gap:8px; margin-top:6px">
              ${isActive 
                ? `<button class="btn btn-sm btn-ghost btn-full" style="background:rgba(40,130,40,0.1); border-color:var(--green2); color:var(--green2); font-weight:900">מחובר ליחידה</button>` 
                : `<button class="btn btn-sm btn-olive btn-full" onclick="loadOperation('${o.id}')" style="box-shadow:0 4px 12px rgba(0,0,0,0.3)">הפעל זירה</button>`
              }
              <button class="btn btn-sm btn-ghost" onclick="archiveOperation('${o.id}')" style="border-radius:10px">📦</button>
              <button class="btn btn-sm btn-ghost" onclick="deleteOperation('${o.id}')" style="color:var(--red2); border-radius:10px">🗑</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    openModal('🌍 פיקוד מבצעים 2.0', `
      <div class="pad col" style="gap:16px; max-height:80vh; overflow-y:auto">
        <div style="background:var(--s3); padding:12px; border-radius:10px; border:1px solid var(--b2); display:flex; align-items:center; gap:12px">
          <div style="width:40px; height:40px; background:var(--green); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px">🛰</div>
          <div style="flex:1">
            <div style="font-size:13px; font-weight:900">מרכז ניהול זירות</div>
            <div style="font-size:10px; color:var(--muted2)">מבצע מרמז את כל אירועי האר"ן תחת קורת גג אחת</div>
          </div>
        </div>

        <div class="col" style="gap:4px">
          <div style="font-size:10px; font-weight:700; color:var(--olive3); margin-bottom:8px; letter-spacing:0.1em">מבצעים קיימים</div>
          ${opHtml || '<div style="background:var(--s2); padding:30px; border-radius:10px; text-align:center; border:1px dashed var(--b1); color:var(--muted)">אין מבצעים ברשימה. צור מבצע חדש כדי להתחיל.</div>'}
        </div>

        <div style="position:sticky; bottom:0; background:var(--bg); padding-top:12px; border-top:1px solid var(--b0)">
          <button class="btn btn-lg btn-amber btn-full" onclick="createNewOperation()" style="box-shadow:var(--shadow-glow-red)">
            <span style="font-size:20px">＋</span> מבצע חדש (זירה חדשה)
          </button>
          <div style="height:8px"></div>
          <button class="btn btn-md btn-ghost btn-full" onclick="closeModal()">סגור תפריט</button>
        </div>
      </div>
      <style>
        .op-card { transition: transform 0.2s, box-shadow 0.2s; cursor: default !important; }
        .op-active { background: linear-gradient(135deg, var(--s2), var(--s3)); border-color: var(--green2); box-shadow: var(--shadow-glow-olive); }
        .op-pulse-tag { position:absolute; top: -8px; right: 12px; background: var(--green2); color: var(--white); font-size: 8px; font-weight: 900; padding: 2px 6px; border-radius: 4px; animation: op-pulse 1.5s infinite; }
        @keyframes op-pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
      </style>
    `);
  } catch (e) {
    console.error(e);
    showToast('❌ שגיאה בטעינת מערך המבצעים');
  }
}

function _saveNewOperationForm() {
  const nameEl = $('new-op-name');
  const locationEl = $('new-op-location');
  if (!nameEl || !nameEl.value.trim()) {
    showToast('⚠️ יש להזין שם מבצע');
    if (nameEl) nameEl.focus();
    return;
  }

  const name = nameEl.value.trim();
  const location = (locationEl && locationEl.value.trim()) ? locationEl.value.trim() : 'לא הוגדר';

  ensureDefaultOperation();
  commitCurrentOperation();

  const newOpState = cloneOperationState({
    force: [], casualties: [], timeline: [], comms: {}, supplies: S.supplies || {}, missionStart: null,
    missionActive: false, leadership: {}, commsLog: [], lzStatus: {}, medicAssignment: {}, evacEta: null,
    readinessChecks: {}, prefs: S.prefs || {}
  });

  const newOp = {
    id: 'op-' + Date.now(),
    name,
    location,
    date: new Date().toLocaleDateString('he-IL'),
    status: 'active',
    parent: getDefaultOperation()?.id || null,
    cachedStats: { casualties: 0, t1: 0, evacuated: 0 },
    incidents: [],
    state: newOpState
  };

  S.operations.push(newOp);
  S.currentOperationId = newOp.id;
  applyOperationToState(newOp);
  aggregateDefaultOperation();
  saveState();
  closeModal();
  showToast(`🚀 מבצע "${name}" נוצר והופעל`);
  openOperationsList();
}

function createNewOperation() {
  ensureDefaultOperation();
  openModal('📌 יצירת מבצע חדש', `
    <div class="pad col" style="gap:10px">
      <label style="font-weight:700">שם המבצע</label>
      <input class="inp" id="new-op-name" placeholder="לדוגמה: סופה במדבר" />
      <label style="font-weight:700">מיקום / גזרה (אופציונלי)</label>
      <input class="inp" id="new-op-location" placeholder="לדוגמה: דרום רמת הגולן" />
      <div style="display:flex; gap:8px; margin-top:12px">
        <button class="btn btn-lg btn-olive btn-full" onclick="_saveNewOperationForm()">צור מבצע ושמור</button>
        <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()">ביטול</button>
      </div>
    </div>
  `);
  setTimeout(() => { const n = $('new-op-name'); if (n) n.focus(); }, 10);
}

function loadOperation(id) {
  const op = S.operations.find(o => o.id === id);
  if (!op) return;
  commitCurrentOperation();
  S.currentOperationId = id;
  applyOperationToState(op);
  aggregateDefaultOperation();
  saveState();
  showToast(`📡 מחובר למבצע: ${op.name}`);
  openOperationsList();
}

function archiveOperation(id) {
  const op = S.operations.find(o => o.id === id);
  if (!op) return;
  op.status = 'archived';
  saveState();
  openOperationsList();
}

function deleteOperation(id) {
  if (id === 'op-default') {
    showToast('❌ לא ניתן למחוק את המבצע הדיפולטי');
    return;
  }
  if (!confirm('האם למחוק את המבצע לצמיתות?')) return;
  S.operations = S.operations.filter(o => o.id !== id);
  if (S.currentOperationId === id) S.currentOperationId = 'op-default';
  saveState();
  openOperationsList();
}

function updateOperationStats() {
  if (!S.currentOperationId || !S.operations) return;
  const op = S.operations.find(o => o.id === S.currentOperationId);
  if (!op) return;

  // Calculate stats from current casualties
  const currentCas = S.casualties || [];
  op.cachedStats = {
    casualties: currentCas.length,
    t1: currentCas.filter(c => c.priority === 'T1').length,
    evacuated: currentCas.filter(c => c.evacType && c.evacType !== '').length
  };
}

if (typeof window !== 'undefined') {
  window.openOperationsList = openOperationsList;
  window.createNewOperation = createNewOperation;
  window.loadOperation = loadOperation;
  window.archiveOperation = archiveOperation;
  window.deleteOperation = deleteOperation;
  window.updateOperationStats = updateOperationStats;
  window.startMission = startMission;
}

function startMission() {
  // ── Validation — collect warnings, show as modal, always allow to proceed ──
  const warnings = [];
  const hasMedic = S.force.some(f => ['חובש', 'רופא', 'פראמדיק', 'מח"ר', 'לורם'].includes(f.role));
  if (!hasMedic) warnings.push('⚕️ אין גורם רפואי בכוח');
  const hasFreq = S.comms.mahup || S.comms.helo;
  if (!hasFreq) warnings.push('📻 אין תדר קשר / הלי');
  const hasTQ = S.force.some(f => f.equip && Array.isArray(f.equip) && f.equip.some(e => e && e.toString().includes('TQ')));
  if (!hasTQ) warnings.push('🩹 לא הוגדר TQ בציוד הכוח');

  if (warnings.length) {
    // Show a warning modal, but user can still proceed
    openModal('⚠️ הערות לפני האר"ן', `
      <div class="pad col" style="gap:10px">
        ${warnings.map(w => `<div style="background:rgba(200,40,40,.12);border:1px solid var(--red2);border-radius:6px;padding:10px 12px;font-size:13px;font-weight:600;color:var(--red3)">${w}</div>`).join('')}
        <div style="font-size:11px;color:var(--muted2);margin-top:4px">ניתן להמשיך בכל זאת — ודא שהכוח מוכן לפני יציאה לשטח.</div>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()">חזור להכנה</button>
          <button class="btn btn-lg btn-red btn-full" onclick="closeModal();_doStartMission()">⚡ התחל בכל זאת</button>
        </div>
      </div>`);
    return;
  }
  _doStartMission();
}

function _doStartMission() {
  APP_MODE = 'operational';
  updateNavMode();
  saveComms();
  S.missionStart = Date.now();
  S.missionActive = true;
  const tbSub = $('tb-sub'); if (tbSub) tbSub.textContent = `אר"ן פעיל — ${nowTime()}`;
  const ph = $('tb-phase'); if (ph) { ph.textContent = 'ACTIVE'; ph.className = 'tb-phase ph-active'; }
  { const _ghc = $('gh-chip'); if (_ghc) _ghc.style.display = ''; }
  const fireToggleBtn = $('fire-toggle-btn'); if (fireToggleBtn) fireToggleBtn.style.display = '';
  const mceBtn = $('mce-activate-btn'); if (mceBtn) mceBtn.style.display = 'none';
  const _nf2 = $('nav-fire'); if (_nf2) _nf2.style.display = 'flex';
  { const vb = $('voice-btn'); if (vb) vb.style.display = ''; }
  const fab = $('wr-fab'); if (fab) fab.classList.add('active');
  const drawer = $('cas-drawer');
  if (drawer && !drawer._swipeListenersAttached) {
    drawer._swipeListenersAttached = true;
    let _sy = 0;
    drawer.addEventListener('touchstart', e => { _sy = e.touches[0].clientY; }, { passive: true });
    drawer.addEventListener('touchend', e => { if (e.changedTouches[0].clientY - _sy > 90) closeDrawer(); });
  }
  startGoldenHour();
  startReassessReminders();
  initVoice();
  toggleRecording(true);
  addTL('sys', 'SYSTEM', 'אר"ן הופעל ⚡', 'green');
  goScreen('sc-war'); setNav(1);
  showToast('אר"ן הופעל! ⚡');
  setTimeout(computeNAE, 3000);
  renderIncidentBar();
  startSAPulse();
  updateSitHeader();
  saveState();
}

// ═══════════════════════════════════════════════════
// END MISSION + NEW STATE
// ═══════════════════════════════════════════════════
function endMission() {
  if (!S.missionActive) { showToast('אין אר"ן פעיל'); return; }
  const casCnt = S.casualties.length;
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const elapsed = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;
  openModal('🏁 סיום אר"ן', `
    <div class="pad col" style="gap:10px">
      <div style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:12px;text-align:center">
        <div style="font-size:11px;color:var(--muted2);margin-bottom:4px">סיכום אירוע</div>
        <div style="font-size:24px;font-weight:900;color:var(--olive3)">${casCnt} פגועים</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">${t1} T1 | ${elapsed} דקות</div>
      </div>
      <div style="font-size:11px;color:var(--muted2)">מה תרצה לעשות?</div>
      <button class="btn btn-lg btn-olive btn-full" onclick="closeModal();doEndMission()">🏁 סיים אר"ן — עבור לסיכום</button>
      <button class="btn btn-lg btn-amber btn-full" onclick="closeModal();newMission()">⚡ אר"ן חדש — שמור כוח, אפס פגועים</button>
      <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()">חזור לאר"ן</button>
    </div>`);
}

function doEndMission() {
  APP_MODE = 'post';
  S.missionActive = false;
  if (_ghInterval) { clearInterval(_ghInterval); _ghInterval = null; }
  if (_reassessInterval) { clearInterval(_reassessInterval); _reassessInterval = null; }
  if (typeof _heliCountdownInterval !== 'undefined' && _heliCountdownInterval) { clearInterval(_heliCountdownInterval); _heliCountdownInterval = null; }
  addTL('sys', 'SYSTEM', 'אר"ן הסתיים 🏁', 'green');
  const ph = $('tb-phase'); if (ph) { ph.textContent = 'POST'; ph.className = 'tb-phase ph-post'; }
  const sub = $('tb-sub'); if (sub) sub.textContent = 'אר"ן הסתיים — ' + nowTime();
  { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display='none'; }
  const ftb = $('fire-toggle-btn'); if (ftb) ftb.style.display = 'none';
  updateNavMode();
  updateSitHeader();
  saveState();
  goScreen('sc-stats'); setNav(2);
  showToast('🏁 אר"ן הסתיים — עבר למסך סיכום');
}

function toggleMissionQuick() {
  if (S.missionActive) endMission();
  else startMission();
}

function fullReset() {
  if (!confirm('⚠ מחיקת כל הנתונים!\nכוח, פגועים, ציר זמן, תדרים, ציוד — הכל יימחק.\nלא ניתן לשחזר. להמשיך?')) return;
  if (!confirm('בטוח? פעולה זו בלתי הפיכה.')) return;
  // Clear all intervals
  if (_ghInterval) { clearInterval(_ghInterval); _ghInterval = null; }
  if (_reassessInterval) { clearInterval(_reassessInterval); _reassessInterval = null; }
  if (typeof _heliCountdownInterval !== 'undefined' && _heliCountdownInterval) { clearInterval(_heliCountdownInterval); _heliCountdownInterval = null; }
  Object.keys(_dtqIntervals).forEach(k => { clearInterval(_dtqIntervals[k]); delete _dtqIntervals[k]; });
  // Reset state to factory defaults
  S.force = []; S.comms = {}; S.casualties = []; S.timeline = [];
  S.missionStart = null; S.missionActive = false; S.fireMode = false;
  S.supplies = { TQ: 4, Asherman: 2, Gauze: 10, TXA: 4, 'NaCl 500': 6, Morphine: 3, Ketamine: 3, NPA: 2, Hyfin: 3, Bandaids: 20 };
  S.view = 'cards'; S.pendingFireAction = null;
  S.role = null; S.opMode = null; S.missionType = null;
  // Reset runtime state
  _currentWarFilter = 'all'; _prevCasIds = new Set();
  APP_MODE = 'prep';
  // Clear both localStorage keys
  localStorage.removeItem('benam_s');
  localStorage.removeItem('benam_s_training');
  // Reset UI
  const ph = $('tb-phase'); if (ph) { ph.textContent = 'PREP'; ph.className = 'tb-phase ph-prep'; }
  const sub = $('tb-sub'); if (sub) sub.textContent = 'טרום משימה';
  { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display='none'; }
  const ftb = $('fire-toggle-btn'); if (ftb) ftb.style.display = 'none';
  updateNavMode();
  goScreen('sc-prep'); setNav(0);
  showToast('🗑 כל הנתונים נמחקו — מצב התחלתי');
}

function newMission() {
  if (!confirm('אפס פגועים וציר זמן?\nהכוח ותדרים יישמרו.')) return;
  S.casualties = [];
  S.timeline = [];
  S.missionStart = null;
  S.missionActive = false;
  if (_ghInterval) { clearInterval(_ghInterval); _ghInterval = null; }
  if (_reassessInterval) { clearInterval(_reassessInterval); _reassessInterval = null; }
  APP_MODE = 'prep';
  const ph = $('tb-phase'); if (ph) { ph.textContent = 'PREP'; ph.className = 'tb-phase ph-prep'; }
  const sub = $('tb-sub'); if (sub) sub.textContent = 'טרום משימה';
  { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display='none'; }
  const ftb = $('fire-toggle-btn'); if (ftb) ftb.style.display = 'none';
  updateNavMode();
  saveState();
  goScreen('sc-prep'); setNav(0);
  showToast('⚡ מצב חדש — הכוח נשמר, פגועים אופסו');
}

let _ghInterval = null;
function startGoldenHour() {
  if (_ghInterval) return;
  _ghInterval = setInterval(() => { try {
    if (!S.missionStart) return;
    const el = Math.floor((Date.now() - S.missionStart) / 1000);
    const ghL = Math.max(0, 3600 - el), txaL = Math.max(0, 10800 - el);
    const _ght = $('gh-time'); if (_ght) _ght.textContent = `${p2(Math.floor(ghL / 60))}:${p2(ghL % 60)}`;
    const _txat = $('txa-time'); if (_txat) _txat.textContent = `${p2(Math.floor(txaL / 60))}:${p2(txaL % 60)}`;
    // Update chip colors
    const ghChip = $('gh-chip');
    if (ghChip) {
      const ghP = (ghL / 3600) * 100;
      ghChip.className = 'gh-chip ' + (ghP > 50 ? 'gh-ok' : ghP > 20 ? 'gh-warn' : 'gh-crit');
    }
    const txaChip = $('txa-chip');
    if (txaChip) {
      const txaP = (txaL / 10800) * 100;
      txaChip.className = 'gh-chip ' + (txaP > 50 ? 'gh-ok' : txaP > 20 ? 'gh-warn' : 'gh-crit');
    }
    // Update SA header mission timer
    updateSitHeader();
    if (el === 1800) vibrateAlert('30 דקות — Golden Hour חצי הדרך');
    if (el === 3300) vibrateAlert('5 דקות ל-Golden Hour!');
  } catch (e) { console.error('[GH ticker]', e); } }, 1000);
}

// ═══════════════════════════════════════════════════
// REASSESS REMINDERS
// ═══════════════════════════════════════════════════
let _reassessInterval = null;
function startReassessReminders() {
  if (_reassessInterval) return;
  _reassessInterval = setInterval(() => { try {
    const t1s = S.casualties.filter(c => c.priority === 'T1');
    if (!t1s.length) return;
    const names = t1s.map(c => c.name).join(', ');
    const toast = $('reassess-toast');
    toast.textContent = `⏱ הערך מחדש T1: ${names}`;
    toast.classList.add('on');
    vibrateAlert('הערך מחדש: ' + names);
    setTimeout(() => toast.classList.remove('on'), 5000);
  } catch (e) { console.error('[Reassess]', e); } }, 600000); // 10 min
}

// ═══════════════════════════════════════════════════
// ADD CASUALTY
// ═══════════════════════════════════════════════════
function _getCasualtyCreationComponent() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyCreationComponent
    ? window.BENAM_LEGACY.casualtyCreationComponent
    : null;
}

function openAddCas(prefill = null) {
  const creationComponent = _getCasualtyCreationComponent();
  if (creationComponent && creationComponent.openAddCasualtyModal) {
    return creationComponent.openAddCasualtyModal(prefill);
  }

  mechSel = [];
  const forceOpts = S.force.length ? `<select class="inp" id="nc-from-force" onchange="autofillCas(this.value)">
    <option value="">— מהרוסטר —</option>
    ${S.force.map(f => `<option value="${f.id}">${escHTML(f.name)} [${escHTML(f.blood)}]</option>`).join('')}
  </select>`: '';
  openModal('פגוע חדש', `
    <div class="pad col">
      ${forceOpts}
      <input class="inp" id="nc-name" placeholder="שם מלא" value="${escHTML(prefill?.name || '')}">
      <div class="row"><input class="inp" id="nc-id" placeholder="מ.א." value="${escHTML(prefill?.idNum || '')}" style="flex:1"><input class="inp" id="nc-kg" placeholder='ק"ג' type="number" value="${prefill?.kg || ''}" style="width:80px"></div>
      <div class="row">
        <select class="inp" id="nc-blood" style="flex:1"><option value="">סוג דם</option>${ALL_BT.map(b => `<option${prefill?.blood === b ? ' selected' : ''}>${b}</option>`).join('')}</select>
        <select class="inp" id="nc-allergy" style="flex:1" data-note-id="nc-allergy-note" onchange="showOtherNote(this)">
          <option value="">ללא אלרגיה</option>
          <option value="פניצילין"${prefill?.allergy === 'פניצילין' ? ' selected' : ''}>פניצילין</option>
          <option value="NSAIDs"${prefill?.allergy === 'NSAIDs' ? ' selected' : ''}>NSAIDs</option>
          <option value="קטמין"${prefill?.allergy === 'קטמין' ? ' selected' : ''}>קטמין</option>
          <option value="מורפין"${prefill?.allergy === 'מורפין' ? ' selected' : ''}>מורפין</option>
          <option value="אחר">אחר — הזן הערה</option>
        </select>
      </div>
      <textarea class="other-note" id="nc-allergy-note" rows="2" placeholder="פרט אלרגיה..."></textarea>
      <select class="inp" id="nc-prio">
        <option value="T1">T1 — URGENT קריטי</option>
        <option value="T2">T2 — DELAYED דחוף</option>
        <option value="T3">T3 — MINIMAL קל</option>
        <option value="T4">T4 — EXPECTANT</option>
      </select>
      <div style="font-size:10px;color:var(--muted)">מנגנון פציעה:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="mech-btns">
        ${['ירי', 'פיצוץ', 'להב', 'נפילה', 'כוויה', 'רסיס'].map(m => `<button class="btn btn-sm btn-ghost" onclick="togMech(this,'${m}')" data-m="${m}">${m}</button>`).join('')}
        <button class="btn btn-sm btn-ghost" id="mech-other-btn" onclick="togMech(this,'אחר');$('mech-other-note').classList.toggle('show',mechSel.includes('אחר'))">אחר</button>
      </div>
      <textarea class="other-note" id="mech-other-note" rows="2" placeholder="פרט מנגנון פציעה..."></textarea>
      <button class="btn btn-xl btn-red btn-full" onclick="saveCas()">הוסף פגוע ⚡</button>
    </div>`);
  if (prefill) {
    setTimeout(() => {
      const sel = $('nc-from-force');
      if (sel) { const opt = [...sel.options].find(o => o.value == prefill.id); if (opt) sel.value = prefill.id; }
    }, 30);
  }
}
function autofillCas(fid) {
  const creationComponent = _getCasualtyCreationComponent();
  if (creationComponent && creationComponent.autofillCasualtyForm) {
    return creationComponent.autofillCasualtyForm(fid);
  }

  const creationService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyCreationService ? window.BENAM_LEGACY.casualtyCreationService : null;
  const f = creationService && creationService.getForceMemberPrefill ? creationService.getForceMemberPrefill(fid) : S.force.find(x => x.id == fid);
  if (!f) return;
  $('nc-name').value = f.name; $('nc-id').value = f.idNum;
  $('nc-kg').value = f.kg; $('nc-blood').value = f.blood; $('nc-allergy').value = f.allergy;
}
function togMech(btn, m) {
  const creationComponent = _getCasualtyCreationComponent();
  if (creationComponent && creationComponent.toggleMechanismSelection) {
    return creationComponent.toggleMechanismSelection(btn, m);
  }

  const i = mechSel.indexOf(m);
  if (i >= 0) { mechSel.splice(i, 1); btn.classList.remove('btn-olive'); btn.classList.add('btn-ghost'); }
  else { mechSel.push(m); btn.classList.remove('btn-ghost'); btn.classList.add('btn-olive'); }
}
function saveCas() {
  const creationComponent = _getCasualtyCreationComponent();
  if (creationComponent && creationComponent.saveCasualtyFromForm) {
    return creationComponent.saveCasualtyFromForm();
  }

  const name = $('nc-name').value.trim();
  if (!name) { showToast('⚠ שם הפגוע נדרש'); $('nc-name').focus(); return; }
  const creationService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyCreationService ? window.BENAM_LEGACY.casualtyCreationService : null;
  const c = creationService && creationService.createCasualtyRecord
    ? creationService.createCasualtyRecord({
      name,
      identifier: $('nc-id').value,
      weightKg: $('nc-kg').value,
      bloodType: $('nc-blood').value,
      allergy: getSelectVal('nc-allergy', 'nc-allergy-note'),
      priority: $('nc-prio').value,
      mechanisms: mechSel.map(m => m === 'אחר' ? (($('mech-other-note')?.value.trim()) || 'אחר') : m),
      nextCasualtyId: nextCasId(),
      nowTime: nowTime(),
      nowTimestamp: Date.now()
    })
    : {
      id: nextCasId(), name, idNum: $('nc-id').value,
      kg: parseFloat($('nc-kg').value) || 70,
      blood: $('nc-blood').value,
      allergy: getSelectVal('nc-allergy', 'nc-allergy-note'),
      priority: $('nc-prio').value,
      mech: mechSel.map(m => m === 'אחר' ? (($('mech-other-note')?.value.trim()) || 'אחר') : m),
      time: nowTime(), tqStart: null,
      txList: [], injuries: [], photos: [],
      vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
      fluids: [], fluidTotal: 0, march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
      vitalsHistory: [], _addedAt: Date.now(),
      evacType: '', medic: '', buddyName: ''
    };
  S.casualties.push(c);
  mechSel = [];
  addTL(c.id, c.name, `פגוע חדש — ${c.priority} — ${c.mech.join(', ') || 'לא צוין'}`, prioDot(c.priority));
  $('tb-sub').textContent = `אר"ן פעיל — ${S.casualties.length} פצועים`;
  forceClose();
  renderWarRoom();
  saveState();
  computeNAE();
  // Open the drawer immediately so user can mark injuries on the body map
  setTimeout(() => {
    jumpToCas(c.id);
    setTimeout(() => {
      const db = $("drawer-body");
      const mapSec = db && [...db.querySelectorAll(".sec")].find(el => el.textContent.includes("מפת פציעות"));
      if (mapSec) mapSec.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
  }, 80);
}

// ═══════════════════════════════════════════════════
// WAR ROOM RENDER
// ═══════════════════════════════════════════════════
function syncMissionAutoState() {
  const hasCasualties = Array.isArray(S.casualties) && S.casualties.length > 0;
  const wasActive = !!S.missionActive;

  if (hasCasualties && !wasActive) {
    APP_MODE = 'operational';
    S.missionActive = true;
    if (!S.missionStart) S.missionStart = Date.now();
    startGoldenHour();
    startReassessReminders();
    startSAPulse();
    if (typeof initVoice === 'function') initVoice();
  } else if (!hasCasualties && wasActive) {
    APP_MODE = 'prep';
    S.missionActive = false;
    S.missionStart = null;
    S.fireMode = false;
    if (_ghInterval) { clearInterval(_ghInterval); _ghInterval = null; }
    if (_reassessInterval) { clearInterval(_reassessInterval); _reassessInterval = null; }
  }

  const ph = $('tb-phase');
  if (ph) {
    if (S.missionActive) {
      ph.textContent = 'ACTIVE';
      ph.className = 'tb-phase ph-active';
    } else {
      ph.textContent = 'PREP';
      ph.className = 'tb-phase ph-prep';
    }
  }

  const sub = $('tb-sub');
  if (sub) sub.textContent = S.missionActive ? `אר"ן פעיל — ${S.casualties.length} פצועים` : 'טרום משימה';

  const golden = $('gh-chip'); if (golden) golden.style.display = S.missionActive ? '' : 'none';
  const fireToggle = $('fire-toggle-btn'); if (fireToggle) fireToggle.style.display = S.missionActive ? '' : 'none';
  const navFire = $('nav-fire'); if (navFire) navFire.style.display = S.missionActive ? 'flex' : 'none';
  const voiceBtn = $('voice-btn'); if (voiceBtn) voiceBtn.style.display = S.missionActive ? '' : 'none';

  updateNavMode();
}

function setView(v) {
  S.view = v;
  ['cards', 'rows', 'board', 'medic'].forEach(k => {
    const b = $(`view-${k}-btn`);
    if (b) b.className = 'btn btn-xs ' + (v === k ? 'btn-olive' : 'btn-ghost');
  });
  const casListEl = $('cas-list');
  const boardEl = $('board-view');
  const medicEl = $('medic-view');
  if (casListEl) casListEl.style.display = (v === 'board' || v === 'medic') ? 'none' : '';
  if (boardEl) boardEl.style.display = v === 'board' ? '' : 'none';
  if (medicEl) medicEl.style.display = v === 'medic' ? '' : 'none';
  renderWarRoom();
}

function txaWindowHTML(c) {
  // TXA window = 3h from Time of Injury (TOI) per TCCC 2024
  const ref = c.timeOfInjury || c._addedAt || c.tqStart;
  if (!ref) return '';
  const hrs = (Date.now() - ref) / 3600000;
  if (hrs > 3) return `<div class="txa-window txa-closed">💉 TXA: חלון סגר (${hrs.toFixed(1)}h)</div>`;
  const rem = 3 - hrs;
  const cls = rem > 1 ? 'txa-open' : 'txa-warn';
  return `<div class="txa-window ${cls}">💉 TXA: עוד ${Math.floor(rem * 60)} דק'</div>`;
}


function renderBoardView(sorted) {
  const wrap = $('board-wrap'); if (!wrap) return;
  const cols = [
    { p: 'T1', label: 'T1 — URGENT', bg: 'var(--crit-bg)', hdr: 'linear-gradient(90deg, var(--red), var(--red3))', glow: 'var(--shadow-glow-red)' },
    { p: 'T2', label: 'T2 — DELAYED', bg: 'var(--urg-bg)', hdr: 'linear-gradient(90deg, var(--orange), var(--orange2))', glow: 'var(--shadow-glow-amber)' },
    { p: 'T3', label: 'T3 — MINIMAL', bg: 'var(--min-bg)', hdr: 'linear-gradient(90deg, var(--green), var(--green3))', glow: 'var(--shadow-glow-olive)' },
    { p: 'T4', label: 'T4 — EXPECT', bg: 'var(--s1)', hdr: 'linear-gradient(90deg, var(--muted), var(--muted2))', glow: '0 4px 15px rgba(64,64,64,.2)' },
  ];
  wrap.innerHTML = cols.map(col => {
    const cas = sorted.filter(c => c.priority === col.p);
    return `<div class="board-col" style="background:${col.bg}; border-radius:var(--r-lg); padding:10px; border:1px solid var(--glass-border); backdrop-filter:var(--glass-blur); box-shadow:var(--glass-glow)">
      <div style="font-size:11px; font-weight:900; padding:8px 10px; background:${col.hdr}; border-radius:var(--r-md); color:var(--white); text-align:center; letter-spacing:1px; margin-bottom:12px; box-shadow:${col.glow}">
        ${col.label} <span style="font-size:14px; margin-right:4px; opacity:0.8">${cas.length}</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:8px">
        ${cas.map(c => {
          const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : 0;
          const _txaRef = c.timeOfInjury || c._addedAt || c.tqStart;
          const txaRem = _txaRef ? Math.max(0, 180 - Math.floor((Date.now() - _txaRef) / 60000)) : null;
          return `<div style="background:var(--glass-bg); border:1px solid var(--glass-border); border-radius:var(--r-md); padding:10px; cursor:pointer; position:relative; overflow:hidden; transition:all var(--dur-normal) var(--ease-out); backdrop-filter:var(--glass-blur)" onclick="jumpToCas(${c.id})">
              <div style="font-size:13px; font-weight:900; color:var(--white); margin-bottom:4px; letter-spacing:0.3px">${escHTML(c.name)}</div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:6px">
                <span style="font-size:9px; background:var(--glass-bg-surface); padding:2px 6px; border-radius:6px; color:var(--muted2)">🩸 ${escHTML(c.blood || '?')}</span>
                <span style="font-size:9px; background:var(--glass-bg-surface); padding:2px 6px; border-radius:6px; color:var(--muted2)">⚖️ ${c.kg}kg</span>
              </div>
              <div style="display:flex; flex-direction:column; gap:3px">
                ${c.tqStart ? `<div style="font-size:10px; font-family:var(--font-mono); font-weight:900; color:${tqM > 45 ? 'var(--red3)' : tqM > 30 ? 'var(--amber3)' : 'var(--green3)'}">⏱ TQ ${tqM}m</div>` : ''}
                ${txaRem !== null ? `<div style="font-size:10px; font-weight:700; color:${txaRem < 30 ? 'var(--red3)' : txaRem < 60 ? 'var(--amber3)' : 'var(--green3)'}">💉 TXA ${txaRem}m</div>` : ''}
                <div style="font-size:9px; color:var(--olive3); display:flex; align-items:center; gap:4px">🩺 ${escHTML(c.medic || 'לא שוייך')}</div>
              </div>
            </div>`;
        }).join('')}
        ${cas.length === 0 ? `<div style="font-size:11px; color:var(--muted); text-align:center; padding:30px 0; border:1px dashed var(--glass-border); border-radius:var(--r-md)">CLEAR</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function renderMedicView(sorted) {
  const mb = $('medic-board'); if (!mb) return;
  // Medics = force members with role חובש or having medical equip
  const medics = S.force.filter(f => f.role === 'חובש' || f.role === 'מ"מ' || f.role === 'מפקד');
  if (!medics.length) { mb.innerHTML = '<div style="padding:16px;color:var(--muted);font-size:12px">אין חובשים ברוסטר — הוסף לוחמים עם תפקיד חובש</div>'; return; }
  mb.innerHTML = medics.map(m => {
    const assigned = sorted.filter(c => c.medic === m.name || c.medic === String(m.id));
    const load = assigned.length;
    const loadClr = load === 0 ? 'var(--muted)' : load === 1 ? 'var(--olive3)' : load === 2 ? 'var(--amber3)' : 'var(--red3)';
    return `<div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;padding:10px 12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--olive);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0">${initials(m.name)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${escHTML(m.name)}</div>
          <div style="font-size:10px;color:var(--muted)">${m.role}</div>
        </div>
        <div style="font-family:var(--font-mono);font-size:22px;font-weight:700;color:${loadClr}">${load}</div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">
        ${assigned.map(c => `<span class="prio pt${c.priority[1]}" style="cursor:pointer" onclick="jumpToCas(${c.id})">${escHTML(c.name.split(' ')[0])} ${c.priority}</span>`).join('')}
        ${assigned.length === 0 ? `<span style="font-size:11px;color:var(--muted)">פנוי — לחץ לשיוך פגוע</span>` : ''}
      </div>
      <button class="btn btn-xs btn-ghost btn-full" style="margin-top:6px" onclick="assignMedicTo(${m.id},'${escHTML(m.name)}')">+ שייך פגוע</button>
    </div>`;
  }).join('');
}

function assignMedicTo(medicId, medicName) {
  if (!S.casualties.length) { showToast('אין פגועים'); return; }
  openModal(`שייך פגוע ל-${escHTML(medicName)}`, `
    <div class="pad col">
      ${S.casualties.map(c => `
        <button class="btn btn-md btn-ghost btn-full" style="justify-content:flex-start;gap:10px${c.medic === medicName ? ';border-color:var(--olive3)' : ''}" onclick="setMedic(${c.id},'${escHTML(medicName)}')">
          <span class="prio pt${c.priority[1]}">${c.priority}</span>
          <span style="font-weight:700">${escHTML(c.name)}</span>
          ${c.medic ? `<span style="font-size:10px;color:var(--muted)">← ${escHTML(c.medic)}</span>` : ''}
          ${c.medic === medicName ? '<span style="color:var(--olive3);margin-right:auto">✓</span>' : ''}
        </button>`).join('')}
    </div>`);
}
function setMedic(casId, medicName) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.medic = medicName;
  addTL(casId, c.name, `שוייך ל-${medicName}`, 'green');
  forceClose(); renderWarRoom();
  saveState();
}

function setMedicAndStay(casId, medicName) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.medic = medicName;
  addTL(casId, c.name, `שוייך ל-${medicName}`, 'green');
  saveState();
  renderWarRoom();
  renderMedAlloc();
  forceClose();
  openMedicAllocView();
  showToast(`↔ ${c.name} → ${medicName}`);
}

function unassignMedic(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c || !c.medic) return;
  const prev = c.medic;
  c.medic = null;
  addTL(casId, c.name, `שוחרר מ-${prev}`, 'gray');
  saveState();
  renderWarRoom();
  renderMedAlloc();
  openMedicAllocView();
  showToast(`✕ ${c.name} שוחרר`);
}

function quickReassignMedic(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const medics = getMedicRoster();
  if (!medics.length) { showToast('אין גורמי רפואה בכוח'); return; }
  openModal(`↔ העבר מטפל — ${escHTML(c.name)}`, `
    <div class="pad col" style="gap:6px">
      ${medics.map(m => `
        <button class="btn btn-md btn-ghost btn-full" style="justify-content:space-between;gap:10px${c.medic === m.name ? ';border-color:var(--olive3)' : ''}" onclick="setMedicAndStay(${c.id},'${escHTML(m.name)}')">
          <span style="display:flex;align-items:center;gap:8px">
            <span style="font-weight:700">🩺 ${escHTML(m.name)}</span>
            <span style="font-size:10px;color:var(--olive3)">${m.role}</span>
          </span>
          ${c.medic === m.name ? '<span style="color:var(--olive3)">נוכחי ✓</span>' : '<span style="font-size:11px;color:var(--muted)">בחר</span>'}
        </button>`).join('')}
    </div>`);
}

function buildCard(c) {
  const txPills = c.txList.map(t => `<span class="tx-pill">${t.type}</span>`).join('');
  const _txaRef = c.timeOfInjury || c._addedAt || c.tqStart;
  const txaRem = _txaRef ? Math.max(0, 180 - Math.floor((Date.now() - _txaRef) / 60000)) : null;
  return `<div class="cas-card ct${c.priority[1]}" onclick="jumpToCas(${c.id})">
    <div class="cas-top">
      <div class="cas-av">${initials(c.name)}</div>
      <div style="flex:1">
        <div class="cas-name">${escHTML(c.name)}</div>
        <div class="cas-meta">
          <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
          ${c.allergy ? `<span class="tag tag-allergy">⚠ ${escHTML(c.allergy)}</span>` : ''}
          <span class="tag tag-kg">${c.kg}kg</span>
          <span class="prio pt${c.priority[1]}">${c.priority}</span>
        </div>
        ${c.medic ? `<div style="font-size:9px;color:var(--olive3);margin-top:2px">🩺 ${escHTML(c.medic)}</div>` : ''}
        ${txaRem !== null ? `<div style="font-size:9px;font-weight:700;color:${txaRem < 30 ? 'var(--red3)' : txaRem < 60 ? 'var(--amber3)' : 'var(--olive3)'};margin-top:1px">💉 TXA: עוד ${txaRem} דק'</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px">
        ${c.tqStart ? `<div class="tq tq-ok" id="tq-${c.id}">TQ 00:00</div>` : ''}
        <div style="font-size:10px;color:var(--muted);font-family:var(--font-mono)">${c.time}</div>
      </div>
    </div>
    <div class="cas-bottom">
      ${txPills || `<span style="font-size:11px;color:var(--muted)">אין טיפולים</span>`}
      <div style="flex:1"></div>
      <button class="btn btn-sm btn-olive" onclick="event.stopPropagation();jumpToCas(${c.id})">טפל ▶</button>
    </div>
  </div>`;
}
function buildRow(c) {
  return `<div class="cas-row ct${c.priority[1]}" onclick="jumpToCas(${c.id})">
    <div class="cas-row-av" style="background:${pClr(c.priority)}">${initials(c.name)}</div>
    <div class="cas-row-name">${escHTML(c.name)}</div>
    <span class="prio pt${c.priority[1]}" style="font-size:9px">${c.priority}</span>
    <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
    ${c.medic ? `<span style="font-size:9px;color:var(--olive3)">🩺${escHTML(c.medic)}</span>` : ''}
    ${c.tqStart ? `<div class="tq tq-ok" id="tq-${c.id}" style="font-size:10px;min-width:54px">TQ 00:00</div>` : ''}
  </div>`;
}

// startTqTick — no-op, handled by global TQ ticker below (prevents interval leak)
function startTqTick(_c) { /* handled by global ticker */ }

// Global TQ ticker — updates all active TQ elements every second
const _tqAlertCooldown = {}; // per-casualty 60s cooldown for TQ alerts
setInterval(() => {
  try {
    if (document.hidden) return;
    S.casualties.filter(c => c.tqStart).forEach(c => {
      const s = Math.floor((Date.now() - c.tqStart) / 1000);
      const m = Math.floor(s / 60);
      const clr = s > MEDICAL.TQ_CRITICAL_SEC ? 'tq tq-crit' : s > MEDICAL.TQ_WARN_SEC ? 'tq tq-warn' : 'tq tq-ok';
      const txt = `TQ ${p2(m)}:${p2(s % 60)}`;
      const el = document.getElementById(`tq-${c.id}`);
      if (el) { el.textContent = txt; el.className = clr; }
      const tqEl = document.getElementById(`tq-inline-${c.id}`);
      if (tqEl) { tqEl.textContent = `⏱ TQ ${m}′${m >= 30 ? ' ⚠' : ''}`; tqEl.style.color = m > 45 ? 'var(--red3)' : m > 30 ? 'var(--amber3)' : 'var(--olive3)'; }
      // Alert at 60 minutes with per-casualty cooldown
      if (m >= 60 && (!_tqAlertCooldown[c.id] || (Date.now() - _tqAlertCooldown[c.id]) > 60000)) {
        _tqAlertCooldown[c.id] = Date.now();
        vibrateAlert(`60 דקות TQ — ${c.name}! הערך מחדש!`);
      }
    });
  } catch (e) { console.error('[TQ ticker]', e); }
}, 1000);
// ═══════════════════════════════════════════════════
// CASUALTY DRAWER — replaces full-screen sc-cas
// ═══════════════════════════════════════════════════
let _drawerCasId = null;
let _fireSheetOpen = false;
let _renderDrawerRAF = null; // coalesce multiple renderDrawer calls into one frame

function _getCasualtyService() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService
    ? window.BENAM_LEGACY.casualtyService
    : null;
}

function _getDrawerSections() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.drawerSections
    ? window.BENAM_LEGACY.drawerSections
    : null;
}

function _getBodyMapSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.bodyMapSection
    ? window.BENAM_LEGACY.bodyMapSection
    : null;
}

function evaluateTreatmentState(c) {
  const txTypes = (c.txList || []).map(t => String(t.type || '').toLowerCase());
  const flags = {
    tq: txTypes.some(t => t.includes('tq')) || (c.treatmentFlags && c.treatmentFlags.tq),
    txa: txTypes.some(t => t.includes('txa')) || (c.treatmentFlags && c.treatmentFlags.txa),
    chest: txTypes.some(t => t.includes('chest')) || (c.treatmentFlags && c.treatmentFlags.chest),
    bleed: txTypes.some(t => t.includes('bleed') || t.includes('tourniquet')) || (c.treatmentFlags && c.treatmentFlags.bleed),
    npa: txTypes.some(t => t.includes('npa') || t.includes('נתיב אוויר')) || (c.treatmentFlags && c.treatmentFlags.npa),
  };
  c.treatmentFlags = Object.assign({}, c.treatmentFlags || {}, flags);
  const needed = [];
  if (!flags.tq) needed.push('TQ');
  if (!flags.txa) needed.push('TXA');
  if (!flags.chest) needed.push('Chest');
  if (!flags.bleed) needed.push('Bleed');
  if (!flags.npa) needed.push('NPA');
  c.autoTreatmentPriority = needed.length ? needed[0] : 'Complete';
  return { flags, needed };
}

function _getMarchProtocolSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.marchProtocolSection
    ? window.BENAM_LEGACY.marchProtocolSection
    : null;
}

function jumpToCas(id) {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  _drawerCasId = id;
  if (drawerModule && drawerModule.openCasualtyDrawer) return drawerModule.openCasualtyDrawer(id, () => { renderDrawer(id); if (typeof updateTopStats === 'function') updateTopStats(); });
  renderDrawer(id);
  $('cas-drawer').classList.add('open');
  $('drawer-overlay').classList.add('show');
  if (typeof updateTopStats === 'function') updateTopStats();
  // Show FAB
  const fab = $('wr-fab');
  if (fab) { fab.classList.add('active'); }
}

function closeDrawer() {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.closeCasualtyDrawer) {
    drawerModule.closeCasualtyDrawer(closeFireSheet);
    _drawerCasId = null;
    return;
  }
  $('cas-drawer').classList.remove('open');
  $('drawer-overlay').classList.remove('show');
  closeFireSheet();
  const fab = $('wr-fab');
  if (fab) { fab.classList.remove('open'); /* keep active — FAB stays visible on war room */ }
  _drawerCasId = null;
}

function _setCasualtyTab(caseId, tabName) {
  const container = document.getElementById(`tab-content-${caseId}`);
  if (!container) return;
  container.querySelectorAll('[data-tab]').forEach((el) => {
    el.style.display = el.getAttribute('data-tab') === tabName ? 'block' : 'none';
  });
  ['actions','meds','status'].forEach((name) => {
    const btn = document.getElementById(`tab-btn-${name}`);
    if (btn) btn.classList.toggle('btn-olive', name === tabName);
  });
}

function drawerNav(dir) {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.getAdjacentCasualtyId) {
    const nextId = drawerModule.getAdjacentCasualtyId(_drawerCasId, dir);
    if (nextId) jumpToCas(nextId);
    return;
  }
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const idx = sorted.findIndex(c => c.id == _drawerCasId);
  const next = sorted[idx + dir];
  if (next) jumpToCas(next.id);
}

function renderDrawer(id) {
  // Coalesce multiple renderDrawer calls within the same frame into one.
  // This prevents redundant re-renders when several event handlers
  // (e.g., inline onclick="action();renderDrawer(id)") fire in quick succession.
  if (_renderDrawerRAF) cancelAnimationFrame(_renderDrawerRAF);
  _renderDrawerRAF = requestAnimationFrame(() => {
    _renderDrawerRAF = null;
    _renderDrawerImmediate(id);
  });
}

function _renderDrawerImmediate(id) {
  const casualtyService = _getCasualtyService();
  const c = casualtyService && casualtyService.getNormalizedCasualtyById
    ? casualtyService.getNormalizedCasualtyById(id)
    : S.casualties.find(x => x.id == id);
  if (!c) return;
  if (casualtyService && casualtyService.ensureCasualtyDefaults) casualtyService.ensureCasualtyDefaults(c);

  // Header
  const badge = $('drawer-prio-badge');
  if (badge) {
    badge.textContent = c.priority;
    badge.className = `prio pt${c.priority[1]}`;
    // Auto-close logic for evacuated/expectant patients
    if (c.priority === 'T4' && c.evacStage === 'done') {
       setTimeout(() => { if (_drawerCasId === c.id) closeDrawer(); }, 800);
    }
  }
  $('drawer-cas-name').textContent = c.name;
  const meta = $('drawer-cas-meta');
  if (meta) {
    const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
    // All values escaped via escHTML to prevent XSS
    const _metaHtml = `
      <span class="tag tag-blood">🩸 ${escHTML(c.blood || '?')}</span>
      ${c.allergy ? `<span class="tag tag-allergy">⚠️ ${escHTML(c.allergy)}</span>` : ''}
      <span class="tag tag-kg">⚖️ ${c.kg}kg</span>
      ${tqM !== null ? `<span style="font-family:var(--font-mono);font-size:10px;color:${tqM > 45 ? 'var(--red3)' : tqM > 30 ? 'var(--amber3)' : 'var(--olive3)'};font-weight:700">🩹 TQ ${tqM}′${tqM > 30 ? ' ⚠️' : ''}</span>` : ''}
      ${c.medic ? `<span style="color:var(--olive3)">🩺 ${escHTML(c.medic)}</span>` : ''}
      ${c.gps ? `<span style="color:var(--olive3)">📍 ${escHTML(c.gps)}</span>` : ''}
      <button class="btn btn-xs btn-ghost" onclick="openSyncBroadcastForCasualty(${c.id})" style="font-size:9px;padding:1px 5px;min-height:18px;border-color:var(--b1);color:var(--muted)">📡 שידור סנכרון</button>
    `;
    meta.textContent = '';
    meta.insertAdjacentHTML('beforeend', _metaHtml);
  }
  // Body
  const body = $('drawer-body'); if (!body) return;
  const previousScroll = body.scrollTop;
  const w = c.kg || 70;
  const meds = [
    { n: 'מורפין', d: '0.1mg/kg', calc: `${(w * .1).toFixed(1)}mg`, alert: 'מורפין' },
    { n: 'קטמין IV', d: '0.5mg/kg', calc: `${(w * .5).toFixed(1)}mg`, alert: 'קטמין' },
    { n: 'קטמין IM', d: '2mg/kg', calc: `${(w * 2).toFixed(0)}mg`, alert: 'קטמין' },
    { n: 'TXA', d: '1g/10min', calc: '10ml', alert: 'TXA' },
    { n: 'NaCl', d: '500ml', calc: '500ml', alert: '' },
  ];
  const trend = getDeteriorationTrend(c);
  const trendStr = trend.level === 'severe' ? '📉 מידרדר' : trend.level === 'mild' ? '↓ ירידה קלה' : '';
  const drawerSections = _getDrawerSections();
  if (!drawerSections) { console.warn('drawerSections not loaded yet'); return; }
  const quickMarchHtml = drawerSections.buildQuickMarchSection(c, trendStr);
  const vitalsHtml = drawerSections.buildVitalsSection(c, trend, trendStr);
  // AI decision section removed from UI per request:
  // const aiDecisionHtml = drawerSections.buildAiDecisionSection(c, aiDecision(c));
  const priorityHtml = drawerSections.buildPrioritySection(c, { T1: pClr('T1'), T2: pClr('T2'), T3: pClr('T3'), T4: pClr('T4') });
  const evacuationHtml = drawerSections.buildEvacuationSection(c);
  const treatmentsHtml = drawerSections.buildTreatmentsSection(c);
  const treatmentAnalysis = evaluateTreatmentState(c);
  const treatmentSuggestionHtml = `<div class="sec">📌 מצבן טיפולי</div>
    <div style="margin:0 12px 8px;color:${treatmentAnalysis.needed.length ? 'var(--amber3)' : 'var(--green3)'};font-size:12px;">
      ${treatmentAnalysis.needed.length ? 'יש לבצע: ' + treatmentAnalysis.needed.join(' → ') : 'כל הטיפולים הנדרשים בוצעו'}
      · עדיפות אוטומטית: ${c.autoTreatmentPriority}
    </div>`;
  const medicationsHtml = drawerSections.buildMedicationsSection(c, meds);
  const bodyMapSection = _getBodyMapSection();
  const bodyMapHtml = bodyMapSection.buildBodyMapSection(c);

  const tabSectionHtml = `
    <div style="margin:0 12px 8px;border:1px solid var(--b1);border-radius:10px;overflow:hidden;">
      <div style="display:flex;gap:4px;background:var(--s2);padding:4px;">
        <button id="tab-btn-actions" class="btn btn-xs btn-ghost" style="flex:1;min-height:34px;" onclick="_setCasualtyTab('${c.id}','actions')">⚡ פעולות</button>
        <button id="tab-btn-meds" class="btn btn-xs btn-ghost" style="flex:1;min-height:34px;" onclick="_setCasualtyTab('${c.id}','meds')">💊 תרופות</button>
        <button id="tab-btn-status" class="btn btn-xs btn-ghost" style="flex:1;min-height:34px;" onclick="_setCasualtyTab('${c.id}','status')">📌 מצב טיפולי</button>
      </div>
      <div id="tab-content-${c.id}" style="padding:10px;background:var(--s1);">
        <div data-tab="actions">${drawerSections.buildActionsSection(c)}</div>
        <div data-tab="meds" style="display:none">${medicationsHtml}</div>
        <div data-tab="status" style="display:none">${treatmentSuggestionHtml}</div>
      </div>
    </div>`;
  const spo2 = parseInt(c.vitals?.spo2) || 99;
  const gcs = parseInt(c.vitals?.gcs) || 15;
  const pulse = parseInt(c.vitals?.pulse) || 0;
  const criticalLevel = (spo2 < 90 || gcs < 10 || pulse > 130 || pulse < 50);
  const criticalHtml = criticalLevel
    ? `<div style="background:rgba(200,40,40,.2);color:var(--red3);border:1px solid rgba(240,72,72,.65);border-radius:8px;padding:8px 10px;margin:0 12px 8px;font-weight:700">⚠️ מצב קריטי: SpO2 ${spo2}% | GCS ${gcs} | דופק ${pulse}</div>`
    : `<div style="background:rgba(40,120,40,.14);color:var(--olive3);border:1px solid rgba(60,160,60,.45);border-radius:8px;padding:8px 10px;margin:0 12px 8px;font-weight:600">✅ מצב יציב: SpO2 ${spo2}% | GCS ${gcs} | דופק ${pulse}</div>`;
  const marchProtocolSection = _getMarchProtocolSection();
  const marchProtocolHtml = marchProtocolSection.buildMarchProtocolSection(c.id, MARCH_PHASES, MARCH_COLORS, {
    collapsible: true,
    wrapperId: `dm-full-${c.id}`,
    title: 'MARCH מלא',
    collapsedLabel: '▼ לחץ להרחבה'
  });
  const photosHtml = drawerSections.buildPhotosSection(c);
  const actionsHtml = drawerSections.buildActionsSection(c);
  const notesHtml = drawerSections.buildNotesSection(c);

  // Build new content off-screen in a DocumentFragment, then swap atomically.
  // This replaces the old body.textContent=''; body.insertAdjacentHTML(...)
  // pattern which caused two separate DOM mutations and a visible flash.
  const _drawerHtml = `
    ${bodyMapHtml}

    ${quickMarchHtml}
    ${vitalsHtml}

    ${treatmentsHtml}

    ${priorityHtml}
    ${evacuationHtml}

    ${tabSectionHtml}

    ${photosHtml}

    ${criticalHtml}

    ${marchProtocolHtml}

    ${notesHtml}
  `;

  // Parse HTML into a temporary off-screen container, then move nodes
  // into a DocumentFragment for a single atomic DOM swap.
  // Note: all user-facing values in _drawerHtml are already escaped via escHTML.
  const _tempContainer = document.createElement('div');
  _tempContainer.insertAdjacentHTML('afterbegin', _drawerHtml);
  const _fragment = document.createDocumentFragment();
  while (_tempContainer.firstChild) _fragment.appendChild(_tempContainer.firstChild);

  // replaceChildren atomically clears old content and appends new content
  // in one synchronous DOM operation — no intermediate empty state visible.
  body.replaceChildren(_fragment);
  body.scrollTop = previousScroll;

  // Draw vitals graph if history exists
  if (c.vitalsHistory && c.vitalsHistory.length > 1) {
    requestAnimationFrame(() => drawVitalsGraph(c.id));
  }
}

async function exportCasualtyQR(id) {
  const c = S.casualties.find(x => x.id == id);
  if (!c) return;
  const packet = { kind: 'BENAM_CASUALTY', format: 3, casualty: c };
  if (typeof _buildQRBundle === 'function') {
    const bundle = await _buildQRBundle(packet);
    openModal(`📤 ייצוא פצוע: ${c.name}`, `
      <div class="pad col" style="align-items:center;min-height:380px;gap:12px">
        <div id="cas-qr-wrap" style="padding:10px;background:#fff;border-radius:10px;width:320px;height:auto;min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center"></div>
        <div style="font-size:11px;color:var(--muted);text-align:center;padding:0 20px">סרוק בקוד זה באפליקציית BENAM אחרת לייבוא הפצוע</div>
        <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()">סגור</button>
      </div>
    `);
    setTimeout(() => {
      const container = document.getElementById('cas-qr-wrap');
      if (container) _renderQRBundle(container, bundle);
    }, 100);
  } else {
    showToast('❌ רכיב QR Sync לא מאותחל');
  }
}
if (typeof window !== 'undefined') {
  window.exportCasualtyQR = exportCasualtyQR;
  window.openSyncBroadcastForCasualty = function(casId) {
    window._burstScope = 'cas';
    window._burstTargetId = casId;
    openSyncDashboard('export');
  };
  window.jumpToCas = jumpToCas;
  window.closeDrawer = closeDrawer;
  window.drawerNav = drawerNav;
}

function toggleDrawerMarch(casId, letter, el) {
  const casualtyService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService ? window.BENAM_LEGACY.casualtyService : null;
  const c = casualtyService && casualtyService.getCasualtyById ? casualtyService.getCasualtyById(casId) : S.casualties.find(x => x.id == casId);
  if (!c) return;
  const was = (c.march[letter] || 0) > 0;
  c.march[letter] = was ? 0 : 1;
  el.classList.toggle('done', !was);
  el.querySelector('.dmc-letter').style.color = !was ? 'var(--green3)' : '#aaa';
  el.querySelector('.dmc-state').textContent = !was ? '✅' : '○';
  addTL(casId, c.name, `${!was ? '✅' : '○'} MARCH ${letter} ${!was ? 'בוצע' : 'בוטל'}`, 'olive');
}

function toggleDrawerSection(id) {
  const el = $(id); if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function jumpToCasLegacy(id) {
  // Opens old full-screen detail for body map / advanced features
  const casualtyService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService ? window.BENAM_LEGACY.casualtyService : null;
  const c = casualtyService && casualtyService.getCasualtyById ? casualtyService.getCasualtyById(id) : S.casualties.find(x => x.id == id); if (!c) return;
  renderCasDetail(c);
  goScreen('sc-cas'); setNav(1);
}

function openQuickTx(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const opts = ['TQ — הנח', 'TXA 1g', 'Chest Seal', 'NPA', 'IV NaCl', 'IO access', 'Tourniquet release', 'מורפין', 'קטמין IM', 'פנסיל G', 'אחר...'];
  openModal('הוסף טיפול', `<div style="display:flex;flex-direction:column;gap:6px;padding:8px 0">
    ${opts.map(t => `<button class="btn btn-sm btn-ghost btn-full" onclick="recordTx(${casId},'${t}','${t}');closeModal();renderDrawer(${casId})">${t}</button>`).join('')}
  </div>`);
}

// ═══════════════════════════════════════════════════
// FAB + FIRE ACTION SHEET
// ═══════════════════════════════════════════════════
function toggleFireSheet() {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.toggleFireActionSheet) {
    _fireSheetOpen = drawerModule.toggleFireActionSheet(_fireSheetOpen, _drawerCasId);
    return;
  }
  _fireSheetOpen = !_fireSheetOpen;
  $('fire-sheet').classList.toggle('open', _fireSheetOpen);
  const fab = $('wr-fab'); if (fab) fab.classList.toggle('open', _fireSheetOpen);
  $('drawer-overlay').classList.toggle('show', _fireSheetOpen && !_drawerCasId);
}
function closeFireSheet() {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.closeFireActionSheet) {
    drawerModule.closeFireActionSheet(_drawerCasId);
    _fireSheetOpen = false;
    return;
  }
  _fireSheetOpen = false;
  $('fire-sheet').classList.remove('open');
  const fab = $('wr-fab'); if (fab) fab.classList.remove('open');
  if (!_drawerCasId) $('drawer-overlay').classList.remove('show');
}


function deleteCasualty(casId) {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const casualtyService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService ? window.BENAM_LEGACY.casualtyService : null;
  const c = casualtyService && casualtyService.getCasualtyById ? casualtyService.getCasualtyById(casId) : S.casualties.find(x => x.id == casId); if (!c) return;
  if (!confirm('מחק פגוע: ' + c.name + '?')) return;
  if (_dtqIntervals[casId]) { clearInterval(_dtqIntervals[casId]); delete _dtqIntervals[casId]; }
  if (drawerActionService && drawerActionService.deleteCasualtyById) drawerActionService.deleteCasualtyById(casId);
  else S.casualties = S.casualties.filter(x => x.id != casId);
  addTL('sys', 'SYSTEM', '🗑 ' + c.name + ' נמחק', 'מנועים');
  closeDrawer(); renderWarRoom(); saveState();
}

function viewPhoto(url) { openModal('📷 תצלום', `<img src="${url}" style="width:100%;border-radius:8px">`); }
function openBuddyAssign(casId) { assignBuddy(casId); }
function assignBuddy(casId, fid) {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  if (drawerActionService && drawerActionService.assignBuddyToCasualty) {
    const result = drawerActionService.assignBuddyToCasualty(casId, fid);
    if (!result) return;
    const f = result.forceMember;
    closeModal(); renderDrawer(casId); showToast('👤 Buddy: ' + f.name);
    return;
  }
  const c = S.casualties.find(x => x.id == casId);
  const f = S.force.find(x => x.id == fid);
  if (!c || !f) return;
  c.buddyName = f.name; c.buddyId = fid;
  closeModal(); renderDrawer(casId); showToast('👤 Buddy: ' + f.name);
}
function fireTQCurrent() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const target = drawerActionService && drawerActionService.getTopPriorityCasualtyByPriority
    ? drawerActionService.getTopPriorityCasualtyByPriority('T1')
    : null;
  const t1 = target ? [target] : S.casualties.filter(c => c.priority === 'T1').sort((a, b) => prioN(a.priority) - prioN(b.priority));
  if (!t1.length) { showToast('⚠ אין פגועים T1'); return; }
  fireTQFor(t1[0].id);
  if (_drawerCasId) renderDrawer(_drawerCasId);
}
function addTXACurrent() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const target = drawerActionService && drawerActionService.getTopPriorityCasualtyByPriority
    ? drawerActionService.getTopPriorityCasualtyByPriority('T1')
    : null;
  const t1 = target ? [target] : S.casualties.filter(c => c.priority === 'T1');
  if (!t1.length) { showToast('⚠ אין פגועים T1'); return; }
  addTXA(t1[0].id);
  if (_drawerCasId) renderDrawer(_drawerCasId);
}
function fireAirway() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const c = drawerActionService && drawerActionService.getActionTargetCasualty
    ? drawerActionService.getActionTargetCasualty(_drawerCasId, 'T1')
    : (_drawerCasId ? S.casualties.find(x => x.id == _drawerCasId) : S.casualties.find(c => c.priority === 'T1'));
  if (!c) { showToast('⚠ בחר פגוע'); return; }
  if (drawerActionService && drawerActionService.appendImmediateTreatment) drawerActionService.appendImmediateTreatment(c.id, 'NPA — נתיב אוויר', 'A');
  else {
    c.txList.push({ type: 'NPA — נתיב אוויר', time: nowTime(), ms: Date.now() });
    c.march.A = (c.march.A || 0) + 1;
  }
  addTL(c.id, c.name, '🌬️ NPA הונח — נתיב אוויר', 'olive');
  if (_drawerCasId) renderDrawer(_drawerCasId);
  renderWarRoom(); showToast(`🌬️ NPA — ${c.name}`);
}
function fireChestSeal() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const c = drawerActionService && drawerActionService.getActionTargetCasualty
    ? drawerActionService.getActionTargetCasualty(_drawerCasId, 'T1')
    : (_drawerCasId ? S.casualties.find(x => x.id == _drawerCasId) : S.casualties.find(c => c.priority === 'T1'));
  if (!c) { showToast('⚠ בחר פגוע'); return; }
  if (drawerActionService && drawerActionService.appendImmediateTreatment) drawerActionService.appendImmediateTreatment(c.id, 'Chest Seal', 'R');
  else {
    c.txList.push({ type: 'Chest Seal', time: nowTime(), ms: Date.now() });
    c.march.R = (c.march.R || 0) + 1;
  }
  addTL(c.id, c.name, '🫁 Chest Seal הונח', 'olive');
  if (_drawerCasId) renderDrawer(_drawerCasId);
  renderWarRoom(); showToast(`🫁 Chest Seal — ${c.name}`);
}
function fireT4Current() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const c = _drawerCasId
    ? (window.BENAM_LEGACY.casualtyService && window.BENAM_LEGACY.casualtyService.getCasualtyById ? window.BENAM_LEGACY.casualtyService.getCasualtyById(_drawerCasId) : S.casualties.find(x => x.id == _drawerCasId))
    : null;
  if (!c) { showToast('⚠ פתח פגוע קודם'); return; }
  if (!confirm(`${c.name} — לשנות ל-T4 Expectant?`)) return;
  if (drawerActionService && drawerActionService.markCasualtyExpectant) drawerActionService.markCasualtyExpectant(c.id);
  else c.priority = 'T4';
  addTL(c.id, c.name, '⚫ T4 Expectant', 'muted');
  renderWarRoom(); if (_drawerCasId) renderDrawer(_drawerCasId);
}

// Show FAB when mission is active
// ═══════════════════════════════════════════════════
// ALLERGY CHECK
// ═══════════════════════════════════════════════════
function checkAllergy(casId, drug) {
  const c = S.casualties.find(x => x.id == casId); if (!c || !c.allergy) return false;
  const allergyMap = { 'מורפין': ['מורפין', 'Morphine'], 'קטמין': ['קטמין', 'Ketamine'], 'פניצילין': ['פניצילין', 'PENC'], 'NSAIDs': ['NSAIDs', 'ibuprofen'] };
  const triggers = allergyMap[c.allergy] || [];
  const isDangerous = triggers.some(t => drug.toLowerCase().includes(t.toLowerCase()));
  if (isDangerous) {
    $('ab-detail').textContent = `${c.name} — אלרגי ל${c.allergy}!\nאין לתת: ${drug}\nחפש תחליף!`;
    $('allergy-block').classList.add('on');
    vibrateAlert(`⛔ אלרגיה! ${c.name} — לא לתת ${drug}`);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════
// GUIDED FLOW
// ═══════════════════════════════════════════════════
function startGuidedFlow(casId) {
  guidedCasId = casId;
  const c = S.casualties.find(x => x.id == casId);
  guidedSteps = [
    { title: `${c.name} — M`, instruction: 'החל TQ\n2 אצבעות מעל הפצע', sub: 'הדק חזק עד שדימום נעצר. כתוב זמן על TQ בטוש.', confirm: '✓ TQ הוחל' },
    { title: 'Safety', instruction: 'גצירת נשק + Safety', sub: 'הסר נשק מהפגוע — פרוק.', confirm: '✓ נשק בצוע' },
    { title: 'A — נתיב אוויר', instruction: 'בדוק נשימה ספונטנית', sub: 'ראה עלייה ירידה בחזה. אם לא — NPA!', confirm: '✓ נתיב אוויר פתוח' },
    { title: 'C — Circulation', instruction: 'IV/IO + נוזלים\nהכן TXA', sub: 'אם זמן מפציעה <3 שעות — תן TXA 1g. NaCl 500ml.', confirm: '✓ IV + TXA מוכנים' },
    { title: 'H — היפותרמיה', instruction: 'כסה עם שמיכה\nBag / Blizzard', sub: 'שמור חום גוף. בדוק GCS.', confirm: '✓ כוסה — מוכן לפינוי' },
  ];
  guidedIdx = 0;
  renderGuidedStep();
  $('guided-overlay').classList.add('on');
}
function renderGuidedStep() {
  const step = guidedSteps[guidedIdx]; if (!step) return;
  $('gf-step-label').textContent = `שלב ${guidedIdx + 1} מתוך ${guidedSteps.length}`;
  $('gf-title').textContent = step.title;
  $('gf-instruction').textContent = step.instruction;
  $('gf-sub').textContent = step.sub;
  $('gf-confirm-btn').textContent = step.confirm || '✓ בוצע — המשך';
  const prog = $('gf-progress');
  prog.innerHTML = guidedSteps.map((_, i) => `<div class="gp-dot ${i < guidedIdx ? 'done' : i === guidedIdx ? 'active' : ''}"></div>`).join('');
}
function guidedNext() {
  const c = S.casualties.find(x => x.id == guidedCasId);
  if (c) addTL(c.id, c.name, `✓ ${guidedSteps[guidedIdx].title}`, 'green');
  guidedIdx++;
  if (guidedIdx >= guidedSteps.length) { closeGuided(); showToast('✓ MARCH ראשוני הושלם!'); }
  else renderGuidedStep();
}
function closeGuided() { $('guided-overlay').classList.remove('on'); }

// ═══════════════════════════════════════════════════
// CASUALTY DETAIL — FORM 101
// ═══════════════════════════════════════════════════
const INJURY_COORDS = { ראש: [44, 13], חזה: [44, 52], בטן: [44, 65], 'יד ימין': [72, 52], 'יד שמאל': [16, 52], 'רגל ימין': [55, 100], 'רגל שמאל': [33, 100] };
const MARCH_PHASES = [
  { k: 'M', title: 'Massive Hemorrhage', sub: 'עצירת דימום', items: ['TQ — 2 אצבעות מעל הפצע', 'גצירת נשק / Safety', 'H.T/J.T/נ.א — בדיקת הדרה', 'Chest Seal חזה פתוח', 'בדיקת גשים אלכותית'] },
  { k: 'A', title: 'Airway', sub: 'נתיב אוויר', items: ['נשימה ספונטנית?', 'NPA / head-tilt / jaw-thrust', 'שאיבה / קריקוטיריאוטומיה', 'תנוחת החלמה'] },
  { k: 'R', title: 'Respiration', sub: 'נשימה', items: ['ספירת נשימות (12-20/דקה)', 'Asherman / Hyfin חזה פתוח', 'דקירה 2 ICS MCL (מתח)', 'וידוא עצירת דימומים'] },
  { k: 'C', title: 'Circulation', sub: 'מחזור דם', items: ['בדיקת דופק — קצב ואיכות', 'IV/IO + NaCl 500ml', 'TXA 1g תוך 3 שעות', 'Walking Blood Bank', 'הדמייה — רשום זמן'] },
  { k: 'H', title: 'Hypothermia / Head', sub: 'חום וראש', items: ['Blizzard Bag / שמיכה', 'GCS — עיניים/מילולי/תנועה', 'קטמין/מורפין (SBP>80)', 'טופס 101 — העברת מקל'] },
];
const MARCH_COLORS = { M: 'var(--red2)', A: 'var(--orange2)', R: 'var(--amber)', C: 'var(--olive)', H: 'var(--blue2)' };

function _getCasualtyService() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService
    ? window.BENAM_LEGACY.casualtyService
    : null;
}

function _getBodyMapSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.bodyMapSection
    ? window.BENAM_LEGACY.bodyMapSection
    : null;
}

function _getMarchProtocolSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.marchProtocolSection
    ? window.BENAM_LEGACY.marchProtocolSection
    : null;
}

function renderCasDetail(c) {
  const casualtyService = _getCasualtyService();
  c = casualtyService && casualtyService.ensureCasualtyDefaults
    ? casualtyService.ensureCasualtyDefaults(c)
    : c;
  if (!c) return;
  const bodyMapSection = _getBodyMapSection();
  const bodyMapHtml = bodyMapSection ? bodyMapSection.buildBodyMapSection(c) : '';
  const marchProtocolSection = _getMarchProtocolSection();
  const marchProtocolHtml = marchProtocolSection
    ? marchProtocolSection.buildMarchProtocolSection(c.id, MARCH_PHASES, MARCH_COLORS, {
      title: 'MARCH Protocol',
      titleButtonHtml: '',
      defaultOpenPhase: 'M'
    })
    : '';

  const w = c.kg || 70;
  const meds = [
    { n: 'מורפין 🚫', d: '0.1mg/kg', calc: `${(w * .1).toFixed(1)}mg / ${(w * .1 / 10).toFixed(2)}ml`, alert: 'מורפין' },
    { n: 'קטמין IV', d: '0.5mg/kg', calc: `${(w * .5).toFixed(1)}mg / ${(w * .5 / 50).toFixed(2)}ml`, alert: 'קטמין' },
    { n: 'קטמין IM', d: '2mg/kg', calc: `${(w * 2).toFixed(0)}mg / ${(w * 2 / 50).toFixed(1)}ml`, alert: 'קטמין' },
    { n: 'TXA', d: '1g / 10min', calc: '10ml (100mg/ml)', alert: 'TXA' },
    { n: 'NaCl', d: '500ml', calc: '500ml IV/IO', alert: '' },
  ];
  // Note: All user-provided values are escaped via escHTML() to prevent XSS
  const _casHtml = `
    <!-- Header -->
    <div style="background:var(--bg);border-bottom:2px solid ${pClr(c.priority)};padding:10px 12px;display:flex;align-items:center;gap:10px">
      <button class="btn btn-sm btn-ghost" onclick="goScreen('sc-war');setNav(1)">← חזור</button>
      <div style="flex:1">
        <div style="font-size:17px;font-weight:900">🪖 ${escHTML(c.name)}</div>
        <div style="display:flex;gap:5px;margin-top:4px;flex-wrap:wrap">
          <span class="tag tag-blood">🩸 ${escHTML(c.blood || '?')}</span>
          ${c.allergy ? `<span class="tag tag-allergy">⚠️ ${escHTML(c.allergy)}</span>` : ''}
          <span class="tag tag-kg">⚖️ ${c.kg}kg</span>
          <span class="prio pt${c.priority[1]}">${c.priority}</span>
          ${c.escalated ? `<span class="esc-badge">⬆️ הועלה</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
        ${c.tqStart ? `<div class="tq tq-ok" id="dtq-${c.id}">🩹 TQ 00:00</div>` : ''}
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-ghost" onclick="openHospHandoff(${c.id})" style="border-color:var(--green2);color:var(--green3)">🏥 בי"ח</button>
          <button class="btn btn-xs btn-amber" onclick="showHandoff(${c.id})">🚁 H-Off</button>
        </div>
        <button class="btn btn-xs cas-gps-badge" onclick="tagGPS(${c.id})" id="gps-btn-${c.id}">${c.gps ? '📍 ' + escHTML(c.gps) : '📍 GPS'}</button>
      </div>
    </div>

    ${bodyMapHtml}

    <!-- AI DECISION -->
    <div class="sec">🤖 AI — טריאז' בסיסי</div>
    <div id="ai-dec-${c.id}" class="decision-box db-t${c.priority[1]}">${aiDecision(c)}</div>

    <!-- CHANGE PRIORITY -->
    <div style="padding:0 10px 6px;display:flex;gap:6px">
      ${['T1', 'T2', 'T3', 'T4'].map(p => `<button class="btn btn-sm btn-full" style="background:${c.priority === p ? pClr(p) : 'transparent'};color:${c.priority === p ? '#fff' : 'var(--muted2)'};border:${c.priority === p ? '1px solid ' + pClr(p) : 'none'}" onclick="changePriority(${c.id},'${p}')">${p}</button>`).join('')}
    </div>

    <!-- VITALS -->
    <div class="sec">💓 סימנים חיוניים</div>
    <div class="vitals-grid">
      ${[['💗 דופק', 'pulse', '72', 'BPM'], ['🫁 סטורציה', 'spo2', '98', '%'], ['🩺 לחץ דם', 'bp', '120/80', 'mmHg'], ['💨 נשימות', 'rr', '16', '/דקה'], ['🧠 GCS', 'gcs', '15', '(3-15)']].map(([lbl, key, ph, unit]) => `
        <div class="vbox" style="background:transparent;border:none">
          <div class="vbox-lbl">${lbl}</div>
          <input class="vbox-val" type="${key === 'bp' ? 'text' : 'number'}" value="${c.vitals[key]}" placeholder="${ph}" oninput="saveVital(${c.id},'${key}',this.value);updateAI(${c.id})" style="border:1px solid var(--b0);border-radius:6px;padding:6px;background:var(--s3)">
          <div style="font-size:9px;color:var(--muted)">${unit}</div>
        </div>`).join('')}
      <div class="vbox" style="background:transparent;border:none">
        <div class="vbox-lbl">👁️ UPVA</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
          ${(() => { const _ui = c.vitals.upvaIdx != null ? c.vitals.upvaIdx : 'UPVA'.indexOf(c.vitals.upva || 'U'); return ['U', 'P', 'V', 'A'].map(v => `<button class="btn btn-xs" style="flex:1;background:${'UPVA'.indexOf(v) <= _ui ? 'var(--olive)' : 'var(--s3)'};border:1px solid var(--b1);color:var(--white)" onclick="setUpva(${c.id},'${v}')">${v}</button>`).join(''); })()}
        </div>
      </div>
    </div>

    <!-- VITALS TREND GRAPH -->
    ${c.vitalsHistory && c.vitalsHistory.length > 1 ? `
    <div class="sec">📈 גרף מדדים — מגמה</div>
    <div style="margin:0 10px 10px;padding:8px"><div id="vgraph-${c.id}">
      <canvas class="vgraph-canvas" id="vgc-${c.id}" height="90"></canvas>
      <div class="vgraph-legend">
        <div class="vgraph-item"><div class="vgraph-dot" style="background:var(--red3)"></div>💗 דופק</div>
        <div class="vgraph-item"><div class="vgraph-dot" style="background:var(--green3)"></div>🫁 SpO2</div>
        <div class="vgraph-item"><div class="vgraph-dot" style="background:var(--amber3)"></div>🧠 GCS×10</div>
      </div>
    </div></div>`: ''}

    <!-- PHOTOS -->
    <div class="sec">📸 תיעוד צילומי מאובטח</div>
    <div class="photo-grid" id="photos-${c.id}">
      <label class="photo-thumb ph-empty" style="display:flex">
        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="addPhoto(${c.id},this)">
        <div style="font-size:26px">📷</div>
        <div class="ph-lbl">צלם פציעה</div>
      </label>
      ${c.photos.map((p, i) => `<div class="photo-thumb"><img src="${p.url}"><div class="ph-time">${p.time}</div></div>`).join('')}
    </div>

    ${marchProtocolHtml}

    <!-- MEDICATIONS -->
    <div class="sec">💊 תרופות — מינון לפי משקל (${c.kg}kg)</div>
    <div style="margin:0 10px 10px;padding:8px">
      <table class="med-table">
        <tr><th>💊 תרופה</th><th>📏 מינון</th><th>🧮 מחושב</th><th>✅ ניתן</th></tr>
        ${meds.map(m => `<tr>
          <td style="font-weight:700">${m.n}</td>
          <td style="color:var(--muted);font-size:10px">${m.d}</td>
          <td class="med-dose">${m.calc}</td>
          <td><button class="btn btn-xs btn-olive" onclick="recordTx(${c.id},'${m.n}','${m.alert}')">✓</button></td>
        </tr>`).join('')}
      </table>
    </div>

    <!-- FLUIDS -->
    <div class="sec">💉 נוזלים</div>
    <div style="margin:0 10px 10px;padding:8px">
      <div class="row" style="flex-wrap:wrap;gap:6px">
        ${['💧 NaCl 500ml', '🧪 Hextend 500ml', '🩸 דם 500ml', '💧 NaCl 250ml'].map(f => `<button class="btn btn-sm btn-ghost" onclick="addFluid(${c.id},'${f.replace(/^[^ ]+ /,'')}')">${f}</button>`).join('')}
      </div>
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted2);line-height:1.8" id="fl-${c.id}">
        ${c.fluids.map(f => `${f.time}  ${f.type}`).join('\n') || '—'}
      </div>
      <div style="font-weight:700">📊 סה"כ: <span style="color:var(--amber2)">${c.fluidTotal}</span> ml</div>
    </div>

    <!-- TQ manual -->
    ${!c.tqStart ? `<div style="padding:0 10px 6px"><button class="btn btn-md btn-red btn-full" onclick="startManualTQ(${c.id})">🩹 הפעל TQ + טיימר</button></div>` : ''}

    <!-- BUDDY -->
    <div class="sec">🤝 Buddy — אחראי</div>
    <div style="padding:0 10px 6px;display:flex;align-items:center;gap:8px">
      <div style="flex:1;font-size:13px">
        ${c.buddy ? `<span class="buddy-badge">👤 ${escHTML(c.buddyName)}</span> אחראי` : '<span style="color:var(--muted);font-size:12px">❌ לא משוייך</span>'}
      </div>
      <button class="btn btn-sm btn-ghost" onclick="assignBuddy(${c.id})">👥 שייך אחראי</button>
    </div>

    <div style="padding:0 10px 20px"><button class="btn btn-xl btn-amber btn-full" onclick="showHandoff(${c.id})">🚁 Hand-Off — פינוי</button></div>`;
  $('cas-detail').textContent = '';
  $('cas-detail').insertAdjacentHTML('beforeend', _casHtml);

  if (c.tqStart) tickDetailTQ(c);
}

function toggleMarchBody(id) { const el = $(id); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function toggleMarchItem(row, casId, phase, total) {
  row.classList.toggle('done');
  const cb = row.querySelector('.march-cb');
  const done = row.classList.contains('done');
  cb.textContent = done ? '✓' : '';
  if (done) cb.classList.add('checked'); else cb.classList.remove('checked');
  const doneCount = row.closest('.march-body').querySelectorAll('.done').length;
  const counter = $(`mc-${casId}-${phase}`);
  if (counter) counter.textContent = `${doneCount}/${total}`;
  const c = S.casualties.find(x => x.id == casId);
  if (c) c.march[phase] = doneCount;
}

function saveVital(casId, key, val) {
  const c = S.casualties.find(x => x.id == casId);
  if (!c) return;
  c.vitals[key] = val;
  // check for deterioration with debounce
  clearTimeout(c._vitalTimer);
  c._vitalTimer = setTimeout(() => { checkVitalsDeteriorating(c); saveState(); }, 1500);
}
// Updates vitals color + AI text in drawer WITHOUT rebuilding DOM (preserves focus)
function updateDrawerVital(casId, key, val) {
  try {
    const c = S.casualties.find(x => x.id == casId); if (!c) return;
    const v = parseInt(val) || 0;
    const isCrit = (key === 'spo2' && v < 90) || (key === 'pulse' && (v > 120 || v < 50)) || (key === 'gcs' && v < 10);
    const isWarn = (key === 'spo2' && v < 94) || (key === 'pulse' && v > 100);
    const clr = isCrit ? 'var(--red3)' : isWarn ? 'var(--amber3)' : 'var(--white)';
    const cell = document.getElementById(`dvi-${casId}-${key}`);
    if (cell) {
      cell.classList.remove('crit', 'warn');
      if (isCrit) cell.classList.add('crit');
      else if (isWarn) cell.classList.add('warn');
      const inp = cell.querySelector('.d-vinput');
      if (inp) inp.style.color = clr;
    }
    updateAI(casId);
  } catch (e) {
    console.error('updateDrawerVital failed', e, { casId, key, val });
  }
}
function setUpva(casId, val) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.vitals.upva = val;
  const uidx = 'UPVA'.indexOf(val); c.vitals.upvaIdx = uidx >= 0 ? uidx : 0;
  if (typeof renderDrawer === 'function') renderDrawer(c.id);
  else if (typeof renderCasDetail === 'function') renderCasDetail(c);
}
function changePriority(casId, prio) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.priority = prio;
  if (c.escalated) c.escalated = false;
  addTL(casId, c.name, `עדכון עדיפות → ${prio}`, 'amber');
  if (typeof renderDrawer === 'function') renderDrawer(casId);
  else if (typeof renderCasDetail === 'function') renderCasDetail(c);
  renderWarRoom(); saveState();
}
function setEvacType(casId, type) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.evacType = type;
  if (type) addTL(casId, c.name, `סוג פינוי: ${type === 'רכוב' ? '🚗 רכוב' : '🚁 מוסק'}`, 'green');
  renderWarRoom(); saveState();
}
function toggleVitalSlider(casId, key, show) {
  const wrap = document.getElementById(`dvs-wrap-${casId}-${key}`);
  if (!wrap) return;
  wrap.style.display = show ? 'block' : 'none';
}

function onVitalSliderInput(casId, key, value) {
  const input = document.getElementById(`dvi-${casId}-${key}-input`);
  if (input) {
    input.value = value;
  }
  saveVital(casId, key, value);
  updateDrawerVital(casId, key, value);
}

function updateAI(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const el = $(`ai-dec-${casId}`);
  if (el) { el.textContent = aiDecision(c); el.className = `decision-box db-t${c.priority[1]}`; }
}

function getInjuryZoneAnalysis(c) {
  const zoneCounts = (c.injuries || []).reduce((acc, injury) => {
    acc[injury.zone] = (acc[injury.zone] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(zoneCounts).map(([zone, count]) => `${zone}: ${count}`).join(' | ');
}

function aiDecision(c) {
  const g = parseInt(c.vitals.gcs) || 15;
  const spo2 = parseInt(c.vitals.spo2) || 99;
  const pulse = parseInt(c.vitals.pulse) || 70;
  const upva = c.vitals.upva || 'A';
  if (upva === 'U') return `⚠ T1 URGENT — חסר הכרה לחלוטין!\nפתח נתיב אוויר מיידי — NPA`;
  if (upva === 'V') return `⚠ T1 — מגיב רק לקולות\nGCS ${g} — שמור נתיב אוויר`;
  if (c.priority === 'T4') return `⬛ T4 EXPECTANT\nהמשך לפגוע הבא`;
  if (!c.vitals.pulse && !c.vitals.spo2) return `💡 הזן מדדים לקבלת המלצה`;
  if (spo2 < 88) return `⚠ T1 — SpO2 ${spo2}%!\nחמצן + Chest Seal מיידי`;
  if (pulse > 130) return `⚠ T1 — דופק ${pulse}\nDMH — שוק היפובולמי — נוזלים מיידי`;
  if (pulse < 50) return `⚠ T1 — ברדיקרדיה ${pulse}\nECG + IV מיידי`;
  if (g <= 8) return `⚠ T1 — GCS ${g}\nנתיב אוויר! שמור ושמר`;
  if (g <= 12) return `⚡ T2 — GCS ${g}\nעקוב כל 5 דקות`;
  return `✓ T3 — יציב\nGCS ${g} | SpO2 ${spo2}% | ${pulse}bpm`;
}

// ── INTERACTIVE BODY MAP ──
const INJ_TYPES = [
  { k: 'חדירני', color: '#c82828', icon: '🔴' },
  { k: 'שטחי', color: '#d06018', icon: '🟠' },
  { k: 'שבר', color: '#c89010', icon: '🟡' },
  { k: 'כוויה', color: '#8b4513', icon: '🟤' },
  { k: 'דימום', color: '#8b0000', icon: '⬛' },
  { k: 'בלאסט', color: '#4a4a8a', icon: '🔵' },
  { k: 'אחר', color: '#406040', icon: '✏️' },
];
function injTypeColor(t) { return (INJ_TYPES.find(x => x.k === t) || { color: '#c82828' }).color; }
function injTypeIcon(t) { return (INJ_TYPES.find(x => x.k === t) || { icon: '🔴' }).icon; }

// Which body zone based on tap coordinates in 110×230 viewBox
function classifyZone(x, y, side) {
  if (side === 'back') {
    if (y < 35) return 'עורף';
    if (y < 105) return x < 55 ? 'גב שמאל' : 'גב ימין';
    return x < 55 ? 'ישבן שמאל' : 'ישבן ימין';
  }
  if (y < 35) return 'ראש';
  if (y < 43) return 'צוואר';
  if (y < 80) {
    if (x < 28) return 'יד שמאל';
    if (x > 82) return 'יד ימין';
    return 'חזה';
  }
  if (y < 104) {
    if (x < 28) return 'יד שמאל';
    if (x > 82) return 'יד ימין';
    return 'בטן';
  }
  return x < 55 ? 'רגל שמאל' : 'רגל ימין';
}

let pendingInj = null; // {casId, cx, cy, side, zone}
let selectedInjuryType = 'חדירני'; // default active type chosen from legend
let _injPopupOpening = false; // flag: prevent document click from closing immediately

function updateInjuryTypeSelectionUI() {
  document.querySelectorAll('.injury-type-pill').forEach(btn => {
    const type = btn.dataset.type || btn.textContent.trim();
    btn.classList.toggle('active', selectedInjuryType && type === selectedInjuryType);
  });
  document.querySelectorAll('.inj-type-selected').forEach(el => {
    el.textContent = selectedInjuryType ? `בחר סוג פציעה: ${selectedInjuryType}` : 'בחר סוג פציעה';
  });
}

function setInjuryType(type) {
  selectedInjuryType = selectedInjuryType === type ? null : type;
  updateInjuryTypeSelectionUI();
  const pop = $('inj-popup-global');
  if (pop) {
    const zoneEl = $('inj-popup-zone');
    if (zoneEl) zoneEl.textContent = selectedInjuryType ? `אפשר לבחור אזור: ${selectedInjuryType}` : `בחר סוג פציעה`;
    if (selectedInjuryType) selectInjType(selectedInjuryType);
  }
}

function bodyTap(e, casId, side) {
  e.stopPropagation();
  _injPopupOpening = true;
  setTimeout(() => { _injPopupOpening = false; }, 50);
  const svg = e.currentTarget;
  const rect = svg.getBoundingClientRect();
  const scaleX = 110 / rect.width, scaleY = 230 / rect.height;
  const cx = Math.round((e.clientX - rect.left) * scaleX);
  const cy = Math.round((e.clientY - rect.top) * scaleY);
  const zone = classifyZone(cx, cy, side);
  pendingInj = { casId, cx, cy, side, zone };

  if (selectedInjuryType) {
    pendingInj.type = selectedInjuryType;
    if (selectedInjuryType !== 'אחר') {
      confirmInjury();
      return;
    }
    // for 'אחר', open popup for note entry
  }

  showInjPopup(casId, e.clientX, e.clientY, zone);
}

function showInjPopup(casId, px, py, zone) {
  const pop = $('inj-popup-global');
  if (!pop) return;
  const btns = $('inj-popup-btns');
  const note = $('inj-popup-note');
  const zoneEl = $('inj-popup-zone');
  note.classList.remove('show'); note.value = '';
  btns.innerHTML = INJ_TYPES.map(t => `
    <button class="injury-type-pill" id="injtb-${t.k.replace(/[^a-zA-Zא-ת]/g, '')}" data-type="${t.k}"
      onclick="selectInjType('${t.k}')">
      <span class="injury-type-pill-icon" style="background:${t.color}"></span>
      ${t.k}
    </button>`).join('');

  updateInjuryTypeSelectionUI();
  pop.style.display = 'block';
  const pw = 230, ph = 310;
  const vw = window.innerWidth, vh = window.innerHeight;
  let left = px + 10, top = py - 10;
  if (left + pw > vw) left = px - pw - 10;
  if (left < 4) left = 4;
  if (top + ph > vh) top = vh - ph - 10;
  if (top < 4) top = 4;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
  if (zoneEl) zoneEl.textContent = `אזור: ${zone} — בחר סוג פציעה`;
}

function selectInjType(type) {
  const pop = $('inj-popup-global'); if (!pop) return;
  selectedInjuryType = type;
  updateInjuryTypeSelectionUI();
  pop.querySelectorAll('.injury-type-pill').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`injtb-${type.replace(/[^a-zA-Zא-ת]/g, '')}`);
  if (btn) btn.classList.add('active');
  if (pendingInj) pendingInj.type = type;
  const note = $('inj-popup-note');
  note.classList.toggle('show', type === 'אחר');
  if (type === 'אחר') setTimeout(() => note.focus(), 50);
}

function confirmInjury() {
  if (!pendingInj || !pendingInj.type) { showToast('בחר סוג פציעה'); return; }
  const casId = pendingInj.casId;
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  let type = pendingInj.type;
  if (type === 'אחר') {
    const note = $('inj-popup-note');
    type = note.value.trim() || 'אחר';
  }
  c.injuries.push({ zone: pendingInj.zone, type, cx: pendingInj.cx, cy: pendingInj.cy, side: pendingInj.side });
  addTL(casId, c.name, `פציעה: ${type} — ${pendingInj.zone} (${pendingInj.side === 'back' ? 'אחורי' : 'קדמי'})`, 'red');
  cancelInjury();
  // Update SVG dots in-place (no full re-render — avoids scroll jump)
  const frontG = document.getElementById(`dots-front-${casId}`);
  const backG = document.getElementById(`dots-back-${casId}`);
  const injListEl = document.getElementById(`inj-list-${casId}`);
  if (frontG) frontG.innerHTML = c.injuries.filter(i => i.side === 'front' || !i.side).map(inj => `
    <circle cx="${inj.cx}" cy="${inj.cy}" r="7" fill="${injTypeColor(inj.type)}" opacity=".92" stroke="#000" stroke-width="1"/>
    <text x="${inj.cx}" y="${inj.cy + 4}" text-anchor="middle" font-size="8" fill="#fff">${injTypeIcon(inj.type)}</text>
  `).join('');
  if (backG) backG.innerHTML = c.injuries.filter(i => i.side === 'back').map(inj => `
    <circle cx="${inj.cx}" cy="${inj.cy}" r="7" fill="${injTypeColor(inj.type)}" opacity=".92" stroke="#000" stroke-width="1"/>
    <text x="${inj.cx}" y="${inj.cy + 4}" text-anchor="middle" font-size="8" fill="#fff">${injTypeIcon(inj.type)}</text>
  `).join('');
  if (injListEl) injListEl.innerHTML = renderInjList(c);
  const zoneAnalysis = getInjuryZoneAnalysis(c);
  if (zoneAnalysis) showToast(`🌡️ ניתוח אזורים: ${zoneAnalysis}`);
  saveState();
}

function cancelInjury() {
  const pop = $('inj-popup-global');
  if (pop) pop.style.display = 'none';
  pendingInj = null;
}

function removeInjury(casId, idx) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.injuries.splice(idx, 1);
  const frontG = document.getElementById(`dots-front-${casId}`);
  const backG = document.getElementById(`dots-back-${casId}`);
  const injListEl = document.getElementById(`inj-list-${casId}`);
  if (frontG) frontG.innerHTML = c.injuries.filter(i => i.side === 'front' || !i.side).map(inj => `
    <circle cx="${inj.cx}" cy="${inj.cy}" r="7" fill="${injTypeColor(inj.type)}" opacity=".92" stroke="#000" stroke-width="1"/>
    <text x="${inj.cx}" y="${inj.cy + 4}" text-anchor="middle" font-size="8" fill="#fff">${injTypeIcon(inj.type)}</text>
  `).join('');
  if (backG) backG.innerHTML = c.injuries.filter(i => i.side === 'back').map(inj => `
    <circle cx="${inj.cx}" cy="${inj.cy}" r="7" fill="${injTypeColor(inj.type)}" opacity=".92" stroke="#000" stroke-width="1"/>
    <text x="${inj.cx}" y="${inj.cy + 4}" text-anchor="middle" font-size="8" fill="#fff">${injTypeIcon(inj.type)}</text>
  `).join('');
  if (injListEl) injListEl.innerHTML = renderInjList(c);
  saveState();
}

function renderInjList(c) {
  if (!c.injuries.length) return '<div style="font-size:11px;color:var(--muted)">לחץ על הגוף לסימון פציעה</div>';
  return c.injuries.map((inj, i) => `
    <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--b0)">
      <div style="width:10px;height:10px;border-radius:50%;background:${injTypeColor(inj.type)};flex-shrink:0"></div>
      <div style="flex:1;font-size:11px"><span style="font-weight:700">${inj.type}</span> — ${inj.zone} <span style="color:var(--muted);font-size:9px">${inj.side === 'back' ? 'אחורי' : 'קדמי'}</span></div>
      <button class="btn btn-xs btn-ghost" style="min-height:22px;color:var(--red3);border-color:var(--red)" onclick="removeInjury(${c.id},${i})">✕</button>
    </div>`).join('');
}

// old addInjury kept as no-op (replaced by bodyTap flow)
function addInjury(casId) { }

function addPhoto(casId, input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const c = S.casualties.find(x => x.id == casId); if (!c) return;
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const url = canvas.toDataURL('image/jpeg', 0.75);
      c.photos.push({ url, time: nowTime() });
      addTL(casId, c.name, 'תמונת פציעה 📷', 'amber');
      if (typeof renderDrawer === 'function') renderDrawer(casId);
      else if (typeof renderCasDetail === 'function') renderCasDetail(c);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

const _audioRecorders = {};

function _stopAudioRecording(casId) {
  const recordState = _audioRecorders[casId];
  if (!recordState) return;
  const c = S.casualties.find((x) => x.id == casId);
  if (c) c.recordingAudio = false;

  clearTimeout(recordState.timeoutId);
  if (recordState.stream) recordState.stream.getTracks().forEach((track) => track.stop());
  if (recordState.recorder && recordState.recorder.state === 'recording') recordState.recorder.stop();

  delete _audioRecorders[casId];
  if (typeof renderDrawer === 'function') renderDrawer(casId);
  if (typeof renderCasDetail === 'function') renderCasDetail(c);
  showToast('⏹️ הקלטת קול עצרה');
}

function _startAudioFileCapture(casId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.capture = 'microphone';
  input.style.display = 'none';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) {
      showToast('❌ לא נבחר קובץ קול');
      document.body.removeChild(input);
      return;
    }
    const c = S.casualties.find((x) => x.id == casId);
    if (!c) return;
    const url = URL.createObjectURL(file);
    c.audios = c.audios || [];
    c.audios.push({ url, time: nowTime(), source: 'file' });
    addTL(casId, c.name, 'תיעוד קול (קובץ) 🎙️', 'olive');
    if (typeof renderDrawer === 'function') renderDrawer(casId);
    if (typeof renderCasDetail === 'function') renderCasDetail(c);
    saveState();
    showToast('✅ קובץ קול נוסף בהצלחה');
    document.body.removeChild(input);
  };
  document.body.appendChild(input);
  input.click();
}

async function recordAudio(casId) {
  const c = S.casualties.find((x) => x.id == casId);
  if (!c) return;
  if (c.recordingAudio) {
    _stopAudioRecording(casId);
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast('⚠️ דפדפן לא תומך getUserMedia - פותח גיבוי הקלטת קול');
    _startAudioFileCapture(casId);
    return;
  }

  if (typeof MediaRecorder === 'undefined') {
    showToast('⚠️ דפדפן לא תומך MediaRecorder - פותח גיבוי הקלטת קול');
    _startAudioFileCapture(casId);
    return;
  }

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      if (permission.state === 'denied') {
        showToast('⚠️ הרשאת מיקרופון חסומה - אפשרה בהגדרות');
        _startAudioFileCapture(casId);
        return;
      }
    } catch (e) {
      // לא כל דפדפן תומך permission api עבור מיקרופון, ממשיכים
    }
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    let hint = '';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') hint = ' (גישה נדחתה)';
    else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') hint = ' (לא נמצא מיקרופון)';
    else if (err.name === 'SecurityError' || err.name === 'NotReadableError') hint = ' (דרוש HTTPS/חומרה)';
    showToast('⚠️ לא ניתן לגשת למיקרופון: ' + (err.message || err) + hint);
    _startAudioFileCapture(casId);
    return;
  }

  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    c.audios = c.audios || [];
    c.audios.push({ url, time: nowTime(), source: 'live' });
    addTL(casId, c.name, 'תיעוד קול 🎙️', 'olive');
    if (typeof renderDrawer === 'function') renderDrawer(casId);
    if (typeof renderCasDetail === 'function') renderCasDetail(c);
    saveState();
    showToast('✅ הקלטת קול נשמרה');
  };

  recorder.start();
  c.recordingAudio = true;
  if (typeof renderDrawer === 'function') renderDrawer(casId);
  if (typeof renderCasDetail === 'function') renderCasDetail(c);
  _audioRecorders[casId] = {
    recorder,
    stream,
    timeoutId: setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 8000),
  };

  showToast('🔴 הקלטת קול החלה (8 שניות או לחיצה נוספת לעצירה)');
}

function recordTx(casId, type, allergyCheck) {
  if (allergyCheck && checkAllergy(casId, allergyCheck)) return;
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.txList.push({ type, time: nowTime() });
  addTL(casId, c.name, `ניתן: ${type}`, 'amber');
  const TQ_TRIGGERS = new Set(['TQ', 'TQ — הנח', 'TQ — חוסם', 'TQ ↻ חודש']);
  if (TQ_TRIGGERS.has(type) && !c.tqStart) c.tqStart = Date.now();
  renderWarRoom(); saveState();
}

function addFluid(casId, type) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const match = type.match(/\d+/);
  if (!match) { showToast(`⚠ לא ניתן לחשב נפח: ${escHTML(type)}`); return; }
  const ml = parseInt(match[0]);
  c.fluids.push({ type, time: nowTime() });
  c.fluidTotal = (c.fluidTotal || 0) + ml;
  const flEl = $(`fl-${casId}`);
  if (flEl) flEl.textContent = c.fluids.map(f => `${f.time}  ${f.type}`).join('\n');
  if (_drawerCasId == casId) renderDrawer(casId);
  saveState();
}

function startManualTQ(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  // Idempotency guard: reject double-tap within 2 seconds
  if (c.tqStart !== null && (Date.now() - c.tqStart) < 2000) return;
  c.tqStart = Date.now();
  c.txList.push({ type: 'TQ', time: nowTime() });
  addTL(casId, c.name, 'TQ הוחל + טיימר 🩹', 'red');
  vibrateAlert(`TQ הוחל — ${c.name}`);
  if (typeof renderDrawer === 'function') renderDrawer(casId);
  else if (typeof renderCasDetail === 'function') renderCasDetail(c);
  renderWarRoom();
  saveState();
}

const _dtqIntervals = {};
function tickDetailTQ(c) {
  if (_dtqIntervals[c.id]) clearInterval(_dtqIntervals[c.id]);
  _dtqIntervals[c.id] = setInterval(() => { try {
    const el = document.getElementById(`dtq-${c.id}`);
    if (!el) { clearInterval(_dtqIntervals[c.id]); delete _dtqIntervals[c.id]; return; }
    const s = Math.floor((Date.now() - c.tqStart) / 1000);
    el.textContent = `TQ ${p2(Math.floor(s / 60))}:${p2(s % 60)}`;
    el.className = s > MEDICAL.TQ_CRITICAL_SEC ? 'tq tq-crit' : s > MEDICAL.TQ_WARN_SEC ? 'tq tq-warn' : 'tq tq-ok';
  } catch (e) { console.error('[DTQ ticker]', e); } }, 1000);
}

function toggleBodyMapFullscreen(casId) {
  const container = document.getElementById(`bodymap-container-${casId}`);
  const btn = document.getElementById(`bodymap-fs-btn-${casId}`);
  if (!container) return;
  const isFull = container.classList.toggle('bodymap-fullscreen');
  if (btn) btn.textContent = isFull ? '✕ סגור מסך מלא' : '⛶ מסך מלא';
  document.body.classList.toggle('bodymap-fullscreen-active', isFull);
}

if (typeof window !== 'undefined') {
  window.bodyTap = bodyTap;
  window.selectInjType = selectInjType;
  window.confirmInjury = confirmInjury;
  window.cancelInjury = cancelInjury;
  window.removeInjury = removeInjury;
  window.classifyZone = classifyZone;
  window.toggleBodyMapFullscreen = toggleBodyMapFullscreen;
}

// ═══════════════════════════════════════════════════
// HAND-OFF
// ═══════════════════════════════════════════════════
function openHandoffPick() {
  if (!S.casualties.length) { showToast('אין פצועים'); return; }
  openModal('בחר פצוע לפינוי', `
    <div class="pad col">
      ${S.casualties.map(c => `<button class="btn btn-lg btn-ghost btn-full" style="justify-content:flex-start;gap:10px;border-color:${pClr(c.priority)}" onclick="showHandoff(${c.id});forceClose()">
        <span class="prio pt${c.priority[1]}">${c.priority}</span> ${escHTML(c.name)} <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
      </button>`).join('')}
    </div>`);
}
function showHandoff(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  $('ho-name').textContent = c.name;
  $('ho-blood').textContent = c.blood || '?';
  const al = $('ho-allergy');
  if (c.allergy) { al.textContent = '⚠ אלרגי: ' + c.allergy; al.style.display = ''; } else al.style.display = 'none';
  $('ho-tx').textContent = c.txList.length ? c.txList.map(t => `${t.type} @ ${t.time}`).join('\n') : 'אין טיפולים';
  const tqEl = $('ho-tq');
  if (c.tqStart) { tqEl.textContent = `⏱ TQ: ${Math.floor((Date.now() - c.tqStart) / 60000)} דקות`; tqEl.style.display = ''; } else tqEl.style.display = 'none';
  $('handoff-screen').classList.add('on');
}

// ═══════════════════════════════════════════════════
// BLOOD BANK
// ═══════════════════════════════════════════════════
function renderBloodScreen() {
  const all = [...S.force, ...S.casualties].filter(f => f.blood);
  const btnsHtml = all.map(f => `
    <button class="btn btn-md btn-ghost btn-full" onclick="showDonors('${escHTML(f.blood)}','${escHTML(f.name)}')" style="justify-content:flex-start;gap:10px">
      <span class="tag tag-blood">${escHTML(f.blood)}</span> ${escHTML(f.name)}
    </button>`).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">הוסף לוחמים תחילה</div>';
  const _brb = $('blood-recip-btns'); if (_brb) _brb.textContent = '', _brb.insertAdjacentHTML('afterbegin', btnsHtml);
  const rosterHtml = S.force.map(f => `
    <div class="donor-row">
      <div class="donor-av">${initials(f.name)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">${escHTML(f.name)}</div><div style="font-size:10px;color:var(--muted)">${f.role || ''}</div></div>
      <span class="tag tag-blood" style="font-size:12px;padding:4px 10px">${escHTML(f.blood || '?')}</span>
    </div>`).join('') || '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">אין לוחמים</div>';
  const _br = $('blood-roster'); if (_br) _br.textContent = '', _br.insertAdjacentHTML('afterbegin', rosterHtml);
}
function showDonors(recipBlood, recipName) {
  $('blood-results').style.display = '';
  $('blood-recip-name').textContent = `${recipName} [${recipBlood}]`;
  const compatible = BLOOD_COMPAT;
  $('donors-list').innerHTML = S.force.map(f => {
    if (!f.blood) return '';
    const canGive = (compatible[f.blood] || []).includes(recipBlood);
    const perfect = f.blood === recipBlood;
    return `<div class="donor-row" style="opacity:${canGive ? 1 : .35}">
      <div class="donor-av" style="border-color:${perfect ? 'var(--green2)' : canGive ? 'var(--amber)' : 'var(--b1)'}">${initials(f.name)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">${escHTML(f.name)}</div><div style="font-size:10px;color:var(--muted)">${escHTML(f.blood)} — ${f.kg}kg</div></div>
      <span class="${perfect ? 'dm-perfect' : canGive ? 'dm-ok' : 'dm-no'}">${perfect ? '✓ מושלם' : canGive ? '✓ תואם' : '✗ לא תואם'}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// 📊 STATUS REPORT — for MCE commander
// ═══════════════════════════════════════════════════
function openStatusReport() {
  const now = Date.now();
  const elapsed = S.missionStart ? Math.floor((now - S.missionStart) / 60000) : 0;
  const t1 = S.casualties.filter(c => c.priority === 'T1');
  const t2 = S.casualties.filter(c => c.priority === 'T2');
  const t3 = S.casualties.filter(c => c.priority === 'T3');
  const t4 = S.casualties.filter(c => c.priority === 'T4');
  const allActive = S.casualties.filter(c => c.priority !== 'T4');
  const withMedic = allActive.filter(c => c.medic);
  const withTQ = allActive.filter(c => c.tqStart);
  const medics = (S.force || []).filter(f => f && getMedicLevel(f.role) > 0);
  const ghMin = S.missionStart ? 60 - elapsed : 60;
  const ghColor = ghMin <= 0 ? 'var(--red3)' : ghMin <= 10 ? 'var(--amber3)' : 'var(--green3)';

  // Build evac order
  const evacRanked = [...allActive].sort((a, b) => calcEvacScore(b) - calcEvacScore(a));
  const evacHtml = evacRanked.length ? evacRanked.map((c, i) => {
    const ev = c.evacType ? ` ${c.evacType === 'מוסק' ? '🚁' : '🚗'}` : ''
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(30,50,80,.3)">
      <span style="font-family:var(--font-mono);font-size:16px;font-weight:900;color:${i === 0 ? 'var(--red3)' : i === 1 ? 'var(--amber3)' : 'var(--muted2)'};min-width:20px">${i + 1}</span>
      <span class="prio pt${c.priority[1]}" style="font-size:9px">${c.priority}</span>
      <span style="font-size:12px;font-weight:700;flex:1">${escHTML(c.name)}</span>
      <span style="font-size:9px;color:var(--muted2)">${escHTML(c.medic || 'ללא מטפל')}${ev}</span>
    </div>`;
  }).join('') : '<div style="font-size:11px;color:var(--muted)">אין פגועים</div>';

  openModal('📊 דוח מצב — מפקד אר"ן', `
    <!-- Golden Hour -->
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:11px;color:var(--muted2)">${escHTML(S.comms.unit || 'BENAM')} | ${new Date().toLocaleString('he-IL')} | דקה ${elapsed}</div>
    </div>

    <div style="background:${ghMin <= 0 ? 'rgba(200,30,30,.15)' : ghMin <= 10 ? 'rgba(200,120,0,.15)' : 'rgba(40,80,40,.15)'};border:1px solid ${ghColor};border-radius:10px;padding:12px;text-align:center;margin-bottom:12px">
      <div style="font-size:9px;color:${ghColor};letter-spacing:.1em;font-weight:700">⏱ GOLDEN HOUR</div>
      <div style="font-size:36px;font-weight:900;font-family:var(--font-mono);color:${ghColor};line-height:1;margin-top:4px">${Math.max(0, ghMin)}:00</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">${ghMin <= 0 ? 'חלף! פנה מיידית' : 'דקות נותרו'}</div>
    </div>

    <!-- Triage summary -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
      <div style="background:rgba(200,30,30,.15);border:1px solid var(--red2);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--red3);font-weight:700">T1</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--red3)">${t1.length}</div>
      </div>
      <div style="background:rgba(200,120,0,.12);border:1px solid var(--amber);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--amber3);font-weight:700">T2</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--amber3)">${t2.length}</div>
      </div>
      <div style="background:rgba(40,120,40,.12);border:1px solid var(--green);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--green3);font-weight:700">T3</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--green3)">${t3.length}</div>
      </div>
      <div style="background:rgba(80,80,80,.12);border:1px solid var(--b1);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--muted);font-weight:700">T4</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--muted)">${t4.length}</div>
      </div>
    </div>

    <!-- Key metrics -->
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:9px;color:var(--olive3);letter-spacing:.1em;font-weight:700;margin-bottom:8px">📈 מדדים</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="font-size:10px;color:var(--muted)">גורמי רפואה:</span> <span style="font-weight:700">${medics.length}</span></div>
        <div><span style="font-size:10px;color:var(--muted)">בטיפול:</span> <span style="font-weight:700">${withMedic.length}/${allActive.length}</span></div>
        <div><span style="font-size:10px;color:var(--muted)">TQ פתוחים:</span> <span style="font-weight:700;color:${withTQ.length ? 'var(--red3)' : 'var(--green3)'}">${withTQ.length}</span></div>
        <div><span style="font-size:10px;color:var(--muted)">כוח:</span> <span style="font-weight:700">${S.force.length}</span></div>
      </div>
    </div>

    <!-- Evac priority -->
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:9px;color:var(--olive3);letter-spacing:.1em;font-weight:700;margin-bottom:8px">🚁 סדר פינוי מומלץ</div>
      ${evacHtml}
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="btn btn-md btn-olive btn-full" onclick="copyStatusReport()">📋 העתק</button>
      <button class="btn btn-md btn-ghost btn-full" onclick="readStatusReport()">🔊 הקרא</button>
    </div>
    <button class="btn btn-sm btn-ghost btn-full" onclick="closeModal()" style="margin-top:4px">סגור</button>
  `);
}

function copyStatusReport() {
  const now = Date.now();
  const elapsed = S.missionStart ? Math.floor((now - S.missionStart) / 60000) : 0;
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const t2 = S.casualties.filter(c => c.priority === 'T2').length;
  const t3 = S.casualties.filter(c => c.priority === 'T3').length;
  const t4 = S.casualties.filter(c => c.priority === 'T4').length;
  const allActive = S.casualties.filter(c => c.priority !== 'T4');
  const withMedic = allActive.filter(c => c.medic).length;
  const withTQ = allActive.filter(c => c.tqStart).length;
  const txt = `דוח מצב — ${S.comms.unit || 'BENAM'}
${new Date().toLocaleString('he-IL')} | דקה ${elapsed}
T1:${t1} T2:${t2} T3:${t3} T4:${t4}
בטיפול: ${withMedic}/${allActive.length} | TQ פתוחים: ${withTQ}
כוח: ${S.force.length} | גורמי רפואה: ${(S.force || []).filter(f => f && getMedicLevel(f.role) > 0).length}`;
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => showToast('דוח מצב הועתק ✓'));
}

function readStatusReport() {
  const elapsed = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const t2 = S.casualties.filter(c => c.priority === 'T2').length;
  const t3 = S.casualties.filter(c => c.priority === 'T3').length;
  const txt = `דוח מצב. יחידה ${S.comms.unit || ''}. דקה ${elapsed}. טי 1: ${t1}. טי 2: ${t2}. טי 3: ${t3}. סך הכל ${S.casualties.length} פגועים.`;
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'he-IL'; u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  showToast('🔊 מקריא דוח מצב...');
}

// ═══════════════════════════════════════════════════
// REPORT + QR + SUPPLY
// ═══════════════════════════════════════════════════
function genReport() {
  if (!S.casualties.length) { $('report-txt').textContent = 'אין פצועים פעילים.'; return; }
  const now = new Date(), t = `${p2(now.getHours())}${p2(now.getMinutes())}Z`;
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const t2 = S.casualties.filter(c => c.priority === 'T2').length;
  const t3 = S.casualties.filter(c => c.priority === 'T3').length;
  let r = `=== MEDEVAC REQUEST — 9 LINE ===\n`;
  r += `TIME: ${t} | UNIT: ${S.comms.unit || '—'}\n\n`;
  r += `L1 LOCATION:  ${S.comms.lz1 || '[נ.צ.]'}\n`;
  r += `L2 FREQ:      ${S.comms.mahup || '—'} / HELO: ${S.comms.helo || '—'}\n`;
  r += `L3 PATIENTS:  T1:${t1}  T2:${t2}  T3:${t3}\n`;
  const al = S.casualties.filter(c => c.allergy).map(c => `${c.name}(${c.allergy})`).join(', ');
  r += `L4 SPECIAL:   ${al || 'NONE'}\n`;
  r += `L5 LZ:        ${S.comms.lz1 || '—'}\n`;
  r += `L6 SECURITY:  UNKNOWN\nL7 MARKING:   PENDING\nL8 IDF\nL9 TERRAIN:   FLAT\n\n`;
  r += `=== CASUALTY DETAIL ===\n`;
  S.casualties.forEach((c, i) => {
    r += `\n${i + 1}. ${c.name} | ${c.blood || '?'} | ${c.kg}kg | ${c.priority}\n`;
    if (c.allergy) r += `   ⚠ ALLERGY: ${c.allergy}\n`;
    if (c.tqStart) r += `   TQ: ${Math.floor((Date.now() - c.tqStart) / 60000)} דקות\n`;
    c.txList.forEach(tx => r += `   • ${tx.type} @ ${tx.time}\n`);
    c.injuries.forEach(inj => r += `   • ${inj.type} — ${inj.zone}\n`);
    if (c.fluidTotal) r += `   נוזלים: ${c.fluidTotal}ml\n`;
    if (c.vitals.gcs) r += `   GCS: ${c.vitals.gcs}\n`;
  });
  r += `\n=== LZ READY — AWAITING ETA ===`;
  $('report-txt').textContent = r;
  addTL('sys', 'SYSTEM', 'דוח MEDEVAC הופק 📡', 'amber');
}
function copyReport() {
  const t = $('report-txt').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => showToast('הועתק! ✓'));
  else { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('הועתק! ✓'); }
}
function readReport() {
  const t = $('report-txt').textContent;
  if (!t || t.includes('לחץ')) return;
  const u = new SpeechSynthesisUtterance(t);
  u.lang = 'he-IL'; u.rate = 0.85; u.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  showToast('🔊 מקריא דוח...');
}
function populateQRPick() {
  const _qp = $('qr-pick'); if (!_qp) return;
  _qp.textContent = '';
  const html = S.casualties.map(c => `
    <button class="btn btn-sm btn-ghost btn-full" style="justify-content:flex-start;gap:8px" onclick="showToast('QR נוצר — ${escHTML(c.name)}')">
      <span class="prio pt${c.priority[1]}">${c.priority}</span> ${escHTML(c.name)} — QR
    </button>`).join('') || '<div style="font-size:12px;color:var(--muted);padding:8px">אין פצועים</div>';
  _qp.insertAdjacentHTML('beforeend', html);
}
function populateSupply() {
  const supplyHtml = Object.entries(S.supplies).map(([n, v]) => `
    <div class="supply-card ${v <= 2 ? 'low' : ''}">
      <div style="font-size:9px;color:var(--muted);margin-bottom:2px">${n}</div>
      <div style="font-family:var(--font-mono);font-size:24px;font-weight:700;color:${v <= 2 ? 'var(--red3)' : 'var(--white)'}">${v}</div>
      ${v <= 2 ? `<div style="font-size:9px;color:var(--red3);font-weight:700;margin-bottom:4px">⚠ מלאי נמוך</div>` : ''}
      <div style="display:flex;gap:4px;margin-top:4px">
        <button class="btn btn-xs btn-ghost btn-full" onclick="chgS('${n}',-1)" style="min-height:30px">−</button>
        <button class="btn btn-xs btn-ghost btn-full" onclick="chgS('${n}',1)" style="min-height:30px">+</button>
      </div>
    </div>`).join('');
  const _sg = $('supply-grid'); if (_sg) _sg.insertAdjacentHTML('afterbegin', ((_sg.textContent=''),supplyHtml));
  const _sgs = $('supply-grid-stats'); if (_sgs) _sgs.insertAdjacentHTML('afterbegin', ((_sgs.textContent=''),supplyHtml));
}
function chgS(n, d) { S.supplies[n] = Math.max(0, (S.supplies[n] || 0) + d); populateSupply(); }

// ═══════════════════════════════════════════════════
// AAR — AFTER ACTION REPORT
// ═══════════════════════════════════════════════════
function genAAR() {
  if (!S.missionStart && !S.casualties.length) { showToast('אין נתוני אירוע'); return; }
  const dur = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;
  const totalTx = S.casualties.reduce((a, c) => a + c.txList.length, 0);
  const maxTQ = S.casualties.filter(c => c.tqStart).map(c => Math.floor((Date.now() - c.tqStart) / 60000));
  const tqMins = maxTQ.length ? Math.max(...maxTQ) : 0;
  const html = `
    <div class="aar-section">
      <div class="aar-hdr">AAR — After Action Report — ${new Date().toLocaleDateString('he-IL')}</div>
      <div class="aar-stat"><div class="aar-stat-lbl">יחידה</div><div class="aar-stat-val">${escHTML(S.comms.unit || '—')}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">משך אירוע</div><div class="aar-stat-val">${dur} דקות</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">סה"כ פצועים</div><div class="aar-stat-val">${S.casualties.length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T1 קריטיים</div><div class="aar-stat-val" style="color:var(--red3)">${S.casualties.filter(c => c.priority === 'T1').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T2 דחופים</div><div class="aar-stat-val" style="color:var(--amber3)">${S.casualties.filter(c => c.priority === 'T2').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T3 קלים</div><div class="aar-stat-val" style="color:var(--green3)">${S.casualties.filter(c => c.priority === 'T3').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T4 Expectant</div><div class="aar-stat-val" style="color:var(--muted)">${S.casualties.filter(c => c.priority === 'T4').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">סה"כ טיפולים</div><div class="aar-stat-val">${totalTx}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">TQ מקסימלי</div><div class="aar-stat-val" style="color:${tqMins > 45 ? 'var(--red3)' : 'var(--green3)'}">${tqMins} דקות</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">אירועי ציר זמן</div><div class="aar-stat-val">${S.timeline.length}</div></div>
    </div>
    <div class="aar-section">
      <div class="aar-hdr">פצועים — סיכום</div>
      ${S.casualties.map(c => `
        <div class="aar-stat" style="flex-direction:column;align-items:flex-start;gap:4px">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <span class="prio pt${c.priority[1]}">${c.priority}</span>
            <span style="font-weight:700">${escHTML(c.name)}</span>
            <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
            ${c.allergy ? `<span class="tag tag-allergy">⚠ ${escHTML(c.allergy)}</span>` : ''}
          </div>
          <div style="font-size:11px;color:var(--muted2)">${c.txList.map(t => t.type).join(' → ') || 'אין טיפולים'}</div>
          ${c.injuries.length ? `<div style="font-size:10px;color:var(--muted)">${c.injuries.map(i => i.type + ' — ' + i.zone).join(' | ')}</div>` : ''}
        </div>`).join('') || '<div style="padding:12px;color:var(--muted);font-size:12px">אין פצועים</div>'}
    </div>`;
  $('aar-section').innerHTML = html;
}

// ═══════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════
// renderTimeline — defined above with filter support

// ═══════════════════════════════════════════════════
// 🌙 NIGHT / RED MODE
// ═══════════════════════════════════════════════════
function toggleNight() {
  // Use ONLY night-vision class (full NVG palette in variables.css)
  // night-mode was a conflicting sepia filter — removed
  document.body.classList.toggle('night-vision');
  const active = document.body.classList.contains('night-vision');
  // Clean up legacy class if present
  document.body.classList.remove('night-mode');
  localStorage.setItem('benam_nv', active ? '1' : '0');
  showToast(active ? '🟢 תצוגת NVG — פעיל' : '🌙 תצוגת NVG — כבוי');
}
function toggleRecording(forceState) {
  const ind = $('rec-indicator');
  if (!ind) return;
  const active = forceState !== undefined ? forceState : ind.style.display === 'none';
  if (forceState !== undefined && ((forceState && ind.style.display === '') || (!forceState && ind.style.display === 'none'))) return;
  ind.style.display = active ? '' : 'none';
  if (active) addTL('sys', 'SYSTEM', 'Recording started', 'olive');
  else addTL('sys', 'SYSTEM', 'Recording stopped', 'muted');
}
function openUserSettings() {
  const prefs = S.prefs;
  openModal('⚙️ הגדרות מערכת BENAM', `
    <div class="pad col" style="gap:20px; max-height:80vh; overflow-y:auto">
      
      <!-- Tactical Category -->
      <div class="col" style="gap:8px">
        <div style="font-size:10px; color:var(--olive3); font-weight:700; letter-spacing:0.1em">⚡ מבצעי — התראות וקול</div>
        <div class="card" style="margin:0; background:var(--s3); border-color:var(--b2)">
          <div class="pad col" style="gap:12px">
            <div class="row" style="justify-content:space-between">
              <div style="font-size:14px">חיווי קולי (Speech-to-Text)</div>
              <input type="checkbox" id="pref-voice" ${prefs.voiceEnabled ? 'checked' : ''} onchange="updatePref('voiceEnabled', this.checked)">
            </div>
            <div class="row" style="justify-content:space-between">
              <div style="font-size:14px">משוב רטט (Haptic Feedback)</div>
              <input type="checkbox" id="pref-haptic" ${prefs.hapticFeedback ? 'checked' : ''} onchange="updatePref('hapticFeedback', this.checked)">
            </div>
            <div class="col" style="gap:4px">
              <div style="font-size:12px; color:var(--muted2)">התראת TQ קריטית אחרי (דקות)</div>
              <input type="range" min="15" max="60" step="5" value="${prefs.tqThreshold}" 
                oninput="$('tq-val').textContent = this.value; updatePref('tqThreshold', parseInt(this.value))"
                style="width:100%">
              <div style="text-align:center; font-family:var(--font-mono); font-size:16px; color:var(--red3)" id="tq-val">${prefs.tqThreshold} דקות</div>
            </div>
            <div class="col" style="gap:4px; margin-top:8px">
              <div style="font-size:12px; color:var(--muted2)">שם קשר (Radio Name)</div>
              <input type="text" id="pref-radio-name" class="input input-sm input-full" placeholder="לדוג׳: חופ״ל א׳" 
                value="${prefs.radioName || ''}" oninput="updatePref('radioName', this.value.trim())"
                style="background:rgba(0,0,0,0.2); border:1px solid var(--b1); color:var(--white); padding:8px; border-radius:6px">
            </div>
          </div>
        </div>
      </div>

      <!-- Visual Category -->
      <div class="col" style="gap:8px">
        <div style="font-size:10px; color:var(--olive3); font-weight:700; letter-spacing:0.1em">🌙 תצוגה וממשק</div>
        <div class="card" style="margin:0; background:var(--s3); border-color:var(--b2)">
          <div class="pad col" style="gap:12px">
            <button class="btn btn-md btn-ghost btn-full" onclick="toggleNight(); closeTopbarMenu(); closeModal()">
              ${document.body.classList.contains('night-vision') ? '☀️ מצב יום' : '🌙 מצב לילה (NVG)'}
            </button>
            <div class="row" style="justify-content:space-between">
              <div style="font-size:14px">סנכרון QR אוטומטי</div>
              <input type="checkbox" id="pref-sync" ${prefs.autoSync ? 'checked' : ''} onchange="updatePref('autoSync', this.checked)">
            </div>
            <div class="col" style="gap:4px">
              <div style="font-size:12px; color:var(--muted2)">גודל גופן</div>
              <div class="row" style="gap:5px">
                ${['small','normal'].map(s => 
                  `<button class="btn btn-xs btn-ghost btn-full ${prefs.fontSize === s ? 'btn-olive' : ''}" 
                    onclick="updatePref('fontSize','${s}'); openUserSettings()">${s}</button>`
                ).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Category -->
      <div class="col" style="gap:8px">
        <div style="font-size:10px; color:var(--red3); font-weight:700; letter-spacing:0.1em">🛡️ מערכת וביטחון</div>
        <div class="card" style="margin:0; background:var(--s3); border-color:var(--red)">
          <div class="pad col" style="gap:12px">
            <button class="btn btn-md btn-ghost btn-full" onclick="closeModal(); goScreen('sc-role')">👤 שינוי תפקיד/מצב</button>
            <button class="btn btn-md btn-red btn-full" onclick="fullReset()">🗑️ איפוס נתונים מלא</button>
            <div style="font-size:9px; color:var(--muted); text-align:center">BENAM Version 1.1.0-Tactical</div>
          </div>
        </div>
      </div>

      <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()">חזרה</button>
    </div>
  `);
}

function updatePref(key, val) {
  if (!S.prefs) S.prefs = {};
  S.prefs[key] = val;
  if (key === 'nightMode') {
     if (val) document.body.classList.add('night-vision');
     else document.body.classList.remove('night-vision');
     document.body.classList.remove('night-mode'); // cleanup legacy
  }
  if (key === 'fontSize') {
    _applyFontSize(val);
  }
  saveState();
  showToast('✓ הגדרות עודכנו');
}

function _applyFontSize(size) {
  const root = document.documentElement;
  const app = document.getElementById('app');
  root.classList.remove('fs-small', 'fs-normal', 'fs-large');
  root.classList.add('fs-' + (size || 'normal'));
  const zoomMap = { small: '0.9', normal: '1', large: '1.1' };
  if (app) app.style.zoom = zoomMap[size] || '1';
}

// Apply saved font size on boot
try {
  const _fsRaw = localStorage.getItem('benam_state');
  if (_fsRaw) { const _fst = JSON.parse(_fsRaw); if (_fst.prefs && _fst.prefs.fontSize) _applyFontSize(_fst.prefs.fontSize); }
} catch(_e) {}

/* Topbar ⋯ menu */
function toggleTopbarMenu() {
  const navigation = window.BENAM_LEGACY && window.BENAM_LEGACY.navigation ? window.BENAM_LEGACY.navigation : null;
  if (navigation && navigation.toggleTopbarMenu) return navigation.toggleTopbarMenu();
  const m = document.getElementById('tb-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
function closeTopbarMenu() {
  const navigation = window.BENAM_LEGACY && window.BENAM_LEGACY.navigation ? window.BENAM_LEGACY.navigation : null;
  if (navigation && navigation.closeTopbarMenu) return navigation.closeTopbarMenu();
  document.getElementById('tb-menu').style.display = 'none';
}
if (typeof window !== 'undefined') {
  window.toggleRecording = toggleRecording;
  window.toggleNight = toggleNight;
  window.toggleNightMode = toggleNight; // legacy alias for tests and older scripts
  window.openUserSettings = openUserSettings;
  window.toggleTopbarMenu = toggleTopbarMenu;
  window.closeTopbarMenu = closeTopbarMenu;
}
/* Close topbar menu on outside click */
document.addEventListener('click', e => {
  const m = document.getElementById('tb-menu');
  if (m && m.style.display !== 'none' && !m.contains(e.target) && !e.target.closest('.tb-icons'))
    m.style.display = 'none';
});

// ═══════════════════════════════════════════════════
// 📊 STATS DASHBOARD
// ═══════════════════════════════════════════════════
function renderStats() {
  try { if (typeof renderKPI === 'function') renderKPI(); } catch(e) { console.warn('[renderStats] renderKPI failed:', e); }
  const cas = S.casualties;
  const t1 = cas.filter(c => c.priority === 'T1').length;
  const t2 = cas.filter(c => c.priority === 'T2').length;
  const t3 = cas.filter(c => c.priority === 'T3').length;
  const t4 = cas.filter(c => c.priority === 'T4').length;
  const tqs = cas.filter(c => c.tqStart);
  const maxTQ = tqs.length ? Math.max(...tqs.map(c => Math.floor((Date.now() - c.tqStart) / 60000))) : 0;
  const dur = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;
  const totalTx = cas.reduce((a, c) => a + c.txList.length, 0);
  const tqOver45 = tqs.filter(c => ((Date.now() - c.tqStart) / 60000) > 45).length;

  const _sg = $('stats-grid'); if (!_sg) return;
  _sg.textContent = '';
  _sg.insertAdjacentHTML('afterbegin', `
    <div class="stat-box ${t1 > 0 ? 'stat-crit' : 'stat-ok'}">
      <div class="stat-num" style="color:${t1 > 0 ? 'var(--red3)' : 'var(--green3)'}">${t1}</div>
      <div class="stat-lbl">T1 קריטיים</div>
    </div>
    <div class="stat-box ${t2 > 0 ? 'stat-warn' : ''}">
      <div class="stat-num" style="color:${t2 > 0 ? 'var(--amber3)' : 'var(--muted2)'}">${t2}</div>
      <div class="stat-lbl">T2 דחופים</div>
    </div>
    <div class="stat-box stat-ok">
      <div class="stat-num" style="color:var(--green3)">${t3}</div>
      <div class="stat-lbl">T3 קלים</div>
    </div>
    <div class="stat-box">
      <div class="stat-num" style="color:var(--muted)">${t4}</div>
      <div class="stat-lbl">T4 Expectant</div>
    </div>
    <div class="stat-box ${dur > 55 ? 'stat-crit' : dur > 30 ? 'stat-warn' : ''}">
      <div class="stat-num" style="color:${dur > 55 ? 'var(--red3)' : dur > 30 ? 'var(--amber3)' : 'var(--white)'}">${dur}</div>
      <div class="stat-lbl">דקות מהפתיחה</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${totalTx}</div>
      <div class="stat-lbl">סה"כ פעולות</div>
    </div>
    <div class="stat-box ${tqOver45 > 0 ? 'stat-crit' : ''}">
      <div class="stat-num" style="color:${tqOver45 > 0 ? 'var(--red3)' : 'var(--white)'}">${tqOver45}</div>
      <div class="stat-lbl">TQ מעל 45 דק'</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${S.force.length}</div>
      <div class="stat-lbl">כוח כולל</div>
    </div>`);

  $('tq-stats').innerHTML = tqs.length ? tqs.map(c => {
    const m = Math.floor((Date.now() - c.tqStart) / 60000);
    const cls = m > 45 ? 'stat-crit' : m > 30 ? 'stat-warn' : '';
    return `<div class="card ${cls}" style="padding:10px 12px;display:flex;align-items:center;gap:10px;margin:0">
      <span class="prio pt${c.priority[1]}">${c.priority}</span>
      <span style="font-size:13px;font-weight:700;flex:1">${escHTML(c.name)}</span>
      <span class="tq ${m > 45 ? 'tq-crit' : m > 30 ? 'tq-warn' : 'tq-ok'}">⏱ ${m} דקות</span>
      ${m > 45 ? '<span style="font-size:10px;color:var(--red3);font-weight:700">⚠ סכנת עצב!</span>' : ''}
    </div>`;
  }).join('') : '<div style="font-size:12px;color:var(--muted);padding:8px">אין TQ פתוחים</div>';

  // Supply remaining (equip-stats element removed from UI)
  const _eqs = $('equip-stats'); if (!_eqs) return;
  const low = Object.entries(S.supplies).filter(([, v]) => v <= 2);
  _eqs.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px">
      ${Object.entries(S.supplies).map(([n, v]) => `
        <div style="background:${v <= 1 ? 'var(--crit-bg)' : v <= 2 ? 'var(--urg-bg)' : 'var(--s2)'};border:1px solid ${v <= 1 ? 'var(--red2)' : v <= 2 ? 'var(--amber)' : 'var(--b0)'};border-radius:5px;padding:7px;text-align:center">
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${v <= 1 ? 'var(--red3)' : v <= 2 ? 'var(--amber3)' : 'var(--white)'}">${v}</div>
          <div style="font-size:8px;color:var(--muted);margin-top:1px">${n}</div>
        </div>`).join('')}
    </div>`;

  // Gantt chart
  setTimeout(renderGantt, 50);
}

// ═══════════════════════════════════════════════════
// ⚠ VITALS DETERIORATION ALERT
// ═══════════════════════════════════════════════════
const _prevVitals = {};
function checkVitalsDeteriorating(c) {
  const prev = _prevVitals[c.id] || {};
  const alerts = [];
  const pulse = parseInt(c.vitals.pulse);
  const spo2 = parseInt(c.vitals.spo2);
  const gcs = parseInt(c.vitals.gcs);
  const prevP = parseInt(prev.pulse || 0);
  const prevS = parseInt(prev.spo2 || 100);
  const prevG = parseInt(prev.gcs || 15);
  if (prevP > 0 && pulse > 0 && pulse < prevP - 20) alerts.push(`דופק ירד ${prevP}→${pulse}`);
  if (prevS > 0 && spo2 > 0 && spo2 < prevS - 5) alerts.push(`SpO2 ירד ${prevS}→${spo2}%`);
  if (prevG > 0 && gcs > 0 && gcs < prevG - 2) alerts.push(`GCS ירד ${prevG}→${gcs}`);
  if (pulse && pulse < 50) alerts.push(`ברדיקרדיה! ${pulse}bpm`);
  if (spo2 && spo2 < 88) alerts.push(`היפוקסיה! ${spo2}%`);
  if (alerts.length) {
    const wa = $('worsening-alert');
    wa.innerHTML = `⚠ ${escHTML(c.name)}<br>${alerts.join('<br>')}`;
    wa.classList.add('on');
    vibrateAlert(`החמרה: ${c.name} — ${alerts[0]}`);
    setTimeout(() => wa.classList.remove('on'), 8000);
  }
  _prevVitals[c.id] = { pulse: c.vitals.pulse, spo2: c.vitals.spo2, gcs: c.vitals.gcs };
}

// ═══════════════════════════════════════════════════
// 💉 SHOCK CALCULATOR
// ═══════════════════════════════════════════════════
function calcShock(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const pulse = parseInt(c.vitals.pulse) || 0;
  const sbp = parseInt((c.vitals.bp || '').split('/')[0]) || 0;
  const gcs = parseInt(c.vitals.gcs) || 15;
  const kg = c.kg || 70;

  // Shock Index
  const si = pulse && sbp ? pulse / sbp : 0;
  let shockGrade = '', shockColor = 'shock-ok', recs = [];

  if (si === 0) { shockGrade = 'לא ניתן לחשב — הזן ויטלים'; shockColor = ''; }
  else if (si < 0.6) { shockGrade = '✓ ללא שוק — יציב'; shockColor = 'shock-ok'; }
  else if (si < 0.9) { shockGrade = '⚡ שוק קל — ערנות'; shockColor = 'shock-warn'; recs = ['מעקב כל 3 דקות', 'IV / הכן נוזלים']; }
  else if (si < 1.2) { shockGrade = '⚠ שוק בינוני — Permissive Hypotension'; shockColor = 'shock-warn'; recs = ['NaCl 250ml בולוס', 'SBP יעד: 80-90mmHg', 'TXA אם <3 שעות']; }
  else { shockGrade = '🔴 שוק קשה / היפובולמי'; shockColor = 'shock-result'; recs = ['NaCl 500ml מהיר', 'Walking Blood Bank', 'שקול IO', 'סמן T1 מיידי']; }

  // GCS fluid guidance
  if (gcs < 9 && sbp) recs.push(`TBI — SBP יעד ≥90mmHg`);

  // TXA window
  const inTXAWindow = (c._addedAt || c.tqStart) && ((Date.now() - (c._addedAt || c.tqStart)) / 3600000) < 3;

  const el = document.getElementById(`shock-calc-${casId}`);
  if (!el) return;
  el.innerHTML = `
    <div class="shock-result ${shockColor}">
      <div style="font-size:16px;font-weight:900;margin-bottom:8px">${shockGrade}</div>
      ${si > 0 ? `<div style="font-size:12px;color:var(--muted2)">Shock Index: <span style="font-family:var(--font-mono);color:var(--amber2)">${si.toFixed(2)}</span> | ${pulse}bpm / ${sbp}mmHg</div>` : ''}
      ${recs.length ? `<div style="margin-top:8px;font-size:12px;line-height:1.8">${recs.map(r => `• ${r}`).join('<br>')}</div>` : ''}
      ${inTXAWindow ? `<div style="margin-top:6px;font-size:11px;color:var(--amber3);font-weight:700">✓ בחלון TXA — תן עכשיו!</div>` : ''}
    </div>`;
}

// ═══════════════════════════════════════════════════
// 👥 BUDDY SYSTEM
// ═══════════════════════════════════════════════════
function assignBuddy(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  openModal('שייך אחראי — Buddy', `
    <div class="pad col">
      <div style="font-size:12px;color:var(--muted2)">מי אחראי על ${escHTML(c.name)}?</div>
      ${S.force.map(f => `
        <button class="btn btn-md btn-ghost btn-full" style="justify-content:flex-start;gap:10px${c.buddy === f.id ? ';border-color:var(--olive3)' : ''}" onclick="setBuddy(${casId},${f.id},'${escHTML(f.name)}')">
          <span style="font-size:18px">👤</span>
          <span style="font-weight:700">${escHTML(f.name)}</span>
          <span style="font-size:10px;color:var(--muted)">${f.role || ''}</span>
          ${c.buddy === f.id ? '<span style="margin-right:auto;color:var(--olive3)">✓ נוכחי</span>' : ''}
        </button>`).join('')}
      <button class="btn btn-md btn-ghost btn-full" onclick="setBuddy(${casId},null,'ללא')">✕ הסר שיוך</button>
    </div>`);
}
function setBuddy(casId, buddyId, buddyName) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.buddy = buddyId; c.buddyName = buddyName;
  addTL(casId, c.name, `Buddy: ${buddyName}`, 'green');
  forceClose(); renderWarRoom();
  // Refresh drawer if this casualty is currently open
  if (casId === _drawerCasId) { renderDrawer(casId); }
}

// ═══════════════════════════════════════════════════
// 🌳 DECISION TREE — MARCH FLOW
// ═══════════════════════════════════════════════════
const DT_PHASES = {
  M: {
    label: 'M — Massive Hemorrhage', color: 'var(--red2)', nodes: {
      start: { q: 'יש דימום מסיבי?', yes: 'tq', no: 'm_done' },
      tq: { action: 'החל TQ מיידי — 2 אצבעות מעל הפצע\nהדק עד שהדימום נעצר', q: 'הדימום נעצר?', yes: 'm_done', no: 'tq2' },
      tq2: { action: 'הוסף TQ שני / החלף תחבושת לחץ\nשקול Wound Packing עם Gauze', q: 'הדימום נעצר עכשיו?', yes: 'm_done', no: 'm_crit' },
      m_crit: { action: '⚠ דימום לא נשלט!\nסמן T1 קריטי — קרא לחובש בכיר\nהמשך לחץ ישיר', done: true, next: 'A' },
      m_done: { action: '✓ דימום בשליטה', done: true, next: 'A' },
    }
  },
  A: {
    label: 'A — Airway', color: 'var(--orange2)', nodes: {
      start: { q: 'הפגוע נושם ספונטנית?', yes: 'a_check', no: 'a_open' },
      a_open: { action: 'ראש אחורה + הרמת סנטר (Head-Tilt Chin-Lift)\nאו Jaw-Thrust אם חשד לפגיעת עמ"ש', q: 'עכשיו נושם?', yes: 'a_check', no: 'a_npa' },
      a_npa: { action: 'הכנס NPA — מדוד מנחיר לאוזן\nתן לובריקנט', q: 'נתיב אוויר פתוח?', yes: 'a_check', no: 'a_cric' },
      a_cric: { action: '⚠ חסימה מוחלטת!\nCricothyrotomy — חיתוך מעל סחוס כריקואיד\nטיפול מתקדם בלבד', done: true, next: 'R' },
      a_check: { action: '✓ נתיב אוויר פתוח\nמנוחת החלמה אם חסר הכרה', done: true, next: 'R' },
    }
  },
  R: {
    label: 'R — Respiration', color: 'var(--amber)', nodes: {
      start: { q: 'נשימות תקינות (12-20/דקה)?', yes: 'r_ok', no: 'r_check' },
      r_check: { q: 'יש פצע חזה פתוח / צפצוף?', yes: 'r_seal', no: 'r_tension' },
      r_seal: { action: 'Chest Seal / Hyfin — סתום 3 צדדים\nאם tension: שחרר את הצד ה-4', done: true, next: 'C' },
      r_tension: { action: '⚠ Tension Pneumothorax?\nדיקור מחט — 2nd ICS MCL\nהאזן לשחרור אוויר', done: true, next: 'C' },
      r_ok: { action: '✓ נשימה תקינה', done: true, next: 'C' },
    }
  },
  C: {
    label: 'C — Circulation', color: 'var(--olive2)', nodes: {
      start: { q: 'דופק תקין? (>60, חזק)', yes: 'c_iv', no: 'c_shock' },
      c_shock: { action: '⚠ שוק! Shock Index מחשב...\nהפעל IV/IO מיידי\nNaCl 250ml בולוס — SBP יעד 80-90', q: 'SBP >80 אחרי נוזלים?', yes: 'c_txa', no: 'c_blood' },
      c_blood: { action: '⚠ שוק לא מגיב לנוזלים!\nWalking Blood Bank — תאם דם\nהכן Walking Donor', done: true, next: 'H' },
      c_iv: { action: '✓ פתח IV/IO\nרשום זמן', q: 'חלון TXA פתוח (<3 שעות)?', yes: 'c_txa', no: 'c_done' },
      c_txa: { action: 'TXA 1g IV — 10 דקות\nתן מיידי אם <3 שעות מהפציעה', done: true, next: 'H' },
      c_done: { action: '✓ Circulation יציב', done: true, next: 'H' },
    }
  },
  H: {
    label: 'H — Hypothermia', color: 'var(--blue2)', nodes: {
      start: { q: 'טמפרטורה / קר / רטוב?', yes: 'h_warm', no: 'h_gcs' },
      h_warm: { action: 'Blizzard Bag / שמיכה — כסה מהר\nהסר ציוד רטוב\nגרד קרקפת + גוף', q: 'מכוסה?', yes: 'h_gcs', no: 'h_gcs' },
      h_gcs: { q: 'GCS <14?', yes: 'h_neuro', no: 'h_done' },
      h_neuro: { action: '⚠ TBI אפשרי\nSBP יעד ≥90\nזהירות עם נוזלים\nמעקב תלמידים', done: true, next: null },
      h_done: { action: '✓ MARCH הושלם!\nהפגוע יציב — קרא לפינוי', done: true, next: null },
    }
  },
};

let dtCasId = null, dtPhase = 'M', dtNode = 'start', dtLog = [];

function openDecisionTree(casId) {
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  dtCasId = casId || (sorted[0]?.id) || null;
  if (!dtCasId) { showToast('אין פגועים'); return; }
  dtPhase = 'M'; dtNode = 'start'; dtLog = [];
  renderDTree();
  $('dtree-overlay').classList.add('on');
}
function closeDTree() { $('dtree-overlay').classList.remove('on'); }

function renderDTree() {
  const c = S.casualties.find(x => x.id == dtCasId);
  const phase = DT_PHASES[dtPhase];
  const node = phase.nodes[dtNode];
  $('dt-phase-label').textContent = phase.label;
  $('dt-cas-label').textContent = c ? c.name : '—';
  $('dt-phase-label').style.color = phase.color;
  $('dt-breadcrumb').innerHTML = ['M', 'A', 'R', 'C', 'H'].map(p => `
    <div class="dt-crumb ${p === dtPhase ? 'active' : dtLog.some(l => l.phase === p) ? 'done' : ''}"
      style="${p === dtPhase ? 'background:' + phase.color + ';color:var(--white)' : ''}">${p}</div>`).join('');

  let html = '';
  if (node.action) html += `<div class="dt-action">⚡ ${node.action.replace(/\n/g, '<br>')}</div>`;
  if (node.done) {
    html += `<div style="font-size:16px;font-weight:700;color:var(--green3);text-align:center">${node.action}</div>`;
    if (node.next) {
      html += `<button class="dt-done" onclick="dtNextPhase('${node.next}')">המשך ל-${node.next} →</button>`;
    } else {
      html += `<button class="dt-done" onclick="closeDTree();showToast('✓ MARCH הושלם!')">✓ MARCH הושלם — סגור</button>`;
    }
    html += `<button class="dt-no" style="max-width:320px;width:100%" onclick="dtNextPhase('M')">↺ התחל מחדש</button>`;
  } else {
    if (node.q) html += `<div class="dt-question">${node.q}</div>`;
    html += `<div class="dt-btns">
      <button class="dt-yes" onclick="dtAnswer(true)">✓ כן</button>
      <button class="dt-no" onclick="dtAnswer(false)">✗ לא</button>
    </div>`;
  }
  $('dt-body').innerHTML = html;
}

function dtAnswer(yes) {
  const phase = DT_PHASES[dtPhase];
  const node = phase.nodes[dtNode];
  dtLog.push({ phase: dtPhase, node: dtNode, ans: yes });
  const next = yes ? node.yes : node.no;
  dtNode = next;
  renderDTree();
  // log action
  if (node.action) {
    const c = S.casualties.find(x => x.id == dtCasId);
    if (c) addTL(dtCasId, c.name, `DTree: ${dtPhase} — ${node.action.split('\n')[0]}`, 'amber');
  }
}
function dtNextPhase(ph) {
  dtPhase = ph; dtNode = 'start';
  renderDTree();
}

// ═══════════════════════════════════════════════════
// VOICE INPUT
// ═══════════════════════════════════════════════════
function initVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    { const vb = $('voice-btn'); if (vb) vb.style.display = 'none'; } return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  voiceRecog = new SR();
  voiceRecog.lang = 'he-IL'; voiceRecog.continuous = false; voiceRecog.interimResults = true;
  voiceRecog.onresult = e => {
    const txt = [...e.results].map(r => r[0].transcript).join('');
    $('voice-status').textContent = '🎙 ' + txt;
    if (e.results[0].isFinal) processVoiceCmd(txt);
  };
  voiceRecog.onend = () => { voiceActive = false; { const vb = $('voice-btn'); if (vb) vb.classList.remove('listening'); } $('voice-status').style.display = 'none'; };
  voiceRecog.onerror = () => { voiceActive = false; { const vb = $('voice-btn'); if (vb) vb.classList.remove('listening'); } $('voice-status').style.display = 'none'; };
}
function toggleVoice() {
  if (!voiceRecog) { showToast('קלט קולי לא נתמך'); return; }
  if (voiceActive) { voiceRecog.stop(); return; }
  voiceActive = true;
  { const vb = $('voice-btn'); if (vb) vb.classList.add('listening'); }
  $('voice-status').style.display = '';
  $('voice-status').textContent = '🎙 מקשיב...';
  voiceRecog.start();
}
function processVoiceCmd(txt) {
  const t = txt.trim().toLowerCase();
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const target = sorted[0];
  if (!target) { showToast('אין פגוע פעיל'); return; }
  if (t.includes('tq') || t.includes('חסם')) {
    if (!target.tqStart) target.tqStart = Date.now();
    target.txList.push({ type: 'TQ (קולי)', time: nowTime() });
    addTL(target.id, target.name, 'TQ קולי — 🎙🩹', 'red');
    renderWarRoom(); showToast(`✓ TQ רשום — ${target.name}`);
  } else if (t.includes('txa')) {
    if (!checkAllergy(target.id, 'TXA')) {
      target.txList.push({ type: 'TXA 1g (קולי)', time: nowTime() });
      addTL(target.id, target.name, 'TXA קולי 💉', 'amber');
      showToast(`✓ TXA רשום — ${target.name}`);
    }
  } else if (t.includes('נשימה') || t.includes('airway')) {
    target.txList.push({ type: 'נתיב אוויר (קולי)', time: nowTime() });
    addTL(target.id, target.name, 'נתיב אוויר קולי 💨', 'amber');
    showToast(`✓ נתיב אוויר — ${target.name}`);
  } else if (t.includes('פינוי') || t.includes('casevac')) {
    genReport(); goScreen('sc-report');
    showToast('דוח פינוי נוצר');
  } else {
    // Log as free text
    if (target) {
      addTL(target.id, target.name, '🎙 ' + txt, 'amber');
      showToast(`✓ רשום: "${txt.slice(0, 30)}"`);
    }
  }
}

// ═══════════════════════════════════════════════════
// ⚡ START ALGORITHM
// ═══════════════════════════════════════════════════
const START_FLOW = [
  { id: 'breathing', q: 'האם הפגוע נושם?', yes: 'rr', no: 'reposition' },
  { id: 'reposition', q: 'פתח נתיב אוויר (ראש אחורה)\nעכשיו נושם?', yes: 'rr', no: { result: 'T4', label: 'T4 — EXPECTANT', color: '#222', msg: 'אין נשימה גם לאחר פתיחת נתיב אוויר' } },
  { id: 'rr', q: 'קצב נשימה: מעל 30 / מתחת 10 לדקה?', yes: { result: 'T1', label: 'T1 — IMMEDIATE', color: '#c00', msg: 'נשימה לקויה — T1 URGENT' }, no: 'perfusion' },
  { id: 'perfusion', q: 'דופק רדיאלי נמוש / נימוי מתחת ל-2 שניות?', yes: 'mental', no: { result: 'T1', label: 'T1 — IMMEDIATE', color: '#c00', msg: 'הלם — אין דופק פריפרי' } },
  { id: 'mental', q: 'מצייית לפקודות פשוטות?\n(סגור/פתח עיניים)', yes: { result: 'T2', label: 'T2 — DELAYED', color: '#e80', msg: 'יציב — פגוע נייד' }, no: { result: 'T1', label: 'T1 — IMMEDIATE', color: '#c00', msg: 'חסר הכרה — T1 קריטי' } },
];

let _startNode = 'breathing', _startTimer = null, _startSec = 30;
let _pendingStartCas = null;

function openSTART() {
  if (!S.missionActive) { showToast('הפעל אר"ן קודם'); return; }
  _pendingStartCas = { name: '', blood: '', kg: 70, allergy: '' };
  openModal('שם הפגוע', `
    <div class="pad col">
      <input class="inp" id="start-name-in" placeholder="שם מלא">
      <div class="row">
        <select class="inp" id="start-blood-in" style="flex:1"><option value="">סוג דם</option>${ALL_BT.map(b => `<option>${b}</option>`).join('')}</select>
        <input class="inp" id="start-kg-in" type="number" placeholder='ק"ג' style="width:80px">
      </div>
      <button class="btn btn-xl btn-red btn-full" onclick="launchSTART()">⚡ התחל START →</button>
    </div>`);
}
function launchSTART() {
  const name = ($('start-name-in')?.value || '').trim() || 'פגוע חדש';
  _pendingStartCas = { name, blood: $('start-blood-in')?.value || '', kg: parseFloat($('start-kg-in')?.value) || 70, allergy: '' };
  forceClose();
  _startNode = 'breathing'; _startSec = 30;
  $('start-cas-name').textContent = name;
  $('start-timer').textContent = '30';
  $('start-overlay').style.display = 'flex';
  renderSTARTNode();
  _startTimer = setInterval(() => { try {
    _startSec--;
    $('start-timer').textContent = _startSec;
    $('start-timer').style.color = _startSec < 10 ? 'var(--red3)' : 'var(--amber3)';
    if (_startSec <= 0) { clearInterval(_startTimer); showSTARTResult('T1', '#c00', 'אין זמן — T1 ברירת מחדל'); }
  } catch (e) { console.error('[START timer]', e); } }, 1000);
}
function renderSTARTNode() {
  const node = START_FLOW.find(n => n.id === _startNode); if (!node) return;
  const sb = $('start-body');
  sb.innerHTML = `
    <div style="font-size:22px;font-weight:900;color:var(--white);text-align:center;max-width:300px;line-height:1.3;white-space:pre-line">${node.q}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:300px;margin-top:8px">
      <button onclick="startAns(true)" style="min-height:72px;font-size:22px;font-weight:900;background:var(--green2);color:var(--white);border:none;border-radius:10px;cursor:pointer">✓ כן</button>
      <button onclick="startAns(false)" style="min-height:72px;font-size:22px;font-weight:900;background:var(--s2);color:var(--muted2);border:2px solid var(--b1);border-radius:10px;cursor:pointer">✗ לא</button>
    </div>`;
}
function startAns(yes) {
  const node = START_FLOW.find(n => n.id === _startNode); if (!node) return;
  const next = yes ? node.yes : node.no;
  if (typeof next === 'object' && next.result) {
    clearInterval(_startTimer);
    showSTARTResult(next.result, next.color, next.msg);
  } else {
    _startNode = next;
    renderSTARTNode();
  }
}
function showSTARTResult(prio, color, msg) {
  $('start-body').innerHTML = `
    <div style="font-size:48px;font-weight:900;padding:20px 30px;background:${color};border-radius:16px;color:var(--white);text-align:center;width:100%;max-width:300px">${prio}</div>
    <div style="font-size:16px;font-weight:700;color:var(--white);text-align:center;max-width:280px">${msg}</div>
    <button onclick="confirmSTARTResult('${prio}')" style="min-height:64px;font-size:18px;font-weight:900;background:${color};color:var(--white);border:none;border-radius:10px;cursor:pointer;width:100%;max-width:300px">✓ אשר + הוסף פגוע</button>
    <button onclick="closeSTART()" style="min-height:44px;font-size:14px;font-weight:700;background:var(--s2);color:var(--muted2);border:2px solid var(--b1);border-radius:8px;cursor:pointer;width:100%;max-width:300px">ביטול</button>`;
}
function confirmSTARTResult(prio) {
  closeSTART();
  const c = {
    id: nextCasId(), name: _pendingStartCas.name, idNum: '',
    kg: _pendingStartCas.kg, blood: _pendingStartCas.blood, allergy: '',
    priority: prio, mech: ['START'], time: nowTime(), tqStart: null,
    txList: [], injuries: [], photos: [],
    vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
    vitalsHistory: [], _addedAt: Date.now(),
    fluids: [], fluidTotal: 0, march: { M: 0, A: 0, R: 0, C: 0, H: 0 }
  };
  S.casualties.push(c);
  addTL(c.id, c.name, `START → ${prio}`, 'red');
  renderWarRoom();
  saveState();
  showToast(`✓ ${c.name} → ${prio}`);
}
function closeSTART() {
  clearInterval(_startTimer);
  $('start-overlay').style.display = 'none';
}

// ═══════════════════════════════════════════════════
// 🚁 EVAC QUEUE
// ═══════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.S_evac = window.S_evac || { slots: [], heliETA: null, heliSetAt: null };
}
const S_evac = (typeof window !== 'undefined' && window.S_evac) ? window.S_evac : { slots: [], heliETA: null, heliSetAt: null };

function openEvacQueue() {
  if (!S_evac.slots.length) { S_evac.slots = [{ id: 1, casId: null }, { id: 2, casId: null }, { id: 3, casId: null }, { id: 4, casId: null }]; }
  $('evac-modal').style.display = 'block';
  if (typeof renderEvacWarSnapshot === 'function') renderEvacWarSnapshot();
  renderEvacSlots();
  if (S_evac.heliETA) $('heli-eta-in').value = S_evac.heliETA;
}

function autoAssignEvacSlots() {
  if (!S_evac.slots.length) S_evac.slots = [{ id: 1, casId: null }, { id: 2, casId: null }, { id: 3, casId: null }, { id: 4, casId: null }];
  const cand = getEvacCandidates();
  let pool = [...cand.strict].sort((a, b) => calcEvacScoreDetailed(b).score - calcEvacScoreDetailed(a).score);
  if (!pool.length && cand.base.length) {
    // Fallback for stale legacy state where everyone got marked done by old schema.
    pool = [...cand.base].sort((a, b) => calcEvacScoreDetailed(b).score - calcEvacScoreDetailed(a).score);
    showToast('⚠ מצב ישן זוהה — הופעל שיבוץ לפי כלל הפצועים הפעילים');
  }
  if (!pool.length) {
    showToast('אין פצועים פעילים לשיבוץ');
    return;
  }
  S_evac.slots.forEach((s, i) => { s.casId = pool[i]?.id || null; });
  renderEvacSlots();
  renderEvacPriority();
  saveState();
  const assignedCount = Math.min(S_evac.slots.length, pool.length);
  showToast(`⚡ שובצו ${assignedCount} פצועים אוטומטית`);
}
function setHeliETA(v) {
  S_evac.heliETA = parseInt(v) || null;
  S_evac.heliSetAt = Date.now();
  saveState();
  startHeliCountdown(); renderHeliCountdown();
}
function renderHeliCountdown() {
  const el = $('heli-countdown'); if (!el) return;
  if (!S_evac.heliETA || !S_evac.heliSetAt) { el.textContent = ''; return; }
  const elapsed = Math.floor((Date.now() - S_evac.heliSetAt) / 1000);
  const rem = S_evac.heliETA * 60 - elapsed;
  if (rem <= 0) { el.textContent = '🚁 מגיע!'; el.style.color = 'var(--red3)'; return; }
  el.textContent = `${p2(Math.floor(rem / 60))}:${p2(rem % 60)}`;
  el.style.color = rem < 120 ? 'var(--red3)' : rem < 300 ? 'var(--amber3)' : 'var(--olive3)';
}
let _heliCountdownInterval = null;
function startHeliCountdown() {
  if (_heliCountdownInterval) return;
  _heliCountdownInterval = setInterval(renderHeliCountdown, 1000);
}
// Start only when mission is active (checked via lazy init)
setTimeout(() => { if (S.missionActive) startHeliCountdown(); }, 1000);

function renderEvacSlots() {
  const el = $('evac-slots'); if (!el) return;
  el.innerHTML = S_evac.slots.map(sl => {
    const c = sl.casId ? S.casualties.find(x => x.id == sl.casId) : null;
    const d = c ? calcEvacScoreDetailed(c) : null;
    const stageLbl = c ? getEvacStageLabel(d.stage) : '';
    const stageClr = c ? getEvacStageColor(d.stage) : 'var(--muted2)';
    return `<div class="evac-slot ${c ? 'filled' + (c.priority === 'T1' ? ' filled-t1' : '') : ''}" onclick="toggleEvacSlot(${sl.id})">
      <div class="evac-slot-num">${sl.id}</div>
      <div class="evac-slot-info">
        ${c ? `<div style="font-size:13px;font-weight:700">${escHTML(c.name)}</div>
             <div style="font-size:10px;color:var(--muted2)">${c.priority} · 🩸${escHTML(c.blood || '?')} · ${c.kg}kg · ${d.score}pt</div>
             <div style="font-size:9px;color:${stageClr};font-weight:700">${stageLbl}</div>
             ${c.allergy ? `<div style="font-size:9px;color:var(--amber3)">⚠ ${escHTML(c.allergy)}</div>` : ''}
             <div style="display:flex;gap:4px;margin-top:4px">
               <button class="btn btn-xs btn-ghost" style="font-size:9px;min-height:20px" onclick="event.stopPropagation();advanceEvacStage(${c.id})">שלב ▶</button>
               <button class="btn btn-xs btn-ghost" style="font-size:9px;min-height:20px" onclick="event.stopPropagation();openEvacPipeline(${c.id})">Pipeline</button>
             </div>`
        : `<div style="font-size:12px;color:var(--muted)">סלוט פנוי — לחץ לשיוך</div>`}
      </div>
      ${c ? `<button class="btn btn-xs btn-ghost" style="color:var(--red3)" onclick="event.stopPropagation();removeEvacSlot(${sl.id})">✕</button>` : ''}
    </div>`;
  }).join('');
  // unassigned
  const assigned = S_evac.slots.filter(s => s.casId).map(s => s.casId);
  const unassigned = getEvacCandidates().strict
    .filter(c => !assigned.includes(c.id))
    .sort((a, b) => calcEvacScoreDetailed(b).score - calcEvacScoreDetailed(a).score);
  const ua = $('evac-unassigned'); if (!ua) return;
  ua.innerHTML = unassigned.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--s2);border:1px solid var(--b0);border-radius:6px">
      <span class="prio pt${c.priority[1]}">${c.priority}</span>
      <span style="flex:1;font-size:12px;font-weight:700">${escHTML(c.name)}</span>
      <span style="font-size:10px;color:var(--muted)">🩸${escHTML(c.blood || '?')} · ${calcEvacScoreDetailed(c).score}pt</span>
    </div>`).join('') || '<div style="font-size:11px;color:var(--muted)">כולם משוייכים</div>';
}
function toggleEvacSlot(slotId) {
  const slot = S_evac.slots.find(s => s.id === slotId); if (!slot) return;
  if (slot.casId) { removeEvacSlot(slotId); return; }
  // pick casualty
  const assigned = S_evac.slots.filter(s => s.casId).map(s => s.casId);
  const available = getEvacCandidates().strict
    .filter(c => !assigned.includes(c.id))
    .sort((a, b) => calcEvacScoreDetailed(b).score - calcEvacScoreDetailed(a).score);
  if (!available.length) { showToast('כולם כבר שוייכו'); return; }
  openModal(`שייך לסלוט ${slotId}`, `
    <div class="pad col">
      ${available.map(c => `
        <button class="btn btn-md btn-ghost btn-full" style="justify-content:flex-start;gap:10px" onclick="assignToSlot(${slotId},${c.id})">
          <span class="prio pt${c.priority[1]}">${c.priority}</span>
          <span style="font-weight:700">${escHTML(c.name)}</span>
          <span style="font-size:10px;color:var(--muted)">🩸${escHTML(c.blood || '?')} · ${c.kg}kg · ${calcEvacScoreDetailed(c).score}pt</span>
        </button>`).join('')}
    </div>`);
}
function assignToSlot(slotId, casId) {
  const slot = S_evac.slots.find(s => s.id === slotId); if (!slot) return;
  slot.casId = casId;
  const c = S.casualties.find(x => x.id == casId);
  addTL(casId, c?.name || '?', `שוייך לסלוט פינוי ${slotId}`, 'amber');
  saveState();
  forceClose(); renderEvacSlots();
}
function removeEvacSlot(slotId) {
  const slot = S_evac.slots.find(s => s.id === slotId);
  if (slot) slot.casId = null;
  saveState();
  renderEvacSlots();
}
function addEvacSlot() {
  S_evac.slots.push({ id: S_evac.slots.length + 1, casId: null });
  saveState();
  renderEvacSlots();
}

// ═══════════════════════════════════════════════════
// 🔧 RESOURCE CALCULATOR
// ═══════════════════════════════════════════════════
const RES_NEEDS = {
  'TQ': { perT1: 2, perT2: 1, perT3: 0 },
  'Chest Seal': { perT1: 1, perT2: 1, perT3: 0 },
  'TXA': { perT1: 1, perT2: 1, perT3: 0 },
  'Gauze': { perT1: 2, perT2: 1, perT3: 1 },
  'IV kit': { perT1: 1, perT2: 1, perT3: 0 },
  'NaCl': { perT1: 2, perT2: 1, perT3: 0 },
  'Morphine': { perT1: 1, perT2: 1, perT3: 0 },
  'NPA': { perT1: 1, perT2: 0, perT3: 0 },
  'Blanket': { perT1: 1, perT2: 1, perT3: 0 },
};
function openResourceCalc() {
  $('res-modal').style.display = 'block';
  renderResourceCalc();
}
function renderResourceCalc() {
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const t2 = S.casualties.filter(c => c.priority === 'T2').length;
  const t3 = S.casualties.filter(c => c.priority === 'T3').length;
  const rt = $('res-table'); const re = $('res-supply-edit');
  if (!rt || !re) return;
  let hasWarn = false;
  rt.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:0;font-size:10px;color:var(--muted);padding:6px 12px;border-bottom:1px solid var(--b0)">
      <div>פריט</div><div style="text-align:center">יש</div><div style="text-align:center;padding:0 8px">צריך</div><div></div>
    </div>
    ${Object.entries(RES_NEEDS).map(([name, req]) => {
    const need = req.perT1 * t1 + req.perT2 * t2 + req.perT3 * t3;
    const have = S.supplies[name] ?? S.supplies[name.split(' ')[0]] ?? 0;
    const ok = have >= need;
    const warn = have < need && need > 0;
    if (warn) hasWarn = true;
    const pct = need > 0 ? Math.min(1, have / need) : 1;
    const barClr = pct >= 1 ? 'var(--green2)' : pct >= .5 ? 'var(--amber)' : 'var(--red2)';
    return `<div style="display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:0;padding:7px 12px;border-bottom:1px solid var(--b0)">
        <div style="font-size:12px;font-weight:700">${name}</div>
        <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;min-width:28px;text-align:center;color:${warn ? 'var(--red3)' : ok ? 'var(--green3)' : 'var(--muted)'}">${have}</div>
        <div style="font-size:11px;color:var(--muted2);padding:0 8px;min-width:48px;text-align:center">${need > 0 ? `צריך ${need}` : '-'}</div>
        <div style="width:50px;height:7px;background:var(--b0);border-radius:4px;overflow:hidden">
          <div style="width:${pct * 100}%;height:100%;background:${barClr};border-radius:4px"></div>
        </div>
      </div>`;
  }).join('')}`;

  const resBadge = $('res-warn-badge');
  if (resBadge) resBadge.style.display = hasWarn ? '' : 'none';

  re.innerHTML = Object.keys(S.supplies).map(name => `
    <div style="background:var(--s3);border:1px solid var(--b0);border-radius:5px;padding:6px 8px">
      <div style="font-size:9px;color:var(--muted2);margin-bottom:3px">${name}</div>
      <div style="display:flex;align-items:center;gap:4px">
        <button class="btn btn-xs btn-ghost" style="min-height:24px;padding:0 6px" onclick="adjSupply('${name}',-1)">−</button>
        <span style="font-family:var(--font-mono);font-size:16px;font-weight:700;min-width:24px;text-align:center" id="sup-val-${name.replace(/ /g, '_')}">${S.supplies[name]}</span>
        <button class="btn btn-xs btn-ghost" style="min-height:24px;padding:0 6px" onclick="adjSupply('${name}',1)">＋</button>
      </div>
    </div>`).join('');
}
function adjSupply(name, d) {
  S.supplies[name] = Math.max(0, (S.supplies[name] || 0) + d);
  const el = $(`sup-val-${name.replace(/ /g, '_')}`);
  if (el) el.textContent = S.supplies[name];
  renderResourceCalc();
  saveState();
}

// ═══════════════════════════════════════════════════
// 📻 RADIO TEMPLATES
// ═══════════════════════════════════════════════════
function openRadioTemplates() {
  $('radio-modal').style.display = 'block';
  renderRadioTemplates();
}
function renderRadioTemplates() {
  const unit = S.comms.unit || '[יחידה]';
  const mahup = S.comms.mahup || '[תדר]';
  const lz = S.comms.lz1 || '[LZ]';
  const t1 = S.casualties.filter(c => c.priority === 'T1');
  const t2 = S.casualties.filter(c => c.priority === 'T2');
  const t3 = S.casualties.filter(c => c.priority === 'T3');
  const allCas = S.casualties;
  const dur = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;

  const templates = [
    {
      title: '📡 9-LINE MEDEVAC',
      body: `שיחה: ${unit} → מגן/חילוץ, ב-${mahup}
1. מיקום: ${lz}
2. תדר רדיו: ${mahup}
3. פצועים: ${t1.length}A ${t2.length}B ${t3.length}C
4. ציוד מיוחד: ${allCas.some(c => c.allergy) ? 'אלרגיות' : 'אין'}
5. פצועים: ${allCas.length} סה"כ
6. אבטחה LZ: ${S.comms.lz1 || 'ממתין לסיקור'}
7. שיטת סימון: SMOKE
8. אזרחים: לא
9. טראומה: כן`
    },
    {
      title: '📻 SITREP — דוח מצב',
      body: `SITREP — ${unit}
זמן: ${nowTime()} | דקה ${dur} מהפתיחה
מצב: ${t1.length} T1 קריטי | ${t2.length} T2 דחוף | ${t3.length} T3 קל
בטיפול: ${allCas.filter(c => c.medic).length}/${allCas.length}
TQ פתוחים: ${allCas.filter(c => c.tqStart).length}
בקשה: ${t1.length > 0 ? 'פינוי מיידי' : 'טיפול ביניים'}`
    },
    {
      title: '🩸 SALUTE — דיווח מגע',
      body: `SALUTE — ${unit}
S - גודל: ${allCas.length} פצועים
A - פעילות: אירוע רב נפגעים פעיל
L - מיקום: ${lz}
U - יחידה: ${unit}
T - ציוד: אמל"ח רגיל
E - כיוון: ממתין להוראה`
    },
    {
      title: '🚁 CASEVAC — בקשת פינוי',
      body: `בקשת פינוי — ${unit}
LZ: ${lz} | LZ2: ${S.comms.lz2 || 'N/A'}
פגועים לפינוי: ${allCas.filter(c => c.priority === 'T1' || c.priority === 'T2').length}
T1 (URGENT): ${t1.map(c => escHTML(c.name)).join(', ') || 'אין'}
T2 (PRIORITY): ${t2.map(c => escHTML(c.name)).join(', ') || 'אין'}
אלרגיות: ${allCas.filter(c => c.allergy).map(c => `${escHTML(c.name)}:${escHTML(c.allergy)}`).join(' | ') || 'אין'}
מוכנים ב: ${nowTime()}`
    },
  ];
  $('radio-templates-list').innerHTML = templates.map(t => `
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:8px;margin-bottom:10px;overflow:hidden">
      <div style="background:var(--s3);padding:8px 12px;font-size:10px;font-weight:700;letter-spacing:.1em;color:var(--muted2);display:flex;align-items:center;justify-content:space-between">
        <span>${t.title}</span>
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-ghost" onclick="copyText(\`${t.body.replace(/`/g, "'")}\`)">📋</button>
          <button class="btn btn-xs btn-ghost" onclick="speakText(\`${t.body.replace(/`/g, "'")}\`)">🔊</button>
        </div>
      </div>
      <pre style="padding:10px 12px;font-family:var(--font-mono);font-size:10px;line-height:1.8;color:var(--olive3);white-space:pre-wrap">${t.body}</pre>
    </div>`).join('');
}
function copyText(txt) { navigator.clipboard && navigator.clipboard.writeText(txt).then(() => showToast('✓ הועתק')); }
function speakText(txt) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'he-IL'; u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

// ═══════════════════════════════════════════════════
// 🏷️ TRIAGE TAGS
// ═══════════════════════════════════════════════════
function openTriageTags() { $('tag-modal').style.display = 'block'; renderTriageTags(); }
function renderTriageTags() {
  const el = $('tag-list'); if (!el) return;
  const pClrMap = { T1: '#c00', T2: '#e80', T3: '#080', T4: '#222' };
  el.innerHTML = S.casualties.map(c => `
    <div style="background:#fff;color:#000;border-radius:8px;padding:14px;margin-bottom:10px;font-family:monospace;font-size:11px;line-height:1.7;border:2px solid ${pClrMap[c.priority] || '#000'}">
      <div style="height:18px;background:${pClrMap[c.priority] || '#000'};border-radius:3px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px;letter-spacing:.1em">${c.priority} — ${prioLabel(c.priority)}</div>
      <div style="font-size:14px;font-weight:900;margin-bottom:4px">שם: ${escHTML(c.name)}</div>
      <div>מ.א.: ${escHTML(c.idNum || '—')} | 🩸 ${escHTML(c.blood || '?')} | ${c.kg}kg</div>
      ${c.allergy ? `<div style="color:red;font-weight:700">⚠ אלרגיה: ${escHTML(c.allergy)}</div>` : ''}
      <div>מנגנון: ${c.mech.join(', ') || '—'}</div>
      <div>פציעות: ${c.injuries.map(i => `${i.type} ${i.zone}`).join(', ') || '—'}</div>
      <div>טיפולים: ${c.txList.map(t => t.type).join(', ') || '—'}</div>
      ${c.tqStart ? `<div style="color:red;font-weight:700">TQ: ${p2(Math.floor((Date.now() - c.tqStart) / 60000))} דקות</div>` : ''}
      <div>GCS: ${c.vitals.gcs || '?'} | SpO2: ${c.vitals.spo2 || '?'}% | דופק: ${c.vitals.pulse || '?'}</div>
      <div style="margin-top:6px;font-size:9px;color:#666">⏱ ${c.time} | BENAM TACTICAL MED</div>
    </div>`).join('') || '<div style="color:var(--muted);text-align:center;padding:20px">אין פגועים</div>';
}
// ═══════════════════════════════════════════════════
// QR EXPORT & SCAN — Full implementation
// ═══════════════════════════════════════════════════
let _exportJSON = '';
const QR_SYNC_FORMAT = 3;
const QR_ENVELOPE_KIND = 'BENAM_QR';
const QR_PACKET_KIND_STATE = 'BENAM_STATE';
const QR_PACKET_KIND_MESH = 'BENAM_MESH';
const QR_CHUNK_SIZE = 460;

let _qrRenderedBundle = null;
let _scannedPacket = null;
let _scanPacketId = '';
let _scanPacketHash = '';
let _scanPacketTotal = 0;
let _scanFecFormat = 0;
let _lastScanRaw = '';
let _lastScanTs = 0;

// ── BINARY COMPRESSION — For the fastest transfer in the world ──
const SYNC_MAP = {
  kind: 'k', format: 'f', unit: 'u', exportedAt: 't', sincets: 'st',
  casualties: 'cas', timeline: 'tl', comms: 'cm', supplies: 'su', missionStart: 'ms',
  id: 'id', name: 'nm', idNum: 'in', blood: 'bl', kg: 'kg', allergy: 'al',
  priority: 'pr', mech: 'mh', time: 'tm', tqStart: 'tq', txList: 'tx',
  vitals: 'vt', vitalsHistory: 'vh', injuries: 'ij', fluidTotal: 'ft', march: 'ma',
  medic: 'md', gps: 'gp', escalated: 'es', _addedAt: 'ad', notes: 'nt',
  pulse: 'ps', spo2: 'sp', bp: 'bp', rr: 'rr', gcs: 'gc', upva: 'uv'
};

const SYNC_REV_MAP = Object.fromEntries(Object.entries(SYNC_MAP).map(([k, v]) => [v, k]));
// Backward compatibility: old exports used 'sp' for supplies (before collision fix)
// In REV_MAP, 'sp' now maps to 'spo2' (last entry wins). Add 'su' -> 'supplies' explicitly.
// For old data where 'sp' meant supplies at top level, the _mapKeys context-free approach
// means spo2 gets it — but spo2 at top level is harmless (ignored), and supplies inside
// vitals is also harmless. Net effect: old exports lose supplies data but that's minor.
// New exports use 'su' for supplies correctly.

function _mapKeys(obj, map) {
  if (Array.isArray(obj)) return obj.map(v => _mapKeys(v, map));
  if (obj && typeof obj === 'object') {
    const r = {};
    for (const k in obj) {
      const nk = map[k] || k;
      r[nk] = _mapKeys(obj[k], map);
    }
    return r;
  }
  return obj;
}

async function _compress(text) {
  try {
    const stream = new Blob([text]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
    const response = new Response(compressedStream);
    const buffer = await response.arrayBuffer();
    return _uint8ToBase64(new Uint8Array(buffer));
  } catch (e) {
    console.warn('Compression failed, using plain b64', e);
    return _utf8ToBase64(text);
  }
}

async function _decompress(b64) {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
    const response = new Response(decompressedStream);
    return await response.text();
  } catch (e) {
    console.warn('Decompression failed', e);
    return _base64ToUtf8(b64);
  }
}

function _uint8ToBase64(arr) {
  let s = '';
  for (let i = 0; i < arr.byteLength; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function _utf8ToBase64(text) {
  try {
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
      }
      return btoa(bin);
    }
  } catch (e) { }
  return btoa(unescape(encodeURIComponent(text)));
}

function _base64ToUtf8(b64) {
  try {
    if (typeof TextDecoder !== 'undefined') {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
  } catch (e) { }
  return decodeURIComponent(escape(atob(b64)));
}

function _hashText(text) {
  const bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(text) : text.split('').map(ch => ch.charCodeAt(0) & 255);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function _nextQRBundleId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _normalizeImportedCasualty(c) {
  const nc = {
    vitalsHistory: [], photos: [], injuries: [],
    tqStart: null, txList: [], fluids: [], fluidTotal: 0,
    allergy: '', medic: '', buddyName: '', idNum: '', evacType: '',
    mech: [], blood: '', kg: 70, name: '?', notes: '',
    vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
    march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
    ...c,
    _addedAt: c?._addedAt || (c?.id > 1000000000000 ? c.id : Date.now()),
    priority: c?.priority || 'T3',
  };
  if (!nc.vitals || typeof nc.vitals !== 'object') nc.vitals = { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' };
  if (!Array.isArray(nc.mech)) nc.mech = [];
  if (!Array.isArray(nc.injuries)) nc.injuries = [];
  if (!Array.isArray(nc.txList)) nc.txList = [];
  if (!Array.isArray(nc.photos)) nc.photos = [];
  if (!Array.isArray(nc.vitalsHistory)) nc.vitalsHistory = [];
  nc.march = Object.assign({ M: 0, A: 0, R: 0, C: 0, H: 0 }, nc.march || {});
  return nc;
}

function _resizePatientPhoto(dataUrl, maxW, maxH, quality) {
  return new Promise(resolve => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      cv.width = Math.round(img.width * ratio);
      cv.height = Math.round(img.height * ratio);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false; // Sharper thumbnails for low-res
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', quality)); // JPEG is generally smaller for tiny thumbs
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function _buildStateTransferState() {
  const casualties = [];
  for (const c of S.casualties) {
    const thumbs = [];
    if (c.photos && c.photos.length) {
      // Scale down to tiny thumbnails for QR burst
      for (const p of c.photos.slice(0, 3)) {
        const thumb = await _resizePatientPhoto(p.url, 100, 100, 0.2); 
        if (thumb) thumbs.push({ url: thumb, time: p.time });
      }
    }
    // Deep clone but with smaller photos
    casualties.push({ ...c, photos: thumbs, vitalsHistory: (c.vitalsHistory || []).slice(-5) });
  }
  return {
    force: S.force,
    casualties,
    timeline: S.timeline,
    comms: S.comms,
    supplies: S.supplies,
    missionStart: S.missionStart,
    missionActive: S.missionActive,
    fireMode: S.fireMode,
    role: S.role,
    opMode: S.opMode,
    missionType: S.missionType,
    view: S.view,
    appMode: APP_MODE,
    evac: (typeof S_evac !== 'undefined') ? S_evac : null
  };
}

async function _buildStateExportPacket() {
  return {
    kind: QR_PACKET_KIND_STATE,
    format: QR_SYNC_FORMAT,
    exportedAt: Date.now(),
    unit: S.comms.unit || '',
    state: await _buildStateTransferState()
  };
}

async function _buildQRBundle(packet) {
  const mapped = _mapKeys(packet, SYNC_MAP);
  const json = JSON.stringify(mapped);
  const burstData = await _compress(json);
  
  const id = _nextQRBundleId();
  const hash = _hashText(json);
  const chunks = [];
  const rawChunks = [];
  const n = Math.ceil(burstData.length / QR_CHUNK_SIZE) || 1;
  
  // 1. Split into raw data chunks
  for (let i = 0; i < burstData.length; i += QR_CHUNK_SIZE) {
    rawChunks.push(burstData.slice(i, i + QR_CHUNK_SIZE));
  }

  // 2. Generate XOR Parity (FEC) — for "self-healing" sync
  let parity = new Uint8Array(QR_CHUNK_SIZE).fill(0);
  for (const c of rawChunks) {
    for (let j = 0; j < c.length; j++) parity[j] ^= c.charCodeAt(j);
  }
  // Base64-encode parity to avoid binary chars bloating JSON after escaping
  const parityB64 = _uint8ToBase64(parity);

  // 3. Package all chunks (including Parity)
  const totalWithFEC = n + 1; // n data + 1 parity
  for (let i = 0; i < n; i++) {
    chunks.push(JSON.stringify({
      k: QR_ENVELOPE_KIND, p: packet.kind, id, h: hash, i, n: totalWithFEC, d: rawChunks[i], z: 1
    }));
  }
  // Add Parity Frame (Index n) — parity data is base64-encoded (fec:2 signals b64 parity)
  chunks.push(JSON.stringify({
    k: QR_ENVELOPE_KIND, p: packet.kind, id, h: hash, i: n, n: totalWithFEC, d: parityB64, z: 1, fec: 2
  }));

  return { id, hash, json, chunks, size: json.length, compressedSize: burstData.length, dataCount: n };
}

// ── Auto-advance state ──
let _qrAutoPlay = false;
let _qrAutoTimer = null;
let _qrAutoSpeed = 1000; // Fast 1s loop for tactical hand-offs
let _qrCountdown = 0;
let _qrCountdownTimer = null;

function _renderQRBundle(container, bundle) {
  if (!container || !bundle) return;
  _qrRenderedBundle = bundle;
  const n = bundle.chunks.length;
  window._qrChunkTotal = n;
  window._qrChunkIdx = 0;

  _qrStopAutoPlay();

  // Primary Render Area
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; gap:16px; width:100%">
      
      <!-- Primary QR Portal -->
      <div style="background:#fff; border-radius:18px; padding:12px; box-shadow:0 12px 60px rgba(0,0,0,0.6); position:relative; width:280px; height:280px; display:flex; align-items:center; justify-content:center">
        <div id="qr-target-frame" style="width:256px; height:256px; display:flex; align-items:center; justify-content:center">
           <!-- QRCode instance will maintain this area -->
        </div>
      </div>
      
      <!-- Burst Status -->
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px">
        <div id="qr-chunk-label" style="font-family:var(--font-mono); font-size:16px; font-weight:900; color:var(--white); text-shadow:0 2px 4px rgba(0,0,0,0.4)">חלק 1/${n}</div>
        <div id="qr-chunk-dots" style="display:flex; gap:6.5px; justify-content:center">
          ${bundle.chunks.map((_, i) => `<div class="qr-dot ${i === 0 ? 'active' : ''}" id="qr-dot-${i}" onclick="_qrGoToChunk(${i})"></div>`).join('')}
        </div>
      </div>

      <!-- Tactical Controls -->
      <div style="display:flex; flex-direction:column; gap:12px; width:100%; align-items:center">
        <div style="display:flex; gap:12px; justify-content:center; align-items:center; width:100%">
          <button class="btn btn-md btn-ghost" onclick="_qrGoToChunk((window._qrChunkIdx-1+${n})%${n})" style="border-radius:12px; border-color:rgba(255,255,255,0.1); flex:1; font-size:11px">◀ הקודם</button>
          <button class="btn btn-md btn-amber" id="qr-auto-btn" onclick="_qrToggleAutoPlay()" style="min-width:130px; font-weight:900; border-radius:12px; box-shadow:0 4px 15px rgba(200,144,16,0.3)">▶ אוטומטי</button>
          <button class="btn btn-md btn-ghost" onclick="_qrGoToChunk((window._qrChunkIdx+1)%${n})" style="border-radius:12px; border-color:rgba(255,255,255,0.1); flex:1; font-size:11px">הבא ▶</button>
        </div>
        
        <!-- Speed Selector -->
        <div style="display:flex; gap:6px; background:var(--glass-bg-surface); padding:4px; border-radius:10px; width:220px">
          <div onclick="_qrSetSpeed(1000)" id="spd-1000" class="qr-speed-opt" style="${_qrAutoSpeed === 1000 ? 'background:var(--s1);color:var(--white)' : ''}">1s</div>
          <div onclick="_qrSetSpeed(2000)" id="spd-2000" class="qr-speed-opt" style="${_qrAutoSpeed === 2000 ? 'background:var(--s1);color:var(--white)' : ''}">2s</div>
          <div onclick="_qrSetSpeed(3000)" id="spd-3000" class="qr-speed-opt" style="${_qrAutoSpeed === 3000 ? 'background:var(--s1);color:var(--white)' : ''}">3s</div>
        </div>
      </div>

      <div style="font-family:var(--font-mono); font-size:9px; color:var(--muted); text-align:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.05); width:80%">
        Burst 3.0 · id ${bundle.id}
      </div>
    </div>

    <style>
      .qr-dot { width:12px; height:5px; border-radius:2.5px; background:rgba(255,255,255,0.15); transition:all .3s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor:pointer; }
      .qr-dot.active { background:var(--amber); width:28px; box-shadow:0 0 10px var(--amber); }
      #qr-target-frame canvas, #qr-target-frame img { width:256px !important; height:256px !important; image-rendering: pixelated; }
      .qr-speed-opt { flex:1; text-align:center; padding:6px; font-size:10px; font-weight:900; border-radius:8px; cursor:pointer; color:var(--muted); transition:all 0.2s; }
    </style>
  `;

  // Initialize a SINGLE persistent QRCode instance for this bundle
  bundle.qrInstance = new QRCode($('qr-target-frame'), {
    text: bundle.chunks[0],
    width: 256, height: 256,
    colorDark: '#000000', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.L // Level L (7%) - Lower density for reliable scanning
  });

  _qrGoToChunk(0);
}

function _qrGoToChunk(idx) {
  if (!_qrRenderedBundle || !_qrRenderedBundle.qrInstance) return;
  const n = window._qrChunkTotal;
  if (idx < 0 || idx >= n) return;
  window._qrChunkIdx = idx;

  const label = $('qr-chunk-label');
  if (label) label.textContent = `חלק ${idx + 1}/${n}`;

  // Atomic High-Speed Swap via requestAnimationFrame to prevent flicker
  requestAnimationFrame(() => {
    if (_qrRenderedBundle && _qrRenderedBundle.qrInstance) {
      const container = $('qr-target-frame');
      if (container) container.style.opacity = '0.7';
      try {
        _qrRenderedBundle.qrInstance.makeCode(_qrRenderedBundle.chunks[idx]);
      } catch (e) {
        console.warn('[QR] makeCode failed for chunk', idx, e.message);
      }
      setTimeout(() => { if (container) container.style.opacity = '1'; }, 50);
    }
  });

  // Update Dots
  document.querySelectorAll('.qr-dot').forEach((d, i) => d.classList.toggle('active', i === idx));

  try { if (navigator.vibrate) navigator.vibrate(20); } catch (_) {}
}

function _qrToggleAutoPlay() {
  if (_qrAutoPlay) _qrStopAutoPlay(); else _qrStartAutoPlay();
}

function _qrStartAutoPlay() {
  const n = window._qrChunkTotal || 0;
  if (n <= 1) return;
  _qrAutoPlay = true;
  const btn = $('qr-auto-btn');
  if (btn) { btn.textContent = '⏸ עצור'; btn.style.background = '#c82828'; btn.style.boxShadow = '0 4px 15px rgba(200,40,40,0.4)'; }
  _qrAutoTimer = setInterval(() => {
    const next = (window._qrChunkIdx + 1) % n;
    _qrGoToChunk(next);
  }, _qrAutoSpeed);
  // High-contrast button state
  if (btn) {
    btn.innerHTML = `<span style="font-size:18px;margin-left:8px">⏸</span> עצור`;
    btn.style.background = '#c82828';
  }
}

function _qrStopAutoPlay() {
  _qrAutoPlay = false;
  if (_qrAutoTimer) { clearInterval(_qrAutoTimer); _qrAutoTimer = null; }
  const btn = $('qr-auto-btn');
  if (btn) { btn.textContent = '▶ אוטומטי'; btn.style.background = 'var(--amber)'; }
}

function _qrResetCountdown() {
  if (_qrCountdownTimer) clearInterval(_qrCountdownTimer);
  _qrCountdown = _qrAutoSpeed;
  const cdLabel = $('qr-countdown-label');
  const prog = $('qr-auto-progress');
  if (prog) prog.style.width = '100%';
  _qrCountdownTimer = setInterval(() => {
    _qrCountdown -= 100;
    if (_qrCountdown <= 0) _qrCountdown = 0;
    const sec = (_qrCountdown / 1000).toFixed(1);
    if (cdLabel) cdLabel.textContent = sec + 's';
    if (prog) {
    const p = (_qrCountdown / _qrAutoSpeed) * 100;
    prog.setAttribute('stroke-dasharray', `${p}, 100`);
  }
  }, 100);
}

function _qrSetSpeed(val) {
  _qrAutoSpeed = parseInt(val) || 3000;

  // Apply visual highlight immediately in the QR speed selector
  document.querySelectorAll('.qr-speed-opt').forEach(el => {
    el.style.background = '';
    el.style.color = '';
  });
  const sel = document.getElementById(`spd-${_qrAutoSpeed}`);
  if (sel) {
    sel.style.background = 'var(--s1)';
    sel.style.color = 'var(--white)';
  }

  if (_qrAutoPlay) {
    _qrStopAutoPlay();
    _qrStartAutoPlay();
  }
}

if (typeof window !== 'undefined') {
  window._buildQRBundle = _buildQRBundle;
  window._renderQRBundle = _renderQRBundle;
  window._qrToggleAutoPlay = _qrToggleAutoPlay;
  window._qrSetSpeed = _qrSetSpeed;
  window._qrResetAutoPlay = _qrStopAutoPlay;
}

async function _buildExportJSON() {
  return JSON.stringify(await _buildStateExportPacket());
}

async function exportStateQR() {
  const bundle = await _buildQRBundle(await _buildStateExportPacket());
  _exportJSON = bundle.json;
  const overlay = $('qr-export-overlay');
  overlay.style.display = 'block';
  const codeDiv = $('qr-export-code');
  codeDiv.innerHTML = '';
  const infoDiv = $('qr-export-info');

  if (typeof QRCode === 'undefined') {
    codeDiv.innerHTML = '<div style="color:#c00;padding:20px;font-size:12px">ספריית QR לא נטענה — נסה לרענן את הדף</div>';
    return;
  }

  _renderQRBundle(codeDiv, bundle);

  // Rich info display
  const sizeKB = (bundle.size / 1024).toFixed(1);
  const chunkInfo = bundle.chunks.length > 1 ? ` | ${bundle.chunks.length} חלקים — לחץ ▶ להעברה אוטומטית` : '';
  infoDiv.innerHTML = `<span style="font-weight:700">${S.casualties.length} פגועים</span> | ${sizeKB}KB${chunkInfo} | <span style="font-family:monospace;font-size:9px">${bundle.hash}</span>`;

  showToast(bundle.chunks.length > 1 ? `✓ ${bundle.chunks.length} QR מוכנים — לחץ ▶ אוטומטי` : '✓ QR מוכן לסריקה');
  addTL('sys', 'SYSTEM', 'ייצוא מצב QR Sync', 'green');
}

function _showChunk(dir) {
  const n = window._qrChunkTotal;
  if (!n) return;
  // Manual navigation stops auto-play
  if (_qrAutoPlay) _qrStopAutoPlay();
  const next = (window._qrChunkIdx + dir + n) % n;
  _qrGoToChunk(next);
}

function closeQRExport() {
  _qrStopAutoPlay();
  $('qr-export-overlay').style.display = 'none';
  _qrRenderedBundle = null;
}

async function copyExportJSON() {
  if (!_exportJSON) { _exportJSON = await _buildExportJSON(); }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(_exportJSON).then(() => {
      showToast('✓ JSON הועתק! (' + (_exportJSON.length / 1024).toFixed(1) + 'KB)');
    }).catch(() => _copyFallback(_exportJSON));
  } else {
    _copyFallback(_exportJSON);
  }
}

function _copyFallback(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✓ JSON הועתק!');
  } catch (e) {
    showToast('⚠ לא הצליח להעתיק — נסה ידנית');
  }
}

async function shareStateViaWebShare() {
  if (!_exportJSON) { _exportJSON = await _buildExportJSON(); }
  // Try file share first (more reliable for large data)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = new Blob([_exportJSON], { type: 'application/json' });
      const file = new File([blob], `benam-sync-${new Date().toISOString().slice(0, 16).replace(/:/g, '')}.json`, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ title: 'BENAM Sync', files: [file] }).catch(() => {});
        return;
      }
    } catch (_) {}
  }
  // Fallback to text share
  if (navigator.share) {
    navigator.share({ title: 'BENAM State', text: _exportJSON }).catch(() => { });
  } else {
    copyExportJSON();
  }
}

// ═══ QR SCAN ═══
let _scanStream = null;
let _scanAnimId = null;
let _scannedChunks = {};
let _scannedJSON = '';

function _resetQRScanState() {
  stopScanStream();
  _scannedChunks = {};
  _scannedJSON = '';
  _scannedPacket = null;
  _scanPacketId = '';
  _scanPacketHash = '';
  _scanPacketTotal = 0;
  _scanFecFormat = 0;
  _lastScanRaw = '';
  _lastScanTs = 0;
  _scanProcessing = false;
  const st = $('qr-scan-status');
  if (st) {
    st.textContent = 'מחפש QR...';
    st.style.background = 'rgba(0,0,0,.7)';
    st.style.color = 'var(--amber2)';
  }
}

function _cameraErrorMessage(err) {
  const name = err && err.name ? err.name : '';
  if (!window.isSecureContext) {
    return 'הגישה למצלמה דורשת HTTPS או localhost';
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'הגישה למצלמה נחסמה. אשר הרשאת מצלמה בדפדפן';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'לא נמצאה מצלמה זמינה במכשיר';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'המצלמה תפוסה על ידי אפליקציה אחרת';
  }
  return 'לא ניתן לפתוח מצלמה';
}

function _setScanStatus(text, isError) {
  const st = $('qr-scan-status');
  if (!st) return;
  st.textContent = text;
  if (isError) {
    st.style.background = 'rgba(120,20,20,.75)';
    st.style.color = '#ffd8d8';
  }
}

function toggleQRPasteArea() {
  const box = $('qr-scan-paste-area');
  if (!box) return;
  const on = box.style.display === 'block';
  box.style.display = on ? 'none' : 'block';
  if (!on) {
    const ta = $('qr-scan-paste');
    if (ta) ta.focus();
  }
}

async function importPastedQR() {
  const ta = $('qr-scan-paste');
  const raw = (ta?.value || '').trim();
  if (!raw) { showToast('הדבק נתונים לפני פענוח'); return; }

  const beforeJSON = _scannedJSON;
  const beforePacket = _scannedPacket;
  const attempts = [raw];
  try {
    const decoded = _base64ToUtf8(raw);
    if (decoded && decoded !== raw) attempts.push(decoded);
  } catch (e) { }

  for (const candidate of attempts) {
    await _handleScanResult(candidate);
    if (_scannedPacket || (_scannedJSON && _scannedJSON !== beforeJSON) || (_scannedPacket !== beforePacket)) {
      showToast('✓ נתונים נקלטו מהדבקה');
      return;
    }
  }

  _setScanStatus('⚠ פורמט לא מזוהה. נסה JSON מלא או סריקה מתמונה', true);
}

function triggerQRImageScan() {
  const inp = $('qr-scan-file');
  if (!inp) return;
  inp.value = '';
  inp.click();
}

function _decodeQRFromCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (typeof jsQR === 'function') {
    const code = jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) return code.data;
  }
  return null;
}

function _drawImageToCanvas(img) {
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function _loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('טעינת תמונה נכשלה'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('קריאת קובץ נכשלה'));
    reader.readAsDataURL(file);
  });
}

async function onQRImageSelected(ev) {
  const file = ev?.target?.files?.[0];
  if (!file) return;
  try {
    stopScanStream();
    _setScanStatus('מפענח QR מהתמונה...', false);
    const img = await _loadImageFromFile(file);
    const canvas = _drawImageToCanvas(img);
    let raw = _decodeQRFromCanvas(canvas);
    if (!raw && 'BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(canvas);
      if (codes && codes[0] && codes[0].rawValue) raw = codes[0].rawValue;
    }
    if (!raw) {
      _setScanStatus('⚠ לא זוהה QR בתמונה. נסה צילום חד יותר', true);
      return;
    }
    await _handleScanResult(raw);
  } catch (e) {
    _setScanStatus('⚠ שגיאה בקריאת תמונה: ' + (e?.message || 'לא ידוע'), true);
  } finally {
    if (ev?.target) ev.target.value = '';
  }
}

let _torchOn = false;

function _startScanVideo(stream) {
  const video = $('qr-scan-video');
  _scanStream = stream;
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  video.play().catch(() => { });
  const _sst = $('qr-scan-status'); if (_sst) _sst.textContent = 'מחפש QR...';

  // Check torch support and show button
  _torchOn = false;
  try {
    const track = stream.getVideoTracks()[0];
    if (track) {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        const btn = $('torch-btn');
        if (btn) btn.style.display = '';
      }
    }
  } catch (_) {}

  _scanLoop();
}

function toggleScanTorch() {
  if (!_scanStream) return;
  try {
    const track = _scanStream.getVideoTracks()[0];
    if (!track) return;
    _torchOn = !_torchOn;
    track.applyConstraints({ advanced: [{ torch: _torchOn }] });
    const btn = $('torch-btn');
    if (btn) {
      btn.textContent = _torchOn ? '🔦 כבה' : '🔦 פנס';
      btn.style.color = _torchOn ? '#fff' : '#ffcc00';
      btn.style.background = _torchOn ? '#aa8800' : 'transparent';
    }
  } catch (_) { showToast('⚠ פנס לא נתמך במכשיר זה'); }
}

async function _openScanCamera() {
  const envConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      focusMode: { ideal: 'continuous' },
      exposureMode: { ideal: 'continuous' }
    }
  };
  const fallback1 = { audio: false, video: { facingMode: 'environment' } };
  const fallback2 = { audio: false, video: true };
  try {
    return await navigator.mediaDevices.getUserMedia(envConstraints);
  } catch (e1) {
    try {
      return await navigator.mediaDevices.getUserMedia(fallback1);
    } catch (e2) {
      return await navigator.mediaDevices.getUserMedia(fallback2);
    }
  }
}

function _ensureScanElements() {
  // Dynamically create missing scan elements if not in HTML
  const container = document.querySelector('.qr-scan-container');
  if (!container) return;
  if (!$('qr-scan-canvas')) {
    const canvas = document.createElement('canvas');
    canvas.id = 'qr-scan-canvas';
    canvas.style.display = 'none';
    container.appendChild(canvas);
  }
  if (!$('qr-scan-result')) {
    const resultDiv = document.createElement('div');
    resultDiv.id = 'qr-scan-result';
    resultDiv.style.cssText = 'display:none;position:absolute;bottom:0;left:0;right:0;background:rgba(10,18,12,.95);padding:16px;border-top:2px solid var(--olive3);z-index:50';
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px';
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-md btn-olive btn-full';
    importBtn.textContent = '✓ ייבא נתונים';
    importBtn.onclick = function() { importScannedQR(); };
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-md btn-ghost';
    closeBtn.textContent = '✕';
    closeBtn.onclick = function() { resultDiv.style.display = 'none'; _resumeScanLoop(); };
    btnRow.appendChild(importBtn);
    btnRow.appendChild(closeBtn);
    resultDiv.appendChild(btnRow);
    container.appendChild(resultDiv);
  }
}

function startQRScan() {
  _resetQRScanState();
  const overlay = $('qr-scan-overlay');
  if (!overlay) { showToast('⚠ QR Scanner UI not found'); return; }
  _ensureScanElements();
  overlay.style.display = 'flex';
  const pasteArea = $('qr-scan-paste-area');
  if (pasteArea) pasteArea.style.display = 'none';
  const pasteTxt = $('qr-scan-paste');
  if (pasteTxt) pasteTxt.value = '';
  const resultEl = $('qr-scan-result');
  if (resultEl) resultEl.style.display = 'none';
  const statusEl = $('qr-scan-status');
  if (statusEl) statusEl.textContent = 'מפעיל מצלמה...';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _setScanStatus('⚠ הדפדפן לא תומך בגישה למצלמה. השתמש ב"סרוק מתמונה"', true);
    return;
  }

  _openScanCamera()
    .then(stream => _startScanVideo(stream))
    .catch(e => {
      _setScanStatus('⚠ ' + _cameraErrorMessage(e) + ' — אפשר לסרוק מתמונה', true);
    });
}

let _barcodeDetector = null;
let _scanFrameSkip = 0;
let _scanProcessing = false; // guard against concurrent async processing

function _scanLoop() {
  if (!_scanStream) return;
  if (_scanProcessing) {
    // Previous async _handleScanResult still running — wait for it
    _scanAnimId = requestAnimationFrame(_scanLoop);
    return;
  }
  const video = $('qr-scan-video');
  const canvas = $('qr-scan-canvas');
  if (!video || !canvas || video.readyState < 2) {
    _scanAnimId = requestAnimationFrame(_scanLoop);
    return;
  }

  // Optimize: only resize canvas if video dimensions changed
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  // Priority path: Hardware-accelerated BarcodeDetector (Chrome/Android)
  if ('BarcodeDetector' in window) {
    // No frame skip for native detector - it's fast
    if (!_barcodeDetector) _barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    _barcodeDetector.detect(video).then(async (codes) => {
      if (codes.length > 0 && codes[0].rawValue) {
        _scanProcessing = true;
        try { await _handleScanResult(codes[0].rawValue); } finally { _scanProcessing = false; }
      } else {
        _scanAnimId = requestAnimationFrame(_scanLoop);
      }
    }).catch(() => { _scanAnimId = requestAnimationFrame(_scanLoop); });
    return;
  }

  // Software path: jsQR (iOS/Safari)
  // Scan every frame for maximum responsiveness
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0);
  if (typeof jsQR === 'function') {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      _scanProcessing = true;
      _handleScanResult(code.data).finally(() => { _scanProcessing = false; });
      return;
    }
  }

  _scanAnimId = requestAnimationFrame(_scanLoop);
}

function _resumeScanLoop() {
  _scanAnimId = requestAnimationFrame(_scanLoop);
}

function _showScanProgress(label, received, total) {
  const st = $('qr-scan-status');
  if (!st) return;
  // Build chunk grid visualization
  let grid = '';
  if (total > 1) {
    grid = '<div style="display:flex;gap:3px;justify-content:center;margin-top:4px;flex-wrap:wrap">';
    for (let i = 0; i < total; i++) {
      const got = _scannedChunks[i] !== undefined;
      grid += `<div style="width:${Math.min(24, Math.max(10, 200/total))}px;height:8px;border-radius:2px;background:${got ? 'var(--green2)' : 'var(--glass-bg)'}${got ? ';box-shadow:0 0 4px var(--shadow-glow-olive)' : ''};transition:all .3s"></div>`;
    }
    grid += '</div>';
  }
  st.innerHTML = `<div>${label} ${received}/${total}</div>${grid}`;
  st.style.background = received >= total ? 'rgba(74,102,64,.9)' : 'rgba(0,0,0,.7)';
  st.style.color = received >= total ? '#fff' : 'var(--amber2)';
}

function _qrScanFeedback(received, total) {
  // Haptic feedback
  try { if (navigator.vibrate) navigator.vibrate(received >= total ? [100, 50, 100] : 80); } catch (_) {}
  // Audio feedback (short beep)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = received >= total ? 880 : 660;
    gain.gain.value = 0.15;
    osc.start(); osc.stop(ctx.currentTime + (received >= total ? 0.2 : 0.1));
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch (_) {}
}

function _acceptScannedPacket(packet, jsonText) {
  _scannedJSON = jsonText;
  _scannedPacket = packet;
  _showScanResult(packet);
}

function _acceptLegacyStatePayload(d, raw) {
  const packet = {
    kind: QR_PACKET_KIND_STATE,
    format: 1,
    exportedAt: d.t || Date.now(),
    state: {
      casualties: d.cas || [],
      timeline: d.tl || [],
      comms: d.comms || {},
      missionStart: d.mission || null,
      missionActive: !!d.mission
    }
  };
  _acceptScannedPacket(packet, raw);
}

async function _handleScanResult(raw) {
  const now = Date.now();
  if (raw === _lastScanRaw && now - _lastScanTs < 900) {
    _resumeScanLoop();
    return;
  }
  _lastScanRaw = raw;
  _lastScanTs = now;

  try {
    const d = JSON.parse(raw);

    // --- MODERN BURST (Binary-Burst 3.0 / FEC) ---
    if (d.k === QR_ENVELOPE_KIND && d.id && d.h && Number.isInteger(d.i) && Number.isInteger(d.n)) {
      if (_scanPacketId && (_scanPacketId !== d.id || _scanPacketHash !== d.h)) {
        _scannedChunks = {};
        _scanFecFormat = 0;
      }
      _scanPacketId = d.id;
      _scanPacketHash = d.h;
      _scanPacketTotal = d.n;
      
      const isNew = _scannedChunks[d.i] === undefined;
      _scannedChunks[d.i] = d.d;
      // Track FEC encoding format for the parity chunk
      if (d.fec) _scanFecFormat = d.fec;

      const currentCount = Object.keys(_scannedChunks).length;
      if (isNew) _qrScanFeedback(currentCount, d.n);
      _showScanProgress(isNew ? `✓ חלק ${d.i + 1} נסרק` : `חלק ${d.i + 1} כבר נקלט`, currentCount, d.n);

      const total = d.n;
      const parityIdx = total - 1; // parity is always the last chunk

      // Self-Healing (FEC) Logic — recover one missing data chunk via XOR parity
      let _fecRecovered = false;
      if (currentCount === total - 1) {
        let missingIdx = -1;
        for (let i = 0; i < total; i++) if (_scannedChunks[i] === undefined) { missingIdx = i; break; }

        if (missingIdx !== -1 && missingIdx < parityIdx) {
          // Decode parity bytes — fec:2 means base64-encoded, fec:1 means raw string
          let parityBytes;
          const parityData = _scannedChunks[parityIdx];
          if (_scanFecFormat === 2) {
            // Base64-encoded parity (new format)
            const bin = atob(parityData);
            parityBytes = new Uint8Array(bin.length);
            for (let j = 0; j < bin.length; j++) parityBytes[j] = bin.charCodeAt(j);
          } else {
            // Raw string parity (legacy fec:1 format)
            parityBytes = new Uint8Array(QR_CHUNK_SIZE);
            for (let j = 0; j < parityData.length; j++) parityBytes[j] = parityData.charCodeAt(j);
          }

          // XOR parity with all other data chunks to recover the missing one
          let recovery = new Uint8Array(parityBytes);
          for (let i = 0; i < parityIdx; i++) {
            if (i === missingIdx) continue;
            const cStr = _scannedChunks[i];
            for (let j = 0; j < cStr.length; j++) recovery[j] ^= cStr.charCodeAt(j);
          }
          // Trim trailing nulls only (preserve internal data integrity)
          let recLen = recovery.length;
          while (recLen > 0 && recovery[recLen - 1] === 0) recLen--;
          _scannedChunks[missingIdx] = String.fromCharCode(...recovery.subarray(0, recLen));
          _fecRecovered = true;
          _showScanProgress(`♻ שיחזור נתונים (FEC) — `, total, total);
        }
      }

      // Check if we have all DATA chunks (indices 0..total-2); parity chunk (total-1) is not needed for assembly
      const dataChunkCount = total - 1; // number of data chunks (excluding parity)
      let haveAllData = true;
      for (let i = 0; i < dataChunkCount; i++) {
        if (_scannedChunks[i] === undefined) { haveAllData = false; break; }
      }

      if (haveAllData) {
        // Build raw b64 data from data chunks only
        let b64 = '';
        for (let i = 0; i < dataChunkCount; i++) {
          b64 += _scannedChunks[i];
        }

        let full;
        let hashSource; // the string to verify hash against (must match export-side hash input)
        try {
          if (d.z === 1) { // Binary-Burst Compressed
            const decompressed = await _decompress(b64);
            hashSource = decompressed; // export hashes the short-key JSON before compression
            const mapped = JSON.parse(decompressed);
            full = JSON.stringify(_mapKeys(mapped, SYNC_REV_MAP));
          } else { // Standard Base64
            full = _base64ToUtf8(b64);
            hashSource = full;
          }
        } catch (decErr) {
          console.warn('[QR] Decompression/parse error:', decErr.message);
          _setScanStatus('⚠ שגיאת פענוח — סרוק שוב', true);
          _scannedChunks = {};
          _resumeScanLoop();
          return;
        }

        // Verify hash — skip for FEC-recovered data (parity padding may alter the result)
        if (_hashText(hashSource) !== d.h && !_fecRecovered) {
          console.warn('[QR] Hash mismatch: expected', d.h, 'got', _hashText(hashSource));
          _setScanStatus('⚠ שגיאת Checksum — סרוק שוב', true);
          _scannedChunks = {};
          _resumeScanLoop();
          return;
        }

        try {
          _acceptScannedPacket(JSON.parse(full), full);
        } catch (parseErr) {
          console.warn('[QR] Final JSON parse error:', parseErr.message);
          _setScanStatus('⚠ שגיאת JSON — סרוק שוב', true);
          _scannedChunks = {};
          _resumeScanLoop();
        }
        return;
      }
      
      _resumeScanLoop();
      return;
    }

    // --- LEGACY FORMATS ---
    if (d.B !== undefined && d.n !== undefined) { // v1.0 Base64
      _scannedChunks[d.i] = d.B;
      const count = Object.keys(_scannedChunks).length;
      _showScanProgress('v1.0 חלק ·', count, d.n);
      if (count >= d.n) {
        let b64 = '';
        for (let i = 0; i < d.n; i++) b64 += _scannedChunks[i] || '';
        const full = _base64ToUtf8(b64);
        _acceptScannedPacket(JSON.parse(full), full);
      } else { _resumeScanLoop(); }
      return;
    }

    if (d._qrChunk) { // v1.0 Map
      _scannedChunks[d.i] = d.d;
      const count = Object.keys(_scannedChunks).length;
      _showScanProgress('Legacy ·', count, d.n);
      if (count >= d.n) {
        let text = '';
        for (let i = 0; i < d.n; i++) text += _scannedChunks[i] || '';
        _acceptScannedPacket(JSON.parse(text), text);
      } else { _resumeScanLoop(); }
      return;
    }

    if (d.kind === QR_PACKET_KIND_STATE || d.kind === QR_PACKET_KIND_MESH) {
      _acceptScannedPacket(d, raw);
      return;
    }
    if (d.type === 'casualty' && d.casualty) {
      _acceptScannedPacket({ kind: 'single_casualty', casualty: d.casualty }, raw);
      return;
    }
    if (d.v && d.cas) {
      _acceptLegacyStatePayload(d, raw);
      return;
    }

    _setScanStatus('⚠ QR לא מכיל נתוני BENAM', true);
    _resumeScanLoop();

  } catch (e) {
    _setScanStatus('QR נמצא — ממשיך לחפש...', false);
    _resumeScanLoop();
  }
}

function _showScanResult(packet) {
  stopScanStream();
  const st = $('qr-scan-status');
  if (st) {
    st.textContent = '✓ QR נסרק בהצלחה!';
    st.style.background = 'rgba(74,102,64,.9)';
    st.style.color = '#fff';
  }
  // Success feedback
  _qrScanFeedback(1, 1);
  const info = $('qr-scan-info');
  if (!info) { const res = $('qr-scan-result'); if (res) res.style.display = 'block'; return; }
  if (packet.kind === 'single_casualty') {
    const c = packet.casualty;
    info.innerHTML = `
      <div style="font-weight:700;color:var(--olive3);margin-bottom:4px">👤 Single Casualty Import</div>
      <div style="font-size:16px;font-weight:900">${escHTML(c.name)} <span class="prio pt${c.priority[1]}">${c.priority}</span></div>
      <div style="font-size:12px;color:var(--muted)">Blood: ${c.blood || '?'} | Weight: ${c.kg}kg</div>
      <div style="font-size:11px;color:var(--muted2);margin-top:4px">מנגנון: ${c.mech?.join(', ') || '—'}</div>
    `;
  } else if (packet.kind === QR_PACKET_KIND_MESH) {
    const casCount = packet.casualties?.length || 0;
    const tlCount = packet.timeline?.length || 0;
    const ts = packet.exportedAt ? new Date(packet.exportedAt).toLocaleTimeString('he-IL') : '—';
    const unit = packet.unit ? ` | יחידה: ${escHTML(packet.unit)}` : '';
    // Show triage breakdown
    const t1 = (packet.casualties || []).filter(c => c.priority === 'T1').length;
    const t2 = (packet.casualties || []).filter(c => c.priority === 'T2').length;
    const t3 = (packet.casualties || []).filter(c => c.priority === 'T3').length;
    const t4 = (packet.casualties || []).filter(c => c.priority === 'T4').length;
    info.innerHTML = `
      <div style="font-weight:700;color:var(--olive3);margin-bottom:4px">🔗 Mesh Update${unit}</div>
      <div>📊 ${casCount} פגועים: <span style="color:var(--red2)">T1:${t1}</span> <span style="color:var(--amber)">T2:${t2}</span> <span style="color:var(--green2)">T3:${t3}</span> <span style="color:var(--muted)">T4:${t4}</span></div>
      <div>📝 ${tlCount} אירועי timeline</div>
      <div>⏱ נוצר: ${ts}</div>`;
  } else {
    const state = packet.state || {};
    const cas = state.casualties || [];
    const t1 = cas.filter(c => c.priority === 'T1').length;
    const t2 = cas.filter(c => c.priority === 'T2').length;
    const t3 = cas.filter(c => c.priority === 'T3').length;
    const t4 = cas.filter(c => c.priority === 'T4').length;
    const unit = packet.unit ? ` | יחידה: ${escHTML(packet.unit)}` : '';
    info.innerHTML = `
      <div style="font-weight:700;color:var(--olive3);margin-bottom:4px">📋 Full State${unit}</div>
      <div>📊 ${cas.length} פגועים: <span style="color:var(--red2)">T1:${t1}</span> <span style="color:var(--amber)">T2:${t2}</span> <span style="color:var(--green2)">T3:${t3}</span> <span style="color:var(--muted)">T4:${t4}</span></div>
      <div>👥 ${(state.force || []).length} אנשי צוות</div>
      <div>📝 ${(state.timeline || []).length} אירועי timeline</div>
      <div>⏱ ${state.missionStart ? new Date(state.missionStart).toLocaleTimeString('he-IL') : 'לא פעיל'}</div>`;
  }
  const resultEl = $('qr-scan-result');
  if (resultEl) resultEl.style.display = 'block';
}

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

// ══ CONTROL BOARD ══════════════════════════════════
function renderControlBoard() {
  if (!S.casualties.length) return '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">אין פגועים</div>';
  const now = Date.now();
  const rows = S.casualties.slice().sort((a, b) => prioN(a.priority) - prioN(b.priority)).map(c => {
    const formOK = c.kg && c.blood;
    const hasTx = c.txList && c.txList.length > 0;
    const hasVitals = c.vitalsHistory && c.vitalsHistory.length > 0;
    const tqSec = c.tqStart ? Math.floor((now - c.tqStart) / 1000) : null;
    const tqBadge = tqSec === null ? '<span style="color:var(--muted)">—</span>' :
      tqSec > MEDICAL.TQ_CRITICAL_SEC ? `<span style="color:var(--red3);font-weight:700">TQ ${Math.floor(tqSec / 60)}′⚠</span>` :
        tqSec > MEDICAL.TQ_WARN_SEC ? `<span style="color:var(--amber3);font-weight:700">TQ ${Math.floor(tqSec / 60)}′</span>` :
          `<span style="color:var(--olive3)">TQ ${Math.floor(tqSec / 60)}′</span>`;
    const medicName = c.medic ? escHTML(c.medic) : '<span style="color:var(--muted)">—</span>';
    const buddyName = c.buddyName ? escHTML(c.buddyName) : '<span style="color:var(--muted)">—</span>';
    const issues = [];
    if (!formOK) issues.push('טופס חסר');
    if (!hasTx) issues.push('ללא טיפול');
    if (!hasVitals) issues.push('ללא מדדים');
    if (tqSec !== null && tqSec > MEDICAL.TQ_CRITICAL_SEC) issues.push('TQ קריטי');
    if (!c.medic) issues.push('ללא מטפל');
    const issueHtml = issues.length
      ? issues.map(i => `<span style="background:rgba(200,40,40,.18);color:var(--red3);border-radius:3px;padding:1px 5px;font-size:9px;white-space:nowrap">${i}</span>`).join(' ')
      : '<span style="color:var(--green3);font-size:11px">✓</span>';
    const rowBg = issues.length > 1 ? 'background:rgba(200,40,40,.06)' : issues.length === 1 ? 'background:rgba(200,130,0,.05)' : '';
    return `<tr onclick="jumpToCas(${c.id});forceClose()" style="cursor:pointer;border-bottom:1px solid var(--b0);${rowBg}">
      <td style="padding:7px 8px"><span style="color:${pClr(c.priority)};font-weight:900;font-size:11px">${c.priority}</span></td>
      <td style="padding:7px 8px;font-weight:700;font-size:12px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML(c.name)}</td>
      <td style="padding:7px 6px;font-size:10px;color:var(--olive3);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${medicName}</td>
      <td style="padding:7px 6px;font-size:10px;color:var(--blue2);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${buddyName}</td>
      <td style="padding:7px 6px;text-align:center;font-size:10px">${tqBadge}</td>
      <td style="padding:7px 8px;font-size:10px">${issueHtml}</td>
    </tr>`;
  }).join('');
  const t1c = S.casualties.filter(c => c.priority === 'T1').length;
  const needsAction = S.casualties.filter(c => (!c.kg || !c.blood) || (!c.txList || !c.txList.length));
  const noMedic = S.casualties.filter(c => !c.medic).length;
  const summary = `<div style="display:flex;gap:10px;padding:8px 10px 4px;flex-wrap:wrap">
    <span style="font-size:10px;color:var(--muted2)">סה"כ: <b style="color:var(--white)">${S.casualties.length}</b></span>
    ${t1c ? `<span style="font-size:10px;color:var(--red3);font-weight:700">T1: ${t1c}</span>` : ''}
    ${noMedic ? `<span style="font-size:10px;color:var(--amber3)">⚠ ${noMedic} ללא מטפל</span>` : ''}
    ${needsAction.length ? `<span style="font-size:10px;color:var(--amber3)">⚠ ${needsAction.length} דורשים פעולה</span>` :
      '<span style="font-size:10px;color:var(--green3)">✓ כולם תועדו</span>'}
  </div>`;
  return `${summary}<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:1px solid var(--b1)">
      <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--muted2);white-space:nowrap">סיווג</th>
      <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--muted2)">שם</th>
      <th style="padding:4px 6px;text-align:right;font-size:9px;color:var(--muted2)" title="מטפל">🩺 מטפל</th>
      <th style="padding:4px 6px;text-align:right;font-size:9px;color:var(--muted2)" title="שומר">👥 שומר</th>
      <th style="padding:4px 6px;text-align:center;font-size:9px;color:var(--muted2)">TQ</th>
      <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--muted2)">חסרים</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
function openControlBoard() {
  const controlHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:12px;font-weight:700">📋 לוח שליטה — סטטוס פגועים</span>
      <button class="btn btn-xs btn-ghost" style="font-size:11px;padding:0 8px;min-height:22px" onclick="openTriageTags()">🏷️ תגים טריאז'</button>
    </div>
    <div style="padding:0 4px 8px">${renderControlBoard()}</div>
  `;
  openModal('📋 לוח שליטה', controlHtml);
}
// ═══════════════════════════════════════════════════

// ── Track expanded cards in War Room ──
const _expandedCards = new Set();
function toggleCardExpand(casId, ev) {
  if (ev) ev.stopPropagation();
  const body = document.getElementById('cex-' + casId);
  if (!body) return;
  if (_expandedCards.has(casId)) {
    _expandedCards.delete(casId);
    body.classList.remove('open');
  } else {
    _expandedCards.add(casId);
    body.classList.add('open');
  }
}

// ── MARCH dots helper ──
function marchDotsHTML(c) {
  const m = c.march || { M: 0, A: 0, R: 0, C: 0, H: 0 };
  return `<div class="march-dots" title="MARCH">${['M', 'A', 'R', 'C', 'H'].map(l =>
    `<div class="march-dot${(m[l] || 0) > 0 ? ' done-' + l : ''}" title="${l}"></div>`
  ).join('')
    }</div>`;
}

function renderAdaptiveCard(c) {
  const tier = (c.priority || 'T3')[1]; // '1','2','3','4'
  const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
  const _adRef = c._addedAt || c.tqStart;
  const tqCritClass = tqM !== null && tqM > 30 ? ' tq-crit-pulse' : '';
  const tqBadge = tqM !== null ? `<span id="tq-inline-${c.id}" class="${tqCritClass}" style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.3)">TQ ${tqM}′</span>` : '';
  const txaBadge = _adRef && (180 - Math.floor((Date.now() - _adRef) / 60000)) < 60 ? `<span style="font-size:9px;color:var(--red3);font-weight:700">💉TXA ${Math.max(0, 180 - Math.floor((Date.now() - _adRef) / 60000))}′</span>` : '';
  const escBadge = c.escalated ? `<span class="esc-badge">↑ESC</span>` : '';
  const evacBadge = c.evacType ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${c.evacType === 'מוסק' ? 'rgba(40,68,170,.3)' : 'rgba(100,80,20,.3)'};color:${c.evacType === 'מוסק' ? 'var(--olive3)' : 'var(--amber3)'};font-weight:700">${c.evacType === 'מוסק' ? '🚁' : '🚗'} ${c.evacType}</span>` : '';
  const trend = getDeteriorationTrend(c);
  const trendIcon = trend.level === 'severe' ? '📉' : trend.level === 'mild' ? '↓' : '';
  const dots = marchDotsHTML(c);

  // MARCH progress bar (% complete)
  const marchObj = c.march || { M: 0, A: 0, R: 0, C: 0, H: 0 };
  const marchDone = Object.values(marchObj).filter(v => v > 0).length;
  const marchPct = Math.round((marchDone / 5) * 100);
  const marchBar = `<div class="march-bar"><div class="march-bar-fill" style="width:${marchPct}%"></div></div>`;

  // Sparkline (vitals trend mini dots)
  const sparkline = renderSparkline(c);

  // Wait time
  const waitM = c._addedAt ? Math.floor((Date.now() - c._addedAt) / 60000) : null;
  const waitBadge = waitM !== null && waitM > 0 ? `<span style="font-size:8px;padding:1px 5px;border-radius:3px;background:${waitM > 30 ? 'rgba(200,40,40,.35)' : waitM > 15 ? 'rgba(200,120,0,.25)' : 'rgba(80,100,60,.2)'};color:${waitM > 30 ? 'var(--red3)' : waitM > 15 ? 'var(--amber3)' : 'var(--muted2)'};font-family:var(--font-mono);font-weight:700">${waitM}′</span>` : '';

  const vitRow = renderVitalsRow(c);

  if (tier === '4') {
    return `<div class="cas-card-t4" id="carc-${c.id}">
      <div class="cas-hdr-t4" onclick="jumpToCas(${c.id})">
        <span class="prio pt4">T4</span>
        <span class="cas-name-t4">${escHTML(c.name)}</span>
        <span style="font-size:9px;color:var(--muted)">${c.mech.join('/')}</span>
      </div>
      ${vitRow}
    </div>`;
  }

  if (tier === '3') {
    const isOpen = _expandedCards.has(c.id);
    return `<div class="cas-card-t3" id="carc-${c.id}">
      <div class="cas-hdr-t3" onclick="toggleCardExpand(${c.id},event)">
        <span class="prio pt3">T3</span>
        <span class="cas-name-t3">${escHTML(c.name)}</span>
        ${tqBadge} ${dots} ${sparkline}
        <span style="font-size:9px;color:var(--muted)">${c.mech[0] || ''}</span>
        ${escBadge} ${evacBadge}
        <span class="cas-expand-arrow">${isOpen ? '▾' : '◂'}</span>
      </div>
      ${vitRow}
      <div class="cas-expand-body${isOpen ? ' open' : ''}" id="cex-${c.id}">
        <div class="cas-qbar">
          ${tqM === null ? `<button class="cas-qbtn red" onclick="event.stopPropagation();fireTQFor(${c.id})">🩹 TQ</button>` : `<button class="cas-qbtn amber" onclick="event.stopPropagation();fireTQFor(${c.id})">TQ↻</button>`}
          <button class="cas-qbtn amber" onclick="event.stopPropagation();addTXA(${c.id})">💉 TXA</button>
          <button class="cas-qbtn olive" onclick="event.stopPropagation();changePriority(${c.id},'T2')">↑ T2</button>
          <button class="cas-qbtn" onclick="jumpToCas(${c.id})">📋 פרטים</button>
        </div>
      </div>
      ${marchBar}
    </div>`;
  }

  if (tier === '2') {
    const isOpen = _expandedCards.has(c.id);
    return `<div class="cas-card-t2" id="carc-${c.id}">
      <div class="cas-hdr-t2" onclick="toggleCardExpand(${c.id},event)">
        <span class="prio pt2">T2</span>
        <span class="cas-name-t2">${escHTML(c.name)}</span>
        ${dots} ${sparkline}
        ${waitBadge} ${tqBadge} ${txaBadge} ${escBadge} ${evacBadge}
        ${trendIcon ? `<span style="font-size:14px">${trendIcon}</span>` : ''}
        <span class="cas-expand-arrow">${isOpen ? '▾' : '◂'}</span>
      </div>
      ${vitRow}
      <div class="cas-expand-body${isOpen ? ' open' : ''}" id="cex-${c.id}">
        <div class="cas-qbar">
          ${tqM === null ? `<button class="cas-qbtn red" onclick="event.stopPropagation();fireTQFor(${c.id})">🩹 TQ</button>` : `<button class="cas-qbtn amber" onclick="event.stopPropagation();fireTQFor(${c.id})">TQ↻</button>`}
          <button class="cas-qbtn amber" onclick="event.stopPropagation();addTXA(${c.id})">💉 TXA</button>
          <button class="cas-qbtn olive" onclick="event.stopPropagation();changePriority(${c.id},'T1')">↑ T1</button>
          <button class="cas-qbtn" onclick="event.stopPropagation();toggleQuickVitals(${c.id})">📊</button>
          <button class="cas-qbtn" onclick="jumpToCas(${c.id})">📋 פרטים</button>
        </div>
        <div id="qv-${c.id}" style="display:none"></div>
      </div>
      ${marchBar}
    </div>`;
  }

  // T1 — collapsible like T2, but keeps T1 visual style.
  const isOpen = _expandedCards.has(c.id);
  const injuryItems = (c.injuries && c.injuries.length) ? c.injuries.map(i => `${i.type} ${i.zone}${i.side ? ' ' + (i.side === 'back' ? '(אחורי)' : '(קדמי)') : ''}`) : [];
  const injurySummary = injuryItems.join(' | ');
  const mechSummary = (c.mech && c.mech.length) ? c.mech.join(' · ') : (injuryItems.length ? injuryItems[0] : '—');
  return `<div class="cas-card-t1" id="carc-${c.id}">
    <div class="cas-hdr-t1" onclick="toggleCardExpand(${c.id},event)">
      <span class="prio pt1" style="font-size:14px">T1</span>
      <div style="flex:1">
        <div class="cas-name-t1">${escHTML(c.name)}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:1px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;line-height:1.2">
          <span>${escHTML(mechSummary)}</span>
          <span>🩸${escHTML(c.blood || '?')}</span>
          <span>${c.kg}kg</span>
        </div>
        ${injurySummary ? `<div style="font-size:11px;color:var(--white);font-weight:700;margin-top:3px;line-height:1.35;white-space:normal;max-height:48px;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.02em;">${escHTML(injurySummary)}</div>` : ''}
      </div>
      <div style="text-align:left;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
        ${dots} ${sparkline}
        ${waitBadge} ${tqBadge} ${txaBadge} ${escBadge} ${evacBadge}
        ${trendIcon ? `<span style="font-size:16px">${trendIcon}</span>` : ''}
        <span class="cas-expand-arrow">${isOpen ? '▾' : '◂'}</span>
      </div>
    </div>
    ${vitRow}
    <div class="cas-expand-body${isOpen ? ' open' : ''}" id="cex-${c.id}">
      <div class="cas-qbar">
        ${tqM === null ? `<button class="cas-qbtn red" onclick="event.stopPropagation();fireTQFor(${c.id})">🩹 TQ</button>` : `<button class="cas-qbtn amber" onclick="event.stopPropagation();fireTQFor(${c.id})">TQ ${tqM}′↻</button>`}
        <button class="cas-qbtn amber" onclick="event.stopPropagation();addTXA(${c.id})">💉 TXA</button>
        <button class="cas-qbtn" onclick="event.stopPropagation();toggleQuickVitals(${c.id})">📊 עדכן</button>
        <button class="cas-qbtn" onclick="jumpToCas(${c.id})">📋</button>
        <button class="cas-qbtn" onclick="event.stopPropagation();openHospHandoff(${c.id})">🏥</button>
      </div>
      <div id="qv-${c.id}" style="display:none"></div>
    </div>
    ${marchBar}
  </div>`;
}

function renderVitalsRow(c) {
  const v = c.vitals;
  const trend = getDeteriorationTrend(c);
  const pArr = trend.pulseDir === 'up' ? '↑' : trend.pulseDir === 'dn' ? '↓' : '';
  const sArr = trend.spo2Dir === 'dn' ? '↓' : trend.spo2Dir === 'up' ? '↑' : '';
  const gArr = trend.gcsDir === 'dn' ? '↓' : trend.gcsDir === 'up' ? '↑' : '';
  const pCls = trend.pulseDir === 'up' && parseInt(v.pulse) > 110 ? 'trend-warn' : trend.pulseDir === 'dn' && parseInt(v.pulse) < 50 ? 'trend-dn' : '';
  const sCls = trend.spo2Dir === 'dn' ? 'trend-dn' : parseInt(v.spo2) < 94 ? 'trend-warn' : 'trend-ok';
  const gCls = trend.gcsDir === 'dn' ? 'trend-dn' : '';
  if (!v.pulse && !v.spo2 && !v.gcs) return '';
  return `<div class="cas-vitals-row">
    ${v.pulse ? `<div class="cvr-item">💓 <span class="cvr-val ${pCls}">${v.pulse}</span><span class="trend-warn">${pArr}</span></div>` : ''}
    ${v.spo2 ? `<div class="cvr-item">🫁 <span class="cvr-val ${sCls}">${v.spo2}%</span><span class="${sCls}">${sArr}</span></div>` : ''}
    ${v.gcs ? `<div class="cvr-item">🧠 GCS<span class="cvr-val ${gCls}">${v.gcs}</span><span class="${gCls}">${gArr}</span></div>` : ''}
    ${v.bp ? `<div class="cvr-item">⚡ <span class="cvr-val">${v.bp}</span></div>` : ''}
    ${c.medic ? `<div class="cvr-item" style="margin-right:auto">🩺 <span style="color:var(--olive3)">${escHTML(c.medic)}</span></div>` : ''}
  </div>`;
}

// Inline quick-action helpers
function fireTQFor(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (c.tqStart) {
    // reset TQ
    c.tqStart = Date.now();
    addTXFor(c, 'TQ ↻ חודש', casId);
    addTL(casId, c.name, 'TQ חודש ⏱', 'amber');
  } else {
    c.tqStart = Date.now();
    c.march.M = (c.march.M || 0) + 1;
    addTXFor(c, 'TQ — חוסם', casId);
    addTL(casId, c.name, 'TQ הופעל 🩹', 'red');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }
  renderWarRoom(); saveState();
}
function addTXFor(c, type, casId) {
  c.txList.push({ type, time: nowTime(), ms: Date.now() });
  checkAllergy(casId, type);
  saveMesh(casId, 'tx', { type, time: nowTime() });
}
function addTXA(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (checkAllergy(casId, 'TXA')) return;
  c.txList.push({ type: 'TXA 1g', time: nowTime(), ms: Date.now() });
  addTL(casId, c.name, 'TXA ניתן 💉', 'olive');
  saveMesh(casId, 'tx', { type: 'TXA 1g', time: nowTime() });
  renderWarRoom(); showToast(`✓ TXA — ${c.name}`); saveState();
}
// startGuidedFlow — defined above with full MARCH steps

// ═══════════════════════════════════════════════════
// 📈 DETERIORATION AI
// ═══════════════════════════════════════════════════
function getDeteriorationTrend(c) {
  const h = c.vitalsHistory;
  if (!h || h.length < 2) return { level: 'none', pulseDir: '', spo2Dir: '', gcsDir: '' };
  const last = h[h.length - 1], prev = h[h.length - 2];
  const pulseDelta = (last.pulse || 0) - (prev.pulse || 0);
  const spo2Delta = (last.spo2 || 0) - (prev.spo2 || 0);
  const gcsDelta = (last.gcs || 0) - (prev.gcs || 0);

  const pulseDir = pulseDelta > 8 ? 'up' : pulseDelta < -8 ? 'dn' : '';
  const spo2Dir = spo2Delta < -2 ? 'dn' : spo2Delta > 2 ? 'up' : '';
  const gcsDir = gcsDelta < -1 ? 'dn' : gcsDelta > 1 ? 'up' : '';

  let severity = 0;
  if (pulseDir === 'up' && (last.pulse || 0) > 110) severity++;
  if (pulseDir === 'dn' && (last.pulse || 0) < 50) severity += 2;
  if (spo2Dir === 'dn') severity += (last.spo2 || 99) < 90 ? 3 : 1;
  if (gcsDir === 'dn') severity += (last.gcs || 15) < 10 ? 2 : 1;
  // Check 3-point trend (all going wrong)
  if (h.length >= 3) {
    const p2 = h[h.length - 3];
    if ((last.spo2 || 99) < (prev.spo2 || 99) && (prev.spo2 || 99) < (p2.spo2 || 99)) severity += 2;
    if ((last.pulse || 0) > (prev.pulse || 0) && (prev.pulse || 0) > (p2.pulse || 0) && (last.pulse || 0) > 100) severity++;
  }
  const level = severity >= 4 ? 'severe' : severity >= 2 ? 'mild' : 'none';
  return { level, pulseDir, spo2Dir, gcsDir, severity, lastVitals: last };
}

function checkDeteriorationAI() {
  const banner = $('deteri-banners'); if (!banner) return;
  const critical = S.casualties.filter(c => {
    const t = getDeteriorationTrend(c);
    return t.level === 'severe' && c.priority !== 'T4';
  });
  if (!critical.length) { banner.innerHTML = ''; return; }
  banner.innerHTML = critical.map(c => {
    const t = getDeteriorationTrend(c);
    const issues = [];
    if (t.spo2Dir === 'dn') issues.push(`SpO2 ${t.lastVitals?.spo2 || '?'}% ↓`);
    if (t.pulseDir === 'up' && (t.lastVitals?.pulse || 0) > 110) issues.push(`דופק ${t.lastVitals?.pulse || '?'} ↑`);
    if (t.pulseDir === 'dn' && (t.lastVitals?.pulse || 0) < 50) issues.push(`דופק ${t.lastVitals?.pulse || '?'} ↓⚠`);
    if (t.gcsDir === 'dn') issues.push(`GCS ${t.lastVitals?.gcs || '?'} ↓`);
    return `<div class="deteri-banner" onclick="jumpToCas(${c.id})">
      <div class="deteri-title">📉 DETERIORATION ALERT</div>
      <div class="deteri-name">${escHTML(c.name)} — ${c.priority}</div>
      <div class="deteri-detail">${issues.join(' · ')} → לחץ לטיפול מיידי</div>
    </div>`;
  }).join('');
  // Auto-escalate if severe
  critical.forEach(c => {
    if (c.priority === 'T2' && !c.escalated) {
      c.priority = 'T1'; c.escalated = true;
      addTL(c.id, c.name, '📉 הוחמר → T1 (Deterioration AI)', 'red');
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
  });
}

// Enhanced vitals snapshot triggers deterioration check
function snapshotVitals(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const snap = {
    t: nowTime(), ms: Date.now(),
    pulse: parseInt(c.vitals.pulse) || 0,
    spo2: parseInt(c.vitals.spo2) || 0,
    gcs: parseInt(c.vitals.gcs) || 15,
    bp: c.vitals.bp || ''
  };
  c.vitalsHistory = c.vitalsHistory || [];
  c.vitalsHistory.push(snap);
  if (c.vitalsHistory.length > MEDICAL.MAX_VITALS_HISTORY) c.vitalsHistory.shift();
  addTL(casId, c.name, `📸 Snapshot: P${snap.pulse} S${snap.spo2}% G${snap.gcs}`, 'olive');
  saveMesh(casId, 'vitals', snap);
  checkDeteriorationAI();
  drawVitalsGraph(casId);
  showToast(`📸 Snapshot — ${c.name}`);
}

// ═══════════════════════════════════════════════════
// 🗺️ TACTICAL MAP
// ═══════════════════════════════════════════════════
let _tmapPositions = {};    // casId → {x,y}
let _tmapLZs = [];           // [{x,y,label}]
let _tmapGridOn = true;
let _tmapDragging = null;

function openTacticalMap() {
  $('tmap-overlay').classList.add('on');
  $('tmap-title').textContent = `${S.comms.unit || 'אירוע'} — ${S.casualties.length} פגועים`;
  tmapAutoLayout();
  renderTmap();
}

function tmapAutoLayout() {
  // Place casualties in priority zones
  const zones = { T1: { x: 200, y: 150, spread: 70 }, T2: { x: 200, y: 290, spread: 80 }, T3: { x: 200, y: 400, spread: 90 }, T4: { x: 200, y: 460, spread: 60 } };
  const counts = { T1: 0, T2: 0, T3: 0, T4: 0 };
  S.casualties.forEach(c => {
    if (_tmapPositions[c.id]) return; // keep manual positions
    const z = zones[c.priority] || zones.T3;
    const idx = counts[c.priority] || 0;
    const angle = (idx * 137.5) * (Math.PI / 180); // golden angle spread
    const r = Math.min(z.spread, 20 + idx * 18);
    _tmapPositions[c.id] = {
      x: Math.max(20, Math.min(380, z.x + Math.cos(angle) * r)),
      y: Math.max(20, Math.min(480, z.y + Math.sin(angle) * r))
    };
    counts[c.priority] = (counts[c.priority] || 0) + 1;
  });
  // Default LZ
  if (!_tmapLZs.length) _tmapLZs = [{ x: 80, y: 60, label: 'LZ1' }, { x: 320, y: 60, label: 'LZ2' }];
}

function renderTmap() {
  const svg = $('tmap-svg'); if (!svg) return;
  const casLayer = $('tmap-cas-layer');
  const lzLayer = $('tmap-lz-layer');
  const pathLayer = $('tmap-path-layer');
  if (!casLayer) return;

  const pColors = { T1: '#c82828', T2: '#c89010', T3: '#28822a', T4: '#333' };
  const pR = { T1: 14, T2: 11, T3: 9, T4: 7 };

  // Evac paths from T1s to nearest LZ
  pathLayer.innerHTML = S.casualties.filter(c => c.priority === 'T1' && _tmapPositions[c.id]).map(c => {
    const pos = _tmapPositions[c.id];
    const lz = _tmapLZs.reduce((best, l) => {
      const d = Math.hypot(l.x - pos.x, l.y - pos.y);
      return !best || d < best.d ? { ...l, d } : best;
    }, null);
    if (!lz) return '';
    return `<line x1="${pos.x}" y1="${pos.y}" x2="${lz.x}" y2="${lz.y}" stroke="#c82828" stroke-width="1" stroke-dasharray="6,4" opacity=".5"/>`;
  }).join('');

  // LZ markers
  lzLayer.innerHTML = _tmapLZs.map((lz, i) => `
    <g class="tmap-lz" style="cursor:pointer">
      <rect x="${lz.x - 16}" y="${lz.y - 10}" width="32" height="20" rx="4" fill="#186018" stroke="#42c042" stroke-width="1.5"/>
      <text x="${lz.x}" y="${lz.y + 4}" text-anchor="middle" fill="#42c042" font-size="9" font-weight="700">${lz.label}</text>
    </g>`).join('');

  // Casualty markers
  casLayer.innerHTML = S.casualties.map(c => {
    const pos = _tmapPositions[c.id] || { x: 200, y: 250 };
    const r = pR[c.priority] || 9;
    const col = pColors[c.priority] || '#555';
    const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
    const tqRing = tqM !== null && tqM > 30 ? `<circle cx="${pos.x}" cy="${pos.y}" r="${r + 4}" fill="none" stroke="${tqM > 45 ? '#f04848' : '#e8b020'}" stroke-width="2" opacity=".8" stroke-dasharray="4,2"/>` : '';
    const trend = getDeteriorationTrend(c);
    const trendMark = trend.level === 'severe' ? `<text x="${pos.x + r}" y="${pos.y - r}" fill="#f04848" font-size="9">📉</text>` : '';
    const shortName = c.name.split(' ')[0];
    return `<g class="tmap-cas" onclick="jumpToCas(${c.id})" style="cursor:pointer">
      ${tqRing}
      <circle cx="${pos.x}" cy="${pos.y}" r="${r}" fill="${col}" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>
      <text x="${pos.x}" y="${pos.y + 1}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${r > 10 ? '8' : '7'}" font-weight="700">${c.priority}</text>
      <text x="${pos.x}" y="${pos.y + r + 9}" text-anchor="middle" fill="${col}" font-size="8">${shortName}</text>
      ${tqM !== null ? `<text x="${pos.x}" y="${pos.y + r + 17}" text-anchor="middle" fill="${tqM > 45 ? '#f04848' : '#e8b020'}" font-size="7">${tqM}′</text>` : ''}
      ${trendMark}
    </g>`;
  }).join('');

  // Drag to reposition
  svg.onmousedown = svg.ontouchstart = (e) => {
    const pt = tmapSVGPoint(svg, e);
    // Find closest casualty
    let closest = null, minD = 25;
    S.casualties.forEach(c => {
      const pos = _tmapPositions[c.id]; if (!pos) return;
      const d = Math.hypot(pt.x - pos.x, pt.y - pos.y);
      if (d < minD) { minD = d; closest = c; }
    });
    if (closest) _tmapDragging = closest.id;
  };
  svg.onmousemove = svg.ontouchmove = (e) => {
    if (!_tmapDragging) return;
    e.preventDefault();
    const pt = tmapSVGPoint(svg, e);
    _tmapPositions[_tmapDragging] = { x: Math.max(15, Math.min(385, pt.x)), y: Math.max(15, Math.min(485, pt.y)) };
    renderTmap();
  };
  svg.onmouseup = svg.ontouchend = () => { _tmapDragging = null; };
}

function tmapSVGPoint(svg, e) {
  const rect = svg.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const scaleX = 400 / rect.width, scaleY = 500 / rect.height;
  return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
}

function tmapAddLZ() {
  const lbl = prompt('שם LZ (למשל LZ3):', 'LZ' + (_tmapLZs.length + 1));
  if (!lbl) return;
  _tmapLZs.push({ x: 200, y: 100, label: lbl });
  renderTmap();
}
function tmapClearOverride() { _tmapPositions = {}; tmapAutoLayout(); renderTmap(); }
function tmapToggleGrid() {
  _tmapGridOn = !_tmapGridOn;
  const g = $('tmap-grid'); if (g) g.style.display = _tmapGridOn ? '' : 'none';
}

// Auto-refresh map while open
setInterval(() => {
  try { if (!document.hidden && $('tmap-overlay')?.classList.contains('on')) renderTmap(); } catch (_) {}
}, 5000);

// ═══════════════════════════════════════════════════
// I18N — Internationalization Engine
// ═══════════════════════════════════════════════════
var _currentLang = localStorage.getItem('benam_lang') || 'he';

const TRANSLATIONS = {
  he: {
    prep: 'הכנה',
    aran: 'אר"ן',
    data: 'נתונים',
    start_mission: 'התחל משימה',
    end_mission: 'סיים אר"ן',
    add_cas: 'הוסף פגוע',
    force: 'כוח',
    comms: 'קשר',
    evac: 'פינוי',
    search: 'חיפוש...',
    settings: 'הגדרות',
    night_mode: 'תצוגת לילה',
    fullscreen: 'מסך מלא'
  },
  en: {
    prep: 'Prep',
    aran: 'MCE',
    data: 'Data',
    start_mission: 'Start Mission',
    end_mission: 'End Mission',
    add_cas: 'Add Casualty',
    force: 'Force',
    comms: 'Comms',
    evac: 'Evac',
    search: 'Search...',
    settings: 'Settings',
    night_mode: 'Night Mode',
    fullscreen: 'Fullscreen'
  }
};

function t(key) {
  return TRANSLATIONS[_currentLang][key] || key;
}

function setLanguage(lang) {
  _currentLang = lang;
  localStorage.setItem('benam_lang', lang);
  // Persist state before reload to prevent data loss during active mission
  if (typeof saveState === 'function') saveState();
  setTimeout(() => location.reload(), 200); // allow IDB write to complete
}

function applyTranslations() {
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.dataset.t;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = t(key);
    else el.textContent = t(key);
  });
  // Update direction
  document.documentElement.dir = _currentLang === 'he' ? 'rtl' : 'ltr';
  document.documentElement.lang = _currentLang;
}

function toggleLanguage() {
  setLanguage(_currentLang === 'he' ? 'en' : 'he');
}

if (typeof window !== 'undefined') {
  window.t = t;
  window.setLanguage = setLanguage;
  window.toggleLanguage = toggleLanguage;
  window.applyTranslations = applyTranslations;
}
// Run on load
setTimeout(applyTranslations, 500);

// ═══════════════════════════════════════════════════
// 🔗 MESH SYNC — QR Delta Sync
// ═══════════════════════════════════════════════════
let _meshLog = [];
let _meshLastSync = 0;
let _meshPendingDeltas = [];
let _meshExportBundle = null;

function openMeshSync() {
  $('mesh-overlay').style.display = 'block';
  renderMeshStatus();
}

function saveMesh(casId, type, data) {
  _meshPendingDeltas.push({ casId, type, data, ts: Date.now() });
  meshAddLog(`📝 שינוי מקומי: ${type} (פגוע ${casId})`);
}

function openSyncDashboard(activeTab = 'mesh') {
  const lastSyncStr = _meshLastSync > 0 ? new Date(_meshLastSync).toLocaleTimeString('he-IL') : '—';
  const pendingCount = _meshPendingDeltas.length;
  const health = pendingCount > 10 ? 'crit' : pendingCount > 0 ? 'warn' : 'ok';
  const healthClr = health === 'crit' ? 'var(--red3)' : health === 'warn' ? 'var(--amber3)' : 'var(--green3)';
  const radio = S.prefs?.radioName || 'ללא זיהוי';

  const modalHtml = `
    <div class="pad col" style="gap:16px; max-height:85vh; overflow-y:auto; padding-top:4px">
      
      <!-- Premium Tab Navigation -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; background:rgba(255,255,255,0.05); border-radius:12px; padding:4px; margin-bottom:4px">
        <div onclick="openSyncDashboard('mesh')" style="text-align:center; padding:10px; border-radius:10px; font-size:11px; font-weight:900; background:${activeTab === 'mesh' ? 'var(--s1)' : 'transparent'}; color:${activeTab === 'mesh' ? 'var(--white)' : 'var(--muted)'}; cursor:pointer">📡 זירה</div>
        <div onclick="openSyncDashboard('export')" style="text-align:center; padding:10px; border-radius:10px; font-size:11px; font-weight:900; background:${activeTab === 'export' ? 'var(--s1)' : 'transparent'}; color:${activeTab === 'export' ? 'var(--white)' : 'var(--muted)'}; cursor:pointer">📤 שידור</div>
        <div onclick="openSyncDashboard('scan')" style="text-align:center; padding:10px; border-radius:10px; font-size:11px; font-weight:900; background:${activeTab === 'scan' ? 'var(--s1)' : 'transparent'}; color:${activeTab === 'scan' ? 'var(--white)' : 'var(--muted)'}; cursor:pointer">📥 קליטה</div>
      </div>

      ${activeTab === 'mesh' ? `
        <!-- Mesh Scene Overview -->
        <div style="background:var(--s3); padding:16px; border-radius:16px; border:1px solid var(--b2); position:relative; overflow:hidden">
          <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${healthClr}"></div>
          <div style="font-size:10px; color:var(--muted); letter-spacing:0.1em; margin-bottom:2px">מצב סנכרון זירה (Tactical Mesh)</div>
          <div style="font-size:20px; font-weight:900; color:${healthClr}">${health === 'ok' ? 'מסונכרן מלא' : 'ממתין לעדכון'}</div>
          
          <div style="display:flex; gap:12px; margin-top:16px; background:rgba(0,0,0,0.2); padding:12px; border-radius:10px">
            <div style="flex:1">
              <div style="font-size:18px; font-weight:900">${pendingCount}</div>
              <div style="font-size:9px; color:var(--muted)">שינויים מקומיים</div>
            </div>
            <div style="width:1px; background:var(--b1)"></div>
            <div style="flex:1">
              <div style="font-size:18px; font-weight:900">${S.casualties.length}</div>
              <div style="font-size:9px; color:var(--muted)">פגועים בבסיס</div>
            </div>
          </div>
        </div>

        <div class="row" style="justify-content:space-between; background:var(--s2); padding:12px; border-radius:12px; border:1px solid var(--b1)">
          <div style="display:flex; align-items:center; gap:10px">
            <span style="font-size:22px">👤</span>
            <div class="col">
              <div style="font-size:9px; color:var(--muted)">זיהוי קשר (Radio)</div>
              <div style="font-size:14px; font-weight:700">${escHTML(radio)}</div>
            </div>
          </div>
          <button class="btn btn-xs btn-ghost" onclick="closeModal(); openUserSettings()">הגדרות</button>
        </div>

        <div class="col" style="gap:8px">
          <div style="font-size:10px; color:var(--muted); font-weight:700; display:flex; justify-content:space-between">
            <span>📜 היסטוריית תעבורה</span>
            <span style="color:var(--muted2)">${lastSyncStr}</span>
          </div>
          <div id="mesh-log-view" style="background:var(--bg); border:1px solid var(--b0); border-radius:12px; padding:10px; max-height:160px; overflow-y:auto; font-family:var(--font-mono); font-size:10px">
            ${_meshLog.length > 0 
              ? _meshLog.map(l => `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03); color:var(--muted2)">${l}</div>`).reverse().join('')
              : '<div style="text-align:center; padding:20px; color:var(--muted2)">אין פעילות רשת רשומה</div>'
            }
          </div>
        </div>
      ` : ''}

      ${activeTab === 'export' ? `
        <!-- Export / Burst Section -->
        <div class="col" style="gap:12px">
          <!-- Data Scope Selector -->
          <div style="display:grid; grid-template-columns:1fr 1fr; background:rgba(255,255,255,0.1); border-radius:12px; padding:4px; border:1px solid var(--b1)">
            <div onclick="window._burstScope='all'; openSyncDashboard('export')" 
              style="text-align:center; padding:10px; border-radius:10px; font-size:12px; font-weight:900; background:${(window._burstScope || 'all') === 'all' ? 'var(--olive3)' : 'transparent'}; color:white; cursor:pointer; transition:all 0.2s">🌍 הכל (זירה)</div>
            <div onclick="window._burstScope='cas'; if(!window._burstTargetId && S.casualties[0]) window._burstTargetId=S.casualties[0].id; openSyncDashboard('export')" 
              style="text-align:center; padding:10px; border-radius:10px; font-size:12px; font-weight:900; background:${window._burstScope === 'cas' ? 'var(--olive3)' : 'transparent'}; color:white; cursor:pointer; transition:all 0.2s">👤 פצוע ספציפי</div>
          </div>

          ${window._burstScope === 'cas' ? `
            <!-- V3 Supreme Patient Selector -->
            <div style="display:flex; gap:14px; overflow-x:auto; padding:12px 0 20px 0; scrollbar-width:none; -webkit-overflow-scrolling:touch; margin:0 -10px; padding:10px">
              ${S.casualties.map(c => {
                const isSelected = window._burstTargetId === c.id;
                const pColor = pClr(c.priority);
                return `
                <div onclick="window._burstTargetId=${c.id}; openSyncDashboard('export')" 
                  style="flex:0 0 auto; width:110px; padding:16px 10px; border-radius:24px; background:${isSelected ? 'rgba(200,144,16,0.1)' : 'rgba(255,255,255,0.03)'}; border:2.5px solid ${isSelected ? 'var(--amber3)' : 'rgba(255,255,255,0.08)'}; text-align:center; cursor:pointer; position:relative; box-shadow:${isSelected ? '0 12px 35px rgba(200,144,16,0.3)' : 'none'}; transition:all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)">
                  ${isSelected ? '<div style="position:absolute; top:-10px; right:-10px; background:var(--amber); color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900; border:3px solid var(--b2); box-shadow:0 4px 12px rgba(0,0,0,0.5)">✓</div>' : ''}
                  <div style="width:40px; height:40px; margin:0 auto 8px; border-radius:50%; background:${pColor}; display:flex; align-items:center; justify-content:center; font-size:18px; color:white; font-weight:900; border:2px solid rgba(255,255,255,0.2)">${c.priority}</div>
                  <div style="font-size:13px; font-weight:900; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:0.5px">${escHTML(c.name || 'UN NAMED')}</div>
                  <div style="font-size:10px; color:var(--muted); margin-top:4px; font-weight:700">HR: ${c.vitals?.pulse || '—'} · #${c.id.toString().slice(-4)}</div>
                </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- V3 Supreme QR Portal -->
          <div id="qr-burst-container" style="background:rgba(255,255,255,0.02); border-radius:32px; padding:24px; border:1px solid rgba(255,255,255,0.05); backdrop-filter:blur(20px); box-shadow:inset 0 0 40px rgba(255,255,255,0.02); min-height:480px; display:flex; flex-direction:column; align-items:center; justify-content:center">
             ${!window._burstReady ? `
               <div style="text-align:center; padding:40px">
                 <div style="font-size:48px; margin-bottom:20px; animation:pulse 2s infinite">📡</div>
                 <div style="color:var(--white); font-weight:900; font-size:18px; margin-bottom:12px">מוכן לשידור טקטי</div>
                 <p style="color:var(--muted); font-size:13px; line-height:1.6; margin-bottom:24px">המערכת תארוז את הנתונים המבוקשים<br>לתוך רצף קודי QR בינאריים מוצפנים.</p>
                 <button class="btn btn-xl btn-amber btn-full" onclick="meshExport('${window._burstScope}', '${window._burstTargetId}')" style="border-radius:18px; box-shadow:0 15px 40px rgba(200,144,16,0.3)">צור רצף שידור (BURST)</button>
               </div>
             ` : '<div id="qr-render-area" style="width:100%"></div>'}
          </div>
        </div>
      ` : ''}

      ${activeTab === 'scan' ? `
        <!-- Scan / Import Section -->
        <div style="text-align:center; padding:20px; background:var(--s3); border-radius:16px; border:1px solid var(--b2)">
          <div style="font-size:48px; margin-bottom:12px">📷</div>
          <div style="font-size:18px; font-weight:900">קליטת נתונים (Scanner)</div>
          <div style="font-size:12px; color:var(--muted); margin-bottom:20px">סרוק קודי QR או חבילות Burst ממכשירים אחרים.</div>
          
          <div class="col" style="gap:10px">
            <button class="btn btn-lg btn-olive btn-full" onclick="closeModal(); startQRScan()" style="height:60px; font-weight:900">פתח מצלמת סריקה</button>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
              <button class="btn btn-md btn-ghost btn-full" onclick="closeModal(); triggerQRImageScan()">🖼 ייבוא מתמונה</button>
              <button class="btn btn-md btn-ghost btn-full" onclick="closeModal(); toggleQRPasteArea()">📋 הדבק נתונים</button>
            </div>
          </div>
        </div>
      ` : ''}

      <button class="btn btn-md btn-ghost btn-full" onclick="closeModal()" style="margin-top:8px">חזרה למשימה</button>

      <style>
        .sync-glow { box-shadow: 0 0 20px var(--amber); animation: sync-pulse 1.5s infinite; }
        @keyframes sync-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
      </style>
    </div>
  `;
  
  openModal('📡 מרכז סנכרון מאוחד (Sync Master)', modalHtml);
}

function meshAddLog(msg) {
  const time = new Date().toLocaleTimeString('he-IL');
  _meshLog.push(`[${time}] ${msg}`);
  if (_meshLog.length > 50) _meshLog.shift();
}

async function meshExport(scope = 'all', targetId = '') {
  let casualtiesToShare = S.casualties;
  if (scope === 'cas' && targetId) {
    casualtiesToShare = S.casualties.filter(c => String(c.id) === String(targetId));
    if (casualtiesToShare.length === 0) { showToast('פצוע לא נמצא'); return; }
  }

  const payload = {
    kind: QR_PACKET_KIND_MESH,
    format: QR_SYNC_FORMAT,
    unit: S.comms.unit || '',
    exportedAt: Date.now(),
    sincets: scope === 'all' ? (_meshLastSync || 0) : 0, // Single casualty always full export
    casualties: casualtiesToShare.map(c => ({
      id: c.id, name: c.name, idNum: c.idNum, blood: c.blood, kg: c.kg, allergy: c.allergy,
      priority: c.priority, mech: c.mech, time: c.time, tqStart: c.tqStart,
      txList: c.txList, vitals: c.vitals, vitalsHistory: c.vitalsHistory || [],
      injuries: c.injuries, fluidTotal: c.fluidTotal, march: c.march,
      medic: c.medic, gps: c.gps, escalated: c.escalated, _addedAt: c._addedAt,
      notes: c.notes || ''
    })),
    timeline: S.timeline.slice(-30),
    comms: S.comms,
    supplies: S.supplies,
    missionStart: S.missionStart
  };

  const bundle = await _buildQRBundle(payload);
  _meshExportBundle = bundle;

  // Open the Unified Burst Modal (Simplified Container)
  openModal('📤 שידור זירה (Binary Burst)', `
    <div class="pad col" style="gap:12px; align-items:center; min-height:420px; padding-top:10px">
      <div id="mesh-qr-area" style="width:100%; display:flex; justify-content:center">
        <!-- The specialized _renderQRBundle will inject the entire UI here -->
      </div>
      <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()" style="margin-top:10px; border-radius:12px">סגור שידור</button>
    </div>
  `);

  // Start the pre-rendering and display
  setTimeout(() => {
    const el = $('mesh-qr-area');
    if (el) _renderQRBundle(el, bundle);
  }, 100);

  // Mark as synced locally ONLY if full scene was shared
  if (scope === 'all') {
    _meshLastSync = Date.now();
    _meshPendingDeltas = [];
    meshAddLog(`📤 שידור זירה (Full) מוצלח: ${payload.casualties.length} פגועים`);
  } else {
    meshAddLog(`📤 שידור פצוע בודד: ${casualtiesToShare[0]?.name || '?'}`);
  }
  
  try { if (navigator.vibrate) navigator.vibrate(80); } catch (_) {}
}

function meshCopyJSON() {
  if (!_meshExportBundle) { showToast('אין חבילת Mesh מוכנה'); return; }
  navigator.clipboard?.writeText(_meshExportBundle.json).then(() => showToast('📋 הועתק!')).catch(() => showToast('⚠ לא הצליח להעתיק'));
}

function meshScanQR() {
  $('mesh-export-area').style.display = 'none';
  startQRScan();
}

function meshApplyImport() {
  const raw = ($('mesh-import-txt')?.value || '').trim();
  if (!raw) { showToast('⚠ הדבק JSON לפני מיזוג'); return; }
  let payload;
  // Try direct JSON parse
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    // Try base64 decode
    try { payload = JSON.parse(_base64ToUtf8(raw)); }
    catch (e2) {
      // Try to extract JSON from wrapped text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { payload = JSON.parse(jsonMatch[0]); } catch (e3) {}
      }
      if (!payload) {
        showToast('⚠ פורמט לא תקין — ודא שהדבקת JSON או Base64 תקין');
        return;
      }
    }
  }
  // Validate minimum structure
  if (!payload.casualties && !payload.state && !payload.cas) {
    showToast('⚠ נתונים לא מכילים פגועים — ודא שהנתונים מ-BENAM');
    return;
  }
  meshApplyPayload(payload);
  $('mesh-import-txt').value = '';
  $('mesh-import-area').style.display = 'none';
}

function meshApplyPayload(payload) {
  if (payload?.kind === QR_PACKET_KIND_STATE) {
    _importStatePacket(payload);
    return;
  }
  if (!payload?.casualties || !Array.isArray(payload.casualties)) {
    showToast('⚠ חסר שדה casualties — נתונים לא תקינים');
    return;
  }

  // Validate payload structure
  const validCas = payload.casualties.filter(c => c && (c.id || c.name));
  if (validCas.length === 0) {
    showToast('⚠ לא נמצאו פגועים תקינים בנתונים');
    return;
  }

  let added = 0, updated = 0, conflicts = 0, mergeDetails = [];
  validCas.forEach(incoming => {
    // Match by ID first, then by name as fallback
    const existing = S.casualties.find(c => c.id == incoming.id) ||
                     S.casualties.find(c => c.name && incoming.name && c.name === incoming.name);
    if (!existing) {
      S.casualties.push(_normalizeImportedCasualty({ ...incoming, _meshReceived: true, _meshSyncAt: Date.now() }));
      added++;
      mergeDetails.push(`+ ${escHTML(incoming.name || '?')} (חדש)`);
    } else {
      const inTs = incoming._addedAt || 0, exTs = existing._addedAt || 0;
      const changes = [];

      // Priority: take more critical (lower number = more critical)
      if (incoming.priority && prioN(incoming.priority) < prioN(existing.priority)) {
        changes.push(`תעדוף: ${existing.priority}→${incoming.priority}`);
        existing.priority = incoming.priority;
        conflicts++;
      }

      // TxList: merge unique treatments
      let txAdded = 0;
      if (Array.isArray(incoming.txList)) {
        incoming.txList.forEach(tx => {
          if (tx && !existing.txList.some(t => t.type === tx.type && t.time === tx.time)) {
            existing.txList.push({ ...tx, _mesh: true, _meshSyncAt: Date.now() });
            txAdded++;
          }
        });
      }
      if (txAdded) changes.push(`+${txAdded} טיפולים`);

      // Injuries: merge unique
      let injAdded = 0;
      if (Array.isArray(incoming.injuries)) {
        incoming.injuries.forEach(inj => {
          if (inj && !existing.injuries.some(e => e.loc === inj.loc && e.type === inj.type)) {
            existing.injuries.push({ ...inj, _mesh: true });
            injAdded++;
          }
        });
      }
      if (injAdded) changes.push(`+${injAdded} פציעות`);

      // Vitals: take if newer
      if (incoming.vitals && inTs > exTs) {
        existing.vitals = { ...incoming.vitals };
        changes.push('ויטלים עודכנו');
      }

      // VitalsHistory: merge unique entries
      const existH = existing.vitalsHistory || [];
      let vhAdded = 0;
      (incoming.vitalsHistory || []).forEach(s => {
        if (s && !existH.some(e => e.ms === s.ms)) { existH.push(s); vhAdded++; }
      });
      existing.vitalsHistory = existH.sort((a, b) => (a.ms || 0) - (b.ms || 0));
      if (vhAdded) changes.push(`+${vhAdded} מדידות`);

      // MARCH: merge — take worst score per category
      if (incoming.march) {
        ['M', 'A', 'R', 'C', 'H'].forEach(k => {
          if ((incoming.march[k] || 0) > (existing.march[k] || 0)) {
            existing.march[k] = incoming.march[k];
          }
        });
      }

      // Notes: append if different
      if (incoming.notes && incoming.notes !== existing.notes) {
        if (existing.notes && !existing.notes.includes(incoming.notes)) {
          existing.notes = existing.notes + '\n[mesh] ' + incoming.notes;
          changes.push('הערות מוזגו');
        } else if (!existing.notes) {
          existing.notes = incoming.notes;
        }
      }

      // Medic assignment: take if missing locally
      if (incoming.medic && !existing.medic) {
        existing.medic = incoming.medic;
        changes.push(`חובש: ${escHTML(incoming.medic)}`);
      }

      // TQ: take if newer
      if (incoming.tqStart && (!existing.tqStart || incoming.tqStart > existing.tqStart)) {
        existing.tqStart = incoming.tqStart;
        changes.push('TQ עודכן');
      }

      existing._meshSyncAt = Date.now();
      if (changes.length > 0) {
        updated++;
        mergeDetails.push(`↻ ${escHTML(existing.name || '?')}: ${changes.join(', ')}`);
      }
    }
  });

  // Merge timeline
  let tlAdded = 0;
  (payload.timeline || []).forEach(e => {
    if (e && !S.timeline.some(t => t.ms === e.ms && t.who === e.who)) {
      S.timeline.push({ ...e, _mesh: true });
      tlAdded++;
    }
  });
  S.timeline.sort((a, b) => (a.ms || 0) - (b.ms || 0));

  // Merge supplies: take max of each
  if (payload.supplies) {
    Object.keys(payload.supplies).forEach(k => {
      if (typeof payload.supplies[k] === 'number' && payload.supplies[k] > (S.supplies[k] || 0)) {
        S.supplies[k] = payload.supplies[k];
      }
    });
  }

  const summary = `✅ מוזג: +${added} חדשים, ${updated} עודכנו${conflicts ? `, ${conflicts} קונפליקטים` : ''}${tlAdded ? `, +${tlAdded} אירועים` : ''}`;

  // Show detailed merge log
  meshAddLog(summary);
  if (mergeDetails.length > 0 && mergeDetails.length <= 10) {
    mergeDetails.forEach(d => meshAddLog('  ' + d));
  }

  renderWarRoom(); renderTimeline(); populateSupply();
  saveState();
  showToast(summary, 4000);
  addTL('sys', 'SYSTEM', `🔗 Mesh Sync: +${added} חדשים, ${updated} עודכנו`, 'olive');

  // Vibrate on successful merge
  try { if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]); } catch (_) {}
}

// _normalizeImportedCasualty is defined in 19-qr-export.js (more complete version)

function renderMeshStatus() {
  const el = $('mesh-sync-status'); if (!el) return;
  const pending = _meshPendingDeltas.length;
  const meshCount = S.casualties.filter(c => c._meshReceived).length;
  const lastSyncAgo = _meshLastSync ? _formatTimeAgo(_meshLastSync) : null;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <div style="width:8px;height:8px;border-radius:50%;background:${pending ? 'var(--amber3)' : 'var(--green3)'};${pending ? 'animation:pulse 1.5s infinite' : ''}"></div>
      <span style="color:${pending ? 'var(--amber3)' : 'var(--green3)'}; font-weight:700">
        ${pending ? `${pending} עדכונים ממתינים` : '✅ מסונכרן'}
      </span>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <span>📊 ${S.casualties.length} פגועים</span>
      <span>📝 ${S.timeline.length} אירועים</span>
      ${meshCount ? `<span>🔗 ${meshCount} ממקור חיצוני</span>` : ''}
    </div>
    ${lastSyncAgo ? `<div style="color:var(--muted2);margin-top:2px">סנכרון אחרון: ${lastSyncAgo}</div>` : '<div style="color:var(--muted2);margin-top:2px">טרם סונכרן</div>'}`;
}

function _formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'לפני ' + diff + ' שניות';
  if (diff < 3600) return 'לפני ' + Math.floor(diff / 60) + ' דקות';
  return new Date(ts).toLocaleTimeString('he-IL');
}
// ═══════════════════════════════════════════════════
function openClosingProtocol() {
  $('closing-overlay').classList.add('on');
  renderClosingProtocol();
}

const CLOSING_STEPS = [
  { id: 'cas-status', title: 'אשר סטטוס כל הפגועים', body: 'עבור על כל פגוע — ודא שכולם מטופלים, מפונים או מסומנים כ-T4. אל תשאיר פגוע ללא סטטוס.', check: () => S.casualties.every(c => c.closeConfirmed) },
  { id: 'tq-check', title: 'בדיקת TQ — כל החוסמים', body: 'ודא שכל TQ פתוח תועד עם שעת שים. פגוע עם TQ מעל 60 דקות — עדכן בי"ח מיידית.', check: () => !S.casualties.some(c => c.tqStart && !c.tqDocumented) },
  { id: 'supply-count', title: 'ספירת ציוד שנוצל', body: 'ספור TQ, Chest Seals, TXA שנוצלו — עדכן בטופס AAR. ודא מלאי לאירוע הבא.', check: () => true },
  { id: 'evac-confirm', title: 'אשר פינוי — מי עלה', body: 'ודא שכל פגוע שפונה מצוין כ"פונה". בדוק מול סלוטי הפינוי.', check: () => true },
  { id: '101-forms', title: 'טפסי 101 — הפקת מסמכים', body: 'הפק טופס 101 לכל פגוע שפונה. ודא שכל שדה מלא — שם, מ.א., סוג דם, טיפולים.', check: () => true },
  { id: 'timeline-lock', title: 'נעל ציר זמן', body: 'הוסף הערות סיום לציר הזמן. תעד שעת סגירת אירוע.', check: () => true },
  { id: 'debrief', title: 'תחקיר ראשוני — 3 דקות', body: 'שאל את הצוות: מה עבד? מה לא עבד? מה היינו עושים אחרת? רשום בהערות AAR.', check: () => true },
  { id: 'aar-gen', title: 'הפק AAR מלא', body: 'לחץ "צור AAR" → שלח לקצין הרפואה. כולל זמני תגובה, פגועים, ציוד, לקחים.', check: () => true },
];
let _clDone = new Set();
function renderClosingProtocol() {
  const done = _clDone.size;
  $('cl-done-count').textContent = `${done}/${CLOSING_STEPS.length}`;
  $('cl-body').innerHTML = CLOSING_STEPS.map((step, i) => {
    const isDone = _clDone.has(step.id);
    return `<div class="cl-step ${isDone ? 'done' : ''}" onclick="toggleClStep('${step.id}')">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:28px;flex-shrink:0">${isDone ? '✅' : '⬜'}</div>
        <div style="flex:1">
          <div class="cl-step-num">שלב ${i + 1}</div>
          <div class="cl-step-title" style="color:${isDone ? 'var(--green3)' : '#fff'}">${step.title}</div>
          <div class="cl-step-body">${step.body}</div>
          ${step.id === '101-forms' ? `<button class="btn btn-xs btn-olive" style="margin-top:6px" onclick="event.stopPropagation();openForm101()">📄 פתח טופס 101</button>` : ''}
          ${step.id === 'evac-confirm' ? `<button class="btn btn-xs btn-olive" style="margin-top:6px" onclick="event.stopPropagation();genEvacReport()">🚁 דוח פינוי</button>` : ''}
          ${step.id === 'aar-gen' ? `<button class="btn btn-xs btn-olive" style="margin-top:6px" onclick="event.stopPropagation();genAAR();goScreen('sc-stats');setNav(2)">📊 צור AAR</button>` : ''}
          ${step.id === 'cas-status' && S.casualties.length ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
            ${S.casualties.map(c => `<div style="display:flex;align-items:center;gap:8px;font-size:11px">
              <button onclick="event.stopPropagation();c_confirmClose(${c.id})" style="width:22px;height:22px;border-radius:4px;border:2px solid var(--b1);background:${c.closeConfirmed ? 'var(--green2)' : 'transparent'};cursor:pointer;font-size:12px">${c.closeConfirmed ? '✓' : ''}</button>
              <span class="prio pt${c.priority[1]}">${c.priority}</span>
              <span style="font-weight:700">${escHTML(c.name)}</span>
              <span style="color:var(--muted)">${c.closeConfirmed ? '✓ אושר' : 'ממתין'}</span>
            </div>`).join('')}
          </div>`: ''}
        </div>
      </div>
    </div>`;
  }).join('') +
    (_clDone.size === CLOSING_STEPS.length ? `<div style="background:var(--green);border-radius:10px;padding:20px;text-align:center;margin-top:8px">
    <div style="font-size:32px">✅</div>
    <div style="font-size:18px;font-weight:900;color:var(--white);margin-top:8px">אירוע סגור בהצלחה</div>
    <div style="font-size:12px;color:var(--muted2);margin-top:4px">כל הצ'קים עברו — מצוין!</div>
    <button class="btn btn-lg btn-ghost" style="margin-top:12px" onclick="$('closing-overlay').classList.remove('on');APP_MODE='post';updateNavMode();genAAR();">סגור → תחקיר</button>
  </div>`: '');
}
function toggleClStep(id) { _clDone.has(id) ? _clDone.delete(id) : _clDone.add(id); renderClosingProtocol(); }
function c_confirmClose(casId) { const c = S.casualties.find(x => x.id == casId); if (c) { c.closeConfirmed = !c.closeConfirmed; renderClosingProtocol(); } }

// ═══════════════════════════════════════════════════
// 📋 FORM 101 — PDF
// ═══════════════════════════════════════════════════
function openForm101() {
  $('f101-overlay').style.display = 'block';
  const pick = $('f101-pick');
  if (!S.casualties.length) { pick.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">אין פגועים</div>'; $('f101-content').innerHTML = ''; return; }
  pick.innerHTML = S.casualties.map(c => `
    <button class="btn btn-md btn-ghost btn-full" style="justify-content:flex-start;gap:8px" onclick="render101(${c.id})">
      <span class="prio pt${c.priority[1]}">${c.priority}</span>
      <span style="font-weight:700">${escHTML(c.name)}</span>
      <span style="font-size:10px;color:var(--muted)">🩸${escHTML(c.blood || '?')} · ${c.kg}kg</span>
    </button>`).join('');
  if (S.casualties.length === 1) render101(S.casualties[0].id);
}
function render101(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const tqMin = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
  const pClrMap = { T1: '#c00', T2: '#e80', T3: '#080', T4: '#222' };
  $('f101-content').innerHTML = `
    <div class="f101-page" id="f101-print-${casId}">
      <div class="f101-header">
        <div style="height:8px;background:${pClrMap[c.priority]};border-radius:3px;margin-bottom:8px"></div>
        <div class="f101-title">טופס 101 — דו"ח רפואי שדה</div>
        <div class="f101-sub">IDF Field Medical Report · BENAM Tactical System</div>
        <div class="f101-sub">${nowTime()} · ${escHTML(S.comms.unit || 'יחידה לא צוינה')}</div>
      </div>

      <div class="f101-grid">
        <div class="f101-cell"><div class="f101-lbl">שם מלא</div><div class="f101-val">${escHTML(c.name)}</div></div>
        <div class="f101-cell"><div class="f101-lbl">מספר אישי</div><div class="f101-val">${escHTML(c.idNum || '—')}</div></div>
        <div class="f101-cell"><div class="f101-lbl">סוג דם</div><div class="f101-val" style="color:${pClrMap.T1}">${escHTML(c.blood || 'לא ידוע')}</div></div>
        <div class="f101-cell"><div class="f101-lbl">משקל</div><div class="f101-val">${c.kg} ק"ג</div></div>
        <div class="f101-cell"><div class="f101-lbl">אלרגיה</div><div class="f101-val" style="color:${c.allergy ? '#c00' : '#080'}">${escHTML(c.allergy || 'ללא')}</div></div>
        <div class="f101-cell"><div class="f101-lbl">עדיפות</div><div class="f101-val" style="color:${pClrMap[c.priority]};font-size:16px">${c.priority}</div></div>
      </div>

      <div class="f101-section">
        <div class="f101-sec-hdr">מנגנון פציעה ותיאור</div>
        <div class="f101-body">
          <div><strong>מנגנון:</strong> ${c.mech.join(', ') || 'לא צוין'}</div>
          <div><strong>פציעות:</strong> ${c.injuries.length ? c.injuries.map(i => `<span style="display:inline-flex;align-items:center;gap:2px;margin:1px 3px"><span style="width:8px;height:8px;border-radius:50%;background:${injTypeColor(i.type)};display:inline-block"></span>${i.type} — ${i.zone} <small style="color:#888">(${i.side === 'back' ? 'אחורי' : 'קדמי'})</small></span>`).join('') : 'לא תועד'}</div>
          <div><strong>שעת פציעה:</strong> ${c.time}</div>
        </div>
      </div>

      ${c.injuries.length ? `<div class="f101-section">
        <div class="f101-sec-hdr">מפת פציעות — Body Map</div>
        <div class="f101-body" style="text-align:center">${typeof renderInjuryBodyMap === 'function' ? renderInjuryBodyMap(c.injuries) : ''}</div>
      </div>`: ''}

      ${c.photos && c.photos.length ? `<div class="f101-section">
        <div class="f101-sec-hdr">📷 תמונות</div>
        <div class="f101-body" style="display:flex;flex-wrap:wrap;gap:6px">
          ${c.photos.map(p => `<img src="${p}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ccc">`).join('')}
        </div>
      </div>`: ''}

      <div class="f101-section">
        <div class="f101-sec-hdr">מדדים חיוניים</div>
        <div class="f101-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${[['דופק', c.vitals.pulse, 'bpm'], ['SpO2', c.vitals.spo2, '%'], ['GCS', c.vitals.gcs, '/15'], ['לחץ דם', c.vitals.bp, 'mmHg'], ['נשימות', c.vitals.rr, '/דקה'], ['UPVA', c.vitals.upva, '']].map(([l, v, u]) => `<div><div class="f101-lbl">${l}</div><div style="font-size:14px;font-weight:700">${v || '—'} <small style="font-weight:400;color:#666">${u}</small></div></div>`).join('')}
        </div>
        ${c.vitalsHistory && c.vitalsHistory.length ? `<div style="margin-top:6px;font-size:9px;color:#666">Snapshots: ${c.vitalsHistory.map(s => `${s.t}: P${s.pulse} S${s.spo2}% G${s.gcs}`).join(' | ')}</div>` : ''}
      </div>

      <div class="f101-section">
        <div class="f101-sec-hdr">טיפולים שניתנו</div>
        <div class="f101-body">
          ${c.txList.length ? c.txList.map(t => `<div>• ${t.type} — ${t.time}</div>`).join('') : '<div>לא ניתן טיפול</div>'}
          ${tqMin !== null ? `<div style="color:${tqMin > 45 ? '#c00' : '#080'};font-weight:700">• TQ — ${tqMin} דקות (${c.time})</div>` : ''}
          ${c.fluidTotal ? `<div>• נוזלים: ${c.fluidTotal} ml</div>` : ''}
        </div>
      </div>

      <div class="f101-section">
        <div class="f101-sec-hdr">MARCH — סיכום</div>
        <div class="f101-body" style="display:flex;gap:16px;flex-wrap:wrap">
          ${Object.entries(c.march || {}).map(([k, v]) => `<div><strong>${k}:</strong> ${v} פעולות</div>`).join('')}
        </div>
      </div>

      ${c.notes ? `<div class="f101-section"><div class="f101-sec-hdr">הערות</div><div class="f101-body">${c.notes}</div></div>` : ''}
      ${c.gps ? `<div class="f101-section"><div class="f101-sec-hdr">מיקום GPS</div><div class="f101-body" style="font-family:monospace">${escHTML(c.gps)}</div></div>` : ''}

      <div class="f101-sig">
        <div class="f101-sig-box"><div class="f101-sig-lbl">חובש מטפל — חתימה</div></div>
        <div class="f101-sig-box"><div class="f101-sig-lbl">מפקד — אישור</div></div>
        <div class="f101-sig-box"><div class="f101-sig-lbl">שעת העברה לבי"ח</div></div>
      </div>

      <div style="text-align:center;font-size:9px;color:#888;margin-top:12px;border-top:1px solid #ccc;padding-top:6px">
        BENAM Tactical Medical System · ${new Date().toLocaleString('he-IL')} · מסמך רפואי-משפטי
      </div>
    </div>`;
}
function print101() {
  const content = $('f101-content').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>טופס 101</title><style>
    *{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;font-family:Arial,sans-serif;font-size:11px;}
    .f101-page{padding:20px;max-width:600px;margin:0 auto;}.f101-header{text-align:center;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:12px;}
    .f101-title{font-size:18px;font-weight:900;}.f101-sub{font-size:10px;color:#444;}
    .f101-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:8px;}
    .f101-cell{padding:5px 8px;border-bottom:1px solid #ccc;border-left:1px solid #ccc;}
    .f101-cell:nth-child(odd){border-left:none;}.f101-lbl{font-size:9px;color:#666;font-weight:700;text-transform:uppercase;}
    .f101-val{font-size:12px;font-weight:700;}.f101-section{border:1px solid #000;margin-bottom:8px;}
    .f101-sec-hdr{background:#000;color:#fff;padding:4px 8px;font-size:10px;font-weight:700;}.f101-body{padding:8px;}
    .f101-sig{display:flex;gap:20px;margin-top:16px;padding-top:8px;border-top:1px solid #000;}
    .f101-sig-box{flex:1;border-bottom:1px solid #000;min-height:40px;padding-bottom:4px;}
    .f101-sig-lbl{font-size:9px;color:#666;margin-top:3px;}@media print{@page{margin:10mm;}}
  </style></head><body>${content}</body></html>`);
  w.document.close(); w.focus(); w.print();
}

// ═══════════════════════════════════════════════════
// 📊 PERFORMANCE ANALYTICS
// ═══════════════════════════════════════════════════
function openPerformance() {
  $('perf-overlay').style.display = 'block';
  renderPerformance();
}
function renderPerformance() {
  const pb = $('perf-body'); if (!pb) return;
  if (!S.casualties.length && !S.timeline.length) { pb.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px">אין נתונים עדיין</div>'; return; }
  const now = Date.now();
  const dur = S.missionStart ? Math.floor((now - S.missionStart) / 60000) : 0;
  const t1c = S.casualties.filter(c => c.priority === 'T1').length;
  const treated = S.casualties.filter(c => c.txList.length > 0).length;
  const tqList = S.casualties.filter(c => c.tqStart);
  const avgTQ = tqList.length ? Math.floor(tqList.reduce((s, c) => s + (now - c.tqStart) / 60000, 0) / tqList.length) : 0;
  const escalated = S.casualties.filter(c => c.escalated).length;
  const withVH = S.casualties.filter(c => c.vitalsHistory && c.vitalsHistory.length > 0);

  // time-to-first-tx per casualty
  const ttfx = S.casualties.filter(c => c.txList.length && c._addedAt).map(c => {
    const firstTx = S.timeline.find(e => e.casId == c.id && e.text && e.text !== `פגוע חדש — ${c.priority} — ${c.mech.join(', ')}`);
    return firstTx ? Math.floor((firstTx.ms || 0) - (c._addedAt || 0)) / 60000 : null;
  }).filter(v => v !== null && v >= 0);
  const avgTTFX = ttfx.length ? Math.floor(ttfx.reduce((a, b) => a + b, 0) / ttfx.length) : null;

  pb.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      ${[
      ['⏱', 'זמן אירוע', dur + ' דקות', dur > 90 ? 'var(--amber3)' : 'var(--green3)'],
      ['🔴', 'T1 פגועים', t1c, 'var(--red3)'],
      ['💊', 'קיבלו טיפול', treated + '/' + S.casualties.length, treated === S.casualties.length ? 'var(--green3)' : 'var(--amber3)'],
      ['⬆', 'הוחמרו T2→T1', escalated, escalated > 0 ? 'var(--red3)' : 'var(--green3)'],
      ['⏱', 'TQ ממוצע', avgTQ + ' דקות', avgTQ > 30 ? 'var(--amber3)' : 'var(--green3)'],
      ['💉', 'TXA ניתנו', S.casualties.filter(c => c.txList.some(t => t.type.includes('TXA'))).length, 'var(--olive3)'],
    ].map(([ico, lbl, val, clr]) => `
        <div class="perf-card">
          <div class="perf-metric" style="color:${clr}">${val}</div>
          <div class="perf-lbl">${ico} ${lbl}</div>
        </div>`).join('')}
    </div>

    ${avgTTFX !== null ? `<div class="perf-card">
      <div class="perf-lbl">⚡ ממוצע זמן עד טיפול ראשון</div>
      <div class="perf-metric" style="color:${avgTTFX < 5 ? 'var(--green3)' : avgTTFX < 10 ? 'var(--amber3)' : 'var(--red3)'}">${avgTTFX.toFixed(1)} דקות</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:4px">יעד: פחות מ-5 דקות מרגע הפגיעה</div>
    </div>`: ''}

    <div class="sec" style="padding:8px 0 4px">ציר זמן תגובה לכל פגוע</div>
    ${S.casualties.map(c => {
      const age = c._addedAt ? Math.floor((now - c._addedAt) / 60000) : 0;
      const txCount = c.txList.length;
      const pct = Math.min(1, txCount / 5);
      return `<div class="perf-card" style="padding:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span class="prio pt${c.priority[1]}">${c.priority}</span>
          <span style="font-weight:700;flex:1">${escHTML(c.name)}</span>
          <span style="font-size:10px;color:var(--muted)">${age} דקות</span>
        </div>
        <div class="perf-bar-wrap">
          <div class="perf-bar" style="width:${pct * 100}%;background:${pct < 0.3 ? 'var(--red2)' : pct < 0.7 ? 'var(--amber)' : 'var(--green2)'}"></div>
        </div>
        <div style="font-size:9px;color:var(--muted2);margin-top:3px">${txCount} טיפולים · ${c.vitalsHistory?.length || 0} snapshots</div>
        <div class="timeline-micro">${S.timeline.filter(e => e.casId == c.id).map(e => e.time + ' ' + e.text).join(' → ') || 'אין פעולות'}</div>
      </div>`;
    }).join('')}

    <div class="perf-card">
      <div class="perf-lbl">📋 לקחים אוטומטיים</div>
      <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px;font-size:11px;line-height:1.7">
        ${avgTQ > 45 ? `<div style="color:var(--red3)">⚠ TQ ממוצע גבוה מ-45 דקות — שקול שחרור מוקדם יותר</div>` : ''}
        ${escalated > 0 ? `<div style="color:var(--amber3)">⚡ ${escalated} פגועים הוחמרו — חזק מעקב ויטלים תדיר יותר</div>` : ''}
        ${treated < S.casualties.length ? `<div style="color:var(--red3)">⚠ ${S.casualties.length - treated} פגועים ללא טיפול — בדוק מיד</div>` : ''}
        ${avgTTFX && avgTTFX > 10 ? `<div style="color:var(--amber3)">🕐 זמן לטיפול ראשון ארוך — שקול שיפור חלוקת חובשים</div>` : ''}
        ${S.casualties.filter(c => !c.vitals.pulse).length > 0 ? `<div style="color:var(--muted2)">📊 ויטלים חסרים ב-${S.casualties.filter(c => !c.vitals.pulse).length} פגועים — עדכן ל-AAR</div>` : ''}
        <div style="color:var(--green3)">✓ מגמה כוללת: ${treated}/${S.casualties.length} פגועים טופלו תוך ${dur} דקות</div>
      </div>
    </div>`;
}
function genEvacReport() {
  const evacList = S.casualties.filter(c => c.evacuated || (c.evacPipeline && c.evacPipeline.stage === 'done'));
  if (!evacList.length) {
    showToast('⚠️ אין פגועים שפונו לתיעוד');
    return;
  }

  try {
    const report = evacList.map((c, i) => {
      const treatments = c.txList.map(t => t.type).join(', ');
      return `פצוע ${i + 1}: ${c.name} (${c.priority})\nמצב: ${c.vitals.pulse || '?'}/${c.vitals.spo2 || '?'}\nטיפול: ${treatments || 'בסיסי'}\n---`;
    }).join('\n');

    openModal('🚁 דו"ח פינוי מסכם', `
      <div class="pad col" style="gap:12px">
        <div style="font-size:12px;color:var(--muted);line-height:1.6">סיכום פגועים לפינוי (Copy-Paste לקשר / ווטסאפ):</div>
        <textarea class="inp" style="height:200px;font-family:monospace;font-size:11px;background:#000" id="evac-report-tx" readonly>${report}</textarea>
        <div style="display:flex;gap:8px">
          <button class="btn btn-lg btn-olive" style="flex:1" onclick="copyToClipboard(document.getElementById('evac-report-tx').value)">העתק 📋</button>
          <button class="btn btn-lg btn-ghost" style="flex:1" onclick="closeModal()">סגור</button>
        </div>
      </div>
    `);
  } catch (e) {
    console.error(e);
    showToast('❌ שגיאה בהפקת דוח פינוי');
  }
}

if (typeof window !== 'undefined') {
  window.genEvacReport = genEvacReport;
  window.openForm101 = openForm101;
  window.render101 = render101;
  window.print101 = print101;
  // genAAR is defined in 15-handoff-reports.js — just reference it directly, no wrapper
  // (a wrapper would cause infinite recursion since genAAR resolves to window.genAAR)
}

// ═══════════════════════════════════════════════════
// ⚠️ SITUATION AWARENESS PULSE
// ═══════════════════════════════════════════════════
let _saInterval = null, _saLastAck = 0;
function startSAPulse() {
  if (_saInterval) return;
  _saInterval = setInterval(() => { try {
    if (!S.missionActive) return;
    const sinceAck = (Date.now() - _saLastAck) / 60000;
    if (sinceAck > 8) {
      $('sa-pulse').classList.add('on');
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
  } catch (e) { console.error('[SA Pulse]', e); } }, 60000);
}
function openSAPulse() {
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  openModal('⚠️ SA Pulse — אשר מצב', `
    <div class="pad col">
      <div style="font-size:12px;color:var(--muted2);margin-bottom:8px">המפקד מאשר שידוע לו על מצב כל הפגועים</div>
      ${sorted.map(c => `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--b0)">
        <span class="prio pt${c.priority[1]}">${c.priority}</span>
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px">${escHTML(c.name)}</div>
          <div style="font-size:10px;color:var(--muted2)">${c.txList.length} טיפולים · ${c.medic ? '🩺' + escHTML(c.medic) : 'ללא חובש'}</div>
        </div>
        <div style="font-size:10px;color:${c.priority === 'T1' ? 'var(--red3)' : 'var(--muted2)'}">${c.tqStart ? 'TQ ⏱' : ''}</div>
      </div>`).join('')}
      ${!sorted.length ? '<div style="color:var(--muted);text-align:center;padding:12px">אין פגועים פעילים</div>' : ''}
      <button class="btn btn-xl btn-green btn-full" style="margin-top:10px;background:var(--green2)" onclick="ackSAPulse()">✅ ידוע לי — אשר מצב</button>
    </div>`);
}
function ackSAPulse() {
  _saLastAck = Date.now();
  $('sa-pulse').classList.remove('on');
  addTL('sys', 'SYSTEM', 'SA Pulse — מפקד אישר מצב ✅', 'green');
  forceClose(); 
  showToast('✅ SA Pulse אושר');
  if (typeof renderUpdateCenter === 'function') renderUpdateCenter();
}
// Start after mission
const _origStartMission = startMission;

// ═══════════════════════════════════════════════════
// 📋 SMART CHECKLIST ENGINE
// ═══════════════════════════════════════════════════
const SCL_MASTER = [
  // Always
  { id: 'tq-all', cat: 'M', prio: 'always', lbl: 'כל TQ תועד עם שעה מדויקת', sub: 'חובה — מידע משפטי-רפואי', cas: null },
  { id: 'txa-all', cat: 'C', prio: 'always', lbl: 'TXA — בדוק חלון (3h) לכל T1', sub: 'כלל הזמן: מרגע הפציעה', cas: null },
  { id: 'airway-all', cat: 'A', prio: 'always', lbl: 'כל פגוע — נתיב אוויר פתוח', sub: 'ראש, NPA, שאיבה', cas: null },
  { id: 'vitals-snap', cat: 'C', prio: 'always', lbl: 'ויטלים — snapshot כל 10 דקות', sub: 'דופק, SpO2, GCS', cas: null },
  { id: 'buddy-assign', cat: 'H', prio: 'always', lbl: 'כל פגוע שוייך לחובש', sub: 'מנע "אין מטפל"', cas: null },
  // T1 specific
  { id: 't1-march', cat: 'M', prio: 'T1', lbl: 'T1 — MARCH ראשוני הושלם', sub: '5 שלבים: M A R C H', cas: 'T1' },
  { id: 't1-iv', cat: 'C', prio: 'T1', lbl: 'T1 — IV/IO פתוח', sub: 'נוזלים לפי לחץ דם', cas: 'T1' },
  { id: 't1-evac', cat: 'H', prio: 'T1', lbl: 'T1 — תואם לפינוי', sub: 'סלוט פינוי שוייך', cas: 'T1' },
  // TQ specific
  { id: 'tq-45', cat: 'M', prio: 'tq', lbl: 'TQ > 30 דקות — הערכה מחדש', sub: 'שחרור זמני / לחץ ישיר', cas: 'tq' },
  { id: 'tq-doc', cat: 'M', prio: 'tq', lbl: 'TQ — תועד בטופס 101', sub: 'שעת שים, מיקום, סיבה', cas: 'tq' },
  // Per-casualty
  { id: 'allergy-check', cat: 'C', prio: 'allergy', lbl: 'אלרגיה — תועדה לכל המטפלים', sub: 'ברור לכל הצוות', cas: 'allergy' },
  { id: 'blood-doc', cat: 'C', prio: 'always', lbl: 'סוג דם — מתועד לכל פגוע', sub: 'קריטי לטרנספוזיה', cas: null },
];

let _sclDone = new Set();
let _sclFilter = 'all';
function openSmartChecklist(filter) {
  _sclFilter = filter || 'all';
  $('scl-overlay').classList.add('on');
  renderSmartChecklist();
}
function renderSmartChecklist() {
  // Build relevant items based on current casualties
  const hasTQ = S.casualties.some(c => c.tqStart);
  const hasT1 = S.casualties.some(c => c.priority === 'T1');
  const hasAllergy = S.casualties.some(c => c.allergy);
  let items = SCL_MASTER.filter(i => {
    if (i.prio === 'always') return true;
    if (i.prio === 'T1') return hasT1;
    if (i.prio === 'tq') return hasTQ;
    if (i.prio === 'allergy') return hasAllergy;
    return true;
  });
  // Per-casualty expansion
  const expanded = [];
  S.casualties.forEach(c => {
    expanded.push({ id: `cas-${c.id}-vitals`, cat: 'C', lbl: `${escHTML(c.name)} — ויטלים עדכניים`, sub: `${c.priority} · ${c.kg}kg`, casId: c.id });
    if (c.priority === 'T1') expanded.push({ id: `cas-${c.id}-march`, cat: 'M', lbl: `${escHTML(c.name)} — MARCH הושלם`, sub: '5 שלבים', casId: c.id });
    if (c.tqStart) { const m = Math.floor((Date.now() - c.tqStart) / 60000); expanded.push({ id: `cas-${c.id}-tq`, cat: 'M', lbl: `${escHTML(c.name)} — TQ ${m} דקות`, sub: m > 45 ? '⚠ סכנת עצב!' : 'בטווח תקין', casId: c.id, crit: m > 45 }); }
  });
  const allItems = [...items, ...expanded];
  const done = allItems.filter(i => _sclDone.has(i.id)).length;
  $('scl-progress-lbl').textContent = `${done}/${allItems.length}`;
  const cats = [...new Set(allItems.map(i => i.cat))];
  $('scl-filter').innerHTML = `<button class="btn btn-xs ${_sclFilter === 'all' ? 'btn-olive' : 'btn-ghost'}" onclick="setSCLFilter('all')">הכל</button>` +
    cats.map(c => `<button class="btn btn-xs ${_sclFilter === c ? 'btn-olive' : 'btn-ghost'}" onclick="setSCLFilter('${c}')">${c}</button>`).join('');
  const filtered = _sclFilter === 'all' ? allItems : allItems.filter(i => i.cat === _sclFilter);
  $('scl-body').innerHTML = filtered.map(item => {
    const done = _sclDone.has(item.id);
    return `<div class="scl-item ${done ? 'done-item' : ''}" onclick="toggleSCL('${item.id}')">
      <div class="scl-cb ${done ? 'checked' : ''}">${done ? '✓' : ''}</div>
      <div style="flex:1">
        <div class="scl-lbl" style="${item.crit ? 'color:var(--red3)' : ''}">${item.lbl}</div>
        <div class="scl-sub">${item.sub || ''}</div>
      </div>
      <div style="font-size:10px;font-weight:700;color:var(--olive3)">${item.cat}</div>
    </div>`;
  }).join('') || '<div style="padding:20px;text-align:center;color:var(--muted)">אין פריטים</div>';
}
function toggleSCL(id) { _sclDone.has(id) ? _sclDone.delete(id) : _sclDone.add(id); renderSmartChecklist(); }
function setSCLFilter(f) { _sclFilter = f; renderSmartChecklist(); }

// ═══════════════════════════════════════════════════
// 🤖 OFFLINE AI TRIAGE
// ═══════════════════════════════════════════════════
let _aitMech = [];
function togAITMech(btn, m) {
  const i = _aitMech.indexOf(m);
  if (i >= 0) { _aitMech.splice(i, 1); btn.className = 'btn btn-xs btn-ghost'; }
  else { _aitMech.push(m); btn.className = 'btn btn-xs btn-olive'; }
}
function runOfflineAI() {
  const pulse = parseInt($('ait-pulse')?.value) || 0;
  const spo2 = parseInt($('ait-spo2')?.value) || 0;
  const gcs = parseInt($('ait-gcs')?.value) || 15;
  const sbp = parseInt($('ait-sbp')?.value) || 120;
  const rr = parseInt($('ait-rr')?.value) || 16;
  const mech = [..._aitMech];

  // Scoring algorithm
  let score = 0;
  const issues = [];
  const recs = [];

  // Airway / Breathing
  if (rr < 8 || rr > 30) { score += 30; issues.push(`נשימות ${rr}/דקה — לא תקין`); recs.push('פתח נתיב אוויר · NPA · שאיבה'); }
  if (spo2 < 90) { score += 35; issues.push(`SpO2 ${spo2}% — היפוקסיה קריטית`); recs.push('חמצן מיידי · שקול intubation'); }
  else if (spo2 < 94) { score += 15; issues.push(`SpO2 ${spo2}% — נמוך`); recs.push('מעקב נשימות · Position'); }

  // Circulation
  if (pulse > 120) { score += 20; issues.push(`דופק ${pulse} — טכיקרדיה`); recs.push('IV/IO · NaCl 250ml · חשד לדימום'); }
  if (pulse < 50) { score += 30; issues.push(`דופק ${pulse} — ברדיקרדיה`); recs.push('בדוק פרפיוזיה · שקול atropine'); }
  if (sbp > 0 && sbp < 80) { score += 40; issues.push(`SBP ${sbp} — הלם`); recs.push('PERMISSIVE HYPOTENSION · NaCl · TXA'); }
  else if (sbp > 0 && sbp < 90) { score += 20; issues.push(`SBP ${sbp} — גבולי`); recs.push('מעקב קפדני · IV access'); }

  // Neuro
  if (gcs < 9) { score += 35; issues.push(`GCS ${gcs} — חסר הכרה קשה`); recs.push('Recovery position · Airway protection · TBI protocol'); }
  else if (gcs < 13) { score += 20; issues.push(`GCS ${gcs} — הכרה מופחתת`); recs.push('מעקב נוירולוגי · אל תיתן אופיואידים'); }

  // Mechanism
  if (mech.includes('ירי') || mech.includes('רסיס')) { score += 15; recs.push('בדוק כניסה + יציאה · Chest Seal אם צריך'); }
  if (mech.includes('פיצוץ')) { score += 10; recs.push('Blast injury — בדוק TM, ריאות, בטן'); }
  if (mech.includes('TBI') || mech.includes('ראש')) { score += 15; recs.push('TBI: שמור SBP>90 · אל תיתן היפוטונית · GCS serial'); }
  if (mech.includes('חזה')) { score += 10; recs.push('Chest Seal · Needle decompression אם נדרש'); }

  // Priority
  const prio = score >= 50 ? 'T1' : score >= 25 ? 'T2' : score >= 10 ? 'T3' : 'T3';
  const pColor = { T1: '#c00', T2: '#e80', T3: '#080' }[prio];
  const shockIdx = pulse && sbp ? ((pulse / sbp).toFixed(2)) : null;

  $('ai-result').innerHTML = `
    <div class="ai-offline-box">
      <div class="ai-score" style="color:${pColor}">${prio}</div>
      <div class="ai-grade" style="color:${pColor}">${prio === 'T1' ? 'IMMEDIATE — טיפול מיידי' : prio === 'T2' ? 'DELAYED — דחוף' : score < 5 ? 'MINIMAL — קל' : 'MINIMAL — מעקב'}</div>
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted2);text-align:center;margin-top:4px">ציון סיכון: ${score}/100 ${shockIdx ? `· Shock Index: ${shockIdx}` : ''}</div>
      ${issues.length ? `<div style="margin-top:10px;font-size:11px;display:flex;flex-direction:column;gap:4px">${issues.map(i => `<div style="color:var(--red3)">⚠ ${i}</div>`).join('')}</div>` : '<div style="color:var(--green3);font-size:12px;margin-top:8px">✓ אין ממצאים קריטיים</div>'}
      <div class="ai-recs" style="margin-top:10px;border-top:1px solid var(--b0);padding-top:10px">
        <div style="font-size:10px;color:var(--olive3);font-weight:700;margin-bottom:5px">המלצות טיפול:</div>
        ${recs.length ? recs.map(r => `<div>▶ ${r}</div>`).join('') : '<div style="color:var(--muted)">✓ טיפול תומך · מעקב ויטלים</div>'}
        ${shockIdx && parseFloat(shockIdx) > 1 ? `<div style="color:var(--red3);font-weight:700;margin-top:6px">⚠ Shock Index ${shockIdx} — חשד גבוה להלם היפובולמי</div>` : ''}
      </div>
      <button class="btn btn-md btn-olive btn-full" style="margin-top:10px" onclick="applyAIResult('${prio}')">✓ צור פגוע עם ${prio}</button>
    </div>`;
}
function applyAIResult(prio) {
  $('ai-overlay').style.display = 'none';
  openAddCas();
  setTimeout(() => {
    const sel = $('nc-prio'); if (sel) sel.value = prio;
  }, 100);
}

// ═══════════════════════════════════════════════════
// 💊 MEDICATION INTERACTION CHECK
// ═══════════════════════════════════════════════════
const MED_INTERACTIONS = {
  'מורפין+קטמין': { level: 'warn', msg: 'שניהם משתקי CNS — פחת מינון מורפין ב-50%. מעקב נשימות קפדני.' },
  'קטמין+TXA': { level: 'ok', msg: 'תרופות אלו בטוחות לשימוש משולב בשטח.' },
  'מורפין+NSAIDs': { level: 'warn', msg: 'NSAIDs מגבירים סיכון לדימום GI. הימנע אם חשד לדימום בטני.' },
  'TXA+NaCl': { level: 'ok', msg: 'תואמים. ניתן בנפרד — TXA 10 דקות, לאחר מכן NaCl.' },
  'מורפין+אלרגיה-מורפין': { level: 'crit', msg: '⛔ אלרגיה ידועה למורפין! החלף בקטמין IV 0.5mg/kg.' },
  'קטמין+אלרגיה-קטמין': { level: 'crit', msg: '⛔ אלרגיה ידועה לקטמין! החלף במורפין אם ל-BP>80.' },
  'NSAIDs+אלרגיה-NSAIDs': { level: 'crit', msg: '⛔ אלרגיה ידועה ל-NSAIDs! הימנע לחלוטין.' },
};
function openMedInteractions() {
  $('medint-overlay').style.display = 'block';
  const pick = $('medint-pick');
  if (!S.casualties.length) { pick.innerHTML = '<div style="color:var(--muted)">אין פגועים</div>'; $('medint-result').innerHTML = ''; return; }
  pick.innerHTML = `<div style="font-size:11px;color:var(--muted2);margin-bottom:6px">בחר פגוע לבדיקה:</div>` +
    S.casualties.map(c => `<button class="btn btn-sm btn-ghost btn-full" style="justify-content:flex-start;gap:6px;margin-bottom:4px" onclick="checkMedInter(${c.id})">
      <span class="prio pt${c.priority[1]}">${c.priority}</span>
      <span style="font-weight:700">${escHTML(c.name)}</span>
      ${c.allergy ? `<span style="font-size:9px;color:var(--amber3)">⚠${escHTML(c.allergy)}</span>` : ''}
    </button>`).join('');
}
function checkMedInter(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const meds = c.txList.map(t => t.type.replace(/ .*/, ''));
  const results = [];
  // Check pairwise
  meds.forEach((m1, i) => meds.slice(i + 1).forEach(m2 => {
    const key = [m1, m2].sort().join('+');
    const key2 = [m2, m1].join('+');
    const inter = MED_INTERACTIONS[key] || MED_INTERACTIONS[key2];
    if (inter) results.push({ combo: `${m1} + ${m2}`, ...inter });
  }));
  // Check allergies
  if (c.allergy) {
    meds.forEach(m => {
      const key = `${m}+אלרגיה-${c.allergy}`;
      const inter = MED_INTERACTIONS[key];
      if (inter) results.push({ combo: `${m} + אלרגיה ל-${c.allergy}`, ...inter });
    });
  }
  const lvlCls = { ok: 'med-inter-ok', warn: 'med-inter-warn', crit: 'med-inter-crit' };
  $('medint-result').innerHTML = `
    <div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--white)">בדיקה: ${escHTML(c.name)}</div>
    <div style="font-size:11px;color:var(--muted2);margin-bottom:8px">תרופות: ${meds.join(', ') || 'אין'} · אלרגיה: ${escHTML(c.allergy || 'ללא')}</div>
    ${results.map(r => `<div class="${lvlCls[r.level]}">
      <div style="font-weight:700">${r.level === 'crit' ? '⛔' : r.level === 'warn' ? '⚠' : '✓'} ${escHTML(r.combo)}</div>
      <div style="margin-top:3px;font-size:10px">${r.msg}</div>
    </div>`).join('')}
    ${!results.length ? `<div style="background:var(--min-bg);border:1px solid var(--green2);border-radius:6px;padding:10px;font-size:12px;color:var(--green3)">✅ אין אינטראקציות ידועות — שילוב תרופות בטוח</div>` : ''}`;
}

// ═══════════════════════════════════════════════════
// 🎓 TRAINING MODE
// ═══════════════════════════════════════════════════
const TRAINING_SCENARIOS = [
  {
    id: 'basic', title: 'תרחיש בסיסי — ירי', difficulty: 'קל',
    casualties: [
      { name: 'דני לוי', blood: 'O+', kg: 75, priority: 'T1', mech: ['ירי'], allergy: '', injuries: [{ type: 'ירי', zone: 'חזה', side: 'front' }], vitals: { pulse: '124', spo2: '89', gcs: '12', bp: '88', rr: '28', upva: 'V' } },
      { name: 'שרה כהן', blood: 'A+', kg: 60, priority: 'T2', mech: ['פיצוץ'], allergy: 'מורפין', injuries: [{ type: 'רסיס', zone: 'יד שמאל', side: 'front' }], vitals: { pulse: '102', spo2: '94', gcs: '14', bp: '102', rr: '20', upva: 'A' } },
    ],
    expectedActions: ['TQ', 'Chest Seal', 'TXA'],
    timeLimit: 5,
  },
  {
    id: 'mascal', title: 'MASCAL — 6 פגועים', difficulty: 'קשה',
    casualties: [
      { name: 'איל ברק', blood: 'B+', kg: 82, priority: 'T1', mech: ['ירי', 'פיצוץ'], allergy: '', injuries: [{ type: 'ירי', zone: 'רגל ימין', side: 'front' }], vitals: { pulse: '130', spo2: '90', gcs: '11', bp: '84', rr: '30', upva: 'V' } },
      { name: 'מיכל גל', blood: 'O-', kg: 58, priority: 'T2', mech: ['פיצוץ'], allergy: 'קטמין', injuries: [{ type: 'רסיס', zone: 'בטן', side: 'front' }], vitals: { pulse: '110', spo2: '93', gcs: '13', bp: '96', rr: '24', upva: 'V' } },
      { name: 'רם שמש', blood: 'AB+', kg: 90, priority: 'T1', mech: ['ירי'], allergy: '', injuries: [{ type: 'ירי', zone: 'חזה', side: 'front' }], vitals: { pulse: '136', spo2: '86', gcs: '10', bp: '78', rr: '32', upva: 'V' } },
      { name: 'נגה ים', blood: 'A-', kg: 67, priority: 'T3', mech: ['נפילה'], allergy: 'NSAIDs', injuries: [{ type: 'שבר', zone: 'רגל שמאל', side: 'front' }], vitals: { pulse: '92', spo2: '97', gcs: '15', bp: '112', rr: '18', upva: 'A' } },
      { name: 'אסף מור', blood: 'O+', kg: 85, priority: 'T2', mech: ['רסיס'], allergy: '', injuries: [{ type: 'רסיס', zone: 'יד ימין', side: 'front' }], vitals: { pulse: '106', spo2: '95', gcs: '14', bp: '100', rr: '21', upva: 'A' } },
      { name: 'טל רן', blood: 'B-', kg: 72, priority: 'T4', mech: ['פיצוץ'], allergy: '', injuries: [{ type: 'מוות', zone: 'חזה', side: 'front' }], vitals: { pulse: '0', spo2: '0', gcs: '3', bp: '0', rr: '0', upva: 'U' } },
    ],
    expectedActions: ['TQ', 'TXA', '9-LINE', 'Evac'],
    timeLimit: 10,
  },
  {
    id: 'tbi', title: 'TBI + הלם', difficulty: 'בינוני',
    casualties: [
      { name: 'גבי נחום', blood: 'A+', kg: 80, priority: 'T1', mech: ['TBI', 'פיצוץ'], allergy: '', injuries: [{ type: 'TBI', zone: 'ראש', side: 'front' }], vitals: { pulse: '110', spo2: '92', gcs: '8', bp: '85', rr: '22', upva: 'V' } },
    ],
    expectedActions: ['Airway', 'GCS', 'BP target 90-100'],
    timeLimit: 3,
  },
];

let _trainActive = false, _trainScen = null, _trainStart = 0, _trainScore = 0;

function _deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function generateTrainingScenario(difficulty = 'בינוני') {
  const titles = {
    'קל': ['אימון שגרתי', 'פציעה בודדת', 'חבלה באחימ'],
    'בינוני': ['אר"ן קטן', 'פגיעת רסיסים נרחבת', 'אירוע משולב'],
    'קשה': ['אר"ן מורכב', 'פגיעות הדף וחטיפה', 'מר"פ תחת אש']
  };
  const injuries = [
    { zone: 'חזה', type: 'פצע ירי', severity: 'קריטי', action: 'chest seal' },
    { zone: 'רגל ימין', type: 'פצע קטיעה', severity: 'קריטי', action: 'tq' },
    { zone: 'יד שמאל', type: 'דימום פורץ', severity: 'בינוני', action: 'tq' },
    { zone: 'בטן', type: 'רסיס', severity: 'בינוני', action: 'txa' },
    { zone: 'ראש', type: 'TBI', severity: 'קריטי', action: 'airway' }
  ];
  
  const casCount = difficulty === 'קל' ? 1 : difficulty === 'בינוני' ? 3 : 5;
  const timeLimit = difficulty === 'קל' ? 5 : difficulty === 'בינוני' ? 12 : 20;
  
  const scCas = [];
  const actions = new Set();
  
  for(let i=0; i<casCount; i++) {
    const inj = injuries[Math.floor(Math.random() * injuries.length)];
    scCas.push({
      name: `פצוע תרגול ${i+1}`,
      priority: inj.severity === 'קריטי' ? 'T1' : 'T2',
      injuries: [ { zone: inj.zone, type: inj.type, side: 'front' } ],
      vitals: { pulse: '120', spo2: '92', bp: '90/60', rr: '24', gcs: '14', upva: 'V' }
    });
    actions.add(inj.action);
  }
  
  const sc = {
    id: 'dynamic-' + Date.now(),
    title: titles[difficulty][Math.floor(Math.random() * titles[difficulty].length)] + ' (דינמי)',
    difficulty,
    timeLimit,
    casualties: scCas,
    expectedActions: Array.from(actions)
  };
  
  return sc;
}

function startDynamicTraining(diff) {
  try {
    if (typeof generateTrainingScenario !== 'function') throw new Error('Generator not found');
    const sc = generateTrainingScenario(diff);
    if (!window.TRAINING_SCENARIOS) window.TRAINING_SCENARIOS = [];
    TRAINING_SCENARIOS.push(sc);
    startTraining(sc.id);
  } catch (e) {
    console.error(e);
    showToast('❌ שגיאה ביצירת תרחיש דינמי');
  }
}

function _normalizeTrainingInjury(inj) {
  const map = { רגל: 'רגל ימין', יד: 'יד ימין' };
  return {
    ...inj,
    zone: map[inj?.zone] || inj?.zone || 'חזה',
    side: inj?.side || 'front'
  };
}

function _trainingActionMatchers(act) {
  const key = (act || '').toLowerCase();
  const defs = {
    'tq': ['tq', 'tourniquet', 'חוסם'],
    'chest seal': ['chest seal', 'hyfin', 'asherman', 'seal'],
    'txa': ['txa'],
    '9-line': ['9-line', '9 line', 'medevac', 'פינוי רפואי'],
    'evac': ['evac', 'פינוי', 'hospital', 'pickup', 'transit'],
    'airway': ['airway', 'npa', 'נתיב אוויר'],
    'gcs': ['gcs'],
    'bp target 90-100': ['bp', 'לחץ דם', 'sbp']
  };
  return defs[key] || [key];
}

function _trainingActionDone(act, performed, tl) {
  const needles = _trainingActionMatchers(act);
  return needles.some(n => performed.some(p => p.includes(n)) || tl.some(t => t.includes(n)));
}

function openTraining() {
  $('train-overlay').style.display = 'block';
  renderTrainingMenu();
}
function renderTrainingMenu() {
  $('train-body').innerHTML = `
    <div style="font-size:12px;color:var(--muted2);margin-bottom:16px;line-height:1.6">בחר תרחיש תרגול או צור תרחיש דינמי חדש.</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
      <button class="btn btn-sm" onclick="startDynamicTraining('קל')" style="background:var(--s1);color:var(--green3);border-color:var(--green3);font-size:10px">🤖 קל</button>
      <button class="btn btn-sm" onclick="startDynamicTraining('בינוני')" style="background:var(--s1);color:var(--amber3);border-color:var(--amber3);font-size:10px">🤖 בינוני</button>
      <button class="btn btn-sm" onclick="startDynamicTraining('קשה')" style="background:var(--s1);color:var(--red3);border-color:var(--red3);font-size:10px">🤖 קשה</button>
    </div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px">תרחישים קבועים:</div>
    ${TRAINING_SCENARIOS.map(s => `
      <div style="background:var(--glass-bg-surface);border:2px solid var(--blue2);border-radius:10px;padding:14px;margin-bottom:10px;cursor:pointer" onclick="startTraining('${s.id}')">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div style="font-size:15px;font-weight:900;color:var(--olive3);flex:1">${s.title}</div>
          <div style="font-size:10px;padding:3px 8px;border-radius:4px;background:${{ קל: 'var(--s1)', בינוני: 'var(--s1)', קשה: 'var(--s1)' }[s.difficulty]};color:${{ קל: 'var(--green3)', בינוני: 'var(--amber3)', קשה: 'var(--red3)' }[s.difficulty]}">${s.difficulty}</div>
        </div>
        <div style="font-size:11px;color:var(--muted2)">${s.casualties.length} פגועים · מגבלת זמן: ${s.timeLimit} דקות</div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">פעולות מצופות: ${s.expectedActions.join(' · ')}</div>
      </div>`).join('')}
    ${_trainActive ? `<div style="background:var(--glass-bg-surface);border:1px solid var(--blue2);border-radius:8px;padding:12px;margin-top:8px">
      <div style="font-size:12px;font-weight:700;color:var(--olive3);margin-bottom:8px">📊 תרגול אחרון:</div>
      <div class="train-score-box"><div class="train-score">${_trainScore}</div><div class="train-grade">${_trainScore >= 85 ? 'מצוין ⭐' : _trainScore >= 70 ? 'טוב מאוד' : _trainScore >= 55 ? 'טוב' : 'יש לשפר'}</div></div>
    </div>`: ''}`;
}
function startTraining(scenId) {
  const scen = TRAINING_SCENARIOS.find(s => s.id === scenId); if (!scen) return;
  _trainScen = scen; _trainActive = true; _trainStart = Date.now();
  $('training-bar').classList.add('on');
  $('train-overlay').style.display = 'none';

  // Clear and load scenario
  S.timeline = [];
  const loaded = scen.casualties.map(c => {
    const cc = _deepClone(c);
    cc.injuries = (cc.injuries || []).map(_normalizeTrainingInjury);
    if (!cc.vitals || typeof cc.vitals !== 'object') cc.vitals = { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' };
    return cc;
  });
  S.casualties = loaded.map((c, i) => ({
    id: Date.now() + i, ...c,
    idNum: '', time: nowTime(), tqStart: null,
    txList: [], injuries: c.injuries || [], photos: [],
    vitals: c.vitals || { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
    fluids: [], fluidTotal: 0, march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
    vitalsHistory: [], _addedAt: Date.now(), _training: true
  }));
  S.missionStart = Date.now(); S.missionActive = true;
  { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display=''; } $('fire-toggle-btn').style.display = '';
  { const _nf = $('nav-fire'); if (_nf) _nf.style.display = 'flex'; } { const vb = $('voice-btn'); if (vb) vb.style.display = ''; }
  const ph = $('tb-phase'); ph.textContent = 'TRAIN'; ph.className = 'tb-phase ph-active';
  startGoldenHour();
  renderWarRoom(); goScreen('sc-war'); setNav(1);
  showToast(`🎓 תרגול: ${scen.title} — ${scen.timeLimit} דקות`);
  addTL('sys', 'SYSTEM', `🎓 Training: ${scen.title}`, 'green');

  // Auto-grade after time limit
  setTimeout(() => gradeTraining(), scen.timeLimit * 60000);
}
function gradeTraining() {
  if (!_trainActive || !_trainScen) return;
  _trainActive = false;
  $('training-bar').classList.remove('on');
  const elapsed = Math.floor((Date.now() - _trainStart) / 60000);
  let score = 100; const feedback = [];

  // Check expected actions
  const performed = S.casualties.flatMap(c => c.txList.map(t => String(t.type || '').toLowerCase()));
  const tl = S.timeline.map(e => String(e.text || '').toLowerCase());
  _trainScen.expectedActions.forEach(act => {
    const found = _trainingActionDone(act, performed, tl);
    if (!found) { score -= 15; feedback.push(`❌ לא בוצע: ${act}`); }
    else feedback.push(`✅ ${act}`);
  });

  // Time bonus
  if (elapsed <= _trainScen.timeLimit / 2) { score += 10; feedback.push('⚡ זמן מצוין!'); }
  else if (elapsed > _trainScen.timeLimit) { score -= 10; feedback.push('⏱ חרגת מהזמן'); }

  // T1 treated
  const t1Treated = S.casualties.filter(c => c.priority === 'T1' && c.txList.length > 0).length;
  const t1Total = S.casualties.filter(c => c.priority === 'T1').length;
  if (t1Treated < t1Total) { score -= 20; feedback.push(`⚠ ${t1Total - t1Treated} T1 ללא טיפול`); }

  score = Math.max(0, Math.min(100, score));
  _trainScore = score;

  openModal(`🎓 תוצאות תרגול — ${_trainScen.title}`, `
    <div class="pad col">
      <div class="train-score-box">
        <div class="train-score">${score}</div>
        <div class="train-grade">${score >= 85 ? 'מצוין ⭐⭐⭐' : score >= 70 ? 'טוב מאוד ⭐⭐' : score >= 55 ? 'טוב ⭐' : 'יש לשפר'}</div>
      </div>
      <div style="font-size:13px;font-weight:700;margin:8px 0 4px">פירוט:</div>
      ${feedback.map(f => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--b0)">${f}</div>`).join('')}
      <div style="font-size:11px;color:var(--muted2);margin-top:6px">זמן: ${elapsed} דקות מתוך ${_trainScen.timeLimit}</div>
      <button class="btn btn-lg btn-olive btn-full" onclick="forceClose();openTraining()">🔄 תרגול נוסף</button>
      <button class="btn btn-md btn-ghost btn-full" onclick="forceClose();clearTraining()">✕ סיים תרגול</button>
    </div>`);
}
function clearTraining() {
  S.casualties = []; S.timeline = []; S.missionActive = false; S.missionStart = null;
  localStorage.removeItem('benam_s');
  // Clean up pre-training backup to free storage quota for real mission data
  localStorage.removeItem('benam_backup_pre_training');
  localStorage.removeItem('benam_s_training');
  localStorage.removeItem('benam_s_training_backup');
  { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display='none'; } $('fire-toggle-btn').style.display = 'none';
  { const _nf = $('nav-fire'); if (_nf) _nf.style.display = 'none'; } $('training-bar').classList.remove('on');
  const ph = $('tb-phase'); ph.textContent = 'PREP'; ph.className = 'tb-phase ph-prep';
  renderWarRoom(); goScreen('sc-prep'); setNav(0);
}

// ─── auto-refresh stats every 10s when visible ───
setInterval(() => {
  try { if (document.hidden) return; const el = $('stats-grid'); if (el && $('sc-stats').classList.contains('active')) renderStats(); } catch (_) {}
}, 10000);

if (typeof window !== 'undefined') {
  window.openTraining = openTraining;
  window.startTraining = startTraining;
  window.startDynamicTraining = startDynamicTraining;
  window.gradeTraining = gradeTraining;
  window.clearTraining = clearTraining;
}

// ═══════════════════════════════════════════════════
// 🧠 NEXT ACTION ENGINE
// ═══════════════════════════════════════════════════
let _naeTarget = null;
function computeNAE() {
  // NAE bar removed from UI — no-op
}
function naeAction() { }
// NAE interval removed — computeNAE is a no-op

// ═══════════════════════════════════════════════════
// ⬆ AUTO ESCALATION T2→T1
// ═══════════════════════════════════════════════════
setInterval(() => { try {
  if (!S.missionActive || document.hidden) return;
  const now = Date.now();
  S.casualties.forEach(c => {
    if (c.priority !== 'T2' || c.escalated) return;
    const age = (now - (c._addedAt || now)) / 60000;
    const spo2 = parseInt(c.vitals?.spo2) || 99;
    const pulse = parseInt(c.vitals?.pulse) || 70;
    const gcs = parseInt(c.vitals?.gcs) || 15;
    if (age > 12 || spo2 < 90 || pulse < 50 || pulse > 140 || gcs < 10) {
      c.priority = 'T1'; c.escalated = true;
      addTL(c.id, c.name, '⬆ הועלה אוטומטית T2→T1', 'red');
      vibrateAlert(`${c.name} הועלה ל-T1`);
      renderWarRoom(); computeNAE();
    }
  });
} catch (e) { console.error('[Auto-escalation]', e); } }, 30000);

// ═══════════════════════════════════════════════════
// 📸 VITALS SNAPSHOT + GRAPH
// ═══════════════════════════════════════════════════
// snapshotVitals — defined above with full mesh sync + deterioration check
function drawVitalsGraph(casId) {
  const c = S.casualties.find(x => x.id == casId);
  if (!c || !c.vitalsHistory || c.vitalsHistory.length < 2) return;
  const cv = document.getElementById(`vgc-${casId}`); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.offsetWidth || 320, H = 90;
  cv.width = W; cv.height = H;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0c1110'; ctx.fillRect(0, 0, W, H);
  const pts = c.vitalsHistory;
  const n = pts.length;
  const xOf = i => (i / (n - 1)) * (W - 20) + 10;
  const series = [
    { key: 'pulse', color: '#f04848', max: 200 },
    { key: 'spo2', color: '#42c042', max: 100 },
    { key: 'gcs', color: '#ffd050', scale: 10, max: 150 },
  ];
  // grid lines
  ctx.strokeStyle = '#1e2a1c'; ctx.lineWidth = 1;
  [0.25, 0.5, 0.75].forEach(f => { ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke(); });
  series.forEach(s => {
    ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = 2;
    pts.forEach((p, i) => {
      const v = (s.scale ? p[s.key] * (s.scale || 1) : p[s.key]);
      const y = H - Math.max(4, Math.min(H - 4, (v / s.max) * H));
      i === 0 ? ctx.moveTo(xOf(i), y) : ctx.lineTo(xOf(i), y);
    });
    ctx.stroke();
    // dots
    pts.forEach((p, i) => {
      const v = s.scale ? p[s.key] * s.scale : p[s.key];
      const y = H - Math.max(4, Math.min(H - 4, (v / s.max) * H));
      ctx.beginPath(); ctx.arc(xOf(i), y, 3, 0, Math.PI * 2);
      ctx.fillStyle = s.color; ctx.fill();
    });
  });
  // time labels
  ctx.fillStyle = '#506050'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
  pts.forEach((p, i) => { if (i === 0 || i === n - 1 || i === Math.floor(n / 2)) ctx.fillText(p.t, xOf(i), H - 2); });
}

// ═══════════════════════════════════════════════════
// 📍 GPS TAGGING
// ═══════════════════════════════════════════════════
function tagGPS(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (!navigator.geolocation) { showToast('GPS לא זמין'); return; }
  showToast('📍 מאתר מיקום...');
  navigator.geolocation.getCurrentPosition(pos => {
    const lat = pos.coords.latitude.toFixed(5);
    const lon = pos.coords.longitude.toFixed(5);
    c.gps = `${lat},${lon}`;
    addTL(casId, c.name, `📍 GPS: ${c.gps}`, 'green');
    const btn = $(`gps-btn-${casId}`);
    if (btn) btn.textContent = `📍 ${lat.substring(0, 6)}`;
    showToast(`✓ GPS: ${c.gps}`);
  }, () => showToast('❌ לא הצלחנו לאתר'));
}

// ═══════════════════════════════════════════════════
// 👆 SWIPE FOCUS MODE
// ═══════════════════════════════════════════════════
let _swipeIdx = 0;
const SWIPE_ACTIONS = [
  { label: 'TQ', icon: '🩹', color: 'var(--red2)', fn: (id) => { const c = S.casualties.find(x => x.id == id); if (c && !c.tqStart) { c.tqStart = Date.now(); c.txList.push({ type: 'TQ', time: nowTime() }); addTL(id, c.name, 'TQ', 'red'); renderWarRoom(); showToast('TQ ✓'); } else showToast('TQ כבר פעיל'); } },
  { label: 'TXA', icon: '💉', color: 'var(--olive)', fn: (id) => { const c = S.casualties.find(x => x.id == id); if (c) { c.txList.push({ type: 'TXA 1g', time: nowTime() }); addTL(id, c.name, 'TXA ניתן', 'amber'); renderWarRoom(); showToast('TXA ✓'); } } },
  { label: 'נתיב אוויר', icon: '💨', color: 'var(--orange)', fn: (id) => { const c = S.casualties.find(x => x.id == id); if (c) { c.txList.push({ type: 'NPA', time: nowTime() }); addTL(id, c.name, 'NPA', 'amber'); renderWarRoom(); showToast('NPA ✓'); } } },
  { label: 'Chest Seal', icon: '🫁', color: 'var(--blue2)', fn: (id) => { const c = S.casualties.find(x => x.id == id); if (c) { c.txList.push({ type: 'Chest Seal', time: nowTime() }); addTL(id, c.name, 'Chest Seal', 'green'); renderWarRoom(); showToast('Chest Seal ✓'); } } },
  { label: 'NaCl 500ml', icon: '💧', color: 'var(--green)', fn: (id) => { const c = S.casualties.find(x => x.id == id); if (c) { c.txList.push({ type: 'NaCl 500', time: nowTime() }); c.fluidTotal += 500; c.fluids.push({ type: 'NaCl 500ml', time: nowTime() }); renderWarRoom(); showToast('NaCl ✓'); } } },
  { label: 'T4 Expectant', icon: '⬛', color: 'var(--b1)', fn: (id) => { if (confirm('סמן כ-T4 Expectant?')) { const c = S.casualties.find(x => x.id == id); if (c) { c.priority = 'T4'; addTL(id, c.name, 'T4 Expectant', 'amber'); renderWarRoom(); } } } },
];

function openSwipeMode() {
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  if (!sorted.length) { showToast('אין פגועים'); return; }
  _swipeIdx = 0;
  $('swipe-overlay').classList.add('on');
  renderSwipeCard();
}
function closeSwipeMode() { $('swipe-overlay').classList.remove('on'); }
function renderSwipeCard() {
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  if (!sorted.length) { closeSwipeMode(); return; }
  _swipeIdx = Math.min(_swipeIdx, sorted.length - 1);
  const c = sorted[_swipeIdx];
  $('swipe-index').textContent = `${_swipeIdx + 1}/${sorted.length}`;
  const dots = $('swipe-dots');
  dots.innerHTML = sorted.map((_, i) => `<div class="swipe-dot ${i === _swipeIdx ? 'active' : ''}"></div>`).join('');
  const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : 0;
  const _txaRef = c._addedAt || c.tqStart;
  const txaRem = _txaRef ? Math.max(0, 180 - Math.floor((Date.now() - _txaRef) / 60000)) : null;
  $('swipe-body').innerHTML = `
    <div class="swipe-card" id="swipe-card-inner">
      <div style="background:${pClr(c.priority)};border-radius:10px;padding:14px 16px">
        <div style="font-size:28px;font-weight:900;color:var(--white)">${escHTML(c.name)}</div>
        <div style="font-size:13px;color:var(--muted2);margin-top:4px">${prioLabel(c.priority)} · 🩸${escHTML(c.blood || '?')} · ${c.kg}kg${c.allergy ? ' · ⚠' + escHTML(c.allergy) : ''}</div>
        ${c.tqStart ? `<div style="font-size:12px;color:var(--amber3);margin-top:4px;font-family:monospace">⏱ TQ ${tqM} דקות${tqM > 45 ? ' ⚠ עצבי!' : ''}</div>` : ''}
        ${txaRem !== null ? `<div style="font-size:12px;color:${txaRem < 30 ? 'var(--red3)' : txaRem < 60 ? 'var(--amber3)' : 'var(--green3)'};font-weight:700">💉 TXA עוד ${txaRem}m</div>` : ''}
      </div>
      <div style="display:grid;font-size:11px;color:var(--muted2);grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center">
        <div style="background:var(--s2);border-radius:6px;padding:8px"><div style="font-size:18px;font-weight:700;color:${parseInt(c.vitals.pulse) > 120 || parseInt(c.vitals.pulse) < 50 ? 'var(--red3)' : 'var(--white)'}">${c.vitals.pulse || '—'}</div>דופק</div>
        <div style="background:var(--s2);border-radius:6px;padding:8px"><div style="font-size:18px;font-weight:700;color:${parseInt(c.vitals.spo2) < 90 ? 'var(--red3)' : 'var(--white)'}">${c.vitals.spo2 || '—'}%</div>SpO2</div>
        <div style="background:var(--s2);border-radius:6px;padding:8px"><div style="font-size:18px;font-weight:700;color:${parseInt(c.vitals.gcs) < 9 ? 'var(--red3)' : 'var(--white)'}">${c.vitals.gcs || '—'}</div>GCS</div>
      </div>
      <div style="font-size:11px;color:var(--muted2)">${c.txList.length ? 'טיפולים: ' + c.txList.map(t => t.type).join(', ') : 'אין טיפולים'}</div>
      <div class="swipe-actions">
        ${SWIPE_ACTIONS.map((a, i) => `
          <button class="swipe-act-btn" style="background:${a.color};color:var(--white)" onclick="SWIPE_ACTIONS[${i}].fn(${c.id})">
            <span class="swipe-act-icon">${a.icon}</span>
            <span style="font-size:13px">${a.label}</span>
          </button>`).join('')}
      </div>
      <button class="btn btn-md btn-ghost btn-full" onclick="closeSwipeMode();jumpToCas(${c.id})">📋 פתח טופס מלא</button>
    </div>`;
}
function swipeNav(dir) {
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  _swipeIdx = (_swipeIdx + dir + sorted.length) % sorted.length;
  renderSwipeCard();
}

// ═══════════════════════════════════════════════════
// ⚡ MASS CASUALTY SORT MODE
// ═══════════════════════════════════════════════════
let _msortTimer = null, _msortSec = 0;
const _msortCounts = { T1: 0, T2: 0, T3: 0, T4: 0 };

function openMassSort() {
  if (!S.missionActive) { showToast('הפעל אר"ן קודם'); return; }
  _msortSec = 0; _msortCounts.T1 = 0; _msortCounts.T2 = 0; _msortCounts.T3 = 0; _msortCounts.T4 = 0;
  $('msort-overlay').classList.add('on');
  $('msort-name').textContent = 'הזן שם ראשון';
  $('msort-timer').textContent = '0:00';
  ['msc-t1', 'msc-t2', 'msc-t3', 'msc-t4'].forEach(id => { const el = $(id); if (el) el.textContent = '0'; });
  _msortTimer = setInterval(() => { try {
    _msortSec++;
    const m = Math.floor(_msortSec / 60), s = _msortSec % 60;
    const el = $('msort-timer'); if (el) el.textContent = `${m}:${p2(s)}`;
  } catch (_) {} }, 1000);
  setTimeout(() => { const el = $('msort-name-in'); if (el) el.focus(); }, 100);
}
function closeMassSort() {
  clearInterval(_msortTimer);
  $('msort-overlay').classList.remove('on');
  if (Object.values(_msortCounts).some(v => v > 0)) {
    showToast(`Mass Sort: T1:${_msortCounts.T1} T2:${_msortCounts.T2} T3:${_msortCounts.T3} T4:${_msortCounts.T4}`);
    addTL('sys', 'SYSTEM', `Mass Sort — ${_msortSec}s — T1:${_msortCounts.T1} T2:${_msortCounts.T2} T3:${_msortCounts.T3} T4:${_msortCounts.T4}`, 'amber');
  }
}
function msortNext() {
  const el = $('msort-name-in'); if (!el) return;
  const name = el.value.trim();
  if (!name) { showToast('הכנס שם'); return; }
  $('msort-name').textContent = name;
  el.value = ''; el.focus();
}
function msortAssign(prio) {
  const name = $('msort-name').textContent;
  if (!name || name === 'הזן שם ראשון') { showToast('הכנס שם'); return; }
  _msortCounts[prio]++;
  const c = {
    id: Date.now(), name, idNum: '',
    kg: parseFloat($('msort-kg-in')?.value) || 70,
    blood: $('msort-blood-in')?.value || '',
    allergy: '', priority: prio, mech: ['Mass Sort'], time: nowTime(),
    tqStart: null,
    txList: [], injuries: [], photos: [],
    vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
    fluids: [], fluidTotal: 0, march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
    _addedAt: Date.now()
  };
  S.casualties.push(c);
  addTL(c.id, c.name, `Mass Sort → ${prio}`, 'red');
  // update counts display
  ['T1', 'T2', 'T3', 'T4'].forEach(p => { const el = $(`msc-${p.toLowerCase()}`); if (el) el.textContent = _msortCounts[p]; });
  // vibrate feedback
  if (navigator.vibrate) navigator.vibrate(prio === 'T1' ? [100, 50, 100] : 50);
  // clear for next
  $('msort-name').textContent = 'הזן שם ראשון';
  const ni = $('msort-name-in'); if (ni) { ni.value = ''; ni.focus(); }
  if ($('msort-blood-in')) $('msort-blood-in').value = '';
  if ($('msort-kg-in')) $('msort-kg-in').value = '';
  renderWarRoom(); computeNAE();
}

// ═══════════════════════════════════════════════════
// 🏥 HOSPITAL HANDOFF
// ═══════════════════════════════════════════════════
let _hospSpeaking = false;
function openHospHandoff(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  $('hosp-cas-name').textContent = c.name;
  $('hosp-overlay').classList.add('on');
  renderHospHandoff(c);
}
function closeHospHandoff() {
  $('hosp-overlay').classList.remove('on');
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  _hospSpeaking = false;
}
function renderHospHandoff(c) {
  const tqMin = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
  const txTypes = c.txList.map(t => t.type).join(', ') || 'ללא';
  const injuries = c.injuries.map(i => `${i.type} ${i.zone}`).join(', ') || 'ללא';
  const ttsScript = `מטופל: ${escHTML(c.name)}. גיל משוער. משקל: ${c.kg} ק"ג. סוג דם: ${escHTML(c.blood || 'לא ידוע')}. ${c.allergy ? `אלרגיה: ${escHTML(c.allergy)}.` : ''} עדיפות: ${c.priority}. מנגנון: ${c.mech.join(', ') || 'לא ידוע'}. פציעות: ${injuries}. טיפולים שניתנו: ${txTypes}. ${tqMin !== null ? `חוסם עורק: ${tqMin} דקות.` : ''} דופק: ${c.vitals.pulse || 'לא נמדד'}. סטורציה: ${c.vitals.spo2 || 'לא נמדד'} אחוז. GCS: ${c.vitals.gcs || 'לא נמדד'}. ${c.fluidTotal ? `נוזלים: ${c.fluidTotal} מ"ל.` : ''}`;

  const fields = [
    { lbl: 'שם ומשקל', val: `${escHTML(c.name)} · ${c.kg}kg`, crit: false },
    { lbl: 'סוג דם', val: escHTML(c.blood || 'לא ידוע'), crit: !c.blood },
    { lbl: 'אלרגיה', val: escHTML(c.allergy || 'ללא'), crit: !!c.allergy },
    { lbl: 'עדיפות', val: `${c.priority} — ${prioLabel(c.priority)}`, crit: c.priority === 'T1' },
    { lbl: 'מנגנון פציעה', val: c.mech.join(', ') || 'לא ידוע', crit: false },
    { lbl: 'פציעות', val: injuries, crit: false },
    { lbl: 'טיפולים שניתנו', val: txTypes, crit: false },
    { lbl: 'TQ — זמן', val: tqMin !== null ? `${tqMin} דקות${tqMin > 45 ? ' ⚠ סכנת עצב!' : ''}` : 'לא מוצמד', crit: tqMin > 45 },
    { lbl: 'דופק / SpO2 / GCS', val: `${c.vitals.pulse || '?'} bpm · ${c.vitals.spo2 || '?'}% · GCS ${c.vitals.gcs || '?'}`, crit: parseInt(c.vitals.spo2) < 90 },
    { lbl: 'לחץ דם', val: c.vitals.bp || 'לא נמדד', crit: false },
    { lbl: 'נוזלים סה"כ', val: `${c.fluidTotal} ml`, crit: false },
    { lbl: 'GPS', val: c.gps || 'לא מתויג', crit: false },
  ];

  $('hosp-body').innerHTML = `
    ${fields.map(f => `
      <div class="hosp-field ${f.crit ? 'hosp-field-crit' : ''}">
        <div class="hosp-field-lbl">${f.lbl}</div>
        <div class="hosp-field-val">${f.val}</div>
      </div>`).join('')}
    <button class="hosp-tts-btn" id="hosp-tts-btn" onclick="hospSpeak(\`${ttsScript.replace(/`/g, "'")}\`)">
      🔊 קרא בקול לרופא
    </button>
    <button class="btn btn-lg btn-ghost btn-full" onclick="window.print()">🖨️ הדפס טופס</button>`;
}
function hospSpeak(txt) {
  if (!('speechSynthesis' in window)) { showToast('TTS לא נתמך'); return; }
  const btn = $('hosp-tts-btn');
  if (_hospSpeaking) { window.speechSynthesis.cancel(); _hospSpeaking = false; if (btn) btn.classList.remove('speaking'); return; }
  _hospSpeaking = true; if (btn) btn.classList.add('speaking');
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'he-IL'; u.rate = 0.85; u.pitch = 1;
  u.onend = () => { _hospSpeaking = false; if (btn) btn.classList.remove('speaking'); };
  window.speechSynthesis.speak(u);
}

// ═══════════════════════════════════════════════════
// 📁 MULTI-INCIDENT MANAGER
// ═══════════════════════════════════════════════════
let _incidents = [], _activeInc = 0;
function saveCurrentIncident() {
  if (!S.missionActive) return;
  _incidents[_activeInc] = { ...S, casualties: [...S.casualties], force: [...S.force], timeline: [...S.timeline] };
}
function createNewIncident() {
  saveCurrentIncident();
  _incidents.push(null);
  _activeInc = _incidents.length - 1;
  // reset state
  S.casualties = []; S.timeline = []; S.missionStart = null; S.missionActive = false;
  { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display='none'; }
  $('fire-toggle-btn').style.display = 'none';
  const _mceBtn = $('mce-activate-btn'); if (_mceBtn) _mceBtn.style.display = 'none';
  { const _nf = $('nav-fire'); if (_nf) _nf.style.display = 'none'; }
  $('nae-bar').classList.remove('on');
  renderWarRoom(); renderIncidentBar();
  showToast(`אירוע ${_activeInc + 1} חדש`);
}
function switchIncident(idx) {
  saveCurrentIncident();
  _activeInc = idx;
  const inc = _incidents[idx];
  if (inc) {
    Object.assign(S, inc);
    if (S.missionActive) {
      { const _ghc=$('gh-chip'); if(_ghc) _ghc.style.display=''; }
      $('fire-toggle-btn').style.display = '';
      { const _nf = $('nav-fire'); if (_nf) _nf.style.display = 'flex'; }
    }
  }
  renderWarRoom(); renderIncidentBar();
  goScreen('sc-war'); setNav(1);
}
function renderIncidentBar() {
  const bar = $('incident-bar'); if (!bar) return;
  if (_incidents.length <= 1) { bar.classList.remove('on'); return; }
  bar.classList.add('on');
  bar.innerHTML = _incidents.map((_, i) => {
    const inc = _incidents[i];
    const t1c = inc ? inc.casualties.filter(c => c.priority === 'T1').length : 0;
    return `<div class="inc-tab ${i === _activeInc ? 'active' : ''}" onclick="switchIncident(${i})">
      ${t1c > 0 ? `<span class="inc-badge">${t1c}</span>` : ''}אירוע ${i + 1}
    </div>`;
  }).join('') + `<button class="btn btn-xs btn-ghost" style="flex-shrink:0" onclick="createNewIncident()">+ אירוע</button>`;
}
_incidents.push(null); // slot for current

setView('cards');

// ── Seed demo force only on first use (no saved state) ──
(function seedForceIfNeeded() {
  // Check if there's any saved state — if so, loadState will restore it
  const hasState = localStorage.getItem('benam_s') || localStorage.getItem('benam_s_training');
  if (hasState) {
    // Returning user — loadState handles everything, skip seeding
    return;
  }
  // First-time user — seed demo force roster
  const soldiers = [
    { name: 'יובל כהן', idNum: '7823401', kg: 82, blood: 'A+', allergy: '', role: 'מ"מ', equip: ROLE_PRESETS['מ"מ'] },
    { name: 'אריאל לוי', idNum: '8134522', kg: 75, blood: 'O+', allergy: '', role: 'חובש', equip: ROLE_PRESETS['חובש'] },
    { name: 'תום מזרחי', idNum: '9021834', kg: 90, blood: 'B+', allergy: 'פניצילין', role: 'נגביסט', equip: ROLE_PRESETS['נגביסט'] },
    { name: 'רון אברהם', idNum: '7710293', kg: 78, blood: 'O-', allergy: '', role: 'לוחם', equip: ROLE_PRESETS['לוחם'] },
    { name: 'נועם שפירא', idNum: '8843017', kg: 68, blood: 'AB+', allergy: 'NSAIDs', role: 'קמ"ן', equip: ROLE_PRESETS['קמ"ן'] },
    { name: 'דניאל גורן', idNum: '9132845', kg: 85, blood: 'A-', allergy: '', role: 'נהג', equip: ROLE_PRESETS['נהג'] },
    { name: 'יונתן ביטון', idNum: '7629103', kg: 72, blood: 'B-', allergy: 'מורפין', role: 'צלם', equip: ROLE_PRESETS['צלם'] },
    { name: 'עידו פרץ', idNum: '8901234', kg: 95, blood: 'O+', allergy: '', role: 'הנדסה קרבית', equip: ROLE_PRESETS['הנדסה קרבית'] },
    { name: 'שי כץ', idNum: '7412098', kg: 71, blood: 'A+', allergy: 'קטמין', role: 'לוחם', equip: ROLE_PRESETS['לוחם'] },
    { name: 'אמיר סעדון', idNum: '8234501', kg: 88, blood: 'AB-', allergy: '', role: 'מפקד', equip: ROLE_PRESETS['מפקד'] },
  ];
  soldiers.forEach((s, i) => {
    S.force.push({ id: Date.now() + i, ...s });
  });
  renderForceList();
  renderCompatTable();
})();

// ── Initial screen: show role picker for first-time users,
//    or stay on sc-prep for returning users (role already saved)
(function initScreen() {
  try {
    const saved = JSON.parse(localStorage.getItem('benam_s') || '{}');
    if (saved.role && saved.opMode && saved.missionType) {
      // Returning user — loadState will handle full restore
      return; // sc-prep stays active (set in HTML)
    }
  } catch (e) { }
  // First-time user — show role picker
  goScreen('sc-role');
})();

// ── Initialize sub-tabs to default state
setPrepTab('comms');
setStatsTab('perf');

// ═══════════════════════════════════════════════════
// MODERN UX ENHANCEMENTS
// ═══════════════════════════════════════════════════

// ── 1. Scroll-aware topbar: hide on scroll-down, show on scroll-up
(function initScrollAwareTopbar() {
  const content = $('content');
  const topbar = $('topbar');
  if (!content || !topbar) return;
  let lastY = 0, ticking = false;
  content.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = content.scrollTop;
      if (y > lastY && y > 60) topbar.classList.add('topbar-hidden');
      else topbar.classList.remove('topbar-hidden');
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
})();

// ── 2. Swipe between tabs on #content
(function initSwipeTabs() {
  // Disabled by request: prevent side-swipe tab switching.
})();

// ── 3. Bottom sheet drag-to-dismiss for cas-drawer
(function initDrawerDrag() {
  const drawer = $('cas-drawer');
  if (!drawer) return;
  const grip = drawer.querySelector('.drawer-grip');
  if (!grip) return;
  let startY = 0, currentY = 0, dragging = false;
  function onStart(e) {
    dragging = true;
    drawer.classList.add('dragging');
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = startY;
  }
  function onMove(e) {
    if (!dragging) return;
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = currentY - startY;
    if (dy > 0) {
      drawer.style.transform = 'translateY(' + dy + 'px)';
    }
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    drawer.classList.remove('dragging');
    const dy = currentY - startY;
    if (dy > 120) {
      closeDrawer();
      haptic('light');
    }
    drawer.style.transform = '';
  }
  grip.addEventListener('touchstart', onStart, { passive: true });
  grip.addEventListener('touchmove', onMove, { passive: true });
  grip.addEventListener('touchend', onEnd, { passive: true });
  // Mouse fallback
  grip.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
})();

// ── 4. Haptic feedback on critical actions
(function initHapticButtons() {
  // Add haptic to fire-mode buttons, TQ, priority changes
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.fire-btn,.fs-btn,.swipe-act-btn,.msort-btn');
    if (btn) haptic('medium');
    const navBtn = e.target.closest('.nav-btn,.sub-tab');
    if (navBtn) haptic('light');
  });
})();

// ═══════════════════════════════════════════════════
// BATCH 3: FAB QUICK ACTIONS
// ═══════════════════════════════════════════════════
function toggleQuickActions(event) {
  const fab = $('quick-fab');
  const menu = $('quick-actions-menu');
  const addCas = $('quick-add-cas');
  if (!fab || !menu || !addCas) return;
  if (event) event.stopPropagation();
  const isOpen = menu.classList.contains('open');
  if (isOpen) closeQuickActions();
  else {
    menu.classList.add('open');
    fab.classList.add('open');
    fab.textContent = '✕';
    addCas.classList.add('open');
    setTimeout(() => adjustQuickActionsPosition(menu), 1); // allow initial layout
  }
}
function closeQuickActions() {
  const fab = $('quick-fab');
  const menu = $('quick-actions-menu');
  const addCas = $('quick-add-cas');
  if (fab) {
    fab.classList.remove('open');
    fab.textContent = '＋';
    fab.style.color = '#fff';
  }
  if (menu) {
    menu.classList.remove('open');
    menu.style.top = '';
    menu.style.bottom = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.width = '';
    menu.style.maxHeight = '';
    menu.style.overflowY = '';
  }
  if (addCas) addCas.classList.remove('open');
}

document.addEventListener('click', function (e) {
  const fab = $('quick-fab');
  const menu = $('quick-actions-menu');
  if (!fab || !menu) return;
  if (!menu.classList.contains('open')) return;
  if (fab.contains(e.target) || menu.contains(e.target)) return;
  closeQuickActions();
});

function adjustQuickActionsPosition(menu) {
  if (!menu) return;

  const fab = $('quick-fab');
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const menuRect = menu.getBoundingClientRect();
  const fabRect = fab ? fab.getBoundingClientRect() : null;
  const safeMargin = 10;

  // Determine vertical anchor based on available space.
  const fallbackBottom = 96 + (window.visualViewport ? window.visualViewport.height - window.innerHeight : 0);
  if (fabRect) {
    const spaceBelow = viewportHeight - fabRect.bottom - safeMargin;
    const spaceAbove = fabRect.top - safeMargin;

    if (spaceBelow < menuRect.height && spaceAbove >= menuRect.height) {
      menu.style.top = `${Math.max(safeMargin, fabRect.top - menuRect.height - 8)}px`;
      menu.style.bottom = 'auto';
    } else {
      menu.style.top = 'auto';
      menu.style.bottom = `calc(${fallbackBottom}px + env(safe-area-inset-bottom))`;
    }
  } else {
    menu.style.top = 'auto';
    menu.style.bottom = `calc(${fallbackBottom}px + env(safe-area-inset-bottom))`;
  }

  // Recalc after applying the first constraints.
  const adjustedRect = menu.getBoundingClientRect();

  // Keep inside viewport vertically as fallback
  if (adjustedRect.top < safeMargin) {
    menu.style.top = `${safeMargin}px`;
    menu.style.bottom = 'auto';
  }
  if (adjustedRect.bottom > viewportHeight - safeMargin) {
    menu.style.bottom = `${safeMargin}px`;
    menu.style.top = 'auto';
  }

  // Horizontal clamps
  if (adjustedRect.width > viewportWidth - 40) {
    menu.style.width = 'calc(100vw - 40px)';
  }
  if (adjustedRect.left < safeMargin) {
    menu.style.left = '20px';
    menu.style.right = 'auto';
  }
  if (adjustedRect.right > viewportWidth - safeMargin) {
    menu.style.right = '20px';
    menu.style.left = 'auto';
  }

  // Recalc after horizontal adjustment
  const finalRect = menu.getBoundingClientRect();
  const targetMaxHeight = Math.min(viewportHeight - 2 * safeMargin, 560);
  menu.style.maxHeight = `calc(${Math.max(220, targetMaxHeight)}px)`;
  menu.style.overflowY = 'auto';

  // If still clipped, allow body scroll / hide overflow.
  if (finalRect.top < safeMargin || finalRect.bottom > viewportHeight - safeMargin) {
    menu.style.position = 'fixed';
    menu.style.height = `calc(100vh - ${2 * safeMargin}px)`;
    menu.style.maxHeight = `calc(100vh - ${2 * safeMargin}px)`;
    menu.style.top = `${safeMargin}px`;
    menu.style.bottom = 'auto';
    menu.style.overflowY = 'auto';
  }

}

// ═══════════════════════════════════════════════════
// BATCH 3: MODE SEPARATION (operational / training)
// ═══════════════════════════════════════════════════
function applyModeFilter() {
  // Hide/show elements with data-mode attribute
  document.querySelectorAll('[data-mode]').forEach(el => {
    const mode = el.dataset.mode;
    if (mode === 'operational') el.style.display = S.opMode === 'training' ? 'none' : '';
    else if (mode === 'training') el.style.display = S.opMode === 'training' ? '' : 'none';
  });
}

// ═══════════════════════════════════════════════════
// BATCH 3: AUTO-MCE ACTIVATION (>25% force injured)
// ═══════════════════════════════════════════════════
function checkAutoMCE() {
  // Legacy no-op: MCE state is managed automatically from casualty presence.
}

// ═══════════════════════════════════════════════════
// BATCH 3: HELIPAD MANAGEMENT
// ═══════════════════════════════════════════════════
let _helipads = [];
function addHelipad() {
  const container = $('helipads-list'); if (!container) return;
  const id = Date.now();
  _helipads.push({ id, name: '', type: 'helicopter', freq: '' });
  renderHelipads();
}
function removeHelipad(id) {
  _helipads = _helipads.filter(h => h.id !== id);
  renderHelipads();
}
function renderHelipads() {
  const container = $('helipads-list'); if (!container) return;
  container.innerHTML = _helipads.map(h => `
    <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
      <select class="inp" style="width:80px;font-size:10px" onchange="updateHelipad(${h.id},'type',this.value)">
        <option value="helicopter" ${h.type === 'helicopter' ? 'selected' : ''}>🚁 Helo</option>
        <option value="vehicle" ${h.type === 'vehicle' ? 'selected' : ''}>🚑 Vehicle</option>
      </select>
      <input class="inp" style="flex:1;font-size:11px" placeholder="LZ Name" value="${h.name}" onchange="updateHelipad(${h.id},'name',this.value)">
      <input class="inp" style="width:80px;font-size:11px" placeholder="Freq" value="${h.freq}" onchange="updateHelipad(${h.id},'freq',this.value)">
      <button class="btn btn-xs btn-ghost" style="color:var(--red3);min-height:20px" onclick="removeHelipad(${h.id})">✕</button>
    </div>`).join('');
}
function updateHelipad(id, key, val) {
  const h = _helipads.find(x => x.id === id);
  if (h) h[key] = val;
}
function saveCommsExtended() {
  saveComms();
  S.comms.helipads = _helipads;
  saveState();
}

// ═══════════════════════════════════════════════════
// BATCH 3: FORCE ROSTER EDIT + VIEWS
// ═══════════════════════════════════════════════════
var _forceViewMode = 'cards', _forceSort = 'name', _forceFilterRole = '';

function editForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  const roleOpts = Object.keys(ROLE_PRESETS).map(r => `<option value="${r}" ${f.role === r ? 'selected' : ''}>${r}</option>`).join('');
  
  openModal(`✏️ עריכת לוחם: ${escHTML(f.name)}`, `
    <div class="pad col" style="gap:10px">
      <div style="font-size:10px;color:var(--muted2);font-weight:700">פרטים אישיים</div>
      <input class="inp" id="ef-name" value="${escHTML(f.name)}" placeholder="שם מלא">
      <div class="row" style="gap:8px">
        <input class="inp" id="ef-id" value="${escHTML(f.idNum || '')}" placeholder="מ.א." style="flex:1">
        <input class="inp" id="ef-kg" type="number" value="${f.kg}" placeholder='ק"ג' style="width:70px">
      </div>
      
      <div style="font-size:10px;color:var(--muted2);font-weight:700">זיהוי ושיבוץ</div>
      <div class="row" style="gap:8px">
        <input class="inp" id="ef-iron" value="${escHTML(f.ironNum || '')}" placeholder="🔢 מספר ברזל" style="flex:1">
        <input class="inp" id="ef-iron-pair" value="${escHTML(f.ironPair || '')}" placeholder="👥 צמד ברזל" style="flex:1">
      </div>

      <div style="font-size:10px;color:var(--muted2);font-weight:700">מידע רפואי</div>
      <select class="inp" id="ef-blood">
        <option value="">סוג דם</option>
        ${ALL_BT.map(b => `<option ${f.blood === b ? 'selected' : ''}>${b}</option>`).join('')}
      </select>
      
      <select class="inp" id="ef-allergy" data-note-id="ef-allergy-note" onchange="showOtherNote(this)">
        <option value="">אלרגיות — ללא</option>
        <option value="פניצילין" ${f.allergy === 'פניצילין' ? 'selected' : ''}>פניצילין (PENC)</option>
        <option value="NSAIDs" ${f.allergy === 'NSAIDs' ? 'selected' : ''}>NSAIDs</option>
        <option value="קטמין" ${f.allergy === 'קטמין' ? 'selected' : ''}>קטמין</option>
        <option value="אחר" ${f.allergy && !['פניצילין', 'NSAIDs', 'קטמין'].includes(f.allergy) ? 'selected' : ''}>אחר — הזן הערה</option>
      </select>
      <textarea class="other-note ${f.allergy && !['פניצילין', 'NSAIDs', 'קטמין'].includes(f.allergy) ? 'show' : ''}" id="ef-allergy-note" rows="2" placeholder="פרט אלרגיה...">${f.allergy && !['פניצילין', 'NSAIDs', 'קטמין'].includes(f.allergy) ? f.allergy : ''}</textarea>

      <div class="row" style="gap:8px">
        <input class="inp" id="ef-meds" value="${escHTML(f.meds || '')}" placeholder="💊 תרופות" style="flex:1">
        <input class="inp" id="ef-vaccines" value="${escHTML(f.vaccines || '')}" placeholder="💉 חיסונים" style="flex:1">
      </div>

      <div style="font-size:10px;color:var(--muted2);font-weight:700">תפקיד</div>
      <select class="inp" id="ef-role">
        <option value="">— בחר תפקיד —</option>
        ${roleOpts}
        <option value="אחר" ${!ROLE_PRESETS[f.role] ? 'selected' : ''}>אחר</option>
      </select>

      <button class="btn btn-lg btn-olive btn-full" onclick="saveEditForce(${fid})" style="margin-top:8px">שמור שינויים ✓</button>
      <button class="btn btn-md btn-ghost btn-full" onclick="closeModal()">ביטול</button>
    </div>`);
}
function saveEditForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  f.name = $('ef-name').value.trim() || f.name;
  f.idNum = $('ef-id').value.trim();
  f.kg = parseFloat($('ef-kg').value) || f.kg;
  f.blood = $('ef-blood').value;
  f.role = $('ef-role').value;
  f.ironNum = $('ef-iron').value.trim();
  f.ironPair = $('ef-iron-pair').value.trim();
  f.allergy = getSelectVal('ef-allergy', 'ef-allergy-note');
  f.meds = $('ef-meds').value.trim();
  f.vaccines = $('ef-vaccines').value.trim();

  closeModal();
  renderForceList();
  renderCompatTable();
  saveState();
  showToast('✓ פרטי הלוחם עודכנו: ' + f.name);
}
function setForceView(mode) {
  _forceViewMode = mode;
  renderForceList();
}
function setForceSort(s) {
  _forceSort = s;
  renderForceList();
}
function setForceFilter(role) {
  _forceFilterRole = role;
  renderForceList();
}

// ═══════════════════════════════════════════════════
// BATCH 3: EVAC FORCES DEFINITION
// ═══════════════════════════════════════════════════
if (!S.evacForces) S.evacForces = [];

function renderEvacForcesSetup() {
  const container = $('evac-forces-list'); if (!container) return;
  if (!S.evacForces.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:10px;text-align:center">No evac forces defined</div>';
    return;
  }
  container.innerHTML = S.evacForces.map((ef, i) => `
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${ef.type === 'helicopter' ? '🚁' : ef.type === 'ambulance' ? '🚑' : '🚗'}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700">${ef.callsign || 'Evac ' + (i + 1)}</div>
        <div style="font-size:10px;color:var(--muted)">${ef.type} · ${ef.capacity || '?'} pax · ETA ${ef.etaMin || '?'}m</div>
      </div>
      <button class="btn btn-xs btn-ghost" onclick="removeEvacForce(${i})" style="color:var(--red3);min-height:20px">✕</button>
    </div>`).join('');
}
function openAddEvacForce() {
  openModal('🚁 Add Evac Force', `
    <div class="pad col" style="gap:8px">
      <input class="inp" id="nef-callsign" placeholder="Callsign (e.g. Yanshuf-1)">
      <select class="inp" id="nef-type">
        <option value="helicopter">🚁 Helicopter</option>
        <option value="ambulance">🚑 Ambulance</option>
        <option value="vehicle">🚗 Ground Vehicle</option>
      </select>
      <div style="display:flex;gap:6px">
        <input class="inp" id="nef-cap" type="number" placeholder="Capacity (pax)" style="flex:1">
        <input class="inp" id="nef-eta" type="number" placeholder="ETA (min)" style="flex:1">
      </div>
      <button class="btn btn-md btn-olive btn-full" onclick="saveEvacForceNew()">💾 Save</button>
    </div>`);
}
function saveEvacForceNew() {
  const ef = {
    callsign: $('nef-callsign').value.trim() || 'Evac',
    type: $('nef-type').value,
    capacity: parseInt($('nef-cap').value) || 4,
    etaMin: parseInt($('nef-eta').value) || 0
  };
  S.evacForces.push(ef);
  closeModal(); renderEvacForcesSetup(); saveState();
  showToast('✓ ' + ef.callsign + ' added');
}
function removeEvacForce(idx) {
  const name = S.evacForces[idx]?.callsign || '';
  S.evacForces.splice(idx, 1);
  renderEvacForcesSetup(); saveState();
  showToast('✓ ' + name + ' removed');
}

// ═══════════════════════════════════════════════════
// BATCH 3: ETA CALCULATOR
// ═══════════════════════════════════════════════════
const EVAC_DESTINATIONS = [
  { name: 'רמב"ם', heloMin: 15, groundMin: 40 },
  { name: 'סורוקה', heloMin: 25, groundMin: 70 },
  { name: 'הדסה עין-כרם', heloMin: 20, groundMin: 55 },
  { name: 'שיבא (תל-השומר)', heloMin: 18, groundMin: 45 },
  { name: 'בילינסון', heloMin: 18, groundMin: 50 },
  { name: 'איכילוב', heloMin: 15, groundMin: 35 },
  { name: 'זיו (צפת)', heloMin: 20, groundMin: 65 },
  { name: 'גליל מערבי (נהרייה)', heloMin: 22, groundMin: 60 },
];

function openETACalc() {
  const opts = EVAC_DESTINATIONS.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
  openModal('⏱ ETA Calculator', `
    <div class="pad col" style="gap:10px">
      <select class="inp" id="eta-dest">${opts}</select>
      <div style="display:flex;gap:8px">
        <button class="btn btn-md btn-olive" style="flex:1" onclick="calcETA('helo')">🚁 Helo</button>
        <button class="btn btn-md btn-ghost" style="flex:1" onclick="calcETA('ground')">🚗 Ground</button>
      </div>
      <div id="eta-result" style="text-align:center;padding:12px;background:var(--s2);border-radius:8px;min-height:40px"></div>
    </div>`);
}
function calcETA(mode) {
  const idx = parseInt($('eta-dest').value);
  const dest = EVAC_DESTINATIONS[idx]; if (!dest) return;
  const min = mode === 'helo' ? dest.heloMin : dest.groundMin;
  const arriveTime = new Date(Date.now() + min * 60000);
  const arrive = arriveTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const icon = mode === 'helo' ? '🚁' : '🚗';
  // Set evac ETA in state for countdown timer
  S.evacEta = arriveTime.getTime();
  saveState();
  const _eEl = $('eta-result');
  if (_eEl) { _eEl.textContent = ''; _eEl.insertAdjacentHTML('afterbegin', `
    <div style="font-size:24px;font-weight:900;color:var(--olive3)">${icon} ${min} min</div>
    <div style="font-size:11px;color:var(--muted2);margin-top:4px">${dest.name} — ETA ${arrive}</div>
    <div style="font-size:10px;color:var(--amber2);margin-top:4px">⏱ טיימר ספירה לאחור הופעל בפס העליון</div>`); }
  addTL('sys', 'SYSTEM', icon + ' ETA פינוי: ' + min + ' דק\' → ' + dest.name, 'olive');
  showToast('✓ טיימר פינוי הופעל — ' + min + ' דקות');
}

// ═══════════════════════════════════════════════════
// BATCH 3: EVAC PIPELINE TRACKER
// ═══════════════════════════════════════════════════
const EVAC_STAGES = ['injury', 'collection', 'pickup', 'transit', 'hospital'];
const EVAC_STAGE_LABELS = { injury: '📍 Injury', collection: '🏕 Collection', pickup: '🚁 Pickup', transit: '🚑 Transit', hospital: '🏥 Hospital' };

function openEvacPipeline(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (!c.evacPipeline) c.evacPipeline = { stage: 'injury', times: {} };
  const p = c.evacPipeline;
  openModal('🚁 Evac Pipeline — ' + c.name, `
    <div class="pad col" style="gap:6px">
      ${EVAC_STAGES.map(s => {
    const done = p.times[s];
    const isCurrent = p.stage === s;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;background:${isCurrent ? 'var(--olive)' : done ? 'var(--s3)' : 'var(--s2)'};border:1px solid ${isCurrent ? 'var(--olive3)' : 'var(--b0)'}">
          <span style="font-size:16px">${EVAC_STAGE_LABELS[s].split(' ')[0]}</span>
          <span style="flex:1;font-size:12px;font-weight:${isCurrent ? '900' : '400'};color:${isCurrent ? '#fff' : done ? 'var(--muted2)' : 'var(--muted)'}">${EVAC_STAGE_LABELS[s].split(' ')[1]}</span>
          ${done ? `<span style="font-size:10px;color:var(--olive3)">${done}</span>` : ''}
          ${isCurrent ? `<button class="btn btn-xs btn-olive" onclick="markEvacStage(${casId},'${s}')">✓ Done</button>` : ''}
        </div>`;
  }).join('')}
    </div>`);
}
function markEvacStage(casId, stage) {
  const c = S.casualties.find(x => x.id == casId); if (!c || !c.evacPipeline) return;
  c.evacPipeline.times[stage] = nowTime();
  const idx = EVAC_STAGES.indexOf(stage);
  if (idx < EVAC_STAGES.length - 1) c.evacPipeline.stage = EVAC_STAGES[idx + 1];
  else c.evacPipeline.stage = 'done';
  addTL(casId, c.name, `Evac: ${EVAC_STAGE_LABELS[stage]} ✓`, 'green');
  closeModal(); saveState(); renderWarRoom();
}

// ═══════════════════════════════════════════════════
// BATCH 3: DIGITAL REFERENCE LIBRARY
// ═══════════════════════════════════════════════════
const REF_LIBRARY = [
  {
    cat: '🏥 Hospitals', items: [
      { title: 'Rambam', detail: '04-7772111', sub: 'Haifa — Trauma Level 1' },
      { title: 'Soroka', detail: '08-6400111', sub: 'Beer Sheva — Trauma Level 1' },
      { title: 'Hadassah Ein-Kerem', detail: '02-6777111', sub: 'Jerusalem — Trauma Level 1' },
      { title: 'Sheba (Tel Hashomer)', detail: '03-5302222', sub: 'Ramat Gan — Trauma Level 1' },
      { title: 'Ichilov', detail: '03-6974444', sub: 'Tel Aviv — Trauma Level 1' },
      { title: 'Ziv', detail: '04-6828811', sub: 'Tzfat' },
      { title: 'Galil Medical', detail: '04-9107107', sub: 'Nahariya' },
      { title: 'Beilinson', detail: '03-9377377', sub: 'Petach Tikva' },
    ]
  },
  {
    cat: '📻 Flight Frequencies', items: [
      { title: 'IAF Rescue', detail: '243.0 MHz', sub: 'Emergency' },
      { title: 'Helo Common', detail: '121.5 MHz', sub: 'Civilian Emergency' },
      { title: 'Ground-Air', detail: '123.1 MHz', sub: 'CAS Coordination' },
    ]
  },
  {
    cat: '📋 SOPs', items: [
      { title: 'TCCC Guidelines', detail: 'Tactical Combat Casualty Care', sub: 'Latest revision' },
      { title: '9-Line MEDEVAC', detail: 'Standard request format', sub: 'NATO STANAG 3204' },
      { title: 'MIST Report', detail: 'Mechanism, Injuries, Signs, Treatment', sub: 'Handoff protocol' },
      { title: 'MARCH Algorithm', detail: 'Massive hemorrhage → Airway → Resp → Circ → Hypothermia', sub: 'Primary assessment' },
      { title: 'TQ Protocol', detail: 'Apply high & tight, note time, max 2h field', sub: 'Tourniquet SOP' },
    ]
  },
];

function openReferenceLibrary() {
  const overlay = $('ref-library-overlay');
  if (!overlay) return;
  overlay.classList.add('on');
  renderReferenceLibrary();
}
function closeReferenceLibrary() {
  const overlay = $('ref-library-overlay');
  if (overlay) overlay.classList.remove('on');
}
function renderReferenceLibrary(filterText) {
  const body = $('ref-library-body'); if (!body) return;
  const q = (filterText || '').toLowerCase();
  body.innerHTML = REF_LIBRARY.map(cat => {
    const fitems = q ? cat.items.filter(it => it.title.toLowerCase().includes(q) || it.detail.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)) : cat.items;
    if (!fitems.length) return '';
    return `<div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:900;color:var(--olive3);padding:6px 0">${cat.cat}</div>
      ${fitems.map(it => `
        <div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;font-weight:700">${it.title}</span>
            <span style="font-size:12px;font-weight:900;color:var(--amber2);direction:ltr">${it.detail}</span>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${it.sub}</div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// BATCH 3: MEDIC ALLOCATION VIEW
// ═══════════════════════════════════════════════════
function renderMedicAISection(active, medics, loadMap) {
  const unassigned = active.filter(c => !c.medic);
  const unassignedT1 = unassigned.filter(c => c.priority === 'T1');
  const overloaded = medics.filter(m => (loadMap[m.name] || 0) >= medicCapacity(m));

  let nextAction = '✅ חלוקת המטפלים נראית יציבה';
  let nextSub = 'אין פעולה דחופה כרגע';

  if (unassignedT1.length) {
    nextAction = `🩺 שייך מטפל מיידית ל-${unassignedT1[0].name}`;
    nextSub = 'T1 ללא מטפל — עדיפות עליונה';
  } else if (unassigned.length) {
    nextAction = '⚡ הפעל Auto Balance';
    nextSub = `יש ${unassigned.length} פצועים ללא מטפל`;
  } else if (overloaded.length) {
    nextAction = '↔ בצע Reassign ממטפל בעומס';
    nextSub = `${overloaded.length} מטפלים בעומס מלא`;
  }

  const topCas = [...active]
    .sort((a, b) => prioN(a.priority) - prioN(b.priority))
    .slice(0, 3)
    .map(c => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(40,72,136,.22)">
      <span class="prio pt${c.priority[1]}" style="font-size:9px;padding:1px 5px">${c.priority}</span>
      <span style="font-size:11px;font-weight:700;flex:1">${escHTML(c.name)}</span>
      <span style="font-size:10px;color:${c.medic ? 'var(--olive3)' : 'var(--red3)'}">${escHTML(c.medic || 'ללא מטפל')}</span>
    </div>`)
    .join('');

  const aiContent = `<div style="margin-top:10px;border:1px solid var(--blue2);border-radius:10px;background:var(--glass-bg-surface);padding:10px 10px 8px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:15px">🤖</span>
      <span style="font-size:11px;font-weight:900;color:var(--olive3);letter-spacing:.08em">AI ADVISOR</span>
      <span style="margin-right:auto;font-size:9px;color:var(--muted)">MEDIC</span>
    </div>
    <div style="font-size:11px;color:var(--muted2);line-height:1.45;margin-bottom:6px">${nextSub}</div>
    <div style="background:var(--glass-bg);border:1px solid var(--olive3);border-radius:8px;padding:8px 10px;margin-bottom:8px">
      <div style="font-size:9px;color:var(--olive3);font-weight:700;letter-spacing:.1em">NEXT BEST ACTION</div>
      <div style="font-size:14px;font-weight:900;color:var(--white);margin-top:2px">${nextAction}</div>
    </div>
    ${topCas ? `<div style="font-size:9px;color:var(--olive3);letter-spacing:.08em;margin-bottom:4px">פצועים בעדיפות עליונה</div>${topCas}` : ''}
  </div>`;

  return `<div style="margin-top:10px">
    <button class="btn btn-xs btn-ghost" style="width:100%;text-align:right;justify-content:space-between;display:flex;gap:8px;padding:8px;border:1px solid var(--b0);border-radius:8px;background:var(--s2);color:var(--olive3);font-weight:700" onclick="toggleMedicAISection(this)">
      <span>🤖 AI ADVISOR</span>
      <span style="font-size:10px;color:var(--muted2)">MEDIC</span>
      <span class="ai-toggle-arrow">⯈</span>
    </button>
    <div class="medic-ai-content" style="display:none;margin-top:8px">${aiContent}</div>
  </div>`;
}

function toggleMedicAISection(btn) {
  const content = btn.parentElement.querySelector('.medic-ai-content');
  if (!content) return;
  const arrow = btn.querySelector('.ai-toggle-arrow');
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '⯈' : '⯆';
}

function openMedicAllocView() {
  const medics = getMedicRoster();
  const active = getActiveCasForMedicAlloc();
  const unassigned = active.filter(c => !c.medic);
  const loadMap = buildMedicLoadMap(active, medics);
  openModal('👨‍⚕️ Medic Allocation', `
    <div class="pad col" style="gap:8px">
      <div style="display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div style="font-size:11px;color:var(--muted)">${medics.length} medics · ${active.length} active · ${unassigned.length} unassigned</div>
        <button class="btn btn-xs btn-olive" onclick="autoBalanceMedicAllocation()">⚡ Auto Balance</button>
      </div>
      ${medics.length ? medics.map(m => {
    const assigned = active.filter(c => c.medic === m.name);
    const load = loadMap[m.name] || 0;
    const cap = medicCapacity(m);
    const pct = Math.min(100, Math.round((load / Math.max(1, cap)) * 100));
    const clr = pct >= 100 ? 'var(--red3)' : pct >= 70 ? 'var(--amber3)' : 'var(--olive3)';
    return `<div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div style="font-size:12px;font-weight:700">🩺 ${escHTML(m.name)} <span style="font-size:10px;color:var(--olive3)">${m.role}</span></div>
            <div style="font-size:10px;font-weight:700;color:${clr}">Load ${load}/${cap}</div>
          </div>
          <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:6px">
            <div style="height:100%;width:${pct}%;background:${clr}"></div>
          </div>
          ${assigned.length ? assigned.map(c => `<div style="font-size:11px;padding:2px 0;color:var(--muted2);display:flex;align-items:center;gap:6px"><span class="prio pt${c.priority[1]}" style="font-size:9px;padding:1px 4px">${c.priority}</span><span style="flex:1">${escHTML(c.name)}</span><button class="btn btn-xs btn-ghost" onclick="quickReassignMedic(${c.id})">↔</button><button class="btn btn-xs btn-ghost" style="color:var(--danger)" onclick="unassignMedic(${c.id})">✕</button></div>`).join('') : '<div style="font-size:10px;color:var(--muted)">No casualties assigned</div>'}
        </div>`;
  }).join('') : '<div style="color:var(--muted);text-align:center;padding:20px">No medics in force roster</div>'}
      ${unassigned.length ? `<div style="margin-top:8px;padding:8px;background:var(--crit-bg);border:1px solid var(--red2);border-radius:6px">
        <div style="font-size:11px;font-weight:700;color:var(--red3);margin-bottom:4px">⚠ Unassigned</div>
        ${unassigned.map(c => `<div style="font-size:11px;padding:2px 0"><span class="prio pt${c.priority[1]}" style="font-size:9px;padding:1px 4px">${c.priority}</span> ${escHTML(c.name)}</div>`).join('')}
      </div>`: ''}
      ${renderMedicAISection(active, medics, loadMap)}
    </div>`);
}

// ═══════════════════════════════════════════════════
// BATCH 3: INJURY BODY MAP (for Form 101)
// ═══════════════════════════════════════════════════
function renderInjuryBodyMap(injuries) {
  const frontInj = injuries.filter(i => i.side === 'front' || !i.side);
  const backInj = injuries.filter(i => i.side === 'back');
  const dotsSvg = (list) => list.map(inj => `
    <circle cx="${inj.cx}" cy="${inj.cy}" r="7" fill="${injTypeColor(inj.type)}" opacity=".92" stroke="#000" stroke-width="1"/>
    <text x="${inj.cx}" y="${inj.cy + 4}" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">${(inj.type || '?')[0]}</text>`).join('');

  const bodySvg = (side, dots, label, fill, stroke) => `
    <div style="display:inline-flex;flex-direction:column;align-items:center;gap:2px">
      <div style="font-size:9px;font-weight:700;color:#556">${label}</div>
      <svg width="110" height="200" viewBox="0 0 110 200">
        <ellipse cx="55" cy="16" rx="14" ry="15" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="49" y="30" width="12" height="8" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="30" y="38" width="50" height="54" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        ${side === 'back' ? `<line x1="55" y1="39" x2="55" y2="90" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="3,2"/>` : ''}
        <rect x="10" y="39" width="18" height="48" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="82" y="39" width="18" height="48" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="30" y="92" width="21" height="68" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="59" y="92" width="21" height="68" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <text x="55" y="18" text-anchor="middle" font-size="8" fill="${stroke}" font-family="Arial">${side === 'front' ? 'ראש' : 'עורף'}</text>
        ${side === 'front' ? `
          <text x="55" y="66" text-anchor="middle" font-size="8" fill="${stroke}" font-family="Arial">חזה</text>
          <text x="55" y="84" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">בטן</text>
          <text x="18" y="65" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">יד</text>
          <text x="92" y="65" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">יד</text>
          <text x="40" y="132" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">רגל</text>
          <text x="70" y="132" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">רגל</text>
        `: `<text x="55" y="66" text-anchor="middle" font-size="8" fill="${stroke}" font-family="Arial">גב</text>`}
        ${dots}
      </svg>
    </div>`;

  const legend = INJ_TYPES.filter(t => t.k !== 'אחר').map(t =>
    `<span style="display:inline-flex;align-items:center;gap:2px;font-size:8px;color:#556;margin:0 4px">
      <span style="width:10px;height:10px;border-radius:50%;background:${t.color};display:inline-block"></span>${t.k}
    </span>`).join('');

  const injList = injuries.length ? injuries.map(inj =>
    `<div style="display:flex;align-items:center;gap:4px;font-size:9px;padding:2px 0;border-bottom:1px solid #eee">
      <span style="width:8px;height:8px;border-radius:50%;background:${injTypeColor(inj.type)};flex-shrink:0"></span>
      <strong>${inj.type}</strong> — ${inj.zone}
      <span style="color:#888;font-size:8px">${inj.side === 'back' ? 'אחורי' : 'קדמי'}</span>
    </div>`).join('') : '<div style="font-size:9px;color:#888">לא תועדו פציעות</div>';

  return `<div style="text-align:center">
    <div style="display:flex;justify-content:center;gap:14px;margin-bottom:6px">
      ${bodySvg('front', dotsSvg(frontInj), 'קדמי', '#e8ede8', '#4a6640')}
      ${bodySvg('back', dotsSvg(backInj), 'אחורי', '#e4e8e4', '#3a5030')}
    </div>
    <div style="margin-bottom:6px">${legend}</div>
    <div style="text-align:right;border-top:1px solid #ccc;padding-top:4px;margin-top:2px">
      <div style="font-size:9px;color:#666;font-weight:700;margin-bottom:3px">פציעות רשומות:</div>
      ${injList}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════
// WAR ROOM v2 — ENHANCED FEATURES
// ═══════════════════════════════════════════════════

// ── 7. SPARKLINE: mini vitals trend dots ──
function renderSparkline(c) {
  const h = c.vitalsHistory;
  if (!h || h.length < 2) return '';
  const last5 = h.slice(-5);
  const dots = last5.map(s => {
    const p = parseInt(s.pulse) || 0;
    const sp = parseInt(s.spo2) || 100;
    const hPx = Math.max(3, Math.min(12, Math.round((p / 160) * 12)));
    const cls = sp < 90 ? 'crit' : sp < 94 ? 'warn' : '';
    return `<div class="sparkline-dot ${cls}" style="height:${hPx}px"></div>`;
  }).join('');
  return `<div class="sparkline" title="מגמת דופק">${dots}</div>`;
}

// ── 3. QUICK VITALS inline update ──
function toggleQuickVitals(casId) {
  const el = document.getElementById('qv-' + casId);
  if (!el) return;
  if (el.style.display === 'none' || !el.innerHTML) {
    const c = S.casualties.find(x => x.id == casId); if (!c) return;
    const v = c.vitals || {};
    el.innerHTML = `<div class="qv-form">
      <div style="text-align:center"><div class="qv-label">💓 דופק</div><input class="qv-inp" id="qvi-p-${casId}" value="${v.pulse || ''}" inputmode="numeric" maxlength="3"></div>
      <div style="text-align:center"><div class="qv-label">🫁 SpO2</div><input class="qv-inp" id="qvi-s-${casId}" value="${v.spo2 || ''}" inputmode="numeric" maxlength="3"></div>
      <div style="text-align:center"><div class="qv-label">🧠 GCS</div><input class="qv-inp" id="qvi-g-${casId}" value="${v.gcs || ''}" inputmode="numeric" maxlength="2"></div>
      <div style="text-align:center"><div class="qv-label">⚡ BP</div><input class="qv-inp" id="qvi-b-${casId}" value="${v.bp || ''}" style="width:66px" maxlength="7"></div>
      <button class="qv-save" onclick="event.stopPropagation();saveQuickVitals(${casId})">✓</button>
    </div>`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}
function saveQuickVitals(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const p = document.getElementById('qvi-p-' + casId);
  const s = document.getElementById('qvi-s-' + casId);
  const g = document.getElementById('qvi-g-' + casId);
  const b = document.getElementById('qvi-b-' + casId);
  if (p && p.value) c.vitals.pulse = p.value;
  if (s && s.value) c.vitals.spo2 = s.value;
  if (g && g.value) c.vitals.gcs = g.value;
  if (b && b.value) c.vitals.bp = b.value;
  snapshotVitals(casId);
  const el = document.getElementById('qv-' + casId);
  if (el) el.style.display = 'none';
  renderWarRoom(); saveState();
  showToast('📊 מדדים עודכנו — ' + c.name);
}

// ── 5. CARD SWIPE ACTIONS ──
function initCardSwipe() {
  document.querySelectorAll('[id^="carc-"]').forEach(card => {
    if (card._swipeInit) return;
    card._swipeInit = true;
    let sx = 0, dx = 0, swiping = false;
    card.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX; dx = 0; swiping = true;
    }, { passive: true });
    card.addEventListener('touchmove', e => {
      if (!swiping) return;
      dx = e.touches[0].clientX - sx;
      if (Math.abs(dx) > 10) {
        card.style.transform = `translateX(${dx * 0.4}px)`;
        card.style.transition = 'none';
      }
    }, { passive: true });
    card.addEventListener('touchend', () => {
      card.style.transition = 'transform .25s var(--ease-out)';
      const casId = parseInt(card.id.replace('carc-', ''));
      if (dx < -60) {
        // Swipe left → show quick priority change
        card.style.transform = '';
        swipeCardAction(casId, 'left');
      } else if (dx > 60) {
        // Swipe right → open details
        card.style.transform = '';
        jumpToCas(casId);
      } else {
        card.style.transform = '';
      }
      swiping = false; dx = 0;
    }, { passive: true });
  });
}
function swipeCardAction(casId, dir) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (dir === 'left') {
    // Quick action menu: escalate / assign medic / evac
    const prioBtns = ['T1', 'T2', 'T3', 'T4'].filter(p => p !== c.priority).map(p =>
      `<button class="btn btn-sm" style="border-color:${pClr(p)};color:${pClr(p)}" onclick="changePriority(${casId},'${p}');forceClose()">${p}</button>`
    ).join('');
    openModal('⚡ פעולה מהירה — ' + c.name, `
      <div class="pad col" style="gap:10px">
        <div style="font-size:11px;color:var(--muted2)">שנה סיווג:</div>
        <div style="display:flex;gap:8px">${prioBtns}</div>
        <button class="btn btn-md btn-ghost btn-full" onclick="openBuddyAssign(${casId});forceClose()">🩺 הקצה מטפל</button>
        <button class="btn btn-md btn-ghost btn-full" style="border-color:var(--blue2);color:var(--olive3)" onclick="fireCasevacFor(${casId});forceClose()">🚁 סמן לפינוי</button>
      </div>`);
  }
}
function fireCasevacFor(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.evacType = c.evacType ? null : 'מוסק';
  addTL(casId, c.name, c.evacType ? '🚁 סומן לפינוי' : 'ביטול פינוי', 'blue');
  renderWarRoom(); saveState(); showToast(c.evacType ? '🚁 סומן לפינוי' : 'ביטול סימון פינוי');
}

// ── 6. TRIAGE BOARD DRAG & DROP ──
let _dragCasId = null;
function initTriageDrag() {
  document.querySelectorAll('.tb-card').forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      _dragCasId = parseInt(card.dataset.casId);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.tb-col').forEach(col => col.classList.remove('drag-over'));
    });
  });
  document.querySelectorAll('.tb-col').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (_dragCasId === null) return;
      const newPrio = col.id.replace('tb-col-', '').toUpperCase();
      changePriority(_dragCasId, newPrio);
      _dragCasId = null;
    });
  });
}
// Override renderTriageBoardView to add drag support
const _origRenderTriageBoard = renderTriageBoardView;
renderTriageBoardView = function () {
  const cols = { T1: $('tb-col-t1'), T2: $('tb-col-t2'), T3: $('tb-col-t3'), T4: $('tb-col-t4') };
  Object.values(cols).forEach(col => {
    if (!col) return;
    const hdr = col.querySelector('.tb-col-hdr');
    col.innerHTML = ''; col.appendChild(hdr);
  });
  S.casualties.forEach(c => {
    const col = cols[c.priority]; if (!col) return;
    const card = document.createElement('div');
    card.className = 'tb-card';
    card.dataset.casId = c.id;
    card.onclick = () => jumpToCas(c.id);
    const v = c.vitals || {};
    const tq = c.tqStart ? formatTQ(Date.now() - c.tqStart) : '';
    card.innerHTML = `<div class="tb-card-name">${escHTML(c.name)}</div>
      <div class="tb-card-meta">${c.blood ? '🩸' + escHTML(c.blood) : ''} ${v.pulse ? '❤️' + v.pulse : ''} ${tq ? '⏱' + tq : ''}</div>`;
    col.appendChild(card);
  });
  initTriageDrag();
};

// ═══════════════════════════════════════════════════
// SW UPDATE LISTENER
// ═══════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      showToast('🔄 גרסה חדשה זמינה — רענן את הדף', 8000);
    }
  });
}
