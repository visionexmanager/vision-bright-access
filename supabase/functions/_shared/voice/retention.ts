// Deleting the recordings, ninety days after they stopped being needed.
//
// Somebody uploaded audio of a real person so that a synthetic copy could be
// made. Once the copy exists, the recordings have served their purpose, and
// keeping them any longer is holding a person's voice for no reason anybody
// could give them. This is the policy that ends that.
//
// ── The queue is a predicate ────────────────────────────────────────────────
//
// Expired, and not yet deleted. Not a marked column — a marked row is a row
// that can be marked and then abandoned, and an earlier draft of this marked
// them `lifecycle_state = 'deleting'`, which fed `voice_state` and would have
// silently switched off every voice whose recordings aged out. A retention
// cleanup is not a reason to take somebody's voice away.
//
// A profile leaves the queue only by having `samples_deleted_at` written, and
// that is written only after storage confirmed the objects are gone. So a run
// that dies half way leaves nothing to repair: what was cleared is out, what
// was not is picked up next time.
//
// ── Already missing counts as deleted ───────────────────────────────────────
//
// Supabase Storage does not fail on a key that is not there. That is what makes
// the second run of an interrupted batch safe, and it is why "the object was
// already gone" and "we deleted the object" reach the same place: in both, none
// of the person's audio is left.
//
// Pure. Storage and the database arrive as functions, so the whole lifecycle —
// success, a missing object, a refusal, a repeat run — is testable without a
// bucket, a Postgres, or a single byte of real audio.

/** One profile's worth of expired recordings, as the queue returns it. */
export interface ExpiredSampleBatchRow {
  profile_id: string;
  storage_paths: string[] | null;
}

/** Removing objects either worked or it did not, with a reason we can store. */
export type StorageRemoval =
  | { removal: "removed" }
  | { removal: "failed"; reason: string };

export interface RetentionPorts {
  /**
   * Delete these objects. "Already gone" must be reported as `removed`.
   *
   * Never called with an empty list — see the short-circuit below.
   */
  remove(paths: string[]): Promise<StorageRemoval>;
  /** Record that the recordings are genuinely gone. Called only after `removed`. */
  markDeleted(profileId: string): Promise<void>;
  /** Record why a cleanup failed, leaving the row in the queue. */
  markFailed(profileId: string, reason: string): Promise<void>;
}

export interface DrainReport {
  examined: number;
  cleared: number;
  failed: number;
}

/**
 * Empty as much of the queue as this batch holds.
 *
 * Returns counts and nothing else. No profile id, no path and no filename
 * leaves this function: an object in the voice bucket is named
 * `<user id>/<filename>`, so a path is simultaneously an identifier and a piece
 * of somebody's private data, and this report is read from a public CI log.
 *
 * One failure does not stop the batch. The others are unrelated people's
 * recordings, and they should not wait a day because one storage call refused.
 */
export async function drainRetentionBatch(
  rows: readonly ExpiredSampleBatchRow[],
  ports: RetentionPorts,
): Promise<DrainReport> {
  let cleared = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    if (!row?.profile_id) continue;
    const paths = (row.storage_paths ?? []).filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );

    // A profile whose dataset rows were already cleaned still has to leave the
    // queue, or it is retried forever. There is nothing to ask storage about,
    // so it is not asked.
    const removal: StorageRemoval =
      paths.length === 0 ? { removal: "removed" } : await ports.remove(paths);

    if (removal.removal === "removed") {
      await ports.markDeleted(row.profile_id);
      cleared++;
    } else {
      // The row stays in the queue on purpose. It is retried on the next run,
      // and the voice goes on working in the meantime.
      await ports.markFailed(row.profile_id, removal.reason);
      failed++;
    }
  }

  return { examined: (rows ?? []).length, cleared, failed };
}

/** How many profiles one run may clear. Bounded so a backlog drains gradually. */
export const DEFAULT_DRAIN_LIMIT = 25;
export const MAX_DRAIN_LIMIT = 200;

export function drainLimit(requested: unknown): number {
  const value = Number(requested);
  if (!Number.isFinite(value)) return DEFAULT_DRAIN_LIMIT;
  return Math.max(1, Math.min(Math.trunc(value), MAX_DRAIN_LIMIT));
}
