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