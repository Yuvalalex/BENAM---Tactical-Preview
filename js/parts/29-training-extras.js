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
