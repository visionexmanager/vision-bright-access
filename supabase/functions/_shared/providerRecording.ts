// Recording a provider's outcome in the registry, given a database client.
//
// `providerRouter.ts` has always owned this — `providerBySlug()` and
// `recordResult()` — but builds its own service client from the environment,
// which needs `npm:@supabase/supabase-js`. That kept it out of every shared
// module the test suite imports directly, `ownerContentActions.ts` among them,
// so the WhatsApp owner commands could not record what the image model did.
//
// The bodies moved here unchanged, taking the client as an argument. The two
// `providerRouter.ts` functions now build their client and delegate, so there
// is still exactly one implementation of "record a result" (Phase 2H).
//
// Pure: no imports but types, no Deno, no environment.

import type { MediaKind, MediaOutcome } from "./contentMedia.ts";
import type { SttProviderName, TranscribeAttempt } from "./voice/stt.ts";

// deno-lint-ignore no-explicit-any
export type RecordingDb = any;

export interface RecordResultParams {
  provider_id:    string;
  provider_slug:  string;
  job_type:       string;
  success:        boolean;
  latency_ms?:    number;
  cost_usd?:      number;
  error_message?: string;
  /** The SLUG of the provider the caller fell back to. */
  failover_to?:   string;
}

/** A `ph_providers` row by slug — for recording against it, not for choosing it. */
export async function providerBySlugIn(
  db: RecordingDb,
  slug: string,
): Promise<({ id: string; slug: string } & Record<string, unknown>) | null> {
  const { data } = await db.from("ph_providers").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
}

/** Metrics, a log row, and a failover row when one happened. */
export async function recordResultIn(db: RecordingDb, params: RecordResultParams): Promise<void> {
  // Upsert metrics
  await db.rpc("ph_record_metric", {
    p_provider_id: params.provider_id,
    p_success:     params.success,
    p_latency_ms:  params.latency_ms ?? null,
    p_cost_usd:    params.cost_usd ?? 0,
  });

  // `failover_to` arrives as a slug, but ph_logs.failover_to and
  // ph_failovers.to_provider_id are uuid columns. Writing the slug into the
  // log made the whole insert fail — silently, since supabase-js reports an
  // error rather than throwing — so the log row was lost. Resolved once here,
  // before either write; an unknown slug records null, as the failover row
  // always did.
  const toProvider = params.failover_to
    ? (await db
        .from("ph_providers")
        .select("id, slug")
        .eq("slug", params.failover_to)
        .maybeSingle()).data
    : null;

  // Insert log entry
  await db.from("ph_logs").insert({
    provider_id:   params.provider_id,
    provider_slug: params.provider_slug,
    job_type:      params.job_type,
    action:        "generation",
    status:        params.success ? "success" : "failure",
    latency_ms:    params.latency_ms ?? null,
    cost_usd:      params.cost_usd ?? null,
    error_message: params.error_message ?? null,
    failover_to:   toProvider?.id ?? null,
  });

  // Record failover event
  if (!params.success && params.failover_to) {
    await db.from("ph_failovers").insert({
      from_provider_id: params.provider_id,
      to_provider_id:   toProvider?.id ?? null,
      from_slug:        params.provider_slug,
      to_slug:          params.failover_to,
      job_type:         params.job_type,
      reason:           "generation_failure",
      error_message:    params.error_message,
    });
  }
}

/**
 * One outcome against one registry row, by slug. Best-effort: it never
 * throws, and a slug with no row records nothing.
 *
 * `error` must be a short code chosen by the caller — never a provider's own
 * sentence, a prompt, a URL or anything that identifies a person.
 */
export async function recordProviderOutcome(
  db: RecordingDb,
  slug: string,
  jobType: string,
  outcome: { success: boolean; ms: number; error?: string },
): Promise<void> {
  try {
    const row = await providerBySlugIn(db, slug);
    if (!row) return;
    await recordResultIn(db, {
      provider_id:   row.id,
      provider_slug: row.slug,
      job_type:      jobType,
      success:       outcome.success,
      latency_ms:    outcome.ms,
      error_message: outcome.error,
    });
  } catch {
    // Best-effort. The caller's result must never depend on this.
  }
}

/**
 * The registry row each kind of content-media generation is recorded against.
 *
 * `image` is the `openai-image` row Phase 2C seeded, which `image-generate`
 * already records against. `video` is `openai-video`, the Sora row added in
 * Phase 2J-0 (20261039000000) — contentMedia renders video with Sora only.
 */
export const MEDIA_PROVIDER_SLUG: Record<MediaKind, string> = {
  image: "openai-image",
  video: "openai-video",
};

/**
 * Record one content-media outcome. Best-effort: it never throws, so a
 * registry that is down cannot cost anyone a picture or a clip.
 */
export async function recordMediaOutcome(db: RecordingDb, outcome: MediaOutcome): Promise<void> {
  await recordProviderOutcome(db, MEDIA_PROVIDER_SLUG[outcome.kind], outcome.kind === "video" ? "text_to_video" : "image", outcome);
}

/**
 * `video-studio`'s provider names, mapped to their registry rows. Recording
 * only: `video-studio` chooses its provider from environment keys, never from
 * these rows (Phase 2J-0).
 */
export const VIDEO_PROVIDER_SLUG: Readonly<Record<string, string>> = {
  openai: "openai-video",
  luma: "luma-video",
  runpod: "runpod-video",
};

// ── Speech to text (Phase 2I) ─────────────────────────────────────────────────
//
// Moved unchanged from `speech-transcribe`, where Phase 2D wrote it, so the
// WhatsApp voice-note path records through the same code instead of a copy.
// Recording only: the Groq-then-OpenAI order, capability filtering,
// skip-on-no-key and retry-on-empty all stay in `_shared/voice/stt.ts`.

/** The `groq-stt`/`openai-stt` rows Phase 2C seeded. */
export const STT_PROVIDER_SLUG: Record<SttProviderName, string> = { groq: "groq-stt", openai: "openai-stt" };

/**
 * Record every attempt `transcribe()` actually made against a network — a
 * provider skipped for a missing key never reached the wire and is excluded,
 * so it cannot be mistaken for a real failure in that provider's health score.
 * Best-effort: never throws.
 */
export async function recordSttAttempts(
  db: RecordingDb,
  attempts: TranscribeAttempt[],
  final?: { provider: SttProviderName; ms: number },
): Promise<void> {
  const real = attempts.filter((a) => a.failure.reason !== "no_key");
  try {
    for (const attempt of real) {
      const row = await providerBySlugIn(db, STT_PROVIDER_SLUG[attempt.provider]);
      if (!row) continue;
      await recordResultIn(db, {
        provider_id: row.id, provider_slug: row.slug, job_type: "stt",
        success: false, latency_ms: attempt.ms,
        error_message: attempt.failure.reason === "rejected" ? attempt.failure.detail : attempt.failure.reason,
      });
    }
    if (final) {
      const row = await providerBySlugIn(db, STT_PROVIDER_SLUG[final.provider]);
      if (row) {
        await recordResultIn(db, { provider_id: row.id, provider_slug: row.slug, job_type: "stt", success: true, latency_ms: final.ms });
      }
    }
  } catch {
    // Best-effort. The transcript the sender already has must never depend on this.
  }
}
