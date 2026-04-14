// ═══════════════════════════════════════════════════
// COMMS
// ═══════════════════════════════════════════════════
function saveComms() {
  const unit = $('p-unit'), mahup = $('p-mahup'), helo = $('p-helo'), lz1 = $('p-lz1'), lz2 = $('p-lz2');
  if (!unit) return; // Not on prep screen
  S.comms = { unit: unit.value, mahup: mahup ? mahup.value : '', helo: helo ? helo.value : '', lz1: lz1 ? lz1.value : '', lz2: lz2 ? lz2.value : '' };
  showToast('תדרים נשמרו ✓');
}

// ═══════════════════════════════════════════════════
// FORCE ROSTER
// ═══════════════════════════════════════════════════
// ── EQUIPMENT BY CATEGORY ──
const EQUIP_CATS = [
  {
    k: 'רפואה', label: '🏥 רפואה', items: [
      { k: 'TQ', label: 'חוסם עורק (TQ)' },
      { k: 'Chest Seal', label: 'Chest Seal / Hyfin' },
      { k: 'Bandage', label: 'תחבושת לחץ' },
      { k: 'Gauze', label: 'Gauze / QuikClot' },
      { k: 'NPA', label: 'NPA + לובריקנט' },
      { k: 'IV', label: 'IV kit + עירוי' },
      { k: 'TXA', label: 'TXA אמפולה' },
      { k: 'Morphine', label: 'מורפין / קטמין' },
      { k: 'NaCl', label: 'NaCl 500ml' },
      { k: 'Blanket', label: 'שמיכת הלם' },
      { k: 'Gloves', label: 'כפפות' },
      { k: 'SAM', label: 'SAM Splint / גבס' },
      { k: 'Defib', label: 'AED דפיברילטור' },
    ]
  },
  {
    k: 'נשק', label: '🔫 נשק ותחמושת', items: [
      { k: 'M16', label: 'M16 / M4' },
      { k: 'Negev', label: 'נגב (מקלע)' },
      { k: 'Tavor', label: 'טאבור' },
      { k: 'Galil', label: 'גליל ACE' },
      { k: 'Mag338', label: 'מגזין .338' },
      { k: 'Ammo', label: 'תחמושת × 6 מגזינים' },
      { k: 'Grenade', label: 'רימון יד' },
      { k: 'Smoke', label: 'רימון עשן' },
      { k: 'AT', label: 'RPG / לאו / מטול' },
      { k: 'Pistol', label: 'אקדח + מגזין' },
      { k: 'Knife', label: 'סכין / בלייד' },
    ]
  },
  {
    k: 'ציוד קרב', label: '⚙️ ציוד קרב', items: [
      { k: 'Vest', label: 'אפוד קרב / יוס' },
      { k: 'Helmet', label: 'קסדת קרב' },
      { k: 'NVG', label: 'ראיית לילה NVG' },
      { k: 'Radio', label: 'רדיו / קשר' },
      { k: 'GPS', label: 'GPS ידני' },
      { k: 'Rope', label: 'חבל / קרבינר' },
      { k: 'Torch', label: 'פנס טקטי' },
      { k: 'Binos', label: 'משקפת' },
      { k: 'Marker', label: 'IR Marker / לייזר' },
    ]
  },
  {
    k: 'לוגיסטיקה', label: '🎒 לוגיסטיקה', items: [
      { k: 'Water', label: 'מים 3 ליטר' },
      { k: 'Food', label: 'מנות שטח / נ.ש.' },
      { k: 'Battery', label: 'סוללות רזרב' },
      { k: 'Map', label: 'מפה + עפרון' },
      { k: 'Carabiner', label: 'קרבינר' },
      { k: 'Poncho', label: 'פונצ\'ו / שמיכה' },
      { k: 'Cuffs', label: 'אזיקונים' },
    ]
  },
];

// Flat list derived from EQUIP_CATS — used by force roster display
const EQUIP_LIST = EQUIP_CATS.flatMap(cat => cat.items.map(item => ({ ...item, cat: cat.k })));

