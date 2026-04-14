// ═══════════════════════════════════════════════════
// 📈 DETERIORATION AI
// ═══════════════════════════════════════════════════
function getDeteriorationTrend(c) {
  const h = c.vitalsHistory;
  if (!h || h.length < 2) return { level: 'none', pulseDir: '', spo2Dir: '', gcsDir: '' };
  const last = h[h.length - 1], prev = h[h.length - 2];
  const pulseDelta = (last.pulse || 0) - (prev.pulse || 0);
  const spo2Delta = (last.spo2 || 0) - (prev.spo2 || 0);
  const gcsDelta = (last.gcs || 0) - (prev.gcs || 0);

  const pulseDir = pulseDelta > 8 ? 'up' : pulseDelta < -8 ? 'dn' : '';
  const spo2Dir = spo2Delta < -2 ? 'dn' : spo2Delta > 2 ? 'up' : '';
  const gcsDir = gcsDelta < -1 ? 'dn' : gcsDelta > 1 ? 'up' : '';

  let severity = 0;
  if (pulseDir === 'up' && (last.pulse || 0) > 110) severity++;
  if (pulseDir === 'dn' && (last.pulse || 0) < 50) severity += 2;
  if (spo2Dir === 'dn') severity += (last.spo2 || 99) < 90 ? 3 : 1;
  if (gcsDir === 'dn') severity += (last.gcs || 15) < 10 ? 2 : 1;
  // Check 3-point trend (all going wrong)
  if (h.length >= 3) {
    const p2 = h[h.length - 3];
    if ((last.spo2 || 99) < (prev.spo2 || 99) && (prev.spo2 || 99) < (p2.spo2 || 99)) severity += 2;
    if ((last.pulse || 0) > (prev.pulse || 0) && (prev.pulse || 0) > (p2.pulse || 0) && (last.pulse || 0) > 100) severity++;
  }
  const level = severity >= 4 ? 'severe' : severity >= 2 ? 'mild' : 'none';
  return { level, pulseDir, spo2Dir, gcsDir, severity, lastVitals: last };
}

function checkDeteriorationAI() {
  const banner = $('deteri-banners'); if (!banner) return;
  const critical = S.casualties.filter(c => {
    const t = getDeteriorationTrend(c);
    return t.level === 'severe' && c.priority !== 'T4';
  });
  if (!critical.length) { banner.innerHTML = ''; return; }
  banner.innerHTML = critical.map(c => {
    const t = getDeteriorationTrend(c);
    const issues = [];
    if (t.spo2Dir === 'dn') issues.push(`SpO2 ${t.lastVitals?.spo2 || '?'}% ↓`);
    if (t.pulseDir === 'up' && (t.lastVitals?.pulse || 0) > 110) issues.push(`דופק ${t.lastVitals?.pulse || '?'} ↑`);
    if (t.pulseDir === 'dn' && (t.lastVitals?.pulse || 0) < 50) issues.push(`דופק ${t.lastVitals?.pulse || '?'} ↓⚠`);
    if (t.gcsDir === 'dn') issues.push(`GCS ${t.lastVitals?.gcs || '?'} ↓`);
    return `<div class="deteri-banner" onclick="jumpToCas(${c.id})">
      <div class="deteri-title">📉 DETERIORATION ALERT</div>
      <div class="deteri-name">${escHTML(c.name)} — ${c.priority}</div>
      <div class="deteri-detail">${issues.join(' · ')} → לחץ לטיפול מיידי</div>
    </div>`;
  }).join('');
  // Auto-escalate if severe
  critical.forEach(c => {
    if (c.priority === 'T2' && !c.escalated) {
      c.priority = 'T1'; c.escalated = true;
      addTL(c.id, c.name, '📉 הוחמר → T1 (Deterioration AI)', 'red');
      if (navigator.vibrate) navigator.vibrate([300, 100, 300]);
    }
  });
}

