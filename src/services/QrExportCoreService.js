import { QR_PROTOCOL } from '../constants/QrProtocolConstants.js';

export function utf8ToBase64(text) {
  if (typeof window._utf8ToBase64 === 'function') {
    return window._utf8ToBase64(text);
  }
  return btoa(unescape(encodeURIComponent(text)));
}

export function base64ToUtf8(text) {
  if (typeof window._base64ToUtf8 === 'function') {
    return window._base64ToUtf8(text);
  }
  return decodeURIComponent(escape(atob(text)));
}

export function hashText(text) {
  if (typeof window._hashText === 'function') {
    return window._hashText(text);
  }

  let hash = 2166136261;
  const input = String(text);
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildStateExportPacket() {
  if (typeof window._buildStateExportPacket === 'function') {
    return window._buildStateExportPacket();
  }
  return null;
}

export function buildQrBundle(packet) {
  if (typeof window._buildQRBundle === 'function') {
    return window._buildQRBundle(packet);
  }

  const json = JSON.stringify(packet);
  const chunkSize = QR_PROTOCOL.CHUNK_SIZE;
  const base64 = utf8ToBase64(json);
  const chunks = [];
  for (let i = 0; i < base64.length; i += chunkSize) {
    chunks.push(base64.slice(i, i + chunkSize));
  }
  return { json, chunks, size: json.length, hash: hashText(json) };
}

export function initQrExportCoreService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.qrExportCoreService = {
    utf8ToBase64,
    base64ToUtf8,
    hashText,
    buildStateExportPacket,
    buildQrBundle,
  };
}