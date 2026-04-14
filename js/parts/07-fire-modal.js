// FIRE MODE
// ═══════════════════════════════════════════════════
function toggleFireMode() {
  S.fireMode = !S.fireMode;
  $('topbar-normal').style.display = S.fireMode ? 'none' : 'flex';
  $('topbar-fire').style.display = S.fireMode ? 'flex' : 'none';
  const nav = $('bottomnav');
  nav.className = S.fireMode ? 'fire-nav' : '';
  if (S.fireMode) {
    goScreen('sc-fire'); setNav(1);
    populateFireCasSelector();
  } else {
    goScreen('sc-war'); setNav(1);
  }
}

function populateFireCasSelector() {
  const btns = $('fire-cas-btns');
  const sel = $('fire-cas-selector');
  if (!btns || !sel) return;
  if (!S.casualties.length) { sel.style.display = 'none'; return; }
  sel.style.display = '';
  btns.textContent = '';
  btns.insertAdjacentHTML('afterbegin', S.casualties.map(c => `
    <button class="btn btn-lg btn-ghost btn-full" onclick="selectFireCas(${c.id})" style="justify-content:flex-start;gap:10px;border-color:${pClr(c.priority)}">
      <span class="prio pt${c.priority[1]}">${c.priority}</span> ${escHTML(c.name)}
      <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
    </button>`).join(''));
}
let selectedFireCasId = null;
function selectFireCas(id) {
  selectedFireCasId = id;
  const c = S.casualties.find(x => x.id == id);
  if (c) showToast('✓ נבחר: ' + c.name);
}

function getFireTarget() {
  if (selectedFireCasId) return S.casualties.find(c => c.id == selectedFireCasId);
  const sorted = [...S.casualties].sort((a, b) => prioN(a.priority) - prioN(b.priority));
  return sorted[0] || null;
}

function fireTQ() {
  const c = getFireTarget();
  if (!c) { showToast('בחר פגוע תחילה'); return; }
  if (!c.tqStart) c.tqStart = Date.now();
  c.txList.push({ type: 'TQ', time: nowTime() });
  addTL(c.id, c.name, 'TQ הוחל — טיימר הופעל 🩹', 'red');
  saveState(); renderWarRoom(); if (typeof updateTopStats === 'function') updateTopStats();
  showToast(`✓ TQ — ${c.name}`);
  vibrateAlert('TQ הוחל! רשום זמן!');
}
function fireTXA() {
  const c = getFireTarget();
  if (!c) { showToast('בחר פגוע תחילה'); return; }
  if (checkAllergy(c.id, 'TXA')) return;
  c.txList.push({ type: 'TXA 1g', time: nowTime() });
  addTL(c.id, c.name, 'TXA 1g ניתן 💉', 'amber');
  saveState(); renderWarRoom(); if (typeof updateTopStats === 'function') updateTopStats();
  showToast(`✓ TXA — ${c.name}`);
}
function fireCasevac() {
  genReport();
  goScreen('sc-report');
  resetReportViewToTop();
  toggleFireMode();
}
function fireExpectant() {
  const c = getFireTarget();
  if (!c) { showToast('בחר פגוע תחילה'); return; }
  c.priority = 'T4';
  addTL(c.id, c.name, 'T4 EXPECTANT — המשך לבא ⬛', '');
  saveState(); renderWarRoom(); if (typeof updateTopStats === 'function') updateTopStats();
  showToast(`T4 EXPECTANT — ${c.name}`);
}

// ═══════════════════════════════════════════════════
// WAR ROOM INLINE FIRE PANEL
// ═══════════════════════════════════════════════════
let _wrFireOpen = false;
function toggleWrFirePanel() {
  _wrFireOpen = !_wrFireOpen;
  const panel = $('wr-fire-panel');
  if (!panel) return;
  panel.style.display = _wrFireOpen ? 'block' : 'none';
  const btn = $('wr-fire-btn');
  if (btn) btn.style.background = _wrFireOpen ? '#800' : 'var(--red2)';
  if (_wrFireOpen) updateWrFirePanel();
}
function updateWrFirePanel() {
  const pills = $('wr-fire-cas-pills');
  if (!pills) return;
  if (!S.casualties.length) {
    pills.innerHTML = '<div style="font-size:10px;color:var(--muted)">אין פגועים — לחץ ＋ פגוע</div>';
  } else {
    pills.innerHTML = S.casualties.map(c => {
      const sel = selectedFireCasId == c.id;
      return `<button class="btn btn-xs" onclick="selectFireCas(${c.id});updateWrFirePanel()" style="padding:2px 8px;font-size:10px;border-color:${pClr(c.priority)};${sel ? 'background:' + pClr(c.priority) + ';color:#fff' : 'color:var(--muted2)'}">
        <span style="font-weight:900">${c.priority}</span> ${escHTML(c.name)}
      </button>`;
    }).join('');
  }
  // Update next best action if available
  const nextEl = $('wr-fire-next');
  if (nextEl && typeof _nextAction !== 'undefined' && _nextAction) {
    nextEl.style.display = 'block';
    const txt = $('wr-fire-next-text');
    const ico = $('wr-fire-next-icon');
    if (txt) txt.textContent = _nextAction.text || '—';
    if (ico) ico.textContent = _nextAction.icon || '⚡';
  }
}

// ═══════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════
function openModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  $('overlay').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeModal() { 
  $('overlay').classList.remove('on'); 
  document.body.style.overflow = '';
}
function closeModalOutside(e) { 
  if (e.target === $('overlay')) {
    $('overlay').classList.remove('on');
    document.body.style.overflow = '';
  }
}
function forceClose() { $('overlay').classList.remove('on'); }

// ─── safe setter helper ───
function setText(id, val) { const el = $(id); if (el) el.textContent = val; }
