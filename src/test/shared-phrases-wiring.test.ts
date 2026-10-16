// Proof that the shared phrase library is what the real WhatsApp paths consult:
// the clip loader (review), the voice-reply resolver (context), the spoken-greeting
// path (context + state) and the webhook (which tells the resolver the context).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as audio from "../../supabase/functions/_shared/localAudio";
import { LOCAL_AUDIO_ASSETS } from "../../supabase/functions/_shared/localAudioManifest";
import { ackFor, matchAck } from "../../supabase/functions/_shared/localAck";
import { audioState, findPhrase } from "../../supabase/functions/_shared/sharedPhrases";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const localAck = readFileSync("supabase/functions/_shared/localAck.ts", "utf8");
const localAudioSource = readFileSync("supabase/functions/_shared/localAudio.ts", "utf8");

const CLIP = new Uint8Array([...Buffer.from("OggS"), 0, 2, ...new Array(60).fill(7)]);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const entry = (over: Record<string, unknown> = {}) =>
  ({ bytes: CLIP.length, sha256: sha(CLIP), durationMs: 900, status: "active", verifiedAt: "2026-10-16", ...over }) as never;
const READ = (name: string) =>
  ({ MEDIA_PROCESSOR_URL: "https://visionex.example/internal/media", MEDIA_PROCESSOR_TOKEN: "t0ken", WHATSAPP_LOCAL_AUDIO: "1", WHATSAPP_LOCAL_ACK: "1" } as Record<string, string>)[name];
const served = () => vi.fn(async () => new Response(CLIP as unknown as BodyInit, { status: 200 }));

afterEach(() => audio.clearClipCache());

