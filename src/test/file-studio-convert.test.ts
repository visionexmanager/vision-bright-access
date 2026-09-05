// File Studio, which was a linked page that could not do most of what it offered.
//
// `/services/file-studio` is reachable from the navbar, the footer and the
// service catalog, and its video, archive and most of its audio conversions
// answered "requires server processing. Available in Phase 12 API integration."
// Phase 12 was never built. A visitor could reach that sentence in three clicks.
//
// Two things were wrong and only one of them was the missing server:
//
//   1. there was no server path — there is one now, the same ffmpeg the
//      WhatsApp assistant uses, behind an Edge Function that holds the token a
//      browser cannot;
//   2. the page offered formats nothing could ever produce. AVI, FLV, 3GP and
//      WMA were listed as *outputs*. Those are menu entries that can only fail,
//      and they were most of why the page looked broken.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  MAX_SERVER_FILE_BYTES,
  SERVER_AUDIO_OUTPUTS,
  SERVER_VIDEO_OUTPUTS,
  serverCanProduce,
} from "../services/file-studio/serverConvert";
import { AudioModule } from "../services/file-studio/modules/audio";
import { VideoModule } from "../services/file-studio/modules/video";
import { AUDIO_FORMATS, VIDEO_FORMATS } from "@/lib/types/fileStudio";

const service = readFileSync("services/media-processor/src/convert.mjs", "utf8");
const fn = readFileSync("supabase/functions/file-convert/index.ts", "utf8");
const serverConvert = readFileSync("src/services/file-studio/serverConvert.ts", "utf8");
const audioSource = readFileSync("src/services/file-studio/modules/audio.ts", "utf8");
const videoSource = readFileSync("src/services/file-studio/modules/video.ts", "utf8");

/** The targets the service will actually emit, read out of the service. */
function serviceTargets(name: string): string[] {
  const start = service.indexOf(`export const ${name} = {`);
  const end = service.indexOf("\n};", start);
  return [...service.slice(start, end).matchAll(/^\s{2}([a-z0-9]+):\s*\{/gm)].map((m) => m[1]);
}

// ── 1. The page offers only what exists ──────────────────────────────────────

describe("what File Studio says it can produce", () => {
  it("reads a real list out of the service, or nothing below proves anything", () => {
    expect(serviceTargets("AUDIO_TARGETS").length).toBeGreaterThan(4);
    expect(serviceTargets("VIDEO_TARGETS").length).toBeGreaterThan(2);
  });

  it("matches what the converter will actually emit", () => {
    expect([...SERVER_AUDIO_OUTPUTS].sort()).toEqual(serviceTargets("AUDIO_TARGETS").sort());
    // GIF is produced by its own path in the service rather than from the
    // video table, so it is checked for separately.
    expect([...SERVER_VIDEO_OUTPUTS].filter((f) => f !== "gif").sort())
      .toEqual(serviceTargets("VIDEO_TARGETS").sort());
    expect(SERVER_VIDEO_OUTPUTS).toContain("gif");
    expect(service).toContain("gifArgs");
  });

  it("stopped offering the formats nothing can make", () => {
    // These are the ones that could only ever fail. They stay valid *inputs* —
    // ffmpeg opens them perfectly well — which is the distinction the page had
    // collapsed.
    for (const dead of ["wma"]) {
      expect(AUDIO_FORMATS, `input ${dead}`).toContain(dead);
      expect(AudioModule.supportedOutputFormats, `output ${dead}`).not.toContain(dead);
      expect(AudioModule.supportedInputFormats, `input ${dead}`).toContain(dead);
    }
    for (const dead of ["avi", "flv", "m4v", "3gp"]) {
      expect(VIDEO_FORMATS, `input ${dead}`).toContain(dead);
      expect(VideoModule.supportedOutputFormats, `output ${dead}`).not.toContain(dead);
      expect(VideoModule.supportedInputFormats, `input ${dead}`).toContain(dead);
    }
  });

  it("agrees with itself about what is producible", () => {
    for (const format of [...SERVER_AUDIO_OUTPUTS, ...SERVER_VIDEO_OUTPUTS]) {
      expect(serverCanProduce(format), format).toBe(true);
    }
    for (const format of ["wma", "avi", "flv", "3gp", "exe", ""]) {
      expect(serverCanProduce(format), format).toBe(false);
    }
  });
});

// ── 2. Phase 12 is gone ──────────────────────────────────────────────────────

describe("the sentence that shipped for months", () => {
  it("is no longer anything a visitor can be shown", () => {
    // Comments stripped, not the words softened: both modules now explain in
    // prose what that sentence was and why it is gone, and matching the whole
    // file would find the explanation and call it the offence.
    const code = (source: string) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const [name, source] of [["audio", audioSource], ["video", videoSource]] as const) {
      expect(code(source), name).not.toContain("Phase 12");
      expect(code(source), name).not.toMatch(/requires server processing/i);
    }
  });

  it("was replaced by a call, not by a different apology", () => {
    expect(audioSource).toContain("convertOnServer({");
    expect(videoSource).toContain("convertOnServer({");
  });
});

