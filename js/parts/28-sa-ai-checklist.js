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
