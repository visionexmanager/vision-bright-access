// Work that cannot be done inside a webhook.
//
// Meta redelivers a webhook that does not answer promptly, and the processing
// service will spend up to 90 s on a video transcode. An Edge Function holding a
// delivery open for 90 s is not slow — it is a duplicate-reply generator: Meta
// gives up, sends the same message again, and the second delivery starts the
// same transcode. That is why `/convert` shipped with nothing calling it, and
// this queue is the missing half.
//
// The SQL was executed against PGlite before this landed, not merely read: the
// claim under concurrency, the expired lease, the attempt ceiling, the unique
// redelivery guard, the sweep, and the service-role check all ran. What is
// asserted here is the half that is a *decision* — which failures are worth the
// box's cores a second time, and what the sender hears.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isRetryable,
  JOB_TTL_HOURS,
  jobQuery,
  LEASE_SECONDS,
  MAX_ATTEMPTS,
  nextStatus,
  queuedNotice,
  RETRYABLE_ERRORS,
  failedNotice,
  shouldTellSender,
} from "../../supabase/functions/_shared/whatsappMediaJobs.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const migration = readFileSync(
  "supabase/migrations/20261007000000_whatsapp_media_jobs.sql",
  "utf8",
);
const convert = readFileSync("services/media-processor/src/convert.mjs", "utf8");

/**
 * The migration with its prose removed.
 *
 * Two of the assertions below are about what the SQL does *not* do, and the
 * header of that file discusses exactly those things in order to explain why it
 * does not do them — so matching the whole file finds the explanation and calls
 * it the offence. Comments are stripped rather than the words softened, because
 * the words are the useful part.
 */
const sql = migration.replace(/^\s*--.*$/gm, "");

// ── 1. What is worth doing twice ─────────────────────────────────────────────

