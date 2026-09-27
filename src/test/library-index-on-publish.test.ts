import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Library search read an embedding nothing wrote: the indexing job was queued
// only by import review, and the worker that runs it was never scheduled. On
// 2026-09-27 none of the 8 published books was searchable. Both halves have
// to exist — a queue nobody drains is the same outage as no queue.

const migration = readFileSync("supabase/migrations/20261051000000_library_index_on_publish.sql", "utf8");

describe("Library books are indexed once published", () => {
  it("queues the indexing job from a trigger on publish, and for the books already published", () => {
    expect(migration).toMatch(/AFTER INSERT OR UPDATE OF publish_status ON public\.library_books/);
    expect(migration).toMatch(/SECURITY DEFINER\s+SET search_path = public/);
    // The trigger and the backfill both skip a book that already has a job waiting.
    expect(migration.match(/status IN \('pending', 'processing'\)/g)?.length).toBe(2);
    expect(migration).toMatch(/INSERT INTO public\.library_background_jobs[\s\S]*FROM public\.library_books b/);
  });

  it("keeps the trigger function out of reach of API callers", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.library_queue_index_on_publish\(\) FROM PUBLIC, anon, authenticated;/);
  });

  it("has a scheduled workflow that calls the worker with the cron secret", () => {
    const callers = readdirSync(".github/workflows")
      .map((name) => readFileSync(`.github/workflows/${name}`, "utf8"))
      .filter((text) => text.includes("functions/v1/library-process-background-jobs"));
    expect(callers.length).toBe(1);
    expect(callers[0]).toMatch(/^\s+schedule:\s*\n\s+- cron: /m);
    expect(callers[0]).toMatch(/x-cron-secret: \$CRON_SECRET/);
  });

  it("never lets a run end with jobs stranded in processing", () => {
    // The first scheduled run was cut off by the gateway at 150 s and left all
    // 8 books in "processing", where nothing would ever look at them again.
    const worker = readFileSync("supabase/functions/library-process-background-jobs/index.ts", "utf8");
    const limit = (name: string) => Number(new RegExp(`const ${name} = ([\\d_]+)`).exec(worker)?.[1].replace(/_/g, ""));
    expect(limit("RUN_BUDGET_MS") + limit("JOB_TIMEOUT_MS")).toBeLessThan(150_000);
    expect(worker).toMatch(/withTimeout\(classifyAndIndexBook\(/);
    // Stuck index jobs go back to the queue — and only index jobs: a report
    // job sends email, and requeueing a half-sent one would send it twice.
    const requeue = worker.slice(worker.indexOf("Hand back index jobs"), worker.indexOf("const requeued"));
    expect(requeue.match(/\.eq\("job_type", "classify_and_index_book"\)/g)?.length).toBe(2);
    expect(requeue).toMatch(/\.lt\("attempts", MAX_ATTEMPTS\)/);
    // A failed write is a failed job, not a silent "completed".
    expect(worker).toMatch(/if \(classifyErr\) throw/);
    expect(worker).toMatch(/if \(embedErr\) throw/);
  });

  it("lets the scheduler past the gateway, where the worker checks its own secret", () => {
    const script = readFileSync("scripts/deploy-changed-supabase-functions.sh", "utf8");
    expect(script).toMatch(/^\s*\[library-process-background-jobs\]=1\s*$/m);
  });
});