// Role → default equipment presets
const ROLE_PRESETS = {
  'לוחם': ['TQ', 'Chest Seal', 'Bandage', 'Gauze', 'M16', 'Ammo', 'Grenade', 'Vest', 'Helmet', 'Water'],
  'חובש': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'Blanket', 'Gloves', 'SAM', 'M16', 'Vest', 'Helmet'],
  'מפקד': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Grenade', 'Radio', 'GPS', 'NVG', 'Vest', 'Helmet', 'Binos', 'Map'],
  'נהג': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Pistol', 'Radio', 'Water', 'Vest', 'Helmet'],
  'נגביסט': ['Negev', 'Ammo', 'Ammo', 'Ammo', 'Grenade', 'TQ', 'Chest Seal', 'Bandage', 'Vest', 'Helmet', 'Water'],
  'צלם': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Radio', 'Marker', 'Battery', 'Vest', 'Helmet'],
  'מ"מ': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'Grenade', 'Radio', 'GPS', 'NVG', 'Binos', 'Map', 'Vest', 'Helmet'],
  'קמ"ן': ['TQ', 'Chest Seal', 'Bandage', 'Galil', 'Ammo', 'Grenade', 'Smoke', 'Radio', 'GPS', 'Binos', 'Vest', 'Helmet'],
  'טנקיסט': ['TQ', 'Chest Seal', 'Bandage', 'Pistol', 'Radio', 'Helmet', 'NVG', 'Water'],
  'חי"ר': ['TQ', 'Chest Seal', 'Bandage', 'Gauze', 'Tavor', 'Ammo', 'Grenade', 'Vest', 'Helmet', 'Water'],
  'הנדסה קרבית': ['TQ', 'Chest Seal', 'Bandage', 'M16', 'Ammo', 'AT', 'Rope', 'Carabiner', 'Vest', 'Helmet'],
  'רופא': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'Blanket', 'Gloves', 'SAM', 'M16', 'Vest', 'Helmet', 'Radio', 'GPS'],
  'לוחם רפואה': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'M16', 'Vest', 'Helmet'],
  'מפקד חוליה רפואית': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'Radio', 'GPS', 'Vest', 'Helmet'],
  'פאראמדיק': ['TQ', 'TQ', 'Chest Seal', 'Bandage', 'Gauze', 'NPA', 'IV', 'TXA', 'Morphine', 'NaCl', 'Blanket', 'Gloves', 'SAM', 'Radio', 'GPS', 'Vest', 'Helmet'],
};

