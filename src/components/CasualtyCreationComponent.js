import { getElement, escapeHtml } from '../utils/DomHelper.js';
import { getState, getForceRoster, saveState } from '../services/StateService.js';
import { createCasualtyRecord, getForceMemberPrefill } from '../services/CasualtyCreationService.js';

function readLegacyGlobal(name) {
  if (window[name] !== undefined) {
    return window[name];
  }
  try {
    return window.eval(`typeof ${name} === 'undefined' ? undefined : ${name}`);
  } catch (_) {
    return undefined;
  }
}

function runLegacy(code) {
  try {
    return window.eval(code);
  } catch (e) {
    console.warn('[BENAM] Legacy eval failed:', e);
    return undefined;
  }
}

function getMechanismSelection() {
  return readLegacyGlobal('mechSel') || [];
}

function setMechanismSelection(nextSelection) {
  if (window.mechSel !== undefined) {
    window.mechSel = nextSelection;
  } else {
    runLegacy(`mechSel = ${JSON.stringify(nextSelection)}`);
  }
}

function getBloodTypes() {
  if (window.BENAM_LEGACY?.getBloodTypes) {
    return window.BENAM_LEGACY.getBloodTypes();
  }

  return window.ALL_BT || [];
}

function getSelectValue(selectId, noteId) {
  if (typeof window.getSelectVal === 'function') {
    return window.getSelectVal(selectId, noteId);
  }

  const selectElement = getElement(selectId);
  if (!selectElement) {
    return '';
  }

  return selectElement.value === 'אחר'
    ? (getElement(noteId)?.value.trim() || '')
    : selectElement.value;
}

function getResolvedMechanisms() {
  return getMechanismSelection().map((mechanism) => {
    if (mechanism !== 'אחר') {
      return mechanism;
    }

    return getElement('mech-other-note')?.value.trim() || 'אחר';
  });
}

export function openAddCasualtyModal(prefill = null) {
  const force = getForceRoster();
  const bloodTypes = getBloodTypes();

  const forceOptions = force.length > 0
    ? `<select class="inp" id="nc-from-force" onchange="autofillCas(this.value)">
        <option value="">-- בחר מהכוח --</option>
        ${force.map((f) => `<option value="${f.id}">${escapeHtml(f.name)} (${f.role})</option>`).join('')}
      </select>`
    : '';

  const casualtyCount = (getState()?.casualties && Array.isArray(getState().casualties)) ? getState().casualties.length : 0;
  const nextCasualtyNumber = casualtyCount + 1;
  const defaultName = prefill?.name || `${nextCasualtyNumber}`;

  window.openModal('פגוע חדש', `
    <div class="pad col" style="gap:12px">
      ${forceOptions}
      <div class="row"><input class="inp" id="nc-name" placeholder="שם הפגוע" value="${escapeHtml(defaultName)}" style="flex:1" autofocus></div>
      <div class="row"><input class="inp" id="nc-id" placeholder="מ.א." value="${escapeHtml(prefill?.idNum || '')}" style="flex:1"><input class="inp" id="nc-kg" placeholder='ק"ג' type="number" value="${prefill?.kg || ''}" style="width:80px"></div>
      <div class="row">
        <select class="inp" id="nc-blood" style="flex:1">
          <option value="">סוג דם</option>
          ${bloodTypes.map((bt) => `<option ${prefill?.blood === bt ? 'selected' : ''}>${bt}</option>`).join('')}
        </select>
        <select class="inp" id="nc-allergy" data-note-id="nc-allergy-note" onchange="showOtherNote(this)" style="flex:1">
          <option value="">אין אלרגיה</option>
          <option value="אחר">יש אלרגיה</option>
          <option value="NKDA">NKDA</option>
        </select>
      </div>
      <textarea class="other-note" id="nc-allergy-note" rows="2" placeholder="פרט אלרגיה..."></textarea>
      <select class="inp" id="nc-prio">
        <option value="T1">T1 — URGENT קריטי</option>
        <option value="T2">T2 — DELAYED דחוף</option>
        <option value="T3">T3 — MINIMAL קל</option>
        <option value="T4">T4 — EXPECTANT</option>
      </select>
      <div style="font-size:10px;color:var(--muted2);margin-bottom:-4px">מנגנון פציעה:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px" id="mech-btns">
        ${['ירי', 'פיצוץ', 'להב', 'נפילה', 'כוויה', 'רסיס'].map((mechanism) => `<button class="btn btn-sm btn-ghost" onclick="togMech(this,'${mechanism}')" data-m="${mechanism}">${mechanism}</button>`).join('')}
        <button class="btn btn-sm btn-ghost" id="mech-other-btn" onclick="togMech(this,'אחר');$('mech-other-note').classList.toggle('show',mechSel.includes('אחר'))">אחר</button>
      </div>
      <textarea class="other-note" id="mech-other-note" rows="2" placeholder="פרט מנגנון פציעה..."></textarea>
      <button class="btn btn-xl btn-red btn-full" onclick="saveCas()">הוסף פגוע ⚡</button>
    </div>`);

  if (prefill) {
    autofillCasualtyForm(prefill.id);
  }
}

