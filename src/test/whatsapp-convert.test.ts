// Asking for a conversion, and getting one.
//
// Three pieces meet here: the menu this channel offers, the request a sender
// types, and the four network calls that turn a claimed job into a file. Each
// is tested for the thing that would actually go wrong with it — a menu that
// drifts from what the service will accept, a bare format name answered in the
// middle of an unrelated conversation, and a send that fails after an upload
// succeeded.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  AUDIO_TARGETS_BY_NAME,
  targetLabel,
  targetMime,
  VIDEO_TARGETS_BY_NAME,
} from "../../supabase/functions/_shared/whatsappConvertFormats.ts";
import {
  asksToConvert,
  CONVERT_TARGETS,
  offeredTargets,
  parseConvertRequest,
  parseConvertTarget,
  targetAllowedFrom,
  targetKind,
} from "../../supabase/functions/_shared/whatsappConvertIntent.ts";
import {
  messageKindFor,
  outputFilename,
  runMediaJob,
  type WorkerPorts,
} from "../../supabase/functions/_shared/whatsappMediaWorker.ts";

const convertSource = readFileSync("services/media-processor/src/convert.mjs", "utf8");

/** The targets the service will actually produce, read out of the service. */
function serviceTargets(): { audio: string[]; video: string[] } {
  const block = (name: string) => {
    const start = convertSource.indexOf(`export const ${name} = {`);
    const end = convertSource.indexOf("\n};", start);
    return [...convertSource.slice(start, end).matchAll(/^\s{2}([a-z0-9]+):\s*\{/gm)].map((m) => m[1]);
  };
  return { audio: block("AUDIO_TARGETS"), video: block("VIDEO_TARGETS") };
}

// ── 1. The menu may never know more than the service ─────────────────────────

describe("the menu is bound to what the service will accept", () => {
  it("reads a real list out of the service, or this whole file proves nothing", () => {
    const { audio, video } = serviceTargets();
    expect(audio.length).toBeGreaterThan(4);
    expect(video.length).toBeGreaterThan(2);
    expect(audio).toContain("mp3");
    expect(video).toContain("mp4");
  });

  it("offers nothing the service would refuse", () => {
    // Two lists in two places is exactly the drift this repository warns about
    // everywhere else. The service is the authority — it runs ffmpeg — and this
    // is the subset put in front of somebody.
    const { audio, video } = serviceTargets();
    for (const target of Object.keys(AUDIO_TARGETS_BY_NAME)) {
      expect(audio, `audio target ${target}`).toContain(target);
    }
    for (const target of Object.keys(VIDEO_TARGETS_BY_NAME)) {
      // `gif` is handled apart from the VIDEO_TARGETS table in the service.
      if (target === "gif") {
        expect(convertSource).toContain("gifArgs");
        continue;
      }
      expect(video, `video target ${target}`).toContain(target);
    }
  });

  it("names every target it offers, in Latin letters that need no translation", () => {
    // "MP3" is MP3 in all twenty languages. A translation table here would be
    // twenty copies of the same four characters.
    for (const target of CONVERT_TARGETS) {
      const label = targetLabel(target);
      expect(label.trim(), target).not.toBe("");
      expect(targetMime(target), target).toMatch(/^(audio|video|image)\//);
    }
  });

  it("offers only targets it can classify", () => {
    for (const kind of ["audio", "video"] as const) {
      for (const target of offeredTargets(kind)) {
        expect(CONVERT_TARGETS, `${kind}: ${target}`).toContain(target);
        expect(targetKind(target), target).not.toBeNull();
      }
    }
  });
});

// ── 2. What a sender said ────────────────────────────────────────────────────

describe("reading a conversion request", () => {
  it("takes a bare format name, in any language", () => {
    // The one piece of luck in this feature: format names are the same word
    // everywhere, so this needed no translation table at all.
    for (const text of ["mp3", "MP3", "convert to mp3", "حوّلها إلى mp3", "mp3'e çevir", "转成 mp3", "इसे mp3 में बदलो"]) {
      expect(parseConvertTarget(text), text).toBe("mp3");
    }
  });

  it("refuses two formats rather than guessing between them", () => {
    // Guessing produces a file nobody asked for after ninety seconds of waiting.
    expect(parseConvertTarget("mp3 or wav?")).toBeNull();
    expect(parseConvertTarget("convert mp4 to webm")).toBeNull();
  });

  it("does not fire on a word that merely contains a format", () => {
    for (const text of ["mp3s", "xmp3", "webmaster", "gifted", "movies", "waveform"]) {
      expect(parseConvertTarget(text), text).toBeNull();
    }
  });

  it("ignores a message too long to be a command", () => {
    expect(parseConvertTarget(`${"a".repeat(200)} mp3`)).toBeNull();
    expect(parseConvertTarget("")).toBeNull();
  });

  it("lets audio come out of a video, and refuses video out of audio", () => {
    // Taking the sound off a recording is the most asked-for conversion there
    // is. The other direction is not a conversion, it is an invention.
    expect(targetAllowedFrom("video", "mp3")).toBe(true);
    expect(targetAllowedFrom("video", "webm")).toBe(true);
    expect(targetAllowedFrom("audio", "mp3")).toBe(true);
    expect(targetAllowedFrom("audio", "mp4")).toBe(false);

    expect(parseConvertRequest({ text: "mp4", sourceKind: "audio" })).toBeNull();
    expect(parseConvertRequest({ text: "mp3", sourceKind: "video" })).toEqual({ target: "mp3" });
  });
});

// ── 3. Running one job ───────────────────────────────────────────────────────

const JOB = {
  id: "job-1",
  target: "mp3",
  options: { bitrate: "128k" },
  source_media_id: "meta-1",
  attempts: 1,
};

const bytes = (n: number) => new Uint8Array(n).fill(7);

/** Ports that all succeed, plus a record of what was called. */
function ports(overrides: Partial<WorkerPorts> = {}) {
  const calls: string[] = [];
  const finished: Array<{ status: string; code: string | null }> = [];
  const notified: string[] = [];
  const base: WorkerPorts = {
    download: vi.fn(async () => { calls.push("download"); return bytes(64); }),
    convert: vi.fn(async () => { calls.push("convert"); return { ok: true, bytes: bytes(32), mime: "audio/mpeg" }; }),
    upload: vi.fn(async () => { calls.push("upload"); return "meta-out"; }),
    send: vi.fn(async () => { calls.push("send"); return true; }),
    finish: vi.fn(async (status, code) => { calls.push("finish"); finished.push({ status, code }); }),
    notify: vi.fn(async (kind) => { calls.push("notify"); notified.push(kind); }),
  };
  return { ports: { ...base, ...overrides }, calls, finished, notified };
}

describe("running a claimed job", () => {
  it("does the four things in order and records success", async () => {
    const p = ports();
    expect(await runMediaJob(JOB, p.ports)).toBe("done");
    expect(p.calls).toEqual(["download", "convert", "upload", "send", "finish"]);
    expect(p.finished[0]).toEqual({ status: "done", code: null });
    // Nothing is said on success: the file arriving is the message.
    expect(p.notified).toEqual([]);
  });

  it("passes the job's own options to the service", async () => {
    const p = ports();
    await runMediaJob(JOB, p.ports);
    const query = new URLSearchParams((p.ports.convert as ReturnType<typeof vi.fn>).mock.calls[0][1]);
    expect(query.get("to")).toBe("mp3");
    expect(query.get("bitrate")).toBe("128k");
  });

  it("stops at the first failure and does no work after it", async () => {
    const p = ports({ download: vi.fn(async () => null) });
    expect(await runMediaJob(JOB, p.ports)).toBe("queued");
    expect(p.calls).toEqual(["finish"]);
    expect(p.finished[0].code).toBe("upstream");
  });

  it("gives up on a failure that will not change, however many attempts are left", async () => {
    const p = ports({ convert: vi.fn(async () => ({ ok: false, code: "unsupported_target" })) });
    expect(await runMediaJob(JOB, p.ports)).toBe("failed");
    expect(p.notified).toEqual(["failed"]);
  });

  it("retries a failure that is about the moment, and says nothing meanwhile", async () => {
    const p = ports({ convert: vi.fn(async () => ({ ok: false, code: "busy" })) });
    expect(await runMediaJob(JOB, p.ports)).toBe("queued");
    // "Still working on it" three times is three notifications that say nothing.
    expect(p.notified).toEqual([]);
  });

  it("tells the sender once the road runs out", async () => {
    const p = ports({ convert: vi.fn(async () => ({ ok: false, code: "timeout" })) });
    expect(await runMediaJob({ ...JOB, attempts: 3 }, p.ports)).toBe("failed");
    expect(p.notified).toEqual(["failed"]);
  });

  it("treats a send that failed after a successful upload as retryable", async () => {
    // The expensive half is already done and will be done again. That is
    // accepted: holding a media id across attempts would mean storing it, and
    // the whole design of this queue is that nothing about the file is kept.
    const p = ports({ send: vi.fn(async () => false) });
    expect(await runMediaJob(JOB, p.ports)).toBe("queued");
    expect(p.finished[0].code).toBe("upstream");
  });

  it("never throws, whatever a port does", async () => {
    // A job that throws is a job whose row stays `running` until its lease
    // expires, and the sender hears nothing at all in the meantime.
    for (const port of ["download", "convert", "upload", "send"] as const) {
      const p = ports({ [port]: vi.fn(async () => { throw new Error("https://graph.facebook.com/v20.0/meta-1?secret"); }) });
      await expect(runMediaJob(JOB, p.ports)).resolves.toBeTruthy();
      expect(p.finished[0].code, port).toBe("network");
      // And the exception itself never reaches the row: whatever threw quotes a
      // URL, and that URL carries a media id belonging to somebody's file.
      expect(JSON.stringify(p.finished), port).not.toContain("graph.facebook.com");
    }
  });

  it("records an outcome even when the notification fails", async () => {
    const p = ports({
      convert: vi.fn(async () => ({ ok: false, code: "empty_output" })),
      notify: vi.fn(async () => { throw new Error("send failed"); }),
    });
    // The row is written before the sender is told, so a failed message cannot
    // leave a job looking like it never ran.
    await expect(runMediaJob(JOB, p.ports)).rejects.toThrow();
    expect(p.finished[0]).toEqual({ status: "failed", code: "empty_output" });
  });
});

// ── 4. What arrives ──────────────────────────────────────────────────────────

describe("the file the sender receives", () => {
  it("is named after what it is, not after the job", () => {
    // WhatsApp shows this name and a screen reader reads it before anything
    // else about the attachment. A uuid would be technically fine and useless
    // to hear.
    expect(outputFilename("mp3")).toBe("visionex.mp3");
    expect(outputFilename("webm")).toBe("visionex.webm");
  });

  it("carries no part of the sender's own filename", () => {
    // Echoing back a name somebody sent is a way to put their text into a field
    // neither end validates.
    // Lower-case letters, digits and one dot. Nothing that could be a path, a
    // quote or a direction mark.
    for (const target of CONVERT_TARGETS) {
      expect(outputFilename(target), target).toMatch(/^[a-z]+\.[a-z0-9]+$/);
    }
  });

  it("plays in place where it can, and is a document where it cannot", () => {
    // One gesture rather than a download and an app switch, which matters most
    // to the people this channel is for.
    expect(messageKindFor("audio/mpeg")).toBe("audio");
    expect(messageKindFor("video/mp4")).toBe("video");
    expect(messageKindFor("image/gif")).toBe("document");
  });
});

// ── 5. Asking for the feature with nothing attached ──────────────────────────

describe("the menu row, typed or tapped", () => {
  it("recognises the phrase the engine substitutes", () => {
    // Arabic and English only, and not an oversight: the engine substitutes a
    // tapped leaf's `phrase` before any parser sees it, and `parserLanguage` is
    // only ever `ar` or `en`.
    for (const text of ["convert a file", "Convert a file.", "convert", "حوّل ملف", "تحويل"]) {
      expect(asksToConvert(text), text).toBe(true);
    }
  });

  it("stands down when a format was actually named", () => {
    // That is a request, not a question about the feature, and it belongs to
    // the branch that can act on it.
    expect(asksToConvert("convert to mp3")).toBe(false);
    expect(asksToConvert("mp3")).toBe(false);
  });

  it("does not fire on a sentence that merely contains the word", () => {
    // "Convert" appears in plenty of sentences that are not about files.
    for (const text of [
      "can you convert dollars to euros",
      "how do I convert my account",
      "convert 30 celsius to fahrenheit",
      "حوّل لي مبلغ من الدولار",
    ]) {
      expect(asksToConvert(text), text).toBe(false);
    }
  });
});

// ── 6. Where the webhook puts it ─────────────────────────────────────────────

describe("the webhook's own wiring", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
  const mediaBranch = webhook.slice(
    webhook.indexOf("if (incoming.media) {"),
    webhook.indexOf('} else if (incoming.media.kind === "video") {'),
  );

  it("decides a conversion above the spend gate, because it costs nothing", () => {
    // Everything below that gate calls a paid provider. This calls ffmpeg on a
    // box Visionex already rents, so refusing it because an allowance ran out
    // would be charging somebody for a service that has no bill.
    const decision = mediaBranch.indexOf("parseConvertRequest({");
    const gate = mediaBranch.indexOf("await maySpend()");
    expect(decision).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(-1);
    expect(decision).toBeLessThan(gate);
  });

  it("only diverts a file that named a format", () => {
    // A voice note with no caption is still transcribed exactly as before.
    // Diverting every audio file to a conversion would take away the thing this
    // channel is mostly used for in order to advertise what it just gained.
    expect(mediaBranch).toContain("if (convertAsk && convertKind) {");
    expect(mediaBranch).toContain('text: incoming.text ?? ""');
  });

  it("writes the row, then answers, then works — in that order", () => {
    // The row is what makes the work survive this delivery, and the answer is
    // what stops Meta redelivering while the transcode runs.
    const row = mediaBranch.indexOf('.from("whatsapp_media_jobs").insert(');
    const answer = mediaBranch.indexOf("queuedNotice(answerLanguage)");
    const work = mediaBranch.indexOf("EdgeRuntime.waitUntil(drainOneMediaJob())");
    expect(row).toBeGreaterThan(-1);
    expect(row).toBeLessThan(answer);
    expect(answer).toBeLessThan(work);
  });

  it("treats a redelivery's duplicate row as nothing to report", () => {
    // The unique index on `wa_message_id` is the guarantee; 23505 here means it
    // did its job, not that anything went wrong.
    expect(mediaBranch).toContain('queueError.code !== "23505"');
  });

  it("drains the oldest job rather than its own", () => {
    // That is what makes every inbound message a drain, and why this needs no
    // scheduler — which matters, because this repository does not use pg_net.
    expect(webhook).toContain('rpc("whatsapp_claim_media_job"');
    expect(webhook).toContain("_lease_seconds: LEASE_SECONDS");
    expect(webhook).toContain("_max_attempts: MAX_ATTEMPTS");
  });

  it("answers a failure in the job's language, not the drain's", () => {
    // This delivery may belong to somebody else entirely.
    expect(webhook).toContain("failedNotice(jobLanguage)");
  });

  it("is gated by a catalog node, so it can be found and switched off", () => {
    expect(webhook).toContain('featureOn("services.convert")');
  });
});