function openAddForce() {
  _equipSel = new Set();
  const roleOpts = Object.keys(ROLE_PRESETS).map(r => `<option value="${r}">${r}</option>`).join('');
  openModal('הוסף לוחם לכוח', `
    <div class="pad col">
      <input class="inp" id="f-name" placeholder="שם מלא">
      <div class="row"><input class="inp" id="f-id" placeholder="מ.א." style="flex:1"><input class="inp" id="f-kg" placeholder='ק"ג' type="number" style="width:80px"></div>
      <div class="row"><input class="inp" id="f-iron" placeholder="🔢 מספר ברזל" style="flex:1"><input class="inp" id="f-iron-pair" placeholder="👥 צמד ברזל" style="flex:1"></div>
      <select class="inp" id="f-blood"><option value="">סוג דם</option>${ALL_BT.map(b => `<option>${b}</option>`).join('')}</select>
      <select class="inp" id="f-allergy" data-note-id="f-allergy-note" onchange="showOtherNote(this)">
        <option value="">אלרגיות — ללא</option>
        <option value="פניצילין">פניצילין (PENC)</option>
        <option value="NSAIDs">NSAIDs</option>
        <option value="קטמין">קטמין</option>
        <option value="מורפין">מורפין</option>
        <option value="סולפה">סולפה</option>
        <option value="אחר">אחר — הזן הערה</option>
      </select>
      <textarea class="other-note" id="f-allergy-note" rows="2" placeholder="פרט אלרגיה..."></textarea>
      
      <div style="display:flex;gap:6px">
        <input class="inp" id="f-meds" placeholder="💊 תרופות קבועות" style="flex:1">
        <input class="inp" id="f-vaccines" placeholder="💉 חיסונים" style="flex:1">
      </div>

      <div style="font-size:10px;color:var(--olive3);font-weight:700;letter-spacing:.06em">תפקיד / פקל</div>
      <select class="inp" id="f-role" onchange="applyRolePreset(this.value)">
        <option value="">— בחר תפקיד —</option>
        ${roleOpts}
        <option value="אחר">אחר</option>
      </select>
      <input class="inp" id="f-role-custom" placeholder="תפקיד מותאם..." style="display:none;font-size:12px">

      <div style="font-size:10px;color:var(--olive3);font-weight:700;letter-spacing:.06em;margin-top:4px">🎒 ציוד — לחץ לסימון</div>
      ${EQUIP_CATS.map(cat => `
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted2);padding:5px 0 3px;border-bottom:1px solid var(--b0);margin-bottom:4px">${cat.label}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px" id="equip-cat-${cat.k}">
            ${cat.items.map(e => `
              <div class="eq-row" data-ek="${e.k}" onclick="togEquipRow(this,'${e.k}')"
                style="display:flex;align-items:center;gap:5px;padding:5px 7px;background:var(--s3);border:1px solid var(--b0);border-radius:4px;cursor:pointer;transition:all .1s">
                <div class="eq-cb" style="width:18px;height:18px;border-radius:3px;border:2px solid var(--b1);display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0"></div>
                <div style="font-size:11px;line-height:1.2">${e.label}</div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      <input class="inp" id="f-equip-custom" placeholder="ציוד נוסף — חופשי" style="font-size:12px">
      <button class="btn btn-lg btn-olive btn-full" onclick="saveForce()">הוסף לכוח ✓</button>
    </div>`);
}

function applyRolePreset(role) {
  // show/hide custom field
  const cust = $('f-role-custom');
  if (cust) cust.style.display = role === 'אחר' ? '' : 'none';
  // clear all
  _equipSel.clear();
  document.querySelectorAll('.eq-row').forEach(r => {
    r.style.borderColor = 'var(--b0)'; r.style.background = 'var(--s3)';
    const cb = r.querySelector('.eq-cb');
    cb.textContent = ''; cb.style.background = ''; cb.style.borderColor = 'var(--b1)';
  });
  // apply preset
  const preset = ROLE_PRESETS[role] || [];
  preset.forEach(k => {
    const row = document.querySelector(`.eq-row[data-ek="${k}"]`);
    if (row && !_equipSel.has(k)) togEquipRow(row, k);
  });
}

let _equipSel = new Set();
function togEquipRow(row, key) {
  if (_equipSel.has(key)) {
    _equipSel.delete(key);
    row.style.borderColor = 'var(--b0)'; row.style.background = 'var(--s3)';
    const cb = row.querySelector('.eq-cb');
    cb.textContent = ''; cb.style.background = ''; cb.style.borderColor = 'var(--b1)';
  } else {
    _equipSel.add(key);
    row.style.borderColor = 'var(--olive3)'; row.style.background = 'var(--b0)';
    const cb = row.querySelector('.eq-cb');
    cb.textContent = '✓'; cb.style.background = 'var(--green2)'; cb.style.borderColor = 'var(--green3)';
  }
}

// keep old togEquip as alias
function togEquip(row, key) { togEquipRow(row, key); }

function addForceMember(member) {
  S.force.push(member);
  saveState();
}

function saveForce() {
  const name = $('f-name').value.trim();
  if (!name) { alert('חסר שם'); return; }
  let role = $('f-role').value;
  if (role === 'אחר') role = ($('f-role-custom')?.value.trim()) || 'אחר';
  const equip = [..._equipSel];
  const custom = ($('f-equip-custom')?.value || '').trim();
  if (custom) equip.push(custom);
  _equipSel = new Set();
  addForceMember({
    id: Date.now(), name, idNum: $('f-id').value, kg: parseFloat($('f-kg').value) || 70,
    blood: $('f-blood').value,
    ironNum: ($('f-iron')?.value || '').trim(),
    ironPair: ($('f-iron-pair')?.value || '').trim(),
    allergy: getSelectVal('f-allergy', 'f-allergy-note'),
    meds: ($('f-meds')?.value || '').trim(),
    vaccines: ($('f-vaccines')?.value || '').trim(),
    role, equip
  });
  renderForceList(); renderCompatTable(); forceClose();
}

function renderForceList() {
  $('force-count').textContent = S.force.length + ' לוחמים';
  // Sort
  let list = [...S.force];
  if (_forceSort === 'role') list.sort((a, b) => (a.role || '').localeCompare(b.role || ''));
  else if (_forceSort === 'blood') list.sort((a, b) => (a.blood || '').localeCompare(b.blood || ''));
  else list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  // Filter
  if (_forceFilterRole) list = list.filter(f => f.role === _forceFilterRole);

  if (_forceViewMode === 'table') {
    $('force-list').innerHTML = `<table style="width:100%;font-size:11px;border-collapse:collapse">
      <thead><tr style="background:var(--s3);font-size:9px;color:var(--muted2)"><th style="padding:4px">Name</th><th>Role</th><th>Blood</th><th>Kg</th><th></th></tr></thead>
      <tbody>${list.map(f => `<tr style="border-bottom:1px solid var(--b0)">
        <td style="padding:4px;font-weight:700">${escHTML(f.name)}</td><td style="color:var(--muted)">${f.role || ''}</td>
        <td><span class="tag tag-blood">${escHTML(f.blood || '?')}</span></td><td>${f.kg}</td>
        <td style="white-space:nowrap"><button class="btn btn-xs btn-ghost" onclick="editForce(${f.id})" style="font-size:9px;min-height:18px;padding:0 4px">✏️</button><button class="btn btn-xs btn-ghost" onclick="removeForce(${f.id})" style="color:var(--red3);font-size:9px;min-height:18px;padding:0 4px">✕</button></td>
      </tr>`).join('')}</tbody></table>`;
  } else {
    $('force-list').innerHTML = list.map(f => `
    <div onclick="openForceDetail(${f.id})" style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;cursor:pointer">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--olive);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${initials(f.name)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${escHTML(f.name)} <span style="font-size:10px;color:var(--muted)">${f.role || ''}</span></div>
          <div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">
            <span class="tag tag-blood">${escHTML(f.blood || '?')}</span>
            ${f.allergy ? `<span class="tag tag-allergy">⚠ ${escHTML(f.allergy)}</span>` : ''}
            <span class="tag tag-kg">${f.kg}kg</span>
            ${f.ironNum ? `<span style="font-size:9px;padding:2px 6px;background:var(--s1);border:1px solid var(--amber);border-radius:3px;color:var(--amber3)">🔢 ${escHTML(f.ironNum)}</span>` : ''}
            ${f.ironPair ? `<span style="font-size:9px;padding:2px 6px;background:var(--s1);border:1px solid var(--blue2);border-radius:3px;color:var(--olive3)">👥 ${escHTML(f.ironPair)}</span>` : ''}
          </div>
        </div>
        <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();editForce(${f.id})" style="padding:0 6px;min-height:22px;border-color:var(--olive3);color:var(--olive3);font-size:10px">✏️</button>
        <button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();removeForce(${f.id})" style="padding:0 6px;min-height:22px;border-color:var(--red2);color:var(--red3);font-size:10px">✕</button>
        <button class="btn btn-xs btn-red" onclick="activateCasFromForce(${f.id})">פצוע ▶</button>
      </div>
      ${f.equip && f.equip.length ? `
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;padding-top:6px;border-top:1px solid var(--b0)">
          <span style="font-size:9px;color:var(--muted);align-self:center;margin-left:2px">🎒</span>
          ${f.equip.map(k => { const e = EQUIP_LIST.find(x => x.k === k); return `<span style="font-size:9px;padding:2px 6px;background:var(--s3);border:1px solid var(--b1);border-radius:3px;color:var(--muted2)">${e ? e.label : k}</span>`; }).join('')}
        </div>`: ''}
    </div>`).join('');
  }
  // Also update prep enhancements
  if (typeof updateEvacOrder === 'function') updateEvacOrder();
  renderLeadership();
  if (typeof updateReadiness === 'function') updateReadiness();
  if (typeof updateEquipSummary === 'function') updateEquipSummary();
}
function openAssignLeader() {
  if (!S.force.length) { showToast('⚠️ הוסף לוחמים תחילה'); return; }
  const roles = ['מפקד כוח', 'סגן מפקד', 'קצין רפואה', 'חובש בכיר', 'אחראי קשר'];
  openModal('🎖️ הגדר בעל תפקיד', `
    <div class="pad col" style="gap:12px">
      <label class="card-lbl">בחר תפקיד</label>
      <select class="inp" id="l-role">
        ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
      </select>
      <label class="card-lbl">בחר לוחם</label>
      <select class="inp" id="l-fid">
        ${S.force.map(f => `<option value="${f.id}">${f.name}</option>`).join('')}
      </select>
      <button class="btn btn-lg btn-olive btn-full" onclick="saveLeader()">שמור</button>
    </div>
  `);
}

function saveLeader() {
  const role = $('l-role').value;
  const fid = $('l-fid').value;
  if (!S.leadership) S.leadership = {};
  S.leadership[role] = fid;
  saveState(); closeModal(); renderLeadership();
}

function renderLeadership() {
  const el = $('leadership-list'); if (!el) return;
  const l = S.leadership || {};
  const entries = Object.entries(l);
  el.innerHTML = entries.map(([role, fid]) => {
    const f = S.force.find(x => x.id == fid);
    if (!f) return '';
    return `<div style="background:var(--s2);border:1px solid var(--b0);border-radius:6px;padding:8px 10px;display:flex;align-items:center;gap:10px">
      <div style="font-size:11px;font-weight:700;flex:1">${role}: <span style="color:var(--olive3)">${f.name}</span></div>
      <button class="btn btn-xs btn-ghost" onclick="deleteLeader('${role}')" style="color:var(--red3);border:none">✕</button>
    </div>`;
  }).join('');
}

function deleteLeader(role) { delete S.leadership[role]; saveState(); renderLeadership(); }
if (typeof window !== 'undefined') {
  window.openForceDetail = openForceDetail;
  window.openAssignLeader = openAssignLeader;
  window.deleteLeader = deleteLeader;
  window.saveLeader = saveLeader;
}

function activateCasFromForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  openAddCas(f);
}

