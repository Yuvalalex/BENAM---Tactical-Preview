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
