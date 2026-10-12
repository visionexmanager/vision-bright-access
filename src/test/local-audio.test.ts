// Prerecorded WhatsApp voice notes: fixed phrases said from our own disk.
//
// Most of what is asserted here is a refusal: a phrase with no verified clip is
// written, never synthesised; a changed byte is not sent; a switched-off feature
// changes nothing. No real message is sent and no provider is called by any test.

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const audio = await import("../../supabase/functions/_shared/localAudio.ts");
const manifest = await import("../../supabase/functions/_shared/localAudioManifest.ts");
const voice = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");
const langs = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const prepare = await import("../../scripts/local-audio/prepare.mjs");
const datahub = await import("../../services/media-processor/src/datahub.mjs");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

// ── A tiny but structurally valid Opus-in-Ogg file ──────────────────────────

function page(opts: { granule: bigint; header?: number; packets: Uint8Array }): Uint8Array {
  const body = opts.packets;
  const segs: number[] = [];
  let left = body.length;
  while (left >= 255) { segs.push(255); left -= 255; }
  segs.push(left);
  const out = new Uint8Array(27 + segs.length + body.length);
  out.set([0x4f, 0x67, 0x67, 0x53, 0, opts.header ?? 0]);
  new DataView(out.buffer).setBigInt64(6, opts.granule, true);
  out[26] = segs.length;
  out.set(segs, 27);
  out.set(body, 27 + segs.length);
  return out;
}

function opusOgg(seconds: number): Uint8Array {
  const head = new Uint8Array(19);
  head.set([...("OpusHead")].map((c) => c.charCodeAt(0)));
  head[8] = 1; head[9] = 1; head[10] = 0x38; head[11] = 0x01; // pre-skip 312
  const first = page({ granule: 0n, header: 2, packets: head });
  const second = page({ granule: BigInt(Math.round(seconds * 48000) + 312), header: 4, packets: new Uint8Array(40).fill(7) });
  const all = new Uint8Array(first.length + second.length);
  all.set(first); all.set(second, first.length);
  return all;
}

const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const CLIP = opusOgg(1.5);
const entry = (bytes = CLIP, over: Record<string, unknown> = {}) =>
  ({ bytes: bytes.length, sha256: sha(bytes), durationMs: 1500, status: "active", verifiedAt: "2026-10-12", ...over }) as never;
const ON = (name: string) => ({ MEDIA_PROCESSOR_URL: "https://visionex.example/internal/media", MEDIA_PROCESSOR_TOKEN: "t0ken", WHATSAPP_LOCAL_AUDIO: "1" } as Record<string, string>)[name];
const NO_ASSET_ID = "processing";
const ENGLISH = strings.say("processing", "en");
const ASSETS = { "processing.en.ogg": entry() };

const served = (bytes: Uint8Array, init: ResponseInit = {}) => vi.fn(async () => new Response(bytes as unknown as BodyInit, { status: 200, ...init }));

afterEach(() => audio.clearClipCache());

// ── 1. The registry ─────────────────────────────────────────────────────────

describe("the registry", () => {
  it("covers the twenty supported languages, with the words read from the existing strings", () => {
    const report = audio.inspectRegistry();
    expect(report.problems).toEqual([]);
    expect(report.responses).toBe(Object.keys(manifest.LOCAL_RESPONSES).length);
    expect(report.expectedClips).toBe(report.responses * langs.SUPPORTED_LANGUAGES.length);
  });

  it("is honest about what does not exist yet: no clip is claimed", () => {
    const report = audio.inspectRegistry();
    expect(Object.keys(manifest.LOCAL_AUDIO_ASSETS)).toHaveLength(report.active + report.disabled);
    expect(report.missing.length).toBe(report.expectedClips - report.active - report.disabled);
  });

  it("registers only fixed sentences: no variables, nothing unspeakable, one spoken segment each", () => {
    for (const [id, { uiKey }] of Object.entries(manifest.LOCAL_RESPONSES)) {
      for (const language of langs.SUPPORTED_LANGUAGES) {
        const text = strings.say(uiKey as never, language);
        expect(text, `${id}/${language}`).not.toMatch(/[{}]/);
        expect(voice.speechSegments(text), `${id}/${language}`).toHaveLength(1);
      }
    }
  });

  it("never registers the subscription or allowance messages, which carry numbers and a link", () => {
    const keys = Object.values(manifest.LOCAL_RESPONSES).map((r) => r.uiKey);
    for (const forbidden of ["planLimitReached", "planAlmostSpent", "planStatus", "help", "welcome"]) expect(keys).not.toContain(forbidden);
    expect(Object.keys(manifest.LOCAL_RESPONSES).join(" ")).not.toMatch(/subscription|plan|limit/);
  });

  it("flags a malformed manifest entry and an entry nobody registered", () => {
    const bad = inspect({ "processing.en.ogg": { ...(entry() as object), sha256: "xyz", bytes: 0, durationMs: 0, verifiedAt: "soon" }, "ghost.en.ogg": entry() });
    const problems = bad.problems.map((p) => p.problem);
    expect(problems).toEqual(expect.arrayContaining(["bad_checksum_format", "bad_size", "bad_duration", "bad_verified_at", "entry_without_registered_phrase"]));
  });
});

