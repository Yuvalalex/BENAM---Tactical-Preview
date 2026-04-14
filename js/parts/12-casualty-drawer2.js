
function toggleDrawerMarch(casId, letter, el) {
  const casualtyService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService ? window.BENAM_LEGACY.casualtyService : null;
  const c = casualtyService && casualtyService.getCasualtyById ? casualtyService.getCasualtyById(casId) : S.casualties.find(x => x.id == casId);
  if (!c) return;
  const was = (c.march[letter] || 0) > 0;
  c.march[letter] = was ? 0 : 1;
  el.classList.toggle('done', !was);
  el.querySelector('.dmc-letter').style.color = !was ? 'var(--green3)' : '#aaa';
  el.querySelector('.dmc-state').textContent = !was ? '✅' : '○';
  addTL(casId, c.name, `${!was ? '✅' : '○'} MARCH ${letter} ${!was ? 'בוצע' : 'בוטל'}`, 'olive');
}

function toggleDrawerSection(id) {
  const el = $(id); if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function jumpToCasLegacy(id) {
  // Opens old full-screen detail for body map / advanced features
  const casualtyService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService ? window.BENAM_LEGACY.casualtyService : null;
  const c = casualtyService && casualtyService.getCasualtyById ? casualtyService.getCasualtyById(id) : S.casualties.find(x => x.id == id); if (!c) return;
  renderCasDetail(c);
  goScreen('sc-cas'); setNav(1);
}

function openQuickTx(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const opts = ['TQ — הנח', 'TXA 1g', 'Chest Seal', 'NPA', 'IV NaCl', 'IO access', 'Tourniquet release', 'מורפין', 'קטמין IM', 'פנסיל G', 'אחר...'];
  openModal('הוסף טיפול', `<div style="display:flex;flex-direction:column;gap:6px;padding:8px 0">
    ${opts.map(t => `<button class="btn btn-sm btn-ghost btn-full" onclick="recordTx(${casId},'${t}','${t}');closeModal();renderDrawer(${casId})">${t}</button>`).join('')}
  </div>`);
}

// ═══════════════════════════════════════════════════
// FAB + FIRE ACTION SHEET
// ═══════════════════════════════════════════════════
function toggleFireSheet() {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.toggleFireActionSheet) {
    _fireSheetOpen = drawerModule.toggleFireActionSheet(_fireSheetOpen, _drawerCasId);
    return;
  }
  _fireSheetOpen = !_fireSheetOpen;
  $('fire-sheet').classList.toggle('open', _fireSheetOpen);
  const fab = $('wr-fab'); if (fab) fab.classList.toggle('open', _fireSheetOpen);
  $('drawer-overlay').classList.toggle('show', _fireSheetOpen && !_drawerCasId);
}
function closeFireSheet() {
  const drawerModule = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyDrawer ? window.BENAM_LEGACY.casualtyDrawer : null;
  if (drawerModule && drawerModule.closeFireActionSheet) {
    drawerModule.closeFireActionSheet(_drawerCasId);
    _fireSheetOpen = false;
    return;
  }
  _fireSheetOpen = false;
  $('fire-sheet').classList.remove('open');
  const fab = $('wr-fab'); if (fab) fab.classList.remove('open');
  if (!_drawerCasId) $('drawer-overlay').classList.remove('show');
}


function deleteCasualty(casId) {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const casualtyService = window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService ? window.BENAM_LEGACY.casualtyService : null;
  const c = casualtyService && casualtyService.getCasualtyById ? casualtyService.getCasualtyById(casId) : S.casualties.find(x => x.id == casId); if (!c) return;
  if (!confirm('מחק פגוע: ' + c.name + '?')) return;
  if (_dtqIntervals[casId]) { clearInterval(_dtqIntervals[casId]); delete _dtqIntervals[casId]; }
  if (drawerActionService && drawerActionService.deleteCasualtyById) drawerActionService.deleteCasualtyById(casId);
  else S.casualties = S.casualties.filter(x => x.id != casId);
  addTL('sys', 'SYSTEM', '🗑 ' + c.name + ' נמחק', 'מנועים');
  closeDrawer(); renderWarRoom(); saveState();
}

