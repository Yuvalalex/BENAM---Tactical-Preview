/**
 * CommsSyncFacade — High-level API for mesh sync and QR export.
 *
 * Orchestrates mesh payload export/import, validating incoming
 * payloads, and merging remote state into local state.
 */

import type { EventBus } from '../../core/events';
import type { MeshPayload, Timestamp } from '../../core/types';
import { QRPacketKind } from '../../core/types';
import type { AppStore } from '../../presentation/store/app-store';
import type {
  MeshSyncService,
  MergeResult,
  MergeStats,
} from '../../domain/services/mesh-sync.service';

export class CommsSyncFacade {
  private lastImportStats: MergeStats | null = null;

  constructor(
    private readonly store: AppStore,
    private readonly meshSync: MeshSyncService,
    private readonly eventBus: EventBus,
  ) {}

  /** Build a mesh payload from current state for export. */
  exportMesh(): MeshPayload {
    const state = this.store.getState();
    const payload: MeshPayload = {
      kind: QRPacketKind.MESH,
      format: 'BENAM/2',
      unit: state.comms?.unit ?? '',
      exportedAt: Date.now() as Timestamp,
      sincets: 0 as Timestamp,
      casualties: state.casualties,
      timeline: state.timeline,
      comms: state.comms,
      supplies: state.supplies,
      missionStart: state.missionStart,
    };

    this.eventBus.emit('mesh:exported', {
      size: JSON.stringify(payload).length,
      chunks: 1,
    });

    return payload;
  }

  /** Import and merge a mesh payload into current state. */
  importMesh(payload: MeshPayload): MergeResult {
    const state = this.store.getState();
    const result = this.meshSync.merge(
      state.casualties,
      state.timeline,
      state.supplies,
      payload,
    );

    this.store.dispatch(() => ({
      casualties: result.casualties,
      timeline: result.timeline,
      supplies: result.supplies,
    }));

    this.lastImportStats = result.stats;
    this.eventBus.emit('mesh:imported', {
      casualties: result.stats.totalIncoming,
      merged: result.stats.merged,
    });

    return result;
  }

  /** Validate that raw data is a valid mesh payload. */
  validatePayload(data: unknown): data is MeshPayload {
    return this.meshSync.validatePayload(data);
  }

  /** Get stats from the last import operation, if any. */
  getLastImportStats(): MergeStats | null {
    return this.lastImportStats;
  }
}
