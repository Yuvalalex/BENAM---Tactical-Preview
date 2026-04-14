// ═══════════════════════════════════════════════════
// CASUALTY DRAWER — replaces full-screen sc-cas
// ═══════════════════════════════════════════════════
let _drawerCasId = null;
let _fireSheetOpen = false;
let _renderDrawerRAF = null; // coalesce multiple renderDrawer calls into one frame

function _getCasualtyService() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService
    ? window.BENAM_LEGACY.casualtyService
    : null;
}

function _getDrawerSections() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.drawerSections
    ? window.BENAM_LEGACY.drawerSections
    : null;
}

function _getBodyMapSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.bodyMapSection
    ? window.BENAM_LEGACY.bodyMapSection
    : null;
}

function evaluateTreatmentState(c) {
  const txTypes = (c.txList || []).map(t => String(t.type || '').toLowerCase());
  const flags = {
    tq: txTypes.some(t => t.includes('tq')) || (c.treatmentFlags && c.treatmentFlags.tq),
    txa: txTypes.some(t => t.includes('txa')) || (c.treatmentFlags && c.treatmentFlags.txa),
    chest: txTypes.some(t => t.includes('chest')) || (c.treatmentFlags && c.treatmentFlags.chest),
    bleed: txTypes.some(t => t.includes('bleed') || t.includes('tourniquet')) || (c.treatmentFlags && c.treatmentFlags.bleed),
    npa: txTypes.some(t => t.includes('npa') || t.includes('נתיב אוויר')) || (c.treatmentFlags && c.treatmentFlags.npa),
  };
  c.treatmentFlags = Object.assign({}, c.treatmentFlags || {}, flags);
  const needed = [];
  if (!flags.tq) needed.push('TQ');
  if (!flags.txa) needed.push('TXA');
  if (!flags.chest) needed.push('Chest');
  if (!flags.bleed) needed.push('Bleed');
  if (!flags.npa) needed.push('NPA');
  c.autoTreatmentPriority = needed.length ? needed[0] : 'Complete';
  return { flags, needed };
}

function _getMarchProtocolSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.marchProtocolSection
    ? window.BENAM_LEGACY.marchProtocolSection
    : null;
}

function jumpToCas(id) {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  _drawerCasId = id;
  if (drawerModule && drawerModule.openCasualtyDrawer) return drawerModule.openCasualtyDrawer(id, () => { renderDrawer(id); if (typeof updateTopStats === 'function') updateTopStats(); });
  renderDrawer(id);
  $('cas-drawer').classList.add('open');
  $('drawer-overlay').classList.add('show');
  if (typeof updateTopStats === 'function') updateTopStats();
  // Show FAB
  const fab = $('wr-fab');
  if (fab) { fab.classList.add('active'); }
}

function closeDrawer() {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.closeCasualtyDrawer) {
    drawerModule.closeCasualtyDrawer(closeFireSheet);
    _drawerCasId = null;
    return;
  }
  $('cas-drawer').classList.remove('open');
  $('drawer-overlay').classList.remove('show');
  closeFireSheet();
  const fab = $('wr-fab');
  if (fab) { fab.classList.remove('open'); /* keep active — FAB stays visible on war room */ }
  _drawerCasId = null;
}

function _setCasualtyTab(caseId, tabName) {
  const container = document.getElementById(`tab-content-${caseId}`);
  if (!container) return;
  container.querySelectorAll('[data-tab]').forEach((el) => {
    el.style.display = el.getAttribute('data-tab') === tabName ? 'block' : 'none';
  });
  ['actions','meds','status'].forEach((name) => {
    const btn = document.getElementById(`tab-btn-${name}`);
    if (btn) btn.classList.toggle('btn-olive', name === tabName);
  });
}

function drawerNav(dir) {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.getAdjacentCasualtyId) {
    const nextId = drawerModule.getAdjacentCasualtyId(_drawerCasId, dir);
    if (nextId) jumpToCas(nextId);
    return;
  }
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  const idx = sorted.findIndex(c => c.id == _drawerCasId);
  const next = sorted[idx + dir];
  if (next) jumpToCas(next.id);
}

function renderDrawer(id) {
  // Coalesce multiple renderDrawer calls within the same frame into one.
  // This prevents redundant re-renders when several event handlers
  // (e.g., inline onclick="action();renderDrawer(id)") fire in quick succession.
  if (_renderDrawerRAF) cancelAnimationFrame(_renderDrawerRAF);
  _renderDrawerRAF = requestAnimationFrame(() => {
    _renderDrawerRAF = null;
    _renderDrawerImmediate(id);
  });
}

