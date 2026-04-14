// ═══════════════════════════════════════════════════
// BATCH 3: EVAC PIPELINE TRACKER
// ═══════════════════════════════════════════════════
const EVAC_STAGES = ['injury', 'collection', 'pickup', 'transit', 'hospital'];
const EVAC_STAGE_LABELS = { injury: '📍 Injury', collection: '🏕 Collection', pickup: '🚁 Pickup', transit: '🚑 Transit', hospital: '🏥 Hospital' };

function openEvacPipeline(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  if (!c.evacPipeline) c.evacPipeline = { stage: 'injury', times: {} };
  const p = c.evacPipeline;
  openModal('🚁 Evac Pipeline — ' + c.name, `
    <div class="pad col" style="gap:6px">
      ${EVAC_STAGES.map(s => {
    const done = p.times[s];
    const isCurrent = p.stage === s;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;background:${isCurrent ? 'var(--olive)' : done ? 'var(--s3)' : 'var(--s2)'};border:1px solid ${isCurrent ? 'var(--olive3)' : 'var(--b0)'}">
          <span style="font-size:16px">${EVAC_STAGE_LABELS[s].split(' ')[0]}</span>
          <span style="flex:1;font-size:12px;font-weight:${isCurrent ? '900' : '400'};color:${isCurrent ? '#fff' : done ? 'var(--muted2)' : 'var(--muted)'}">${EVAC_STAGE_LABELS[s].split(' ')[1]}</span>
          ${done ? `<span style="font-size:10px;color:var(--olive3)">${done}</span>` : ''}
          ${isCurrent ? `<button class="btn btn-xs btn-olive" onclick="markEvacStage(${casId},'${s}')">✓ Done</button>` : ''}
        </div>`;
  }).join('')}
    </div>`);
}
function markEvacStage(casId, stage) {
  const c = S.casualties.find(x => x.id == casId); if (!c || !c.evacPipeline) return;
  c.evacPipeline.times[stage] = nowTime();
  const idx = EVAC_STAGES.indexOf(stage);
  if (idx < EVAC_STAGES.length - 1) c.evacPipeline.stage = EVAC_STAGES[idx + 1];
  else c.evacPipeline.stage = 'done';
  addTL(casId, c.name, `Evac: ${EVAC_STAGE_LABELS[stage]} ✓`, 'green');
  closeModal(); saveState(); renderWarRoom();
}

// ═══════════════════════════════════════════════════
// BATCH 3: DIGITAL REFERENCE LIBRARY
// ═══════════════════════════════════════════════════
const REF_LIBRARY = [
  {
    cat: '🏥 Hospitals', items: [
      { title: 'Rambam', detail: '04-7772111', sub: 'Haifa — Trauma Level 1' },
      { title: 'Soroka', detail: '08-6400111', sub: 'Beer Sheva — Trauma Level 1' },
      { title: 'Hadassah Ein-Kerem', detail: '02-6777111', sub: 'Jerusalem — Trauma Level 1' },
      { title: 'Sheba (Tel Hashomer)', detail: '03-5302222', sub: 'Ramat Gan — Trauma Level 1' },
      { title: 'Ichilov', detail: '03-6974444', sub: 'Tel Aviv — Trauma Level 1' },
      { title: 'Ziv', detail: '04-6828811', sub: 'Tzfat' },
      { title: 'Galil Medical', detail: '04-9107107', sub: 'Nahariya' },
      { title: 'Beilinson', detail: '03-9377377', sub: 'Petach Tikva' },
    ]
  },
  {
    cat: '📻 Flight Frequencies', items: [
      { title: 'IAF Rescue', detail: '243.0 MHz', sub: 'Emergency' },
      { title: 'Helo Common', detail: '121.5 MHz', sub: 'Civilian Emergency' },
      { title: 'Ground-Air', detail: '123.1 MHz', sub: 'CAS Coordination' },
    ]
  },
  {
    cat: '📋 SOPs', items: [
      { title: 'TCCC Guidelines', detail: 'Tactical Combat Casualty Care', sub: 'Latest revision' },
      { title: '9-Line MEDEVAC', detail: 'Standard request format', sub: 'NATO STANAG 3204' },
      { title: 'MIST Report', detail: 'Mechanism, Injuries, Signs, Treatment', sub: 'Handoff protocol' },
      { title: 'MARCH Algorithm', detail: 'Massive hemorrhage → Airway → Resp → Circ → Hypothermia', sub: 'Primary assessment' },
      { title: 'TQ Protocol', detail: 'Apply high & tight, note time, max 2h field', sub: 'Tourniquet SOP' },
    ]
  },
];

function openReferenceLibrary() {
  const overlay = $('ref-library-overlay');
  if (!overlay) return;
  overlay.classList.add('on');
  renderReferenceLibrary();
}
function closeReferenceLibrary() {
  const overlay = $('ref-library-overlay');
  if (overlay) overlay.classList.remove('on');
}
function renderReferenceLibrary(filterText) {
  const body = $('ref-library-body'); if (!body) return;
  const q = (filterText || '').toLowerCase();
  body.innerHTML = REF_LIBRARY.map(cat => {
    const fitems = q ? cat.items.filter(it => it.title.toLowerCase().includes(q) || it.detail.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)) : cat.items;
    if (!fitems.length) return '';
    return `<div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:900;color:var(--olive3);padding:6px 0">${cat.cat}</div>
      ${fitems.map(it => `
        <div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;margin-bottom:4px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;font-weight:700">${it.title}</span>
            <span style="font-size:12px;font-weight:900;color:var(--amber2);direction:ltr">${it.detail}</span>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${it.sub}</div>
        </div>`).join('')}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// BATCH 3: MEDIC ALLOCATION VIEW
