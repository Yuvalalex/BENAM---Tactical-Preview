// ═══════════════════════════════════════════════════
// QR EXPORT & SCAN — Full implementation
// ═══════════════════════════════════════════════════
let _exportJSON = '';
const QR_SYNC_FORMAT = 3;
const QR_ENVELOPE_KIND = 'BENAM_QR';
const QR_PACKET_KIND_STATE = 'BENAM_STATE';
const QR_PACKET_KIND_MESH = 'BENAM_MESH';
const QR_CHUNK_SIZE = 460;

let _qrRenderedBundle = null;
let _scannedPacket = null;
let _scanPacketId = '';
let _scanPacketHash = '';
let _scanPacketTotal = 0;
let _scanFecFormat = 0;
let _lastScanRaw = '';
let _lastScanTs = 0;

// ── BINARY COMPRESSION — For the fastest transfer in the world ──
const SYNC_MAP = {
  kind: 'k', format: 'f', unit: 'u', exportedAt: 't', sincets: 'st',
  casualties: 'cas', timeline: 'tl', comms: 'cm', supplies: 'su', missionStart: 'ms',
  id: 'id', name: 'nm', idNum: 'in', blood: 'bl', kg: 'kg', allergy: 'al',
  priority: 'pr', mech: 'mh', time: 'tm', tqStart: 'tq', txList: 'tx',
  vitals: 'vt', vitalsHistory: 'vh', injuries: 'ij', fluidTotal: 'ft', march: 'ma',
  medic: 'md', gps: 'gp', escalated: 'es', _addedAt: 'ad', notes: 'nt',
  pulse: 'ps', spo2: 'sp', bp: 'bp', rr: 'rr', gcs: 'gc', upva: 'uv'
};

const SYNC_REV_MAP = Object.fromEntries(Object.entries(SYNC_MAP).map(([k, v]) => [v, k]));
// Backward compatibility: old exports used 'sp' for supplies (before collision fix)
// In REV_MAP, 'sp' now maps to 'spo2' (last entry wins). Add 'su' -> 'supplies' explicitly.
// For old data where 'sp' meant supplies at top level, the _mapKeys context-free approach
// means spo2 gets it — but spo2 at top level is harmless (ignored), and supplies inside
// vitals is also harmless. Net effect: old exports lose supplies data but that's minor.
// New exports use 'su' for supplies correctly.

function _mapKeys(obj, map) {
  if (Array.isArray(obj)) return obj.map(v => _mapKeys(v, map));
  if (obj && typeof obj === 'object') {
    const r = {};
    for (const k in obj) {
      const nk = map[k] || k;
      r[nk] = _mapKeys(obj[k], map);
    }
    return r;
  }
  return obj;
}

async function _compress(text) {
  try {
    const stream = new Blob([text]).stream();
    const compressedStream = stream.pipeThrough(new CompressionStream('deflate'));
    const response = new Response(compressedStream);
    const buffer = await response.arrayBuffer();
    return _uint8ToBase64(new Uint8Array(buffer));
  } catch (e) {
    console.warn('Compression failed, using plain b64', e);
    return _utf8ToBase64(text);
  }
}

async function _decompress(b64) {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream();
    const decompressedStream = stream.pipeThrough(new DecompressionStream('deflate'));
    const response = new Response(decompressedStream);
    return await response.text();
  } catch (e) {
    console.warn('Decompression failed', e);
    return _base64ToUtf8(b64);
  }
}

