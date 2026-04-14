async function _buildExportJSON() {
  return JSON.stringify(await _buildStateExportPacket());
}

async function exportStateQR() {
  const bundle = await _buildQRBundle(await _buildStateExportPacket());
  _exportJSON = bundle.json;
  const overlay = $('qr-export-overlay');
  overlay.style.display = 'block';
  const codeDiv = $('qr-export-code');
  codeDiv.innerHTML = '';
  const infoDiv = $('qr-export-info');

  if (typeof QRCode === 'undefined') {
    codeDiv.innerHTML = '<div style="color:#c00;padding:20px;font-size:12px">ספריית QR לא נטענה — נסה לרענן את הדף</div>';
    return;
  }

  _renderQRBundle(codeDiv, bundle);

  // Rich info display
  const sizeKB = (bundle.size / 1024).toFixed(1);
  const chunkInfo = bundle.chunks.length > 1 ? ` | ${bundle.chunks.length} חלקים — לחץ ▶ להעברה אוטומטית` : '';
  infoDiv.innerHTML = `<span style="font-weight:700">${S.casualties.length} פגועים</span> | ${sizeKB}KB${chunkInfo} | <span style="font-family:monospace;font-size:9px">${bundle.hash}</span>`;

  showToast(bundle.chunks.length > 1 ? `✓ ${bundle.chunks.length} QR מוכנים — לחץ ▶ אוטומטי` : '✓ QR מוכן לסריקה');
  addTL('sys', 'SYSTEM', 'ייצוא מצב QR Sync', 'green');
}

function _showChunk(dir) {
  const n = window._qrChunkTotal;
  if (!n) return;
  // Manual navigation stops auto-play
  if (_qrAutoPlay) _qrStopAutoPlay();
  const next = (window._qrChunkIdx + dir + n) % n;
  _qrGoToChunk(next);
}

function closeQRExport() {
  _qrStopAutoPlay();
  $('qr-export-overlay').style.display = 'none';
  _qrRenderedBundle = null;
}

async function copyExportJSON() {
  if (!_exportJSON) { _exportJSON = await _buildExportJSON(); }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(_exportJSON).then(() => {
      showToast('✓ JSON הועתק! (' + (_exportJSON.length / 1024).toFixed(1) + 'KB)');
    }).catch(() => _copyFallback(_exportJSON));
  } else {
    _copyFallback(_exportJSON);
  }
}

function _copyFallback(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✓ JSON הועתק!');
  } catch (e) {
    showToast('⚠ לא הצליח להעתיק — נסה ידנית');
  }
}

async function shareStateViaWebShare() {
  if (!_exportJSON) { _exportJSON = await _buildExportJSON(); }
  // Try file share first (more reliable for large data)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = new Blob([_exportJSON], { type: 'application/json' });
      const file = new File([blob], `benam-sync-${new Date().toISOString().slice(0, 16).replace(/:/g, '')}.json`, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ title: 'BENAM Sync', files: [file] }).catch(() => {});
        return;
      }
    } catch (_) {}
  }
  // Fallback to text share
  if (navigator.share) {
    navigator.share({ title: 'BENAM State', text: _exportJSON }).catch(() => { });
  } else {
    copyExportJSON();
  }
}

// ═══ QR SCAN ═══
let _scanStream = null;
let _scanAnimId = null;
let _scannedChunks = {};
let _scannedJSON = '';

function _resetQRScanState() {
  stopScanStream();
  _scannedChunks = {};
  _scannedJSON = '';
  _scannedPacket = null;
  _scanPacketId = '';
  _scanPacketHash = '';
  _scanPacketTotal = 0;
  _scanFecFormat = 0;
  _lastScanRaw = '';
  _lastScanTs = 0;
  _scanProcessing = false;
  const st = $('qr-scan-status');
  if (st) {
    st.textContent = 'מחפש QR...';
    st.style.background = 'rgba(0,0,0,.7)';
    st.style.color = 'var(--amber2)';
  }
}

