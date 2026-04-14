/** Mesh Sync Service — Device-to-device state synchronization. */

import {
  type Casualty,
  type MeshPayload,
  type Injury,
  type TimelineEvent,
  type SupplyInventory,
  type Treatment,
  QRPacketKind,
} from '../../core/types';
import { isValidCasualty } from '../../core/utils';
import {
  deduplicateByKey,
  mergeWorstMarch,
  mergeTimelines,
  mergeSupplies,
} from './mesh-merge.utils';

/** Removes readonly modifier from all properties of T. */
type Writable<T> = { -readonly [K in keyof T]: T[K] };

export interface MergeResult {
  readonly casualties: Casualty[];
  readonly timeline: TimelineEvent[];
  readonly supplies: SupplyInventory;
  readonly mergeLog: MergeLogEntry[];
  readonly stats: MergeStats;
}

export interface MergeLogEntry {
  readonly casId: number;
  readonly casName: string;
  readonly action: 'added' | 'merged';
  readonly details: string[];
}

export interface MergeStats {
  readonly totalIncoming: number;
  readonly added: number;
  readonly merged: number;
  readonly rejected: number;
}

interface CasualtyMergeCtx {
  readonly casualties: Casualty[];
  readonly mergeLog: MergeLogEntry[];
  added: number;
  merged: number;
  rejected: number;
}

export class MeshSyncService {
  /** Merge an incoming mesh payload with existing local state. */
  merge(
    localCasualties: readonly Casualty[],
    localTimeline: readonly TimelineEvent[],
    localSupplies: Readonly<SupplyInventory>,
    payload: MeshPayload,
  ): MergeResult {
    const ctx = this.mergeCasualties(localCasualties, payload.casualties);
    const timeline = mergeTimelines(localTimeline, payload.timeline ?? []);
    const supplies = mergeSupplies(localSupplies, payload.supplies);

    return {
      casualties: ctx.casualties,
      timeline,
      supplies,
      mergeLog: ctx.mergeLog,
      stats: {
        totalIncoming: payload.casualties.length,
        added: ctx.added,
        merged: ctx.merged,
        rejected: ctx.rejected,
      },
    };
  }

  /** Validate that a payload has the correct structure for mesh import. */
  validatePayload(data: unknown): data is MeshPayload {
    if (typeof data !== 'object' || data === null) return false;
    const obj = data as Record<string, unknown>;
    return (
      (obj.kind === QRPacketKind.STATE || obj.kind === QRPacketKind.MESH) &&
      Array.isArray(obj.casualties) &&
      typeof obj.exportedAt === 'number'
    );
  }

  private mergeCasualties(
    localCasualties: readonly Casualty[],
    incomingList: readonly Casualty[],
  ): CasualtyMergeCtx {
    const ctx: CasualtyMergeCtx = {
      casualties: localCasualties.map((c) => ({ ...c }) as Casualty),
      mergeLog: [],
      added: 0,
      merged: 0,
      rejected: 0,
    };
    for (const incoming of incomingList) {
      this.processIncoming(ctx, incoming);
    }
    return ctx;
  }

  private processIncoming(ctx: CasualtyMergeCtx, incoming: Casualty): void {
    if (!isValidCasualty(incoming)) {
      ctx.rejected++;
      return;
    }
    const idx = this.findMatchIndex(ctx.casualties, incoming);
    if (idx >= 0) {
      const { merged, details } = this.mergeCasualty(ctx.casualties[idx], incoming);
      ctx.casualties[idx] = merged;
      ctx.merged++;
      ctx.mergeLog.push({
        casId: merged.id, casName: merged.name, action: 'merged', details,
      });
    } else {
      ctx.casualties.push({ ...incoming } as Casualty);
      ctx.added++;
      ctx.mergeLog.push({
        casId: incoming.id, casName: incoming.name,
        action: 'added', details: ['New casualty added from mesh'],
      });
    }
  }

  private findMatchIndex(local: readonly Casualty[], incoming: Casualty): number {
    const byId = local.findIndex((c) => c.id === incoming.id);
    if (byId >= 0) return byId;
    const incomingName = incoming.name.trim().toLowerCase();
    return local.findIndex((c) => c.name.trim().toLowerCase() === incomingName);
  }

  private mergeCasualty(
    local: Casualty,
    incoming: Casualty,
  ): { merged: Casualty; details: string[] } {
    const details: string[] = [];
    const w: Writable<Casualty> = { ...local };
    this.applyMarchMerge(w, incoming, details);
    this.applyCollectionMerges(w, incoming, details);
    this.applyScalarMerges(w, incoming, details);
    if (details.length === 0) details.push('No changes needed');
    return { merged: w as Casualty, details };
  }

  private applyMarchMerge(
    w: Writable<Casualty>,
    incoming: Casualty,
    details: string[],
  ): void {
    if (!incoming.march) return;
    const m = mergeWorstMarch(w.march, incoming.march);
    if (JSON.stringify(m) !== JSON.stringify(w.march)) {
      w.march = m;
      details.push('MARCH scores updated (worst-of merge)');
    }
  }

  private applyCollectionMerges(
    w: Writable<Casualty>,
    incoming: Casualty,
    details: string[],
  ): void {
    if (incoming.injuries?.length) {
      const merged = deduplicateByKey(
        w.injuries, incoming.injuries,
        (i: Injury) => `${i.zone}-${i.type}-${i.side}`,
      );
      if (merged.length > w.injuries.length) {
        const added = merged.length - w.injuries.length;
        w.injuries = merged;
        details.push(`${added} new injuries merged`);
      }
    }
    if (incoming.txList?.length) {
      const merged = deduplicateByKey(
        w.txList, incoming.txList,
        (t: Treatment) => `${t.type}-${t.time}`,
      );
      if (merged.length > w.txList.length) {
        const added = merged.length - w.txList.length;
        w.txList = merged;
        details.push(`${added} new treatments merged`);
      }
    }
  }

  private applyScalarMerges(
    w: Writable<Casualty>,
    incoming: Casualty,
    details: string[],
  ): void {
    if (incoming.notes && incoming.notes !== w.notes) {
      const existing = w.notes || '';
      const inc = incoming.notes.trim();
      if (!existing.includes(inc)) {
        w.notes = existing ? `${existing}\n[mesh] ${inc}` : `[mesh] ${inc}`;
        details.push('Notes merged');
      }
    }
    if (!w.medic && incoming.medic) {
      w.medic = incoming.medic;
      details.push(`Medic assigned: ${incoming.medic}`);
    }
    if (incoming.tqStart && (!w.tqStart || incoming.tqStart > w.tqStart)) {
      w.tqStart = incoming.tqStart;
      details.push('TQ timestamp updated');
    }
    if (incoming.fluidTotal > w.fluidTotal) {
      w.fluidTotal = incoming.fluidTotal;
      details.push('Fluid total updated');
    }
  }
}