function _renderDrawerImmediate(id) {
  const casualtyService = _getCasualtyService();
  const c = casualtyService && casualtyService.getNormalizedCasualtyById
    ? casualtyService.getNormalizedCasualtyById(id)
    : S.casualties.find(x => x.id == id);
  if (!c) return;
  if (casualtyService && casualtyService.ensureCasualtyDefaults) casualtyService.ensureCasualtyDefaults(c);

  // Header
  const badge = $('drawer-prio-badge');
  if (badge) {
    badge.textContent = c.priority;
    badge.className = `prio pt${c.priority[1]}`;
    // Auto-close logic for evacuated/expectant patients
    if (c.priority === 'T4' && c.evacStage === 'done') {
       setTimeout(() => { if (_drawerCasId === c.id) closeDrawer(); }, 800);
    }
  }
  $('drawer-cas-name').textContent = c.name;
  const meta = $('drawer-cas-meta');
  if (meta) {
    const tqM = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
    // All values escaped via escHTML to prevent XSS
    const _metaHtml = `
      <span class="tag tag-blood">🩸 ${escHTML(c.blood || '?')}</span>
      ${c.allergy ? `<span class="tag tag-allergy">⚠️ ${escHTML(c.allergy)}</span>` : ''}
      <span class="tag tag-kg">⚖️ ${c.kg}kg</span>
      ${tqM !== null ? `<span style="font-family:var(--font-mono);font-size:10px;color:${tqM > 45 ? 'var(--red3)' : tqM > 30 ? 'var(--amber3)' : 'var(--olive3)'};font-weight:700">🩹 TQ ${tqM}′${tqM > 30 ? ' ⚠️' : ''}</span>` : ''}
      ${c.medic ? `<span style="color:var(--olive3)">🩺 ${escHTML(c.medic)}</span>` : ''}
      ${c.gps ? `<span style="color:var(--olive3)">📍 ${escHTML(c.gps)}</span>` : ''}
      <button class="btn btn-xs btn-ghost" onclick="openSyncBroadcastForCasualty(${c.id})" style="font-size:9px;padding:1px 5px;min-height:18px;border-color:var(--b1);color:var(--muted)">📡 שידור סנכרון</button>
    `;
    meta.textContent = '';
    meta.insertAdjacentHTML('beforeend', _metaHtml);
  }
  // Body
  const body = $('drawer-body'); if (!body) return;
  const previousScroll = body.scrollTop;
  const w = c.kg || 70;
  const meds = [
    { n: 'מורפין', d: '0.1mg/kg', calc: `${(w * .1).toFixed(1)}mg`, alert: 'מורפין' },
    { n: 'קטמין IV', d: '0.5mg/kg', calc: `${(w * .5).toFixed(1)}mg`, alert: 'קטמין' },
    { n: 'קטמין IM', d: '2mg/kg', calc: `${(w * 2).toFixed(0)}mg`, alert: 'קטמין' },
    { n: 'TXA', d: '1g/10min', calc: '10ml', alert: 'TXA' },
    { n: 'NaCl', d: '500ml', calc: '500ml', alert: '' },
  ];
  const trend = getDeteriorationTrend(c);
  const trendStr = trend.level === 'severe' ? '📉 מידרדר' : trend.level === 'mild' ? '↓ ירידה קלה' : '';
  const drawerSections = _getDrawerSections();
  if (!drawerSections) { console.warn('drawerSections not loaded yet'); return; }
  const quickMarchHtml = drawerSections.buildQuickMarchSection(c, trendStr);
  const vitalsHtml = drawerSections.buildVitalsSection(c, trend, trendStr);
  // AI decision section removed from UI per request:
  // const aiDecisionHtml = drawerSections.buildAiDecisionSection(c, aiDecision(c));
  const priorityHtml = drawerSections.buildPrioritySection(c, { T1: pClr('T1'), T2: pClr('T2'), T3: pClr('T3'), T4: pClr('T4') });
  const evacuationHtml = drawerSections.buildEvacuationSection(c);
  const treatmentsHtml = drawerSections.buildTreatmentsSection(c);
  const treatmentAnalysis = evaluateTreatmentState(c);
  const treatmentSuggestionHtml = `<div class="sec">📌 מצבן טיפולי</div>
    <div style="margin:0 12px 8px;color:${treatmentAnalysis.needed.length ? 'var(--amber3)' : 'var(--green3)'};font-size:12px;">
      ${treatmentAnalysis.needed.length ? 'יש לבצע: ' + treatmentAnalysis.needed.join(' → ') : 'כל הטיפולים הנדרשים בוצעו'}
      · עדיפות אוטומטית: ${c.autoTreatmentPriority}
    </div>`;
  const medicationsHtml = drawerSections.buildMedicationsSection(c, meds);
  const bodyMapSection = _getBodyMapSection();
  const bodyMapHtml = bodyMapSection.buildBodyMapSection(c);

  const tabSectionHtml = `
    <div style="margin:0 12px 8px;border:1px solid var(--b1);border-radius:10px;overflow:hidden;">
      <div style="display:flex;gap:4px;background:var(--s2);padding:4px;">
        <button id="tab-btn-actions" class="btn btn-xs btn-ghost" style="flex:1;min-height:34px;" onclick="_setCasualtyTab('${c.id}','actions')">⚡ פעולות</button>
        <button id="tab-btn-meds" class="btn btn-xs btn-ghost" style="flex:1;min-height:34px;" onclick="_setCasualtyTab('${c.id}','meds')">💊 תרופות</button>
        <button id="tab-btn-status" class="btn btn-xs btn-ghost" style="flex:1;min-height:34px;" onclick="_setCasualtyTab('${c.id}','status')">📌 מצב טיפולי</button>
      </div>
      <div id="tab-content-${c.id}" style="padding:10px;background:var(--s1);">
        <div data-tab="actions">${drawerSections.buildActionsSection(c)}</div>
        <div data-tab="meds" style="display:none">${medicationsHtml}</div>
        <div data-tab="status" style="display:none">${treatmentSuggestionHtml}</div>
      </div>
    </div>`;
  const spo2 = parseInt(c.vitals?.spo2) || 99;
  const gcs = parseInt(c.vitals?.gcs) || 15;
  const pulse = parseInt(c.vitals?.pulse) || 0;
  const criticalLevel = (spo2 < 90 || gcs < 10 || pulse > 130 || pulse < 50);
  const criticalHtml = criticalLevel
    ? `<div style="background:rgba(200,40,40,.2);color:var(--red3);border:1px solid rgba(240,72,72,.65);border-radius:8px;padding:8px 10px;margin:0 12px 8px;font-weight:700">⚠️ מצב קריטי: SpO2 ${spo2}% | GCS ${gcs} | דופק ${pulse}</div>`
    : `<div style="background:rgba(40,120,40,.14);color:var(--olive3);border:1px solid rgba(60,160,60,.45);border-radius:8px;padding:8px 10px;margin:0 12px 8px;font-weight:600">✅ מצב יציב: SpO2 ${spo2}% | GCS ${gcs} | דופק ${pulse}</div>`;
  const marchProtocolSection = _getMarchProtocolSection();
  const marchProtocolHtml = marchProtocolSection.buildMarchProtocolSection(c.id, MARCH_PHASES, MARCH_COLORS, {
    collapsible: true,
    wrapperId: `dm-full-${c.id}`,
    title: 'MARCH מלא',
    collapsedLabel: '▼ לחץ להרחבה'
  });
  const photosHtml = drawerSections.buildPhotosSection(c);
  const actionsHtml = drawerSections.buildActionsSection(c);
  const notesHtml = drawerSections.buildNotesSection(c);

  // Build new content off-screen in a DocumentFragment, then swap atomically.
  // This replaces the old body.textContent=''; body.insertAdjacentHTML(...)
  // pattern which caused two separate DOM mutations and a visible flash.
  const _drawerHtml = `
    ${bodyMapHtml}

    ${quickMarchHtml}
    ${vitalsHtml}

    ${treatmentsHtml}

    ${priorityHtml}
    ${evacuationHtml}

    ${tabSectionHtml}

    ${photosHtml}

    ${criticalHtml}

    ${marchProtocolHtml}

    ${notesHtml}
  `;

  // Parse HTML into a temporary off-screen container, then move nodes
  // into a DocumentFragment for a single atomic DOM swap.
  // Note: all user-facing values in _drawerHtml are already escaped via escHTML.
  const _tempContainer = document.createElement('div');
  _tempContainer.insertAdjacentHTML('afterbegin', _drawerHtml);
  const _fragment = document.createDocumentFragment();
  while (_tempContainer.firstChild) _fragment.appendChild(_tempContainer.firstChild);

  // replaceChildren atomically clears old content and appends new content
  // in one synchronous DOM operation — no intermediate empty state visible.
  body.replaceChildren(_fragment);
  body.scrollTop = previousScroll;

  // Draw vitals graph if history exists
  if (c.vitalsHistory && c.vitalsHistory.length > 1) {
    requestAnimationFrame(() => drawVitalsGraph(c.id));
  }
}

