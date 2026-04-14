
function toggleScanTorch() {
  if (!_scanStream) return;
  try {
    const track = _scanStream.getVideoTracks()[0];
    if (!track) return;
    _torchOn = !_torchOn;
    track.applyConstraints({ advanced: [{ torch: _torchOn }] });
    const btn = $('torch-btn');
    if (btn) {
      btn.textContent = _torchOn ? '🔦 כבה' : '🔦 פנס';
      btn.style.color = _torchOn ? '#fff' : '#ffcc00';
      btn.style.background = _torchOn ? '#aa8800' : 'transparent';
    }
  } catch (_) { showToast('⚠ פנס לא נתמך במכשיר זה'); }
}

async function _openScanCamera() {
  const envConstraints = {
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      focusMode: { ideal: 'continuous' },
      exposureMode: { ideal: 'continuous' }
    }
  };
  const fallback1 = { audio: false, video: { facingMode: 'environment' } };
  const fallback2 = { audio: false, video: true };
  try {
    return await navigator.mediaDevices.getUserMedia(envConstraints);
  } catch (e1) {
    try {
      return await navigator.mediaDevices.getUserMedia(fallback1);
    } catch (e2) {
      return await navigator.mediaDevices.getUserMedia(fallback2);
    }
  }
}

function _ensureScanElements() {
  // Dynamically create missing scan elements if not in HTML
  const container = document.querySelector('.qr-scan-container');
  if (!container) return;
  if (!$('qr-scan-canvas')) {
    const canvas = document.createElement('canvas');
    canvas.id = 'qr-scan-canvas';
    canvas.style.display = 'none';
    container.appendChild(canvas);
  }
  if (!$('qr-scan-result')) {
    const resultDiv = document.createElement('div');
    resultDiv.id = 'qr-scan-result';
    resultDiv.style.cssText = 'display:none;position:absolute;bottom:0;left:0;right:0;background:rgba(10,18,12,.95);padding:16px;border-top:2px solid var(--olive3);z-index:50';
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px';
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-md btn-olive btn-full';
    importBtn.textContent = '✓ ייבא נתונים';
    importBtn.onclick = function() { importScannedQR(); };
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-md btn-ghost';
    closeBtn.textContent = '✕';
    closeBtn.onclick = function() { resultDiv.style.display = 'none'; _resumeScanLoop(); };
    btnRow.appendChild(importBtn);
    btnRow.appendChild(closeBtn);
    resultDiv.appendChild(btnRow);
    container.appendChild(resultDiv);
  }
}

function startQRScan() {
  _resetQRScanState();
  const overlay = $('qr-scan-overlay');
  if (!overlay) { showToast('⚠ QR Scanner UI not found'); return; }
  _ensureScanElements();
  overlay.style.display = 'flex';
  const pasteArea = $('qr-scan-paste-area');
  if (pasteArea) pasteArea.style.display = 'none';
  const pasteTxt = $('qr-scan-paste');
  if (pasteTxt) pasteTxt.value = '';
  const resultEl = $('qr-scan-result');
  if (resultEl) resultEl.style.display = 'none';
  const statusEl = $('qr-scan-status');
  if (statusEl) statusEl.textContent = 'מפעיל מצלמה...';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    _setScanStatus('⚠ הדפדפן לא תומך בגישה למצלמה. השתמש ב"סרוק מתמונה"', true);
    return;
  }

  _openScanCamera()
    .then(stream => _startScanVideo(stream))
    .catch(e => {
      _setScanStatus('⚠ ' + _cameraErrorMessage(e) + ' — אפשר לסרוק מתמונה', true);
    });
}

let _barcodeDetector = null;
let _scanFrameSkip = 0;
let _scanProcessing = false; // guard against concurrent async processing

function _scanLoop() {
  if (!_scanStream) return;
  if (_scanProcessing) {
    // Previous async _handleScanResult still running — wait for it
    _scanAnimId = requestAnimationFrame(_scanLoop);
    return;
  }
  const video = $('qr-scan-video');
  const canvas = $('qr-scan-canvas');
  if (!video || !canvas || video.readyState < 2) {
    _scanAnimId = requestAnimationFrame(_scanLoop);
    return;
  }

  // Optimize: only resize canvas if video dimensions changed
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  // Priority path: Hardware-accelerated BarcodeDetector (Chrome/Android)
  if ('BarcodeDetector' in window) {
    // No frame skip for native detector - it's fast
    if (!_barcodeDetector) _barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
    _barcodeDetector.detect(video).then(async (codes) => {
      if (codes.length > 0 && codes[0].rawValue) {
        _scanProcessing = true;
        try { await _handleScanResult(codes[0].rawValue); } finally { _scanProcessing = false; }
      } else {
        _scanAnimId = requestAnimationFrame(_scanLoop);
      }
    }).catch(() => { _scanAnimId = requestAnimationFrame(_scanLoop); });
    return;
  }

  // Software path: jsQR (iOS/Safari)
  // Scan every frame for maximum responsiveness
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0);
  if (typeof jsQR === 'function') {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) {
      _scanProcessing = true;
      _handleScanResult(code.data).finally(() => { _scanProcessing = false; });
      return;
    }
  }

  _scanAnimId = requestAnimationFrame(_scanLoop);
}

