export function getElement(id) {
  return document.getElementById(id);
}

export function padTwoDigits(value) {
  return String(value).padStart(2, '0');
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}