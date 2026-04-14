// ═══════════════════════════════════════════════════
// MODERN UX ENHANCEMENTS
// ═══════════════════════════════════════════════════

// ── 1. Scroll-aware topbar: hide on scroll-down, show on scroll-up
(function initScrollAwareTopbar() {
  const content = $('content');
  const topbar = $('topbar');
  if (!content || !topbar) return;
  let lastY = 0, ticking = false;
  content.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = content.scrollTop;
      if (y > lastY && y > 60) topbar.classList.add('topbar-hidden');
      else topbar.classList.remove('topbar-hidden');
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
})();

// ── 2. Swipe between tabs on #content
(function initSwipeTabs() {
  // Disabled by request: prevent side-swipe tab switching.
})();

// ── 3. Bottom sheet drag-to-dismiss for cas-drawer
(function initDrawerDrag() {
  const drawer = $('cas-drawer');
  if (!drawer) return;
  const grip = drawer.querySelector('.drawer-grip');
  if (!grip) return;
  let startY = 0, currentY = 0, dragging = false;
  function onStart(e) {
    dragging = true;
    drawer.classList.add('dragging');
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    currentY = startY;
  }
  function onMove(e) {
    if (!dragging) return;
    currentY = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = currentY - startY;
    if (dy > 0) {
      drawer.style.transform = 'translateY(' + dy + 'px)';
    }
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    drawer.classList.remove('dragging');
    const dy = currentY - startY;
    if (dy > 120) {
      closeDrawer();
      haptic('light');
    }
    drawer.style.transform = '';
  }
  grip.addEventListener('touchstart', onStart, { passive: true });
  grip.addEventListener('touchmove', onMove, { passive: true });
  grip.addEventListener('touchend', onEnd, { passive: true });
  // Mouse fallback
  grip.addEventListener('mousedown', onStart);
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
})();

// ── 4. Haptic feedback on critical actions
(function initHapticButtons() {
  // Add haptic to fire-mode buttons, TQ, priority changes
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.fire-btn,.fs-btn,.swipe-act-btn,.msort-btn');
    if (btn) haptic('medium');
    const navBtn = e.target.closest('.nav-btn,.sub-tab');
    if (navBtn) haptic('light');
  });
})();

// ═══════════════════════════════════════════════════
// BATCH 3: FAB QUICK ACTIONS
// ═══════════════════════════════════════════════════
function toggleQuickActions(event) {
  const fab = $('quick-fab');
  const menu = $('quick-actions-menu');
  const addCas = $('quick-add-cas');
  if (!fab || !menu || !addCas) return;
  if (event) event.stopPropagation();
  const isOpen = menu.classList.contains('open');
  if (isOpen) closeQuickActions();
  else {
    menu.classList.add('open');
    fab.classList.add('open');
    fab.textContent = '✕';
    addCas.classList.add('open');
    setTimeout(() => adjustQuickActionsPosition(menu), 1); // allow initial layout
  }
}
function closeQuickActions() {
  const fab = $('quick-fab');
  const menu = $('quick-actions-menu');
  const addCas = $('quick-add-cas');
  if (fab) {
    fab.classList.remove('open');
    fab.textContent = '＋';
    fab.style.color = '#fff';
  }
  if (menu) {
    menu.classList.remove('open');
    menu.style.top = '';
    menu.style.bottom = '';
    menu.style.left = '';
    menu.style.right = '';
    menu.style.width = '';
    menu.style.maxHeight = '';
    menu.style.overflowY = '';
  }
  if (addCas) addCas.classList.remove('open');
}

document.addEventListener('click', function (e) {
  const fab = $('quick-fab');
  const menu = $('quick-actions-menu');
  if (!fab || !menu) return;
  if (!menu.classList.contains('open')) return;
  if (fab.contains(e.target) || menu.contains(e.target)) return;
  closeQuickActions();
});