// Enhanced vitals snapshot triggers deterioration check
function snapshotVitals(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const snap = {
    t: nowTime(), ms: Date.now(),
    pulse: parseInt(c.vitals.pulse) || 0,
    spo2: parseInt(c.vitals.spo2) || 0,
    gcs: parseInt(c.vitals.gcs) || 15,
    bp: c.vitals.bp || ''
  };
  c.vitalsHistory = c.vitalsHistory || [];
  c.vitalsHistory.push(snap);
  if (c.vitalsHistory.length > MEDICAL.MAX_VITALS_HISTORY) c.vitalsHistory.shift();
  addTL(casId, c.name, `📸 Snapshot: P${snap.pulse} S${snap.spo2}% G${snap.gcs}`, 'olive');
  saveMesh(casId, 'vitals', snap);
  checkDeteriorationAI();
  drawVitalsGraph(casId);
  showToast(`📸 Snapshot — ${c.name}`);
}

// ═══════════════════════════════════════════════════
// 🗺️ TACTICAL MAP
// ═══════════════════════════════════════════════════
let _tmapPositions = {};    // casId → {x,y}
let _tmapLZs = [];           // [{x,y,label}]
let _tmapGridOn = true;
let _tmapDragging = null;

function openTacticalMap() {
  $('tmap-overlay').classList.add('on');
  $('tmap-title').textContent = `${S.comms.unit || 'אירוע'} — ${S.casualties.length} פגועים`;
  tmapAutoLayout();
  renderTmap();
}

function tmapAutoLayout() {
  // Place casualties in priority zones
  const zones = { T1: { x: 200, y: 150, spread: 70 }, T2: { x: 200, y: 290, spread: 80 }, T3: { x: 200, y: 400, spread: 90 }, T4: { x: 200, y: 460, spread: 60 } };
  const counts = { T1: 0, T2: 0, T3: 0, T4: 0 };
  S.casualties.forEach(c => {
    if (_tmapPositions[c.id]) return; // keep manual positions
    const z = zones[c.priority] || zones.T3;
    const idx = counts[c.priority] || 0;
    const angle = (idx * 137.5) * (Math.PI / 180); // golden angle spread
    const r = Math.min(z.spread, 20 + idx * 18);
    _tmapPositions[c.id] = {
      x: Math.max(20, Math.min(380, z.x + Math.cos(angle) * r)),
      y: Math.max(20, Math.min(480, z.y + Math.sin(angle) * r))
    };
    counts[c.priority] = (counts[c.priority] || 0) + 1;
  });
  // Default LZ
  if (!_tmapLZs.length) _tmapLZs = [{ x: 80, y: 60, label: 'LZ1' }, { x: 320, y: 60, label: 'LZ2' }];
}

