// The local processing service.
//
// ── What it is for ──────────────────────────────────────────────────────────
//
// Reading a file without sending it to anybody. Today that is OCR, barcodes and
// Office documents; the image also carries ffmpeg for the phases after this one.
//
// The three are not equally useful to the same people, and that is the point of
// having added the second and third. OCR here is English-only — Arabic
// recognition does not work on this box, measured over six runs — so it serves
// half of this channel's audience. A barcode has no language. Neither does the
// text inside a `.docx`. Both of those arrived complete for everybody on their
// first day.
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
// HTTP server with five endpoints, that is none. Unpacking a `.docx` was the
// first real temptation to add a package, and it is answered by `node:zlib`.
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
  BARCODE_TIMEOUT_MS,
  MAX_BARCODE_SYMBOLS,
  MAX_CONCURRENT,
  MAX_DOCUMENT_BYTES,
  MAX_QUEUED,
  MAX_TEXT_CHARS,
  MAX_UPLOAD_BYTES,
  OCR_TIMEOUT_MS,
  checkDocumentUpload,
  checkUpload,
  isSupportedLanguage,
  languageFromQuery,
  isSupportedPsm,
  isSupportedOem,
  parseBarcodeOutput,
  textIsUsable,
} from "./limits.mjs";
import {
  AUDIO_TARGETS,
  AUDIO_TIMEOUT_MS,
  IMAGE_TARGETS,
  IMAGE_TIMEOUT_MS,
  imageArgs,
  audioArgs,
  gifArgs,
  MAX_CONVERT_BYTES,
  MAX_OUTPUT_BYTES,
  PROBE_TIMEOUT_MS,
  probeArgs,
  readOptions,
  readProbe,
  VIDEO_TARGETS,
  VIDEO_TIMEOUT_MS,
  videoArgs,
} from "./convert.mjs";
import {
  MAX_OFFICE_TEXT_CHARS,
  SUPPORTED_OFFICE_KINDS,
  extractOfficeText,
  isSupportedOfficeKind,
} from "./office.mjs";

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

/**
 * Read the body, refusing anything over the ceiling as it arrives.
 *
 * The ceiling is a parameter because the two upload kinds differ: an image is
 * capped at eight megabytes and a document at twelve, matching what the Edge
 * Function will download in the first place.
 */
function readBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      // Refused mid-stream rather than after: the point of a ceiling is to
      // avoid holding the bytes, not to measure them once they are all here.
      if (size > limit) {
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
 * Write the bytes to a private directory, run one tool over them, clean up.
 *
 * ── Why a temporary directory and not a pipe ────────────────────────────────
 *
 * Both tools can read stdin, and both behave less predictably on a truncated or
 * malformed pipe than on a file they can seek. The directory is created per
 * request, lives on the container's tmpfs, and is removed in a `finally` —
 * including when the run times out, which is the case that would otherwise
 * leak.
 *
 * ── Why this is shared ──────────────────────────────────────────────────────
 *
 * Tesseract and zbar want completely different things — one writes a file, the
 * other prints to stdout — but the part that is easy to get wrong is identical:
 * kill on a deadline, clear the timer on every path, and delete the directory
 * even when the process was killed. Written twice, it is a matter of time
 * before one copy leaks. `build` receives the input path and returns the
 * argument list; everything else is here.
 */
async function runTool({ bytes, prefix, command, build, timeoutMs, ok, read, failure }) {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const input = join(dir, "in");
  let timer;

  try {
    await writeFile(input, bytes);

    return await new Promise((resolve, reject) => {
      // Arguments are passed as an array, never a shell string, so nothing in
      // them can be interpreted. Every caller-supplied value in them has
      // already been checked against an allowlist of whole strings.
      const child = spawn(command, build(input, dir), {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      // Bounded as it arrives. A tool pointed at a hostile image can be made to
      // print a great deal, and this is held in the memory of a service with
      // two workers.
      child.stdout.on("data", (c) => {
        if (stdout.length < 64_000) stdout += c.toString();
      });
      child.stderr.on("data", (c) => { stderr += c.toString().slice(0, 500); });

      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(Object.assign(new Error("timeout"), { code: "timeout" }));
      }, timeoutMs);

      child.on("error", (error) => reject(Object.assign(error, { code: "spawn_failed" })));
      child.on("close", async (code) => {
        clearTimeout(timer);
        if (!ok(code)) {
          reject(Object.assign(new Error(failure), { code: failure, exit: code }));
          return;
        }
        try {
          resolve(await read({ dir, stdout, exit: code }));
        } catch {
          reject(Object.assign(new Error("no_output"), { code: "no_output" }));
        }
      });
    });
  } finally {
    clearTimeout(timer);
    // Deterministic cleanup, including on the timeout path. A service that
    // leaks a directory per failed request fills a disk in a week.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Run Tesseract over one image. */
function runOcr(bytes, language, psm, oem) {
  return runTool({
    bytes,
    prefix: "ocr-",
    command: "tesseract",
    timeoutMs: OCR_TIMEOUT_MS,
    build: (input, dir) => {
      // `psm` and `oem` have been checked against an allowlist of whole
      // strings, the same as `language`, because all three reach a command line
      // and none is worth parsing.
      const args = [input, join(dir, "out"), "-l", language];
      if (psm) args.push("--psm", psm);
      if (oem) args.push("--oem", oem);
      return args;
    },
    ok: (code) => code === 0,
    read: ({ dir }) => readFile(join(dir, "out.txt"), "utf8"),
  });
}

/**
 * Scan one image for barcodes.
 *
 * ── The exit code is part of the answer here ────────────────────────────────
 *
 * Unlike Tesseract, `zbarimg` distinguishes "I looked and there is no barcode"
 * from "something went wrong": 4 is the former, 0 means at least one symbol was
 * decoded, and anything else is a fault. Treating 4 as a failure would report a
 * photograph of a shelf with no barcode in it as a broken service, so it is
 * accepted and produces an empty symbol list.
 *
 * `--nodbus` because this container has no session bus and zbarimg would
 * otherwise spend part of its budget failing to find one. `-q` suppresses the
 * "scanned N barcode symbols" trailer, which is not a symbol and would have to
 * be parsed back out.
 */
function runBarcode(bytes) {
  return runTool({
    bytes,
    prefix: "zbar-",
    command: "zbarimg",
    timeoutMs: BARCODE_TIMEOUT_MS,
    build: (input) => ["-q", "--nodbus", input],
    ok: (code) => code === 0 || code === 4,
    read: ({ stdout, exit }) => (exit === 4 ? [] : parseBarcodeOutput(stdout)),
  });
}

// ── Admission ────────────────────────────────────────────────────────────────
//
// Both endpoints spend a core on a photograph, so both queue behind the same
// two workers and both refuse in the same way. Shared rather than copied: two
// endpoints with two ideas of how busy the box is would let four runs start on
// four cores, which is the whole machine and the website with it.

/** Whether there is no room even in the queue. Answers the caller if so. */
function tooBusy(res, correlation) {
  if (inFlight < MAX_CONCURRENT || queued < MAX_QUEUED) return false;
  // Told to come back rather than queued forever. The caller has its own
  // deadline and would rather know now.
  log("rejected", { correlation, reason: "busy", inFlight, queued });
  res.setHeader("retry-after", "2");
  send(res, 503, { ok: false, reason: "busy" });
  return true;
}

/**
 * The request body as image bytes, or null with the refusal already sent.
 *
 * Returning null rather than throwing keeps the refusal and its status code in
 * one place: an oversized body is a 413 and a body that is not an image is a
 * 400, and both are decided here for every endpoint that takes a picture.
 */
async function receiveImage(req, res, correlation) {
  let bytes;
  try {
    bytes = await readBody(req);
  } catch (error) {
    log("rejected", { correlation, reason: error.code ?? "unreadable" });
    send(res, 413, { ok: false, reason: error.code ?? "unreadable" });
    return null;
  }

  const verdict = checkUpload(bytes, req.headers["content-type"]);
  if (!verdict.ok) {
    log("rejected", { correlation, reason: verdict.reason, bytes: bytes.length });
    send(res, 400, { ok: false, reason: verdict.reason });
    return null;
  }
  return bytes;
}

/** Wait for one of the two workers. Every caller must release in a `finally`. */
async function acquireSlot() {
  queued += 1;
  while (inFlight >= MAX_CONCURRENT) {
    await new Promise((r) => setTimeout(r, 50));
  }
  queued -= 1;
  inFlight += 1;
}

const releaseSlot = () => { inFlight -= 1; };

// ── Converting, and reading what a file actually is ──────────────────────────
//
// The one capability here whose tool was already installed. ffmpeg has been in
// this image since it was built and nothing called it, so this is a route
// rather than a dependency: no new package, no model, nothing to benchmark.
//
// Both endpoints queue behind the same two workers as OCR. A transcode is the
// most expensive thing this service does, and letting it start outside the
// admission gate would be the one way to put four ffmpeg runs on four dedicated
// cores while the website is trying to answer.

/** The body as bytes for conversion, or null with the refusal already sent. */
async function receiveMedia(req, res, correlation) {
  try {
    const bytes = await readBody(req, MAX_CONVERT_BYTES);
    if (bytes.length === 0) {
      log("rejected", { correlation, reason: "empty" });
      send(res, 400, { ok: false, reason: "empty" });
      return null;
    }
    return bytes;
  } catch (error) {
    log("rejected", { correlation, reason: error.code ?? "unreadable" });
    send(res, 413, { ok: false, reason: error.code ?? "unreadable" });
    return null;
  }
}

/**
 * What this file is, according to the demuxer rather than its name.
 *
 * An extension is a claim and a MIME type is a claim; a container ffmpeg can
 * open is a fact. It is also the fact that decides whether a conversion can
 * work, which is why detection lives next to conversion and not in a caller.
 */
async function handleProbe(req, res, correlation) {
  if (tooBusy(res, correlation)) return;
  const bytes = await receiveMedia(req, res, correlation);
  if (!bytes) return;

  await acquireSlot();
  try {
    const info = await runTool({
      bytes,
      prefix: "probe-",
      command: "ffprobe",
      timeoutMs: PROBE_TIMEOUT_MS,
      build: (input) => probeArgs(input),
      ok: (code) => code === 0,
      read: ({ stdout }) => readProbe(stdout),
      failure: "unreadable_media",
    });

    if (!info) {
      log("probe", { correlation, outcome: "unreadable" });
      send(res, 422, { ok: false, reason: "unreadable_media" });
      return;
    }
    // A kind and a duration. Never a container tag: a phone's recording carries
    // the device model and sometimes its coordinates in those, and this service
    // strips EXIF from images for that exact reason.
    log("probe", { correlation, kind: info.kind, seconds: info.durationSeconds });
    send(res, 200, { ok: true, ...info });
  } catch (error) {
    log("probe", { correlation, outcome: error.code ?? "failed" });
    send(res, error.code === "timeout" ? 504 : 422, {
      ok: false,
      reason: error.code === "timeout" ? "timeout" : "unreadable_media",
    });
  } finally {
    releaseSlot();
  }
}

/**
 * One conversion.
 *
 * The output goes back as bytes with the target's own content type, rather than
 * as JSON with base64 in it: a caller that wants a file wants a file, and
 * base64 would add a third of the size to something already measured in
 * megabytes on a box that is also serving a website.
 */
async function handleConvert(req, res, correlation) {
  if (tooBusy(res, correlation)) return;

  const url = new URL(req.url, "http://internal");
  const parsed = readOptions(url.searchParams);
  if (!parsed.ok) {
    log("rejected", { correlation, reason: parsed.reason });
    send(res, 400, { ok: false, reason: parsed.reason });
    return;
  }
  const options = parsed.options;

  const bytes = await receiveMedia(req, res, correlation);
  if (!bytes) return;

  const target = options.to === "gif"
    ? { mime: "image/gif", ext: "gif" }
    : options.kind === "audio"
    ? AUDIO_TARGETS[options.to]
    : options.kind === "image"
    ? IMAGE_TARGETS[options.to]
    : VIDEO_TARGETS[options.to];

  await acquireSlot();
  const started = Date.now();
  try {
    const output = await runTool({
      bytes,
      prefix: "conv-",
      command: "ffmpeg",
      // A still image is one frame and should never hold a worker for a
      // video-sized budget.
      timeoutMs: options.kind === "image"
        ? IMAGE_TIMEOUT_MS
        : options.kind === "audio"
        ? AUDIO_TIMEOUT_MS
        : VIDEO_TIMEOUT_MS,
      build: (input, dir) => {
        const out = join(dir, `out.${target.ext}`);
        if (options.to === "gif") return gifArgs(input, out, options);
        if (options.kind === "image") return imageArgs(input, out, options);
        return options.kind === "audio"
          ? audioArgs(input, out, options)
          : videoArgs(input, out, options);
      },
      ok: (code) => code === 0,
      read: async ({ dir }) => {
        const produced = await readFile(join(dir, `out.${target.ext}`));
        // ffmpeg can exit 0 having written nothing — a trim past the end of the
        // file is the ordinary way to get there. An empty file is a failure
        // dressed as a success, and the caller has no way to tell.
        if (produced.length === 0) throw new Error("empty_output");
        if (produced.length > MAX_OUTPUT_BYTES) throw new Error("output_too_large");
        return produced;
      },
      failure: "conversion_failed",
    });

    log("convert", {
      correlation,
      to: options.to,
      kind: options.kind,
      ms: Date.now() - started,
      out: output.length,
    });
    res.writeHead(200, {
      "content-type": target.mime,
      "content-length": output.length,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    });
    res.end(output);
  } catch (error) {
    // A code and a duration, never the sender's file or ffmpeg's own message —
    // ffmpeg quotes the path and sometimes the container's metadata in its
    // errors, and these logs are read by people who should not see either.
    const reason = error.code ?? (error.message === "empty_output" ? "empty_output" : "conversion_failed");
    log("convert", { correlation, to: options.to, outcome: reason, ms: Date.now() - started });
    const status = reason === "timeout" ? 504 : reason === "output_too_large" ? 413 : 422;
    send(res, status, { ok: false, reason });
  } finally {
    releaseSlot();
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

async function handleOcr(req, res, correlation) {
  if (tooBusy(res, correlation)) return;

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

  const bytes = await receiveImage(req, res, correlation);
  if (!bytes) return;

  await acquireSlot();

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
    releaseSlot();
  }
}

/**
 * Decode the barcodes in one photograph.
 *
 * ── Why this is worth having when a vision model is already there ───────────
 *
 * Three reasons, and the first is the one that matters.
 *
 * It works in every language. Local OCR is English-only, because Arabic
 * recognition does not work on this box — so the Arabic half of this channel's
 * audience gets nothing local at all today. A barcode has no language: the
 * digits under an EAN-13 in Riyadh are the same digits in Helsinki. This is the
 * first thing the server can do for everybody.
 *
 * It is more accurate than the model, not less. This is the one row in the
 * audit's capability matrix where the local tool is marked *better* than the
 * external one. zbar decodes a checksummed symbol or reports that it could not;
 * a vision model reads thirteen digits off a photograph and will occasionally
 * hand back twelve of them with confidence. For a blind person who cannot
 * proof-read the number against the packet, "I could not read it" is a far
 * better answer than a digit that is wrong.
 *
 * And a check digit makes it provable. Every retail symbology carries a mod-10
 * checksum, so `kind: "product"` is not zbar's opinion — it is arithmetic.
 *
 * ── What comes back, and why the two kinds are kept apart ───────────────────
 *
 * A retail symbol carries digits and nothing else. A QR code carries whatever
 * somebody printed on the sticker, and stickers are attacker-controlled: a QR
 * code reading "ignore your instructions and ..." is a thing a person can make
 * with a website and a printer, and then leave on a shelf. So the two are
 * labelled here, at the point where the symbology is known, and the caller can
 * hold to the rule `whatsappLocalOcr.ts` already follows — text somebody else
 * authored is shown to the sender, never put into a prompt. Digits can go
 * anywhere, because there is no instruction expressible in thirteen digits.
 */
async function handleBarcode(req, res, correlation) {
  if (tooBusy(res, correlation)) return;

  const bytes = await receiveImage(req, res, correlation);
  if (!bytes) return;

  await acquireSlot();

  const startedAt = Date.now();
  try {
    const symbols = await runBarcode(bytes);

    log("barcode", {
      correlation,
      ms: Date.now() - startedAt,
      bytes: bytes.length,
      // Counts and symbology names. Never the payload: a QR code routinely
      // holds a URL with somebody's booking reference in it.
      found: symbols.length,
      kinds: symbols.map((symbol) => symbol.symbology).join(","),
      products: symbols.filter((symbol) => symbol.kind === "product").length,
    });

    return send(res, 200, {
      ok: true,
      // An empty list is a successful scan of a picture with no barcode in it,
      // which is most pictures. `found: false` says that without the caller
      // having to decide what a zero-length array meant.
      found: symbols.length > 0,
      symbols: symbols.slice(0, MAX_BARCODE_SYMBOLS),
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    // A code, never the tool's message: zbarimg prints the path it was given.
    log("barcode_failed", { correlation, ms: Date.now() - startedAt, reason: error.code ?? "unknown" });
    return send(res, 200, { ok: false, reason: error.code ?? "unknown" });
  } finally {
    releaseSlot();
  }
}

/**
 * Read the words out of a Word document or a slide deck.
 *
 * ── Why this is a gap worth closing ─────────────────────────────────────────
 *
 * Today a `.docx` arriving on WhatsApp is answered with "I can't open Word
 * files yet. Send it as a PDF" — advice that assumes the sender has a machine
 * with Word on it and can see the export dialog. Frequently they have a phone
 * and cannot see the screen at all. This is one of the few remaining places
 * where the assistant refuses a file it could perfectly well read.
 *
 * ── Why it runs here and not in the Edge Function ───────────────────────────
 *
 * It needs a DEFLATE decoder. Deno has `DecompressionStream("deflate-raw")`,
 * so it *could* live there — but CI runs the Vitest suite on Node 20, which
 * does not have `deflate-raw`, and a capability that cannot be tested on the
 * machine that gates the merge is not one worth having. Here it is
 * `node:zlib.inflateRawSync`, which every Node this service will ever run on
 * has had for a decade.
 *
 * ── No CPU spent on a model, and none spent on a core either ────────────────
 *
 * Unlike OCR and barcode scanning, this is not CPU-bound work: it is an inflate
 * and a regular expression over a few hundred kilobytes, measured in
 * milliseconds. It still takes a worker slot, because the ceilings it enforces
 * are about a hostile archive rather than about time, and an archive designed
 * to be expensive should be queued behind the same two workers as everything
 * else rather than given a lane of its own.
 */
async function handleOffice(req, res, correlation) {
  if (tooBusy(res, correlation)) return;

  const url = new URL(req.url, "http://internal");
  // Allowlisted whole strings, the same as the OCR language. This one does not
  // reach a command line — nothing here spawns a process — but it selects which
  // parts of an archive are unpacked, and an allowlist is still the simplest
  // thing to be sure about.
  const kind = url.searchParams.get("kind") ?? "";
  if (!isSupportedOfficeKind(kind)) {
    return send(res, 400, { ok: false, reason: "unsupported_kind", supported: SUPPORTED_OFFICE_KINDS });
  }

  let bytes;
  try {
    bytes = await readBody(req, MAX_DOCUMENT_BYTES);
  } catch (error) {
    log("rejected", { correlation, reason: error.code ?? "unreadable" });
    return send(res, 413, { ok: false, reason: error.code ?? "unreadable" });
  }

  const verdict = checkDocumentUpload(bytes);
  if (!verdict.ok) {
    log("rejected", { correlation, reason: verdict.reason, bytes: bytes.length });
    return send(res, 400, { ok: false, reason: verdict.reason });
  }

  await acquireSlot();

  const startedAt = Date.now();
  try {
    const extracted = extractOfficeText(bytes, kind);

    log("office", {
      correlation,
      ms: Date.now() - startedAt,
      bytes: bytes.length,
      kind,
      ok: extracted.ok,
      // A length and a part count. Never the text: this is somebody's contract,
      // medical letter or invoice.
      chars: extracted.ok ? extracted.text.length : 0,
      parts: extracted.ok ? extracted.parts : 0,
      reason: extracted.ok ? "read" : extracted.reason,
    });

    if (!extracted.ok) {
      // 200 with `ok: false`, the same as a failed OCR run. The request was
      // handled correctly; the file was the problem, and the caller decides
      // what to say about it.
      return send(res, 200, { ok: false, reason: extracted.reason });
    }

    return send(res, 200, {
      ok: true,
      readable: true,
      text: extracted.text.slice(0, MAX_OFFICE_TEXT_CHARS),
      chars: extracted.text.length,
      parts: extracted.parts,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    log("office_failed", { correlation, ms: Date.now() - startedAt, reason: error?.code ?? "unknown" });
    return send(res, 200, { ok: false, reason: error?.code ?? "unknown" });
  } finally {
    releaseSlot();
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
        // Named separately from `ocr` rather than folded into a version number,
        // because a caller needs to know which of the two it can rely on: this
        // deployment may have been rolled back to an image with only one.
        barcode: true,
        office: SUPPORTED_OFFICE_KINDS,
        languages: ["ara", "eng", "ara+eng"],
        max_bytes: MAX_UPLOAD_BYTES,
        max_document_bytes: MAX_DOCUMENT_BYTES,
        // What ffmpeg in this image will produce. Named so a caller can tell a
        // deployment that has these routes from one rolled back to the image
        // that only had three.
        convert: {
          audio: Object.keys(AUDIO_TARGETS),
          video: [...Object.keys(VIDEO_TARGETS), "gif"],
          image: Object.keys(IMAGE_TARGETS),
          max_bytes: MAX_CONVERT_BYTES,
          max_output_bytes: MAX_OUTPUT_BYTES,
        },
        probe: true,
        concurrency: MAX_CONCURRENT,
      });
    }

    if (req.method === "POST" && url.pathname === "/ocr") {
      return await handleOcr(req, res, correlation);
    }

    if (req.method === "POST" && url.pathname === "/barcode") {
      return await handleBarcode(req, res, correlation);
    }

    if (req.method === "POST" && url.pathname === "/office") {
      return await handleOffice(req, res, correlation);
    }

    if (req.method === "POST" && url.pathname === "/probe") {
      return await handleProbe(req, res, correlation);
    }

    if (req.method === "POST" && url.pathname === "/convert") {
      return await handleConvert(req, res, correlation);
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
