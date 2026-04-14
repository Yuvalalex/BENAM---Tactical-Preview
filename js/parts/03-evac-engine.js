// ═══ EVACUATION PRIORITY ENGINE ════════════════════
function calcEvacScore(c) {
  return calcEvacScoreDetailed(c).score;
}

function getEvacStage(c) {
  if (c?.evacPipeline?.stage) return c.evacPipeline.stage;
  // Legacy saved states may have only `evacuated` without pipeline stage.
  // Treat them as hospital stage so they can still be managed in queue.
  return c?.evacuated ? 'hospital' : 'injury';
}

function getEvacCandidates() {
  const base = (S.casualties || []).filter(c => c.priority !== 'T4');
  const strict = base.filter(c => getEvacStage(c) !== 'done');
  return { base, strict };
}

function getEvacStageLabel(stage) {
  return ({
    injury: 'פציעה',
    collection: 'איסוף',
    pickup: 'העמסה',
    transit: 'בדרך',
    hospital: 'בבית חולים',
    done: 'פונה'
  }[stage] || 'פציעה');
}

function getEvacStageColor(stage) {
  return ({
    injury: 'var(--red3)',
    collection: 'var(--amber3)',
    pickup: 'var(--olive3)',
    transit: 'var(--olive3)',
    hospital: 'var(--green3)',
    done: 'var(--green3)'
  }[stage] || 'var(--muted2)');
}

function calcEvacScoreDetailed(c) {
  let score = 0;
  const reasons = [];
  const p = { 'T1': 100, 'T2': 60, 'T3': 20, 'T4': 0 }[c.priority] || 0;
  score += p;
  if (c.priority === 'T1') reasons.push('T1 קריטי');

  if (c.tqStart) {
    const m = Math.floor((Date.now() - c.tqStart) / 60000);
    if (m > 30) { score += 40; reasons.push(`TQ ${m}′`); }
    else if (m > 15) { score += 20; reasons.push(`TQ ${m}′`); }
  }

  const gcs = parseInt(c.vitals?.gcs) || 15;
  if (gcs <= 8) { score += 30; reasons.push('GCS נמוך'); }
  else if (gcs <= 12) { score += 15; reasons.push('GCS גבולי'); }

  const spo2 = parseInt(c.vitals?.spo2) || 98;
  if (spo2 < 90) { score += 25; reasons.push('SpO2 נמוך'); }
  else if (spo2 < 94) { score += 10; reasons.push('SpO2 90-93'); }

  const pulse = parseInt(c.vitals?.pulse) || 72;
  if (pulse > 120 || pulse < 50) { score += 20; reasons.push('דופק חריג'); }

  if (!(c.txList || []).length) { score += 15; reasons.push('ללא טיפול'); }
  if (!c.medic) { score += 10; reasons.push('ללא מטפל'); }
  if (!c.evacType) { score += 8; reasons.push('סוג פינוי לא הוגדר'); }

  const stage = getEvacStage(c);
  const stageBoost = { injury: 12, collection: 8, pickup: 4, transit: 2, hospital: -20, done: -40 }[stage] || 0;
  score += stageBoost;

  // Simple deterioration detector from last two vitals snapshots.
  const vh = c.vitalsHistory || [];
  if (vh.length >= 2) {
    const a = vh[vh.length - 2] || {};
    const b = vh[vh.length - 1] || {};
    const pa = parseInt(a.pulse), pb = parseInt(b.pulse), sa = parseInt(a.spo2), sb = parseInt(b.spo2);
    const pulseJump = !isNaN(pa) && !isNaN(pb) && (pb - pa >= 20);
    const spo2Drop = !isNaN(sa) && !isNaN(sb) && (sa - sb >= 4);
    if (pulseJump || spo2Drop) {
      score += 12;
      reasons.push('מגמת הידרדרות');
    }
  }

  score = Math.max(0, Math.min(220, score));
  return { score, reasons, stage };
}

function ensureEvacPipeline(c) {
  if (!c.evacPipeline) c.evacPipeline = { stage: 'injury', times: { injury: nowTime() } };
}

function advanceEvacStage(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  ensureEvacPipeline(c);
  const flow = ['injury', 'collection', 'pickup', 'transit', 'hospital', 'done'];
  const cur = getEvacStage(c);
  const idx = flow.indexOf(cur);
  if (idx === -1 || idx === flow.length - 1) { showToast('הפינוי כבר הושלם'); return; }
  const next = flow[idx + 1];
  c.evacPipeline.stage = next;
  c.evacPipeline.times[next] = nowTime();
  c.evacuated = (next === 'hospital' || next === 'done');
  addTL(casId, c.name, `🚁 פינוי: ${getEvacStageLabel(next)}`, 'blue');
  saveState();
  renderWarRoom();
  renderEvacPriority();
  if ($('evac-modal')?.style.display === 'block') renderEvacSlots();
  showToast(`🚁 ${c.name} → ${getEvacStageLabel(next)}`);
}

function renderEvacPriority() {
  const el = $('evac-priority-list'); if (!el) return;
  const active = S.casualties.filter(c => c.priority !== 'T4' && getEvacStage(c) !== 'done');
  if (!active.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:8px 0">אין פגועים פעילים</div>';
    return;
  }
  const ranked = [...active].sort((a, b) => calcEvacScoreDetailed(b).score - calcEvacScoreDetailed(a).score);
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:5px">
      ${ranked.map((c, i) => {
    const d = calcEvacScoreDetailed(c);
    const sc = d.score;
    const reasons = d.reasons;
    const stageLbl = getEvacStageLabel(d.stage);
    const stageClr = getEvacStageColor(d.stage);
    return `<div style="background:var(--s2);border:1px solid ${i === 0 ? 'var(--red2)' : i === 1 ? 'var(--amber)' : 'var(--b0)'};border-radius:8px;padding:8px 10px;display:flex;align-items:center;gap:8px">
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${i === 0 ? 'var(--red3)' : i === 1 ? 'var(--amber3)' : 'var(--muted2)'};min-width:22px">${i + 1}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${escHTML(c.name)}
              <span style="font-size:9px;padding:1px 6px;border-radius:10px;background:rgba(255,255,255,.04);color:${stageClr};border:1px solid var(--b0)">${stageLbl}</span>
            </div>
            <div style="font-size:9px;color:var(--muted2);margin-top:2px">${(reasons.slice(0, 4).join(' · ') || c.priority)}</div>
            <div style="display:flex;gap:4px;margin-top:5px">
              <button class="btn btn-xs btn-ghost" style="font-size:9px;min-height:20px" onclick="advanceEvacStage(${c.id})">שלב ▶</button>
              <button class="btn btn-xs btn-ghost" style="font-size:9px;min-height:20px" onclick="openEvacPipeline(${c.id})">Pipeline</button>
            </div>
          </div>
          <span class="prio pt${c.priority[1]}" style="font-size:10px">${c.priority}</span>
          <div style="font-family:var(--font-mono);font-size:11px;color:var(--olive3)">${sc}pt</div>
        </div>`;
  }).join('')}
    </div>`;
}