function _cameraErrorMessage(err) {
  const name = err && err.name ? err.name : '';
  if (!window.isSecureContext) {
    return 'הגישה למצלמה דורשת HTTPS או localhost';
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'הגישה למצלמה נחסמה. אשר הרשאת מצלמה בדפדפן';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'לא נמצאה מצלמה זמינה במכשיר';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'המצלמה תפוסה על ידי אפליקציה אחרת';
  }
  return 'לא ניתן לפתוח מצלמה';
}

function _setScanStatus(text, isError) {
  const st = $('qr-scan-status');
  if (!st) return;
  st.textContent = text;
  if (isError) {
    st.style.background = 'rgba(120,20,20,.75)';
    st.style.color = '#ffd8d8';
  }
}

function toggleQRPasteArea() {
  const box = $('qr-scan-paste-area');
  if (!box) return;
  const on = box.style.display === 'block';
  box.style.display = on ? 'none' : 'block';
  if (!on) {
    const ta = $('qr-scan-paste');
    if (ta) ta.focus();
  }
}

async function importPastedQR() {
  const ta = $('qr-scan-paste');
  const raw = (ta?.value || '').trim();
  if (!raw) { showToast('הדבק נתונים לפני פענוח'); return; }

  const beforeJSON = _scannedJSON;
  const beforePacket = _scannedPacket;
  const attempts = [raw];
  try {
    const decoded = _base64ToUtf8(raw);
    if (decoded && decoded !== raw) attempts.push(decoded);
  } catch (e) { }

  for (const candidate of attempts) {
    await _handleScanResult(candidate);
    if (_scannedPacket || (_scannedJSON && _scannedJSON !== beforeJSON) || (_scannedPacket !== beforePacket)) {
      showToast('✓ נתונים נקלטו מהדבקה');
      return;
    }
  }

  _setScanStatus('⚠ פורמט לא מזוהה. נסה JSON מלא או סריקה מתמונה', true);
}

function triggerQRImageScan() {
  const inp = $('qr-scan-file');
  if (!inp) return;
  inp.value = '';
  inp.click();
}

function _decodeQRFromCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (typeof jsQR === 'function') {
    const code = jsQR(imgData.data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' });
    if (code && code.data) return code.data;
  }
  return null;
}

function _drawImageToCanvas(img) {
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

function _loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('טעינת תמונה נכשלה'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('קריאת קובץ נכשלה'));
    reader.readAsDataURL(file);
  });
}

async function onQRImageSelected(ev) {
  const file = ev?.target?.files?.[0];
  if (!file) return;
  try {
    stopScanStream();
    _setScanStatus('מפענח QR מהתמונה...', false);
    const img = await _loadImageFromFile(file);
    const canvas = _drawImageToCanvas(img);
    let raw = _decodeQRFromCanvas(canvas);
    if (!raw && 'BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(canvas);
      if (codes && codes[0] && codes[0].rawValue) raw = codes[0].rawValue;
    }
    if (!raw) {
      _setScanStatus('⚠ לא זוהה QR בתמונה. נסה צילום חד יותר', true);
      return;
    }
    await _handleScanResult(raw);
  } catch (e) {
    _setScanStatus('⚠ שגיאה בקריאת תמונה: ' + (e?.message || 'לא ידוע'), true);
  } finally {
    if (ev?.target) ev.target.value = '';
  }
}

let _torchOn = false;

function _startScanVideo(stream) {
  const video = $('qr-scan-video');
  _scanStream = stream;
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  video.muted = true;
  video.play().catch(() => { });
  const _sst = $('qr-scan-status'); if (_sst) _sst.textContent = 'מחפש QR...';

  // Check torch support and show button
  _torchOn = false;
  try {
    const track = stream.getVideoTracks()[0];
    if (track) {
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.torch) {
        const btn = $('torch-btn');
        if (btn) btn.style.display = '';
      }
    }
  } catch (_) {}

  _scanLoop();
}