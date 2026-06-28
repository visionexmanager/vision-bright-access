/**
 * Visionex TV — Cloudflare Worker
 * Global edge router: geo-routing, HLS caching, failover, rate limiting
 * Deploy: wrangler deploy
 */

// Region backends — map Cloudflare region codes to cluster origins
const REGION_BACKENDS = {
  EU:  "https://eu.api.tv.visionex.app",   // Europe (primary)
  ME:  "https://me.api.tv.visionex.app",   // Middle East
  US:  "https://us.api.tv.visionex.app",   // North America
  AS:  "https://as.api.tv.visionex.app",   // Asia
};

const FALLBACK_ORDER = {
  EU: ["EU", "US", "ME", "AS"],
  ME: ["ME", "EU", "AS", "US"],
  US: ["US", "EU", "AS", "ME"],
  AS: ["AS", "ME", "EU", "US"],
};

// HLS segment cache TTL (in seconds)
const HLS_SEGMENT_TTL    = 4;      // short — live segments expire fast
const HLS_PLAYLIST_TTL   = 2;      // M3U8 playlists refresh every 2s
const STATIC_ASSET_TTL   = 86400;  // 24h for static assets

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const region = getRegion(request);

    // ── Rate limiting ──────────────────────────────────────────────
    const ip          = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const rateLimitKey = `rl:${ip}:${Math.floor(Date.now() / 60_000)}`;
    const rateCount   = await env.RATE_LIMIT.get(rateLimitKey);
    if (rateCount && parseInt(rateCount) > 200) {
      return new Response("Too Many Requests", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
    ctx.waitUntil(incrementRateLimit(env.RATE_LIMIT, rateLimitKey));

    // ── HLS segment caching (edge cache) ──────────────────────────
    const isHLS      = url.pathname.endsWith(".m3u8") || url.pathname.endsWith(".ts");
    const isPlaylist = url.pathname.endsWith(".m3u8");
    if (isHLS && request.method === "GET") {
      const cache    = caches.default;
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cached   = await cache.match(cacheKey);
      if (cached) return cached;

      const origin   = await resolveOrigin(region, env);
      const upstream = await proxyToOrigin(request, origin, url);
      if (upstream.ok) {
        const toCache = upstream.clone();
        const ttl     = isPlaylist ? HLS_PLAYLIST_TTL : HLS_SEGMENT_TTL;
        ctx.waitUntil(
          cache.put(cacheKey, addCacheHeaders(toCache, ttl))
        );
      }
      return upstream;
    }

    // ── Stream proxy requests — geo-route ─────────────────────────
    if (url.pathname.startsWith("/stream/") || url.pathname.startsWith("/api/tv/")) {
      return geoRoute(request, region, env, url);
    }

    // ── WebSocket upgrade — passthrough to nearest WS server ──────
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader?.toLowerCase() === "websocket") {
      return geoRoute(request, region, env, url);
    }

    // ── Default: proxy to nearest backend ─────────────────────────
    return geoRoute(request, region, env, url);
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function getRegion(request) {
  const cf = request.cf;
  if (!cf) return "EU";
  const continent = cf.continent;
  if (continent === "EU") return "EU";
  if (continent === "AS") {
    // Split Asia and Middle East by longitude
    return (cf.longitude && parseFloat(cf.longitude) < 60) ? "ME" : "AS";
  }
  if (continent === "NA" || continent === "SA") return "US";
  return "EU";
}

async function resolveOrigin(region, env) {
  // Check health state from KV store
  const order = FALLBACK_ORDER[region] ?? FALLBACK_ORDER.EU;
  for (const r of order) {
    const healthy = await env.REGION_HEALTH.get(`health:${r}`);
    if (healthy !== "down") return REGION_BACKENDS[r];
  }
  return REGION_BACKENDS.EU;  // absolute fallback
}

async function geoRoute(request, region, env, url) {
  const order = FALLBACK_ORDER[region] ?? FALLBACK_ORDER.EU;
  let lastError;
  for (const r of order) {
    const healthy = await env.REGION_HEALTH.get(`health:${r}`);
    if (healthy === "down") continue;
    try {
      const origin   = REGION_BACKENDS[r];
      const response = await proxyToOrigin(request, origin, url);
      if (response.status < 500) {
        // Add region header for debugging
        const headers = new Headers(response.headers);
        headers.set("X-Visionex-Region", r);
        headers.set("X-Visionex-Latency", Date.now().toString());
        return new Response(response.body, { status: response.status, headers });
      }
      // 5xx → mark region degraded and try next
      await env.REGION_HEALTH.put(`health:${r}`, "degraded", { expirationTtl: 30 });
    } catch (e) {
      lastError = e;
      await env.REGION_HEALTH.put(`health:${r}`, "down", { expirationTtl: 60 });
    }
  }
  return new Response(JSON.stringify({ error: "All regions unavailable", code: "SERVICE_UNAVAILABLE" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
}

async function proxyToOrigin(request, origin, url) {
  const targetUrl = `${origin}${url.pathname}${url.search}`;
  return fetch(targetUrl, {
    method:  request.method,
    headers: request.headers,
    body:    request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "follow",
  });
}

function addCacheHeaders(response, ttl) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttl}, s-maxage=${ttl}`);
  headers.set("CDN-Cache-Control", `max-age=${ttl}`);
  return new Response(response.body, { status: response.status, headers });
}

async function incrementRateLimit(kv, key) {
  const current = parseInt((await kv.get(key)) ?? "0");
  await kv.put(key, String(current + 1), { expirationTtl: 60 });
}
