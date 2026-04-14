import { BLOOD_COMPATIBILITY_MATRIX } from '../constants/BloodCompatibilityMatrix.js';
import { escapeHtml } from '../utils/DomHelper.js';

export function buildQuickMarchSection(casualty, trendText) {
  return `
    <!-- MARCH Quick-check -->
    <div class="sec" style="margin-top:4px">🏥 MARCH
      ${trendText ? `<span style="font-size:10px;color:var(--red3);font-weight:700">${trendText}</span>` : ''}
    </div>
    <div class="d-march-strip" id="dm-strip-${casualty.id}">
      ${['M', 'A', 'R', 'C', 'H'].map((letter, index) => {
        const names = ['עצירת דימום', 'נתיב אוויר', 'נשימה', 'מחזור', 'חום/ראש'];
        const done = (casualty.march[letter] || 0) > 0;
        return `<div class="d-march-cell ${done ? 'done' : ''}" onclick="toggleDrawerMarch(${casualty.id},'${letter}',this)">
          <div class="dmc-letter" style="color:${done ? 'var(--green3)' : '#aaa'}">${letter}</div>
          <div class="dmc-name">${names[index]}</div>
          <div class="dmc-state">${done ? '✅' : '○'}</div>
        </div>`;
      }).join('')}
    </div>`;
}

