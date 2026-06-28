/**
 * Visionex Stream Proxy
 *
 * Responsibilities:
 *  1. Validate Supabase JWT tokens on every request
 *  2. Resolve the real HLS stream URL (via in-memory cache → Supabase)
 *  3. Proxy HLS manifests + segments to the browser with CORS headers
 *  4. Rate-limit by IP (300 req/min)
 *  5. Expose /health and /metrics endpoints for Kubernetes probes + Prometheus
 *
 * Flow:
 *   GET /stream/:channelId?token=<jwt>
 *     → validate JWT
 *     → look up cached stream URL for channelId
 *     → pipe upstream HLS response to client
 *
 * Deploy: 1 pod per region behind an L7 load balancer (see k8s/stream-proxy/).
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";
import { jwtVerify, createRemoteJWKSet } from "jose";

// ── Environment ────────────────────────────────────────────────
const PORT            = parseInt(process.env.PORT             ?? "8080");
const SUPABASE_URL    = process.env.SUPABASE_URL              ?? "";
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const REGION          = process.env.REGION                    ?? "unknown";
const LOG_LEVEL       = process.env.LOG_LEVEL                 ?? "info";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("[boot] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/jwks`));

// ── In-memory caches ────────────────────────────────────────────

// Channel stream URL cache: channelId → { url, expiresAt }
const streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
const STREAM_CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Rate limiter: IP → { count, windowStart }
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW_MS  = 60_000;
const RATE_MAX        = 300;

// Prometheus-style counters
const metrics = {
  requestsTotal:       0,
  requestsRateLimited: 0,
  requestsUnauthorized:0,
  proxySuccesses:      0,
  proxyErrors:         0,
  cacheHits:           0,
  cacheMisses:         0,
};

// ── Rate limiter ────────────────────────────────────────────────
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_MAX) return true;
  entry.count++;
  return false;
}

// Prune rate limit store every 2 minutes to avoid unbounded growth
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [ip, entry] of rateLimitStore) {
    if (entry.windowStart < cutoff) rateLimitStore.delete(ip);
  }
}, 120_000);

// ── JWT validation ──────────────────────────────────────────────
async function validateJWT(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `${SUPABASE_URL}/auth/v1` });
    return payload as { sub: string };
  } catch {
    return null;
  }
}

// ── Stream URL resolution ───────────────────────────────────────
async function resolveStreamUrl(channelId: string): Promise<string | null> {
  // Check cache first
  const cached = streamUrlCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) {
    metrics.cacheHits++;
    return cached.url;
  }

  metrics.cacheMisses++;

  // Fetch from Supabase (service role bypasses RLS)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tv_channels?id=eq.${encodeURIComponent(channelId)}&is_active=eq.true&select=stream_url`,
    {
      headers: {
        "apikey":        SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Accept":        "application/json",
      },
    }
  );

  if (!res.ok) return null;

  const rows = await res.json() as Array<{ stream_url: string }>;
  const url  = rows?.[0]?.stream_url ?? null;

  if (url) {
    streamUrlCache.set(channelId, { url, expiresAt: Date.now() + STREAM_CACHE_TTL_MS });
  }

  return url;
}

// ── HLS proxy ───────────────────────────────────────────────────
function proxyStream(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  upstreamUrl: string
): void {
  const parsed  = new URL(upstreamUrl);
  const isHttps = parsed.protocol === "https:";
  const lib     = isHttps ? https : http;

  const upstreamReq = lib.request(
    {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers: {
        "User-Agent":       "VisionexStreamProxy/1.0",
        "Accept":           "*/*",
        "Accept-Encoding":  "identity",  // no compression — we stream raw
        "Connection":       "keep-alive",
      },
      timeout: 10_000,
    },
    (upstreamRes) => {
      const status = upstreamRes.statusCode ?? 502;

      res.writeHead(status, {
        "Content-Type":                 upstreamRes.headers["content-type"] ?? "application/octet-stream",
        "Cache-Control":                upstreamUrl.endsWith(".m3u8") ? "no-cache, max-age=3" : "public, max-age=30",
        "Access-Control-Allow-Origin":  "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "X-Proxy-Region":               REGION,
      });

      upstreamRes.pipe(res);

      upstreamRes.on("end", () => {
        if (status < 400) metrics.proxySuccesses++;
        else               metrics.proxyErrors++;
      });
    }
  );

  upstreamReq.on("timeout", () => {
    upstreamReq.destroy();
    if (!res.headersSent) {
      res.writeHead(504);
      res.end("upstream timeout");
    }
    metrics.proxyErrors++;
  });

  upstreamReq.on("error", () => {
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("upstream error");
    }
    metrics.proxyErrors++;
  });

  upstreamReq.end();
}

