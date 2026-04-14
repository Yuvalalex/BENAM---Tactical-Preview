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
