// Turning one media file into another, with the ffmpeg that was already here.
//
// ── Why this is the cheapest capability in the roadmap ──────────────────────
//
// The container has carried ffmpeg since the day it was built — the Dockerfile
// installs it and, until this file, nothing called it. So audio and video
// conversion needed a route rather than an installation: no new dependency, no
// new image, no model, no quality gate, and nothing to measure before it can be
// trusted. A transcode is either byte-for-byte what the codec produced or it
// failed; unlike OCR or translation there is no "confidently wrong" outcome for
// somebody who cannot see the result to check.
//
// ── Everything that reaches a command line is a whole string from a list ────
//
// This is the rule the OCR and barcode routes already follow, and it matters
// more here because ffmpeg's argument surface is enormous and some of it writes
// files. A caller may pick `mp3` from a list; a caller may not send a bitrate,
// a filter graph or a codec name that is passed through. Numbers are matched
// against a bounded pattern and re-emitted from the match, never forwarded as
// they arrived. There is no path in this file from request text to an argument
// that was not either chosen from a constant below or rebuilt from digits.
//
// `-nostdin` on every invocation: ffmpeg reads the terminal when it thinks a
// file might be overwritten, and a process waiting on stdin that will never
// arrive is a worker held until the timeout kills it.

// ── What a job may cost ──────────────────────────────────────────────────────
//
// Two workers share four dedicated cores with the website. An audio transcode
// of a WhatsApp voice note is under a second; these ceilings are for the file
// that is not that, and they are deliberately tighter than the tool's ability.
// Anything slower than this belongs behind a queue, and the queue does not
// exist yet — so until it does, the ceiling *is* the safety mechanism.

/** A whole audio conversion, including reading and writing the file. */
export const AUDIO_TIMEOUT_MS = 45_000;

/** Video, which is the same work per second of output multiplied by the frames. */
export const VIDEO_TIMEOUT_MS = 90_000;

/** Reading a container's metadata. Sub-second unless the file is a decoy. */
export const PROBE_TIMEOUT_MS = 10_000;

/** The largest file this service will accept for conversion. */
export const MAX_CONVERT_BYTES = 16 * 1024 * 1024;

/**
 * The largest file it will hand back.
 *
 * A transcode can legitimately grow — WAV from a voice note is an order of
 * magnitude larger — so the output ceiling is above the input one. It is not
 * unbounded: a caller who asks for 48 kHz stereo WAV of a long recording gets a
 * refusal rather than a service holding 200 MB in the memory of a box that is
 * also serving a website.
 */
export const MAX_OUTPUT_BYTES = 48 * 1024 * 1024;

// ── The formats ──────────────────────────────────────────────────────────────
//
// Each entry is a container, the codec ffmpeg should put in it, and the MIME
// type the answer is labelled with. The codec is named here rather than left to
// ffmpeg's default because the default depends on how the binary was built, and
// a Debian ffmpeg that silently picks a different AAC encoder is a difference
// nobody would notice until a file would not play on a phone.

/** Audio containers this service will produce. */
export const AUDIO_TARGETS = {
  mp3:  { args: ["-c:a", "libmp3lame"], mime: "audio/mpeg", ext: "mp3" },
  wav:  { args: ["-c:a", "pcm_s16le"], mime: "audio/wav", ext: "wav" },
  flac: { args: ["-c:a", "flac"], mime: "audio/flac", ext: "flac" },
  aac:  { args: ["-c:a", "aac"], mime: "audio/aac", ext: "aac" },
  m4a:  { args: ["-c:a", "aac", "-f", "mp4"], mime: "audio/mp4", ext: "m4a" },
  ogg:  { args: ["-c:a", "libvorbis"], mime: "audio/ogg", ext: "ogg" },
  opus: { args: ["-c:a", "libopus"], mime: "audio/opus", ext: "opus" },
};

/**
 * Video containers this service will produce.
 *
 * `-movflags +faststart` on MP4 and MOV moves the index to the front of the
 * file. Without it a player has to fetch the end before it can start, which on
 * a phone over a slow connection is the difference between a video that plays
 * and one that appears to be broken.
 *
 * GIF is not a video codec and is handled apart from this table: it needs a
 * palette pass to look like anything, and it is capped hard because an
 * uncompressed animation of a real video is enormous.
 */
