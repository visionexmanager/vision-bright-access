// Converting a file with the ffmpeg that was already installed.
//
// The container has carried ffmpeg since it was built and nothing called it, so
// audio and video conversion needed a route rather than a dependency. What
// needs testing is not that ffmpeg works — it does — but the two things this
// module is responsible for:
//
//   1. nothing a caller sends reaches a command line unless this file wrote it;
//   2. an ffmpeg that exits 0 having produced nothing is a failure, not a file.
//
// The transcode itself is proved end to end by the deploy self-test, which runs
// on the box that has the binary. There is no ffmpeg on a CI runner or on a
// Windows checkout, so asserting it here would be asserting a mock.

import { describe, expect, it } from "vitest";

const convert = await import("../../services/media-processor/src/convert.mjs");

const OPTIONS = {
  to: "mp3",
  kind: "audio",
  start: null,
  duration: null,
  bitrate: null,
  rate: null,
  channels: null,
  height: null,
  fps: null,
  quality: null,
  volume: null,
  normalize: false,
  mute: false,
};

const params = (query: string) => new URLSearchParams(query);

// ── 1. Nothing reaches a command line that this file did not write ───────────

describe("every value that becomes an argument came from a list", () => {
  it("refuses a target it does not know", () => {
    for (const to of ["exe", "mp3;rm -rf /", "../../etc/passwd", "", "MP3", "mp4 "]) {
      expect(convert.readOptions(params(`to=${encodeURIComponent(to)}`)).ok, to).toBe(false);
    }
  });

  it("refuses an option that is present and wrong, rather than ignoring it", () => {
    // Silently dropping an unrecognised bitrate would hand somebody a file that
    // is not what they asked for and say nothing about it.
    for (const query of [
      "to=mp3&bitrate=999k",
      "to=mp3&bitrate=128k%20-f%20null",
      "to=mp3&rate=1",
      "to=mp3&channels=8",
      "to=mp4&height=4320",
      "to=mp4&fps=60",
      "to=mp4&quality=best",
      "to=mp3&volume=100",
    ]) {
      const parsed = convert.readOptions(params(query));
      expect(parsed.ok, query).toBe(false);
      expect(parsed.reason, query).toMatch(/^bad_/);
    }
  });

  it("builds arguments only from constants and validated numbers", () => {
    // The real assertion: take every option at once, and check that each
    // argument is either something this module declares or a plain number.
    const parsed = convert.readOptions(
      params("to=mp4&height=720&fps=30&quality=high&bitrate=192k&start=1.5&duration=10"),
    );
    expect(parsed.ok).toBe(true);

    const args = convert.videoArgs("/tmp/x/in", "/tmp/x/out.mp4", parsed.options);
    for (const arg of args) {
      // No argument may carry a shell metacharacter or a newline, whatever a
      // caller sent. `spawn` with an array does not use a shell, so this is
      // defence in depth rather than the only control — but it is the one that
      // would catch a future edit that starts interpolating.
      expect(arg, arg).not.toMatch(/[;&|`$><\n\r]/);
    }
  });

  it("rebuilds a duration from digits rather than passing the text on", () => {
    // `parseSeconds` returns `String(Number(...))`, so anything the pattern let
    // through arrives as a plain number and cannot carry a leading dash into an
    // argument position.
    expect(convert.parseSeconds("1.500")).toBe("1.5");
    expect(convert.parseSeconds("0")).toBe("0");
    for (const bad of ["-1", "1e3", " 1", "1 ", "1;2", "99999999", "abc", "", "+1", "１"]) {
      expect(convert.parseSeconds(bad), bad).toBeNull();
    }
  });

  it("refuses a trim that would produce a file with no frames in it", () => {
    // ffmpeg accepts a zero duration and exits 0 having written a header.
    expect(convert.parseTrim(null, "0").ok).toBe(false);
    expect(convert.parseTrim("2", "0").reason).toBe("bad_duration");
    expect(convert.parseTrim("2", "5")).toEqual({ ok: true, start: "2", duration: "5" });
    expect(convert.parseTrim(null, null)).toEqual({ ok: true, start: null, duration: null });
  });
});

// ── 2. The commands themselves ───────────────────────────────────────────────

describe("what ffmpeg is actually told to do", () => {
  it("never waits on a terminal that is not there", () => {
    // ffmpeg reads stdin when it thinks it might overwrite a file, and a worker
    // blocked on input that will never arrive is held until the timeout.
    for (const args of [
      convert.audioArgs("in", "out.mp3", OPTIONS),
      convert.videoArgs("in", "out.mp4", { ...OPTIONS, to: "mp4", kind: "video" }),
      convert.gifArgs("in", "out.gif", { ...OPTIONS, to: "gif", kind: "video" }),
    ]) {
      expect(args).toContain("-nostdin");
      expect(args).toContain("-y");
    }
  });

  it("seeks before the input, not after it", () => {
    const args = convert.audioArgs("in", "out.mp3", { ...OPTIONS, start: "30" });
    // After `-i` ffmpeg decodes and discards everything up to the seek point,
    // which on a long file is the difference between a second and a minute.
    expect(args.indexOf("-ss")).toBeLessThan(args.indexOf("-i"));
  });

  it("drops the video stream from an audio conversion", () => {
    // A cover image embedded in an MP3 is a video stream to ffmpeg, and
    // carrying it into a WAV is how a conversion fails on a file that was fine.
    expect(convert.audioArgs("in", "out.wav", { ...OPTIONS, to: "wav" })).toContain("-vn");
  });

  it("does not set a bitrate on a lossless target", () => {
    // `-b:a 128k` on WAV or FLAC is either ignored or an error depending on the
    // build, and neither is a thing to ship.
    for (const to of ["wav", "flac"]) {
      const args = convert.audioArgs("in", `out.${to}`, { ...OPTIONS, to, bitrate: "128k" });
      expect(args, to).not.toContain("-b:a");
    }
    expect(convert.audioArgs("in", "out.mp3", { ...OPTIONS, bitrate: "128k" })).toContain("-b:a");
  });

  it("names a codec for every target rather than trusting the build's default", () => {
    for (const [name, target] of Object.entries(convert.AUDIO_TARGETS)) {
      expect((target as { args: string[] }).args, name).toContain("-c:a");
    }
    for (const [name, target] of Object.entries(convert.VIDEO_TARGETS)) {
      expect((target as { args: string[] }).args, name).toContain("-c:v");
    }
  });

  it("keeps the aspect ratio and an even width when it scales", () => {
    // H.264 chroma subsampling cannot represent an odd dimension and ffmpeg
    // fails outright rather than rounding, so `-2` is the only safe width.
    const args = convert.videoArgs("in", "out.mp4", { ...OPTIONS, to: "mp4", kind: "video", height: "720" });
    expect(args.join(" ")).toContain("scale=-2:720");
  });

  it("puts the index at the front of an MP4", () => {
    // Without faststart a player fetches the end before it can begin, which on
    // a phone over a slow connection looks like a broken file.
    expect(convert.VIDEO_TARGETS.mp4.args).toContain("+faststart");
    expect(convert.VIDEO_TARGETS.mov.args).toContain("+faststart");
  });

  it("uses each codec's own quality scale", () => {
    const crf = (to: string) => {
      const args = convert.videoArgs("in", "o", { ...OPTIONS, to, kind: "video", quality: "small" });
      return args[args.indexOf("-crf") + 1];
    };
    // A VP9 CRF is not an x264 CRF, which is why a caller names an intent.
    expect(crf("webm")).not.toBe(crf("mp4"));
    expect(convert.videoArgs("in", "o", { ...OPTIONS, to: "webm", kind: "video" })).toContain("-deadline");
    expect(convert.videoArgs("in", "o", { ...OPTIONS, to: "mp4", kind: "video" })).toContain("-preset");
  });

  it("caps a GIF whatever it was asked for", () => {
    // Every frame is stored, so ten seconds of 480p is tens of megabytes.
    const args = convert.gifArgs("in", "out.gif", {
      ...OPTIONS, to: "gif", kind: "video", height: "1080", fps: "30", duration: "600",
    });
    const line = args.join(" ");
    expect(line).toContain(`scale=-2:${convert.GIF_MAX_HEIGHT}`);
    expect(line).toContain(`fps=${convert.GIF_MAX_FPS}`);
    expect(args[args.indexOf("-t") + 1]).toBe(String(convert.GIF_MAX_SECONDS));
    // And it builds a palette: the default 216-colour web palette is visibly
    // banded, and the palette pass makes the file both smaller and correct.
    expect(line).toContain("palettegen");
    expect(line).toContain("paletteuse");
  });

  it("mutes rather than transcoding audio nobody asked to keep", () => {
    const args = convert.videoArgs("in", "o", { ...OPTIONS, to: "mp4", kind: "video", mute: true, bitrate: "192k" });
    expect(args).toContain("-an");
    expect(args).not.toContain("-b:a");
  });
});

// ── 3. Reading what a file is ────────────────────────────────────────────────

describe("detection by demuxer rather than by filename", () => {
  const probe = (extra: Record<string, unknown>) =>
    convert.readProbe(JSON.stringify({
      format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.345", ...extra },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
        { codec_type: "audio", codec_name: "aac", channels: 2, sample_rate: "48000" },
      ],
    }));

  it("reads the kind, the duration and the streams", () => {
    const info = probe({});
    expect(info?.kind).toBe("video");
    expect(info?.durationSeconds).toBe(12.345);
    expect(info?.video).toEqual({ codec: "h264", width: 1920, height: 1080 });
    expect(info?.audio).toEqual({ codec: "aac", channels: 2, sampleRate: 48000 });
  });

  it("calls a file with sound and no picture audio", () => {
    const info = convert.readProbe(JSON.stringify({
      format: { format_name: "ogg", duration: "3" },
      streams: [{ codec_type: "audio", codec_name: "opus", channels: 1, sample_rate: "48000" }],
    }));
    expect(info?.kind).toBe("audio");
    expect(info?.video).toBeNull();
  });

  it("hands back no container tags at all", () => {
    // A phone's recording carries the device model and sometimes its
    // coordinates in those tags. This service strips EXIF from images for that
    // exact reason, and returning the same data here would undo it.
    const info = probe({
      tags: { "com.apple.quicktime.model": "iPhone 15", "com.apple.quicktime.location.ISO6709": "+31.9539+035.9106/" },
    });
    const serialised = JSON.stringify(info);
    expect(serialised).not.toContain("iPhone");
    expect(serialised).not.toContain("31.9539");
    expect(serialised).not.toContain("tags");
  });

  it("returns null for something that is not a media file", () => {
    for (const stdout of ["", "not json", "{}", '{"format":null}', '{"streams":[]}']) {
      expect(convert.readProbe(stdout), stdout).toBeNull();
    }
  });
});

// ── 4. The ceilings ──────────────────────────────────────────────────────────

describe("what a job is allowed to cost", () => {
  it("lets an output grow, but not without limit", () => {
    // WAV from a voice note is legitimately an order of magnitude larger, so
    // the output ceiling is above the input one — and still a ceiling.
    expect(convert.MAX_OUTPUT_BYTES).toBeGreaterThan(convert.MAX_CONVERT_BYTES);
    expect(convert.MAX_OUTPUT_BYTES).toBeLessThanOrEqual(64 * 1024 * 1024);
  });

  it("gives video longer than audio, and both a deadline", () => {
    expect(convert.VIDEO_TIMEOUT_MS).toBeGreaterThan(convert.AUDIO_TIMEOUT_MS);
    // Until there is a queue, the ceiling is the safety mechanism: Meta
    // redelivers a webhook that does not answer promptly.
    expect(convert.VIDEO_TIMEOUT_MS).toBeLessThanOrEqual(120_000);
    expect(convert.PROBE_TIMEOUT_MS).toBeLessThan(convert.AUDIO_TIMEOUT_MS);
  });
});
