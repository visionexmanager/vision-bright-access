// The recordings actually going away.
//
// A cloned voice is built from audio of a real person. Ninety days after the
// clone exists, that audio has served its purpose. Before this, the retention
// sweep only *marked* rows and nothing ever emptied the bucket — so every
// recording anybody had ever uploaded was still there, indefinitely.
//
// Storage and the database arrive as functions, so every case below — a clean
// run, an object that was already missing, a refusal, a repeat run — is
// exercised without a bucket, a Postgres, or a byte of real audio. No test here
// touches ElevenLabs or Supabase Storage.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_DRAIN_LIMIT,
  MAX_DRAIN_LIMIT,
  drainLimit,
  drainRetentionBatch,
  type ExpiredSampleBatchRow,
  type RetentionPorts,
  type StorageRemoval,
} from "../../supabase/functions/_shared/voice/retention.ts";

/**
 * A bucket that remembers what it holds and what it was asked to delete.
 *
 * Removing a key that is not there succeeds, because that is what Supabase
 * Storage does and it is the behaviour the whole drain depends on.
 */
function fakeStorage(initial: string[] = []) {
  const objects = new Set(initial);
  const removeCalls: string[][] = [];
  let refuseWith: string | null = null;
  let throwNext = false;

  return {
    objects,
    removeCalls,
    refuse(reason: string) { refuseWith = reason; },
    allow() { refuseWith = null; },
    throwOnce() { throwNext = true; },
    async remove(paths: string[]): Promise<StorageRemoval> {
      removeCalls.push(paths);
      if (throwNext) { throwNext = false; throw new Error("socket hang up"); }
      if (refuseWith) return { removal: "failed", reason: refuseWith };
      // Missing keys are simply not there afterwards either.
      for (const path of paths) objects.delete(path);
      return { removal: "removed" };
    },
  };
}

/** A queue plus the two ways a row leaves it, as the database implements them. */
function fakeQueue(rows: ExpiredSampleBatchRow[]) {
  const deleted = new Set<string>();
  const failures = new Map<string, string>();

  const ports = (storage: { remove(paths: string[]): Promise<StorageRemoval> }): RetentionPorts => ({
    remove: (paths) => storage.remove(paths),
    async markDeleted(profileId) {
      deleted.add(profileId);
      failures.delete(profileId);   // a success clears the recorded reason
    },
    async markFailed(profileId, reason) {
      failures.set(profileId, reason);
    },
  });

  /** What `vs_expired_sample_batch` would return now: expired, not yet deleted. */
  const queued = () => rows.filter((row) => !deleted.has(row.profile_id));

  return { rows, deleted, failures, ports, queued };
}

const row = (id: string, paths: string[] | null): ExpiredSampleBatchRow =>
  ({ profile_id: id, storage_paths: paths });

describe("an expired profile reaches the queue and leaves it", () => {
  it("deletes the objects, then records the deletion", async () => {
    const storage = fakeStorage(["u1/a.wav", "u1/b.wav"]);
    const queue = fakeQueue([row("p1", ["u1/a.wav", "u1/b.wav"])]);

    expect(queue.queued()).toHaveLength(1);
    const report = await drainRetentionBatch(queue.rows, queue.ports(storage));

    expect(report).toEqual({ examined: 1, cleared: 1, failed: 0 });
    expect(storage.objects.size).toBe(0);
    expect(queue.deleted.has("p1")).toBe(true);
    expect(queue.failures.size).toBe(0);
    // And it is out of the queue, which is the only thing that stops the retry.
    expect(queue.queued()).toHaveLength(0);
  });

  it("asks storage before it records anything", async () => {
    // The order is the whole guarantee: marking first would record a deletion
    // that had not happened.
    const order: string[] = [];
    const report = await drainRetentionBatch([row("p1", ["u1/a.wav"])], {
      async remove() { order.push("remove"); return { removal: "removed" }; },
      async markDeleted() { order.push("markDeleted"); },
      async markFailed() { order.push("markFailed"); },
    });
    expect(order).toEqual(["remove", "markDeleted"]);
    expect(report.cleared).toBe(1);
  });
});