async function exportCasualtyQR(id) {
  const c = S.casualties.find(x => x.id == id);
  if (!c) return;
  const packet = { kind: 'BENAM_CASUALTY', format: 3, casualty: c };
  if (typeof _buildQRBundle === 'function') {
    const bundle = await _buildQRBundle(packet);
    openModal(`📤 ייצוא פצוע: ${c.name}`, `
      <div class="pad col" style="align-items:center;min-height:380px;gap:12px">
        <div id="cas-qr-wrap" style="padding:10px;background:#fff;border-radius:10px;width:320px;height:auto;min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center"></div>
        <div style="font-size:11px;color:var(--muted);text-align:center;padding:0 20px">סרוק בקוד זה באפליקציית BENAM אחרת לייבוא הפצוע</div>
        <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()">סגור</button>
      </div>
    `);
    setTimeout(() => {
      const container = document.getElementById('cas-qr-wrap');
      if (container) _renderQRBundle(container, bundle);
    }, 100);
  } else {
    showToast('❌ רכיב QR Sync לא מאותחל');
  }
}
if (typeof window !== 'undefined') {
  window.exportCasualtyQR = exportCasualtyQR;
  window.openSyncBroadcastForCasualty = function(casId) {
    window._burstScope = 'cas';
    window._burstTargetId = casId;
    openSyncDashboard('export');
  };
  window.jumpToCas = jumpToCas;
  window.closeDrawer = closeDrawer;
  window.drawerNav = drawerNav;
}