// ── Metrics serializer (Prometheus text format) ─────────────────
function renderMetrics(): string {
  return [
    `# HELP visionex_stream_requests_total Total proxy requests`,
    `# TYPE visionex_stream_requests_total counter`,
    `visionex_stream_requests_total{region="${REGION}"} ${metrics.requestsTotal}`,
    `# HELP visionex_stream_rate_limited Rate-limited requests`,
    `# TYPE visionex_stream_rate_limited counter`,
    `visionex_stream_rate_limited{region="${REGION}"} ${metrics.requestsRateLimited}`,
    `# HELP visionex_stream_unauthorized Unauthorized requests`,
    `# TYPE visionex_stream_unauthorized counter`,
    `visionex_stream_unauthorized{region="${REGION}"} ${metrics.requestsUnauthorized}`,
    `# HELP visionex_stream_proxy_successes Successful upstream proxy responses`,
    `# TYPE visionex_stream_proxy_successes counter`,
    `visionex_stream_proxy_successes{region="${REGION}"} ${metrics.proxySuccesses}`,
    `# HELP visionex_stream_proxy_errors Upstream proxy errors`,
    `# TYPE visionex_stream_proxy_errors counter`,
    `visionex_stream_proxy_errors{region="${REGION}"} ${metrics.proxyErrors}`,
    `# HELP visionex_stream_cache_hits Stream URL cache hits`,
    `# TYPE visionex_stream_cache_hits counter`,
    `visionex_stream_cache_hits{region="${REGION}"} ${metrics.cacheHits}`,
    `# HELP visionex_stream_cache_misses Stream URL cache misses`,
    `# TYPE visionex_stream_cache_misses counter`,
    `visionex_stream_cache_misses{region="${REGION}"} ${metrics.cacheMisses}`,
    `# HELP visionex_stream_cache_size Current stream URL cache size`,
    `# TYPE visionex_stream_cache_size gauge`,
    `visionex_stream_cache_size{region="${REGION}"} ${streamUrlCache.size}`,
  ].join("\n") + "\n";
}

// ── Request router ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url    = new URL(req.url ?? "/", `http://localhost`);
  const path   = url.pathname;
  const method = req.method ?? "GET";

  // ── Internal endpoints ──────────────────────────────────────
  if (method === "GET" && path === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      region: REGION,
      uptime: process.uptime(),
      cacheSize: streamUrlCache.size,
    }));
    return;
  }

  if (method === "GET" && path === "/metrics") {
    // Only allow internal access (Kubernetes pod network)
    const clientIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
      ?? (req.socket.remoteAddress ?? "");
    const isInternal = clientIp.startsWith("10.") || clientIp.startsWith("172.") ||
                       clientIp.startsWith("192.168.") || clientIp === "127.0.0.1" || clientIp === "::1";
    if (!isInternal) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4" });
    res.end(renderMetrics());
    return;
  }

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Max-Age":       "86400",
    });
    res.end();
    return;
  }

  // ── Stream proxy route: GET /stream/:channelId ──────────────
  const streamMatch = path.match(/^\/stream\/([a-f0-9-]{36})$/);
  if (!streamMatch || method !== "GET") {
    res.writeHead(404);
    res.end("not found");
    return;
  }

  metrics.requestsTotal++;

  const channelId = streamMatch[1];
  const clientIp  = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? (req.socket.remoteAddress ?? "unknown");

  // Rate limiting
  if (isRateLimited(clientIp)) {
    metrics.requestsRateLimited++;
    res.writeHead(429, {
      "Retry-After":                 "60",
      "Access-Control-Allow-Origin": "*",
    });
    res.end("rate limit exceeded");
    return;
  }

  // JWT auth
  const authHeader = req.headers["authorization"] ?? "";
  const token      = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : url.searchParams.get("token") ?? "";

  const payload = await validateJWT(token);
  if (!payload) {
    metrics.requestsUnauthorized++;
    res.writeHead(401, { "Access-Control-Allow-Origin": "*" });
    res.end("unauthorized");
    return;
  }

  // Resolve stream URL
  const streamUrl = await resolveStreamUrl(channelId);
  if (!streamUrl) {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
    res.end("channel not found or unavailable");
    return;
  }

  if (LOG_LEVEL === "debug") {
    console.log(`[proxy] user=${payload.sub} channel=${channelId} ip=${clientIp}`);
  }

  // Proxy the HLS stream
  proxyStream(req, res, streamUrl);
});

server.listen(PORT, () => {
  console.log(`[boot] Visionex Stream Proxy listening on :${PORT} — region=${REGION}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[shutdown] SIGTERM received — closing server");
  server.close(() => process.exit(0));
});
