export function formatClockTime(dateValue) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue || Date.now());
  return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDurationMinutes(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function formatLabelValue(label, value) {
  return `${label}: ${value ?? '—'}`;
}