describe("retrying costs the website, so the list is short", () => {
  it("retries only what is about the moment", () => {
    for (const code of RETRYABLE_ERRORS) expect(isRetryable(code), code).toBe(true);
  });

  it("does not retry anything that describes the file or the request", () => {
    // Every one of these produces the same answer on the third attempt as on
    // the first, and each retry is ninety seconds of four dedicated cores the
    // website is also using.
    for (const code of [
      "unsupported_target", "bad_bitrate", "bad_rate", "bad_channels", "bad_height",
      "bad_fps", "bad_quality", "bad_volume", "bad_start", "bad_duration",
      "unreadable_media", "conversion_failed", "empty_output", "output_too_large",
      "too_large", "empty", "abandoned",
    ]) {
      expect(isRetryable(code), code).toBe(false);
    }
  });

  it("treats an absent or unknown code as not worth retrying", () => {
    for (const code of [null, undefined, "", "something_new"]) {
      expect(isRetryable(code as string | null), String(code)).toBe(false);
    }
  });

  it("covers every refusal the service can actually produce", () => {
    // The real guard: read the reasons out of the service and check this module
    // has an opinion on each. A code added there and forgotten here would be
    // silently unretryable, which is the safe direction — but silently is the
    // problem, so it is named.
    const produced = new Set<string>();
    for (const [, reason] of convert.matchAll(/reason: `?bad_\$\{?name\}?`?/g)) void reason;
    for (const [, reason] of convert.matchAll(/reason: "([a-z_]+)"/g)) produced.add(reason);
    // `bad_<option>` is generated from the option names rather than written out.
    for (const [, option] of convert.matchAll(/\["([a-z]+)", is[A-Z]/g)) produced.add(`bad_${option}`);

    expect(produced.size).toBeGreaterThan(3);
    for (const code of produced) {
      // Not an assertion that it is false — an assertion that the question has
      // an answer and that answer is deliberate.
      expect(typeof isRetryable(code), code).toBe("boolean");
      expect(isRetryable(code), `${code} must not be retried unless it is on the list`)
        .toBe((RETRYABLE_ERRORS as readonly string[]).includes(code));
    }
  });
});

// ── 2. Where a job goes next ─────────────────────────────────────────────────

describe("the state a job lands in", () => {
  it("is done when nothing went wrong", () => {
    expect(nextStatus({ errorCode: null, attempts: 1 })).toBe("done");
  });

  it("goes back to the queue while there is road left", () => {
    expect(nextStatus({ errorCode: "timeout", attempts: 1 })).toBe("queued");
    expect(nextStatus({ errorCode: "busy", attempts: 2 })).toBe("queued");
  });

  it("gives up when the attempts are spent", () => {
    // `attempts` counts the one that just happened, which is what the claim
    // returns — so the third attempt has no road left.
    expect(nextStatus({ errorCode: "timeout", attempts: MAX_ATTEMPTS })).toBe("failed");
    expect(nextStatus({ errorCode: "timeout", attempts: MAX_ATTEMPTS + 1 })).toBe("failed");
  });

  it("gives up immediately on a failure that will not change", () => {
    expect(nextStatus({ errorCode: "unsupported_target", attempts: 1 })).toBe("failed");
    expect(nextStatus({ errorCode: "conversion_failed", attempts: 1 })).toBe("failed");
  });

  it("never lands a job in `running`", () => {
    // `running` is the claim's business. A finish that could write it would
    // strand a job with no lease and nothing coming to take it.
    for (const code of [null, "timeout", "unsupported_target"]) {
      for (const attempts of [1, 2, 3, 9]) {
        expect(nextStatus({ errorCode: code, attempts })).not.toBe("running");
      }
    }
    // And the database refuses it too, rather than trusting this.
    expect(migration).toContain("_status NOT IN ('queued', 'done', 'failed')");
  });
});

// ── 3. What the sender hears ─────────────────────────────────────────────────

describe("two messages, whatever happens in between", () => {
  it("says nothing when a job goes back into the queue", () => {
    // "Still working on it" three times is three notifications that say
    // nothing. They hear from this feature exactly twice.
    expect(shouldTellSender("queued")).toBe(false);
    expect(shouldTellSender("running")).toBe(false);
    expect(shouldTellSender("done")).toBe(true);
    expect(shouldTellSender("failed")).toBe(true);
  });

  it("has both sentences in all twenty languages", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const [name, notice] of [
        ["queued", queuedNotice(language)],
        ["failed", failedNotice(language)],
      ] as const) {
        expect(notice.trim(), `${language}/${name}`).not.toBe("");
        expect(notice, `${language}/${name}`).not.toMatch(/\{[a-z]+\}/i);
      }
    }
  });

  it("tells a sender nothing they cannot act on", () => {
    // No exit status, no ffmpeg, no ENOENT, no Supabase. The technical detail
    // is in the job row and the service's logs, where somebody who can act on
    // it will look.
    for (const language of SUPPORTED_LANGUAGES) {
      const notice = failedNotice(language);
      for (const leak of ["ffmpeg", "exit", "ENOENT", "supabase", "500", "422", "null", "undefined"]) {
        expect(notice.toLowerCase(), `${language}: ${leak}`).not.toContain(leak);
      }
    }
  });
});

// ── 4. Turning a row into a request ──────────────────────────────────────────

describe("the query a job becomes", () => {
  it("always names the target", () => {
    expect(jobQuery({ target: "mp3" })).toBe("to=mp3");
  });

  it("carries the options the row was created with", () => {
    const query = new URLSearchParams(
      jobQuery({ target: "mp4", options: { height: "720", quality: "small" } }),
    );
    expect(query.get("to")).toBe("mp4");
    expect(query.get("height")).toBe("720");
    expect(query.get("quality")).toBe("small");
  });

  it("spells a flag the way the service reads it, and omits a false one", () => {
    expect(jobQuery({ target: "mp4", options: { mute: true } })).toContain("mute=1");
    expect(jobQuery({ target: "mp4", options: { mute: false } })).not.toContain("mute");
  });

  it("drops anything a hand-edited row might carry", () => {
    // Better an option that is missing than `[object Object]` in a query string
    // the service will refuse anyway.
    const query = jobQuery({
      target: "mp3",
      options: { nested: { a: 1 } as unknown as string, gone: null, missing: undefined },
    });
    expect(query).toBe("to=mp3");
  });

  it("escapes rather than interpolates", () => {
    // The service holds the allowlist and will refuse this; the point is that
    // it arrives as one parameter rather than as several.
    const query = new URLSearchParams(jobQuery({ target: "mp3", options: { bitrate: "128k&to=exe" } }));
    expect(query.get("to")).toBe("mp3");
    expect(query.get("bitrate")).toBe("128k&to=exe");
  });
});