export const VIDEO_TARGETS = {
  mp4:  { args: ["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"], mime: "video/mp4", ext: "mp4" },
  mov:  { args: ["-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart"], mime: "video/quicktime", ext: "mov" },
  mkv:  { args: ["-c:v", "libx264", "-c:a", "aac"], mime: "video/x-matroska", ext: "mkv" },
  webm: { args: ["-c:v", "libvpx-vp9", "-c:a", "libopus", "-row-mt", "1"], mime: "video/webm", ext: "webm" },
};

/**
 * Still images, with the same ffmpeg.
 *
 * The third capability that needed a route rather than an installation. ffmpeg
 * has decoders and encoders for all of these and has been in this image since
 * it was built; libvips would be faster per megapixel and would also be a new
 * package to install, patch and audit for a job that happens a few times a
 * minute at most.
 *
 * `-frames:v 1` on every image conversion, because an animated GIF or a
 * multi-page TIFF handed to an image encoder otherwise produces one file per
 * frame and ffmpeg exits 0 having written `out.png` as the *last* one — a
 * silent wrong answer of exactly the kind this service is careful about.
 */
export const IMAGE_TARGETS = {
  jpg:  { args: ["-c:v", "mjpeg"], mime: "image/jpeg", ext: "jpg" },
  png:  { args: ["-c:v", "png"], mime: "image/png", ext: "png" },
  webp: { args: ["-c:v", "libwebp"], mime: "image/webp", ext: "webp" },
  bmp:  { args: ["-c:v", "bmp"], mime: "image/bmp", ext: "bmp" },
  tiff: { args: ["-c:v", "tiff"], mime: "image/tiff", ext: "tiff" },
};

export const isImageTarget = (value) =>
  typeof value === "string" && Object.hasOwn(IMAGE_TARGETS, value);

/** A still image is one frame. Nothing here should take a video's budget. */
export const IMAGE_TIMEOUT_MS = 20_000;

/** The widths a caller may ask for. Whole strings, like every other option. */
export const WIDTHS = ["320", "640", "800", "1024", "1280", "1920", "2560"];
export const isWidth = (value) => typeof value === "string" && WIDTHS.includes(value);

/** Quarter turns. A free angle would mean padding, and padding means a colour. */
export const ROTATIONS = ["90", "180", "270"];
export const isRotation = (value) => typeof value === "string" && ROTATIONS.includes(value);

/**
 * How quality maps for the two lossy image encoders.
 *
 * mjpeg wants `-q:v` on a 2-31 scale where *lower is better*, and libwebp wants
 * `-quality` on 0-100 where higher is better. Two encoders, two opposite
 * scales, which is exactly why a caller names an intent rather than a number.
 */
const JPEG_Q = { small: "12", balanced: "6", high: "3" };
const WEBP_Q = { small: "50", balanced: "78", high: "92" };

/**
 * An image conversion, as an argument array.
 *
 * `-map_metadata -1` is not tidiness. A photograph from a phone carries the
 * device model, the software version and frequently GPS coordinates, and this
 * service strips EXIF before OCR for exactly that reason — a conversion that
 * copied it through would be a way to get the same data out through a different
 * door. The rotation is applied to the pixels first, so dropping the metadata
 * cannot leave a picture on its side.
 */
export function imageArgs(input, output, options) {
  const target = IMAGE_TARGETS[options.to];
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input];

  const filters = [];
  // Rotation before scaling: a width means the width of the picture as the
  // viewer will see it, not of the file as it happened to be stored.
  if (options.rotate === "90") filters.push("transpose=1");
  else if (options.rotate === "180") filters.push("transpose=1,transpose=1");
  else if (options.rotate === "270") filters.push("transpose=2");
  // `-2` keeps the aspect ratio and an even height, which some encoders insist
  // on and none object to.
  if (options.width) filters.push(`scale=${options.width}:-2`);
  if (filters.length > 0) args.push("-vf", filters.join(","));

  args.push("-frames:v", "1", ...target.args);

  const quality = options.quality ?? "balanced";
  if (options.to === "jpg") args.push("-q:v", JPEG_Q[quality]);
  else if (options.to === "webp") args.push("-quality", WEBP_Q[quality]);

  args.push("-map_metadata", "-1", output);
  return args;
}