// ═══════════════════════════════════════════════════
function renderMedicAISection(active, medics, loadMap) {
  const unassigned = active.filter(c => !c.medic);
  const unassignedT1 = unassigned.filter(c => c.priority === 'T1');
  const overloaded = medics.filter(m => (loadMap[m.name] || 0) >= medicCapacity(m));

  let nextAction = '✅ חלוקת המטפלים נראית יציבה';
  let nextSub = 'אין פעולה דחופה כרגע';

  if (unassignedT1.length) {
    nextAction = `🩺 שייך מטפל מיידית ל-${unassignedT1[0].name}`;
    nextSub = 'T1 ללא מטפל — עדיפות עליונה';
  } else if (unassigned.length) {
    nextAction = '⚡ הפעל Auto Balance';
    nextSub = `יש ${unassigned.length} פצועים ללא מטפל`;
  } else if (overloaded.length) {
    nextAction = '↔ בצע Reassign ממטפל בעומס';
    nextSub = `${overloaded.length} מטפלים בעומס מלא`;
  }

  const topCas = [...active]
    .sort((a, b) => prioN(a.priority) - prioN(b.priority))
    .slice(0, 3)
    .map(c => `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(40,72,136,.22)">
      <span class="prio pt${c.priority[1]}" style="font-size:9px;padding:1px 5px">${c.priority}</span>
      <span style="font-size:11px;font-weight:700;flex:1">${escHTML(c.name)}</span>
      <span style="font-size:10px;color:${c.medic ? 'var(--olive3)' : 'var(--red3)'}">${escHTML(c.medic || 'ללא מטפל')}</span>
    </div>`)
    .join('');

  const aiContent = `<div style="margin-top:10px;border:1px solid var(--blue2);border-radius:10px;background:var(--glass-bg-surface);padding:10px 10px 8px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:15px">🤖</span>
      <span style="font-size:11px;font-weight:900;color:var(--olive3);letter-spacing:.08em">AI ADVISOR</span>
      <span style="margin-right:auto;font-size:9px;color:var(--muted)">MEDIC</span>
    </div>
    <div style="font-size:11px;color:var(--muted2);line-height:1.45;margin-bottom:6px">${nextSub}</div>
    <div style="background:var(--glass-bg);border:1px solid var(--olive3);border-radius:8px;padding:8px 10px;margin-bottom:8px">
      <div style="font-size:9px;color:var(--olive3);font-weight:700;letter-spacing:.1em">NEXT BEST ACTION</div>
      <div style="font-size:14px;font-weight:900;color:var(--white);margin-top:2px">${nextAction}</div>
    </div>
    ${topCas ? `<div style="font-size:9px;color:var(--olive3);letter-spacing:.08em;margin-bottom:4px">פצועים בעדיפות עליונה</div>${topCas}` : ''}
  </div>`;

  return `<div style="margin-top:10px">
    <button class="btn btn-xs btn-ghost" style="width:100%;text-align:right;justify-content:space-between;display:flex;gap:8px;padding:8px;border:1px solid var(--b0);border-radius:8px;background:var(--s2);color:var(--olive3);font-weight:700" onclick="toggleMedicAISection(this)">
      <span>🤖 AI ADVISOR</span>
      <span style="font-size:10px;color:var(--muted2)">MEDIC</span>
      <span class="ai-toggle-arrow">⯈</span>
    </button>
    <div class="medic-ai-content" style="display:none;margin-top:8px">${aiContent}</div>
  </div>`;
}