function openForceDetail(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;

  const equipList = (f.equip || []).map(k => {
    const e = EQUIP_LIST.find(x => x.k === k);
    return `<div style="font-size:12px;padding:4px 8px;background:var(--s3);border:1px solid var(--b1);border-radius:4px">${e ? e.label : k}</div>`;
  }).join('');

  openModal(`כרטיס לוחם: ${f.name}`, `
    <div class="pad col" style="gap:16px">
      <div class="row" style="align-items:center;gap:12px">
        <div style="width:50px;height:50px;border-radius:50%;background:var(--olive);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px">${initials(f.name)}</div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:900">${f.name}</div>
          <div style="font-size:13px;color:var(--olive3);font-weight:600">${f.role || 'ללא תפקיד'}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="card-sm">
          <div class="card-lbl">מ.א.</div>
          <div class="card-val">${f.idNum || '—'}</div>
        </div>
        <div class="card-sm">
          <div class="card-lbl">משקל</div>
          <div class="card-val">${f.kg}kg</div>
        </div>
        <div class="card-sm">
          <div class="card-lbl">דגם ברזל</div>
          <div class="card-val">${f.ironNum || '—'}</div>
        </div>
        <div class="card-sm">
          <div class="card-lbl">צמד ברזל</div>
          <div class="card-val">${f.ironPair || '—'}</div>
        </div>
      </div>

      <div class="sec" style="margin:0;padding:4px 0;border-bottom:1px solid var(--b0)">מידע רפואי</div>
      <div class="col" style="gap:8px">
        <div class="row" style="justify-content:space-between">
          <span style="font-size:12px;color:var(--muted)">סוג דם:</span>
          <span class="tag tag-blood">${f.blood || '?'}</span>
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <span style="font-size:12px;color:var(--muted)">אלרגיות:</span>
          <span style="font-size:12px;font-weight:700;color:${f.allergy ? 'var(--red3)' : 'var(--green3)'}">${f.allergy || 'ללא'}</span>
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <span style="font-size:12px;color:var(--muted)">תרופות:</span>
          <span style="font-size:12px;font-weight:700">${f.meds || 'ללא'}</span>
        </div>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <span style="font-size:12px;color:var(--muted)">חיסונים:</span>
          <span style="font-size:12px;font-weight:700">${f.vaccines || 'ללא'}</span>
        </div>
      </div>

      <div class="sec" style="margin:0;padding:4px 0;border-bottom:1px solid var(--b0)">ציוד אישי</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${equipList || '<div style="font-size:12px;color:var(--muted)">אין ציוד רשום</div>'}
      </div>

      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-lg btn-ghost" style="flex:1" onclick="closeModal();editForce(${f.id})">ערוך פרטים ✏️</button>
        <button class="btn btn-lg btn-red" style="flex:1" onclick="closeModal();activateCasFromForce(${f.id})">הפוך לפצוע ▶</button>
      </div>
    </div>
  `);
}