const inspect = (assets: Record<string, unknown>) => audio.inspectRegistry(assets as never);

// ── 2. Recognising a phrase ─────────────────────────────────────────────────

describe("recognising a registered phrase", () => {
  it("finds it in every language, tolerant of the emoji and spacing the strings carry", () => {
    for (const language of langs.SUPPORTED_LANGUAGES) {
      const text = strings.say("processing", language);
      expect(audio.matchPhrase(` ${text}  `, language)?.id, language).toBe(NO_ASSET_ID);
    }
  });

  it("recognises another locale's string by its own language", () => {
    expect(audio.matchPhrase(strings.say("stoppedWorking", "ar"))?.language).toBe("ar");
    expect(audio.matchPhrase(strings.say("stoppedWorking", "fr"))?.language).toBe("fr");
  });

  it("does not take an answer, a question, a changed sentence or a near miss for a phrase", () => {
    for (const text of ["The capital of France is Paris.", "Processing your request… and here is more", ENGLISH + " Please wait.", "", "   ", "Go ahead", strings.say("failed", "en").replace("Sorry", "Apologies")]) {
      expect(audio.isRegisteredPhrase(text), text).toBe(false);
    }
  });
});

// ── 3. Reading a clip ───────────────────────────────────────────────────────

describe("loading a clip", () => {
  const deps = (fetchImpl: unknown, assets: Record<string, unknown> = ASSETS) => ({ assets: assets as never, read: ON, fetchImpl: fetchImpl as never });

  it("serves a clip that matches its manifest, asking only the Data Hub route", async () => {
    const f = served(CLIP);
    const r = await audio.loadClip("processing", "en", deps(f));
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://visionex.example/internal/media/datahub/file?dataset=voice-prompts&path=processing.en.ogg");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer t0ken");
    expect(url).not.toMatch(/\/var\/|\\|\.\.\//);
  });

  it("keeps a verified clip in a bounded memory cache and does not fetch it again", async () => {
    const f = served(CLIP);
    await audio.loadClip("processing", "en", deps(f));
    await audio.loadClip("processing", "en", deps(f));
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("refuses, with a reason, a clip that is not listed, disabled, oversized, or fetched with the service off", async () => {
    const never = vi.fn();
    expect(await audio.loadClip("processing", "fr", deps(never))).toEqual({ ok: false, reason: "not_listed" });
    expect(await audio.loadClip("processing", "en", deps(never, { "processing.en.ogg": entry(CLIP, { status: "disabled" }) }))).toEqual({ ok: false, reason: "disabled" });
    expect(await audio.loadClip("processing", "en", deps(never, { "processing.en.ogg": entry(CLIP, { bytes: audio.MAX_CLIP_BYTES + 1 }) }))).toEqual({ ok: false, reason: "too_large" });
    expect(await audio.loadClip("processing", "en", { assets: ASSETS as never, read: () => undefined, fetchImpl: never as never })).toEqual({ ok: false, reason: "service_off" });
    expect(never).not.toHaveBeenCalled();
  });

  it("refuses a corrupted file: wrong size, wrong checksum, not an Ogg stream", async () => {
    const flipped = CLIP.slice(); flipped[40] ^= 0xff;
    expect(await audio.loadClip("processing", "en", deps(served(flipped)))).toEqual({ ok: false, reason: "checksum_mismatch" });
    expect(await audio.loadClip("processing", "en", deps(served(CLIP.slice(0, 60))))).toEqual({ ok: false, reason: "size_mismatch" });
    const text = new TextEncoder().encode("<html>this is not audio at all, it is a web page</html>");
    expect(await audio.loadClip("processing", "en", deps(served(text), { "processing.en.ogg": entry(text) }))).toEqual({ ok: false, reason: "not_ogg" });
  });

  it("refuses an oversized body even when the manifest lied, and treats a failure or a hang as a fetch failure", async () => {
    const huge = new Uint8Array(audio.MAX_CLIP_BYTES + 10);
    expect((await audio.loadClip("processing", "en", deps(served(huge), { "processing.en.ogg": entry(CLIP) }))).ok).toBe(false);
    expect(await audio.loadClip("processing", "en", deps(vi.fn(async () => new Response("no", { status: 404 }))))).toEqual({ ok: false, reason: "fetch_failed" });
    expect(await audio.loadClip("processing", "en", deps(vi.fn(async () => { throw new Error("socket"); })))).toEqual({ ok: false, reason: "fetch_failed" });
  });
});

// ── 4. The switch and the policy ────────────────────────────────────────────

describe("the resolver", () => {
  const make = (read: (n: string) => string | undefined, over: Record<string, unknown> = {}) =>
    audio.localSpeechResolver(read, { assets: ASSETS as never, fetchImpl: served(CLIP) as never, ...over } as never);

  it("is off unless WHATSAPP_LOCAL_AUDIO is exactly 1, and off without the processing service", () => {
    expect(make((n) => (n === "WHATSAPP_LOCAL_AUDIO" ? undefined : ON(n)))).toBeNull();
    expect(make((n) => (n === "WHATSAPP_LOCAL_AUDIO" ? "true" : ON(n)))).toBeNull();
    expect(make((n) => (n === "WHATSAPP_LOCAL_AUDIO" ? "1" : undefined))).toBeNull();
    expect(make(ON)).not.toBeNull();
  });

  it("returns the clip for a registered phrase that has one", async () => {
    const r = await make(ON)!(ENGLISH);
    expect(r).toMatchObject({ kind: "audio", mimeType: "audio/ogg", clip: "processing.en.ogg" });
  });

  it("answers a registered phrase with no clip as text, in the same language, and never as something else", async () => {
    const r = await make(ON)!(strings.say("processing", "fr"));
    expect(r).toEqual({ kind: "text" });
  });

  it("leaves an unregistered reply to the ordinary path", async () => {
    expect(await make(ON)!("Here is the answer to your question about the weather.")).toBeNull();
  });

  it("reports only an id, a language and an outcome — never the words", async () => {
    const events: Array<Record<string, unknown>> = [];
    const r = make(ON, { report: (e: Record<string, unknown>) => events.push(e) })!;
    await r(ENGLISH);
    await r(strings.say("processing", "fr"));
    expect(events).toEqual([
      { id: "processing", language: "en", outcome: "audio" },
      { id: "processing", language: "fr", outcome: "text", reason: "not_listed" },
    ]);
    expect(JSON.stringify(events)).not.toContain(ENGLISH);
  });
});

// ── 5. Through speakReply ───────────────────────────────────────────────────

describe("speaking a reply", () => {
  const harness = (over: { upload?: unknown; send?: unknown } = {}) => {
    const synthesise = vi.fn(async () => ({ ok: true as const, bytes: new Uint8Array([1]), mimeType: "audio/ogg" }));
    const upload = (over.upload as never) ?? vi.fn(async () => "media-1");
    const send = (over.send as never) ?? vi.fn(async () => true);
    return { synthesise, upload, send, ops: { synthesise, upload, send } as never };
  };
  const base = { phoneNumberId: "123", token: "tok", to: "9617" };
  const resolver = (read = ON) => audio.localSpeechResolver(read, { assets: ASSETS as never, fetchImpl: served(CLIP) as never })!;
  const store = () => {
    const rows = new Map<string, string>();
    return { rows, get: vi.fn(async (k: string) => rows.get(k) ?? null), put: vi.fn(async (k: string, id: string) => { rows.set(k, id); }), drop: vi.fn(async (k: string) => { rows.delete(k); }) };
  };

  it("plays a prerecorded phrase: one upload, one send, and the synthesiser is never called", async () => {
    const h = harness();
    expect(await voice.speakReply({ ...base, text: ENGLISH, local: resolver(), ops: h.ops })).toBe(true);
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.send).toHaveBeenCalledTimes(1);
    expect(h.synthesise).not.toHaveBeenCalled();
    expect((h.upload as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe("audio/ogg");
  });

  it("reuses Meta's media id the second time, and recovers once if Meta has forgotten it", async () => {
    const s = store();
    const h = harness();
    await voice.speakReply({ ...base, text: ENGLISH, local: resolver(), cache: s, ops: h.ops });
    await voice.speakReply({ ...base, text: ENGLISH, local: resolver(), cache: s, ops: h.ops });
    expect(h.upload).toHaveBeenCalledTimes(1);
    expect(h.send).toHaveBeenCalledTimes(2);

    const send = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const h2 = harness({ send });
    expect(await voice.speakReply({ ...base, text: ENGLISH, local: resolver(), cache: s, ops: h2.ops })).toBe(true);
    expect(s.drop).toHaveBeenCalledTimes(1);
    expect(h2.upload).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(h2.synthesise).not.toHaveBeenCalled();
  });

  it("does not synthesise a known phrase whose clip is missing: it reports failure so the written copy is sent", async () => {
    const h = harness();
    expect(await voice.speakReply({ ...base, text: strings.say("processing", "de"), local: resolver(), ops: h.ops })).toBe(false);
    expect(h.synthesise).not.toHaveBeenCalled();
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("stops, without synthesising, when the upload or the send fails (bounded: no retry loop)", async () => {
    const up = harness({ upload: vi.fn(async () => null) });
    expect(await voice.speakReply({ ...base, text: ENGLISH, local: resolver(), ops: up.ops })).toBe(false);
    expect(up.upload).toHaveBeenCalledTimes(1);
    const sd = harness({ send: vi.fn(async () => false) });
    expect(await voice.speakReply({ ...base, text: ENGLISH, local: resolver(), ops: sd.ops })).toBe(false);
    expect(sd.send).toHaveBeenCalledTimes(1);
    expect(up.synthesise).not.toHaveBeenCalled();
    expect(sd.synthesise).not.toHaveBeenCalled();
  });

  it("takes the ordinary synthesised path for anything that is not a registered phrase", async () => {
    const h = harness();
    expect(await voice.speakReply({ ...base, text: "Here is the answer you asked for.", local: resolver(), ops: h.ops })).toBe(true);
    expect(h.synthesise).toHaveBeenCalledTimes(1);
  });

  it("behaves exactly as before when no resolver is given", async () => {
    const h = harness();
    expect(await voice.speakReply({ ...base, text: ENGLISH, ops: h.ops })).toBe(true);
    expect(h.synthesise).toHaveBeenCalledTimes(1);
  });

  it("treats a resolver that throws as the ordinary path, never a lost answer", async () => {
    const h = harness();
    const broken = async () => { throw new Error("disk"); };
    expect(await voice.speakReply({ ...base, text: ENGLISH, local: broken as never, ops: h.ops })).toBe(true);
    expect(h.synthesise).toHaveBeenCalledTimes(1);
  });

  it("never calls a text-to-speech provider over the network for a prerecorded phrase", async () => {
    const real = vi.fn(async (..._args: unknown[]) => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", real);
    try {
      const h = harness();
      await voice.speakReply({ ...base, text: ENGLISH, local: resolver(), ops: h.ops });
      for (const call of real.mock.calls) expect(String(call[0])).not.toMatch(/openai|elevenlabs|mistral|speech/i);
    } finally { vi.unstubAllGlobals(); }
  });
});

// ── 6. The webhook ──────────────────────────────────────────────────────────

describe("the WhatsApp webhook", () => {
  const speakAt = webhook.indexOf("// Prerecorded phrases (off unless WHATSAPP_LOCAL_AUDIO=1");
  const block = webhook.slice(speakAt, speakAt + 1500);

  it("wires the resolver into the reply path only, inside the delivery, with a written fallback", () => {
    expect(speakAt).toBeGreaterThan(0);
    expect(block).toContain("localSpeechResolver((name) => Deno.env.get(name)");
    expect(block).toContain("isRegisteredPhrase(text)");
    expect(block).toContain("sendWhatsAppText(");
    expect(webhook.split("local: null").length + webhook.split("local,").length).toBeGreaterThan(1);
    // The menu path is untouched.
    const menu = webhook.slice(webhook.indexOf("tap: (tappable) => sendTappable(delivery, tappable),"), webhook.indexOf("tap: (tappable) => sendTappable(delivery, tappable),") + 600);
    expect(menu).not.toContain("local");
  });

  it("logs only an id, a language and an outcome", () => {
    expect(block).toContain('log("local_audio", { reason: event.id, language: event.language, outcome: event.reason ?? event.outcome })');
  });

  it("claims the inbound message and suppresses a repeated reply before any medium is chosen", () => {
    const claim = webhook.indexOf('const { error: dupe } = await db.from("whatsapp_messages").insert({');
    const repeat = webhook.indexOf("if (isRepeatOf(body, lastSentBody))");
    const medium = webhook.indexOf("const medium = replyMedium({ spokenInput, voiceRequested, body });");
    expect(claim).toBeGreaterThan(0);
    expect(claim).toBeLessThan(speakAt);
    expect(repeat).toBeGreaterThan(0);
    expect(repeat).toBeLessThan(medium);
  });

  it("leaves the subscription gate, the allowance check and the paid assistant call where they were", () => {
    const gate = webhook.indexOf("const maySpend = async");
    expect(gate).toBeGreaterThan(0);
    expect(webhook.indexOf("const asked = await askAssistant(")).toBeGreaterThan(gate);
    expect(webhook).toContain("planLimitNotice(answerLanguage");
    // Recording a clip decision never touches an allowance.
    expect(block).not.toMatch(/maySpend|recordSpend|entitlement/);
  });

  it("answers a spoken question with the same medium rules as before", () => {
    expect(readFileSync("supabase/functions/_shared/whatsappVoiceReply.ts", "utf8")).toContain("if (!params.spokenInput && !params.voiceRequested) return \"text\";");
  });
});

// ── 7. Preparing clips ──────────────────────────────────────────────────────

describe("preparing clips", () => {
  const dir = mkdtempSync(join(tmpdir(), "local-audio-"));
  afterEach(() => undefined);

  it("measures a valid Opus/Ogg file and refuses everything else", () => {
    writeFileSync(join(dir, "processing.en.ogg"), CLIP);
    writeFileSync(join(dir, "stopped.en.ogg"), new TextEncoder().encode("not audio at all, definitely not an ogg stream, just words padding it out"));
    writeFileSync(join(dir, "Bad Name.ogg"), CLIP);
    writeFileSync(join(dir, "ask_question.fr.ogg"), CLIP.slice(0, 40));
    const rows = prepare.describeFolder(dir) as Array<Record<string, unknown>>;
    const good = rows.find((r) => r.file === "processing.en.ogg")!;
    expect(good).toMatchObject({ bytes: CLIP.length, sha256: sha(CLIP), durationMs: 1500 });
    expect(rows.find((r) => r.file === "stopped.en.ogg")?.problem).toBe("not_ogg");
    expect(rows.find((r) => r.file === "Bad Name.ogg")?.problem).toBe("name_is_not_id.language.ogg");
    expect(rows.find((r) => r.file === "ask_question.fr.ogg")?.problem).toBeDefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it("sends nothing and calls no provider: it reads files and prints", () => {
    const source = readFileSync("scripts/local-audio/prepare.mjs", "utf8");
    expect(source).not.toMatch(/fetch\(|https?:\/\/|XMLHttpRequest|child_process|writeFileSync|process\.env/);
  });
});

// ── 8. The server side ──────────────────────────────────────────────────────

describe("the Data Hub route", () => {
  it("serves audio/ogg for the clips and still refuses executables and archives", () => {
    expect(datahub.TYPES.ogg).toBe("audio/ogg");
    for (const ext of ["sh", "exe", "zip", "mp3", "wav", "js"]) expect(Object.prototype.hasOwnProperty.call(datahub.TYPES, ext), ext).toBe(false);
  });
});