function adjustQuickActionsPosition(menu) {
  if (!menu) return;

  const fab = $('quick-fab');
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const menuRect = menu.getBoundingClientRect();
  const fabRect = fab ? fab.getBoundingClientRect() : null;
  const safeMargin = 10;

  // Determine vertical anchor based on available space.
  const fallbackBottom = 96 + (window.visualViewport ? window.visualViewport.height - window.innerHeight : 0);
  if (fabRect) {
    const spaceBelow = viewportHeight - fabRect.bottom - safeMargin;
    const spaceAbove = fabRect.top - safeMargin;

    if (spaceBelow < menuRect.height && spaceAbove >= menuRect.height) {
      menu.style.top = `${Math.max(safeMargin, fabRect.top - menuRect.height - 8)}px`;
      menu.style.bottom = 'auto';
    } else {
      menu.style.top = 'auto';
      menu.style.bottom = `calc(${fallbackBottom}px + env(safe-area-inset-bottom))`;
    }
  } else {
    menu.style.top = 'auto';
    menu.style.bottom = `calc(${fallbackBottom}px + env(safe-area-inset-bottom))`;
  }

  // Recalc after applying the first constraints.
  const adjustedRect = menu.getBoundingClientRect();

  // Keep inside viewport vertically as fallback
  if (adjustedRect.top < safeMargin) {
    menu.style.top = `${safeMargin}px`;
    menu.style.bottom = 'auto';
  }
  if (adjustedRect.bottom > viewportHeight - safeMargin) {
    menu.style.bottom = `${safeMargin}px`;
    menu.style.top = 'auto';
  }

  // Horizontal clamps
  if (adjustedRect.width > viewportWidth - 40) {
    menu.style.width = 'calc(100vw - 40px)';
  }
  if (adjustedRect.left < safeMargin) {
    menu.style.left = '20px';
    menu.style.right = 'auto';
  }
  if (adjustedRect.right > viewportWidth - safeMargin) {
    menu.style.right = '20px';
    menu.style.left = 'auto';
  }

  // Recalc after horizontal adjustment
  const finalRect = menu.getBoundingClientRect();
  const targetMaxHeight = Math.min(viewportHeight - 2 * safeMargin, 560);
  menu.style.maxHeight = `calc(${Math.max(220, targetMaxHeight)}px)`;
  menu.style.overflowY = 'auto';

  // If still clipped, allow body scroll / hide overflow.
  if (finalRect.top < safeMargin || finalRect.bottom > viewportHeight - safeMargin) {
    menu.style.position = 'fixed';
    menu.style.height = `calc(100vh - ${2 * safeMargin}px)`;
    menu.style.maxHeight = `calc(100vh - ${2 * safeMargin}px)`;
    menu.style.top = `${safeMargin}px`;
    menu.style.bottom = 'auto';
    menu.style.overflowY = 'auto';
  }

}

// ═══════════════════════════════════════════════════
// BATCH 3: MODE SEPARATION (operational / training)
// ═══════════════════════════════════════════════════
function applyModeFilter() {
  // Hide/show elements with data-mode attribute
  document.querySelectorAll('[data-mode]').forEach(el => {
    const mode = el.dataset.mode;
    if (mode === 'operational') el.style.display = S.opMode === 'training' ? 'none' : '';
    else if (mode === 'training') el.style.display = S.opMode === 'training' ? '' : 'none';
  });
}

// ═══════════════════════════════════════════════════
// BATCH 3: AUTO-MCE ACTIVATION (>25% force injured)
// ═══════════════════════════════════════════════════
function checkAutoMCE() {
  // Legacy no-op: MCE state is managed automatically from casualty presence.
}