/** Extracting the sound from a video is an audio target with no video stream. */
export const isAudioTarget = (value) =>
  typeof value === "string" && Object.hasOwn(AUDIO_TARGETS, value);

export const isVideoTarget = (value) =>
  typeof value === "string" && Object.hasOwn(VIDEO_TARGETS, value);

// ── The options ──────────────────────────────────────────────────────────────
//
// Every one of these is a list of whole strings. A caller cannot express a
// bitrate this file has not already written down, which costs a little
// flexibility and removes the entire class of question "could this reach the
// command line as something else".

export const BITRATES = ["64k", "96k", "128k", "160k", "192k", "256k", "320k"];
export const SAMPLE_RATES = ["8000", "16000", "22050", "32000", "44100", "48000"];
export const CHANNELS = ["1", "2"];
export const HEIGHTS = ["144", "240", "360", "480", "720", "1080"];
export const FRAME_RATES = ["10", "15", "24", "25", "30"];

/**
 * Constant-quality settings, named rather than numbered.
 *
 * A caller picks "small" or "high"; the numbers behind them differ per codec —
 * a VP9 CRF is not an x264 CRF — and letting a caller send a number would mean
 * either trusting it or explaining the difference. Naming the intent means the
 * mapping can be corrected later without a caller having to change.
 */
export const QUALITIES = ["small", "balanced", "high"];

const H264_CRF = { small: "32", balanced: "26", high: "21" };
const VP9_CRF = { small: "40", balanced: "34", high: "28" };

const inList = (list) => (value) => typeof value === "string" && list.includes(value);
export const isBitrate = inList(BITRATES);
export const isSampleRate = inList(SAMPLE_RATES);
export const isChannels = inList(CHANNELS);
export const isHeight = inList(HEIGHTS);
export const isFrameRate = inList(FRAME_RATES);
export const isQuality = inList(QUALITIES);

/**
 * Seconds, as a number this file wrote rather than the caller's text.
 *
 * The pattern bounds it to five digits and three decimals — about 27 hours,
 * which no file here can be — and the value handed on is `String(Number(...))`,
 * so anything the pattern let through arrives as a plain number and cannot
 * carry a leading dash into an argument position.
 */
export function parseSeconds(value) {
  if (typeof value !== "string" || !/^\d{1,5}(\.\d{1,3})?$/.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86_400) return null;
  return String(seconds);
}

/**
 * A trim, or null, or an error naming which end was wrong.
 *
 * Both ends are optional and a duration of zero is refused: ffmpeg accepts it
 * and produces a file with no frames in it, which is a successful-looking
 * answer to a request nobody meant to make.
 */
export function parseTrim(startRaw, durationRaw) {
  const start = startRaw === null || startRaw === undefined ? null : parseSeconds(startRaw);
  const duration = durationRaw === null || durationRaw === undefined ? null : parseSeconds(durationRaw);
  if (startRaw && start === null) return { ok: false, reason: "bad_start" };
  if (durationRaw && duration === null) return { ok: false, reason: "bad_duration" };
  if (duration !== null && Number(duration) === 0) return { ok: false, reason: "bad_duration" };
  return { ok: true, start, duration };
}

// ── Building the command ─────────────────────────────────────────────────────

/**
 * The arguments common to every run.
 *
 * `-y` overwrites the output path, which is inside a directory this process
 * just created; `-nostdin` is the deadlock guard described at the top;
 * `-hide_banner` and `-loglevel error` keep stderr to something worth logging.
 * The seek goes *before* `-i` deliberately: ffmpeg then jumps to the keyframe
 * rather than decoding and discarding everything up to it, which on a long file
 * is the difference between a second and a minute.
 */
function opening(start, input) {
  const args = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y"];
  if (start !== null) args.push("-ss", start);
  args.push("-i", input);
  return args;
}

/** Audio filters, as one `-af` chain, or nothing. */
function audioFilters({ normalize, volume }) {
  const chain = [];
  // EBU R128 loudness normalisation in one pass. The two-pass version measures
  // first and is more accurate; it is also two runs of the same file, and this
  // is a service with two workers. One pass is the right trade here.
  if (normalize) chain.push("loudnorm=I=-16:TP=-1.5:LRA=11");
  if (volume) chain.push(`volume=${volume}`);
  return chain.length > 0 ? ["-af", chain.join(",")] : [];
}

