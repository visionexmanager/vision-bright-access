// A narrated slideshow, rendered to one MP4.
//
// The images and the narration are made elsewhere (Video Studio asks OpenAI for
// them); this only turns finished bytes into a video, which is what ffmpeg in
// this image is for. Nothing here reaches the network, and every value that
// reaches a command line is a number or an allowlisted string, never text from
// the caller.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MAX_SCENES = 6;
export const MIN_SCENES = 1;
/** One picture. A JPEG at the sizes Video Studio asks for is a few hundred KB. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
/** The longest clip this makes. Narration beyond it is cut, not stretched. */
export const MAX_SECONDS = 60;
export const MIN_SCENE_SECONDS = 3;
export const SLIDESHOW_TIMEOUT_MS = 120_000;
export const FPS = 25;

export const FRAMES = {
  "16:9": { w: 1280, h: 720 },
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 960, h: 960 },
};

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];

/** What kind of picture these bytes are, by their first bytes rather than by a claim. */
export function imageKind(bytes) {
  if (JPEG.every((b, i) => bytes[i] === b)) return "jpg";
  if (PNG.every((b, i) => bytes[i] === b)) return "png";
  return null;
}

/**
 * The request, validated. `images` and `audio` arrive as base64 strings inside
 * JSON; a malformed one is a refusal, never a partial render.
 */
export function readSlideshowRequest(payload) {
  if (!payload || typeof payload !== "object") return { ok: false, reason: "bad_request" };
  const frame = FRAMES[payload.aspect];
  if (!frame) return { ok: false, reason: "bad_aspect" };
  if (!Array.isArray(payload.images)) return { ok: false, reason: "bad_request" };
  if (payload.images.length < MIN_SCENES || payload.images.length > MAX_SCENES) {
    return { ok: false, reason: "bad_scene_count" };
  }
  if (typeof payload.audio !== "string" || payload.audio.length === 0) {
    return { ok: false, reason: "bad_audio" };
  }

  const images = [];
  for (const entry of payload.images) {
    if (typeof entry !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(entry)) return { ok: false, reason: "bad_image" };
    const bytes = Buffer.from(entry, "base64");
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return { ok: false, reason: "bad_image" };
    const kind = imageKind(bytes);
    if (!kind) return { ok: false, reason: "bad_image" };
    images.push({ bytes, kind });
  }

  if (!/^[A-Za-z0-9+/]+=*$/.test(payload.audio)) return { ok: false, reason: "bad_audio" };
  const audio = Buffer.from(payload.audio, "base64");
  if (audio.length === 0 || audio.length > MAX_AUDIO_BYTES) return { ok: false, reason: "bad_audio" };

  return { ok: true, request: { frame, images, audio } };
}

/** Seconds each picture stays on screen: the narration, shared out, with a floor. */
export function sceneSeconds(audioSeconds, scenes) {
  const total = Math.min(Math.max(audioSeconds, 1), MAX_SECONDS) + 0.5;
  const each = total / scenes;
  // Whole frames, so the concat joins land exactly where the filter says.
  return Math.ceil(Math.max(each, MIN_SCENE_SECONDS) * FPS) / FPS;
}

/**
 * The ffmpeg arguments. Each picture is scaled to cover the frame and given a
 * slow push in or pull out (alternating), then the scenes are joined and the
 * narration laid under them.
 */
export function slideshowArgs({ files, audioFile, frame, seconds, out }) {
  const frames = Math.round(seconds * FPS);
  const args = ["-y", "-hide_banner", "-loglevel", "error"];
  for (const file of files) args.push("-i", file);
  args.push("-i", audioFile);

  const filters = files.map((_, i) => {
    const zoom = i % 2 === 0
      ? "min(zoom+0.0012,1.2)"
      : "if(eq(on,0),1.2,max(zoom-0.0012,1.0))";
    return `[${i}:v]scale=${frame.w * 2}:${frame.h * 2}:force_original_aspect_ratio=increase,` +
      `crop=${frame.w * 2}:${frame.h * 2},` +
      `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${frame.w}x${frame.h}:fps=${FPS},` +
      `setsar=1,format=yuv420p[v${i}]`;
  });
  const joined = files.map((_, i) => `[v${i}]`).join("") + `concat=n=${files.length}:v=1:a=0[v]`;

  args.push(
    "-filter_complex", [...filters, joined].join(";"),
    "-map", "[v]", "-map", `${files.length}:a`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "27",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart", "-shortest",
    out,
  );
  return args;
}

function run(command, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (c) => { if (stdout.length < 16_000) stdout += c.toString(); });
    child.stderr.on("data", () => {});
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Object.assign(new Error("timeout"), { code: "timeout" }));
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(Object.assign(error, { code: "spawn_failed" }));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(Object.assign(new Error("render_failed"), { code: "render_failed" }));
    });
  });
}

/** The narration's length in seconds, read by ffprobe from the file itself. */
async function audioSeconds(file) {
  const stdout = await run(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file],
    15_000,
  );
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw Object.assign(new Error("bad_audio"), { code: "bad_audio" });
  return seconds;
}

/** Render one request. The temporary directory is removed on every path. */
export async function renderSlideshow({ frame, images, audio }) {
  const dir = await mkdtemp(join(tmpdir(), "show-"));
  try {
    const files = [];
    for (const [i, image] of images.entries()) {
      const file = join(dir, `s${i}.${image.kind}`);
      await writeFile(file, image.bytes);
      files.push(file);
    }
    const audioFile = join(dir, "narration");
    await writeFile(audioFile, audio);
    const out = join(dir, "out.mp4");

    const seconds = sceneSeconds(await audioSeconds(audioFile), files.length);
    await run("ffmpeg", slideshowArgs({ files, audioFile, frame, seconds, out }), SLIDESHOW_TIMEOUT_MS);

    const produced = await readFile(out);
    if (produced.length === 0) throw Object.assign(new Error("empty_output"), { code: "empty_output" });
    return { bytes: produced, seconds: seconds * files.length };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
