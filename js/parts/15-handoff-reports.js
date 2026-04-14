// ═══════════════════════════════════════════════════
// HAND-OFF
// ═══════════════════════════════════════════════════
function openHandoffPick() {
  if (!S.casualties.length) { showToast('אין פצועים'); return; }
  openModal('בחר פצוע לפינוי', `
    <div class="pad col">
      ${S.casualties.map(c => `<button class="btn btn-lg btn-ghost btn-full" style="justify-content:flex-start;gap:10px;border-color:${pClr(c.priority)}" onclick="showHandoff(${c.id});forceClose()">
        <span class="prio pt${c.priority[1]}">${c.priority}</span> ${escHTML(c.name)} <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
      </button>`).join('')}
    </div>`);
}
function showHandoff(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  $('ho-name').textContent = c.name;
  $('ho-blood').textContent = c.blood || '?';
  const al = $('ho-allergy');
  if (c.allergy) { al.textContent = '⚠ אלרגי: ' + c.allergy; al.style.display = ''; } else al.style.display = 'none';
  $('ho-tx').textContent = c.txList.length ? c.txList.map(t => `${t.type} @ ${t.time}`).join('\n') : 'אין טיפולים';
  const tqEl = $('ho-tq');
  if (c.tqStart) { tqEl.textContent = `⏱ TQ: ${Math.floor((Date.now() - c.tqStart) / 60000)} דקות`; tqEl.style.display = ''; } else tqEl.style.display = 'none';
  $('handoff-screen').classList.add('on');
}