function _resumeScanLoop() {
  _scanAnimId = requestAnimationFrame(_scanLoop);
}

function _showScanProgress(label, received, total) {
  const st = $('qr-scan-status');
  if (!st) return;
  // Build chunk grid visualization
  let grid = '';
  if (total > 1) {
    grid = '<div style="display:flex;gap:3px;justify-content:center;margin-top:4px;flex-wrap:wrap">';
    for (let i = 0; i < total; i++) {
      const got = _scannedChunks[i] !== undefined;
      grid += `<div style="width:${Math.min(24, Math.max(10, 200/total))}px;height:8px;border-radius:2px;background:${got ? 'var(--green2)' : 'var(--glass-bg)'}${got ? ';box-shadow:0 0 4px var(--shadow-glow-olive)' : ''};transition:all .3s"></div>`;
    }
    grid += '</div>';
  }
  st.innerHTML = `<div>${label} ${received}/${total}</div>${grid}`;
  st.style.background = received >= total ? 'rgba(74,102,64,.9)' : 'rgba(0,0,0,.7)';
  st.style.color = received >= total ? '#fff' : 'var(--amber2)';
}

function _qrScanFeedback(received, total) {
  // Haptic feedback
  try { if (navigator.vibrate) navigator.vibrate(received >= total ? [100, 50, 100] : 80); } catch (_) {}
  // Audio feedback (short beep)
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = received >= total ? 880 : 660;
    gain.gain.value = 0.15;
    osc.start(); osc.stop(ctx.currentTime + (received >= total ? 0.2 : 0.1));
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch (_) {}
}

function _acceptScannedPacket(packet, jsonText) {
  _scannedJSON = jsonText;
  _scannedPacket = packet;
  _showScanResult(packet);
}

function _acceptLegacyStatePayload(d, raw) {
  const packet = {
    kind: QR_PACKET_KIND_STATE,
    format: 1,
    exportedAt: d.t || Date.now(),
    state: {
      casualties: d.cas || [],
      timeline: d.tl || [],
      comms: d.comms || {},
      missionStart: d.mission || null,
      missionActive: !!d.mission
    }
  };
  _acceptScannedPacket(packet, raw);
}

