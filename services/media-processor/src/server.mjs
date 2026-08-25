// The local processing service.
//
// ── What it is for ──────────────────────────────────────────────────────────
//
// Reading a photograph without sending it to anybody. Today that is OCR; the
// image also carries ffmpeg and zbar for the phases after this one.
//
// It exists as a separate process because a Supabase Edge Function cannot host
// one: no persistent disk, no long-lived process, no way to ship a Tesseract
// binary. That constraint is the single largest architectural finding of the
// audit, and this service is the answer to it.
//
// ── Deliberately dependency-free ────────────────────────────────────────────
//
// Plain `node:http`, no packages, no lockfile. Something that will eventually
// be reachable from the internet and is handed files by strangers should have
// as little third-party code in its request path as it can manage — and for an
// HTTP server with four endpoints, that is none.
//
// ── Bound to localhost by the deployment, not by this file ──────────────────
//
// The container publishes to `127.0.0.1` only. This process binds `0.0.0.0`
// because inside a container that is simply "the container's interface"; what
// decides reachability is the port mapping, and that is in the deploy workflow
// where it can be reviewed as a deployment decision rather than a code one.

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MAX_CONCURRENT,
  MAX_QUEUED,
  MAX_TEXT_CHARS,
  MAX_UPLOAD_BYTES,
  OCR_TIMEOUT_MS,
  checkUpload,
  isSupportedLanguage,
  languageFromQuery,
  isSupportedPsm,
  isSupportedOem,
  textIsUsable,
} from "./limits.mjs";

const PORT = Number(process.env.PORT ?? 8081);
const HOST = process.env.HOST ?? "0.0.0.0";

/**
 * The shared secret every processing request must carry.
 *
 * Absent means the service refuses every processing request rather than
 * accepting them unauthenticated — the same fail-closed rule the WhatsApp
 * feature flags follow. An unauthenticated OCR endpoint is a free CPU-burning
 * service for whoever finds it.
 */
const TOKEN = process.env.PROCESSOR_TOKEN ?? "";

const started = Date.now();
let inFlight = 0;
let queued = 0;

// ── Logging ──────────────────────────────────────────────────────────────────
//
// One JSON object per line, and only counts, durations and labels. Never the
// text that was recognised, never the bytes, never the token. The same rule as
// `whatsappTelemetry.ts`, for the same reason: this runs on a server whose logs
// somebody will eventually paste somewhere.

const log = (event, fields = {}) => {
  try {
    process.stdout.write(JSON.stringify({ at: "media-processor", event, ...fields }) + "\n");
  } catch {
    // A log must never be the thing that fails a request.
  }
};

const send = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    // Nothing here is cacheable and nothing should be framed.
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(payload);
};

/**
 * Whether the caller proved it is allowed to spend CPU here.
 *
 * Compared in constant time. A timing-safe comparison on a bearer token is
 * close to superstition over the public internet, but it costs one function
 * call and removes the need to ever think about it again.
 */
function authorised(req) {
  if (!TOKEN) return false;
  const header = req.headers["authorization"] ?? "";
  const offered = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (offered.length !== TOKEN.length) return false;

  let diff = 0;
  for (let i = 0; i < TOKEN.length; i++) diff |= TOKEN.charCodeAt(i) ^ offered.charCodeAt(i);
  return diff === 0;
}

/** Read the body, refusing anything over the ceiling as it arrives. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      // Refused mid-stream rather than after: the point of a ceiling is to
      // avoid holding the bytes, not to measure them once they are all here.
      if (size > MAX_UPLOAD_BYTES) {
        reject(Object.assign(new Error("too_large"), { code: "too_large" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Run Tesseract over one image.
 *
 * ── Why a temporary directory and not a pipe ────────────────────────────────
 *
 * Tesseract can read stdin, but its behaviour with truncated or malformed input
 * on a pipe is less predictable than with a file it can seek. The directory is
 * created per request, lives on the container's tmpfs, and is removed in a
 * `finally` — including when the run times out, which is the case that would
 * otherwise leak.
 */
