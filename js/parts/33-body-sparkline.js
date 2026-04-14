// ═══════════════════════════════════════════════════
// BATCH 3: INJURY BODY MAP (for Form 101)
// ═══════════════════════════════════════════════════
function renderInjuryBodyMap(injuries) {
  const frontInj = injuries.filter(i => i.side === 'front' || !i.side);
  const backInj = injuries.filter(i => i.side === 'back');
  const dotsSvg = (list) => list.map(inj => `
    <circle cx="${inj.cx}" cy="${inj.cy}" r="7" fill="${injTypeColor(inj.type)}" opacity=".92" stroke="#000" stroke-width="1"/>
    <text x="${inj.cx}" y="${inj.cy + 4}" text-anchor="middle" font-size="8" fill="#fff" font-weight="700">${(inj.type || '?')[0]}</text>`).join('');

  const bodySvg = (side, dots, label, fill, stroke) => `
    <div style="display:inline-flex;flex-direction:column;align-items:center;gap:2px">
      <div style="font-size:9px;font-weight:700;color:#556">${label}</div>
      <svg width="110" height="200" viewBox="0 0 110 200">
        <ellipse cx="55" cy="16" rx="14" ry="15" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="49" y="30" width="12" height="8" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="30" y="38" width="50" height="54" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        ${side === 'back' ? `<line x1="55" y1="39" x2="55" y2="90" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="3,2"/>` : ''}
        <rect x="10" y="39" width="18" height="48" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="82" y="39" width="18" height="48" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="30" y="92" width="21" height="68" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <rect x="59" y="92" width="21" height="68" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <text x="55" y="18" text-anchor="middle" font-size="8" fill="${stroke}" font-family="Arial">${side === 'front' ? 'ראש' : 'עורף'}</text>
        ${side === 'front' ? `
          <text x="55" y="66" text-anchor="middle" font-size="8" fill="${stroke}" font-family="Arial">חזה</text>
          <text x="55" y="84" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">בטן</text>
          <text x="18" y="65" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">יד</text>
          <text x="92" y="65" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">יד</text>
          <text x="40" y="132" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">רגל</text>
          <text x="70" y="132" text-anchor="middle" font-size="7" fill="${stroke}" font-family="Arial">רגל</text>
        `: `<text x="55" y="66" text-anchor="middle" font-size="8" fill="${stroke}" font-family="Arial">גב</text>`}
        ${dots}
      </svg>
    </div>`;

  const legend = INJ_TYPES.filter(t => t.k !== 'אחר').map(t =>
    `<span style="display:inline-flex;align-items:center;gap:2px;font-size:8px;color:#556;margin:0 4px">
      <span style="width:10px;height:10px;border-radius:50%;background:${t.color};display:inline-block"></span>${t.k}
    </span>`).join('');

  const injList = injuries.length ? injuries.map(inj =>
    `<div style="display:flex;align-items:center;gap:4px;font-size:9px;padding:2px 0;border-bottom:1px solid #eee">
      <span style="width:8px;height:8px;border-radius:50%;background:${injTypeColor(inj.type)};flex-shrink:0"></span>
      <strong>${inj.type}</strong> — ${inj.zone}
      <span style="color:#888;font-size:8px">${inj.side === 'back' ? 'אחורי' : 'קדמי'}</span>
    </div>`).join('') : '<div style="font-size:9px;color:#888">לא תועדו פציעות</div>';

  return `<div style="text-align:center">
    <div style="display:flex;justify-content:center;gap:14px;margin-bottom:6px">
      ${bodySvg('front', dotsSvg(frontInj), 'קדמי', '#e8ede8', '#4a6640')}
      ${bodySvg('back', dotsSvg(backInj), 'אחורי', '#e4e8e4', '#3a5030')}
    </div>
    <div style="margin-bottom:6px">${legend}</div>
    <div style="text-align:right;border-top:1px solid #ccc;padding-top:4px;margin-top:2px">
      <div style="font-size:9px;color:#666;font-weight:700;margin-bottom:3px">פציעות רשומות:</div>
      ${injList}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════
// WAR ROOM v2 — ENHANCED FEATURES
// ═══════════════════════════════════════════════════

// ── 7. SPARKLINE: mini vitals trend dots ──
function renderSparkline(c) {
  const h = c.vitalsHistory;
  if (!h || h.length < 2) return '';
  const last5 = h.slice(-5);
  const dots = last5.map(s => {
    const p = parseInt(s.pulse) || 0;
    const sp = parseInt(s.spo2) || 100;
    const hPx = Math.max(3, Math.min(12, Math.round((p / 160) * 12)));
    const cls = sp < 90 ? 'crit' : sp < 94 ? 'warn' : '';
    return `<div class="sparkline-dot ${cls}" style="height:${hPx}px"></div>`;
  }).join('');
  return `<div class="sparkline" title="מגמת דופק">${dots}</div>`;
}

// ── 3. QUICK VITALS inline update ──
function toggleQuickVitals(casId) {
  const el = document.getElementById('qv-' + casId);
  if (!el) return;
  if (el.style.display === 'none' || !el.innerHTML) {
    const c = S.casualties.find(x => x.id == casId); if (!c) return;
    const v = c.vitals || {};
    el.innerHTML = `<div class="qv-form">
      <div style="text-align:center"><div class="qv-label">💓 דופק</div><input class="qv-inp" id="qvi-p-${casId}" value="${v.pulse || ''}" inputmode="numeric" maxlength="3"></div>
      <div style="text-align:center"><div class="qv-label">🫁 SpO2</div><input class="qv-inp" id="qvi-s-${casId}" value="${v.spo2 || ''}" inputmode="numeric" maxlength="3"></div>
      <div style="text-align:center"><div class="qv-label">🧠 GCS</div><input class="qv-inp" id="qvi-g-${casId}" value="${v.gcs || ''}" inputmode="numeric" maxlength="2"></div>
      <div style="text-align:center"><div class="qv-label">⚡ BP</div><input class="qv-inp" id="qvi-b-${casId}" value="${v.bp || ''}" style="width:66px" maxlength="7"></div>
      <button class="qv-save" onclick="event.stopPropagation();saveQuickVitals(${casId})">✓</button>
    </div>`;
    el.style.display = '';
  } else {
    el.style.display = 'none';
  }
}
function saveQuickVitals(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const p = document.getElementById('qvi-p-' + casId);
  const s = document.getElementById('qvi-s-' + casId);
  const g = document.getElementById('qvi-g-' + casId);
  const b = document.getElementById('qvi-b-' + casId);
  if (p && p.value) c.vitals.pulse = p.value;
  if (s && s.value) c.vitals.spo2 = s.value;
  if (g && g.value) c.vitals.gcs = g.value;
  if (b && b.value) c.vitals.bp = b.value;
  snapshotVitals(casId);
  const el = document.getElementById('qv-' + casId);
  if (el) el.style.display = 'none';
  renderWarRoom(); saveState();
  showToast('📊 מדדים עודכנו — ' + c.name);
}

// ── 5. CARD SWIPE ACTIONS ──
function initCardSwipe() {
  document.querySelectorAll('[id^="carc-"]').forEach(card => {
    if (card._swipeInit) return;
    card._swipeInit = true;
    let sx = 0, dx = 0, swiping = false;
    card.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX; dx = 0; swiping = true;
    }, { passive: true });
    card.addEventListener('touchmove', e => {
      if (!swiping) return;
      dx = e.touches[0].clientX - sx;
      if (Math.abs(dx) > 10) {
        card.style.transform = `translateX(${dx * 0.4}px)`;
        card.style.transition = 'none';
      }
    }, { passive: true });
    card.addEventListener('touchend', () => {
      card.style.transition = 'transform .25s var(--ease-out)';
      const casId = parseInt(card.id.replace('carc-', ''));
      if (dx < -60) {
        // Swipe left → show quick priority change
        card.style.transform = '';
        swipeCardAction(casId, 'left');
      } else if (dx > 60) {
        // Swipe right → open details
        card.style.transform = '';
        jumpToCas(casId);
      } else {
        card.style.transform = '';
      }
      swiping = false; dx = 0;
    }, { passive: true });
  });
}
function swipeCardAction(casId, dir) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (dir === 'left') {
    // Quick action menu: escalate / assign medic / evac
    const prioBtns = ['T1', 'T2', 'T3', 'T4'].filter(p => p !== c.priority).map(p =>
      `<button class="btn btn-sm" style="border-color:${pClr(p)};color:${pClr(p)}" onclick="changePriority(${casId},'${p}');forceClose()">${p}</button>`
    ).join('');
    openModal('⚡ פעולה מהירה — ' + c.name, `
      <div class="pad col" style="gap:10px">
        <div style="font-size:11px;color:var(--muted2)">שנה סיווג:</div>
        <div style="display:flex;gap:8px">${prioBtns}</div>
        <button class="btn btn-md btn-ghost btn-full" onclick="openBuddyAssign(${casId});forceClose()">🩺 הקצה מטפל</button>
        <button class="btn btn-md btn-ghost btn-full" style="border-color:var(--blue2);color:var(--olive3)" onclick="fireCasevacFor(${casId});forceClose()">🚁 סמן לפינוי</button>
      </div>`);
  }
}
function fireCasevacFor(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.evacType = c.evacType ? null : 'מוסק';
  addTL(casId, c.name, c.evacType ? '🚁 סומן לפינוי' : 'ביטול פינוי', 'blue');
  renderWarRoom(); saveState(); showToast(c.evacType ? '🚁 סומן לפינוי' : 'ביטול סימון פינוי');
}

// ── 6. TRIAGE BOARD DRAG & DROP ──
let _dragCasId = null;
function initTriageDrag() {
  document.querySelectorAll('.tb-card').forEach(card => {
    card.setAttribute('draggable', 'true');
    card.addEventListener('dragstart', e => {
      _dragCasId = parseInt(card.dataset.casId);
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      document.querySelectorAll('.tb-col').forEach(col => col.classList.remove('drag-over'));
    });
  });
  document.querySelectorAll('.tb-col').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (_dragCasId === null) return;
      const newPrio = col.id.replace('tb-col-', '').toUpperCase();
      changePriority(_dragCasId, newPrio);
      _dragCasId = null;
    });
  });
}
// Override renderTriageBoardView to add drag support
const _origRenderTriageBoard = renderTriageBoardView;
renderTriageBoardView = function () {
  const cols = { T1: $('tb-col-t1'), T2: $('tb-col-t2'), T3: $('tb-col-t3'), T4: $('tb-col-t4') };
  Object.values(cols).forEach(col => {
    if (!col) return;
    const hdr = col.querySelector('.tb-col-hdr');
    col.innerHTML = ''; col.appendChild(hdr);
  });
  S.casualties.forEach(c => {
    const col = cols[c.priority]; if (!col) return;
    const card = document.createElement('div');
    card.className = 'tb-card';
    card.dataset.casId = c.id;
    card.onclick = () => jumpToCas(c.id);
    const v = c.vitals || {};
    const tq = c.tqStart ? formatTQ(Date.now() - c.tqStart) : '';
    card.innerHTML = `<div class="tb-card-name">${escHTML(c.name)}</div>
      <div class="tb-card-meta">${c.blood ? '🩸' + escHTML(c.blood) : ''} ${v.pulse ? '❤️' + v.pulse : ''} ${tq ? '⏱' + tq : ''}</div>`;
    col.appendChild(card);
  });
  initTriageDrag();
};

// ═══════════════════════════════════════════════════
// SW UPDATE LISTENER
// ═══════════════════════════════════════════════════
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      showToast('🔄 גרסה חדשה זמינה — רענן את הדף', 8000);
    }
  });
}
