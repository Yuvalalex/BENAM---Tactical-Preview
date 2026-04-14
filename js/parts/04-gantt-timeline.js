// ═══ AUTO 9-LINE ════════════════════════════════════
function autoGenReport() {
  if (!S.casualties.length) return;
  genReport();
}

// ═══ TIMELINE FILTER ════════════════════════════════
let _tlFilter = null;

function renderTimeline() {
  const listFull = $('timeline-list');
  const listStats = $('timeline-list-stats');
  if (!S.timeline.length) {
    if (listFull) listFull.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">טרום אירוע</div>';
    if (listStats) listStats.innerHTML = '<div style="text-align:center;padding:15px;color:var(--muted);font-size:11px">אין אירועים רשומים</div>';
    return;
  }

  // Build filter chips
  const names = [...new Set(S.timeline.map(t => t.name).filter(n => n !== 'SYSTEM'))];
  const filterHTML = `
    <div style="display:flex;gap:5px;padding:4px 10px 8px;overflow-x:auto;flex-wrap:nowrap">
      <button class="btn btn-xs ${_tlFilter === null ? 'btn-olive' : 'btn-ghost'}" onclick="_tlFilter=null;renderTimeline()">הכל</button>
      ${names.map(n => `<button class="btn btn-xs ${_tlFilter === n ? 'btn-olive' : 'btn-ghost'}" style="white-space:nowrap" onclick="_tlFilter='${escHTML(n)}';renderTimeline()">${escHTML(n)}</button>`).join('')}
    </div>`;

  const filtered = _tlFilter ? S.timeline.filter(t => t.name === _tlFilter || t.name === 'SYSTEM') : S.timeline;
  const dotClr = { red: 'var(--red3)', amber: 'var(--amber3)', green: 'var(--green3)', olive: 'var(--olive3)', muted: 'var(--muted)' };

  const itemsHTML = filtered.map(t => `
    <div class="tl-item" onclick="_tlFilter='${escHTML(t.name)}';renderTimeline()" style="cursor:pointer; padding: 10px 14px">
      <div class="tl-time" style="width:45px">${t.time}</div>
      <div class="tl-dot" style="background:${dotClr[t.color] || 'var(--muted)'}; width:8px; height:8px; margin-top:5px"></div>
      <div style="flex:1">
        <div class="tl-who" style="color:${_tlFilter === t.name ? 'var(--olive3)' : 'inherit'}; font-size:12px">${escHTML(t.name)}</div>
        <div class="tl-what" style="font-size:11px; color:var(--muted2)">${escHTML(t.what)}</div>
      </div>
    </div>`).reverse().join('');

  if (listFull) listFull.innerHTML = filterHTML + itemsHTML;
  if (listStats) listStats.innerHTML = itemsHTML;

  // Update Notification Center while we're at it
  renderUpdateCenter();
}

function renderUpdateCenter() {
  const el = $('stat-updates-list');
  if (!el) return;
  const alerts = [];
  
  // Check for critical TQs
  S.casualties.forEach(c => {
    if (c.tqStart) {
      const mins = Math.floor((Date.now() - c.tqStart) / 60000);
      if (mins > 45) alerts.push({ type: 'crit', msg: `🔴 TQ על ${c.name} מעל 45 דק' (${mins} דק')` });
      else if (mins > 30) alerts.push({ type: 'warn', msg: `⚠️ TQ על ${c.name} כבר ${mins} דק' - בדוק שחרור` });
    }
    // Check for vitals
    if (c.vitalsHistory && c.vitalsHistory.length > 1) {
       const v1 = c.vitalsHistory[c.vitalsHistory.length-1];
       const v2 = c.vitalsHistory[c.vitalsHistory.length-2];
       if (parseInt(v1.v.pulse) > parseInt(v2.v.pulse) + 20) alerts.push({ type: 'warn', msg: `📈 עליית דופק חדה אצל ${c.name}` });
    }
  });

  if (!alerts.length) {
    el.innerHTML = '<div style="font-size:11px; color:var(--muted); text-align:center; padding:10px">✅ אין התראות מבצעיות חדשות</div>';
    return;
  }

  el.innerHTML = alerts.map(a => `
    <div style="background:${a.type==='crit'?'rgba(200,40,40,0.1)':'rgba(200,150,0,0.05)'}; border:1px solid ${a.type==='crit'?'var(--red2)':'var(--amber)'}; padding:10px; border-radius:8px; font-size:12px; font-weight:700; color:var(--white)">
      ${a.msg}
    </div>
  `).join('');
}

