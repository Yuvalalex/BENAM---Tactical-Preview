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