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
