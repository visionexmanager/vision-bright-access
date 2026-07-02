/**
 * tv-validate-stream — Supabase Edge Function
 *
 * Periodically validates the availability of every active stream source.
 * Updates the `tv_stream_sources.reliability` score and `last_checked_at`.
 *
 * Trigger: call on a schedule (e.g. every 5 minutes via cron or Supabase pg_cron).
 * Also accepts POST with { channelId } to validate a specific channel on demand.
 *
 * Validation logic:
 *  1. Fetch top N active stream sources ordered by priority
 *  2. HEAD request each HLS manifest URL (10s timeout)
 *  3. On 200: increment up-score; on error: decrement
 *  4. New reliability = weighted moving average: 0.7 × old + 0.3 × sample
 *  5. Write updated reliability + timestamp back to DB
 *
 * The reliability score (0–100) is used by the multi-source failover player
 * to pick the best stream source when the primary source fails.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE   = 50;   // max sources validated per invocation
const TIMEOUT_MS   = 10_000;
const WEIGHT_NEW   = 0.30; // weight of the latest sample in the EMA
const WEIGHT_OLD   = 0.70; // weight of historical reliability

type StreamSource = {
  id:          string;
  channel_id:  string;
  url:         string;
  type:        string;
  reliability: number;
  priority:    number;
};

async function validateUrl(url: string): Promise<{ ok: boolean; statusCode: number; latencyMs: number }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method:  "HEAD",
      signal:  controller.signal,
      headers: { "User-Agent": "VisionexStreamValidator/1.0" },
    });
    clearTimeout(tid);
    return {
      ok:         res.ok,
      statusCode: res.status,
      latencyMs:  Date.now() - start,
    };
  } catch (err) {
    clearTimeout(tid);
    return {
      ok:         false,
      statusCode: (err instanceof Error && err.name === "AbortError") ? 408 : 0,
      latencyMs:  Date.now() - start,
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Optional: validate a specific channel on demand
  let channelFilter: string | null = null;
  if (req.method === "POST") {
    try {
      const body = await req.json() as { channelId?: string };
      channelFilter = body.channelId ?? null;
    } catch { /* ignore */ }
  }

  // Fetch stream sources to validate
  let query = supabase
    .from("tv_stream_sources")
    .select("id, channel_id, url, type, reliability, priority")
    .eq("is_active", true)
    .order("last_checked_at", { ascending: true })   // check least-recently-validated first
    .limit(BATCH_SIZE);

  if (channelFilter) {
    query = query.eq("channel_id", channelFilter);
  }

  const { data: sources, error: fetchErr } = await query;

  if (fetchErr) {
    console.error("[tv-validate-stream] fetch error:", fetchErr);
    return Response.json({ error: "db_fetch_failed" }, { status: 500, headers: CORS });
  }

  if (!sources || sources.length === 0) {
    return Response.json({ validated: 0, message: "no sources to validate" }, { headers: CORS });
  }

  // Validate all sources in parallel (batched to avoid overwhelming the edge runtime)
  const PARALLEL = 10;
  const results: Array<{ id: string; reliability: number; ok: boolean; latencyMs: number }> = [];

  for (let i = 0; i < (sources as StreamSource[]).length; i += PARALLEL) {
    const batch = (sources as StreamSource[]).slice(i, i + PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (source) => {
        const { ok, latencyMs } = await validateUrl(source.url);

        // Exponential moving average: blend old score with new 0/100 sample
        const sample     = ok ? 100 : 0;
        const newScore   = Math.round(WEIGHT_OLD * source.reliability + WEIGHT_NEW * sample);

        return {
          id:          source.id,
          reliability: Math.max(0, Math.min(100, newScore)),
          ok,
          latencyMs,
        };
      })
    );
    results.push(...batchResults);
  }

  // Batch-update reliability scores
  const updates = results.map(r => ({
    id:              r.id,
    reliability:     r.reliability,
    last_checked_at: new Date().toISOString(),
  }));

  const { error: updateErr } = await supabase
    .from("tv_stream_sources")
    .upsert(updates, { onConflict: "id" });

  if (updateErr) {
    console.error("[tv-validate-stream] update error:", updateErr);
    return Response.json({ error: "db_update_failed" }, { status: 500, headers: CORS });
  }

  const passed  = results.filter(r => r.ok).length;
  const failed  = results.length - passed;
  const avgMs   = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);

  console.log(`[tv-validate-stream] validated=${results.length} ok=${passed} fail=${failed} avgLatency=${avgMs}ms`);

  return Response.json(
    {
      validated:     results.length,
      passed,
      failed,
      avgLatencyMs:  avgMs,
      checkedAt:     new Date().toISOString(),
    },
    { headers: CORS }
  );
});
