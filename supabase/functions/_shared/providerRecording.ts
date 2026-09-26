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
import type { TtsExecution, TtsProvider } from "./voice/tts.ts";
import type { AIProvider, ProviderAttempt } from "./aiProvider.ts";

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
  /** Operational metadata only (e.g. the model id). Written only when given. */
  request_meta?:  Record<string, unknown>;
}

/** A `ph_providers` row by slug — for recording against it, not for choosing it. */
export async function providerBySlugIn(
  db: RecordingDb,
  slug: string,
): Promise<({ id: string; slug: string } & Record<string, unknown>) | null> {
  const { data } = await db.from("ph_providers").select("*").eq("slug", slug).maybeSingle();
  return data ?? null;
}

// ── Activation gate for providers that must be switched on ──────────────────
//
// A provider added after the audit of 2026-09-26 (FAL, and anything like it)
// serves traffic only when its registry row says so: status active or
// degraded — degraded is health, not a switch — AND config.production_eligible
// is true. Both are admin decisions, taken after a real smoke test; no probe
// or automation sets either. Anything else — no row, inactive, error, not
// eligible, a registry that errors or takes longer than the timeout — is
// "not routable". Fail closed: an unreadable registry never switches a
// provider on.

export const ROUTABLE_READ_TIMEOUT_MS = 1_500;

export function rowIsRoutable(row: { status?: unknown; config?: unknown } | null | undefined): boolean {
  if (!row) return false;
  if (row.status !== "active" && row.status !== "degraded") return false;
  const config = row.config && typeof row.config === "object" ? row.config as Record<string, unknown> : {};
  return config.production_eligible === true;
}

export async function providerRoutableIn(db: RecordingDb, slug: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), ROUTABLE_READ_TIMEOUT_MS);
    });
    const read = db.from("ph_providers").select("status, config").eq("slug", slug).maybeSingle()
      .then((r: { data: unknown }) => r.data);
    return rowIsRoutable(await Promise.race([read, timeout]) as { status?: unknown; config?: unknown } | null);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
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
    // Omitted rather than defaulted, so every other recorder's row is unchanged.
    ...(params.request_meta ? { request_meta: params.request_meta } : {}),
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
  meta?: Record<string, unknown>,
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
      ...(meta ? { request_meta: meta } : {}),
    });
  } catch {
    // Best-effort. The caller's result must never depend on this.
  }
}

/**
 * The registry row each kind of content-media generation is recorded against.
 *
 * `image` is the `openai-image` row Phase 2C seeded, which `image-generate`
 * already records against. `video` is `luma-video`: contentMedia renders
 * video with Luma since OpenAI retired Sora on 2026-09-24 (20261046000000).
 */
export const MEDIA_PROVIDER_SLUG: Record<MediaKind, string> = {
  image: "openai-image",
  video: "luma-video",
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

// ── Text to speech (Phase 2K-1) ──────────────────────────────────────────────
//
// Recording only. Which provider, voice and model speak is decided exactly as
// before by each caller; this writes what then succeeded against the tts rows
// Phase 2C seeded. `speech-generate` records through its own code and is not
// wired to this, so nothing is recorded twice.

/** The `openai-tts` / `elevenlabs-tts` / `mistral-tts` rows. */
export const TTS_PROVIDER_SLUG: Record<TtsProvider, string> = { openai: "openai-tts", elevenlabs: "elevenlabs-tts", mistral: "mistral-tts" };

/** One successful synthesis: a metric and a log row with the model id. Never throws. */
export async function recordTtsExecution(db: RecordingDb, execution: TtsExecution): Promise<void> {
  const slug = TTS_PROVIDER_SLUG[execution.provider];
  if (!slug) return;
  await recordProviderOutcome(db, slug, "tts", { success: true, ms: execution.ms }, { model: execution.model });
}

// ── Chat and vision attempts (Phase 2K-4) ────────────────────────────────────
//
// Recording only. The two fallback loops in `aiProvider.ts` report each
// attempt; this writes it against the row for that provider and kind. One
// attempt is one `ph_logs` row: `failover_to` is never set, so no
// `ph_failovers` row is written either — a fallback shows as the next row's
// `request_meta.attempt` being above 1. The model travels in `request_meta`;
// rows are per provider, not per model.
//
// A provider with no row for a kind records nothing. Anthropic is reachable
// only outside the two loops today (career-ai, news-generate), so it has no
// chat row; Groq and Mistral take no images in any recorded chain, so they
// have no vision row.

/** The chat rows seeded in 20261042000000. */
export const CHAT_PROVIDER_SLUG: Partial<Record<AIProvider, string>> = {
  openai: "openai-chat",
  groq: "groq-chat",
  mistral: "mistral-chat",
  gemini: "gemini-chat",
};

/** The vision rows seeded in 20261042000000. */
export const VISION_PROVIDER_SLUG: Partial<Record<AIProvider, string>> = {
  openai: "openai-vision",
  gemini: "gemini-vision",
};

/** One chat or vision attempt: a metric and a log row. Never throws. */
export async function recordProviderAttempt(db: RecordingDb, attempt: ProviderAttempt): Promise<void> {
  const slug = (attempt.kind === "vision" ? VISION_PROVIDER_SLUG : CHAT_PROVIDER_SLUG)[attempt.provider];
  if (!slug) return;
  await recordProviderOutcome(
    db,
    slug,
    attempt.kind,
    { success: attempt.success, ms: attempt.ms, error: attempt.error },
    // Token counts only, when the provider reported them — never content.
    { model: attempt.model, attempt: attempt.attempt, mode: attempt.mode, ...(attempt.usage ? { usage: attempt.usage } : {}) },
  );
}