export function autofillCasualtyForm(forceMemberId) {
  const forceMember = getForceMemberPrefill(forceMemberId);
  if (!forceMember) {
    return;
  }

  getElement('nc-name').value = forceMember.name;
  getElement('nc-id').value = forceMember.idNum;
  getElement('nc-kg').value = forceMember.kg;
  getElement('nc-blood').value = forceMember.blood;
  getElement('nc-allergy').value = forceMember.allergy || '';
}

export function toggleMechanismSelection(button, mechanism) {
  const selection = [...getMechanismSelection()];
  const index = selection.indexOf(mechanism);

  if (index > -1) {
    selection.splice(index, 1);
    button.classList.remove('btn-olive');
    button.classList.add('btn-ghost');
  } else {
    selection.push(mechanism);
    button.classList.remove('btn-ghost');
    button.classList.add('btn-olive');
  }

  setMechanismSelection(selection);
}

export function saveCasualtyFromForm() {
  const casualtyName = getElement('nc-name')?.value.trim();
  if (!casualtyName) {
    window.showToast?.('⚠ שם הפגוע נדרש');
    getElement('nc-name')?.focus();
    return;
  }

  const casualtyRecord = createCasualtyRecord({
    name: casualtyName,
    identifier: getElement('nc-id')?.value || '',
    weightKg: getElement('nc-kg')?.value || '70',
    bloodType: getElement('nc-blood')?.value || '',
    allergy: getSelectValue('nc-allergy', 'nc-allergy-note'),
    priority: getElement('nc-prio')?.value || 'T1',
    mechanisms: getResolvedMechanisms(),
    nextCasualtyId: window.nextCasId ? window.nextCasId() : Date.now(),
    nowTime: window.nowTime ? window.nowTime() : new Date().toLocaleTimeString(),
    nowTimestamp: Date.now(),
  });

  const state = getState();
  if (state && state.casualties) {
    state.casualties.push(casualtyRecord);
  }

  setMechanismSelection([]);

  if (window.addTL) {
    window.addTL(
      casualtyRecord.id,
      casualtyRecord.name,
      `פגוע חדש — ${casualtyRecord.priority} — ${casualtyRecord.mech.join(', ') || 'לא צוין'}`,
      window.prioDot ? window.prioDot(casualtyRecord.priority) : 'green'
    );
  }

  const tbSub = getElement('tb-sub');
  if (tbSub && state && state.casualties) {
    tbSub.textContent = `אר"ן פעיל — ${state.casualties.length} פצועים`;
  }

  try {
    window.forceClose?.();
    window.renderWarRoom?.();
    saveState();
    window.computeNAE?.();

    window.setTimeout(() => {
      window.jumpToCas?.(casualtyRecord.id);
      window.setTimeout(() => {
        const drawerBody = getElement('drawer-body');
        const mapSection = drawerBody && [...drawerBody.querySelectorAll('.sec')].find((element) => element.textContent.includes('מפת פציעות'));
        if (mapSection) {
          mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 200);
    }, 100);
  } catch (e) {
    console.error('[BENAM] Post-creation update failed:', e);
  }
}

export function initCasualtyCreationComponent() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.casualtyCreationComponent = {
    openAddCasualtyModal,
    autofillCasualtyForm,
    toggleMechanismSelection,
    saveCasualtyFromForm,
  };
}