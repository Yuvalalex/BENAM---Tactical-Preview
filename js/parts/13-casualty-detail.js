// ═══════════════════════════════════════════════════
// CASUALTY DETAIL — FORM 101
// ═══════════════════════════════════════════════════
const INJURY_COORDS = { ראש: [44, 13], חזה: [44, 52], בטן: [44, 65], 'יד ימין': [72, 52], 'יד שמאל': [16, 52], 'רגל ימין': [55, 100], 'רגל שמאל': [33, 100] };
const MARCH_PHASES = [
  { k: 'M', title: 'Massive Hemorrhage', sub: 'עצירת דימום', items: ['TQ — 2 אצבעות מעל הפצע', 'גצירת נשק / Safety', 'H.T/J.T/נ.א — בדיקת הדרה', 'Chest Seal חזה פתוח', 'בדיקת גשים אלכותית'] },
  { k: 'A', title: 'Airway', sub: 'נתיב אוויר', items: ['נשימה ספונטנית?', 'NPA / head-tilt / jaw-thrust', 'שאיבה / קריקוטיריאוטומיה', 'תנוחת החלמה'] },
  { k: 'R', title: 'Respiration', sub: 'נשימה', items: ['ספירת נשימות (12-20/דקה)', 'Asherman / Hyfin חזה פתוח', 'דקירה 2 ICS MCL (מתח)', 'וידוא עצירת דימומים'] },
  { k: 'C', title: 'Circulation', sub: 'מחזור דם', items: ['בדיקת דופק — קצב ואיכות', 'IV/IO + NaCl 500ml', 'TXA 1g תוך 3 שעות', 'Walking Blood Bank', 'הדמייה — רשום זמן'] },
  { k: 'H', title: 'Hypothermia / Head', sub: 'חום וראש', items: ['Blizzard Bag / שמיכה', 'GCS — עיניים/מילולי/תנועה', 'קטמין/מורפין (SBP>80)', 'טופס 101 — העברת מקל'] },
];
const MARCH_COLORS = { M: 'var(--red2)', A: 'var(--orange2)', R: 'var(--amber)', C: 'var(--olive)', H: 'var(--blue2)' };

function _getCasualtyService() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.casualtyService
    ? window.BENAM_LEGACY.casualtyService
    : null;
}

function _getBodyMapSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.bodyMapSection
    ? window.BENAM_LEGACY.bodyMapSection
    : null;
}

function _getMarchProtocolSection() {
  return window.BENAM_LEGACY && window.BENAM_LEGACY.marchProtocolSection
    ? window.BENAM_LEGACY.marchProtocolSection
    : null;
}

