// ═══════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════
// renderTimeline — defined above with filter support

// ═══════════════════════════════════════════════════
// 🌙 NIGHT / RED MODE
// ═══════════════════════════════════════════════════
function toggleNight() {
  // Use ONLY night-vision class (full NVG palette in variables.css)
  // night-mode was a conflicting sepia filter — removed
  document.body.classList.toggle('night-vision');
  const active = document.body.classList.contains('night-vision');
  // Clean up legacy class if present
  document.body.classList.remove('night-mode');
  localStorage.setItem('benam_nv', active ? '1' : '0');
  showToast(active ? '🟢 תצוגת NVG — פעיל' : '🌙 תצוגת NVG — כבוי');
}
function toggleRecording(forceState) {
  const ind = $('rec-indicator');
  if (!ind) return;
  const active = forceState !== undefined ? forceState : ind.style.display === 'none';
  if (forceState !== undefined && ((forceState && ind.style.display === '') || (!forceState && ind.style.display === 'none'))) return;
  ind.style.display = active ? '' : 'none';
  if (active) addTL('sys', 'SYSTEM', 'Recording started', 'olive');
  else addTL('sys', 'SYSTEM', 'Recording stopped', 'muted');
}
function openUserSettings() {
  const prefs = S.prefs;
  openModal('⚙️ הגדרות מערכת BENAM', `
    <div class="pad col" style="gap:20px; max-height:80vh; overflow-y:auto">
      
      <!-- Tactical Category -->
      <div class="col" style="gap:8px">
        <div style="font-size:10px; color:var(--olive3); font-weight:700; letter-spacing:0.1em">⚡ מבצעי — התראות וקול</div>
        <div class="card" style="margin:0; background:var(--s3); border-color:var(--b2)">
          <div class="pad col" style="gap:12px">
            <div class="row" style="justify-content:space-between">
              <div style="font-size:14px">חיווי קולי (Speech-to-Text)</div>
              <input type="checkbox" id="pref-voice" ${prefs.voiceEnabled ? 'checked' : ''} onchange="updatePref('voiceEnabled', this.checked)">
            </div>
            <div class="row" style="justify-content:space-between">
              <div style="font-size:14px">משוב רטט (Haptic Feedback)</div>
              <input type="checkbox" id="pref-haptic" ${prefs.hapticFeedback ? 'checked' : ''} onchange="updatePref('hapticFeedback', this.checked)">
            </div>
            <div class="col" style="gap:4px">
              <div style="font-size:12px; color:var(--muted2)">התראת TQ קריטית אחרי (דקות)</div>
              <input type="range" min="15" max="60" step="5" value="${prefs.tqThreshold}" 
                oninput="$('tq-val').textContent = this.value; updatePref('tqThreshold', parseInt(this.value))"
                style="width:100%">
              <div style="text-align:center; font-family:var(--font-mono); font-size:16px; color:var(--red3)" id="tq-val">${prefs.tqThreshold} דקות</div>
            </div>
            <div class="col" style="gap:4px; margin-top:8px">
              <div style="font-size:12px; color:var(--muted2)">שם קשר (Radio Name)</div>
              <input type="text" id="pref-radio-name" class="input input-sm input-full" placeholder="לדוג׳: חופ״ל א׳" 
                value="${prefs.radioName || ''}" oninput="updatePref('radioName', this.value.trim())"
                style="background:rgba(0,0,0,0.2); border:1px solid var(--b1); color:var(--white); padding:8px; border-radius:6px">
            </div>
          </div>
        </div>
      </div>

      <!-- Visual Category -->
      <div class="col" style="gap:8px">
        <div style="font-size:10px; color:var(--olive3); font-weight:700; letter-spacing:0.1em">🌙 תצוגה וממשק</div>
        <div class="card" style="margin:0; background:var(--s3); border-color:var(--b2)">
          <div class="pad col" style="gap:12px">
            <button class="btn btn-md btn-ghost btn-full" onclick="toggleNight(); closeTopbarMenu(); closeModal()">
              ${document.body.classList.contains('night-vision') ? '☀️ מצב יום' : '🌙 מצב לילה (NVG)'}
            </button>
            <div class="row" style="justify-content:space-between">
              <div style="font-size:14px">סנכרון QR אוטומטי</div>
              <input type="checkbox" id="pref-sync" ${prefs.autoSync ? 'checked' : ''} onchange="updatePref('autoSync', this.checked)">
            </div>
            <div class="col" style="gap:4px">
              <div style="font-size:12px; color:var(--muted2)">גודל גופן</div>
              <div class="row" style="gap:5px">
                ${['small','normal'].map(s => 
                  `<button class="btn btn-xs btn-ghost btn-full ${prefs.fontSize === s ? 'btn-olive' : ''}" 
                    onclick="updatePref('fontSize','${s}'); openUserSettings()">${s}</button>`
                ).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- System Category -->
      <div class="col" style="gap:8px">
        <div style="font-size:10px; color:var(--red3); font-weight:700; letter-spacing:0.1em">🛡️ מערכת וביטחון</div>
        <div class="card" style="margin:0; background:var(--s3); border-color:var(--red)">
          <div class="pad col" style="gap:12px">
            <button class="btn btn-md btn-ghost btn-full" onclick="closeModal(); goScreen('sc-role')">👤 שינוי תפקיד/מצב</button>
            <button class="btn btn-md btn-red btn-full" onclick="fullReset()">🗑️ איפוס נתונים מלא</button>
            <div style="font-size:9px; color:var(--muted); text-align:center">BENAM Version 1.1.0-Tactical</div>
          </div>
        </div>
      </div>

      <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()">חזרה</button>
    </div>
  `);
}

