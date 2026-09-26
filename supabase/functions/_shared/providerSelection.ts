// How the provider registry ranks rows, and shadow mode (Phase 2J-2).
//
// ── rankProviders ───────────────────────────────────────────────────────────
//
// The part of `providerRouter.resolveProvider()` that runs after its query —
// eligibility, capability filter, preferred slug, score — moved here unchanged
// so the same code can be driven without a database. resolveProvider() now
// queries and delegates; there is still exactly one ranking. It is NOT
// provider-hub's `selectProviders`, which has its own strategies and is not
// touched: unifying the two routers is a later decision.
//
// ── Shadow mode ─────────────────────────────────────────────────────────────
//
// Telemetry only. It answers "if the registry chose automatically for this
// request, which row would it pick?" by running the query resolveProvider()
// runs and ranking the result with rankProviders() — and then writes that
// answer down next to what was actually used. It never returns a provider to
// its caller, never changes a request, never touches `ph_metrics` or health,
// and never throws.
//
// Off unless PROVIDER_REGISTRY_SHADOW is exactly "true" — the same convention
// as RUNPOD_ENABLED. With it off, nothing is queried and nothing is written.
//
// Pure: no imports, no Deno. The database arrives as an argument.

export interface RankableProvider {
  id: string;
  slug: string;
  priority: number;
  health_score: number;
  avg_latency_ms: number;
  cost_per_request: number;
  capabilities: string[];
}

export interface RankingPreferences {
  requireCapabilities?: string[];
  preferredSlug?: string;
  excludeSlugs?: string[];
}

function scoreProvider(p: RankableProvider): number {
  const latencyScore  = Math.max(0, 100 - (p.avg_latency_ms / 20));
  const costScore     = Math.max(0, 100 - (p.cost_per_request * 500));
  const healthScore   = p.health_score;
  const priorityScore = Math.max(0, 100 - p.priority);
  return latencyScore * 0.25 + costScore * 0.20 + healthScore * 0.40 + priorityScore * 0.15;
}

/**
 * Rank rows already filtered to one type, `status <> 'inactive'`, ordered by
 * priority — exactly what resolveProvider's query returns. Null when nothing
 * is eligible.
 */
export function rankProviders<T extends RankableProvider>(
  providers: T[],
  prefs?: RankingPreferences,
): { provider: T; alternatives: T[] } | null {
  let eligible: T[] = providers.filter((p) =>
    p.health_score > 20 &&
    !(prefs?.excludeSlugs?.includes(p.slug))
  );

  if (prefs?.requireCapabilities?.length) {
    const req = prefs.requireCapabilities;
    eligible = eligible.filter((p) => req.every((c) => p.capabilities.includes(c)));
  }

  if (!eligible.length) return null;

  if (prefs?.preferredSlug) {
    const preferred = eligible.find((p) => p.slug === prefs!.preferredSlug);
    if (preferred) {
      return { provider: preferred, alternatives: eligible.filter((p) => p.slug !== prefs!.preferredSlug) };
    }
  }

  eligible.sort((a, b) => scoreProvider(b) - scoreProvider(a));
  return { provider: eligible[0], alternatives: eligible.slice(1) };
}

// ── Chat and vision chains: may the registry move a target later? ────────────
//
// The chat/vision loops in aiProvider.ts keep their code-defined order (it is
// quality policy) and ask the registry one question per target: should this
// one wait its turn? Yes when an admin has taken the row out (inactive,
// error), or when recorded attempts have degraded it or driven its health to
// the router's own exclusion line (health_score <= 20, as rankProviders).
//
// A demoted target is still tried after the others — never removed — and a
// row demoted by *health* (not by an admin) keeps its place on a small share
// of requests. Without that share it would only be reached when everything
// ahead of it failed, would earn no successes, and would stay demoted for
// ever: the "health never recovers" hazard found in Phase 2J.

export interface RegistryHealthRow {
  slug: string;
  status: string;
  health_score: number;
}

/** Share of requests on which a health-demoted row keeps its place. */
export const RECOVERY_TRIAL_SHARE = 0.1;