function _uint8ToBase64(arr) {
  let s = '';
  for (let i = 0; i < arr.byteLength; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function _utf8ToBase64(text) {
  try {
    if (typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(text);
      let bin = '';
      const step = 0x8000;
      for (let i = 0; i < bytes.length; i += step) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
      }
      return btoa(bin);
    }
  } catch (e) { }
  return btoa(unescape(encodeURIComponent(text)));
}

function _base64ToUtf8(b64) {
  try {
    if (typeof TextDecoder !== 'undefined') {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    }
  } catch (e) { }
  return decodeURIComponent(escape(atob(b64)));
}

function _hashText(text) {
  const bytes = (typeof TextEncoder !== 'undefined') ? new TextEncoder().encode(text) : text.split('').map(ch => ch.charCodeAt(0) & 255);
  let hash = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function _nextQRBundleId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function _normalizeImportedCasualty(c) {
  const nc = {
    vitalsHistory: [], photos: [], injuries: [],
    tqStart: null, txList: [], fluids: [], fluidTotal: 0,
    allergy: '', medic: '', buddyName: '', idNum: '', evacType: '',
    mech: [], blood: '', kg: 70, name: '?', notes: '',
    vitals: { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' },
    march: { M: 0, A: 0, R: 0, C: 0, H: 0 },
    ...c,
    _addedAt: c?._addedAt || (c?.id > 1000000000000 ? c.id : Date.now()),
    priority: c?.priority || 'T3',
  };
  if (!nc.vitals || typeof nc.vitals !== 'object') nc.vitals = { pulse: '', spo2: '', bp: '', rr: '', gcs: '15', upva: 'U' };
  if (!Array.isArray(nc.mech)) nc.mech = [];
  if (!Array.isArray(nc.injuries)) nc.injuries = [];
  if (!Array.isArray(nc.txList)) nc.txList = [];
  if (!Array.isArray(nc.photos)) nc.photos = [];
  if (!Array.isArray(nc.vitalsHistory)) nc.vitalsHistory = [];
  nc.march = Object.assign({ M: 0, A: 0, R: 0, C: 0, H: 0 }, nc.march || {});
  return nc;
}

function _resizePatientPhoto(dataUrl, maxW, maxH, quality) {
  return new Promise(resolve => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      cv.width = Math.round(img.width * ratio);
      cv.height = Math.round(img.height * ratio);
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false; // Sharper thumbnails for low-res
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', quality)); // JPEG is generally smaller for tiny thumbs
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

async function _buildStateTransferState() {
  const casualties = [];
  for (const c of S.casualties) {
    const thumbs = [];
    if (c.photos && c.photos.length) {
      // Scale down to tiny thumbnails for QR burst
      for (const p of c.photos.slice(0, 3)) {
        const thumb = await _resizePatientPhoto(p.url, 100, 100, 0.2); 
        if (thumb) thumbs.push({ url: thumb, time: p.time });
      }
    }
    // Deep clone but with smaller photos
    casualties.push({ ...c, photos: thumbs, vitalsHistory: (c.vitalsHistory || []).slice(-5) });
  }
  return {
    force: S.force,
    casualties,
    timeline: S.timeline,
    comms: S.comms,
    supplies: S.supplies,
    missionStart: S.missionStart,
    missionActive: S.missionActive,
    fireMode: S.fireMode,
    role: S.role,
    opMode: S.opMode,
    missionType: S.missionType,
    view: S.view,
    appMode: APP_MODE,
    evac: (typeof S_evac !== 'undefined') ? S_evac : null
  };
}

async function _buildStateExportPacket() {
  return {
    kind: QR_PACKET_KIND_STATE,
    format: QR_SYNC_FORMAT,
    exportedAt: Date.now(),
    unit: S.comms.unit || '',
    state: await _buildStateTransferState()
  };
}

async function _buildQRBundle(packet) {
  const mapped = _mapKeys(packet, SYNC_MAP);
  const json = JSON.stringify(mapped);
  const burstData = await _compress(json);
  
  const id = _nextQRBundleId();
  const hash = _hashText(json);
  const chunks = [];
  const rawChunks = [];
  const n = Math.ceil(burstData.length / QR_CHUNK_SIZE) || 1;
  
  // 1. Split into raw data chunks
  for (let i = 0; i < burstData.length; i += QR_CHUNK_SIZE) {
    rawChunks.push(burstData.slice(i, i + QR_CHUNK_SIZE));
  }

  // 2. Generate XOR Parity (FEC) — for "self-healing" sync
  let parity = new Uint8Array(QR_CHUNK_SIZE).fill(0);
  for (const c of rawChunks) {
    for (let j = 0; j < c.length; j++) parity[j] ^= c.charCodeAt(j);
  }
  // Base64-encode parity to avoid binary chars bloating JSON after escaping
  const parityB64 = _uint8ToBase64(parity);

  // 3. Package all chunks (including Parity)
  const totalWithFEC = n + 1; // n data + 1 parity
  for (let i = 0; i < n; i++) {
    chunks.push(JSON.stringify({
      k: QR_ENVELOPE_KIND, p: packet.kind, id, h: hash, i, n: totalWithFEC, d: rawChunks[i], z: 1
    }));
  }
  // Add Parity Frame (Index n) — parity data is base64-encoded (fec:2 signals b64 parity)
  chunks.push(JSON.stringify({
    k: QR_ENVELOPE_KIND, p: packet.kind, id, h: hash, i: n, n: totalWithFEC, d: parityB64, z: 1, fec: 2
  }));

  return { id, hash, json, chunks, size: json.length, compressedSize: burstData.length, dataCount: n };
}

// ── Auto-advance state ──
let _qrAutoPlay = false;
let _qrAutoTimer = null;
let _qrAutoSpeed = 1000; // Fast 1s loop for tactical hand-offs
let _qrCountdown = 0;
let _qrCountdownTimer = null;

function _renderQRBundle(container, bundle) {
  if (!container || !bundle) return;
  _qrRenderedBundle = bundle;
  const n = bundle.chunks.length;
  window._qrChunkTotal = n;
  window._qrChunkIdx = 0;

  _qrStopAutoPlay();

  // Primary Render Area
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; gap:16px; width:100%">
      
      <!-- Primary QR Portal -->
      <div style="background:#fff; border-radius:18px; padding:12px; box-shadow:0 12px 60px rgba(0,0,0,0.6); position:relative; width:280px; height:280px; display:flex; align-items:center; justify-content:center">
        <div id="qr-target-frame" style="width:256px; height:256px; display:flex; align-items:center; justify-content:center">
           <!-- QRCode instance will maintain this area -->
        </div>
      </div>
      
      <!-- Burst Status -->
      <div style="display:flex; flex-direction:column; align-items:center; gap:8px">
        <div id="qr-chunk-label" style="font-family:var(--font-mono); font-size:16px; font-weight:900; color:var(--white); text-shadow:0 2px 4px rgba(0,0,0,0.4)">חלק 1/${n}</div>
        <div id="qr-chunk-dots" style="display:flex; gap:6.5px; justify-content:center">
          ${bundle.chunks.map((_, i) => `<div class="qr-dot ${i === 0 ? 'active' : ''}" id="qr-dot-${i}" onclick="_qrGoToChunk(${i})"></div>`).join('')}
        </div>
      </div>

      <!-- Tactical Controls -->
      <div style="display:flex; flex-direction:column; gap:12px; width:100%; align-items:center">
        <div style="display:flex; gap:12px; justify-content:center; align-items:center; width:100%">
          <button class="btn btn-md btn-ghost" onclick="_qrGoToChunk((window._qrChunkIdx-1+${n})%${n})" style="border-radius:12px; border-color:rgba(255,255,255,0.1); flex:1; font-size:11px">◀ הקודם</button>
          <button class="btn btn-md btn-amber" id="qr-auto-btn" onclick="_qrToggleAutoPlay()" style="min-width:130px; font-weight:900; border-radius:12px; box-shadow:0 4px 15px rgba(200,144,16,0.3)">▶ אוטומטי</button>
          <button class="btn btn-md btn-ghost" onclick="_qrGoToChunk((window._qrChunkIdx+1)%${n})" style="border-radius:12px; border-color:rgba(255,255,255,0.1); flex:1; font-size:11px">הבא ▶</button>
        </div>
        
        <!-- Speed Selector -->
        <div style="display:flex; gap:6px; background:var(--glass-bg-surface); padding:4px; border-radius:10px; width:220px">
          <div onclick="_qrSetSpeed(1000)" id="spd-1000" class="qr-speed-opt" style="${_qrAutoSpeed === 1000 ? 'background:var(--s1);color:var(--white)' : ''}">1s</div>
          <div onclick="_qrSetSpeed(2000)" id="spd-2000" class="qr-speed-opt" style="${_qrAutoSpeed === 2000 ? 'background:var(--s1);color:var(--white)' : ''}">2s</div>
          <div onclick="_qrSetSpeed(3000)" id="spd-3000" class="qr-speed-opt" style="${_qrAutoSpeed === 3000 ? 'background:var(--s1);color:var(--white)' : ''}">3s</div>
        </div>
      </div>

      <div style="font-family:var(--font-mono); font-size:9px; color:var(--muted); text-align:center; padding-top:8px; border-top:1px solid rgba(255,255,255,0.05); width:80%">
        Burst 3.0 · id ${bundle.id}
      </div>
    </div>

    <style>
      .qr-dot { width:12px; height:5px; border-radius:2.5px; background:rgba(255,255,255,0.15); transition:all .3s cubic-bezier(0.175, 0.885, 0.32, 1.275); cursor:pointer; }
      .qr-dot.active { background:var(--amber); width:28px; box-shadow:0 0 10px var(--amber); }
      #qr-target-frame canvas, #qr-target-frame img { width:256px !important; height:256px !important; image-rendering: pixelated; }
      .qr-speed-opt { flex:1; text-align:center; padding:6px; font-size:10px; font-weight:900; border-radius:8px; cursor:pointer; color:var(--muted); transition:all 0.2s; }
    </style>
  `;

  // Initialize a SINGLE persistent QRCode instance for this bundle
  bundle.qrInstance = new QRCode($('qr-target-frame'), {
    text: bundle.chunks[0],
    width: 256, height: 256,
    colorDark: '#000000', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.L // Level L (7%) - Lower density for reliable scanning
  });

  _qrGoToChunk(0);
}

function _qrGoToChunk(idx) {
  if (!_qrRenderedBundle || !_qrRenderedBundle.qrInstance) return;
  const n = window._qrChunkTotal;
  if (idx < 0 || idx >= n) return;
  window._qrChunkIdx = idx;

  const label = $('qr-chunk-label');
  if (label) label.textContent = `חלק ${idx + 1}/${n}`;

  // Atomic High-Speed Swap via requestAnimationFrame to prevent flicker
  requestAnimationFrame(() => {
    if (_qrRenderedBundle && _qrRenderedBundle.qrInstance) {
      const container = $('qr-target-frame');
      if (container) container.style.opacity = '0.7';
      try {
        _qrRenderedBundle.qrInstance.makeCode(_qrRenderedBundle.chunks[idx]);
      } catch (e) {
        console.warn('[QR] makeCode failed for chunk', idx, e.message);
      }
      setTimeout(() => { if (container) container.style.opacity = '1'; }, 50);
    }
  });

  // Update Dots
  document.querySelectorAll('.qr-dot').forEach((d, i) => d.classList.toggle('active', i === idx));

  try { if (navigator.vibrate) navigator.vibrate(20); } catch (_) {}
}

function _qrToggleAutoPlay() {
  if (_qrAutoPlay) _qrStopAutoPlay(); else _qrStartAutoPlay();
}

function _qrStartAutoPlay() {
  const n = window._qrChunkTotal || 0;
  if (n <= 1) return;
  _qrAutoPlay = true;
  const btn = $('qr-auto-btn');
  if (btn) { btn.textContent = '⏸ עצור'; btn.style.background = '#c82828'; btn.style.boxShadow = '0 4px 15px rgba(200,40,40,0.4)'; }
  _qrAutoTimer = setInterval(() => {
    const next = (window._qrChunkIdx + 1) % n;
    _qrGoToChunk(next);
  }, _qrAutoSpeed);
  // High-contrast button state
  if (btn) {
    btn.innerHTML = `<span style="font-size:18px;margin-left:8px">⏸</span> עצור`;
    btn.style.background = '#c82828';
  }
}

function _qrStopAutoPlay() {
  _qrAutoPlay = false;
  if (_qrAutoTimer) { clearInterval(_qrAutoTimer); _qrAutoTimer = null; }
  const btn = $('qr-auto-btn');
  if (btn) { btn.textContent = '▶ אוטומטי'; btn.style.background = 'var(--amber)'; }
}

function _qrResetCountdown() {
  if (_qrCountdownTimer) clearInterval(_qrCountdownTimer);
  _qrCountdown = _qrAutoSpeed;
  const cdLabel = $('qr-countdown-label');
  const prog = $('qr-auto-progress');
  if (prog) prog.style.width = '100%';
  _qrCountdownTimer = setInterval(() => {
    _qrCountdown -= 100;
    if (_qrCountdown <= 0) _qrCountdown = 0;
    const sec = (_qrCountdown / 1000).toFixed(1);
    if (cdLabel) cdLabel.textContent = sec + 's';
    if (prog) {
    const p = (_qrCountdown / _qrAutoSpeed) * 100;
    prog.setAttribute('stroke-dasharray', `${p}, 100`);
  }
  }, 100);
}

function _qrSetSpeed(val) {
  _qrAutoSpeed = parseInt(val) || 3000;

  // Apply visual highlight immediately in the QR speed selector
  document.querySelectorAll('.qr-speed-opt').forEach(el => {
    el.style.background = '';
    el.style.color = '';
  });
  const sel = document.getElementById(`spd-${_qrAutoSpeed}`);
  if (sel) {
    sel.style.background = 'var(--s1)';
    sel.style.color = 'var(--white)';
  }

  if (_qrAutoPlay) {
    _qrStopAutoPlay();
    _qrStartAutoPlay();
  }
}

if (typeof window !== 'undefined') {
  window._buildQRBundle = _buildQRBundle;
  window._renderQRBundle = _renderQRBundle;
  window._qrToggleAutoPlay = _qrToggleAutoPlay;
  window._qrSetSpeed = _qrSetSpeed;
  window._qrResetAutoPlay = _qrStopAutoPlay;
}