describe("the clip loader asks for a person's approval", () => {
  it("refuses an active clip that has not been reviewed, and does not fetch it", async () => {
    const fetchImpl = served();
    const r = await audio.loadClip("processing", "en", { assets: { "processing.en.ogg": entry() }, read: READ, fetchImpl: fetchImpl as never });
    expect(r).toEqual({ ok: false, reason: "not_reviewed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("serves the same clip once it is marked reviewed", async () => {
    const r = await audio.loadClip("processing", "en", { assets: { "processing.en.ogg": entry({ reviewed: true }) }, read: READ, fetchImpl: served() as never });
    expect(r.ok).toBe(true);
  });

  it("serves nothing from the shipped manifest today: every clip is disabled", async () => {
    for (const name of Object.keys(LOCAL_AUDIO_ASSETS)) {
      const [id, language] = name.replace(/\.ogg$/, "").split(/\.(?=[a-z]{2}$)/);
      const fetchImpl = served();
      const r = await audio.loadClip(id, language, { read: READ, fetchImpl: fetchImpl as never });
      expect(r.ok, name).toBe(false);
      expect(fetchImpl, name).not.toHaveBeenCalled();
    }
  });
});

describe("the voice-reply resolver uses the phrase context", () => {
  const assets = { "ack_hello.en.ogg": entry({ reviewed: true }), "processing.en.ogg": entry({ reviewed: true }) };
  const make = (context?: "fixed_reply" | "voice_pleasantry") =>
    audio.localSpeechResolver(READ, { assets: assets as never, fetchImpl: served() as never, ...(context ? { context } : {}) })!;

  it("does not treat a spoken pleasantry as an ordinary fixed reply, so an answer of exactly Hello. is synthesised as before", async () => {
    expect(await make()("Hello.")).toBeNull();
    expect(await make("fixed_reply")("Hello.")).toBeNull();
    expect(audio.isRegisteredPhrase("Hello.", "fixed_reply")).toBe(false);
  });

  it("plays the pleasantry only when the caller says it is one", async () => {
    const played = await make("voice_pleasantry")("Hello.");
    expect(played).toMatchObject({ kind: "audio" });
    expect(audio.isRegisteredPhrase("Hello.", "voice_pleasantry")).toBe(true);
  });

  it("still plays the full sentences exactly as before", async () => {
    const text = findPhrase(audio.matchPhrase("⏳ Processing your request…", "en")!.id === "processing" ? "⏳ Processing your request…" : "", "en", "fixed_reply")!.text;
    expect(await make()(text)).toMatchObject({ kind: "audio" });
    expect(await make("voice_pleasantry")(text)).toBeNull();
  });

  it("falls back to text, not audio, for a reviewed-less clip of a fixed sentence", async () => {
    const unreviewed = audio.localSpeechResolver(READ, { assets: { "processing.en.ogg": entry() } as never, fetchImpl: served() as never })!;
    expect(await unreviewed("⏳ Processing your request…")).toEqual({ kind: "text" });
  });
});

describe("the spoken-greeting path is decided by the shared library", () => {
  const assets = LOCAL_AUDIO_ASSETS as Record<string, { status: string; reviewed?: boolean }>;
  const saved = new Map<string, { status: string; reviewed?: boolean }>();
  const arm = (name: string, status: string, reviewed?: boolean) => {
    if (!saved.has(name)) saved.set(name, { ...assets[name] });
    assets[name].status = status;
    if (reviewed === undefined) delete assets[name].reviewed; else assets[name].reviewed = reviewed;
  };
  afterEach(() => {
    for (const [n, s] of saved) { assets[n].status = s.status; if (s.reviewed === undefined) delete assets[n].reviewed; else assets[n].reviewed = s.reviewed; }
    saved.clear();
  });

  it("answers only when the shared library reports the clip approved", () => {
    expect(audioState("ack_hello", "en")).toBe("disabled");
    expect(ackFor("hello", READ)).toBeNull();
    arm("ack_hello.en.ogg", "active", undefined);
    expect(audioState("ack_hello", "en")).toBe("unreviewed");
    expect(ackFor("hello", READ)).toBeNull();
    arm("ack_hello.en.ogg", "active", true);
    expect(audioState("ack_hello", "en")).toBe("approved");
    expect(ackFor("hello", READ)).toMatchObject({ id: "ack_hello", language: "en", reply: "Hello." });
  });

  it("is built on the shared library rather than its own copy of the rules", () => {
    expect(localAck).toContain('from "./sharedPhrases.ts"');
    expect(localAck).toMatch(/findPhrase\(match\.reply, match\.language, "voice_pleasantry"\)/);
    expect(matchAck("hello")).not.toBeNull();
  });
});

describe("the webhook", () => {
  it("tells the resolver which context each reply is spoken in, and the greeting path says pleasantry", () => {
    expect(webhook).toMatch(/let phraseContext: PhraseContext = "fixed_reply";/);
    expect(webhook).toMatch(/context: phraseContext,/);
    expect(webhook).toMatch(/isRegisteredPhrase\(text, phraseContext\)/);
    expect(webhook).toMatch(/phraseContext = "voice_pleasantry";\s+await reply\(ack\.reply, "reply"\);/);
  });

  it("sets the pleasantry context only inside the greeting block, never for ordinary replies", () => {
    const sets = webhook.match(/phraseContext = "voice_pleasantry"/g) ?? [];
    expect(sets).toHaveLength(1);
    const at = webhook.indexOf('phraseContext = "voice_pleasantry"');
    expect(webhook.slice(at - 600, at)).toContain("const ack = ackFor(");
  });

  it("does not change entitlement, metering or the reply function's signature", () => {
    expect(webhook).toContain("const reply = async (body: string, kind: string) => {");
    expect(webhook).toMatch(/if \(ack && \(await entitlement\(\)\)\.allowed\)/);
  });
});

describe("the loader's source", () => {
  it("checks review in the one place a clip is read", () => {
    expect(localAudioSource).toMatch(/entry\.reviewed !== true\) return \{ ok: false, reason: "not_reviewed" \}/);
  });
});