export function registryDemotes(
  row: RegistryHealthRow | undefined,
  random: () => number = Math.random,
): boolean {
  if (!row) return false; // no row: nothing to say, policy order stands
  if (row.status === "inactive" || row.status === "error") return true;
  const unhealthy = row.status === "degraded" || row.health_score <= 20;
  return unhealthy && random() >= RECOVERY_TRIAL_SHARE;
}

// ── Shadow mode ───────────────────────────────────────────────────────────────

export const SHADOW_ENV = "PROVIDER_REGISTRY_SHADOW";

type EnvReader = (name: string) => string | undefined;
const denoEnv: EnvReader = (name) =>
  (globalThis as { Deno?: { env?: { get(key: string): string | undefined } } }).Deno?.env?.get(name);

/** Off unless the variable is exactly "true". */
export function shadowEnabled(read: EnvReader = denoEnv): boolean {
  try {
    return read(SHADOW_ENV) === "true";
  } catch {
    return false;
  }
}

/** What the caller knows about the real request. Nothing about its content. */
export interface ShadowRequest {
  /** The edge function observing, e.g. "video-studio". */
  service: string;
  /** The registry type, e.g. "text_to_video". */
  jobType: string;
  /** How the real provider was chosen, e.g. "auto". */
  routingMode: string;
  /** The registry slug of the provider actually used, if it has one. */
  actualSlug: string | null;
  /** The caller's own id for this request (a job id), if it has one. */
  correlationId?: string | null;
}


/**
 * What one observation concluded. Every failure has its own code (Phase 2J-2
 * hardening) — `registry_error` used to cover three different causes:
 *
 *   query_error       the registry query answered with an error, answered
 *                     without rows, or itself rejected
 *   malformed         the rows came back, and at least one failed the shape
 *                     check (the whole observation is dropped, as before)
 *   unexpected_error  anything else threw
 *   timeout           the query took longer than the budget
 */
export type ShadowOutcome =
  | "match" | "mismatch" | "no_candidate"
  | "timeout" | "query_error" | "malformed" | "unexpected_error";

// deno-lint-ignore no-explicit-any
export type ShadowDb = any;

/**
 * The columns ranking needs, plus `status` — read only so it can be recorded,
 * never used to rank. No key reference, no config, no URL.
 */
const RANKING_COLUMNS = "id, slug, status, priority, health_score, avg_latency_ms, cost_per_request, capabilities";

/** How many candidates one observation records; `candidate_count` says how many there were. */
const MAX_RECORDED_CANDIDATES = 10;

function wellFormed(row: unknown): row is RankableProvider {
  const r = row as Record<string, unknown> | null;
  return !!r &&
    typeof r.id === "string" && typeof r.slug === "string" &&
    typeof r.priority === "number" && Number.isFinite(r.priority) &&
    Number.isFinite(Number(r.health_score)) &&
    Number.isFinite(Number(r.avg_latency_ms ?? 0)) &&
    Number.isFinite(Number(r.cost_per_request ?? 0)) &&
    (r.capabilities == null || Array.isArray(r.capabilities));
}

/** One considered row, as recorded: what explains a choice and nothing else. */
export interface ShadowCandidate {
  slug: string;
  status: string | null;
  /** Passed rankProviders' eligibility (health above its threshold). */
  eligible: boolean;
  /** 1 for the registry's choice; null when not eligible. */
  rank: number | null;
  health_score: number;
  priority: number;
  avg_latency_ms: number;
}

/**
 * The considered rows, ranked the way rankProviders ranked them, then the
 * ineligible ones. Derived from rankProviders' own answer — the ranking is
 * not recomputed or changed here. Deliberately without `cost_per_request`,
 * and without a score, which would reveal it.
 */
function describeCandidates(
  rows: (RankableProvider & { status?: unknown })[],
  ranked: { provider: RankableProvider; alternatives: RankableProvider[] } | null,
): ShadowCandidate[] {
  const order = ranked ? [ranked.provider, ...ranked.alternatives] : [];
  const rankOf = new Map(order.map((p, i) => [p.slug, i + 1]));
  const shape = (r: RankableProvider & { status?: unknown }): ShadowCandidate => ({
    slug: r.slug,
    status: typeof r.status === "string" ? r.status : null,
    eligible: rankOf.has(r.slug),
    rank: rankOf.get(r.slug) ?? null,
    health_score: r.health_score,
    priority: r.priority,
    avg_latency_ms: r.avg_latency_ms,
  });
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  return [
    ...order.map((p) => shape(bySlug.get(p.slug) ?? p)),
    ...rows.filter((r) => !rankOf.has(r.slug)).map(shape),
  ];
}

