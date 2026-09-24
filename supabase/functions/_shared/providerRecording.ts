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
    failover_to:   params.failover_to ?? null,
  });

  // Record failover event
  if (!params.success && params.failover_to) {
    const { data: toProvider } = await db
      .from("ph_providers")
      .select("id, slug")
      .eq("slug", params.failover_to)
      .maybeSingle();

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
 * The registry row each kind of content-media generation is recorded against.
 *
 * `image` is the `openai-image` row Phase 2C seeded, which `image-generate`
 * already records against. `video` has none — Sora is not in `ph_providers`,
 * and adding it is a migration and a decision, not a side effect of this — so
 * a video outcome is not recorded.
 */
export const MEDIA_PROVIDER_SLUG: Record<MediaKind, string | null> = {
  image: "openai-image",
  video: null,
};

/**
 * Record one content-media outcome. Best-effort: it never throws, so a
 * registry that is down cannot cost anyone a picture.
 */
export async function recordMediaOutcome(db: RecordingDb, outcome: MediaOutcome): Promise<void> {
  const slug = MEDIA_PROVIDER_SLUG[outcome.kind];
  if (!slug) return;
  try {
    const row = await providerBySlugIn(db, slug);
    if (!row) return;
    await recordResultIn(db, {
      provider_id:   row.id,
      provider_slug: row.slug,
      job_type:      outcome.kind,
      success:       outcome.success,
      latency_ms:    outcome.ms,
      error_message: outcome.error,
    });
  } catch {
    // Best-effort. The caller's result must never depend on this.
  }
}