function updatePref(key, val) {
  if (!S.prefs) S.prefs = {};
  S.prefs[key] = val;
  if (key === 'nightMode') {
     if (val) document.body.classList.add('night-vision');
     else document.body.classList.remove('night-vision');
     document.body.classList.remove('night-mode'); // cleanup legacy
  }
  if (key === 'fontSize') {
    _applyFontSize(val);
  }
  saveState();
  showToast('✓ הגדרות עודכנו');
}

function _applyFontSize(size) {
  const root = document.documentElement;
  const app = document.getElementById('app');
  root.classList.remove('fs-small', 'fs-normal', 'fs-large');
  root.classList.add('fs-' + (size || 'normal'));
  const zoomMap = { small: '0.9', normal: '1', large: '1.1' };
  if (app) app.style.zoom = zoomMap[size] || '1';
}

// Apply saved font size on boot
try {
  const _fsRaw = localStorage.getItem('benam_state');
  if (_fsRaw) { const _fst = JSON.parse(_fsRaw); if (_fst.prefs && _fst.prefs.fontSize) _applyFontSize(_fst.prefs.fontSize); }
} catch(_e) {}

/* Topbar ⋯ menu */
function toggleTopbarMenu() {
  const navigation = window.BENAM_LEGACY && window.BENAM_LEGACY.navigation ? window.BENAM_LEGACY.navigation : null;
  if (navigation && navigation.toggleTopbarMenu) return navigation.toggleTopbarMenu();
  const m = document.getElementById('tb-menu');
  m.style.display = m.style.display === 'none' ? 'block' : 'none';
}
function closeTopbarMenu() {
  const navigation = window.BENAM_LEGACY && window.BENAM_LEGACY.navigation ? window.BENAM_LEGACY.navigation : null;
  if (navigation && navigation.closeTopbarMenu) return navigation.closeTopbarMenu();
  document.getElementById('tb-menu').style.display = 'none';
}
if (typeof window !== 'undefined') {
  window.toggleRecording = toggleRecording;
  window.toggleNight = toggleNight;
  window.toggleNightMode = toggleNight; // legacy alias for tests and older scripts
  window.openUserSettings = openUserSettings;
  window.toggleTopbarMenu = toggleTopbarMenu;
  window.closeTopbarMenu = closeTopbarMenu;
}
/* Close topbar menu on outside click */
document.addEventListener('click', e => {
  const m = document.getElementById('tb-menu');
  if (m && m.style.display !== 'none' && !m.contains(e.target) && !e.target.closest('.tb-icons'))
    m.style.display = 'none';
});