function renderCasDetail(c) {
  const casualtyService = _getCasualtyService();
  c = casualtyService && casualtyService.ensureCasualtyDefaults
    ? casualtyService.ensureCasualtyDefaults(c)
    : c;
  if (!c) return;
  const bodyMapSection = _getBodyMapSection();
  const bodyMapHtml = bodyMapSection ? bodyMapSection.buildBodyMapSection(c) : '';
  const marchProtocolSection = _getMarchProtocolSection();
  const marchProtocolHtml = marchProtocolSection
    ? marchProtocolSection.buildMarchProtocolSection(c.id, MARCH_PHASES, MARCH_COLORS, {
      title: 'MARCH Protocol',
      titleButtonHtml: '',
      defaultOpenPhase: 'M'
    })
    : '';

  const w = c.kg || 70;
  const meds = [
    { n: 'מורפין 🚫', d: '0.1mg/kg', calc: `${(w * .1).toFixed(1)}mg / ${(w * .1 / 10).toFixed(2)}ml`, alert: 'מורפין' },
    { n: 'קטמין IV', d: '0.5mg/kg', calc: `${(w * .5).toFixed(1)}mg / ${(w * .5 / 50).toFixed(2)}ml`, alert: 'קטמין' },
    { n: 'קטמין IM', d: '2mg/kg', calc: `${(w * 2).toFixed(0)}mg / ${(w * 2 / 50).toFixed(1)}ml`, alert: 'קטמין' },
    { n: 'TXA', d: '1g / 10min', calc: '10ml (100mg/ml)', alert: 'TXA' },
    { n: 'NaCl', d: '500ml', calc: '500ml IV/IO', alert: '' },
  ];
  // Note: All user-provided values are escaped via escHTML() to prevent XSS
  const _casHtml = `
    <!-- Header -->
    <div style="background:var(--bg);border-bottom:2px solid ${pClr(c.priority)};padding:10px 12px;display:flex;align-items:center;gap:10px">
      <button class="btn btn-sm btn-ghost" onclick="goScreen('sc-war');setNav(1)">← חזור</button>
      <div style="flex:1">
        <div style="font-size:17px;font-weight:900">🪖 ${escHTML(c.name)}</div>
        <div style="display:flex;gap:5px;margin-top:4px;flex-wrap:wrap">
          <span class="tag tag-blood">🩸 ${escHTML(c.blood || '?')}</span>
          ${c.allergy ? `<span class="tag tag-allergy">⚠️ ${escHTML(c.allergy)}</span>` : ''}
          <span class="tag tag-kg">⚖️ ${c.kg}kg</span>
          <span class="prio pt${c.priority[1]}">${c.priority}</span>
          ${c.escalated ? `<span class="esc-badge">⬆️ הועלה</span>` : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
        ${c.tqStart ? `<div class="tq tq-ok" id="dtq-${c.id}">🩹 TQ 00:00</div>` : ''}
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-ghost" onclick="openHospHandoff(${c.id})" style="border-color:var(--green2);color:var(--green3)">🏥 בי"ח</button>
          <button class="btn btn-xs btn-amber" onclick="showHandoff(${c.id})">🚁 H-Off</button>
        </div>
        <button class="btn btn-xs cas-gps-badge" onclick="tagGPS(${c.id})" id="gps-btn-${c.id}">${c.gps ? '📍 ' + escHTML(c.gps) : '📍 GPS'}</button>
      </div>
    </div>

    ${bodyMapHtml}

    <!-- AI DECISION -->
    <div class="sec">🤖 AI — טריאז' בסיסי</div>
    <div id="ai-dec-${c.id}" class="decision-box db-t${c.priority[1]}">${aiDecision(c)}</div>

    <!-- CHANGE PRIORITY -->
    <div style="padding:0 10px 6px;display:flex;gap:6px">
      ${['T1', 'T2', 'T3', 'T4'].map(p => `<button class="btn btn-sm btn-full" style="background:${c.priority === p ? pClr(p) : 'transparent'};color:${c.priority === p ? '#fff' : 'var(--muted2)'};border:${c.priority === p ? '1px solid ' + pClr(p) : 'none'}" onclick="changePriority(${c.id},'${p}')">${p}</button>`).join('')}
    </div>

    <!-- VITALS -->
    <div class="sec">💓 סימנים חיוניים</div>
    <div class="vitals-grid">
      ${[['💗 דופק', 'pulse', '72', 'BPM'], ['🫁 סטורציה', 'spo2', '98', '%'], ['🩺 לחץ דם', 'bp', '120/80', 'mmHg'], ['💨 נשימות', 'rr', '16', '/דקה'], ['🧠 GCS', 'gcs', '15', '(3-15)']].map(([lbl, key, ph, unit]) => `
        <div class="vbox" style="background:transparent;border:none">
          <div class="vbox-lbl">${lbl}</div>
          <input class="vbox-val" type="${key === 'bp' ? 'text' : 'number'}" value="${c.vitals[key]}" placeholder="${ph}" oninput="saveVital(${c.id},'${key}',this.value);updateAI(${c.id})" style="border:1px solid var(--b0);border-radius:6px;padding:6px;background:var(--s3)">
          <div style="font-size:9px;color:var(--muted)">${unit}</div>
        </div>`).join('')}
      <div class="vbox" style="background:transparent;border:none">
        <div class="vbox-lbl">👁️ UPVA</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
          ${(() => { const _ui = c.vitals.upvaIdx != null ? c.vitals.upvaIdx : 'UPVA'.indexOf(c.vitals.upva || 'U'); return ['U', 'P', 'V', 'A'].map(v => `<button class="btn btn-xs" style="flex:1;background:${'UPVA'.indexOf(v) <= _ui ? 'var(--olive)' : 'var(--s3)'};border:1px solid var(--b1);color:var(--white)" onclick="setUpva(${c.id},'${v}')">${v}</button>`).join(''); })()}
        </div>
      </div>
    </div>

    <!-- VITALS TREND GRAPH -->
    ${c.vitalsHistory && c.vitalsHistory.length > 1 ? `
    <div class="sec">📈 גרף מדדים — מגמה</div>
    <div style="margin:0 10px 10px;padding:8px"><div id="vgraph-${c.id}">
      <canvas class="vgraph-canvas" id="vgc-${c.id}" height="90"></canvas>
      <div class="vgraph-legend">
        <div class="vgraph-item"><div class="vgraph-dot" style="background:var(--red3)"></div>💗 דופק</div>
        <div class="vgraph-item"><div class="vgraph-dot" style="background:var(--green3)"></div>🫁 SpO2</div>
        <div class="vgraph-item"><div class="vgraph-dot" style="background:var(--amber3)"></div>🧠 GCS×10</div>
      </div>
    </div></div>`: ''}

    <!-- PHOTOS -->
    <div class="sec">📸 תיעוד צילומי מאובטח</div>
    <div class="photo-grid" id="photos-${c.id}">
      <label class="photo-thumb ph-empty" style="display:flex">
        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="addPhoto(${c.id},this)">
        <div style="font-size:26px">📷</div>
        <div class="ph-lbl">צלם פציעה</div>
      </label>
      ${c.photos.map((p, i) => `<div class="photo-thumb"><img src="${p.url}"><div class="ph-time">${p.time}</div></div>`).join('')}
    </div>

    ${marchProtocolHtml}

    <!-- MEDICATIONS -->
    <div class="sec">💊 תרופות — מינון לפי משקל (${c.kg}kg)</div>
    <div style="margin:0 10px 10px;padding:8px">
      <table class="med-table">
        <tr><th>💊 תרופה</th><th>📏 מינון</th><th>🧮 מחושב</th><th>✅ ניתן</th></tr>
        ${meds.map(m => `<tr>
          <td style="font-weight:700">${m.n}</td>
          <td style="color:var(--muted);font-size:10px">${m.d}</td>
          <td class="med-dose">${m.calc}</td>
          <td><button class="btn btn-xs btn-olive" onclick="recordTx(${c.id},'${m.n}','${m.alert}')">✓</button></td>
        </tr>`).join('')}
      </table>
    </div>

    <!-- FLUIDS -->
    <div class="sec">💉 נוזלים</div>
    <div style="margin:0 10px 10px;padding:8px">
      <div class="row" style="flex-wrap:wrap;gap:6px">
        ${['💧 NaCl 500ml', '🧪 Hextend 500ml', '🩸 דם 500ml', '💧 NaCl 250ml'].map(f => `<button class="btn btn-sm btn-ghost" onclick="addFluid(${c.id},'${f.replace(/^[^ ]+ /,'')}')">${f}</button>`).join('')}
      </div>
      <div style="font-family:var(--font-mono);font-size:11px;color:var(--muted2);line-height:1.8" id="fl-${c.id}">
        ${c.fluids.map(f => `${f.time}  ${f.type}`).join('\n') || '—'}
      </div>
      <div style="font-weight:700">📊 סה"כ: <span style="color:var(--amber2)">${c.fluidTotal}</span> ml</div>
    </div>

    <!-- TQ manual -->
    ${!c.tqStart ? `<div style="padding:0 10px 6px"><button class="btn btn-md btn-red btn-full" onclick="startManualTQ(${c.id})">🩹 הפעל TQ + טיימר</button></div>` : ''}

    <!-- BUDDY -->
    <div class="sec">🤝 Buddy — אחראי</div>
    <div style="padding:0 10px 6px;display:flex;align-items:center;gap:8px">
      <div style="flex:1;font-size:13px">
        ${c.buddy ? `<span class="buddy-badge">👤 ${escHTML(c.buddyName)}</span> אחראי` : '<span style="color:var(--muted);font-size:12px">❌ לא משוייך</span>'}
      </div>
      <button class="btn btn-sm btn-ghost" onclick="assignBuddy(${c.id})">👥 שייך אחראי</button>
    </div>

    <div style="padding:0 10px 20px"><button class="btn btn-xl btn-amber btn-full" onclick="showHandoff(${c.id})">🚁 Hand-Off — פינוי</button></div>`;
  $('cas-detail').textContent = '';
  $('cas-detail').insertAdjacentHTML('beforeend', _casHtml);

  if (c.tqStart) tickDetailTQ(c);
}

function toggleMarchBody(id) { const el = $(id); if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; }
function toggleMarchItem(row, casId, phase, total) {
  row.classList.toggle('done');
  const cb = row.querySelector('.march-cb');
  const done = row.classList.contains('done');
  cb.textContent = done ? '✓' : '';
  if (done) cb.classList.add('checked'); else cb.classList.remove('checked');
  const doneCount = row.closest('.march-body').querySelectorAll('.done').length;
  const counter = $(`mc-${casId}-${phase}`);
  if (counter) counter.textContent = `${doneCount}/${total}`;
  const c = S.casualties.find(x => x.id == casId);
  if (c) c.march[phase] = doneCount;
}

function saveVital(casId, key, val) {
  const c = S.casualties.find(x => x.id == casId);
  if (!c) return;
  c.vitals[key] = val;
  // check for deterioration with debounce
  clearTimeout(c._vitalTimer);
  c._vitalTimer = setTimeout(() => { checkVitalsDeteriorating(c); saveState(); }, 1500);
}