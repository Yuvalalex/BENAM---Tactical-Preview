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