// ═══════════════════════════════════════════════════
// BATCH 3: HELIPAD MANAGEMENT
// ═══════════════════════════════════════════════════
let _helipads = [];
function addHelipad() {
  const container = $('helipads-list'); if (!container) return;
  const id = Date.now();
  _helipads.push({ id, name: '', type: 'helicopter', freq: '' });
  renderHelipads();
}
function removeHelipad(id) {
  _helipads = _helipads.filter(h => h.id !== id);
  renderHelipads();
}
function renderHelipads() {
  const container = $('helipads-list'); if (!container) return;
  container.innerHTML = _helipads.map(h => `
    <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
      <select class="inp" style="width:80px;font-size:10px" onchange="updateHelipad(${h.id},'type',this.value)">
        <option value="helicopter" ${h.type === 'helicopter' ? 'selected' : ''}>🚁 Helo</option>
        <option value="vehicle" ${h.type === 'vehicle' ? 'selected' : ''}>🚑 Vehicle</option>
      </select>
      <input class="inp" style="flex:1;font-size:11px" placeholder="LZ Name" value="${h.name}" onchange="updateHelipad(${h.id},'name',this.value)">
      <input class="inp" style="width:80px;font-size:11px" placeholder="Freq" value="${h.freq}" onchange="updateHelipad(${h.id},'freq',this.value)">
      <button class="btn btn-xs btn-ghost" style="color:var(--red3);min-height:20px" onclick="removeHelipad(${h.id})">✕</button>
    </div>`).join('');
}
function updateHelipad(id, key, val) {
  const h = _helipads.find(x => x.id === id);
  if (h) h[key] = val;
}
function saveCommsExtended() {
  saveComms();
  S.comms.helipads = _helipads;
  saveState();
}

// ═══════════════════════════════════════════════════
// BATCH 3: FORCE ROSTER EDIT + VIEWS
// ═══════════════════════════════════════════════════
var _forceViewMode = 'cards', _forceSort = 'name', _forceFilterRole = '';

function editForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  const roleOpts = Object.keys(ROLE_PRESETS).map(r => `<option value="${r}" ${f.role === r ? 'selected' : ''}>${r}</option>`).join('');
  
  openModal(`✏️ עריכת לוחם: ${escHTML(f.name)}`, `
    <div class="pad col" style="gap:10px">
      <div style="font-size:10px;color:var(--muted2);font-weight:700">פרטים אישיים</div>
      <input class="inp" id="ef-name" value="${escHTML(f.name)}" placeholder="שם מלא">
      <div class="row" style="gap:8px">
        <input class="inp" id="ef-id" value="${escHTML(f.idNum || '')}" placeholder="מ.א." style="flex:1">
        <input class="inp" id="ef-kg" type="number" value="${f.kg}" placeholder='ק"ג' style="width:70px">
      </div>
      
      <div style="font-size:10px;color:var(--muted2);font-weight:700">זיהוי ושיבוץ</div>
      <div class="row" style="gap:8px">
        <input class="inp" id="ef-iron" value="${escHTML(f.ironNum || '')}" placeholder="🔢 מספר ברזל" style="flex:1">
        <input class="inp" id="ef-iron-pair" value="${escHTML(f.ironPair || '')}" placeholder="👥 צמד ברזל" style="flex:1">
      </div>

      <div style="font-size:10px;color:var(--muted2);font-weight:700">מידע רפואי</div>
      <select class="inp" id="ef-blood">
        <option value="">סוג דם</option>
        ${ALL_BT.map(b => `<option ${f.blood === b ? 'selected' : ''}>${b}</option>`).join('')}
      </select>
      
      <select class="inp" id="ef-allergy" data-note-id="ef-allergy-note" onchange="showOtherNote(this)">
        <option value="">אלרגיות — ללא</option>
        <option value="פניצילין" ${f.allergy === 'פניצילין' ? 'selected' : ''}>פניצילין (PENC)</option>
        <option value="NSAIDs" ${f.allergy === 'NSAIDs' ? 'selected' : ''}>NSAIDs</option>
        <option value="קטמין" ${f.allergy === 'קטמין' ? 'selected' : ''}>קטמין</option>
        <option value="אחר" ${f.allergy && !['פניצילין', 'NSAIDs', 'קטמין'].includes(f.allergy) ? 'selected' : ''}>אחר — הזן הערה</option>
      </select>
      <textarea class="other-note ${f.allergy && !['פניצילין', 'NSAIDs', 'קטמין'].includes(f.allergy) ? 'show' : ''}" id="ef-allergy-note" rows="2" placeholder="פרט אלרגיה...">${f.allergy && !['פניצילין', 'NSAIDs', 'קטמין'].includes(f.allergy) ? f.allergy : ''}</textarea>

      <div class="row" style="gap:8px">
        <input class="inp" id="ef-meds" value="${escHTML(f.meds || '')}" placeholder="💊 תרופות" style="flex:1">
        <input class="inp" id="ef-vaccines" value="${escHTML(f.vaccines || '')}" placeholder="💉 חיסונים" style="flex:1">
      </div>

      <div style="font-size:10px;color:var(--muted2);font-weight:700">תפקיד</div>
      <select class="inp" id="ef-role">
        <option value="">— בחר תפקיד —</option>
        ${roleOpts}
        <option value="אחר" ${!ROLE_PRESETS[f.role] ? 'selected' : ''}>אחר</option>
      </select>

      <button class="btn btn-lg btn-olive btn-full" onclick="saveEditForce(${fid})" style="margin-top:8px">שמור שינויים ✓</button>
      <button class="btn btn-md btn-ghost btn-full" onclick="closeModal()">ביטול</button>
    </div>`);
}
function saveEditForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  f.name = $('ef-name').value.trim() || f.name;
  f.idNum = $('ef-id').value.trim();
  f.kg = parseFloat($('ef-kg').value) || f.kg;
  f.blood = $('ef-blood').value;
  f.role = $('ef-role').value;
  f.ironNum = $('ef-iron').value.trim();
  f.ironPair = $('ef-iron-pair').value.trim();
  f.allergy = getSelectVal('ef-allergy', 'ef-allergy-note');
  f.meds = $('ef-meds').value.trim();
  f.vaccines = $('ef-vaccines').value.trim();

  closeModal();
  renderForceList();
  renderCompatTable();
  saveState();
  showToast('✓ פרטי הלוחם עודכנו: ' + f.name);
}
function setForceView(mode) {
  _forceViewMode = mode;
  renderForceList();
}
function setForceSort(s) {
  _forceSort = s;
  renderForceList();
}
function setForceFilter(role) {
  _forceFilterRole = role;
  renderForceList();
}

// ═══════════════════════════════════════════════════
// BATCH 3: EVAC FORCES DEFINITION
// ═══════════════════════════════════════════════════
if (!S.evacForces) S.evacForces = [];

function renderEvacForcesSetup() {
  const container = $('evac-forces-list'); if (!container) return;
  if (!S.evacForces.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:10px;text-align:center">No evac forces defined</div>';
    return;
  }
  container.innerHTML = S.evacForces.map((ef, i) => `
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">${ef.type === 'helicopter' ? '🚁' : ef.type === 'ambulance' ? '🚑' : '🚗'}</span>
      <div style="flex:1">
        <div style="font-size:12px;font-weight:700">${ef.callsign || 'Evac ' + (i + 1)}</div>
        <div style="font-size:10px;color:var(--muted)">${ef.type} · ${ef.capacity || '?'} pax · ETA ${ef.etaMin || '?'}m</div>
      </div>
      <button class="btn btn-xs btn-ghost" onclick="removeEvacForce(${i})" style="color:var(--red3);min-height:20px">✕</button>
    </div>`).join('');
}
function openAddEvacForce() {
  openModal('🚁 Add Evac Force', `
    <div class="pad col" style="gap:8px">
      <input class="inp" id="nef-callsign" placeholder="Callsign (e.g. Yanshuf-1)">
      <select class="inp" id="nef-type">
        <option value="helicopter">🚁 Helicopter</option>
        <option value="ambulance">🚑 Ambulance</option>
        <option value="vehicle">🚗 Ground Vehicle</option>
      </select>
      <div style="display:flex;gap:6px">
        <input class="inp" id="nef-cap" type="number" placeholder="Capacity (pax)" style="flex:1">
        <input class="inp" id="nef-eta" type="number" placeholder="ETA (min)" style="flex:1">
      </div>
      <button class="btn btn-md btn-olive btn-full" onclick="saveEvacForceNew()">💾 Save</button>
    </div>`);
}
function saveEvacForceNew() {
  const ef = {
    callsign: $('nef-callsign').value.trim() || 'Evac',
    type: $('nef-type').value,
    capacity: parseInt($('nef-cap').value) || 4,
    etaMin: parseInt($('nef-eta').value) || 0
  };
  S.evacForces.push(ef);
  closeModal(); renderEvacForcesSetup(); saveState();
  showToast('✓ ' + ef.callsign + ' added');
}
function removeEvacForce(idx) {
  const name = S.evacForces[idx]?.callsign || '';
  S.evacForces.splice(idx, 1);
  renderEvacForcesSetup(); saveState();
  showToast('✓ ' + name + ' removed');
}

