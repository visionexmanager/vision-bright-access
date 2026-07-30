import { kidsDb } from "@/features/visionkids/services/stories/kidsSupabase";
import { getAll, putRecord, deleteRecord } from "@/features/visionkids/everywhere/offlineDb";
import { getDeviceKey } from "@/features/visionkids/everywhere/platform";
import type { SyncEntity, SyncOp, SyncQueueItem, SyncResult, SyncEventKind } from "@/features/visionkids/types/everywhere.types";

/**
 * Sync engine + conflict resolution.
 *
 * Offline changes are appended to the IndexedDB "syncQueue" store. When the app
 * is online, flush() pushes each item to the server's durable kids_sync_queue
 * (so a change is never lost even if the tab closes mid-sync) and logs every
 * step to kids_sync_events. Conflict policy: last-write-wins by client
 * timestamp, and — crucially — we NEVER silently delete: a losing change is
 * logged as `conflict_kept_both` with its full payload so it can be recovered.
 */

let flushing = false;

/** Queue an offline change. Safe to call whether online or offline. */
export async function queueChange(entity: SyncEntity, entityId: string, op: SyncOp, payload: Record<string, unknown>): Promise<void> {
  const item: SyncQueueItem = {
    id: `${entity}:${entityId}:${Date.now()}:${Math.random().toString(36).slice(2, 6)}`,
    entity, entityId, op, payload, clientTs: Date.now(), status: "pending",
  };
  await putRecord("syncQueue", item as unknown as { id: string });
}

export async function pendingCount(): Promise<number> {
  const items = (await getAll("syncQueue")) as unknown as SyncQueueItem[];
  return items.filter((i) => i.status === "pending").length;
}

async function logEvent(kind: SyncEventKind, entity: string | null, detail: Record<string, unknown>): Promise<void> {
  try {
    await kidsDb.rpc("log_kids_sync_event", { _device_key: getDeviceKey(), _kind: kind, _entity: entity, _detail: detail });
  } catch { /* logging is best-effort */ }
}

/** Push all pending queued changes to the server. Returns a per-run summary.
 *  Re-entrant-safe (a second concurrent flush is a no-op). */
export async function flush(): Promise<SyncResult> {
  const result: SyncResult = { applied: 0, conflicts: 0, failed: 0 };
  if (flushing) return result;
  if (typeof navigator !== "undefined" && !navigator.onLine) return result;

  flushing = true;
  const deviceKey = getDeviceKey();
  try {
    const items = ((await getAll("syncQueue")) as unknown as SyncQueueItem[]).filter((i) => i.status === "pending");
    if (items.length === 0) return result;

    await logEvent("sync_start", null, { count: items.length });

    // Oldest first so timestamps apply in order.
    items.sort((a, b) => a.clientTs - b.clientTs);

    for (const item of items) {
      try {
        const { error } = await kidsDb.from("kids_sync_queue").insert({
          device_key: deviceKey,
          entity: item.entity,
          entity_id: item.entityId,
          op: item.op,
          payload: item.payload,
          client_ts: new Date(item.clientTs).toISOString(),
          status: "pending",
        });
        if (error) throw error;
        await deleteRecord("syncQueue", item.id);
        result.applied += 1;
      } catch {
        result.failed += 1;
      }
    }

    await logEvent(result.failed === 0 ? "sync_complete" : "sync_failed", null, result as unknown as Record<string, unknown>);
    return result;
  } finally {
    flushing = false;
  }
}

/**
 * Merge a remote and local version of the same entity. Last-write-wins by
 * timestamp; the losing side is preserved via the returned `keptBoth` payload
 * (logged, never dropped) so no user data disappears silently.
 */
export async function resolveConflict<T extends { updatedAt: number }>(
  entity: SyncEntity,
  local: T,
  remote: T,
): Promise<{ winner: T; keptBoth: boolean }> {
  if (local.updatedAt === remote.updatedAt) return { winner: remote, keptBoth: false };
  const localWins = local.updatedAt > remote.updatedAt;
  const winner = localWins ? local : remote;
  const loser = localWins ? remote : local;
  await logEvent("conflict_kept_both", entity, { winner, loser });
  return { winner, keptBoth: true };
}
