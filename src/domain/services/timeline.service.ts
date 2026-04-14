/**
 * Timeline Service — Event recording and querying.
 *
 * Manages the chronological event log that powers AAR (After Action Review),
 * Gantt charts, and real-time event feeds.
 */

import {
  type TimelineEvent,
  type CasualtyId,
  TimelineColor,
} from '../../core/types';
import { MEDICAL } from '../../core/constants';
import { formatTimeSeconds, generateId } from '../../core/utils';

export class TimelineService {
  /**
   * Create a new timeline event.
   */
  createEvent(
    casId: CasualtyId | 'sys',
    name: string,
    what: string,
    color: TimelineColor = TimelineColor.OLIVE,
  ): TimelineEvent {
    return {
      casId,
      name,
      what,
      color,
      time: formatTimeSeconds(),
      ms: Date.now(),
      who: name,
    };
  }

  /**
   * Add an event to the timeline, respecting max size limit.
   * Returns the new timeline array (immutable operation).
   */
  addEvent(
    timeline: readonly TimelineEvent[],
    event: TimelineEvent,
  ): TimelineEvent[] {
    const result = [...timeline, event];
    if (result.length > MEDICAL.MAX_TIMELINE_EVENTS) {
      return result.slice(-MEDICAL.MAX_TIMELINE_EVENTS);
    }
    return result;
  }

  /**
   * Filter events by casualty ID.
   */
  byCasualty(
    timeline: readonly TimelineEvent[],
    casId: CasualtyId,
  ): TimelineEvent[] {
    return timeline.filter((e) => e.casId === casId);
  }

  /**
   * Filter system-level events.
   */
  systemEvents(timeline: readonly TimelineEvent[]): TimelineEvent[] {
    return timeline.filter((e) => e.casId === 'sys');
  }

  /**
   * Get events in reverse chronological order.
   */
  reversed(timeline: readonly TimelineEvent[]): TimelineEvent[] {
    return [...timeline].reverse();
  }

  /**
   * Deduplicate events by ms+who (used in mesh merge).
   */
  deduplicate(timeline: readonly TimelineEvent[]): TimelineEvent[] {
    const seen = new Set<string>();
    const result: TimelineEvent[] = [];

    for (const event of timeline) {
      const key = `${event.ms ?? event.time}-${event.who ?? event.name}-${event.what}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(event);
      }
    }

    return result;
  }

  /**
   * Merge two timelines with deduplication and chronological sort.
   */
  merge(
    existing: readonly TimelineEvent[],
    incoming: readonly TimelineEvent[],
  ): TimelineEvent[] {
    const combined = [...existing, ...incoming];
    const deduped = this.deduplicate(combined);
    return deduped.sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0));
  }

  /**
   * Get events within a time window.
   */
  inTimeRange(
    timeline: readonly TimelineEvent[],
    fromMs: number,
    toMs: number,
  ): TimelineEvent[] {
    return timeline.filter((e) => {
      const ms = e.ms ?? 0;
      return ms >= fromMs && ms <= toMs;
    });
  }

  /**
   * Count events by color/severity.
   */
  countByColor(timeline: readonly TimelineEvent[]): Record<TimelineColor, number> {
    const counts: Record<TimelineColor, number> = {
      [TimelineColor.RED]: 0,
      [TimelineColor.AMBER]: 0,
      [TimelineColor.GREEN]: 0,
      [TimelineColor.OLIVE]: 0,
      [TimelineColor.MUTED]: 0,
    };

    for (const event of timeline) {
      if (event.color in counts) {
        counts[event.color]++;
      }
    }

    return counts;
  }
}
