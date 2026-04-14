
// ══ CONTROL BOARD ══════════════════════════════════
function renderControlBoard() {
  if (!S.casualties.length) return '<div style="padding:16px;text-align:center;color:var(--muted);font-size:13px">אין פגועים</div>';
  const now = Date.now();
  const rows = S.casualties.slice().sort((a, b) => prioN(a.priority) - prioN(b.priority)).map(c => {
    const formOK = c.kg && c.blood;
    const hasTx = c.txList && c.txList.length > 0;
    const hasVitals = c.vitalsHistory && c.vitalsHistory.length > 0;
    const tqSec = c.tqStart ? Math.floor((now - c.tqStart) / 1000) : null;
    const tqBadge = tqSec === null ? '<span style="color:var(--muted)">—</span>' :
      tqSec > MEDICAL.TQ_CRITICAL_SEC ? `<span style="color:var(--red3);font-weight:700">TQ ${Math.floor(tqSec / 60)}′⚠</span>` :
        tqSec > MEDICAL.TQ_WARN_SEC ? `<span style="color:var(--amber3);font-weight:700">TQ ${Math.floor(tqSec / 60)}′</span>` :
          `<span style="color:var(--olive3)">TQ ${Math.floor(tqSec / 60)}′</span>`;
    const medicName = c.medic ? escHTML(c.medic) : '<span style="color:var(--muted)">—</span>';
    const buddyName = c.buddyName ? escHTML(c.buddyName) : '<span style="color:var(--muted)">—</span>';
    const issues = [];
    if (!formOK) issues.push('טופס חסר');
    if (!hasTx) issues.push('ללא טיפול');
    if (!hasVitals) issues.push('ללא מדדים');
    if (tqSec !== null && tqSec > MEDICAL.TQ_CRITICAL_SEC) issues.push('TQ קריטי');
    if (!c.medic) issues.push('ללא מטפל');
    const issueHtml = issues.length
      ? issues.map(i => `<span style="background:rgba(200,40,40,.18);color:var(--red3);border-radius:3px;padding:1px 5px;font-size:9px;white-space:nowrap">${i}</span>`).join(' ')
      : '<span style="color:var(--green3);font-size:11px">✓</span>';
    const rowBg = issues.length > 1 ? 'background:rgba(200,40,40,.06)' : issues.length === 1 ? 'background:rgba(200,130,0,.05)' : '';
    return `<tr onclick="jumpToCas(${c.id});forceClose()" style="cursor:pointer;border-bottom:1px solid var(--b0);${rowBg}">
      <td style="padding:7px 8px"><span style="color:${pClr(c.priority)};font-weight:900;font-size:11px">${c.priority}</span></td>
      <td style="padding:7px 8px;font-weight:700;font-size:12px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML(c.name)}</td>
      <td style="padding:7px 6px;font-size:10px;color:var(--olive3);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${medicName}</td>
      <td style="padding:7px 6px;font-size:10px;color:var(--blue2);max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${buddyName}</td>
      <td style="padding:7px 6px;text-align:center;font-size:10px">${tqBadge}</td>
      <td style="padding:7px 8px;font-size:10px">${issueHtml}</td>
    </tr>`;
  }).join('');
  const t1c = S.casualties.filter(c => c.priority === 'T1').length;
  const needsAction = S.casualties.filter(c => (!c.kg || !c.blood) || (!c.txList || !c.txList.length));
  const noMedic = S.casualties.filter(c => !c.medic).length;
  const summary = `<div style="display:flex;gap:10px;padding:8px 10px 4px;flex-wrap:wrap">
    <span style="font-size:10px;color:var(--muted2)">סה"כ: <b style="color:var(--white)">${S.casualties.length}</b></span>
    ${t1c ? `<span style="font-size:10px;color:var(--red3);font-weight:700">T1: ${t1c}</span>` : ''}
    ${noMedic ? `<span style="font-size:10px;color:var(--amber3)">⚠ ${noMedic} ללא מטפל</span>` : ''}
    ${needsAction.length ? `<span style="font-size:10px;color:var(--amber3)">⚠ ${needsAction.length} דורשים פעולה</span>` :
      '<span style="font-size:10px;color:var(--green3)">✓ כולם תועדו</span>'}
  </div>`;
  return `${summary}<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr style="border-bottom:1px solid var(--b1)">
      <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--muted2);white-space:nowrap">סיווג</th>
      <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--muted2)">שם</th>
      <th style="padding:4px 6px;text-align:right;font-size:9px;color:var(--muted2)" title="מטפל">🩺 מטפל</th>
      <th style="padding:4px 6px;text-align:right;font-size:9px;color:var(--muted2)" title="שומר">👥 שומר</th>
      <th style="padding:4px 6px;text-align:center;font-size:9px;color:var(--muted2)">TQ</th>
      <th style="padding:4px 8px;text-align:right;font-size:9px;color:var(--muted2)">חסרים</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
function openControlBoard() {
  const controlHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:12px;font-weight:700">📋 לוח שליטה — סטטוס פגועים</span>
      <button class="btn btn-xs btn-ghost" style="font-size:11px;padding:0 8px;min-height:22px" onclick="openTriageTags()">🏷️ תגים טריאז'</button>
    </div>
    <div style="padding:0 4px 8px">${renderControlBoard()}</div>
  `;
  openModal('📋 לוח שליטה', controlHtml);
}
// ═══════════════════════════════════════════════════

