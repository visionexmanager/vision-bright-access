/**
 * Visionex TV — Stream Proxy Service
 * Proxies HLS streams through FFmpeg, segments to RAM disk, serves via HTTP
 */
import http from "http";
import { parse } from "url";
import { spawn, ChildProcess } from "child_process";
import { readdir, readFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { createClient } from "redis";

const PORT       = parseInt(process.env.PORT       ?? "8080");
const METRICS_PORT = parseInt(process.env.METRICS_PORT ?? "9090");
const HLS_DIR    = process.env.HLS_DIR             ?? "/tmp/hls";
const REDIS_URL  = process.env.REDIS_URL           ?? "redis://localhost:6379";
const MAX_STREAMS = parseInt(process.env.MAX_CONCURRENT_STREAMS ?? "50");

// Active FFmpeg processes keyed by sourceId
const activeStreams = new Map<string, ChildProcess>();
let metricsStreamCount = 0;
let metricsProxyRequests = 0;

const redis = createClient({ url: REDIS_URL });
redis.on("error", (e) => console.error("[redis]", e.message));

async function startProxy(sourceId: string, originUrl: string): Promise<string> {
  if (activeStreams.has(sourceId)) return `/hls/${sourceId}/index.m3u8`;
  if (activeStreams.size >= MAX_STREAMS) throw new Error("PROXY_AT_CAPACITY");

  const outDir = path.join(HLS_DIR, sourceId);
  await mkdir(outDir, { recursive: true });

  const ff = spawn("ffmpeg", [
    "-re",
    "-fflags",        "+nobuffer",
    "-flags",         "low_delay",
    "-i",             originUrl,
    "-c:v",           "copy",
    "-c:a",           "aac",
    "-ar",            "44100",
    "-f",             "hls",
    "-hls_time",      "2",
    "-hls_list_size", "5",
    "-hls_flags",     "delete_segments+append_list+omit_endlist",
    "-hls_segment_filename", path.join(outDir, "seg%d.ts"),
    path.join(outDir, "index.m3u8"),
  ], { stdio: ["ignore", "pipe", "pipe"] });

  ff.stderr.on("data", (d: Buffer) => {
    const msg = d.toString();
    if (msg.includes("Error") || msg.includes("error")) {
      console.error(`[stream:${sourceId}]`, msg.trim());
    }
  });

  ff.on("exit", (code) => {
    console.log(`[stream:${sourceId}] FFmpeg exited (code=${code})`);
    activeStreams.delete(sourceId);
    metricsStreamCount = activeStreams.size;
    // Notify backend of stream death
    redis.publish("stream:died", JSON.stringify({ sourceId, code })).catch(() => {});
  });

  activeStreams.set(sourceId, ff);
  metricsStreamCount = activeStreams.size;
  return `/hls/${sourceId}/index.m3u8`;
}

function stopProxy(sourceId: string) {
  const ff = activeStreams.get(sourceId);
  if (ff) {
    ff.kill("SIGTERM");
    activeStreams.delete(sourceId);
    metricsStreamCount = activeStreams.size;
  }
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { pathname, query } = parse(req.url ?? "/", true);
  metricsProxyRequests++;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // GET /health
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok", streams: activeStreams.size }));
  }

  // POST /proxy/start  { sourceId, originUrl }
  if (pathname === "/proxy/start" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => body += c);
    req.on("end", async () => {
      try {
        const { sourceId, originUrl } = JSON.parse(body);
        if (!sourceId || !originUrl) throw new Error("sourceId and originUrl required");
        const hlsPath = await startProxy(sourceId, originUrl);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ hlsPath }));
      } catch (e: any) {
        const status = e.message === "PROXY_AT_CAPACITY" ? 503 : 400;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // DELETE /proxy/:sourceId
  if (pathname?.startsWith("/proxy/") && req.method === "DELETE") {
    const sourceId = pathname.split("/")[2];
    stopProxy(sourceId);
    res.writeHead(204);
    return res.end();
  }

  // GET /hls/:sourceId/:file
  if (pathname?.startsWith("/hls/")) {
    const parts   = pathname.split("/");
    const sourceId = parts[2];
    const file     = parts[3];
    const filePath = path.join(HLS_DIR, sourceId, file);
    try {
      const data = await readFile(filePath);
      const ct   = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t";
      const ttl  = file.endsWith(".m3u8") ? 2 : 4;
      res.writeHead(200, {
        "Content-Type":  ct,
        "Cache-Control": `public, max-age=${ttl}`,
      });
      return res.end(data);
    } catch {
      res.writeHead(404);
      return res.end("Not Found");
    }
  }

  res.writeHead(404);
  res.end("Not Found");
});

// ── Metrics server (Prometheus) ──────────────────────────────────────────────
const metricsServer = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end([
    `# HELP stream_proxy_active_streams Active FFmpeg stream processes`,
    `# TYPE stream_proxy_active_streams gauge`,
    `stream_proxy_active_streams ${metricsStreamCount}`,
    `# HELP stream_proxy_requests_total Total proxy HTTP requests`,
    `# TYPE stream_proxy_requests_total counter`,
    `stream_proxy_requests_total ${metricsProxyRequests}`,
    `# HELP stream_proxy_capacity Max concurrent streams`,
    `# TYPE stream_proxy_capacity gauge`,
    `stream_proxy_capacity ${MAX_STREAMS}`,
  ].join("\n") + "\n");
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(sig: string) {
  console.log(`[shutdown] ${sig} received — stopping ${activeStreams.size} streams`);
  for (const [id, ff] of activeStreams) {
    ff.kill("SIGTERM");
    console.log(`  stopped stream:${id}`);
  }
  await redis.quit().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

// ── Boot ──────────────────────────────────────────────────────────────────────
async function main() {
  await mkdir(HLS_DIR, { recursive: true });
  await redis.connect();
  server.listen(PORT, () => console.log(`[proxy] HTTP :${PORT}  HLS_DIR=${HLS_DIR}`));
  metricsServer.listen(METRICS_PORT, () => console.log(`[proxy] Metrics :${METRICS_PORT}`));
}

main().catch((e) => { console.error("[fatal]", e); process.exit(1); });