function viewPhoto(url) { openModal('📷 תצלום', `<img src="${url}" style="width:100%;border-radius:8px">`); }
function openBuddyAssign(casId) { assignBuddy(casId); }
function assignBuddy(casId, fid) {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  if (drawerActionService && drawerActionService.assignBuddyToCasualty) {
    const result = drawerActionService.assignBuddyToCasualty(casId, fid);
    if (!result) return;
    const f = result.forceMember;
    closeModal(); renderDrawer(casId); showToast('👤 Buddy: ' + f.name);
    return;
  }
  const c = S.casualties.find(x => x.id == casId);
  const f = S.force.find(x => x.id == fid);
  if (!c || !f) return;
  c.buddyName = f.name; c.buddyId = fid;
  closeModal(); renderDrawer(casId); showToast('👤 Buddy: ' + f.name);
}
function fireTQCurrent() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const target = drawerActionService && drawerActionService.getTopPriorityCasualtyByPriority
    ? drawerActionService.getTopPriorityCasualtyByPriority('T1')
    : null;
  const t1 = target ? [target] : S.casualties.filter(c => c.priority === 'T1').sort((a, b) => prioN(a.priority) - prioN(b.priority));
  if (!t1.length) { showToast('⚠ אין פגועים T1'); return; }
  fireTQFor(t1[0].id);
  if (_drawerCasId) renderDrawer(_drawerCasId);
}
function addTXACurrent() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const target = drawerActionService && drawerActionService.getTopPriorityCasualtyByPriority
    ? drawerActionService.getTopPriorityCasualtyByPriority('T1')
    : null;
  const t1 = target ? [target] : S.casualties.filter(c => c.priority === 'T1');
  if (!t1.length) { showToast('⚠ אין פגועים T1'); return; }
  addTXA(t1[0].id);
  if (_drawerCasId) renderDrawer(_drawerCasId);
}
function fireAirway() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const c = drawerActionService && drawerActionService.getActionTargetCasualty
    ? drawerActionService.getActionTargetCasualty(_drawerCasId, 'T1')
    : (_drawerCasId ? S.casualties.find(x => x.id == _drawerCasId) : S.casualties.find(c => c.priority === 'T1'));
  if (!c) { showToast('⚠ בחר פגוע'); return; }
  if (drawerActionService && drawerActionService.appendImmediateTreatment) drawerActionService.appendImmediateTreatment(c.id, 'NPA — נתיב אוויר', 'A');
  else {
    c.txList.push({ type: 'NPA — נתיב אוויר', time: nowTime(), ms: Date.now() });
    c.march.A = (c.march.A || 0) + 1;
  }
  addTL(c.id, c.name, '🌬️ NPA הונח — נתיב אוויר', 'olive');
  if (_drawerCasId) renderDrawer(_drawerCasId);
  renderWarRoom(); showToast(`🌬️ NPA — ${c.name}`);
}
function fireChestSeal() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const c = drawerActionService && drawerActionService.getActionTargetCasualty
    ? drawerActionService.getActionTargetCasualty(_drawerCasId, 'T1')
    : (_drawerCasId ? S.casualties.find(x => x.id == _drawerCasId) : S.casualties.find(c => c.priority === 'T1'));
  if (!c) { showToast('⚠ בחר פגוע'); return; }
  if (drawerActionService && drawerActionService.appendImmediateTreatment) drawerActionService.appendImmediateTreatment(c.id, 'Chest Seal', 'R');
  else {
    c.txList.push({ type: 'Chest Seal', time: nowTime(), ms: Date.now() });
    c.march.R = (c.march.R || 0) + 1;
  }
  addTL(c.id, c.name, '🫁 Chest Seal הונח', 'olive');
  if (_drawerCasId) renderDrawer(_drawerCasId);
  renderWarRoom(); showToast(`🫁 Chest Seal — ${c.name}`);
}
function fireT4Current() {
  const drawerActionService = window.BENAM_LEGACY && window.BENAM_LEGACY.drawerActionService ? window.BENAM_LEGACY.drawerActionService : null;
  const c = _drawerCasId
    ? (window.BENAM_LEGACY.casualtyService && window.BENAM_LEGACY.casualtyService.getCasualtyById ? window.BENAM_LEGACY.casualtyService.getCasualtyById(_drawerCasId) : S.casualties.find(x => x.id == _drawerCasId))
    : null;
  if (!c) { showToast('⚠ פתח פגוע קודם'); return; }
  if (!confirm(`${c.name} — לשנות ל-T4 Expectant?`)) return;
  if (drawerActionService && drawerActionService.markCasualtyExpectant) drawerActionService.markCasualtyExpectant(c.id);
  else c.priority = 'T4';
  addTL(c.id, c.name, '⚫ T4 Expectant', 'muted');
  renderWarRoom(); if (_drawerCasId) renderDrawer(_drawerCasId);
}