describe("an object that is already missing", () => {
  it("counts as deleted, because none of the person's audio is left", async () => {
    // Supabase Storage does not fail on a key that is not there. This is what
    // makes the second run of an interrupted batch safe.
    const storage = fakeStorage([]);            // the bucket is already empty
    const queue = fakeQueue([row("p1", ["u1/gone.wav"])]);

    const report = await drainRetentionBatch(queue.rows, queue.ports(storage));

    expect(report).toEqual({ examined: 1, cleared: 1, failed: 0 });
    expect(queue.deleted.has("p1")).toBe(true);
  });

  it("still clears a profile whose paths were already cleaned up", async () => {
    // Refusing to mark an empty list would leave the row queued forever.
    const storage = fakeStorage([]);
    const queue = fakeQueue([row("p1", []), row("p2", null)]);

    const report = await drainRetentionBatch(queue.rows, queue.ports(storage));

    expect(report).toEqual({ examined: 2, cleared: 2, failed: 0 });
    // And it did not bother storage with an empty request.
    expect(storage.removeCalls).toEqual([]);
  });
});

describe("a failure that has to stay recoverable", () => {
  it("does not record a deletion, and leaves the row in the queue", async () => {
    const storage = fakeStorage(["u1/a.wav"]);
    storage.refuse("storage refused the removal");
    const queue = fakeQueue([row("p1", ["u1/a.wav"])]);

    const report = await drainRetentionBatch(queue.rows, queue.ports(storage));

    expect(report).toEqual({ examined: 1, cleared: 0, failed: 1 });
    expect(queue.deleted.has("p1")).toBe(false);
    expect(queue.failures.get("p1")).toBe("storage refused the removal");
    // Still queued: the next run tries again, with no manual repair.
    expect(queue.queued()).toHaveLength(1);
    // And the object is still there — nothing pretended otherwise.
    expect(storage.objects.has("u1/a.wav")).toBe(true);
  });

  it("recovers on a later run and clears the recorded reason", async () => {
    const storage = fakeStorage(["u1/a.wav"]);
    const queue = fakeQueue([row("p1", ["u1/a.wav"])]);

    storage.refuse("storage refused the removal");
    await drainRetentionBatch(queue.queued(), queue.ports(storage));
    expect(queue.failures.has("p1")).toBe(true);

    storage.allow();
    const second = await drainRetentionBatch(queue.queued(), queue.ports(storage));

    expect(second).toEqual({ examined: 1, cleared: 1, failed: 0 });
    expect(queue.deleted.has("p1")).toBe(true);
    expect(queue.failures.has("p1")).toBe(false);
    expect(storage.objects.size).toBe(0);
  });

  it("does not let one refusal abandon everybody else's recordings", async () => {
    const storage = {
      calls: [] as string[][],
      async remove(paths: string[]): Promise<StorageRemoval> {
        this.calls.push(paths);
        return paths[0] === "u2/b.wav"
          ? { removal: "failed", reason: "HTTP 500" }
          : { removal: "removed" };
      },
    };
    const queue = fakeQueue([
      row("p1", ["u1/a.wav"]),
      row("p2", ["u2/b.wav"]),
      row("p3", ["u3/c.wav"]),
    ]);

    const report = await drainRetentionBatch(queue.rows, queue.ports(storage));

    expect(report).toEqual({ examined: 3, cleared: 2, failed: 1 });
    expect(queue.queued().map((r) => r.profile_id)).toEqual(["p2"]);
  });

  it("survives storage throwing rather than answering", async () => {
    // The port contract says it returns; a real client can still reject.
    const storage = fakeStorage(["u1/a.wav"]);
    storage.throwOnce();
    const queue = fakeQueue([row("p1", ["u1/a.wav"])]);

    await expect(drainRetentionBatch(queue.rows, queue.ports(storage))).rejects.toThrow();
    // Nothing was marked, so nothing was lost — the row is still queued.
    expect(queue.deleted.size).toBe(0);
  });
});

