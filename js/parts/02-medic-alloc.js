// ─────────────────────────────────────────────────
let guidedSteps = [], guidedIdx = 0, guidedCasId = null;

// ═══ APP MODE STATE ═══════════════════════════════
// prep → operational → post
var APP_MODE = 'prep'; // 'prep' | 'operational' | 'post'

function updateNavMode() {
  const nav0 = $('nav0'), nav1 = $('nav1'), nav2 = $('nav2');
  [nav0, nav1, nav2].forEach(b => { if (b) { b.style.pointerEvents = 'auto'; } });

  const topbar = $('topbar-normal');
  if (topbar) { topbar.classList.remove('topbar-active', 'topbar-post'); }

  // Keep tab icons readable in all modes.
  [nav0, nav1, nav2].forEach(b => { if (b) b.style.opacity = '1'; });
  if (APP_MODE === 'operational') {
    if (topbar) topbar.classList.add('topbar-active');
  } else if (APP_MODE === 'post') {
    if (topbar) topbar.classList.add('topbar-post');
  }
}

function navGuard(idx, screenId, cb) {
  // War Room is also useful in prep for planning and review.
  goScreen(screenId); setNav(idx);
  if (cb) cb();
  updateBadges();
}
const MEDIC_RANK = { 'רופא': 5, 'פראמדיק': 4, 'חובש': 3, 'מח"ר': 2, 'לורם': 1 };

function getMedicLevel(role) { return MEDIC_RANK[role] || 0; }

function getMedicRoster() {
  return (S.force || []).filter(f => f && getMedicLevel(f.role) > 0)
    .sort((a, b) => getMedicLevel(b?.role) - getMedicLevel(a?.role));
}

function getActiveCasForMedicAlloc() {
  return S.casualties.filter(c => {
    const st = c?.evacPipeline?.stage || '';
    return c.priority !== 'T4' && !c.evacuated && st !== 'hospital' && st !== 'done';
  });
}

function medicCapacity(m) {
  const lvl = getMedicLevel(m?.role);
  if (lvl >= 5) return 5;
  if (lvl >= 4) return 4;
  if (lvl >= 3) return 3;
  return 2;
}

function casLoadWeight(c) {
  return ({ T1: 3, T2: 2, T3: 1 }[c.priority] || 1);
}

function buildMedicLoadMap(casualties, medics) {
  const byMedic = {};
  medics.forEach(m => { byMedic[m.name] = 0; });
  casualties.forEach(c => {
    if (c.medic && byMedic[c.medic] !== undefined) byMedic[c.medic] += casLoadWeight(c);
  });
  return byMedic;
}

function autoBalanceMedicAllocation() {
  const medics = getMedicRoster();
  const casualties = [...getActiveCasForMedicAlloc()];
  if (!medics.length) { showToast('אין גורמי רפואה בכוח'); return; }
  if (!casualties.length) { showToast('אין פגועים פעילים לשיבוץ'); return; }

  const byMedic = {};
  medics.forEach(m => { byMedic[m.name] = 0; });

  casualties.sort((a, b) => {
    const pa = ({ T1: 100, T2: 60, T3: 20 }[a.priority] || 0) + (a.tqStart ? 8 : 0);
    const pb = ({ T1: 100, T2: 60, T3: 20 }[b.priority] || 0) + (b.tqStart ? 8 : 0);
    return pb - pa;
  });

  casualties.forEach(c => {
    const ranked = [...medics].sort((m1, m2) => {
      const r1 = byMedic[m1.name] / Math.max(1, medicCapacity(m1));
      const r2 = byMedic[m2.name] / Math.max(1, medicCapacity(m2));
      if (r1 !== r2) return r1 - r2;
      return getMedicLevel(m2.role) - getMedicLevel(m1.role);
    });
    const best = ranked[0];
    c.medic = best.name;
    byMedic[best.name] += casLoadWeight(c);
  });

  saveState();
  renderWarRoom();
  renderMedAlloc();
  openMedicAllocView();
  showToast(`⚡ איזון אוטומטי הושלם (${casualties.length} פצועים)`);
}

function renderMedAlloc() {
  const el = $('med-alloc'); if (!el) return;
  const medics = getMedicRoster();
  const casualties = [...getActiveCasForMedicAlloc()].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const loadMap = buildMedicLoadMap(casualties, medics);

  if (!medics.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--red3);padding:8px 0;font-weight:700">⚠️ אין גורמי רפואה בכוח!</div>';
    return;
  }
  if (!casualties.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px 0">אין פגועים פעילים</div>';
    return;
  }

  // Assign: highest medic → most critical casualty, round-robin for extras
  const assignments = [];
  casualties.forEach((c, i) => {
    const medic = medics[i % medics.length];
    const isBest = i < medics.length;
    assignments.push({ cas: c, medic, isBest });
  });

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      ${assignments.map(({ cas, medic, isBest }) => `
        <div style="background:var(--s2);border:1px solid ${cas.priority === 'T1' ? 'var(--red2)' : cas.priority === 'T2' ? 'var(--amber)' : 'var(--b0)'};border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px">
          <span class="prio pt${cas.priority[1]}" style="font-size:10px;flex-shrink:0">${cas.priority}</span>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:700">${escHTML(cas.name)}</div>
            <div style="font-size:9px;color:var(--muted)">${cas.mech.join('/')}</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:11px;font-weight:700;color:${isBest ? 'var(--green3)' : 'var(--olive3)'}">${escHTML(medic.name)}</div>
            <div style="font-size:8px;color:var(--olive3)">${medic.role} · ${loadMap[medic.name] || 0}/${medicCapacity(medic)}</div>
          </div>
          <button class="btn btn-xs btn-ghost" onclick="quickReassignMedic(${cas.id})">↔</button>
          <button class="btn btn-xs btn-olive" onclick="assignMedic(${cas.id},'${escHTML(medic.name)}')">✓</button>
        </div>`).join('')}
      ${medics.length > casualties.length ? `
        <div style="font-size:10px;color:var(--olive3);padding:4px 0">
          ✓ ${medics.slice(casualties.length).map(m => `${escHTML(m.name)} (${m.role})`).join(', ')} — זמינים
        </div>`: ''}
    </div>`;
}

function assignMedic(casId, medicName) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  c.medic = medicName;
  addTL(casId, c.name, `🩺 שובץ: ${medicName}`, 'olive');
  renderWarRoom();
  renderMedAlloc();
  saveState();
  if (_drawerCasId == casId) renderDrawer(casId);
  showToast(`✓ ${medicName} → ${c.name}`);
}