// ═══════════════════════════════════════════════════
// 📊 STATS DASHBOARD
// ═══════════════════════════════════════════════════
function renderStats() {
  try { if (typeof renderKPI === 'function') renderKPI(); } catch(e) { console.warn('[renderStats] renderKPI failed:', e); }
  const cas = S.casualties;
  const t1 = cas.filter(c => c.priority === 'T1').length;
  const t2 = cas.filter(c => c.priority === 'T2').length;
  const t3 = cas.filter(c => c.priority === 'T3').length;
  const t4 = cas.filter(c => c.priority === 'T4').length;
  const tqs = cas.filter(c => c.tqStart);
  const maxTQ = tqs.length ? Math.max(...tqs.map(c => Math.floor((Date.now() - c.tqStart) / 60000))) : 0;
  const dur = S.missionStart ? Math.floor((Date.now() - S.missionStart) / 60000) : 0;
  const totalTx = cas.reduce((a, c) => a + c.txList.length, 0);
  const tqOver45 = tqs.filter(c => ((Date.now() - c.tqStart) / 60000) > 45).length;

  const _sg = $('stats-grid'); if (!_sg) return;
  _sg.textContent = '';
  _sg.insertAdjacentHTML('afterbegin', `
    <div class="stat-box ${t1 > 0 ? 'stat-crit' : 'stat-ok'}">
      <div class="stat-num" style="color:${t1 > 0 ? 'var(--red3)' : 'var(--green3)'}">${t1}</div>
      <div class="stat-lbl">T1 קריטיים</div>
    </div>
    <div class="stat-box ${t2 > 0 ? 'stat-warn' : ''}">
      <div class="stat-num" style="color:${t2 > 0 ? 'var(--amber3)' : 'var(--muted2)'}">${t2}</div>
      <div class="stat-lbl">T2 דחופים</div>
    </div>
    <div class="stat-box stat-ok">
      <div class="stat-num" style="color:var(--green3)">${t3}</div>
      <div class="stat-lbl">T3 קלים</div>
    </div>
    <div class="stat-box">
      <div class="stat-num" style="color:var(--muted)">${t4}</div>
      <div class="stat-lbl">T4 Expectant</div>
    </div>
    <div class="stat-box ${dur > 55 ? 'stat-crit' : dur > 30 ? 'stat-warn' : ''}">
      <div class="stat-num" style="color:${dur > 55 ? 'var(--red3)' : dur > 30 ? 'var(--amber3)' : 'var(--white)'}">${dur}</div>
      <div class="stat-lbl">דקות מהפתיחה</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${totalTx}</div>
      <div class="stat-lbl">סה"כ פעולות</div>
    </div>
    <div class="stat-box ${tqOver45 > 0 ? 'stat-crit' : ''}">
      <div class="stat-num" style="color:${tqOver45 > 0 ? 'var(--red3)' : 'var(--white)'}">${tqOver45}</div>
      <div class="stat-lbl">TQ מעל 45 דק'</div>
    </div>
    <div class="stat-box">
      <div class="stat-num">${S.force.length}</div>
      <div class="stat-lbl">כוח כולל</div>
    </div>`);

  $('tq-stats').innerHTML = tqs.length ? tqs.map(c => {
    const m = Math.floor((Date.now() - c.tqStart) / 60000);
    const cls = m > 45 ? 'stat-crit' : m > 30 ? 'stat-warn' : '';
    return `<div class="card ${cls}" style="padding:10px 12px;display:flex;align-items:center;gap:10px;margin:0">
      <span class="prio pt${c.priority[1]}">${c.priority}</span>
      <span style="font-size:13px;font-weight:700;flex:1">${escHTML(c.name)}</span>
      <span class="tq ${m > 45 ? 'tq-crit' : m > 30 ? 'tq-warn' : 'tq-ok'}">⏱ ${m} דקות</span>
      ${m > 45 ? '<span style="font-size:10px;color:var(--red3);font-weight:700">⚠ סכנת עצב!</span>' : ''}
    </div>`;
  }).join('') : '<div style="font-size:12px;color:var(--muted);padding:8px">אין TQ פתוחים</div>';

  // Supply remaining (equip-stats element removed from UI)
  const _eqs = $('equip-stats'); if (!_eqs) return;
  const low = Object.entries(S.supplies).filter(([, v]) => v <= 2);
  _eqs.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px">
      ${Object.entries(S.supplies).map(([n, v]) => `
        <div style="background:${v <= 1 ? 'var(--crit-bg)' : v <= 2 ? 'var(--urg-bg)' : 'var(--s2)'};border:1px solid ${v <= 1 ? 'var(--red2)' : v <= 2 ? 'var(--amber)' : 'var(--b0)'};border-radius:5px;padding:7px;text-align:center">
          <div style="font-family:var(--font-mono);font-size:20px;font-weight:700;color:${v <= 1 ? 'var(--red3)' : v <= 2 ? 'var(--amber3)' : 'var(--white)'}">${v}</div>
          <div style="font-size:8px;color:var(--muted);margin-top:1px">${n}</div>
        </div>`).join('')}
    </div>`;

  // Gantt chart
  setTimeout(renderGantt, 50);
}

// ═══════════════════════════════════════════════════
// ⚠ VITALS DETERIORATION ALERT
// ═══════════════════════════════════════════════════
const _prevVitals = {};
function checkVitalsDeteriorating(c) {
  const prev = _prevVitals[c.id] || {};
  const alerts = [];
  const pulse = parseInt(c.vitals.pulse);
  const spo2 = parseInt(c.vitals.spo2);
  const gcs = parseInt(c.vitals.gcs);
  const prevP = parseInt(prev.pulse || 0);
  const prevS = parseInt(prev.spo2 || 100);
  const prevG = parseInt(prev.gcs || 15);
  if (prevP > 0 && pulse > 0 && pulse < prevP - 20) alerts.push(`דופק ירד ${prevP}→${pulse}`);
  if (prevS > 0 && spo2 > 0 && spo2 < prevS - 5) alerts.push(`SpO2 ירד ${prevS}→${spo2}%`);
  if (prevG > 0 && gcs > 0 && gcs < prevG - 2) alerts.push(`GCS ירד ${prevG}→${gcs}`);
  if (pulse && pulse < 50) alerts.push(`ברדיקרדיה! ${pulse}bpm`);
  if (spo2 && spo2 < 88) alerts.push(`היפוקסיה! ${spo2}%`);
  if (alerts.length) {
    const wa = $('worsening-alert');
    wa.innerHTML = `⚠ ${escHTML(c.name)}<br>${alerts.join('<br>')}`;
    wa.classList.add('on');
    vibrateAlert(`החמרה: ${c.name} — ${alerts[0]}`);
    setTimeout(() => wa.classList.remove('on'), 8000);
  }
  _prevVitals[c.id] = { pulse: c.vitals.pulse, spo2: c.vitals.spo2, gcs: c.vitals.gcs };
}

// ═══════════════════════════════════════════════════
// 💉 SHOCK CALCULATOR
// ═══════════════════════════════════════════════════
function calcShock(casId) {
  const c = S.casualties.find(x => x.id == casId); if (!c) return;
  const pulse = parseInt(c.vitals.pulse) || 0;
  const sbp = parseInt((c.vitals.bp || '').split('/')[0]) || 0;
  const gcs = parseInt(c.vitals.gcs) || 15;
  const kg = c.kg || 70;

  // Shock Index
  const si = pulse && sbp ? pulse / sbp : 0;
  let shockGrade = '', shockColor = 'shock-ok', recs = [];

  if (si === 0) { shockGrade = 'לא ניתן לחשב — הזן ויטלים'; shockColor = ''; }
  else if (si < 0.6) { shockGrade = '✓ ללא שוק — יציב'; shockColor = 'shock-ok'; }
  else if (si < 0.9) { shockGrade = '⚡ שוק קל — ערנות'; shockColor = 'shock-warn'; recs = ['מעקב כל 3 דקות', 'IV / הכן נוזלים']; }
  else if (si < 1.2) { shockGrade = '⚠ שוק בינוני — Permissive Hypotension'; shockColor = 'shock-warn'; recs = ['NaCl 250ml בולוס', 'SBP יעד: 80-90mmHg', 'TXA אם <3 שעות']; }
  else { shockGrade = '🔴 שוק קשה / היפובולמי'; shockColor = 'shock-result'; recs = ['NaCl 500ml מהיר', 'Walking Blood Bank', 'שקול IO', 'סמן T1 מיידי']; }

  // GCS fluid guidance
  if (gcs < 9 && sbp) recs.push(`TBI — SBP יעד ≥90mmHg`);

  // TXA window
  const inTXAWindow = (c._addedAt || c.tqStart) && ((Date.now() - (c._addedAt || c.tqStart)) / 3600000) < 3;

  const el = document.getElementById(`shock-calc-${casId}`);
  if (!el) return;
  el.innerHTML = `
    <div class="shock-result ${shockColor}">
      <div style="font-size:16px;font-weight:900;margin-bottom:8px">${shockGrade}</div>
      ${si > 0 ? `<div style="font-size:12px;color:var(--muted2)">Shock Index: <span style="font-family:var(--font-mono);color:var(--amber2)">${si.toFixed(2)}</span> | ${pulse}bpm / ${sbp}mmHg</div>` : ''}
      ${recs.length ? `<div style="margin-top:8px;font-size:12px;line-height:1.8">${recs.map(r => `• ${r}`).join('<br>')}</div>` : ''}
      ${inTXAWindow ? `<div style="margin-top:6px;font-size:11px;color:var(--amber3);font-weight:700">✓ בחלון TXA — תן עכשיו!</div>` : ''}
    </div>`;
}