function toggleMedicAISection(btn) {
  const content = btn.parentElement.querySelector('.medic-ai-content');
  if (!content) return;
  const arrow = btn.querySelector('.ai-toggle-arrow');
  const isOpen = content.style.display !== 'none';
  content.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '⯈' : '⯆';
}

function openMedicAllocView() {
  const medics = getMedicRoster();
  const active = getActiveCasForMedicAlloc();
  const unassigned = active.filter(c => !c.medic);
  const loadMap = buildMedicLoadMap(active, medics);
  openModal('👨‍⚕️ Medic Allocation', `
    <div class="pad col" style="gap:8px">
      <div style="display:flex;gap:6px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div style="font-size:11px;color:var(--muted)">${medics.length} medics · ${active.length} active · ${unassigned.length} unassigned</div>
        <button class="btn btn-xs btn-olive" onclick="autoBalanceMedicAllocation()">⚡ Auto Balance</button>
      </div>
      ${medics.length ? medics.map(m => {
    const assigned = active.filter(c => c.medic === m.name);
    const load = loadMap[m.name] || 0;
    const cap = medicCapacity(m);
    const pct = Math.min(100, Math.round((load / Math.max(1, cap)) * 100));
    const clr = pct >= 100 ? 'var(--red3)' : pct >= 70 ? 'var(--amber3)' : 'var(--olive3)';
    return `<div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">
            <div style="font-size:12px;font-weight:700">🩺 ${escHTML(m.name)} <span style="font-size:10px;color:var(--olive3)">${m.role}</span></div>
            <div style="font-size:10px;font-weight:700;color:${clr}">Load ${load}/${cap}</div>
          </div>
          <div style="height:6px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:6px">
            <div style="height:100%;width:${pct}%;background:${clr}"></div>
          </div>
          ${assigned.length ? assigned.map(c => `<div style="font-size:11px;padding:2px 0;color:var(--muted2);display:flex;align-items:center;gap:6px"><span class="prio pt${c.priority[1]}" style="font-size:9px;padding:1px 4px">${c.priority}</span><span style="flex:1">${escHTML(c.name)}</span><button class="btn btn-xs btn-ghost" onclick="quickReassignMedic(${c.id})">↔</button><button class="btn btn-xs btn-ghost" style="color:var(--danger)" onclick="unassignMedic(${c.id})">✕</button></div>`).join('') : '<div style="font-size:10px;color:var(--muted)">No casualties assigned</div>'}
        </div>`;
  }).join('') : '<div style="color:var(--muted);text-align:center;padding:20px">No medics in force roster</div>'}
      ${unassigned.length ? `<div style="margin-top:8px;padding:8px;background:var(--crit-bg);border:1px solid var(--red2);border-radius:6px">
        <div style="font-size:11px;font-weight:700;color:var(--red3);margin-bottom:4px">⚠ Unassigned</div>
        ${unassigned.map(c => `<div style="font-size:11px;padding:2px 0"><span class="prio pt${c.priority[1]}" style="font-size:9px;padding:1px 4px">${c.priority}</span> ${escHTML(c.name)}</div>`).join('')}
      </div>`: ''}
      ${renderMedicAISection(active, medics, loadMap)}
    </div>`);
}