function removeForce(fid) {
  const f = S.force.find(x => x.id == fid);
  if (!f) return;
  if (!confirm(`הסר את ${f.name} מהכוח?`)) return;
  S.force = S.force.filter(x => x.id !== fid);
  renderForceList(); renderCompatTable(); saveState();
  showToast(`✓ ${f.name} הוסר מהכוח`);
}

function clearAllForce() {
  if (!S.force.length) { showToast('הכוח ריק'); return; }
  if (!confirm(`מחק את כל ${S.force.length} הלוחמים מהכוח?\nלא ניתן לבטל.`)) return;
  S.force = [];
  renderForceList(); renderCompatTable(); saveState();
  showToast('✓ כל הכוח נמחק');
}

// ═══════════════════════════════════════════════════
// COMPAT TABLE
// ═══════════════════════════════════════════════════
function renderCompatTable() {
  if (!$('compat-table')) return;
  let h = `<table class="compat-matrix"><tr><th></th>${ALL_BT.map(b => `<th>${b}</th>`).join('')}</tr>`;
  ALL_BT.forEach(donor => {
    const cg = BLOOD_COMPAT[donor] || [];
    h += `<tr><td style="font-weight:700;color:var(--amber2)">${donor}</td>`;
    ALL_BT.forEach(r => {
      h += donor === r ? `<td class="compat-self">●</td>` : cg.includes(r) ? `<td class="compat-yes">✓</td>` : `<td class="compat-no">–</td>`;
    });
    h += '</tr>';
  });
  $('compat-table').innerHTML = h;
}
renderCompatTable();
// Set initial nav state
setTimeout(updateNavMode, 100);
// Restore persisted state
if (typeof window !== 'undefined') {
  window.openForceDetail = openForceDetail;
  window.openAssignLeader = openAssignLeader;
  window.deleteLeader = deleteLeader;
  window.saveLeader = saveLeader;
  window.renderLeadership = renderLeadership;
  window.editForce = editForce;
  window.removeForce = removeForce;
  window.clearAllForce = clearAllForce;
}
setTimeout(loadState, 200);