// ═══════════════════════════════════════════════════
// BLOOD BANK
// ═══════════════════════════════════════════════════
function renderBloodScreen() {
  const all = [...S.force, ...S.casualties].filter(f => f.blood);
  const btnsHtml = all.map(f => `
    <button class="btn btn-md btn-ghost btn-full" onclick="showDonors('${escHTML(f.blood)}','${escHTML(f.name)}')" style="justify-content:flex-start;gap:10px">
      <span class="tag tag-blood">${escHTML(f.blood)}</span> ${escHTML(f.name)}
    </button>`).join('') || '<div style="color:var(--muted);font-size:12px;padding:8px">הוסף לוחמים תחילה</div>';
  const _brb = $('blood-recip-btns'); if (_brb) _brb.textContent = '', _brb.insertAdjacentHTML('afterbegin', btnsHtml);
  const rosterHtml = S.force.map(f => `
    <div class="donor-row">
      <div class="donor-av">${initials(f.name)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">${escHTML(f.name)}</div><div style="font-size:10px;color:var(--muted)">${f.role || ''}</div></div>
      <span class="tag tag-blood" style="font-size:12px;padding:4px 10px">${escHTML(f.blood || '?')}</span>
    </div>`).join('') || '<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">אין לוחמים</div>';
  const _br = $('blood-roster'); if (_br) _br.textContent = '', _br.insertAdjacentHTML('afterbegin', rosterHtml);
}
function showDonors(recipBlood, recipName) {
  $('blood-results').style.display = '';
  $('blood-recip-name').textContent = `${recipName} [${recipBlood}]`;
  const compatible = BLOOD_COMPAT;
  $('donors-list').innerHTML = S.force.map(f => {
    if (!f.blood) return '';
    const canGive = (compatible[f.blood] || []).includes(recipBlood);
    const perfect = f.blood === recipBlood;
    return `<div class="donor-row" style="opacity:${canGive ? 1 : .35}">
      <div class="donor-av" style="border-color:${perfect ? 'var(--green2)' : canGive ? 'var(--amber)' : 'var(--b1)'}">${initials(f.name)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">${escHTML(f.name)}</div><div style="font-size:10px;color:var(--muted)">${escHTML(f.blood)} — ${f.kg}kg</div></div>
      <span class="${perfect ? 'dm-perfect' : canGive ? 'dm-ok' : 'dm-no'}">${perfect ? '✓ מושלם' : canGive ? '✓ תואם' : '✗ לא תואם'}</span>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════
// 📊 STATUS REPORT — for MCE commander
// ═══════════════════════════════════════════════════
function openStatusReport() {
  const now = Date.now();
  const elapsed = S.missionStart ? Math.floor((now - S.missionStart) / 60000) : 0;
  const t1 = S.casualties.filter(c => c.priority === 'T1');
  const t2 = S.casualties.filter(c => c.priority === 'T2');
  const t3 = S.casualties.filter(c => c.priority === 'T3');
  const t4 = S.casualties.filter(c => c.priority === 'T4');
  const allActive = S.casualties.filter(c => c.priority !== 'T4');
  const withMedic = allActive.filter(c => c.medic);
  const withTQ = allActive.filter(c => c.tqStart);
  const medics = (S.force || []).filter(f => f && getMedicLevel(f.role) > 0);
  const ghMin = S.missionStart ? 60 - elapsed : 60;
  const ghColor = ghMin <= 0 ? 'var(--red3)' : ghMin <= 10 ? 'var(--amber3)' : 'var(--green3)';

  // Build evac order
  const evacRanked = [...allActive].sort((a, b) => calcEvacScore(b) - calcEvacScore(a));
  const evacHtml = evacRanked.length ? evacRanked.map((c, i) => {
    const ev = c.evacType ? ` ${c.evacType === 'מוסק' ? '🚁' : '🚗'}` : ''
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid rgba(30,50,80,.3)">
      <span style="font-family:var(--font-mono);font-size:16px;font-weight:900;color:${i === 0 ? 'var(--red3)' : i === 1 ? 'var(--amber3)' : 'var(--muted2)'};min-width:20px">${i + 1}</span>
      <span class="prio pt${c.priority[1]}" style="font-size:9px">${c.priority}</span>
      <span style="font-size:12px;font-weight:700;flex:1">${escHTML(c.name)}</span>
      <span style="font-size:9px;color:var(--muted2)">${escHTML(c.medic || 'ללא מטפל')}${ev}</span>
    </div>`;
  }).join('') : '<div style="font-size:11px;color:var(--muted)">אין פגועים</div>';

  openModal('📊 דוח מצב — מפקד אר"ן', `
    <!-- Golden Hour -->
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:11px;color:var(--muted2)">${escHTML(S.comms.unit || 'BENAM')} | ${new Date().toLocaleString('he-IL')} | דקה ${elapsed}</div>
    </div>

    <div style="background:${ghMin <= 0 ? 'rgba(200,30,30,.15)' : ghMin <= 10 ? 'rgba(200,120,0,.15)' : 'rgba(40,80,40,.15)'};border:1px solid ${ghColor};border-radius:10px;padding:12px;text-align:center;margin-bottom:12px">
      <div style="font-size:9px;color:${ghColor};letter-spacing:.1em;font-weight:700">⏱ GOLDEN HOUR</div>
      <div style="font-size:36px;font-weight:900;font-family:var(--font-mono);color:${ghColor};line-height:1;margin-top:4px">${Math.max(0, ghMin)}:00</div>
      <div style="font-size:10px;color:var(--muted2);margin-top:2px">${ghMin <= 0 ? 'חלף! פנה מיידית' : 'דקות נותרו'}</div>
    </div>

    <!-- Triage summary -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px">
      <div style="background:rgba(200,30,30,.15);border:1px solid var(--red2);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--red3);font-weight:700">T1</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--red3)">${t1.length}</div>
      </div>
      <div style="background:rgba(200,120,0,.12);border:1px solid var(--amber);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--amber3);font-weight:700">T2</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--amber3)">${t2.length}</div>
      </div>
      <div style="background:rgba(40,120,40,.12);border:1px solid var(--green);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--green3);font-weight:700">T3</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--green3)">${t3.length}</div>
      </div>
      <div style="background:rgba(80,80,80,.12);border:1px solid var(--b1);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:9px;color:var(--muted);font-weight:700">T4</div>
        <div style="font-size:28px;font-weight:900;font-family:var(--font-mono);color:var(--muted)">${t4.length}</div>
      </div>
    </div>

    <!-- Key metrics -->
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:9px;color:var(--olive3);letter-spacing:.1em;font-weight:700;margin-bottom:8px">📈 מדדים</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><span style="font-size:10px;color:var(--muted)">גורמי רפואה:</span> <span style="font-weight:700">${medics.length}</span></div>
        <div><span style="font-size:10px;color:var(--muted)">בטיפול:</span> <span style="font-weight:700">${withMedic.length}/${allActive.length}</span></div>
        <div><span style="font-size:10px;color:var(--muted)">TQ פתוחים:</span> <span style="font-weight:700;color:${withTQ.length ? 'var(--red3)' : 'var(--green3)'}">${withTQ.length}</span></div>
        <div><span style="font-size:10px;color:var(--muted)">כוח:</span> <span style="font-weight:700">${S.force.length}</span></div>
      </div>
    </div>

    <!-- Evac priority -->
    <div style="background:var(--s2);border:1px solid var(--b0);border-radius:10px;padding:12px;margin-bottom:12px">
      <div style="font-size:9px;color:var(--olive3);letter-spacing:.1em;font-weight:700;margin-bottom:8px">🚁 סדר פינוי מומלץ</div>
      ${evacHtml}
    </div>

    <!-- Actions -->
    <div style="display:flex;gap:6px;margin-bottom:8px">
      <button class="btn btn-md btn-olive btn-full" onclick="copyStatusReport()">📋 העתק</button>
      <button class="btn btn-md btn-ghost btn-full" onclick="readStatusReport()">🔊 הקרא</button>
    </div>
    <button class="btn btn-sm btn-ghost btn-full" onclick="closeModal()" style="margin-top:4px">סגור</button>
  `);
}

