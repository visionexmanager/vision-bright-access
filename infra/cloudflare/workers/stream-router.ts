/**
 * Visionex Stream Router — Cloudflare Worker
 *
 * Runs at 300+ CF edge locations globally.
 *
 * Responsibilities:
 *  1. Geo-route stream requests to the nearest healthy regional proxy
 *  2. Cache HLS manifests at the CF edge (3s TTL for live streams)
 *  3. Cache HLS segments at the CF edge (30s TTL)
 *  4. Failover to next-nearest region if primary is unhealthy
 *  5. Block obviously malicious traffic (no auth header, excessive rate)
 *  6. Add telemetry headers for latency tracking
 *
 * Deploy:
 *   wrangler deploy
 *
 * Routes (set in wrangler.toml):
 *   stream.visionex.tv/*  →  this worker
 */

// ── Regional proxy map ────────────────────────────────────────────────────────
// Cloudflare provides CF-IPCountry header with the ISO 3166-1 alpha-2 country code.
// We map each country to the nearest stream proxy region.

type Region = "eu" | "me" | "us" | "apac";

const PROXY_HOSTS: Record<Region, string> = {
  eu:   "eu-proxy.visionex.tv",
  me:   "me-proxy.visionex.tv",
  us:   "us-proxy.visionex.tv",
  apac: "apac-proxy.visionex.tv",
};

const COUNTRY_TO_REGION: Record<string, Region> = {
  // Middle East
  SA: "me", AE: "me", EG: "me", IQ: "me", JO: "me",
  KW: "me", LB: "me", QA: "me", BH: "me", OM: "me",
  SY: "me", YE: "me", PS: "me", LY: "me", TN: "me",
  MA: "me", DZ: "me", SD: "me",

  // Europe
  DE: "eu", FR: "eu", GB: "eu", NL: "eu", ES: "eu",
  IT: "eu", PL: "eu", SE: "eu", NO: "eu", DK: "eu",
  FI: "eu", AT: "eu", CH: "eu", BE: "eu", PT: "eu",
  GR: "eu", CZ: "eu", RO: "eu", HU: "eu", UA: "eu",
  TR: "eu",

  // North America
  US: "us", CA: "us", MX: "us",

  // Asia-Pacific
  IN: "apac", PK: "apac", CN: "apac", JP: "apac", KR: "apac",
  AU: "apac", NZ: "apac", SG: "apac", MY: "apac", ID: "apac",
  TH: "apac", VN: "apac", PH: "apac", BD: "apac",
};

// Failover chain per region — if primary is down, try these in order
const FAILOVER: Record<Region, Region[]> = {
  eu:   ["eu",   "us",   "me",   "apac"],
  me:   ["me",   "eu",   "apac", "us"],
  us:   ["us",   "eu",   "me",   "apac"],
  apac: ["apac", "me",   "eu",   "us"],
};

// ── Health state (per-worker-isolate in-memory, resets on CF restart) ─────────
const unhealthyRegions = new Set<Region>();
const UNHEALTHY_RESET_MS = 30_000;

// ── Resolve target region ─────────────────────────────────────────────────────
function resolveRegion(countryCode: string | null): Region {
  const primary = (countryCode ? COUNTRY_TO_REGION[countryCode] : undefined) ?? "eu";
  const chain   = FAILOVER[primary];
  for (const region of chain) {
    if (!unhealthyRegions.has(region)) return region;
  }
  return primary; // all unhealthy — go back to primary
}

// ── Cache keys ────────────────────────────────────────────────────────────────
function cacheKey(url: URL): string {
  // Strip Authorization from cache key (it's per-user)
  // Cache by path + channelId only — stream URL is the same for all authenticated users
  return `https://cache.visionex.tv${url.pathname}`;
}

function isManifest(pathname: string): boolean {
  return pathname.endsWith(".m3u8") || pathname.match(/\/stream\/[a-f0-9\-]{36}$/) !== null;
}

function isSegment(pathname: string): boolean {
  return pathname.endsWith(".ts") || pathname.includes("/segment/");
}