function renderTmap() {
  const svg = $('tmap-svg'); if (!svg) return;
  const casLayer = $('tmap-cas-layer');
  const lzLayer = $('tmap-lz-layer');
  const pathLayer = $('tmap-path-layer');
  if (!casLayer) return;

  const pColors = { T1: '#c82828', T2: '#c89010', T3: '#28822a', T4: '#333' };
  const pR = { T1: 14, T2: 11, T3: 9, T4: 7 };

  // Evac paths from T1s to nearest LZ
  pathLayer.innerHTML = S.casualties.filter(c => c.priority === 'T1' && _tmapPositions[c.id]).map(c => {
    const pos = _tmapPositions[c.id];
    const lz = _tmapLZs.reduce((best, l) => {
      const d = Math.hypot(l.x - pos.x, l.y - pos.y);
      return !best || d < best.d ? { ...l, d } : best;
    }, null);
    if (!lz) return '';
    return `<line x1="${pos.x}" y1="${pos.y}" x2="${lz.x}" y2="${lz.y}" stroke="#c82828" stroke-width="1" stroke-dasharray="6,4" opacity=".5"/>`;
  }).join('');

  // LZ markers
  lzLayer.innerHTML = _tmapLZs.map((lz, i) => `
    <g class="tmap-lz" style="cursor:pointer">
      <rect x="${lz.x - 16}" y="${lz.y - 10}" width="32" height="20" rx="4" fill="#186018" stroke="#42c042" stroke-width="1.5"/>
      <text x="${lz.x}" y="${lz.y + 4}" text-anchor="middle" fill="#42c042" font-size="9" font-weight="700">${lz.label}</text>
    </g>`).join('');

  // Casualty markers
  casLayer.innerHTML = S.casualties.map(c => {
    const pos = _tmapPositions[c.id] || { x: 200, y: 250 };
    const r = pR[c.priority] || 9;
    const col = pColors[c.priority] || '#555';
    const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
    const tqRing = tqM !== null && tqM > 30 ? `<circle cx="${pos.x}" cy="${pos.y}" r="${r + 4}" fill="none" stroke="${tqM > 45 ? '#f04848' : '#e8b020'}" stroke-width="2" opacity=".8" stroke-dasharray="4,2"/>` : '';
    const trend = getDeteriorationTrend(c);
    const trendMark = trend.level === 'severe' ? `<text x="${pos.x + r}" y="${pos.y - r}" fill="#f04848" font-size="9">📉</text>` : '';
    const shortName = c.name.split(' ')[0];
    return `<g class="tmap-cas" onclick="jumpToCas(${c.id})" style="cursor:pointer">
      ${tqRing}
      <circle cx="${pos.x}" cy="${pos.y}" r="${r}" fill="${col}" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>
      <text x="${pos.x}" y="${pos.y + 1}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="${r > 10 ? '8' : '7'}" font-weight="700">${c.priority}</text>
      <text x="${pos.x}" y="${pos.y + r + 9}" text-anchor="middle" fill="${col}" font-size="8">${shortName}</text>
      ${tqM !== null ? `<text x="${pos.x}" y="${pos.y + r + 17}" text-anchor="middle" fill="${tqM > 45 ? '#f04848' : '#e8b020'}" font-size="7">${tqM}′</text>` : ''}
      ${trendMark}
    </g>`;
  }).join('');

  // Drag to reposition
  svg.onmousedown = svg.ontouchstart = (e) => {
    const pt = tmapSVGPoint(svg, e);
    // Find closest casualty
    let closest = null, minD = 25;
    S.casualties.forEach(c => {
      const pos = _tmapPositions[c.id]; if (!pos) return;
      const d = Math.hypot(pt.x - pos.x, pt.y - pos.y);
      if (d < minD) { minD = d; closest = c; }
    });
    if (closest) _tmapDragging = closest.id;
  };
  svg.onmousemove = svg.ontouchmove = (e) => {
    if (!_tmapDragging) return;
    e.preventDefault();
    const pt = tmapSVGPoint(svg, e);
    _tmapPositions[_tmapDragging] = { x: Math.max(15, Math.min(385, pt.x)), y: Math.max(15, Math.min(485, pt.y)) };
    renderTmap();
  };
  svg.onmouseup = svg.ontouchend = () => { _tmapDragging = null; };
}

function tmapSVGPoint(svg, e) {
  const rect = svg.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  const scaleX = 400 / rect.width, scaleY = 500 / rect.height;
  return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
}

function tmapAddLZ() {
  const lbl = prompt('שם LZ (למשל LZ3):', 'LZ' + (_tmapLZs.length + 1));
  if (!lbl) return;
  _tmapLZs.push({ x: 200, y: 100, label: lbl });
  renderTmap();
}
function tmapClearOverride() { _tmapPositions = {}; tmapAutoLayout(); renderTmap(); }
function tmapToggleGrid() {
  _tmapGridOn = !_tmapGridOn;
  const g = $('tmap-grid'); if (g) g.style.display = _tmapGridOn ? '' : 'none';
}

// Auto-refresh map while open
setInterval(() => {
  try { if (!document.hidden && $('tmap-overlay')?.classList.contains('on')) renderTmap(); } catch (_) {}
}, 5000);