export function buildVitalsSection(casualty, trend, trendText) {
  const vitalRows = [
    ['💗 דופק', 'pulse', 'BPM', casualty.vitals.pulse, trend.pulseDir],
    ['🫁 SpO2', 'spo2', '%', casualty.vitals.spo2, trend.spo2Dir],
    ['🧠 GCS', 'gcs', '/15', casualty.vitals.gcs, trend.gcsDir],
    ['🩺 BP', 'bp', 'mmHg', casualty.vitals.bp, ''],
    ['💨 נשימות', 'rr', '/דקה', casualty.vitals.rr, ''],
  ];

  const rangeConfig = {
    pulse: { min: 30, max: 180, step: 1 },
    spo2: { min: 70, max: 100, step: 1 },
    gcs: { min: 3, max: 15, step: 1 },
    rr: { min: 5, max: 40, step: 1 },
    bp: { min: 70, max: 190, step: 1 }
  };

  return `
    <!-- Vitals -->
    <div class="d-vitals-list">
      ${vitalRows.map(([label, key, unit, value, direction]) => {
        const numericValue = Number.parseInt(value, 10);
        const isCrit = (key === 'spo2' && numericValue < 90) || (key === 'pulse' && (numericValue > 120 || numericValue < 50)) || (key === 'gcs' && numericValue < 10);
        const isWarn = (key === 'spo2' && numericValue < 94) || (key === 'pulse' && numericValue > 100);
        const color = isCrit ? 'var(--red3)' : isWarn ? 'var(--amber3)' : '#fff';
        const trendHtml = direction === 'up'
          ? `<div class="d-vtrend" style="color:${isCrit ? 'var(--red3)' : 'var(--amber3)'}">↑</div>`
          : direction === 'dn'
            ? '<div class="d-vtrend" style="color:var(--red3)">↓</div>'
            : '<div class="d-vtrend"></div>';

        const hasRange = Object.prototype.hasOwnProperty.call(rangeConfig, key);
        const range = rangeConfig[key] || {};
        const rangeValue = value && value !== '' ? value : range.min || '';

        return `<div class="d-vital-row ${isCrit ? 'crit' : isWarn ? 'warn' : ''}" id="dvi-${casualty.id}-${key}">
          <div class="d-vrow-left">
            <span class="d-vlbl">${label}</span>
            <span class="d-vunit">${unit}</span>
          </div>
          <div class="d-vrow-right">
            ${hasRange ? `<div class="d-vslider-wrap" id="dvs-wrap-${casualty.id}-${key}"><input class="d-vslider" id="dvi-${casualty.id}-${key}-slider" type="range" min="${range.min}" max="${range.max}" step="${range.step}" value="${rangeValue}"
              oninput="onVitalSliderInput(${casualty.id}, '${key}', this.value)"><div class="d-vslider-axis"><span class="d-vslider-axis-label">${range.min}</span><span class="d-vslider-axis-label">${range.max}</span></div></div>` : ''}
            <input class="d-vinput" value="${value || ''}" placeholder="—" type="${hasRange ? 'number' : key === 'bp' ? 'text' : 'number'}"
              inputmode="${hasRange ? 'numeric' : key === 'bp' ? 'text' : 'numeric'}"
              style="color:${color}"
              oninput="saveVital(${casualty.id},'${key}',this.value);updateDrawerVital(${casualty.id},'${key}',this.value)"
              id="dvi-${casualty.id}-${key}-input">
            ${trendHtml}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

export function toggleCasualtyTreatment(casId, key, label) {
  const c = S.casualties.find(x => x.id == casId);
  if (!c) return;

  if (!c.treatmentStatus) c.treatmentStatus = {};
  c.treatmentStatus[key] = !c.treatmentStatus[key];

  if (!Array.isArray(c.txList)) c.txList = [];
  const treatmentType = label || key;

  if (c.treatmentStatus[key]) {
    if (!c.txList.some(t => String(t.type || '').toLowerCase() === String(treatmentType).toLowerCase())) {
      c.txList.push({ type: treatmentType, time: nowTime() });
      addTL(casId, c.name, `טיפול: ${treatmentType}`, 'green');
    }
  } else {
    c.txList = c.txList.filter(t => String(t.type || '').toLowerCase() !== String(treatmentType).toLowerCase());
    addTL(casId, c.name, `הוסר טיפול: ${treatmentType}`, 'muted');
  }

  c.treatmentFlags = c.treatmentFlags || {};
  c.treatmentFlags[key] = c.treatmentStatus[key];
  if (typeof evaluateTreatmentState === 'function') evaluateTreatmentState(c);

  if (typeof renderDrawer === 'function') renderDrawer(casId);
  if (typeof renderWarRoom === 'function') renderWarRoom();
  saveState();
}

if (typeof window !== 'undefined' && !window.toggleCasualtyTreatment) {
  window.toggleCasualtyTreatment = toggleCasualtyTreatment;
}

export function buildTreatmentsSection(casualty) {
  const treatments = [
    { key: 'chest-seal', label: 'Chest Seal / HyFin', icon: '🩹' },
    { key: 'tourniquet', label: 'חסם עורק (TQ)', icon: '🩸' },
    { key: 'gauze', label: 'Gauze / QuikClot', icon: '🧻' },
    { key: 'morphine', label: 'מורפין / קטמין', icon: '💉' },
    { key: 'txa', label: 'TXA אמפולה', icon: '🧪' },
    { key: 'plasma', label: 'פלזמה', icon: '🩼' },
    { key: 'nacl', label: 'NaCl 500ml', icon: '💧' },
    { key: 'ketamine', label: 'קטמין', icon: '💉' },
    { key: 'other', label: 'אחר', icon: '➕' },
    { key: 'aed', label: 'דפיברילטור AED', icon: '⚡' }
  ];

  const status = casualty.treatmentStatus || {};

  return `
    <!-- Treatments -->
    <div class="sec">💉 טיפולים (${casualty.txList.length})</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:0 12px 8px;">
      <div style="font-weight:700;color:var(--olive3)">טיפולים זמינים: ${treatments.length}</div>
      <div style="font-weight:700;color:var(--green3)">בוצעו: ${Object.values(status).filter(Boolean).length}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:0 12px 8px;">
      ${treatments.map((t) => {
        const checked = status[t.key];
        const checkIcon = checked ? '✅' : '⚕️';
        return `<button class="btn btn-xs ${checked ? 'btn-olive' : 'btn-ghost'}" onclick="toggleCasualtyTreatment(${casualty.id}, '${t.key}', '${t.label}')">
          <span style="flex:1;text-align:left">${t.icon} ${t.label} ${checkIcon}</span>
          <span style="margin-left:8px;font-weight:900;">+</span>
        </button>`;
      }).join('')}
    </div>
    <div style="font-size:11px;color:var(--muted);margin:0 12px 8px;">
      <div style="margin-bottom:4px">הערה: מצב סמן תלוי בסימון טיפולים ידני.</div>
      ${casualty.txList.length ? casualty.txList.slice(-8).map((treatment) => `<div>${treatment.time} - ${treatment.type}</div>`).join('') : '<div>אין פרטי טיפול מוקלדים עדיין</div>'}
    </div>`;
}

export function buildFluidsSection(casualty, forceRoster) {
  const donors = casualty.blood
    ? forceRoster.filter((member) => member.blood && (BLOOD_COMPATIBILITY_MATRIX[member.blood] || []).includes(casualty.blood))
    : [];

  const donorHtml = !casualty.blood
    ? ''
    : !donors.length
      ? `<div style="margin:0 12px 8px;padding:6px 10px;background:rgba(180,30,30,.12);border-radius:7px;font-size:11px;color:var(--red3)">⚠ אין תורמי דם תואמים בכוח לסוג ${escapeHtml(casualty.blood)}</div>`
      : `<div style="margin:0 12px 8px;padding:6px 10px;background:rgba(30,90,30,.12);border-radius:7px;border:1px solid rgba(80,160,80,.25)">
        <div style="font-size:10px;color:var(--muted);margin-bottom:5px">🩸 תורמים תואמים לסוג ${escapeHtml(casualty.blood)}:</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${donors.map((member) => `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--s3);border-radius:5px;padding:3px 8px;font-size:11px"><span style="color:var(--green3);font-weight:700">${escapeHtml(member.blood)}</span> ${escapeHtml(member.name)}</span>`).join('')}
        </div>
      </div>`;

  return `
    <!-- Fluids -->
    <div class="sec">💧 נוזלים — <span style="color:var(--amber3);font-family:var(--font-mono)">${casualty.fluidTotal || 0}ml</span></div>
    ${donorHtml}`;
}

export function buildMedicationsSection(casualty, medications) {
  return `
    <!-- Medications -->
    <div class="sec">💊 תרופות — ⚖️ ${casualty.kg}kg</div>
    <div style="margin:0 12px 8px;background:var(--s2);border-radius:8px;overflow:hidden;border:1px solid var(--b0)">
      ${medications.map((medication) => `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--b0)">
        <div style="font-size:11px;font-weight:700;flex:1">${medication.n}</div>
        <div style="font-size:9px;color:var(--muted)">${medication.d}</div>
        <div style="font-size:11px;font-family:var(--font-mono);color:var(--amber3);min-width:45px;text-align:center">${medication.calc}</div>
        <button class="btn btn-xs btn-olive" onclick="recordTx(${casualty.id},'${medication.n}','${medication.alert}');renderDrawer(${casualty.id})">+</button>
      </div>`).join('')}
    </div>`;
}

export function buildAiDecisionSection(casualty, decisionHtml) {
  return `
    <!-- AI Decision -->
    <div class="sec">🤖 AI טריאז'</div>
    <div id="ai-dec-${casualty.id}" class="decision-box db-t${casualty.priority[1]}" style="margin:0 12px 8px">${decisionHtml}</div>`;
}

export function buildPrioritySection(casualty, priorityColors) {
  return `
    <!-- Priority change -->
    <div style="display:flex;gap:5px;margin:0 12px 8px">
      ${['T1', 'T2', 'T3', 'T4'].map((priority) => `<button class="btn btn-sm btn-full" style="background:${casualty.priority === priority ? priorityColors[priority] : 'transparent'};color:${casualty.priority === priority ? '#fff' : 'var(--muted2)'};border:${casualty.priority === priority ? '1px solid ' + priorityColors[priority] : 'none'}" onclick="changePriority(${casualty.id},'${priority}');renderDrawer(${casualty.id})">${priority}</button>`).join('')}
    </div>`;
}

export function buildEvacuationSection(casualty) {
  return `
    <!-- Evac Type -->
    <div style="display:flex;gap:5px;margin:0 12px 8px;align-items:center">
      <span style="font-size:10px;color:var(--muted);flex-shrink:0">🚁 סוג פינוי:</span>
      ${['רכוב', 'מוסק'].map((evacType) => `<button class="btn btn-xs ${casualty.evacType === evacType ? 'btn-olive' : 'btn-ghost'}" onclick="setEvacType(${casualty.id},'${evacType}');renderDrawer(${casualty.id})">${evacType === 'רכוב' ? '🚗' : '🚁'} ${evacType}</button>`).join('')}
      ${casualty.evacType ? '<button class="btn btn-xs btn-ghost" style="font-size:9px;border-color:var(--muted);color:var(--muted)" onclick="setEvacType(' + casualty.id + ',\'\');renderDrawer(' + casualty.id + ')">✕</button>' : ''}
    </div>`;
}

export function buildPhotosSection(casualty) {
  const recording = casualty.recordingAudio ? '⏹️ עצור הקלטה' : '🎙️ הקלט קול';
  return `
    <!-- Photos -->
    <div class="sec">📸 תיעוד</div>
    <div style="display:flex;gap:10px;margin:0 12px 12px;flex-wrap:wrap;align-items:center;width:100%">
      <label style="flex:1 1 50%;box-sizing:border-box;min-width:0;max-width:calc(50% - 5px);width:calc(50% - 5px);background:var(--s2);border:1px dashed var(--b1);border-radius:12px;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;gap:10px;min-height:52px;height:52px;padding:0 18px;white-space:nowrap;">
        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="addPhoto(${casualty.id},this)">
        📷 צלם
      </label>
      <button class="btn btn-xs ${casualty.recordingAudio ? 'btn-red' : 'btn-ghost'}" style="flex:1 1 50%;box-sizing:border-box;min-width:0;max-width:calc(50% - 5px);width:calc(50% - 5px);min-height:52px;height:52px;font-size:15px;padding:0 18px;display:flex;align-items:center;justify-content:center;white-space:nowrap;" onclick="recordAudio(${casualty.id})">${recording}</button>
      ${casualty.photos.map((photo) => `<img src="${photo.url}" style="width:52px;height:52px;object-fit:cover;border-radius:6px;border:1px solid var(--b1);cursor:pointer" onclick="viewPhoto('${photo.url}')">`).join('')}
      ${((casualty.audios || []).map((audio, i) => `
        <div style="display:flex;flex-direction:column;gap:4px;width:100%;max-width:18rem;">
          <audio controls style="width:100%;border-radius:8px;background:var(--s2)"><source src="${audio.url}" type="audio/webm"></audio>
          <span style="font-size:10px;color:var(--muted)">${audio.time}</span>
        </div>
      `).join(''))}
    </div>`;
}

export function buildActionsSection(casualty) {
  return `
    <!-- Action buttons -->
    <div class="sec">⚡ פעולות</div>
    <div class="d-actions">
      <button class="d-act-btn r" onclick="fireTQFor(${casualty.id});renderDrawer(${casualty.id})">🩹 TQ</button>
      <button class="d-act-btn a" onclick="addTXA(${casualty.id});renderDrawer(${casualty.id})">💉 TXA</button>
      <button class="d-act-btn o" onclick="openHospHandoff(${casualty.id})">🏥 Handoff</button>
    </div>
    <div class="d-actions" style="margin-top:4px">
      <button class="d-act-btn" onclick="tagGPS(${casualty.id})">📍 GPS</button>
      <button class="d-act-btn" onclick="openBuddyAssign(${casualty.id})">👤 Buddy</button>
    </div>
    <div class="d-actions" style="margin-top:4px">
      <button class="d-act-btn" onclick="toggleCasualtyTreatment(${casualty.id}, 'morphine', 'קטמין')">💉 קטמין</button>
      <button class="d-act-btn" onclick="toggleCasualtyTreatment(${casualty.id}, 'nacl', 'NaCl 500ml')">💧 NaCl</button>
    </div>
    <div class="d-actions" style="margin-top:4px">
      <button class="d-act-btn" onclick="openMedInteractions()">💊 תרופות</button>
      <button class="d-act-btn r" onclick="deleteCasualty(${casualty.id})">🗑 מחק</button>
    </div>`;
}

export function buildNotesSection(casualty) {
  return `
    <!-- Notes -->
    <div class="sec">📝 הערות</div>
    <div style="margin:0 12px 16px">
      <textarea class="other-note show" rows="3" placeholder="הערות חופשיות..." style="font-size:12px"
        onchange="S.casualties.find(x=>x.id==${casualty.id}).notes=this.value">${casualty.notes || ''}</textarea>
    </div>`;
}

export function initCasualtyDrawerSections() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.drawerSections = {
    buildQuickMarchSection,
    buildVitalsSection,
    buildAiDecisionSection,
    buildPrioritySection,
    buildEvacuationSection,
    buildTreatmentsSection,
    buildFluidsSection,
    buildMedicationsSection,
    buildPhotosSection,
    buildActionsSection,
    buildNotesSection,
  };
}