describe("running it more than once", () => {
  it("is the same as running it once", async () => {
    const storage = fakeStorage(["u1/a.wav", "u2/b.wav"]);
    const queue = fakeQueue([row("p1", ["u1/a.wav"]), row("p2", ["u2/b.wav"])]);

    const first = await drainRetentionBatch(queue.queued(), queue.ports(storage));
    const second = await drainRetentionBatch(queue.queued(), queue.ports(storage));
    const third = await drainRetentionBatch(queue.queued(), queue.ports(storage));

    expect(first).toEqual({ examined: 2, cleared: 2, failed: 0 });
    expect(second).toEqual({ examined: 0, cleared: 0, failed: 0 });
    expect(third).toEqual({ examined: 0, cleared: 0, failed: 0 });
    expect(storage.objects.size).toBe(0);
  });

  it("finishes an interrupted batch without repeating the finished half", async () => {
    const storage = fakeStorage(["u1/a.wav", "u2/b.wav"]);
    const queue = fakeQueue([row("p1", ["u1/a.wav"]), row("p2", ["u2/b.wav"])]);

    // A run that only got through the first row before the process died.
    await drainRetentionBatch([queue.rows[0]], queue.ports(storage));
    expect(queue.queued().map((r) => r.profile_id)).toEqual(["p2"]);

    await drainRetentionBatch(queue.queued(), queue.ports(storage));
    expect(queue.queued()).toHaveLength(0);
    // The first profile's objects were asked for exactly once.
    expect(storage.removeCalls.filter((call) => call.includes("u1/a.wav"))).toHaveLength(1);
  });

  it("does nothing at all when the queue is empty", async () => {
    const storage = fakeStorage([]);
    expect(await drainRetentionBatch([], fakeQueue([]).ports(storage)))
      .toEqual({ examined: 0, cleared: 0, failed: 0 });
    expect(storage.removeCalls).toEqual([]);
  });

  it("ignores a malformed row rather than deleting something unnamed", async () => {
    const storage = fakeStorage(["u1/a.wav"]);
    const report = await drainRetentionBatch(
      [{ profile_id: "", storage_paths: ["u1/a.wav"] } as ExpiredSampleBatchRow],
      fakeQueue([]).ports(storage),
    );
    expect(report.cleared).toBe(0);
    expect(storage.objects.has("u1/a.wav")).toBe(true);
  });
});

describe("how much one run may take on", () => {
  it("is bounded, so a backlog drains over several runs", () => {
    expect(drainLimit(undefined)).toBe(DEFAULT_DRAIN_LIMIT);
    expect(drainLimit("not a number")).toBe(DEFAULT_DRAIN_LIMIT);
    expect(drainLimit(50)).toBe(50);
    expect(drainLimit(0)).toBe(1);
    expect(drainLimit(-5)).toBe(1);
    expect(drainLimit(100_000)).toBe(MAX_DRAIN_LIMIT);
  });
});

describe("what the drain reports, and to whom", () => {
  it("returns counts and nothing that identifies anybody", async () => {
    // A path in this bucket is `<user id>/<filename>`, and this report is
    // echoed into a public CI log.
    const storage = fakeStorage(["u1/private-recording.wav"]);
    const queue = fakeQueue([row("p1", ["u1/private-recording.wav"])]);
    const report = await drainRetentionBatch(queue.rows, queue.ports(storage));

    const serialised = JSON.stringify(report);
    expect(Object.keys(report).sort()).toEqual(["cleared", "examined", "failed"]);
    expect(serialised).not.toContain("p1");
    expect(serialised).not.toContain("u1/");
    expect(serialised).not.toContain("private-recording");
  });
});

// ── The queue in SQL, and the worker that drains it ─────────────────────────

