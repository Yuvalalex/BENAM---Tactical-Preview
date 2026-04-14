// ═══════════════════════════════════════════════════
function openClosingProtocol() {
  $('closing-overlay').classList.add('on');
  renderClosingProtocol();
}

const CLOSING_STEPS = [
  { id: 'cas-status', title: 'אשר סטטוס כל הפגועים', body: 'עבור על כל פגוע — ודא שכולם מטופלים, מפונים או מסומנים כ-T4. אל תשאיר פגוע ללא סטטוס.', check: () => S.casualties.every(c => c.closeConfirmed) },
  { id: 'tq-check', title: 'בדיקת TQ — כל החוסמים', body: 'ודא שכל TQ פתוח תועד עם שעת שים. פגוע עם TQ מעל 60 דקות — עדכן בי"ח מיידית.', check: () => !S.casualties.some(c => c.tqStart && !c.tqDocumented) },
  { id: 'supply-count', title: 'ספירת ציוד שנוצל', body: 'ספור TQ, Chest Seals, TXA שנוצלו — עדכן בטופס AAR. ודא מלאי לאירוע הבא.', check: () => true },
  { id: 'evac-confirm', title: 'אשר פינוי — מי עלה', body: 'ודא שכל פגוע שפונה מצוין כ"פונה". בדוק מול סלוטי הפינוי.', check: () => true },
  { id: '101-forms', title: 'טפסי 101 — הפקת מסמכים', body: 'הפק טופס 101 לכל פגוע שפונה. ודא שכל שדה מלא — שם, מ.א., סוג דם, טיפולים.', check: () => true },
  { id: 'timeline-lock', title: 'נעל ציר זמן', body: 'הוסף הערות סיום לציר הזמן. תעד שעת סגירת אירוע.', check: () => true },
  { id: 'debrief', title: 'תחקיר ראשוני — 3 דקות', body: 'שאל את הצוות: מה עבד? מה לא עבד? מה היינו עושים אחרת? רשום בהערות AAR.', check: () => true },
  { id: 'aar-gen', title: 'הפק AAR מלא', body: 'לחץ "צור AAR" → שלח לקצין הרפואה. כולל זמני תגובה, פגועים, ציוד, לקחים.', check: () => true },
];
let _clDone = new Set();
function renderClosingProtocol() {
  const done = _clDone.size;
  $('cl-done-count').textContent = `${done}/${CLOSING_STEPS.length}`;
  $('cl-body').innerHTML = CLOSING_STEPS.map((step, i) => {
    const isDone = _clDone.has(step.id);
    return `<div class="cl-step ${isDone ? 'done' : ''}" onclick="toggleClStep('${step.id}')">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:28px;flex-shrink:0">${isDone ? '✅' : '⬜'}</div>
        <div style="flex:1">
          <div class="cl-step-num">שלב ${i + 1}</div>
          <div class="cl-step-title" style="color:${isDone ? 'var(--green3)' : '#fff'}">${step.title}</div>
          <div class="cl-step-body">${step.body}</div>
          ${step.id === '101-forms' ? `<button class="btn btn-xs btn-olive" style="margin-top:6px" onclick="event.stopPropagation();openForm101()">📄 פתח טופס 101</button>` : ''}
          ${step.id === 'evac-confirm' ? `<button class="btn btn-xs btn-olive" style="margin-top:6px" onclick="event.stopPropagation();genEvacReport()">🚁 דוח פינוי</button>` : ''}
          ${step.id === 'aar-gen' ? `<button class="btn btn-xs btn-olive" style="margin-top:6px" onclick="event.stopPropagation();genAAR();goScreen('sc-stats');setNav(2)">📊 צור AAR</button>` : ''}
          ${step.id === 'cas-status' && S.casualties.length ? `<div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
            ${S.casualties.map(c => `<div style="display:flex;align-items:center;gap:8px;font-size:11px">
              <button onclick="event.stopPropagation();c_confirmClose(${c.id})" style="width:22px;height:22px;border-radius:4px;border:2px solid var(--b1);background:${c.closeConfirmed ? 'var(--green2)' : 'transparent'};cursor:pointer;font-size:12px">${c.closeConfirmed ? '✓' : ''}</button>
              <span class="prio pt${c.priority[1]}">${c.priority}</span>
              <span style="font-weight:700">${escHTML(c.name)}</span>
              <span style="color:var(--muted)">${c.closeConfirmed ? '✓ אושר' : 'ממתין'}</span>
            </div>`).join('')}
          </div>`: ''}
        </div>
      </div>
    </div>`;
  }).join('') +
    (_clDone.size === CLOSING_STEPS.length ? `<div style="background:var(--green);border-radius:10px;padding:20px;text-align:center;margin-top:8px">
    <div style="font-size:32px">✅</div>
    <div style="font-size:18px;font-weight:900;color:var(--white);margin-top:8px">אירוע סגור בהצלחה</div>
    <div style="font-size:12px;color:var(--muted2);margin-top:4px">כל הצ'קים עברו — מצוין!</div>
    <button class="btn btn-lg btn-ghost" style="margin-top:12px" onclick="$('closing-overlay').classList.remove('on');APP_MODE='post';updateNavMode();genAAR();">סגור → תחקיר</button>
  </div>`: '');
}
function toggleClStep(id) { _clDone.has(id) ? _clDone.delete(id) : _clDone.add(id); renderClosingProtocol(); }
function c_confirmClose(casId) { const c = S.casualties.find(x => x.id == casId); if (c) { c.closeConfirmed = !c.closeConfirmed; renderClosingProtocol(); } }