// ═══ GANTT CHART (תחקיר) ════════════════════════════
function renderGantt() {
  const el = $('gantt-chart'); if (!el) return;
  if (!S.missionStart || !S.casualties.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;padding:12px">הפעל אר"ן עם פגועים לגרף Gantt</div>';
    return;
  }
  const now = Date.now();
  const dur = Math.max(600000, now - S.missionStart); // Min 10 min scale
  const W = el.offsetWidth || 340;
  const MARGIN_LEFT = 50; // Room for names
  const CHART_W = W - MARGIN_LEFT - 10;
  const scale = t => MARGIN_LEFT + Math.round(((t - S.missionStart) / dur) * CHART_W);
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const H_ROW = 28, PAD_TOP = 5;

  const svgH = sorted.length * H_ROW + 55; // More headroom for legend
  const stepMin = dur < 3600000 ? 10 : 30;
  const ticks = [];
  for (let m = 0; m * 60000 <= dur; m += stepMin) ticks.push(m);

  let svg = `<svg width="${W}" height="${svgH}" style="overflow:visible;display:block;font-family:inherit">`;

  // Time axis grid & labels
  ticks.forEach(m => {
    const x = scale(S.missionStart + m * 60000);
    svg += `<line x1="${x}" y1="${PAD_TOP}" x2="${x}" y2="${sorted.length * H_ROW + PAD_TOP}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${sorted.length * H_ROW + PAD_TOP + 16}" font-size="8" fill="var(--muted2)" text-anchor="middle">${m}′</text>`;
  });

  // Background bands & Names
  sorted.forEach((c, i) => {
    const y = i * H_ROW + PAD_TOP;
    const bg = c.priority === 'T1' ? 'rgba(200,40,40,.08)' : c.priority === 'T2' ? 'rgba(215,160,0,.06)' : 'rgba(80,140,80,.05)';
    svg += `<rect x="0" y="${y}" width="${W}" height="${H_ROW - 4}" fill="${bg}" rx="4"/>`;
    svg += `<text x="6" y="${y + 16}" font-size="10" fill="${c.priority==='T1'?'var(--red3)':c.priority==='T2'?'var(--amber3)':'var(--olive3)'}" font-weight="700" style="text-shadow:0 1px 2px rgba(0,0,0,.5)">${escHTML(c.name.split(' ')[0])}</text>`;
  });

  // Events on timeline
  sorted.forEach((c, i) => {
    const y = i * H_ROW + PAD_TOP;
    const centerY = y + (H_ROW - 4) / 2;

    // Added marker
    if (c._addedAt) {
      const x = scale(c._addedAt);
      svg += `<circle cx="${x}" cy="${centerY}" r="5" fill="${pClr(c.priority)}" stroke="#fff" stroke-width="1.5"/>`;
    }

    // TQ Duration highlight
    if (c.tqStart) {
      const xStart = scale(c.tqStart);
      const tqEnd = Math.min(now, c.tqStart + 120 * 60000);
      const xEnd = scale(tqEnd);
      const barW = Math.max(4, xEnd - xStart);
      const tqM = Math.floor((now - c.tqStart) / 60000);
      const barClr = tqM > 60 ? 'var(--red3)' : tqM > 45 ? 'var(--red2)' : 'var(--amber3)';
      svg += `<rect x="${xStart}" y="${centerY - 4}" width="${barW}" height="8" fill="${barClr}" opacity=".35" rx="2"/>`;
      svg += `<rect x="${xStart - 1.5}" y="${centerY - 7}" width="3" height="14" fill="${barClr}" rx="1"/>`;
    }

    // Treatments
    c.txList.forEach(tx => {
      if (!tx.ms) return;
      const x = scale(tx.ms);
      const isTXA = tx.type.toLowerCase().includes('txa');
      svg += `<circle cx="${x}" cy="${centerY}" r="3.5" fill="${isTXA ? 'var(--amber3)' : '#4a9eff'}" stroke="rgba(0,0,0,.4)" stroke-width="1"/>`;
    });
  });

  // Legend at bottom
  const legY = svgH - 12;
  const legItems = [
    { n: 'מגע', c: 'var(--olive3)', r: 5 },
    { n: 'TQ', c: 'var(--red3)', r: 4, type:'rect' },
    { n: 'TXA', c: 'var(--amber3)', r: 3.5 },
    { n: 'טיפול', c: '#4a9eff', r: 3.5 }
  ];
  let curX = 10;
  legItems.forEach(item => {
    if(item.type==='rect') svg += `<rect x="${curX}" y="${legY-6}" width="3" height="12" fill="${item.c}" rx="1"/>`;
    else svg += `<circle cx="${curX+4}" cy="${legY}" r="${item.r}" fill="${item.c}"/>`;
    svg += `<text x="${curX + 12}" y="${legY + 4}" font-size="9" fill="var(--muted2)" font-weight="700">${item.n}</text>`;
    curX += 45;
  });

  svg += `</svg>`;
  el.innerHTML = svg;
}
var mechSel = [];
var voiceRecog = null, voiceActive = false;
var reassessIntervals = {};