/**
 * Work out and record what the registry would have chosen. Never throws and
 * never returns a provider: the caller has already chosen, and keeps its
 * choice. Returns the outcome only so tests can see it.
 */
export async function observeShadow(
  db: ShadowDb,
  request: ShadowRequest,
  options: { timeoutMs?: number } = {},
): Promise<ShadowOutcome> {
  let outcome: ShadowOutcome;
  let chosen: RankableProvider | null = null;
  let candidates: ShadowCandidate[] = [];
  let candidateCount = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const query = db
      .from("ph_providers")
      .select(RANKING_COLUMNS)
      .eq("type", request.jobType)
      .neq("status", "inactive")
      .order("priority");
    // A rejected query is the registry failing, not this code: it is mapped
    // to query_error here so the catch below means only "something else".
    type QueryAnswer = { rejected?: boolean; error?: unknown; data?: unknown };
    const answered: Promise<QueryAnswer> = Promise.resolve(query).then(
      (a: unknown) => (a ?? {}) as QueryAnswer,
      () => ({ rejected: true }),
    );
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), options.timeoutMs ?? 2_000);
    });
    const answer = await Promise.race([answered, timeout]);
    clearTimeout(timer);

    const data = answer !== "timeout" && Array.isArray(answer.data) ? answer.data as unknown[] : null;

    if (answer === "timeout") {
      outcome = "timeout";
    } else if (answer.rejected || answer.error || !data) {
      outcome = "query_error";
    } else if (!data.every(wellFormed)) {
      outcome = "malformed";
    } else {
      const rows = (data as (RankableProvider & { status?: unknown })[]).map((r) => ({
        ...r,
        health_score: Number(r.health_score),
        avg_latency_ms: Number(r.avg_latency_ms ?? 0),
        cost_per_request: Number(r.cost_per_request ?? 0),
        capabilities: r.capabilities ?? [],
      }));
      // rankProviders sorts its own copy's order in place; give it a copy so
      // the rows kept for the record stay as they came.
      const ranked = rankProviders(rows.map((r: RankableProvider) => ({ ...r })));
      chosen = ranked?.provider ?? null;
      const described = describeCandidates(rows, ranked);
      candidateCount = described.length;
      candidates = described.slice(0, MAX_RECORDED_CANDIDATES);
      outcome = !chosen ? "no_candidate" : chosen.slug === request.actualSlug ? "match" : "mismatch";
    }
  } catch {
    outcome = "unexpected_error";
  } finally {
    clearTimeout(timer);
  }

  try {
    const written = await db.from("ph_logs").insert({
      provider_id:   chosen?.id ?? null,
      provider_slug: chosen?.slug ?? null,
      job_type:      request.jobType,
      // Not "generation": nothing ran. `skipped` keeps the admin log from
      // showing a hypothetical as a success or a failure.
      action:        "shadow_selection",
      status:        "skipped",
      error_code:    outcome,
      error_message: "shadow observation — not executed",
      request_meta:  {
        service:         request.service,
        routing_mode:    request.routingMode,
        actual_provider: request.actualSlug,
        correlation_id:  request.correlationId ?? null,
        candidates,
        candidate_count: candidateCount,
      },
    });
    // supabase-js reports a failed insert instead of throwing. It used to be
    // ignored, so a broken write left no trace at all. The code is a short
    // SQLSTATE; the message and details, which can quote the database, are
    // never logged.
    const error = (written as { error?: { code?: unknown } | null } | null)?.error;
    if (error) {
      console.error("[provider-shadow] log_write_failed", typeof error.code === "string" ? error.code : "unknown");
    }
  } catch {
    // Telemetry. Losing one observation is always preferable to anything else.
    console.error("[provider-shadow] log_write_threw");
  }

  return outcome;
}