// ── Track expanded cards in War Room ──
const _expandedCards = new Set();
function toggleCardExpand(casId, ev) {
  if (ev) ev.stopPropagation();
  const body = document.getElementById('cex-' + casId);
  if (!body) return;
  if (_expandedCards.has(casId)) {
    _expandedCards.delete(casId);
    body.classList.remove('open');
  } else {
    _expandedCards.add(casId);
    body.classList.add('open');
  }
}

// ── MARCH dots helper ──
function marchDotsHTML(c) {
  const m = c.march || { M: 0, A: 0, R: 0, C: 0, H: 0 };
  return `<div class="march-dots" title="MARCH">${['M', 'A', 'R', 'C', 'H'].map(l =>
    `<div class="march-dot${(m[l] || 0) > 0 ? ' done-' + l : ''}" title="${l}"></div>`
  ).join('')
    }</div>`;
}

function renderAdaptiveCard(c) {
  const tier = (c.priority || 'T3')[1]; // '1','2','3','4'
  const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
  const _adRef = c._addedAt || c.tqStart;
  const tqCritClass = tqM !== null && tqM > 30 ? ' tq-crit-pulse' : '';
  const tqBadge = tqM !== null ? `<span id="tq-inline-${c.id}" class="${tqCritClass}" style="font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.3)">TQ ${tqM}′</span>` : '';
  const txaBadge = _adRef && (180 - Math.floor((Date.now() - _adRef) / 60000)) < 60 ? `<span style="font-size:9px;color:var(--red3);font-weight:700">💉TXA ${Math.max(0, 180 - Math.floor((Date.now() - _adRef) / 60000))}′</span>` : '';
  const escBadge = c.escalated ? `<span class="esc-badge">↑ESC</span>` : '';
  const evacBadge = c.evacType ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${c.evacType === 'מוסק' ? 'rgba(40,68,170,.3)' : 'rgba(100,80,20,.3)'};color:${c.evacType === 'מוסק' ? 'var(--olive3)' : 'var(--amber3)'};font-weight:700">${c.evacType === 'מוסק' ? '🚁' : '🚗'} ${c.evacType}</span>` : '';
  const trend = getDeteriorationTrend(c);
  const trendIcon = trend.level === 'severe' ? '📉' : trend.level === 'mild' ? '↓' : '';
  const dots = marchDotsHTML(c);

  // MARCH progress bar (% complete)
  const marchObj = c.march || { M: 0, A: 0, R: 0, C: 0, H: 0 };
  const marchDone = Object.values(marchObj).filter(v => v > 0).length;
  const marchPct = Math.round((marchDone / 5) * 100);
  const marchBar = `<div class="march-bar"><div class="march-bar-fill" style="width:${marchPct}%"></div></div>`;

  // Sparkline (vitals trend mini dots)
  const sparkline = renderSparkline(c);

  // Wait time
  const waitM = c._addedAt ? Math.floor((Date.now() - c._addedAt) / 60000) : null;
  const waitBadge = waitM !== null && waitM > 0 ? `<span style="font-size:8px;padding:1px 5px;border-radius:3px;background:${waitM > 30 ? 'rgba(200,40,40,.35)' : waitM > 15 ? 'rgba(200,120,0,.25)' : 'rgba(80,100,60,.2)'};color:${waitM > 30 ? 'var(--red3)' : waitM > 15 ? 'var(--amber3)' : 'var(--muted2)'};font-family:var(--font-mono);font-weight:700">${waitM}′</span>` : '';

  const vitRow = renderVitalsRow(c);

  if (tier === '4') {
    return `<div class="cas-card-t4" id="carc-${c.id}">
      <div class="cas-hdr-t4" onclick="jumpToCas(${c.id})">
        <span class="prio pt4">T4</span>
        <span class="cas-name-t4">${escHTML(c.name)}</span>
        <span style="font-size:9px;color:var(--muted)">${c.mech.join('/')}</span>
      </div>
      ${vitRow}
    </div>`;
  }

  if (tier === '3') {
    const isOpen = _expandedCards.has(c.id);
    return `<div class="cas-card-t3" id="carc-${c.id}">
      <div class="cas-hdr-t3" onclick="toggleCardExpand(${c.id},event)">
        <span class="prio pt3">T3</span>
        <span class="cas-name-t3">${escHTML(c.name)}</span>
        ${tqBadge} ${dots} ${sparkline}
        <span style="font-size:9px;color:var(--muted)">${c.mech[0] || ''}</span>
        ${escBadge} ${evacBadge}
        <span class="cas-expand-arrow">${isOpen ? '▾' : '◂'}</span>
      </div>
      ${vitRow}
      <div class="cas-expand-body${isOpen ? ' open' : ''}" id="cex-${c.id}">
        <div class="cas-qbar">
          ${tqM === null ? `<button class="cas-qbtn red" onclick="event.stopPropagation();fireTQFor(${c.id})">🩹 TQ</button>` : `<button class="cas-qbtn amber" onclick="event.stopPropagation();fireTQFor(${c.id})">TQ↻</button>`}
          <button class="cas-qbtn amber" onclick="event.stopPropagation();addTXA(${c.id})">💉 TXA</button>
          <button class="cas-qbtn olive" onclick="event.stopPropagation();changePriority(${c.id},'T2')">↑ T2</button>
          <button class="cas-qbtn" onclick="jumpToCas(${c.id})">📋 פרטים</button>
        </div>
      </div>
      ${marchBar}
    </div>`;
  }

  if (tier === '2') {
    const isOpen = _expandedCards.has(c.id);
    return `<div class="cas-card-t2" id="carc-${c.id}">
      <div class="cas-hdr-t2" onclick="toggleCardExpand(${c.id},event)">
        <span class="prio pt2">T2</span>
        <span class="cas-name-t2">${escHTML(c.name)}</span>
        ${dots} ${sparkline}
        ${waitBadge} ${tqBadge} ${txaBadge} ${escBadge} ${evacBadge}
        ${trendIcon ? `<span style="font-size:14px">${trendIcon}</span>` : ''}
        <span class="cas-expand-arrow">${isOpen ? '▾' : '◂'}</span>
      </div>
      ${vitRow}
      <div class="cas-expand-body${isOpen ? ' open' : ''}" id="cex-${c.id}">
        <div class="cas-qbar">
          ${tqM === null ? `<button class="cas-qbtn red" onclick="event.stopPropagation();fireTQFor(${c.id})">🩹 TQ</button>` : `<button class="cas-qbtn amber" onclick="event.stopPropagation();fireTQFor(${c.id})">TQ↻</button>`}
          <button class="cas-qbtn amber" onclick="event.stopPropagation();addTXA(${c.id})">💉 TXA</button>
          <button class="cas-qbtn olive" onclick="event.stopPropagation();changePriority(${c.id},'T1')">↑ T1</button>
          <button class="cas-qbtn" onclick="event.stopPropagation();toggleQuickVitals(${c.id})">📊</button>
          <button class="cas-qbtn" onclick="jumpToCas(${c.id})">📋 פרטים</button>
        </div>
        <div id="qv-${c.id}" style="display:none"></div>
      </div>
      ${marchBar}
    </div>`;
  }

  // T1 — collapsible like T2, but keeps T1 visual style.
  const isOpen = _expandedCards.has(c.id);
  const injuryItems = (c.injuries && c.injuries.length) ? c.injuries.map(i => `${i.type} ${i.zone}${i.side ? ' ' + (i.side === 'back' ? '(אחורי)' : '(קדמי)') : ''}`) : [];
  const injurySummary = injuryItems.join(' | ');
  const mechSummary = (c.mech && c.mech.length) ? c.mech.join(' · ') : (injuryItems.length ? injuryItems[0] : '—');
  return `<div class="cas-card-t1" id="carc-${c.id}">
    <div class="cas-hdr-t1" onclick="toggleCardExpand(${c.id},event)">
      <span class="prio pt1" style="font-size:14px">T1</span>
      <div style="flex:1">
        <div class="cas-name-t1">${escHTML(c.name)}</div>
        <div style="font-size:10px;color:rgba(255,255,255,.6);margin-top:1px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;line-height:1.2">
          <span>${escHTML(mechSummary)}</span>
          <span>🩸${escHTML(c.blood || '?')}</span>
          <span>${c.kg}kg</span>
        </div>
        ${injurySummary ? `<div style="font-size:11px;color:var(--white);font-weight:700;margin-top:3px;line-height:1.35;white-space:normal;max-height:48px;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.02em;">${escHTML(injurySummary)}</div>` : ''}
      </div>
      <div style="text-align:left;display:flex;flex-direction:column;align-items:flex-end;gap:3px">
        ${dots} ${sparkline}
        ${waitBadge} ${tqBadge} ${txaBadge} ${escBadge} ${evacBadge}
        ${trendIcon ? `<span style="font-size:16px">${trendIcon}</span>` : ''}
        <span class="cas-expand-arrow">${isOpen ? '▾' : '◂'}</span>
      </div>
    </div>
    ${vitRow}
    <div class="cas-expand-body${isOpen ? ' open' : ''}" id="cex-${c.id}">
      <div class="cas-qbar">
        ${tqM === null ? `<button class="cas-qbtn red" onclick="event.stopPropagation();fireTQFor(${c.id})">🩹 TQ</button>` : `<button class="cas-qbtn amber" onclick="event.stopPropagation();fireTQFor(${c.id})">TQ ${tqM}′↻</button>`}
        <button class="cas-qbtn amber" onclick="event.stopPropagation();addTXA(${c.id})">💉 TXA</button>
        <button class="cas-qbtn" onclick="event.stopPropagation();toggleQuickVitals(${c.id})">📊 עדכן</button>
        <button class="cas-qbtn" onclick="jumpToCas(${c.id})">📋</button>
        <button class="cas-qbtn" onclick="event.stopPropagation();openHospHandoff(${c.id})">🏥</button>
      </div>
      <div id="qv-${c.id}" style="display:none"></div>
    </div>
    ${marchBar}
  </div>`;
}