// ═══════════════════════════════════════════════════
// BATCH 3: ETA CALCULATOR
// ═══════════════════════════════════════════════════
const EVAC_DESTINATIONS = [
  { name: 'רמב"ם', heloMin: 15, groundMin: 40 },
  { name: 'סורוקה', heloMin: 25, groundMin: 70 },
  { name: 'הדסה עין-כרם', heloMin: 20, groundMin: 55 },
  { name: 'שיבא (תל-השומר)', heloMin: 18, groundMin: 45 },
  { name: 'בילינסון', heloMin: 18, groundMin: 50 },
  { name: 'איכילוב', heloMin: 15, groundMin: 35 },
  { name: 'זיו (צפת)', heloMin: 20, groundMin: 65 },
  { name: 'גליל מערבי (נהרייה)', heloMin: 22, groundMin: 60 },
];

function openETACalc() {
  const opts = EVAC_DESTINATIONS.map((d, i) => `<option value="${i}">${d.name}</option>`).join('');
  openModal('⏱ ETA Calculator', `
    <div class="pad col" style="gap:10px">
      <select class="inp" id="eta-dest">${opts}</select>
      <div style="display:flex;gap:8px">
        <button class="btn btn-md btn-olive" style="flex:1" onclick="calcETA('helo')">🚁 Helo</button>
        <button class="btn btn-md btn-ghost" style="flex:1" onclick="calcETA('ground')">🚗 Ground</button>
      </div>
      <div id="eta-result" style="text-align:center;padding:12px;background:var(--s2);border-radius:8px;min-height:40px"></div>
    </div>`);
}
function calcETA(mode) {
  const idx = parseInt($('eta-dest').value);
  const dest = EVAC_DESTINATIONS[idx]; if (!dest) return;
  const min = mode === 'helo' ? dest.heloMin : dest.groundMin;
  const arriveTime = new Date(Date.now() + min * 60000);
  const arrive = arriveTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const icon = mode === 'helo' ? '🚁' : '🚗';
  // Set evac ETA in state for countdown timer
  S.evacEta = arriveTime.getTime();
  saveState();
  const _eEl = $('eta-result');
  if (_eEl) { _eEl.textContent = ''; _eEl.insertAdjacentHTML('afterbegin', `
    <div style="font-size:24px;font-weight:900;color:var(--olive3)">${icon} ${min} min</div>
    <div style="font-size:11px;color:var(--muted2);margin-top:4px">${dest.name} — ETA ${arrive}</div>
    <div style="font-size:10px;color:var(--amber2);margin-top:4px">⏱ טיימר ספירה לאחור הופעל בפס העליון</div>`); }
  addTL('sys', 'SYSTEM', icon + ' ETA פינוי: ' + min + ' דק\' → ' + dest.name, 'olive');
  showToast('✓ טיימר פינוי הופעל — ' + min + ' דקות');
}
