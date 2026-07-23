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
 *  2. GET the HLS manifest and verify its signature (HEAD is unreliable on CDNs)
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
  consecutive_failures: number;
};

async function validateUrl(url: string): Promise<{ ok: boolean; statusCode: number; latencyMs: number }> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method:  "GET",
      signal:  controller.signal,
      headers: {
        "Accept": "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
        "Range": "bytes=0-8191",
        "User-Agent": "VisionexStreamValidator/2.0",
      },
    });
    const prefix = (await res.text()).trimStart().slice(0, 7);
    clearTimeout(tid);
    return {
      ok:         res.ok && prefix === "#EXTM3U",
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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
    .select("id, channel_id, url, type, reliability, priority, consecutive_failures")
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
  const results: Array<{
    id: string;
    channelId: string;
    reliability: number;
    consecutiveFailures: number;
    disable: boolean;
    ok: boolean;
    latencyMs: number;
  }> = [];

  for (let i = 0; i < (sources as StreamSource[]).length; i += PARALLEL) {
    const batch = (sources as StreamSource[]).slice(i, i + PARALLEL);
    const batchResults = await Promise.all(
      batch.map(async (source) => {
        const { ok, latencyMs } = await validateUrl(source.url);

        // Exponential moving average: blend old score with new 0/100 sample
        const sample     = ok ? 100 : 0;
        const newScore   = Math.round(WEIGHT_OLD * source.reliability + WEIGHT_NEW * sample);
        const consecutiveFailures = ok ? 0 : source.consecutive_failures + 1;

        return {
          id:          source.id,
          channelId:   source.channel_id,
          reliability: Math.max(0, Math.min(100, newScore)),
          consecutiveFailures,
          disable:     consecutiveFailures >= 3,
          ok,
          latencyMs,
        };
      })
    );
    results.push(...batchResults);
  }

  // Update existing rows. An upsert cannot be used here because required
  // channel_id/url columns are intentionally absent from these health updates.
  const checkedAt = new Date().toISOString();
  const updateResults = await Promise.all(results.map(r =>
    supabase
      .from("tv_stream_sources")
      .update({
        reliability: r.reliability,
        consecutive_failures: r.consecutiveFailures,
        last_checked_at: checkedAt,
        is_active: !r.disable,
      })
      .eq("id", r.id)
  ));
  const updateErr = updateResults.find(result => result.error)?.error;

  if (updateErr) {
    console.error("[tv-validate-stream] update error:", updateErr);
    return Response.json({ error: "db_update_failed" }, { status: 500, headers: CORS });
  }

  // A channel disappears only when every one of its sources has failed three
  // consecutive checks. A transient CDN outage therefore cannot remove it.
  const affectedChannelIds = [...new Set(results.filter(r => r.disable).map(r => r.channelId))];
  for (const channelId of affectedChannelIds) {
    const { count } = await supabase
      .from("tv_stream_sources")
      .select("id", { count: "exact", head: true })
      .eq("channel_id", channelId)
      .eq("is_active", true);

    if ((count ?? 0) === 0) {
      await supabase
        .from("tv_channels")
        .update({ is_active: false })
        .eq("id", channelId);
    }
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