async function _handleScanResult(raw) {
  const now = Date.now();
  if (raw === _lastScanRaw && now - _lastScanTs < 900) {
    _resumeScanLoop();
    return;
  }
  _lastScanRaw = raw;
  _lastScanTs = now;

  try {
    const d = JSON.parse(raw);

    // --- MODERN BURST (Binary-Burst 3.0 / FEC) ---
    if (d.k === QR_ENVELOPE_KIND && d.id && d.h && Number.isInteger(d.i) && Number.isInteger(d.n)) {
      if (_scanPacketId && (_scanPacketId !== d.id || _scanPacketHash !== d.h)) {
        _scannedChunks = {};
        _scanFecFormat = 0;
      }
      _scanPacketId = d.id;
      _scanPacketHash = d.h;
      _scanPacketTotal = d.n;
      
      const isNew = _scannedChunks[d.i] === undefined;
      _scannedChunks[d.i] = d.d;
      // Track FEC encoding format for the parity chunk
      if (d.fec) _scanFecFormat = d.fec;

      const currentCount = Object.keys(_scannedChunks).length;
      if (isNew) _qrScanFeedback(currentCount, d.n);
      _showScanProgress(isNew ? `✓ חלק ${d.i + 1} נסרק` : `חלק ${d.i + 1} כבר נקלט`, currentCount, d.n);

      const total = d.n;
      const parityIdx = total - 1; // parity is always the last chunk

      // Self-Healing (FEC) Logic — recover one missing data chunk via XOR parity
      let _fecRecovered = false;
      if (currentCount === total - 1) {
        let missingIdx = -1;
        for (let i = 0; i < total; i++) if (_scannedChunks[i] === undefined) { missingIdx = i; break; }

        if (missingIdx !== -1 && missingIdx < parityIdx) {
          // Decode parity bytes — fec:2 means base64-encoded, fec:1 means raw string
          let parityBytes;
          const parityData = _scannedChunks[parityIdx];
          if (_scanFecFormat === 2) {
            // Base64-encoded parity (new format)
            const bin = atob(parityData);
            parityBytes = new Uint8Array(bin.length);
            for (let j = 0; j < bin.length; j++) parityBytes[j] = bin.charCodeAt(j);
          } else {
            // Raw string parity (legacy fec:1 format)
            parityBytes = new Uint8Array(QR_CHUNK_SIZE);
            for (let j = 0; j < parityData.length; j++) parityBytes[j] = parityData.charCodeAt(j);
          }

          // XOR parity with all other data chunks to recover the missing one
          let recovery = new Uint8Array(parityBytes);
          for (let i = 0; i < parityIdx; i++) {
            if (i === missingIdx) continue;
            const cStr = _scannedChunks[i];
            for (let j = 0; j < cStr.length; j++) recovery[j] ^= cStr.charCodeAt(j);
          }
          // Trim trailing nulls only (preserve internal data integrity)
          let recLen = recovery.length;
          while (recLen > 0 && recovery[recLen - 1] === 0) recLen--;
          _scannedChunks[missingIdx] = String.fromCharCode(...recovery.subarray(0, recLen));
          _fecRecovered = true;
          _showScanProgress(`♻ שיחזור נתונים (FEC) — `, total, total);
        }
      }

      // Check if we have all DATA chunks (indices 0..total-2); parity chunk (total-1) is not needed for assembly
      const dataChunkCount = total - 1; // number of data chunks (excluding parity)
      let haveAllData = true;
      for (let i = 0; i < dataChunkCount; i++) {
        if (_scannedChunks[i] === undefined) { haveAllData = false; break; }
      }

      if (haveAllData) {
        // Build raw b64 data from data chunks only
        let b64 = '';
        for (let i = 0; i < dataChunkCount; i++) {
          b64 += _scannedChunks[i];
        }

        let full;
        let hashSource; // the string to verify hash against (must match export-side hash input)
        try {
          if (d.z === 1) { // Binary-Burst Compressed
            const decompressed = await _decompress(b64);
            hashSource = decompressed; // export hashes the short-key JSON before compression
            const mapped = JSON.parse(decompressed);
            full = JSON.stringify(_mapKeys(mapped, SYNC_REV_MAP));
          } else { // Standard Base64
            full = _base64ToUtf8(b64);
            hashSource = full;
          }
        } catch (decErr) {
          console.warn('[QR] Decompression/parse error:', decErr.message);
          _setScanStatus('⚠ שגיאת פענוח — סרוק שוב', true);
          _scannedChunks = {};
          _resumeScanLoop();
          return;
        }

        // Verify hash — skip for FEC-recovered data (parity padding may alter the result)
        if (_hashText(hashSource) !== d.h && !_fecRecovered) {
          console.warn('[QR] Hash mismatch: expected', d.h, 'got', _hashText(hashSource));
          _setScanStatus('⚠ שגיאת Checksum — סרוק שוב', true);
          _scannedChunks = {};
          _resumeScanLoop();
          return;
        }

        try {
          _acceptScannedPacket(JSON.parse(full), full);
        } catch (parseErr) {
          console.warn('[QR] Final JSON parse error:', parseErr.message);
          _setScanStatus('⚠ שגיאת JSON — סרוק שוב', true);
          _scannedChunks = {};
          _resumeScanLoop();
        }
        return;
      }
      
      _resumeScanLoop();
      return;
    }

    // --- LEGACY FORMATS ---
    if (d.B !== undefined && d.n !== undefined) { // v1.0 Base64
      _scannedChunks[d.i] = d.B;
      const count = Object.keys(_scannedChunks).length;
      _showScanProgress('v1.0 חלק ·', count, d.n);
      if (count >= d.n) {
        let b64 = '';
        for (let i = 0; i < d.n; i++) b64 += _scannedChunks[i] || '';
        const full = _base64ToUtf8(b64);
        _acceptScannedPacket(JSON.parse(full), full);
      } else { _resumeScanLoop(); }
      return;
    }

    if (d._qrChunk) { // v1.0 Map
      _scannedChunks[d.i] = d.d;
      const count = Object.keys(_scannedChunks).length;
      _showScanProgress('Legacy ·', count, d.n);
      if (count >= d.n) {
        let text = '';
        for (let i = 0; i < d.n; i++) text += _scannedChunks[i] || '';
        _acceptScannedPacket(JSON.parse(text), text);
      } else { _resumeScanLoop(); }
      return;
    }

    if (d.kind === QR_PACKET_KIND_STATE || d.kind === QR_PACKET_KIND_MESH) {
      _acceptScannedPacket(d, raw);
      return;
    }
    if (d.type === 'casualty' && d.casualty) {
      _acceptScannedPacket({ kind: 'single_casualty', casualty: d.casualty }, raw);
      return;
    }
    if (d.v && d.cas) {
      _acceptLegacyStatePayload(d, raw);
      return;
    }

    _setScanStatus('⚠ QR לא מכיל נתוני BENAM', true);
    _resumeScanLoop();

  } catch (e) {
    _setScanStatus('QR נמצא — ממשיך לחפש...', false);
    _resumeScanLoop();
  }
}