describe("the retention queue in the migration", () => {
  const sql = readFileSync("supabase/migrations/20260929000000_voice_cloning_consent.sql", "utf8");

  it("is a predicate rather than a marked column", () => {
    // The first draft marked rows `lifecycle_state = 'deleting'`, which feeds
    // `voice_state` — every voice whose recordings aged out would have silently
    // stopped working. A cleanup is not a reason to take a voice away.
    const batch = sql.slice(sql.indexOf("FUNCTION public.vs_expired_sample_batch"));
    expect(batch).toContain("p.samples_retain_until < now()");
    expect(batch).toContain("p.samples_deleted_at IS NULL");
    expect(sql).not.toContain("vs_sweep_expired_samples");
  });

  it("leaves a drained voice usable, changing only the recordings", () => {
    const mark = sql.slice(
      sql.indexOf("FUNCTION public.vs_mark_samples_deleted"),
      sql.indexOf("COMMENT ON FUNCTION public.vs_mark_samples_deleted"),
    );
    expect(mark).toContain("samples_deleted_at = now()");
    expect(mark).toContain("DELETE FROM public.vs_voice_datasets");
    // It must not touch consent, the clone, or the lifecycle.
    expect(mark).not.toContain("lifecycle_state");
    expect(mark).not.toContain("consent_status");
    expect(mark).not.toContain("provider_voice_id");
  });

  it("records a failure without removing the row from the queue", () => {
    const failed = sql.slice(
      sql.indexOf("FUNCTION public.vs_mark_samples_delete_failed"),
      sql.indexOf("COMMENT ON FUNCTION public.vs_mark_samples_delete_failed"),
    );
    expect(failed).toContain("samples_delete_error");
    expect(failed).toContain("left(coalesce(_reason, 'unknown'), 300)");
    // Setting this would end the retries and claim a deletion that never was.
    expect(failed).not.toContain("samples_deleted_at");
  });

  it("skips a profile the user is already deleting", () => {
    const batch = sql.slice(sql.indexOf("FUNCTION public.vs_expired_sample_batch"));
    expect(batch).toContain("p.lifecycle_state = 'active'");
  });

  it("keeps all three retention functions to service_role alone", () => {
    for (const fn of [
      "vs_expired_sample_batch(integer)",
      "vs_mark_samples_deleted(uuid)",
      "vs_mark_samples_delete_failed(uuid, text)",
    ]) {
      expect(sql, fn).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC;`);
      expect(sql, fn).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
      expect(sql, fn).not.toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO anon`);
      expect(sql, fn).not.toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO authenticated`);
    }
  });
});

describe("the worker endpoint", () => {
  const source = readFileSync("supabase/functions/voice-studio/index.ts", "utf8");
  const workflow = readFileSync(".github/workflows/voice-retention-cron.yml", "utf8");

  it("is not a public endpoint: it needs CRON_SECRET and fails closed", () => {
    const branch = source.slice(source.indexOf(`if (cronBody.action === "drain_retention")`));
    const head = branch.slice(0, branch.indexOf("handleDrainRetention("));
    expect(head).toContain(`Deno.env.get("CRON_SECRET")`);
    // Unset means it answers nobody, rather than everybody.
    expect(head).toMatch(/if \(!cronSecret\) return json\(\{ ok: false, error: "not_configured" \}, 503\)/);
    expect(head).toContain("Bearer ${cronSecret}");
  });

  it("cannot be reached from the user-JWT path", () => {
    // `drain_retention` is absent from the user switch, so a session token can
    // never dispatch it however the body is shaped.
    const dispatch = source.slice(source.indexOf("switch (action)"));
    expect(dispatch).not.toContain("drain_retention");
  });

  it("uses service_role for the drain and never a user session", () => {
    const branch = source.slice(source.indexOf(`if (cronBody.action === "drain_retention")`));
    const head = branch.slice(0, branch.indexOf("handleDrainRetention("));
    expect(head).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(head).not.toContain("auth.getUser");
  });

  it("logs a code, never a path, a filename or a message", () => {
    const handler = source.slice(
      source.indexOf("async function handleDrainRetention"),
      source.indexOf("async function removeStorageObjects"),
    );
    const logs = handler.match(/console\.(log|error|warn)\([^;]*\)/g) ?? [];
    for (const line of logs) {
      expect(line, line).not.toMatch(/paths|storage_path|profile_id|filename|error\)\s*$/);
      expect(line, line).toContain("code");
    }
  });

  it("is driven by the schedule this repository already uses for such work", () => {
    // pg_net plus the service key and CRON_SECRET in a table would be two
    // credentials stored in the database to save one workflow file — a choice
    // 20260913000000 already made and wrote down.
    expect(workflow).toContain("functions/v1/voice-studio");
    expect(workflow).toContain(`"action":"drain_retention"`);
    expect(workflow).toContain("secrets.CRON_SECRET");
    expect(workflow).not.toContain("SERVICE_ROLE");
    expect(workflow).toContain("concurrency:");
  });
});
