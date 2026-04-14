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