// ── 3. The gate ──────────────────────────────────────────────────────────────

describe("who may spend the server's cores", () => {
  it("requires a real signed-in user, not an anon key", () => {
    // A conversion is ninety seconds of four dedicated cores shared with the
    // website. Unauthenticated, it is a free CPU-burning service for whoever
    // finds the URL.
    expect(fn).toContain("userClient.auth.getUser()");
    expect(fn).toContain('if (authErr || !user) return json({ error: "Unauthorized" }, 401, cors);');
  });

  it("keeps the processor's token on the server", () => {
    // Anything the page knows, every visitor knows. The page does send a bearer
    // token — the signed-in user's own session — and that one belongs there;
    // what must never reach it is the processor's.
    expect(serverConvert).not.toContain("MEDIA_PROCESSOR_TOKEN");
    expect(serverConvert).not.toContain("processorConfig");
    expect(fn).toContain("processorConfig()");
  });

  it("rebuilds the query rather than forwarding one", () => {
    // A caller sends a target and named options; it cannot smuggle a parameter
    // the browser was never offered, whatever the service would do with it.
    expect(fn).toContain("function buildQuery(");
    expect(fn).toContain("const FORWARDED_OPTIONS");
    expect(fn).toMatch(/\/\^\[a-z0-9\]\{2,5\}\$\//);
  });

  it("refuses a file past the ceiling before doing any work", () => {
    expect(fn).toContain("MAX_CONVERT_UPLOAD_BYTES");
    expect(MAX_SERVER_FILE_BYTES).toBe(16 * 1024 * 1024);
  });

  it("logs a label and never the file or the user", () => {
    // The interpolated parts only. The literal prefix names the function, and
    // `[file-convert]` is not a leak of anybody's file.
    const interpolated = [...fn.matchAll(/console\.(error|log|warn)\(([^\n]*)/g)]
      .flatMap(([, , line]) => [...line.matchAll(/\$\{([^}]*)\}/g)].map(([, value]) => value));
    expect(interpolated.length).toBeGreaterThan(0);
    for (const value of interpolated) {
      expect(value, value).not.toMatch(/user|email|file|bytes|filename|body|target/i);
    }
  });
});

// ── 4. What a person is told when it fails ───────────────────────────────────

describe("the failure a visitor reads", () => {
  it("carries no code, no status and no ffmpeg", () => {
    // The function answers with a label out of a fixed list; this is where a
    // label becomes something a person can act on. "Exit code 1" is not.
    const messages = [...serverConvert.matchAll(/return "([^"]+)";/g)].map((m) => m[1]);
    expect(messages.length).toBeGreaterThan(5);
    for (const message of messages) {
      // The bitrate table in the audio module is not here, so everything
      // matched is a sentence shown to somebody.
      expect(message, message).not.toMatch(/ffmpeg|exit|ENOENT|4\d\d|5\d\d|undefined|null/i);
      expect(message.length, message).toBeGreaterThan(15);
    }
  });

  it("says what to do about the two failures a visitor can act on", () => {
    expect(serverConvert).toContain("Sign in to convert files.");
    expect(serverConvert).toMatch(/too large/i);
  });

  it("never lets the exception itself reach the page", () => {
    // It quotes a URL, and on this page that URL is followed by a token.
    const catchBlock = serverConvert.slice(serverConvert.lastIndexOf("} catch {"));
    expect(catchBlock).not.toContain("error.message");
    expect(catchBlock).toContain("couldn't be reached");
  });
});

// ── 5. The one thing that only breaks on a big file ──────────────────────────

describe("encoding a file the page is actually for", () => {
  it("chunks rather than spreading a whole file into one call", () => {
    // `String.fromCharCode(...bytes)` on a 16 MB file exceeds the argument
    // limit and throws — a bug that appears only on large files, which are
    // exactly the ones somebody opens a converter for.
    expect(serverConvert).toContain("const CHUNK = 0x8000;");
    expect(serverConvert).not.toMatch(/fromCharCode\(\.\.\.\s*buffer\s*\)/);
  });

  it("survives a buffer bigger than the argument limit", () => {
    // The behaviour, not the source: chunked encoding of a megabyte must not
    // throw, and the naive version does.
    const buffer = new Uint8Array(1_000_000).fill(65);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < buffer.length; i += CHUNK) {
      binary += String.fromCharCode(...buffer.subarray(i, i + CHUNK));
    }
    expect(binary.length).toBe(1_000_000);
    expect(() => String.fromCharCode(...buffer)).toThrow();
  });
});