function renderVitalsRow(c) {
  const v = c.vitals;
  const trend = getDeteriorationTrend(c);
  const pArr = trend.pulseDir === 'up' ? '↑' : trend.pulseDir === 'dn' ? '↓' : '';
  const sArr = trend.spo2Dir === 'dn' ? '↓' : trend.spo2Dir === 'up' ? '↑' : '';
  const gArr = trend.gcsDir === 'dn' ? '↓' : trend.gcsDir === 'up' ? '↑' : '';
  const pCls = trend.pulseDir === 'up' && parseInt(v.pulse) > 110 ? 'trend-warn' : trend.pulseDir === 'dn' && parseInt(v.pulse) < 50 ? 'trend-dn' : '';
  const sCls = trend.spo2Dir === 'dn' ? 'trend-dn' : parseInt(v.spo2) < 94 ? 'trend-warn' : 'trend-ok';
  const gCls = trend.gcsDir === 'dn' ? 'trend-dn' : '';
  if (!v.pulse && !v.spo2 && !v.gcs) return '';
  return `<div class="cas-vitals-row">
    ${v.pulse ? `<div class="cvr-item">💓 <span class="cvr-val ${pCls}">${v.pulse}</span><span class="trend-warn">${pArr}</span></div>` : ''}
    ${v.spo2 ? `<div class="cvr-item">🫁 <span class="cvr-val ${sCls}">${v.spo2}%</span><span class="${sCls}">${sArr}</span></div>` : ''}
    ${v.gcs ? `<div class="cvr-item">🧠 GCS<span class="cvr-val ${gCls}">${v.gcs}</span><span class="${gCls}">${gArr}</span></div>` : ''}
    ${v.bp ? `<div class="cvr-item">⚡ <span class="cvr-val">${v.bp}</span></div>` : ''}
    ${c.medic ? `<div class="cvr-item" style="margin-right:auto">🩺 <span style="color:var(--olive3)">${escHTML(c.medic)}</span></div>` : ''}
  </div>`;
}

// Inline quick-action helpers
function fireTQFor(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (c.tqStart) {
    // reset TQ
    c.tqStart = Date.now();
    addTXFor(c, 'TQ ↻ חודש', casId);
    addTL(casId, c.name, 'TQ חודש ⏱', 'amber');
  } else {
    c.tqStart = Date.now();
    c.march.M = (c.march.M || 0) + 1;
    addTXFor(c, 'TQ — חוסם', casId);
    addTL(casId, c.name, 'TQ הופעל 🩹', 'red');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }
  renderWarRoom(); saveState();
}
function addTXFor(c, type, casId) {
  c.txList.push({ type, time: nowTime(), ms: Date.now() });
  checkAllergy(casId, type);
  saveMesh(casId, 'tx', { type, time: nowTime() });
}
function addTXA(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (checkAllergy(casId, 'TXA')) return;
  c.txList.push({ type: 'TXA 1g', time: nowTime(), ms: Date.now() });
  addTL(casId, c.name, 'TXA ניתן 💉', 'olive');
  saveMesh(casId, 'tx', { type: 'TXA 1g', time: nowTime() });
  renderWarRoom(); showToast(`✓ TXA — ${c.name}`); saveState();
}
// startGuidedFlow — defined above with full MARCH steps