function copyStatusReport() {
  const now = Date.now();
  const elapsed = S.missionStart ? Math.floor((now - S.missionStart) / 60000) : 0;
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const t2 = S.casualties.filter(c => c.priority === 'T2').length;
  const t3 = S.casualties.filter(c => c.priority === 'T3').length;
  const t4 = S.casualties.filter(c => c.priority === 'T4').length;
  const allActive = S.casualties.filter(c => c.priority !== 'T4');
  const withMedic = allActive.filter(c => c.medic).length;
  const withTQ = allActive.filter(c => c.tqStart).length;
  const txt = `דוח מצב — ${S.comms.unit || 'BENAM'}
${new Date().toLocaleString('he-IL')} | דקה ${elapsed}
T1:${t1} T2:${t2} T3:${t3} T4:${t4}
בטיפול: ${withMedic}/${allActive.length} | TQ פתוחים: ${withTQ}
כוח: ${S.force.length} | גורמי רפואה: ${(S.force || []).filter(f => f && getMedicLevel(f.role) > 0).length}`;
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => showToast('דוח מצב הועתק ✓'));
}

function readStatusReport() {
  const elapsed = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const t2 = S.casualties.filter(c => c.priority === 'T2').length;
  const t3 = S.casualties.filter(c => c.priority === 'T3').length;
  const txt = `דוח מצב. יחידה ${S.comms.unit || ''}. דקה ${elapsed}. טי 1: ${t1}. טי 2: ${t2}. טי 3: ${t3}. סך הכל ${S.casualties.length} פגועים.`;
  const u = new SpeechSynthesisUtterance(txt);
  u.lang = 'he-IL'; u.rate = 0.85;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  showToast('🔊 מקריא דוח מצב...');
}