/** The volume multipliers a caller may ask for. Whole strings, like everything else. */
export const VOLUMES = ["0.25", "0.5", "0.75", "1.5", "2.0", "3.0"];
export const isVolume = inList(VOLUMES);

/**
 * An audio conversion, as an argument array.
 *
 * `-vn` drops any video stream, which is what makes this the same code path for
 * "convert this audio" and "take the sound out of this video". A cover image
 * embedded in an MP3 is a video stream to ffmpeg, and carrying it into a WAV is
 * how a conversion fails on a file that looked fine.
 */
export function audioArgs(input, output, options) {
  const target = AUDIO_TARGETS[options.to];
  const args = opening(options.start, input);
  if (options.duration !== null) args.push("-t", options.duration);
  args.push("-vn", ...target.args);
  if (options.bitrate && options.to !== "wav" && options.to !== "flac") {
    args.push("-b:a", options.bitrate);
  }
  if (options.rate) args.push("-ar", options.rate);
  if (options.channels) args.push("-ac", options.channels);
  args.push(...audioFilters(options));
  args.push(output);
  return args;
}

/**
 * A video conversion, as an argument array.
 *
 * The scale filter keeps the aspect ratio and rounds the width to an even
 * number: H.264's chroma subsampling cannot represent an odd dimension, and
 * ffmpeg fails outright on one rather than rounding it itself. `-2` is the
 * documented way to say "whatever preserves the ratio, made even".
 */
export function videoArgs(input, output, options) {
  const target = VIDEO_TARGETS[options.to];
  const args = opening(options.start, input);
  if (options.duration !== null) args.push("-t", options.duration);

  const filters = [];
  if (options.height) filters.push(`scale=-2:${options.height}`);
  if (filters.length > 0) args.push("-vf", filters.join(","));
  if (options.fps) args.push("-r", options.fps);

  args.push(...target.args);

  const quality = options.quality ?? "balanced";
  args.push("-crf", options.to === "webm" ? VP9_CRF[quality] : H264_CRF[quality]);
  // `-preset` is x264/x265 only; VP9 spells the same idea `-deadline`.
  args.push(...(options.to === "webm" ? ["-deadline", "good", "-cpu-used", "4"] : ["-preset", "veryfast"]));

  if (options.mute) args.push("-an");
  else if (options.bitrate) args.push("-b:a", options.bitrate);

  args.push(output);
  return args;
}

/**
 * An animated GIF, as an argument array.
 *
 * One pass with a generated palette. Without `palettegen`/`paletteuse` ffmpeg
 * quantises to a fixed 216-colour web palette and the result is visibly banded;
 * with it the file is both smaller and correct. The filter is a single `-vf`
 * string built entirely from validated numbers.
 *
 * Capped harder than any other target on purpose: a GIF stores every frame, so
 * ten seconds of 480p is tens of megabytes. Fifteen seconds at 360p and 10 fps
 * is the most this will produce, and asking for more is refused rather than
 * quietly truncated.
 */
export const GIF_MAX_SECONDS = 15;
export const GIF_MAX_HEIGHT = 360;
export const GIF_MAX_FPS = 15;

export function gifArgs(input, output, options) {
  const height = Math.min(Number(options.height ?? "240"), GIF_MAX_HEIGHT);
  const fps = Math.min(Number(options.fps ?? "10"), GIF_MAX_FPS);
  const duration = options.duration === null
    ? String(GIF_MAX_SECONDS)
    : String(Math.min(Number(options.duration), GIF_MAX_SECONDS));

  const args = opening(options.start, input);
  args.push("-t", duration);
  args.push(
    "-vf",
    `fps=${fps},scale=-2:${height}:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer`,
    "-loop", "0",
    output,
  );
  return args;
}

/** Still frames from a video, written as `frame-001.jpg` and so on. */
export const MAX_FRAMES = 12;

export function frameArgs(input, pattern, options) {
  const args = opening(options.start, input);
  if (options.duration !== null) args.push("-t", options.duration);
  args.push(
    "-vf", `fps=${options.fps ?? "1"},scale=-2:${options.height ?? "480"}`,
    "-frames:v", String(options.frames ?? 6),
    "-q:v", "3",
    pattern,
  );
  return args;
}

