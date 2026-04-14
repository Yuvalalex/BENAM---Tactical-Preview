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
