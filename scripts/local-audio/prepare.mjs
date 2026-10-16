// Checks a folder of prerecorded voice notes and writes the manifest entries for them.
//
//   node scripts/local-audio/prepare.mjs <folder>            report only
//   node scripts/local-audio/prepare.mjs <folder> --write    also print the manifest block
//
// Reads files. Sends nothing, calls no provider, writes nothing to the server. A
// clip is named `<response id>.<language>.ogg` and must be Opus in an Ogg
// container — what a WhatsApp voice note is. For each file this checks the Ogg
// header and the Opus ID header, measures the playing time from the last page's
// granule position, and records the byte count and SHA-256 that `loadClip`
// re-checks before it ever sends the clip.
//
// Making the recordings is a separate, explicit step this script does not do: a
// person, or a one-off paid synthesis run on purpose. Nothing here spends money.
// Only recordings that may be stored and used commercially belong in the folder,
// and none may imitate a real person without their written consent.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 512 * 1024;
const MAX_MS = 20_000;
const NAME = /^([a-z][a-z0-9_]{1,40})\.([a-z]{2})\.ogg$/;

/** Parses an Ogg/Opus file: { ok, durationMs } or { ok: false, problem }. */
export function inspectOpusOgg(bytes) {
  if (bytes.length < 47) return { ok: false, problem: "too_short" };
  if (bytes.toString("latin1", 0, 4) !== "OggS") return { ok: false, problem: "not_ogg" };
  // The first page carries the OpusHead packet right after its segment table.
  const segments = bytes[26];
  const headAt = 27 + segments;
  if (bytes.toString("latin1", headAt, headAt + 8) !== "OpusHead") return { ok: false, problem: "not_opus" };
  const preSkip = bytes.readUInt16LE(headAt + 10);
  // Walk the pages and keep the last granule position: samples at 48 kHz.
  let offset = 0;
  let granule = 0n;
  let pages = 0;
  while (offset + 27 <= bytes.length) {
    if (bytes.toString("latin1", offset, offset + 4) !== "OggS") return { ok: false, problem: "broken_page_sync" };
    const count = bytes[offset + 26];
    if (offset + 27 + count > bytes.length) return { ok: false, problem: "truncated" };
    let body = 0;
    for (let i = 0; i < count; i++) body += bytes[offset + 27 + i];
    const next = offset + 27 + count + body;
    if (next > bytes.length) return { ok: false, problem: "truncated" };
    const position = bytes.readBigInt64LE(offset + 6);
    if (position >= 0n) granule = position;
    pages += 1;
    offset = next;
  }
  if (pages < 2 || granule <= BigInt(preSkip)) return { ok: false, problem: "no_audio" };
  return { ok: true, durationMs: Math.round((Number(granule) - preSkip) / 48) };
}

export function describeFolder(folder) {
  const rows = [];
  for (const file of readdirSync(folder).sort()) {
    const path = join(folder, file);
    if (!statSync(path).isFile() || file === "provenance.json") continue;
    const m = NAME.exec(file);
    if (!m) { rows.push({ file, problem: "name_is_not_id.language.ogg" }); continue; }
    const bytes = readFileSync(path);
    if (bytes.length > MAX_BYTES) { rows.push({ file, problem: "too_large" }); continue; }
    const info = inspectOpusOgg(bytes);
    if (!info.ok) { rows.push({ file, problem: info.problem }); continue; }
    if (info.durationMs > MAX_MS) { rows.push({ file, problem: "too_long" }); continue; }
    rows.push({
      file,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      durationMs: info.durationMs,
    });
  }
  return rows;
}

const folder = process.argv[2];
if (folder && process.argv[1] && process.argv[1].endsWith("prepare.mjs")) {
  const rows = describeFolder(folder);
  const good = rows.filter((r) => !r.problem);
  const bad = rows.filter((r) => r.problem);
  console.log(`${good.length} valid, ${bad.length} refused`);
  for (const r of bad) console.log(`REFUSED  ${r.file}  ${r.problem}`);
  for (const r of good) console.log(`ok       ${r.file}  ${r.bytes} bytes  ${r.durationMs} ms`);
  if (process.argv.includes("--write")) {
    const today = new Date().toISOString().slice(0, 10);
    console.log("\n// Paste into LOCAL_AUDIO_ASSETS in supabase/functions/_shared/localAudioManifest.ts:");
    for (const r of good) {
      console.log(`  "${r.file}": { bytes: ${r.bytes}, sha256: "${r.sha256}", durationMs: ${r.durationMs}, status: "active", verifiedAt: "${today}" },`);
    }
  }
  process.exit(bad.length === 0 ? 0 : 1);
} else if (process.argv[1] && process.argv[1].endsWith("prepare.mjs")) {
  console.log("usage: node scripts/local-audio/prepare.mjs <folder> [--write]");
  process.exit(2);
}
