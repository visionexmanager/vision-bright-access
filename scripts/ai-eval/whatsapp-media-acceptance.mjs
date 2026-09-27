// Which files will Meta actually take for a WhatsApp message?
//
// The conversion service offers seventeen output formats; Meta documents a far
// shorter list (developers.facebook.com/docs/whatsapp/cloud-api/reference/media).
// Rather than turn a documentation page into a hard rule, this asks Meta: it
// makes a tiny sample of every format with the media processor's own ffmpeg
// arguments (services/media-processor/src/convert.mjs), uploads each to the
// phone number's media store under the label a delivery would use, records
// whether Meta accepted it, and deletes what it uploaded.
//
// Nothing is sent to anybody: an upload is not a message. The repository is
// public, so only the format, the label, the HTTP status and Meta's error code
// are printed — never the token, the phone number id or a media id.
//
// Run: node scripts/ai-eval/whatsapp-media-acceptance.mjs  (needs ffmpeg,
// WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOKEN = process.env.WHATSAPP_TOKEN ?? "";
const PHONE = process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || "v26.0"}`;
if (!TOKEN || !PHONE) {
  console.log("WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required.");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "wa-media-"));
const ff = (...args) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);

// Sources: one second of tone, one second of test pattern, one frame.
const tone = join(dir, "tone.wav");
ff("-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-ac", "1", tone);
const clip = join(dir, "clip.mp4");
ff("-f", "lavfi", "-i", "testsrc=size=160x120:rate=10:duration=1", "-f", "lavfi", "-i", "sine=duration=1",
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", clip);

// The processor's own arguments, target by target.
const AUDIO = {
  mp3: [["-c:a", "libmp3lame"], "audio/mpeg"],
  wav: [["-c:a", "pcm_s16le"], "audio/wav"],
  flac: [["-c:a", "flac"], "audio/flac"],
  aac: [["-c:a", "aac"], "audio/aac"],
  m4a: [["-c:a", "aac", "-f", "mp4"], "audio/mp4"],
  ogg: [["-c:a", "libvorbis"], "audio/ogg"],
  opus: [["-c:a", "libopus"], "audio/opus"],
};
const VIDEO = {
  mp4: [["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"], "video/mp4"],
  mov: [["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"], "video/quicktime"],
  mkv: [["-c:v", "libx264", "-c:a", "aac"], "video/x-matroska"],
  webm: [["-c:v", "libvpx-vp9", "-c:a", "libopus", "-row-mt", "1"], "video/webm"],
};
const IMAGE = {
  jpg: [["-c:v", "mjpeg"], "image/jpeg"],
  png: [["-c:v", "png"], "image/png"],
  webp: [["-c:v", "libwebp"], "image/webp"],
  bmp: [["-c:v", "bmp"], "image/bmp"],
  tiff: [["-c:v", "tiff"], "image/tiff"],
};

const cases = []; // [format, label, path]
for (const [ext, [args, mime]] of Object.entries(AUDIO)) {
  const out = join(dir, `a.${ext}`);
  ff("-i", tone, "-vn", ...args, out);
  cases.push([ext, mime, out]);
}
for (const [ext, [args, mime]] of Object.entries(VIDEO)) {
  const out = join(dir, `v.${ext}`);
  ff("-i", clip, ...args, out);
  cases.push([ext, mime, out]);
}
{
  const gif = join(dir, "v.gif");
  ff("-i", clip, "-vf", "fps=5,scale=160:-1:flags=lanczos", gif);
  cases.push(["gif", "image/gif", gif]);
}
for (const [ext, [args, mime]] of Object.entries(IMAGE)) {
  const out = join(dir, `i.${ext}`);
  ff("-i", clip, "-frames:v", "1", ...args, out);
  cases.push([ext, mime, out]);
}
// Documents a delivery would produce: plain text and a minimal PDF.
{
  const txt = join(dir, "d.txt");
  writeFileSync(txt, "Visionex media acceptance probe.\nمرحبا\n");
  cases.push(["txt", "text/plain", txt]);
  const pdf = join(dir, "d.pdf");
  writeFileSync(pdf, "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 72 72]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
  cases.push(["pdf", "application/pdf", pdf]);
}
// The same bytes under the label Meta documents, where ours differs.
const relabel = { opus: "audio/ogg", ogg: "audio/ogg" };
for (const [format, label] of Object.entries(relabel)) {
  const found = cases.find(([f]) => f === format);
  if (found && found[1] !== label) cases.push([`${format} (as ${label})`, label, found[2]]);
}
// Formats Meta does not list for any kind, offered as a document with a generic label.
for (const format of ["wav", "flac", "webm", "mkv", "mov", "gif", "webp", "bmp", "tiff"]) {
  const found = cases.find(([f]) => f === format);
  if (found) cases.push([`${format} (as application/octet-stream)`, "application/octet-stream", found[2]]);
}

const rows = [];
for (const [format, label, path] of cases) {
  const bytes = readFileSync(path);
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", label);
  form.append("file", new Blob([bytes], { type: label }), path.split(/[\\/]/).pop());
  let status = 0, code = "", subcode = "", accepted = false;
  try {
    const res = await fetch(`${GRAPH}/${PHONE}/media`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: form });
    status = res.status;
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.id) {
      accepted = true;
      // Clean up: the probe keeps nothing in the account's media store.
      await fetch(`${GRAPH}/${body.id}?phone_number_id=${PHONE}`, { method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` } }).catch(() => undefined);
    } else {
      code = String(body?.error?.code ?? "");
      subcode = String(body?.error?.error_subcode ?? "");
    }
  } catch {
    status = -1;
  }
  rows.push(`| ${format} | ${label} | ${bytes.length} | ${status} | ${accepted ? "ACCEPTED" : "refused"} | ${code}${subcode ? `/${subcode}` : ""} |`);
}

const table = ["| format | label | bytes | http | upload | meta error |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n");
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## WhatsApp media acceptance\n\n${table}\n`);
