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

export type ShadowOutcome = "match" | "mismatch" | "no_candidate" | "timeout" | "registry_error" | "malformed";

// deno-lint-ignore no-explicit-any
export type ShadowDb = any;

/** The columns ranking needs and nothing more — no key reference, no config. */
const RANKING_COLUMNS = "id, slug, priority, health_score, avg_latency_ms, cost_per_request, capabilities";

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
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const query = db
      .from("ph_providers")
      .select(RANKING_COLUMNS)
      .eq("type", request.jobType)
      .neq("status", "inactive")
      .order("priority");
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), options.timeoutMs ?? 2_000);
    });
    const answer = await Promise.race([Promise.resolve(query), timeout]);
    clearTimeout(timer);

    if (answer === "timeout") {
      outcome = "timeout";
    } else if (answer?.error || !Array.isArray(answer?.data)) {
      outcome = "registry_error";
    } else if (!answer.data.every(wellFormed)) {
      outcome = "malformed";
    } else {
      const rows = answer.data.map((r: RankableProvider) => ({
        ...r,
        health_score: Number(r.health_score),
        avg_latency_ms: Number(r.avg_latency_ms ?? 0),
        cost_per_request: Number(r.cost_per_request ?? 0),
        capabilities: r.capabilities ?? [],
      }));
      chosen = rankProviders(rows)?.provider ?? null;
      outcome = !chosen ? "no_candidate" : chosen.slug === request.actualSlug ? "match" : "mismatch";
    }
  } catch {
    outcome = "registry_error";
  } finally {
    clearTimeout(timer);
  }

  try {
    await db.from("ph_logs").insert({
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
      },
    });
  } catch {
    // Telemetry. Losing one observation is always preferable to anything else.
  }

  return outcome;
}
