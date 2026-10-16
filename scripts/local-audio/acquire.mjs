// Downloads the recordings listed in sources.json from Wikimedia Commons, checks
// each one's licence, and encodes it as the Ogg/Opus mono file the loader expects.
//
//   FFMPEG=/path/to/ffmpeg node scripts/local-audio/acquire.mjs <out-folder>
//
// Network: Commons only, free, no key. Sends no WhatsApp message and calls no paid
// service. It REFUSES a file whose licence is not on the allow-list, re-read live
// from the API: a licence is never taken from this repository. Writes
// `<out>/<id>.<lang>.ogg` and `<out>/provenance.json` (source URL, creator,
// licence, original checksum, transcript). Validate the result with prepare.mjs.

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Licences that allow commercial use with no share-alike duty. CC BY would also need attribution text, so it is not here. */
export const ALLOWED_LICENCES = new Set(["CC0", "Public domain"]);
const API = "https://commons.wikimedia.org/w/api.php";
const AGENT = { "User-Agent": "VisionexAudioAcquire/1.0 (visionexmanager@gmail.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
  for (let i = 0; i < 4; i++) {
    await sleep(1500);
    const text = await (await fetch(`${API}?${new URLSearchParams({ format: "json", ...params })}`, { headers: AGENT })).text();
    try { return JSON.parse(text); } catch { await sleep(8000); }
  }
  throw new Error("commons_api_unavailable");
}

export async function describeSource(title) {
  const r = await api({ action: "query", titles: title, prop: "imageinfo", iiprop: "url|size|mime|sha1|extmetadata", iiextmetadatafilter: "LicenseShortName|Artist|LicenseUrl" });
  const page = Object.values(r.query.pages)[0];
  const info = page.imageinfo?.[0];
  if (!info) return { ok: false, problem: "not_found" };
  const meta = info.extmetadata ?? {};
  const licence = meta.LicenseShortName?.value ?? "";
  if (!ALLOWED_LICENCES.has(licence)) return { ok: false, problem: `licence_not_allowed:${licence || "unknown"}` };
  return {
    ok: true, url: info.url, mime: info.mime, licence,
    creator: (meta.Artist?.value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    pageUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace(/^File:/, "").replace(/ /g, "_"))}`,
  };
}

async function main(out) {
  const ffmpeg = process.env.FFMPEG || "ffmpeg";
  const here = dirname(fileURLToPath(import.meta.url));
  const { clips } = JSON.parse(readFileSync(join(here, "sources.json"), "utf8"));
  mkdirSync(out, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "audio-acquire-"));
  const provenance = [];
  let refused = 0;
  try {
    for (const clip of clips) {
      const src = await describeSource(clip.commons);
      if (!src.ok) { refused += 1; console.log(`REFUSED  ${clip.id}.${clip.language}  ${src.problem}`); continue; }
      const res = await fetch(src.url, { headers: AGENT });
      if (!res.ok) { refused += 1; console.log(`REFUSED  ${clip.id}.${clip.language}  download_${res.status}`); continue; }
      const original = Buffer.from(await res.arrayBuffer());
      const rawPath = join(work, `${clip.id}.${clip.language}.src`);
      writeFileSync(rawPath, original);
      const target = join(out, `${clip.id}.${clip.language}.ogg`);
      // Mono, 48 kHz, Opus in Ogg: what a WhatsApp voice note is. Nothing else is changed.
      execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", rawPath, "-ac", "1", "-ar", "48000", "-c:a", "libopus", "-b:a", "24k", "-application", "voip", target]);
      provenance.push({
        id: clip.id, language: clip.language, transcript: clip.transcript,
        source: src.pageUrl, fileUrl: src.url, creator: src.creator, licence: src.licence,
        originalSha256: createHash("sha256").update(original).digest("hex"), originalBytes: original.length,
        transformation: "decoded to PCM, downmixed to mono, encoded Opus 24 kbps (ffmpeg libopus, voip) in Ogg",
        reviewed: false,
      });
      console.log(`ok       ${clip.id}.${clip.language}  ${src.licence}  ${src.creator}`);
    }
  } finally { rmSync(work, { recursive: true, force: true }); }
  writeFileSync(join(out, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
  process.exit(refused === 0 ? 0 : 1);
}

if (process.argv[1]?.endsWith("acquire.mjs")) {
  if (!process.argv[2]) { console.log("usage: FFMPEG=<path> node scripts/local-audio/acquire.mjs <out-folder>"); process.exit(2); }
  await main(process.argv[2]);
}