// ═══════════════════════════════════════════════════
// 📋 FORM 101 — PDF
// ═══════════════════════════════════════════════════
function openForm101() {
  $('f101-overlay').style.display = 'block';
  const pick = $('f101-pick');
  if (!S.casualties.length) { pick.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px">אין פגועים</div>'; $('f101-content').innerHTML = ''; return; }
  pick.innerHTML = S.casualties.map(c => `
    <button class="btn btn-md btn-ghost btn-full" style="justify-content:flex-start;gap:8px" onclick="render101(${c.id})">
      <span class="prio pt${c.priority[1]}">${c.priority}</span>
      <span style="font-weight:700">${escHTML(c.name)}</span>
      <span style="font-size:10px;color:var(--muted)">🩸${escHTML(c.blood || '?')} · ${c.kg}kg</span>
    </button>`).join('');
  if (S.casualties.length === 1) render101(S.casualties[0].id);
}
function render101(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const tqMin = c.tqStart ? Math.floor((Date.now() - c.tqStart) / 60000) : null;
  const pClrMap = { T1: '#c00', T2: '#e80', T3: '#080', T4: '#222' };
  $('f101-content').innerHTML = `
    <div class="f101-page" id="f101-print-${casId}">
      <div class="f101-header">
        <div style="height:8px;background:${pClrMap[c.priority]};border-radius:3px;margin-bottom:8px"></div>
        <div class="f101-title">טופס 101 — דו"ח רפואי שדה</div>
        <div class="f101-sub">IDF Field Medical Report · BENAM Tactical System</div>
        <div class="f101-sub">${nowTime()} · ${escHTML(S.comms.unit || 'יחידה לא צוינה')}</div>
      </div>

      <div class="f101-grid">
        <div class="f101-cell"><div class="f101-lbl">שם מלא</div><div class="f101-val">${escHTML(c.name)}</div></div>
        <div class="f101-cell"><div class="f101-lbl">מספר אישי</div><div class="f101-val">${escHTML(c.idNum || '—')}</div></div>
        <div class="f101-cell"><div class="f101-lbl">סוג דם</div><div class="f101-val" style="color:${pClrMap.T1}">${escHTML(c.blood || 'לא ידוע')}</div></div>
        <div class="f101-cell"><div class="f101-lbl">משקל</div><div class="f101-val">${c.kg} ק"ג</div></div>
        <div class="f101-cell"><div class="f101-lbl">אלרגיה</div><div class="f101-val" style="color:${c.allergy ? '#c00' : '#080'}">${escHTML(c.allergy || 'ללא')}</div></div>
        <div class="f101-cell"><div class="f101-lbl">עדיפות</div><div class="f101-val" style="color:${pClrMap[c.priority]};font-size:16px">${c.priority}</div></div>
      </div>

      <div class="f101-section">
        <div class="f101-sec-hdr">מנגנון פציעה ותיאור</div>
        <div class="f101-body">
          <div><strong>מנגנון:</strong> ${c.mech.join(', ') || 'לא צוין'}</div>
          <div><strong>פציעות:</strong> ${c.injuries.length ? c.injuries.map(i => `<span style="display:inline-flex;align-items:center;gap:2px;margin:1px 3px"><span style="width:8px;height:8px;border-radius:50%;background:${injTypeColor(i.type)};display:inline-block"></span>${i.type} — ${i.zone} <small style="color:#888">(${i.side === 'back' ? 'אחורי' : 'קדמי'})</small></span>`).join('') : 'לא תועד'}</div>
          <div><strong>שעת פציעה:</strong> ${c.time}</div>
        </div>
      </div>

      ${c.injuries.length ? `<div class="f101-section">
        <div class="f101-sec-hdr">מפת פציעות — Body Map</div>
        <div class="f101-body" style="text-align:center">${typeof renderInjuryBodyMap === 'function' ? renderInjuryBodyMap(c.injuries) : ''}</div>
      </div>`: ''}

      ${c.photos && c.photos.length ? `<div class="f101-section">
        <div class="f101-sec-hdr">📷 תמונות</div>
        <div class="f101-body" style="display:flex;flex-wrap:wrap;gap:6px">
          ${c.photos.map(p => `<img src="${p}" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ccc">`).join('')}
        </div>
      </div>`: ''}

      <div class="f101-section">
        <div class="f101-sec-hdr">מדדים חיוניים</div>
        <div class="f101-body" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${[['דופק', c.vitals.pulse, 'bpm'], ['SpO2', c.vitals.spo2, '%'], ['GCS', c.vitals.gcs, '/15'], ['לחץ דם', c.vitals.bp, 'mmHg'], ['נשימות', c.vitals.rr, '/דקה'], ['UPVA', c.vitals.upva, '']].map(([l, v, u]) => `<div><div class="f101-lbl">${l}</div><div style="font-size:14px;font-weight:700">${v || '—'} <small style="font-weight:400;color:#666">${u}</small></div></div>`).join('')}
        </div>
        ${c.vitalsHistory && c.vitalsHistory.length ? `<div style="margin-top:6px;font-size:9px;color:#666">Snapshots: ${c.vitalsHistory.map(s => `${s.t}: P${s.pulse} S${s.spo2}% G${s.gcs}`).join(' | ')}</div>` : ''}
      </div>

      <div class="f101-section">
        <div class="f101-sec-hdr">טיפולים שניתנו</div>
        <div class="f101-body">
          ${c.txList.length ? c.txList.map(t => `<div>• ${t.type} — ${t.time}</div>`).join('') : '<div>לא ניתן טיפול</div>'}
          ${tqMin !== null ? `<div style="color:${tqMin > 45 ? '#c00' : '#080'};font-weight:700">• TQ — ${tqMin} דקות (${c.time})</div>` : ''}
          ${c.fluidTotal ? `<div>• נוזלים: ${c.fluidTotal} ml</div>` : ''}
        </div>
      </div>

      <div class="f101-section">
        <div class="f101-sec-hdr">MARCH — סיכום</div>
        <div class="f101-body" style="display:flex;gap:16px;flex-wrap:wrap">
          ${Object.entries(c.march || {}).map(([k, v]) => `<div><strong>${k}:</strong> ${v} פעולות</div>`).join('')}
        </div>
      </div>

      ${c.notes ? `<div class="f101-section"><div class="f101-sec-hdr">הערות</div><div class="f101-body">${c.notes}</div></div>` : ''}
      ${c.gps ? `<div class="f101-section"><div class="f101-sec-hdr">מיקום GPS</div><div class="f101-body" style="font-family:monospace">${escHTML(c.gps)}</div></div>` : ''}

      <div class="f101-sig">
        <div class="f101-sig-box"><div class="f101-sig-lbl">חובש מטפל — חתימה</div></div>
        <div class="f101-sig-box"><div class="f101-sig-lbl">מפקד — אישור</div></div>
        <div class="f101-sig-box"><div class="f101-sig-lbl">שעת העברה לבי"ח</div></div>
      </div>

      <div style="text-align:center;font-size:9px;color:#888;margin-top:12px;border-top:1px solid #ccc;padding-top:6px">
        BENAM Tactical Medical System · ${new Date().toLocaleString('he-IL')} · מסמך רפואי-משפטי
      </div>
    </div>`;
}
function print101() {
  const content = $('f101-content').innerHTML;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>טופס 101</title><style>
    *{margin:0;padding:0;box-sizing:border-box;}body{background:#fff;font-family:Arial,sans-serif;font-size:11px;}
    .f101-page{padding:20px;max-width:600px;margin:0 auto;}.f101-header{text-align:center;border-bottom:3px solid #000;padding-bottom:8px;margin-bottom:12px;}
    .f101-title{font-size:18px;font-weight:900;}.f101-sub{font-size:10px;color:#444;}
    .f101-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:8px;}
    .f101-cell{padding:5px 8px;border-bottom:1px solid #ccc;border-left:1px solid #ccc;}
    .f101-cell:nth-child(odd){border-left:none;}.f101-lbl{font-size:9px;color:#666;font-weight:700;text-transform:uppercase;}
    .f101-val{font-size:12px;font-weight:700;}.f101-section{border:1px solid #000;margin-bottom:8px;}
    .f101-sec-hdr{background:#000;color:#fff;padding:4px 8px;font-size:10px;font-weight:700;}.f101-body{padding:8px;}
    .f101-sig{display:flex;gap:20px;margin-top:16px;padding-top:8px;border-top:1px solid #000;}
    .f101-sig-box{flex:1;border-bottom:1px solid #000;min-height:40px;padding-bottom:4px;}
    .f101-sig-lbl{font-size:9px;color:#666;margin-top:3px;}@media print{@page{margin:10mm;}}
  </style></head><body>${content}</body></html>`);
  w.document.close(); w.focus(); w.print();
}

// ═══════════════════════════════════════════════════
// 📊 PERFORMANCE ANALYTICS
// ═══════════════════════════════════════════════════
function openPerformance() {
  $('perf-overlay').style.display = 'block';
  renderPerformance();
}
function renderPerformance() {
  const pb = $('perf-body'); if (!pb) return;
  if (!S.casualties.length && !S.timeline.length) { pb.innerHTML = '<div style="color:var(--muted);text-align:center;padding:30px">אין נתונים עדיין</div>'; return; }
  const now = Date.now();
  const dur = S.missionStart ? Math.floor((now - S.missionStart) / 60000) : 0;
  const t1c = S.casualties.filter(c => c.priority === 'T1').length;
  const treated = S.casualties.filter(c => c.txList.length > 0).length;
  const tqList = S.casualties.filter(c => c.tqStart);
  const avgTQ = tqList.length ? Math.floor(tqList.reduce((s, c) => s + (now - c.tqStart) / 60000, 0) / tqList.length) : 0;
  const escalated = S.casualties.filter(c => c.escalated).length;
  const withVH = S.casualties.filter(c => c.vitalsHistory && c.vitalsHistory.length > 0);

  // time-to-first-tx per casualty
  const ttfx = S.casualties.filter(c => c.txList.length && c._addedAt).map(c => {
    const firstTx = S.timeline.find(e => e.casId == c.id && e.text && e.text !== `פגוע חדש — ${c.priority} — ${c.mech.join(', ')}`);
    return firstTx ? Math.floor((firstTx.ms || 0) - (c._addedAt || 0)) / 60000 : null;
  }).filter(v => v !== null && v >= 0);
  const avgTTFX = ttfx.length ? Math.floor(ttfx.reduce((a, b) => a + b, 0) / ttfx.length) : null;

  pb.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      ${[
      ['⏱', 'זמן אירוע', dur + ' דקות', dur > 90 ? 'var(--amber3)' : 'var(--green3)'],
      ['🔴', 'T1 פגועים', t1c, 'var(--red3)'],
      ['💊', 'קיבלו טיפול', treated + '/' + S.casualties.length, treated === S.casualties.length ? 'var(--green3)' : 'var(--amber3)'],
      ['⬆', 'הוחמרו T2→T1', escalated, escalated > 0 ? 'var(--red3)' : 'var(--green3)'],
      ['⏱', 'TQ ממוצע', avgTQ + ' דקות', avgTQ > 30 ? 'var(--amber3)' : 'var(--green3)'],
      ['💉', 'TXA ניתנו', S.casualties.filter(c => c.txList.some(t => t.type.includes('TXA'))).length, 'var(--olive3)'],
    ].map(([ico, lbl, val, clr]) => `
        <div class="perf-card">
          <div class="perf-metric" style="color:${clr}">${val}</div>
          <div class="perf-lbl">${ico} ${lbl}</div>
        </div>`).join('')}
    </div>

    ${avgTTFX !== null ? `<div class="perf-card">
      <div class="perf-lbl">⚡ ממוצע זמן עד טיפול ראשון</div>
      <div class="perf-metric" style="color:${avgTTFX < 5 ? 'var(--green3)' : avgTTFX < 10 ? 'var(--amber3)' : 'var(--red3)'}">${avgTTFX.toFixed(1)} דקות</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:4px">יעד: פחות מ-5 דקות מרגע הפגיעה</div>
    </div>`: ''}

    <div class="sec" style="padding:8px 0 4px">ציר זמן תגובה לכל פגוע</div>
    ${S.casualties.map(c => {
      const age = c._addedAt ? Math.floor((now - c._addedAt) / 60000) : 0;
      const txCount = c.txList.length;
      const pct = Math.min(1, txCount / 5);
      return `<div class="perf-card" style="padding:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
          <span class="prio pt${c.priority[1]}">${c.priority}</span>
          <span style="font-weight:700;flex:1">${escHTML(c.name)}</span>
          <span style="font-size:10px;color:var(--muted)">${age} דקות</span>
        </div>
        <div class="perf-bar-wrap">
          <div class="perf-bar" style="width:${pct * 100}%;background:${pct < 0.3 ? 'var(--red2)' : pct < 0.7 ? 'var(--amber)' : 'var(--green2)'}"></div>
        </div>
        <div style="font-size:9px;color:var(--muted2);margin-top:3px">${txCount} טיפולים · ${c.vitalsHistory?.length || 0} snapshots</div>
        <div class="timeline-micro">${S.timeline.filter(e => e.casId == c.id).map(e => e.time + ' ' + e.text).join(' → ') || 'אין פעולות'}</div>
      </div>`;
    }).join('')}

    <div class="perf-card">
      <div class="perf-lbl">📋 לקחים אוטומטיים</div>
      <div style="margin-top:6px;display:flex;flex-direction:column;gap:4px;font-size:11px;line-height:1.7">
        ${avgTQ > 45 ? `<div style="color:var(--red3)">⚠ TQ ממוצע גבוה מ-45 דקות — שקול שחרור מוקדם יותר</div>` : ''}
        ${escalated > 0 ? `<div style="color:var(--amber3)">⚡ ${escalated} פגועים הוחמרו — חזק מעקב ויטלים תדיר יותר</div>` : ''}
        ${treated < S.casualties.length ? `<div style="color:var(--red3)">⚠ ${S.casualties.length - treated} פגועים ללא טיפול — בדוק מיד</div>` : ''}
        ${avgTTFX && avgTTFX > 10 ? `<div style="color:var(--amber3)">🕐 זמן לטיפול ראשון ארוך — שקול שיפור חלוקת חובשים</div>` : ''}
        ${S.casualties.filter(c => !c.vitals.pulse).length > 0 ? `<div style="color:var(--muted2)">📊 ויטלים חסרים ב-${S.casualties.filter(c => !c.vitals.pulse).length} פגועים — עדכן ל-AAR</div>` : ''}
        <div style="color:var(--green3)">✓ מגמה כוללת: ${treated}/${S.casualties.length} פגועים טופלו תוך ${dur} דקות</div>
      </div>
    </div>`;
}
function genEvacReport() {
  const evacList = S.casualties.filter(c => c.evacuated || (c.evacPipeline && c.evacPipeline.stage === 'done'));
  if (!evacList.length) {
    showToast('⚠️ אין פגועים שפונו לתיעוד');
    return;
  }

  try {
    const report = evacList.map((c, i) => {
      const treatments = c.txList.map(t => t.type).join(', ');
      return `פצוע ${i + 1}: ${c.name} (${c.priority})\nמצב: ${c.vitals.pulse || '?'}/${c.vitals.spo2 || '?'}\nטיפול: ${treatments || 'בסיסי'}\n---`;
    }).join('\n');

    openModal('🚁 דו"ח פינוי מסכם', `
      <div class="pad col" style="gap:12px">
        <div style="font-size:12px;color:var(--muted);line-height:1.6">סיכום פגועים לפינוי (Copy-Paste לקשר / ווטסאפ):</div>
        <textarea class="inp" style="height:200px;font-family:monospace;font-size:11px;background:#000" id="evac-report-tx" readonly>${report}</textarea>
        <div style="display:flex;gap:8px">
          <button class="btn btn-lg btn-olive" style="flex:1" onclick="copyToClipboard(document.getElementById('evac-report-tx').value)">העתק 📋</button>
          <button class="btn btn-lg btn-ghost" style="flex:1" onclick="closeModal()">סגור</button>
        </div>
      </div>
    `);
  } catch (e) {
    console.error(e);
    showToast('❌ שגיאה בהפקת דוח פינוי');
  }
}

if (typeof window !== 'undefined') {
  window.genEvacReport = genEvacReport;
  window.openForm101 = openForm101;
  window.render101 = render101;
  window.print101 = print101;
  // genAAR is defined in 15-handoff-reports.js — just reference it directly, no wrapper
  // (a wrapper would cause infinite recursion since genAAR resolves to window.genAAR)
}
