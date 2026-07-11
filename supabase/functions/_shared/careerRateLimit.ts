// Per-user rate limiting for the Career Center AI layer. Backed by
// ai_interactions (already logged by the orchestrator for every call), so
// this needs no new table — a sliding-window COUNT query is enough at this
// traffic scale.

// deno-lint-ignore no-explicit-any
type SupabaseServiceClient = any;

const WINDOW_MINUTES = 10;
const MAX_CALLS_PER_WINDOW = 20;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Checks how many AI calls this user made across all services in the last
 * WINDOW_MINUTES. Fails open (allows the call) if the count query itself
 * errors, so a rate-limit outage never takes down the AI feature.
 */
export async function checkRateLimit(
  supabase: SupabaseServiceClient,
  userId: string,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("ai_interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error("Rate limit check failed, failing open:", error);
    return { allowed: true };
  }

  if ((count ?? 0) >= MAX_CALLS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
  }

  return { allowed: true };
}