// ═══════════════════════════════════════════════════
// REPORT + QR + SUPPLY
// ═══════════════════════════════════════════════════
function genReport() {
  if (!S.casualties.length) { $('report-txt').textContent = 'אין פצועים פעילים.'; return; }
  const now = new Date(), t = `${p2(now.getHours())}${p2(now.getMinutes())}Z`;
  const t1 = S.casualties.filter(c => c.priority === 'T1').length;
  const t2 = S.casualties.filter(c => c.priority === 'T2').length;
  const t3 = S.casualties.filter(c => c.priority === 'T3').length;
  let r = `=== MEDEVAC REQUEST — 9 LINE ===\n`;
  r += `TIME: ${t} | UNIT: ${S.comms.unit || '—'}\n\n`;
  r += `L1 LOCATION:  ${S.comms.lz1 || '[נ.צ.]'}\n`;
  r += `L2 FREQ:      ${S.comms.mahup || '—'} / HELO: ${S.comms.helo || '—'}\n`;
  r += `L3 PATIENTS:  T1:${t1}  T2:${t2}  T3:${t3}\n`;
  const al = S.casualties.filter(c => c.allergy).map(c => `${c.name}(${c.allergy})`).join(', ');
  r += `L4 SPECIAL:   ${al || 'NONE'}\n`;
  r += `L5 LZ:        ${S.comms.lz1 || '—'}\n`;
  r += `L6 SECURITY:  UNKNOWN\nL7 MARKING:   PENDING\nL8 IDF\nL9 TERRAIN:   FLAT\n\n`;
  r += `=== CASUALTY DETAIL ===\n`;
  S.casualties.forEach((c, i) => {
    r += `\n${i + 1}. ${c.name} | ${c.blood || '?'} | ${c.kg}kg | ${c.priority}\n`;
    if (c.allergy) r += `   ⚠ ALLERGY: ${c.allergy}\n`;
    if (c.tqStart) r += `   TQ: ${Math.floor((Date.now() - c.tqStart) / 60000)} דקות\n`;
    c.txList.forEach(tx => r += `   • ${tx.type} @ ${tx.time}\n`);
    c.injuries.forEach(inj => r += `   • ${inj.type} — ${inj.zone}\n`);
    if (c.fluidTotal) r += `   נוזלים: ${c.fluidTotal}ml\n`;
    if (c.vitals.gcs) r += `   GCS: ${c.vitals.gcs}\n`;
  });
  r += `\n=== LZ READY — AWAITING ETA ===`;
  $('report-txt').textContent = r;
  addTL('sys', 'SYSTEM', 'דוח MEDEVAC הופק 📡', 'amber');
}
function copyReport() {
  const t = $('report-txt').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => showToast('הועתק! ✓'));
  else { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); showToast('הועתק! ✓'); }
}
function readReport() {
  const t = $('report-txt').textContent;
  if (!t || t.includes('לחץ')) return;
  const u = new SpeechSynthesisUtterance(t);
  u.lang = 'he-IL'; u.rate = 0.85; u.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  showToast('🔊 מקריא דוח...');
}
function populateQRPick() {
  const _qp = $('qr-pick'); if (!_qp) return;
  _qp.textContent = '';
  const html = S.casualties.map(c => `
    <button class="btn btn-sm btn-ghost btn-full" style="justify-content:flex-start;gap:8px" onclick="showToast('QR נוצר — ${escHTML(c.name)}')">
      <span class="prio pt${c.priority[1]}">${c.priority}</span> ${escHTML(c.name)} — QR
    </button>`).join('') || '<div style="font-size:12px;color:var(--muted);padding:8px">אין פצועים</div>';
  _qp.insertAdjacentHTML('beforeend', html);
}
function populateSupply() {
  const supplyHtml = Object.entries(S.supplies).map(([n, v]) => `
    <div class="supply-card ${v <= 2 ? 'low' : ''}">
      <div style="font-size:9px;color:var(--muted);margin-bottom:2px">${n}</div>
      <div style="font-family:var(--font-mono);font-size:24px;font-weight:700;color:${v <= 2 ? 'var(--red3)' : 'var(--white)'}">${v}</div>
      ${v <= 2 ? `<div style="font-size:9px;color:var(--red3);font-weight:700;margin-bottom:4px">⚠ מלאי נמוך</div>` : ''}
      <div style="display:flex;gap:4px;margin-top:4px">
        <button class="btn btn-xs btn-ghost btn-full" onclick="chgS('${n}',-1)" style="min-height:30px">−</button>
        <button class="btn btn-xs btn-ghost btn-full" onclick="chgS('${n}',1)" style="min-height:30px">+</button>
      </div>
    </div>`).join('');
  const _sg = $('supply-grid'); if (_sg) _sg.insertAdjacentHTML('afterbegin', ((_sg.textContent=''),supplyHtml));
  const _sgs = $('supply-grid-stats'); if (_sgs) _sgs.insertAdjacentHTML('afterbegin', ((_sgs.textContent=''),supplyHtml));
}
function chgS(n, d) { S.supplies[n] = Math.max(0, (S.supplies[n] || 0) + d); populateSupply(); }