// ── Reading a file rather than changing it ───────────────────────────────────

/**
 * `ffprobe` arguments for one file.
 *
 * This is what makes format detection honest: an extension is a claim and a
 * MIME type is a claim, but a container that ffmpeg can demux is a fact, and it
 * is the same fact that decides whether a conversion can work at all. Nothing
 * user-supplied reaches this command except the path of a file this service
 * just wrote.
 */
export function probeArgs(input) {
  return [
    "-hide_banner", "-loglevel", "error",
    "-print_format", "json",
    "-show_format", "-show_streams",
    input,
  ];
}

/**
 * The parts of an ffprobe answer worth returning, and nothing else.
 *
 * Deliberately not the whole document. ffprobe reports container tags, which on
 * a phone recording routinely include the device model, the software version
 * and sometimes GPS coordinates — this service strips EXIF from images for that
 * exact reason, and handing the same data back through a different endpoint
 * would undo it.
 */
export function readProbe(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return null;
  }
  const format = parsed?.format;
  if (!format || typeof format !== "object") return null;

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const pick = (type) => streams.find((s) => s?.codec_type === type);
  const video = pick("video");
  const audio = pick("audio");

  const seconds = Number(format.duration);
  return {
    // `format_name` is a comma-separated list of everything the demuxer could
    // be, e.g. "mov,mp4,m4a,3gp,3g2,mj2". Kept whole: narrowing it to one guess
    // here would be this file inventing certainty it does not have.
    container: typeof format.format_name === "string" ? format.format_name.slice(0, 120) : null,
    durationSeconds: Number.isFinite(seconds) ? Math.round(seconds * 1000) / 1000 : null,
    kind: video ? "video" : audio ? "audio" : null,
    video: video
      ? {
        codec: typeof video.codec_name === "string" ? video.codec_name.slice(0, 40) : null,
        width: Number.isFinite(Number(video.width)) ? Number(video.width) : null,
        height: Number.isFinite(Number(video.height)) ? Number(video.height) : null,
      }
      : null,
    audio: audio
      ? {
        codec: typeof audio.codec_name === "string" ? audio.codec_name.slice(0, 40) : null,
        channels: Number.isFinite(Number(audio.channels)) ? Number(audio.channels) : null,
        sampleRate: Number.isFinite(Number(audio.sample_rate)) ? Number(audio.sample_rate) : null,
      }
      : null,
  };
}

// ── Validating one request ───────────────────────────────────────────────────

/**
 * The whole option set, checked, or the first reason it was refused.
 *
 * One function rather than a check per route, because the refusal a caller sees
 * has to be the same shape whichever endpoint it came from — and because a
 * validator that lives beside the argument builders is the one that gets
 * updated when a new option is added to them.
 */
export function readOptions(params) {
  const to = params.get("to");
  // `gif` is a video source producing an image, and is counted as video here
  // because that is the budget it needs and the argument builder it uses.
  const kind = isVideoTarget(to) || to === "gif"
    ? "video"
    : isAudioTarget(to)
    ? "audio"
    : isImageTarget(to)
    ? "image"
    : null;
  if (!kind) return { ok: false, reason: "unsupported_target" };

  const trim = parseTrim(params.get("start"), params.get("duration"));
  if (!trim.ok) return trim;

  const options = {
    to,
    kind,
    start: trim.start,
    duration: trim.duration,
    bitrate: null,
    rate: null,
    channels: null,
    height: null,
    fps: null,
    quality: null,
    volume: null,
    width: null,
    rotate: null,
    normalize: params.get("normalize") === "1",
    mute: params.get("mute") === "1",
  };

  // Each is optional, and each is refused rather than ignored when it is
  // present and wrong. Silently dropping an unrecognised bitrate would hand
  // somebody a file that is not what they asked for and say nothing.
  const checks = [
    ["bitrate", isBitrate], ["rate", isSampleRate], ["channels", isChannels],
    ["height", isHeight], ["fps", isFrameRate], ["quality", isQuality], ["volume", isVolume],
    ["width", isWidth], ["rotate", isRotation],
  ];
  for (const [name, valid] of checks) {
    const value = params.get(name);
    if (value === null) continue;
    if (!valid(value)) return { ok: false, reason: `bad_${name}` };
    options[name] = value;
  }

  return { ok: true, options };
}