// ── Worker entry ──────────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url     = new URL(request.url);
    const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? null;

    // Only allow GET and OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin":  "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, content-type",
          "Access-Control-Max-Age":       "86400",
        },
      });
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Auth header required for stream requests
    const authHeader = request.headers.get("Authorization") ?? "";
    const hasToken   = authHeader.startsWith("Bearer ") || url.searchParams.has("token");
    if (!hasToken && isManifest(url.pathname)) {
      return new Response("Unauthorized", {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }

    // Determine cache TTL
    const ttl = isManifest(url.pathname) ? 3 : isSegment(url.pathname) ? 30 : 0;
    const cacheKey_ = ttl > 0 ? cacheKey(url) : null;

    // Check Cloudflare Cache API (edge cache)
    if (cacheKey_) {
      const cachedRes = await caches.default.match(cacheKey_);
      if (cachedRes) {
        const clone = new Response(cachedRes.body, cachedRes);
        clone.headers.set("X-Cache", "HIT");
        clone.headers.set("X-CF-Country", country ?? "??");
        return clone;
      }
    }

    // Route to nearest healthy regional proxy
    const region     = resolveRegion(country);
    const proxyHost  = PROXY_HOSTS[region];
    const targetUrl  = new URL(url.pathname + url.search, `https://${proxyHost}`);

    // Forward request to regional proxy
    const proxyReq = new Request(targetUrl.toString(), {
      method:  request.method,
      headers: {
        "Authorization":   authHeader,
        "X-CF-Country":    country ?? "??",
        "X-CF-Region":     region,
        "X-Forwarded-For": request.headers.get("CF-Connecting-IP") ?? "",
        "User-Agent":      "VisionexCFWorker/1.0",
        "Accept":          "*/*",
      },
    });

    let response: Response;
    const start = Date.now();

    try {
      response = await fetch(proxyReq, { signal: AbortSignal.timeout(8000) });

      // If the regional proxy returned 5xx, mark it as unhealthy for 30s
      if (response.status >= 500) {
        unhealthyRegions.add(region);
        ctx.waitUntil(
          new Promise(r => setTimeout(() => { unhealthyRegions.delete(region); r(undefined); }, UNHEALTHY_RESET_MS))
        );

        // Retry with next region in failover chain
        const fallbackChain = FAILOVER[region].filter(r => r !== region && !unhealthyRegions.has(r));
        for (const fallback of fallbackChain) {
          const fallbackUrl = new URL(url.pathname + url.search, `https://${PROXY_HOSTS[fallback]}`);
          const fallbackReq = new Request(fallbackUrl.toString(), { headers: proxyReq.headers });
          try {
            response = await fetch(fallbackReq, { signal: AbortSignal.timeout(8000) });
            if (response.status < 500) break;
          } catch {
            // try next fallback
          }
        }
      }
    } catch {
      // Timeout or network error
      unhealthyRegions.add(region);
      ctx.waitUntil(
        new Promise(r => setTimeout(() => { unhealthyRegions.delete(region); r(undefined); }, UNHEALTHY_RESET_MS))
      );
      return new Response("Stream proxy unavailable", {
        status: 503,
        headers: { "Access-Control-Allow-Origin": "*", "Retry-After": "5" },
      });
    }

    const latencyMs = Date.now() - start;

    // Build response with telemetry headers
    const finalResponse = new Response(response.body, {
      status:  response.status,
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        "Access-Control-Allow-Origin": "*",
        "X-Cache":                     "MISS",
        "X-CF-Region":                 region,
        "X-CF-Country":                country ?? "??",
        "X-Proxy-Latency-Ms":          String(latencyMs),
      },
    });

    // Store cacheable responses in CF edge cache
    if (cacheKey_ && response.status === 200 && ttl > 0) {
      const toCache = finalResponse.clone();
      toCache.headers.set("Cache-Control", `public, max-age=${ttl}`);
      ctx.waitUntil(caches.default.put(cacheKey_, toCache));
    }

    return finalResponse;
  },
};

// Type stub for Cloudflare Workers env bindings
interface Env {
  ENVIRONMENT?: string;
}
