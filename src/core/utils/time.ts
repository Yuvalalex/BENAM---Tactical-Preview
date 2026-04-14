/**
 * Time formatting and calculation utilities.
 *
 * Centralizes all time-related logic that was scattered across app.js
 * as anonymous closures and inline calculations.
 */

/**
 * Format a Date or timestamp into HH:MM string.
 */
export function formatTime(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format a Date or timestamp into HH:MM:SS string.
 */
export function formatTimeSeconds(date: Date | number = new Date()): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Format elapsed seconds as MM:SS or HH:MM:SS.
 */
export function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Calculate elapsed minutes between two timestamps.
 */
export function elapsedMinutes(from: number, to: number = Date.now()): number {
  return Math.floor((to - from) / 60000);
}

/**
 * Calculate elapsed seconds between two timestamps.
 */
export function elapsedSeconds(from: number, to: number = Date.now()): number {
  return Math.floor((to - from) / 1000);
}

/**
 * Format a relative time string (e.g., "2 min ago", "just now").
 */
export function formatTimeAgo(timestamp: number, now: number = Date.now()): string {
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return formatTime(timestamp);
}

/**
 * Check if a timestamp is within a time window (in minutes) from now.
 */
export function isWithinWindow(timestamp: number, windowMinutes: number): boolean {
  return elapsedMinutes(timestamp) <= windowMinutes;
}