async function runOcr(bytes, language, psm, oem) {
  const dir = await mkdtemp(join(tmpdir(), "ocr-"));
  const input = join(dir, "in");
  const output = join(dir, "out");
  let timer;

  try {
    await writeFile(input, bytes);

    const text = await new Promise((resolve, reject) => {
      // Arguments are passed as an array, never a shell string, so nothing in
      // them can be interpreted. `language` has already been checked against an
      // allowlist of whole strings.
      // Arguments stay an array. `psm` has been checked against an allowlist
      // of whole strings, the same as `language`, because both reach a command
      // line and neither is worth parsing.
      const args = [input, output, "-l", language];
      if (psm) args.push("--psm", psm);
      if (oem) args.push("--oem", oem);

      const child = spawn("tesseract", args, {
        stdio: ["ignore", "ignore", "pipe"],
      });

      let stderr = "";
      child.stderr.on("data", (c) => { stderr += c.toString().slice(0, 500); });

      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(Object.assign(new Error("timeout"), { code: "timeout" }));
      }, OCR_TIMEOUT_MS);

      child.on("error", (error) => reject(Object.assign(error, { code: "spawn_failed" })));
      child.on("close", async (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(Object.assign(new Error("tesseract_failed"), { code: "tesseract_failed", exit: code }));
          return;
        }
        try {
          resolve(await readFile(`${output}.txt`, "utf8"));
        } catch {
          reject(Object.assign(new Error("no_output"), { code: "no_output" }));
        }
      });
    });

    return text;
  } finally {
    clearTimeout(timer);
    // Deterministic cleanup, including on the timeout path. A service that
    // leaks a directory per failed request fills a disk in a week.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

async function handleOcr(req, res, correlation) {
  if (inFlight >= MAX_CONCURRENT && queued >= MAX_QUEUED) {
    // Told to come back rather than queued forever. The caller has its own
    // deadline and would rather know now.
    log("rejected", { correlation, reason: "busy", inFlight, queued });
    res.setHeader("retry-after", "2");
    return send(res, 503, { ok: false, reason: "busy" });
  }

  const url = new URL(req.url, "http://internal");
  // Normalised before it is checked: a plus in a query decodes to a space, so
  // the obvious `?lang=ara+eng` arrives as `ara eng`. The allowlist below is
  // still the only thing that decides.
  const language = languageFromQuery(url.searchParams.get("lang")) ?? "ara+eng";
  if (!isSupportedLanguage(language)) {
    return send(res, 400, { ok: false, reason: "unsupported_language" });
  }

  // Absent means Tesseract's own default, so this changes nothing for a caller
  // that does not ask. It exists to make a segmentation question testable
  // against the real service rather than argued about.
  const psm = url.searchParams.get("psm");
  if (psm !== null && !isSupportedPsm(psm)) {
    return send(res, 400, { ok: false, reason: "unsupported_psm" });
  }

  // Same shape, same reason: absent means Tesseract's own default, and the
  // value is allowlisted because it reaches a command line.
  const oem = url.searchParams.get("oem");
  if (oem !== null && !isSupportedOem(oem)) {
    return send(res, 400, { ok: false, reason: "unsupported_oem" });
  }

  let bytes;
  try {
    bytes = await readBody(req);
  } catch (error) {
    log("rejected", { correlation, reason: error.code ?? "unreadable" });
    return send(res, 413, { ok: false, reason: error.code ?? "unreadable" });
  }

  const verdict = checkUpload(bytes, req.headers["content-type"]);
  if (!verdict.ok) {
    log("rejected", { correlation, reason: verdict.reason, bytes: bytes.length });
    return send(res, 400, { ok: false, reason: verdict.reason });
  }

  queued += 1;
  while (inFlight >= MAX_CONCURRENT) {
    await new Promise((r) => setTimeout(r, 50));
  }
  queued -= 1;
  inFlight += 1;

  const startedAt = Date.now();
  try {
    const raw = await runOcr(bytes, language, psm, oem);
    const text = raw.slice(0, MAX_TEXT_CHARS).trim();
    const usable = textIsUsable(text);

    log("ocr", {
      correlation,
      ms: Date.now() - startedAt,
      bytes: bytes.length,
      // A length, never the text.
      chars: text.length,
      usable,
      lang: language,
      psm: psm ?? "default",
      code: oem ?? "default",
    });

    return send(res, 200, {
      ok: true,
      readable: usable,
      text: usable ? text : "",
      chars: text.length,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    // A code, never the tool's message: Tesseract prints the path it was given.
    log("ocr_failed", { correlation, ms: Date.now() - startedAt, reason: error.code ?? "unknown" });
    return send(res, 200, { ok: false, reason: error.code ?? "unknown" });
  } finally {
    inFlight -= 1;
  }
}

const server = createServer(async (req, res) => {
  const correlation = randomUUID().replace(/-/g, "").slice(0, 16);
  const url = new URL(req.url ?? "/", "http://internal");

  try {
    // Health is deliberately unauthenticated and says nothing useful to a
    // stranger: it is what the container's own HEALTHCHECK and the deploy
    // workflow poll, and neither can carry a token.
    if (req.method === "GET" && url.pathname === "/health") {
      return send(res, 200, { ok: true, uptime_s: Math.round((Date.now() - started) / 1000) });
    }

    // Everything else needs the token.
    if (!authorised(req)) {
      log("unauthorised", { correlation, path: url.pathname });
      return send(res, 401, { ok: false, reason: "unauthorised" });
    }

    if (req.method === "GET" && url.pathname === "/capabilities") {
      return send(res, 200, {
        ok: true,
        ocr: true,
        languages: ["ara", "eng", "ara+eng"],
        max_bytes: MAX_UPLOAD_BYTES,
        concurrency: MAX_CONCURRENT,
      });
    }

    if (req.method === "POST" && url.pathname === "/ocr") {
      return await handleOcr(req, res, correlation);
    }

    return send(res, 404, { ok: false, reason: "not_found" });
  } catch (error) {
    log("unhandled", { correlation, reason: error?.code ?? "unknown" });
    if (!res.headersSent) send(res, 500, { ok: false, reason: "internal" });
  }
});

// A request that has stalled is a worker that is not working.
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;

server.listen(PORT, HOST, () => {
  log("listening", { port: PORT, authenticated: !!TOKEN });
  if (!TOKEN) {
    // Loud, because the service is running and refusing everything, which from
    // the outside looks identical to a broken deployment.
    log("misconfigured", { reason: "no_token_processing_disabled" });
  }
});

const shutdown = (signal) => {
  log("shutdown", { reason: signal });
  server.close(() => process.exit(0));
  // Docker sends SIGTERM and waits ten seconds. Finishing an in-flight OCR is
  // worth a moment; waiting for a stuck one is not.
  setTimeout(() => process.exit(0), 8_000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