// ── 5. The numbers, against the service they are about ───────────────────────

describe("the lease outlives the work it covers", () => {
  it("is longer than the slowest thing the service will do", () => {
    // Too short and a job still running is claimed by a second worker and done
    // twice; too long and a worker that died strands its job for that whole
    // time. It has to be a number a healthy run cannot reach.
    const videoTimeout = Number(
      /VIDEO_TIMEOUT_MS\s*=\s*([\d_]+)/.exec(convert)?.[1]?.replace(/_/g, "") ?? "0",
    );
    expect(videoTimeout).toBeGreaterThan(0);
    expect(LEASE_SECONDS * 1000).toBeGreaterThan(videoTimeout);
  });

  it("matches the default the database claims with", () => {
    expect(migration).toContain(`_lease_seconds integer DEFAULT ${LEASE_SECONDS}`);
    expect(migration).toContain(`_max_attempts  integer DEFAULT ${MAX_ATTEMPTS}`);
    expect(migration).toContain(`sweep_whatsapp_media_jobs(${JOB_TTL_HOURS})`);
  });
});

// ── 6. What the table is not allowed to become ───────────────────────────────

describe("the queue holds no more than it needs", () => {
  it("keeps no output, because the file never rests here", () => {
    // The worker hands the bytes straight to Meta. That removes the whole
    // storage lifecycle — upload, permissions, cross-user access, expiry,
    // cleanup — rather than implementing it carefully.
    expect(sql).not.toMatch(/output_path|storage\.|bucket/i);
  });

  it("is service-role only, and not readable by an admin either", () => {
    // These rows say that a particular person sent a particular file at a
    // particular time, which is closer to the transcript than to a job board.
    expect(migration).toContain("auth.role() = 'service_role'");
    expect(sql).not.toContain("has_role(auth.uid(), 'admin')");
  });

  it("answers 'is the queue healthy' without exposing a row", () => {
    expect(migration).toContain("whatsapp_media_queue_health");
    const health = migration.slice(migration.indexOf("whatsapp_media_queue_health()"));
    expect(health).toContain("count(*)");
    expect(health.slice(0, health.indexOf("$$;"))).not.toMatch(/wa_message_id|source_media_id|conversation_id/);
  });

  it("cannot be enqueued twice by a redelivery", () => {
    expect(migration).toMatch(/wa_message_id\s+text NOT NULL UNIQUE/);
  });

  it("claims atomically, which a select and an update are not", () => {
    // Two workers a second apart would otherwise both read the same row and
    // both transcode it, and the sender gets the file twice.
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("grants execute back after revoking from PUBLIC", () => {
    // `REVOKE ... FROM PUBLIC` also revokes it from service_role, and every one
    // of these is called by the service role.
    for (const fn of [
      "whatsapp_claim_media_job(integer, integer)",
      "whatsapp_finish_media_job(uuid, text, text)",
      "sweep_whatsapp_media_jobs(integer)",
      "whatsapp_media_queue_health()",
    ]) {
      expect(migration, fn).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`);
      expect(migration, fn).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    }
  });

  it("warns rather than fails when pg_cron is absent, and does not swallow it", () => {
    // A silent guard cost this repository three unscheduled jobs for months.
    expect(migration).toContain("RAISE WARNING");
    expect(sql).not.toMatch(/EXCEPTION WHEN OTHERS THEN\s+NULL/);
  });
});