// Show FAB when mission is active
// ═══════════════════════════════════════════════════
// ALLERGY CHECK
// ═══════════════════════════════════════════════════
function checkAllergy(casId, drug) {
  const c = S.casualties.find(x => x.id == casId); if (!c || !c.allergy) return false;
  const allergyMap = { 'מורפין': ['מורפין', 'Morphine'], 'קטמין': ['קטמין', 'Ketamine'], 'פניצילין': ['פניצילין', 'PENC'], 'NSAIDs': ['NSAIDs', 'ibuprofen'] };
  const triggers = allergyMap[c.allergy] || [];
  const isDangerous = triggers.some(t => drug.toLowerCase().includes(t.toLowerCase()));
  if (isDangerous) {
    $('ab-detail').textContent = `${c.name} — אלרגי ל${c.allergy}!\nאין לתת: ${drug}\nחפש תחליף!`;
    $('allergy-block').classList.add('on');
    vibrateAlert(`⛔ אלרגיה! ${c.name} — לא לתת ${drug}`);
    return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════
// GUIDED FLOW
// ═══════════════════════════════════════════════════
function startGuidedFlow(casId) {
  guidedCasId = casId;
  const c = S.casualties.find(x => x.id == casId);
  guidedSteps = [
    { title: `${c.name} — M`, instruction: 'החל TQ\n2 אצבעות מעל הפצע', sub: 'הדק חזק עד שדימום נעצר. כתוב זמן על TQ בטוש.', confirm: '✓ TQ הוחל' },
    { title: 'Safety', instruction: 'גצירת נשק + Safety', sub: 'הסר נשק מהפגוע — פרוק.', confirm: '✓ נשק בצוע' },
    { title: 'A — נתיב אוויר', instruction: 'בדוק נשימה ספונטנית', sub: 'ראה עלייה ירידה בחזה. אם לא — NPA!', confirm: '✓ נתיב אוויר פתוח' },
    { title: 'C — Circulation', instruction: 'IV/IO + נוזלים\nהכן TXA', sub: 'אם זמן מפציעה <3 שעות — תן TXA 1g. NaCl 500ml.', confirm: '✓ IV + TXA מוכנים' },
    { title: 'H — היפותרמיה', instruction: 'כסה עם שמיכה\nBag / Blizzard', sub: 'שמור חום גוף. בדוק GCS.', confirm: '✓ כוסה — מוכן לפינוי' },
  ];
  guidedIdx = 0;
  renderGuidedStep();
  $('guided-overlay').classList.add('on');
}
function renderGuidedStep() {
  const step = guidedSteps[guidedIdx]; if (!step) return;
  $('gf-step-label').textContent = `שלב ${guidedIdx + 1} מתוך ${guidedSteps.length}`;
  $('gf-title').textContent = step.title;
  $('gf-instruction').textContent = step.instruction;
  $('gf-sub').textContent = step.sub;
  $('gf-confirm-btn').textContent = step.confirm || '✓ בוצע — המשך';
  const prog = $('gf-progress');
  prog.innerHTML = guidedSteps.map((_, i) => `<div class="gp-dot ${i < guidedIdx ? 'done' : i === guidedIdx ? 'active' : ''}"></div>`).join('');
}
function guidedNext() {
  const c = S.casualties.find(x => x.id == guidedCasId);
  if (c) addTL(c.id, c.name, `✓ ${guidedSteps[guidedIdx].title}`, 'green');
  guidedIdx++;
  if (guidedIdx >= guidedSteps.length) { closeGuided(); showToast('✓ MARCH ראשוני הושלם!'); }
  else renderGuidedStep();
}
function closeGuided() { $('guided-overlay').classList.remove('on'); }
