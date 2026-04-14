// ═══════════════════════════════════════════════════
// 🔗 MESH SYNC — QR Delta Sync
// ═══════════════════════════════════════════════════
let _meshLog = [];
let _meshLastSync = 0;
let _meshPendingDeltas = [];
let _meshExportBundle = null;

function openMeshSync() {
  $('mesh-overlay').style.display = 'block';
  renderMeshStatus();
}

function saveMesh(casId, type, data) {
  _meshPendingDeltas.push({ casId, type, data, ts: Date.now() });
  meshAddLog(`📝 שינוי מקומי: ${type} (פגוע ${casId})`);
}

function openSyncDashboard(activeTab = 'mesh') {
  const lastSyncStr = _meshLastSync > 0 ? new Date(_meshLastSync).toLocaleTimeString('he-IL') : '—';
  const pendingCount = _meshPendingDeltas.length;
  const health = pendingCount > 10 ? 'crit' : pendingCount > 0 ? 'warn' : 'ok';
  const healthClr = health === 'crit' ? 'var(--red3)' : health === 'warn' ? 'var(--amber3)' : 'var(--green3)';
  const radio = S.prefs?.radioName || 'ללא זיהוי';

  const modalHtml = `
    <div class="pad col" style="gap:16px; max-height:85vh; overflow-y:auto; padding-top:4px">
      
      <!-- Premium Tab Navigation -->
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; background:rgba(255,255,255,0.05); border-radius:12px; padding:4px; margin-bottom:4px">
        <div onclick="openSyncDashboard('mesh')" style="text-align:center; padding:10px; border-radius:10px; font-size:11px; font-weight:900; background:${activeTab === 'mesh' ? 'var(--s1)' : 'transparent'}; color:${activeTab === 'mesh' ? 'var(--white)' : 'var(--muted)'}; cursor:pointer">📡 זירה</div>
        <div onclick="openSyncDashboard('export')" style="text-align:center; padding:10px; border-radius:10px; font-size:11px; font-weight:900; background:${activeTab === 'export' ? 'var(--s1)' : 'transparent'}; color:${activeTab === 'export' ? 'var(--white)' : 'var(--muted)'}; cursor:pointer">📤 שידור</div>
        <div onclick="openSyncDashboard('scan')" style="text-align:center; padding:10px; border-radius:10px; font-size:11px; font-weight:900; background:${activeTab === 'scan' ? 'var(--s1)' : 'transparent'}; color:${activeTab === 'scan' ? 'var(--white)' : 'var(--muted)'}; cursor:pointer">📥 קליטה</div>
      </div>

      ${activeTab === 'mesh' ? `
        <!-- Mesh Scene Overview -->
        <div style="background:var(--s3); padding:16px; border-radius:16px; border:1px solid var(--b2); position:relative; overflow:hidden">
          <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:${healthClr}"></div>
          <div style="font-size:10px; color:var(--muted); letter-spacing:0.1em; margin-bottom:2px">מצב סנכרון זירה (Tactical Mesh)</div>
          <div style="font-size:20px; font-weight:900; color:${healthClr}">${health === 'ok' ? 'מסונכרן מלא' : 'ממתין לעדכון'}</div>
          
          <div style="display:flex; gap:12px; margin-top:16px; background:rgba(0,0,0,0.2); padding:12px; border-radius:10px">
            <div style="flex:1">
              <div style="font-size:18px; font-weight:900">${pendingCount}</div>
              <div style="font-size:9px; color:var(--muted)">שינויים מקומיים</div>
            </div>
            <div style="width:1px; background:var(--b1)"></div>
            <div style="flex:1">
              <div style="font-size:18px; font-weight:900">${S.casualties.length}</div>
              <div style="font-size:9px; color:var(--muted)">פגועים בבסיס</div>
            </div>
          </div>
        </div>

        <div class="row" style="justify-content:space-between; background:var(--s2); padding:12px; border-radius:12px; border:1px solid var(--b1)">
          <div style="display:flex; align-items:center; gap:10px">
            <span style="font-size:22px">👤</span>
            <div class="col">
              <div style="font-size:9px; color:var(--muted)">זיהוי קשר (Radio)</div>
              <div style="font-size:14px; font-weight:700">${escHTML(radio)}</div>
            </div>
          </div>
          <button class="btn btn-xs btn-ghost" onclick="closeModal(); openUserSettings()">הגדרות</button>
        </div>

        <div class="col" style="gap:8px">
          <div style="font-size:10px; color:var(--muted); font-weight:700; display:flex; justify-content:space-between">
            <span>📜 היסטוריית תעבורה</span>
            <span style="color:var(--muted2)">${lastSyncStr}</span>
          </div>
          <div id="mesh-log-view" style="background:var(--bg); border:1px solid var(--b0); border-radius:12px; padding:10px; max-height:160px; overflow-y:auto; font-family:var(--font-mono); font-size:10px">
            ${_meshLog.length > 0 
              ? _meshLog.map(l => `<div style="padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.03); color:var(--muted2)">${l}</div>`).reverse().join('')
              : '<div style="text-align:center; padding:20px; color:var(--muted2)">אין פעילות רשת רשומה</div>'
            }
          </div>
        </div>
      ` : ''}

      ${activeTab === 'export' ? `
        <!-- Export / Burst Section -->
        <div class="col" style="gap:12px">
          <!-- Data Scope Selector -->
          <div style="display:grid; grid-template-columns:1fr 1fr; background:rgba(255,255,255,0.1); border-radius:12px; padding:4px; border:1px solid var(--b1)">
            <div onclick="window._burstScope='all'; openSyncDashboard('export')" 
              style="text-align:center; padding:10px; border-radius:10px; font-size:12px; font-weight:900; background:${(window._burstScope || 'all') === 'all' ? 'var(--olive3)' : 'transparent'}; color:white; cursor:pointer; transition:all 0.2s">🌍 הכל (זירה)</div>
            <div onclick="window._burstScope='cas'; if(!window._burstTargetId && S.casualties[0]) window._burstTargetId=S.casualties[0].id; openSyncDashboard('export')" 
              style="text-align:center; padding:10px; border-radius:10px; font-size:12px; font-weight:900; background:${window._burstScope === 'cas' ? 'var(--olive3)' : 'transparent'}; color:white; cursor:pointer; transition:all 0.2s">👤 פצוע ספציפי</div>
          </div>

          ${window._burstScope === 'cas' ? `
            <!-- V3 Supreme Patient Selector -->
            <div style="display:flex; gap:14px; overflow-x:auto; padding:12px 0 20px 0; scrollbar-width:none; -webkit-overflow-scrolling:touch; margin:0 -10px; padding:10px">
              ${S.casualties.map(c => {
                const isSelected = window._burstTargetId === c.id;
                const pColor = pClr(c.priority);
                return `
                <div onclick="window._burstTargetId=${c.id}; openSyncDashboard('export')" 
                  style="flex:0 0 auto; width:110px; padding:16px 10px; border-radius:24px; background:${isSelected ? 'rgba(200,144,16,0.1)' : 'rgba(255,255,255,0.03)'}; border:2.5px solid ${isSelected ? 'var(--amber3)' : 'rgba(255,255,255,0.08)'}; text-align:center; cursor:pointer; position:relative; box-shadow:${isSelected ? '0 12px 35px rgba(200,144,16,0.3)' : 'none'}; transition:all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)">
                  ${isSelected ? '<div style="position:absolute; top:-10px; right:-10px; background:var(--amber); color:#000; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:900; border:3px solid var(--b2); box-shadow:0 4px 12px rgba(0,0,0,0.5)">✓</div>' : ''}
                  <div style="width:40px; height:40px; margin:0 auto 8px; border-radius:50%; background:${pColor}; display:flex; align-items:center; justify-content:center; font-size:18px; color:white; font-weight:900; border:2px solid rgba(255,255,255,0.2)">${c.priority}</div>
                  <div style="font-size:13px; font-weight:900; color:white; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:0.5px">${escHTML(c.name || 'UN NAMED')}</div>
                  <div style="font-size:10px; color:var(--muted); margin-top:4px; font-weight:700">HR: ${c.vitals?.pulse || '—'} · #${c.id.toString().slice(-4)}</div>
                </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          <!-- V3 Supreme QR Portal -->
          <div id="qr-burst-container" style="background:rgba(255,255,255,0.02); border-radius:32px; padding:24px; border:1px solid rgba(255,255,255,0.05); backdrop-filter:blur(20px); box-shadow:inset 0 0 40px rgba(255,255,255,0.02); min-height:480px; display:flex; flex-direction:column; align-items:center; justify-content:center">
             ${!window._burstReady ? `
               <div style="text-align:center; padding:40px">
                 <div style="font-size:48px; margin-bottom:20px; animation:pulse 2s infinite">📡</div>
                 <div style="color:var(--white); font-weight:900; font-size:18px; margin-bottom:12px">מוכן לשידור טקטי</div>
                 <p style="color:var(--muted); font-size:13px; line-height:1.6; margin-bottom:24px">המערכת תארוז את הנתונים המבוקשים<br>לתוך רצף קודי QR בינאריים מוצפנים.</p>
                 <button class="btn btn-xl btn-amber btn-full" onclick="meshExport('${window._burstScope}', '${window._burstTargetId}')" style="border-radius:18px; box-shadow:0 15px 40px rgba(200,144,16,0.3)">צור רצף שידור (BURST)</button>
               </div>
             ` : '<div id="qr-render-area" style="width:100%"></div>'}
          </div>
        </div>
      ` : ''}

      ${activeTab === 'scan' ? `
        <!-- Scan / Import Section -->
        <div style="text-align:center; padding:20px; background:var(--s3); border-radius:16px; border:1px solid var(--b2)">
          <div style="font-size:48px; margin-bottom:12px">📷</div>
          <div style="font-size:18px; font-weight:900">קליטת נתונים (Scanner)</div>
          <div style="font-size:12px; color:var(--muted); margin-bottom:20px">סרוק קודי QR או חבילות Burst ממכשירים אחרים.</div>
          
          <div class="col" style="gap:10px">
            <button class="btn btn-lg btn-olive btn-full" onclick="closeModal(); startQRScan()" style="height:60px; font-weight:900">פתח מצלמת סריקה</button>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
              <button class="btn btn-md btn-ghost btn-full" onclick="closeModal(); triggerQRImageScan()">🖼 ייבוא מתמונה</button>
              <button class="btn btn-md btn-ghost btn-full" onclick="closeModal(); toggleQRPasteArea()">📋 הדבק נתונים</button>
            </div>
          </div>
        </div>
      ` : ''}

      <button class="btn btn-md btn-ghost btn-full" onclick="closeModal()" style="margin-top:8px">חזרה למשימה</button>

      <style>
        .sync-glow { box-shadow: 0 0 20px var(--amber); animation: sync-pulse 1.5s infinite; }
        @keyframes sync-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
      </style>
    </div>
  `;
  
  openModal('📡 מרכז סנכרון מאוחד (Sync Master)', modalHtml);
}

function meshAddLog(msg) {
  const time = new Date().toLocaleTimeString('he-IL');
  _meshLog.push(`[${time}] ${msg}`);
  if (_meshLog.length > 50) _meshLog.shift();
}

async function meshExport(scope = 'all', targetId = '') {
  let casualtiesToShare = S.casualties;
  if (scope === 'cas' && targetId) {
    casualtiesToShare = S.casualties.filter(c => String(c.id) === String(targetId));
    if (casualtiesToShare.length === 0) { showToast('פצוע לא נמצא'); return; }
  }

  const payload = {
    kind: QR_PACKET_KIND_MESH,
    format: QR_SYNC_FORMAT,
    unit: S.comms.unit || '',
    exportedAt: Date.now(),
    sincets: scope === 'all' ? (_meshLastSync || 0) : 0, // Single casualty always full export
    casualties: casualtiesToShare.map(c => ({
      id: c.id, name: c.name, idNum: c.idNum, blood: c.blood, kg: c.kg, allergy: c.allergy,
      priority: c.priority, mech: c.mech, time: c.time, tqStart: c.tqStart,
      txList: c.txList, vitals: c.vitals, vitalsHistory: c.vitalsHistory || [],
      injuries: c.injuries, fluidTotal: c.fluidTotal, march: c.march,
      medic: c.medic, gps: c.gps, escalated: c.escalated, _addedAt: c._addedAt,
      notes: c.notes || ''
    })),
    timeline: S.timeline.slice(-30),
    comms: S.comms,
    supplies: S.supplies,
    missionStart: S.missionStart
  };

  const bundle = await _buildQRBundle(payload);
  _meshExportBundle = bundle;

  // Open the Unified Burst Modal (Simplified Container)
  openModal('📤 שידור זירה (Binary Burst)', `
    <div class="pad col" style="gap:12px; align-items:center; min-height:420px; padding-top:10px">
      <div id="mesh-qr-area" style="width:100%; display:flex; justify-content:center">
        <!-- The specialized _renderQRBundle will inject the entire UI here -->
      </div>
      <button class="btn btn-lg btn-ghost btn-full" onclick="closeModal()" style="margin-top:10px; border-radius:12px">סגור שידור</button>
    </div>
  `);

  // Start the pre-rendering and display
  setTimeout(() => {
    const el = $('mesh-qr-area');
    if (el) _renderQRBundle(el, bundle);
  }, 100);

  // Mark as synced locally ONLY if full scene was shared
  if (scope === 'all') {
    _meshLastSync = Date.now();
    _meshPendingDeltas = [];
    meshAddLog(`📤 שידור זירה (Full) מוצלח: ${payload.casualties.length} פגועים`);
  } else {
    meshAddLog(`📤 שידור פצוע בודד: ${casualtiesToShare[0]?.name || '?'}`);
  }
  
  try { if (navigator.vibrate) navigator.vibrate(80); } catch (_) {}
}

function meshCopyJSON() {
  if (!_meshExportBundle) { showToast('אין חבילת Mesh מוכנה'); return; }
  navigator.clipboard?.writeText(_meshExportBundle.json).then(() => showToast('📋 הועתק!')).catch(() => showToast('⚠ לא הצליח להעתיק'));
}

function meshScanQR() {
  $('mesh-export-area').style.display = 'none';
  startQRScan();
}

function meshApplyImport() {
  const raw = ($('mesh-import-txt')?.value || '').trim();
  if (!raw) { showToast('⚠ הדבק JSON לפני מיזוג'); return; }
  let payload;
  // Try direct JSON parse
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    // Try base64 decode
    try { payload = JSON.parse(_base64ToUtf8(raw)); }
    catch (e2) {
      // Try to extract JSON from wrapped text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { payload = JSON.parse(jsonMatch[0]); } catch (e3) {}
      }
      if (!payload) {
        showToast('⚠ פורמט לא תקין — ודא שהדבקת JSON או Base64 תקין');
        return;
      }
    }
  }
  // Validate minimum structure
  if (!payload.casualties && !payload.state && !payload.cas) {
    showToast('⚠ נתונים לא מכילים פגועים — ודא שהנתונים מ-BENAM');
    return;
  }
  meshApplyPayload(payload);
  $('mesh-import-txt').value = '';
  $('mesh-import-area').style.display = 'none';
}