// ═══════════════════════════════════════════════════
// AAR — AFTER ACTION REPORT
// ═══════════════════════════════════════════════════
function genAAR() {
  if (!S.missionStart && !S.casualties.length) { showToast('אין נתוני אירוע'); return; }
  const dur = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;
  const totalTx = S.casualties.reduce((a, c) => a + c.txList.length, 0);
  const maxTQ = S.casualties.filter(c => c.tqStart).map(c => Math.floor((Date.now() - c.tqStart) / 60000));
  const tqMins = maxTQ.length ? Math.max(...maxTQ) : 0;
  const html = `
    <div class="aar-section">
      <div class="aar-hdr">AAR — After Action Report — ${new Date().toLocaleDateString('he-IL')}</div>
      <div class="aar-stat"><div class="aar-stat-lbl">יחידה</div><div class="aar-stat-val">${escHTML(S.comms.unit || '—')}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">משך אירוע</div><div class="aar-stat-val">${dur} דקות</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">סה"כ פצועים</div><div class="aar-stat-val">${S.casualties.length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T1 קריטיים</div><div class="aar-stat-val" style="color:var(--red3)">${S.casualties.filter(c => c.priority === 'T1').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T2 דחופים</div><div class="aar-stat-val" style="color:var(--amber3)">${S.casualties.filter(c => c.priority === 'T2').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T3 קלים</div><div class="aar-stat-val" style="color:var(--green3)">${S.casualties.filter(c => c.priority === 'T3').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">T4 Expectant</div><div class="aar-stat-val" style="color:var(--muted)">${S.casualties.filter(c => c.priority === 'T4').length}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">סה"כ טיפולים</div><div class="aar-stat-val">${totalTx}</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">TQ מקסימלי</div><div class="aar-stat-val" style="color:${tqMins > 45 ? 'var(--red3)' : 'var(--green3)'}">${tqMins} דקות</div></div>
      <div class="aar-stat"><div class="aar-stat-lbl">אירועי ציר זמן</div><div class="aar-stat-val">${S.timeline.length}</div></div>
    </div>
    <div class="aar-section">
      <div class="aar-hdr">פצועים — סיכום</div>
      ${S.casualties.map(c => `
        <div class="aar-stat" style="flex-direction:column;align-items:flex-start;gap:4px">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <span class="prio pt${c.priority[1]}">${c.priority}</span>
            <span style="font-weight:700">${escHTML(c.name)}</span>
            <span class="tag tag-blood">${escHTML(c.blood || '?')}</span>
            ${c.allergy ? `<span class="tag tag-allergy">⚠ ${escHTML(c.allergy)}</span>` : ''}
          </div>
          <div style="font-size:11px;color:var(--muted2)">${c.txList.map(t => t.type).join(' → ') || 'אין טיפולים'}</div>
          ${c.injuries.length ? `<div style="font-size:10px;color:var(--muted)">${c.injuries.map(i => i.type + ' — ' + i.zone).join(' | ')}</div>` : ''}
        </div>`).join('') || '<div style="padding:12px;color:var(--muted);font-size:12px">אין פצועים</div>'}
    </div>`;
  $('aar-section').innerHTML = html;
}