function _showScanResult(packet) {
  stopScanStream();
  const st = $('qr-scan-status');
  if (st) {
    st.textContent = '✓ QR נסרק בהצלחה!';
    st.style.background = 'rgba(74,102,64,.9)';
    st.style.color = '#fff';
  }
  // Success feedback
  _qrScanFeedback(1, 1);
  const info = $('qr-scan-info');
  if (!info) { const res = $('qr-scan-result'); if (res) res.style.display = 'block'; return; }
  if (packet.kind === 'single_casualty') {
    const c = packet.casualty;
    info.innerHTML = `
      <div style="font-weight:700;color:var(--olive3);margin-bottom:4px">👤 Single Casualty Import</div>
      <div style="font-size:16px;font-weight:900">${escHTML(c.name)} <span class="prio pt${c.priority[1]}">${c.priority}</span></div>
      <div style="font-size:12px;color:var(--muted)">Blood: ${c.blood || '?'} | Weight: ${c.kg}kg</div>
      <div style="font-size:11px;color:var(--muted2);margin-top:4px">מנגנון: ${c.mech?.join(', ') || '—'}</div>
    `;
  } else if (packet.kind === QR_PACKET_KIND_MESH) {
    const casCount = packet.casualties?.length || 0;
    const tlCount = packet.timeline?.length || 0;
    const ts = packet.exportedAt ? new Date(packet.exportedAt).toLocaleTimeString('he-IL') : '—';
    const unit = packet.unit ? ` | יחידה: ${escHTML(packet.unit)}` : '';
    // Show triage breakdown
    const t1 = (packet.casualties || []).filter(c => c.priority === 'T1').length;
    const t2 = (packet.casualties || []).filter(c => c.priority === 'T2').length;
    const t3 = (packet.casualties || []).filter(c => c.priority === 'T3').length;
    const t4 = (packet.casualties || []).filter(c => c.priority === 'T4').length;
    info.innerHTML = `
      <div style="font-weight:700;color:var(--olive3);margin-bottom:4px">🔗 Mesh Update${unit}</div>
      <div>📊 ${casCount} פגועים: <span style="color:var(--red2)">T1:${t1}</span> <span style="color:var(--amber)">T2:${t2}</span> <span style="color:var(--green2)">T3:${t3}</span> <span style="color:var(--muted)">T4:${t4}</span></div>
      <div>📝 ${tlCount} אירועי timeline</div>
      <div>⏱ נוצר: ${ts}</div>`;
  } else {
    const state = packet.state || {};
    const cas = state.casualties || [];
    const t1 = cas.filter(c => c.priority === 'T1').length;
    const t2 = cas.filter(c => c.priority === 'T2').length;
    const t3 = cas.filter(c => c.priority === 'T3').length;
    const t4 = cas.filter(c => c.priority === 'T4').length;
    const unit = packet.unit ? ` | יחידה: ${escHTML(packet.unit)}` : '';
    info.innerHTML = `
      <div style="font-weight:700;color:var(--olive3);margin-bottom:4px">📋 Full State${unit}</div>
      <div>📊 ${cas.length} פגועים: <span style="color:var(--red2)">T1:${t1}</span> <span style="color:var(--amber)">T2:${t2}</span> <span style="color:var(--green2)">T3:${t3}</span> <span style="color:var(--muted)">T4:${t4}</span></div>
      <div>👥 ${(state.force || []).length} אנשי צוות</div>
      <div>📝 ${(state.timeline || []).length} אירועי timeline</div>
      <div>⏱ ${state.missionStart ? new Date(state.missionStart).toLocaleTimeString('he-IL') : 'לא פעיל'}</div>`;
  }
  const resultEl = $('qr-scan-result');
  if (resultEl) resultEl.style.display = 'block';
}