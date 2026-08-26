// The shared speech-to-text seam, and the capability table it routes from.
//
// No provider is ever called: every adapter takes `fetchImpl` and `read` by
// injection, and both are supplied here. What is being pinned is the routing —
// which provider is tried, in what order, what is skipped, and what a failure
// is called — because that is the part a future local provider changes.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stt = await import("../../supabase/functions/_shared/voice/stt.ts");
const caps = await import("../../supabase/functions/_shared/voice/capabilities.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");

const LANGS = languages.SUPPORTED_LANGUAGES;
const AUDIO = new Uint8Array([1, 2, 3, 4]);
const KEYS = (name: string) =>
  name === "GROQ_API_KEY" ? "groq-key" : name === "OPENAI_API_KEY" ? "openai-key" : undefined;

/** A transcription endpoint that answers however the test needs, and records. */
function provider(answers: Record<string, { status?: number; text?: string; throws?: boolean }>) {
  const calls: Array<{ host: string; model: string; language: string | null }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const host = new URL(String(url)).host;
    const form = init.body as FormData;
    calls.push({
      host,
      model: String(form.get("model")),
      language: form.get("language") === null ? null : String(form.get("language")),
    });
    const answer = answers[host] ?? { text: "heard it" };
    if (answer.throws) throw new Error("socket");
    if (answer.status && answer.status !== 200) {
      return new Response(JSON.stringify({ error: { message: "nope" } }), { status: answer.status });
    }
    return new Response(JSON.stringify({ text: answer.text ?? "heard it" }), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const GROQ = "api.groq.com";
const OPENAI = "api.openai.com";

describe("the capability table", () => {
  it("covers every Visionex locale, and only those", () => {
    expect(caps.capabilityRows().map((row) => row.language).sort()).toEqual([...LANGS].sort());
  });

  it("claims Whisper for speech-to-text in all twenty, and measures none of them", () => {
    for (const language of LANGS) {
      const row = caps.CAPABILITIES[language];
      expect(row.stt.groq, language).toBe("documented");
      expect(row.stt.openai, language).toBe("documented");
      // The honest part: a vendor claim is not evidence.
      expect(row.evidence.stt, language).toBe("unmeasured");
      expect(row.evidence.tts, language).toBe("unmeasured");
    }
  });

  it("routes the four unconfirmed ElevenLabs languages to OpenAI", () => {
    for (const language of ["fa", "ur", "bn", "vi"] as const) {
      expect(caps.CAPABILITIES[language].ttsClaim.elevenlabs, language).toBe("unknown");
      // Even when ElevenLabs is explicitly preferred, an unconfirmed language
      // does not go there: guessing wrong speaks the wrong language at somebody
      // who cannot see that it went wrong.
      expect(caps.ttsProviderFor(language, "elevenlabs"), language).toBe("openai");
    }
  });

  it("honours a preference when the provider does claim the language", () => {
    expect(caps.ttsProviderFor("ar", "elevenlabs")).toBe("elevenlabs");
    expect(caps.ttsProviderFor("ar")).toBe("openai");
    expect(caps.ttsProviderFor("ja", "elevenlabs")).toBe("elevenlabs");
  });

  it("falls back to the caller's default when no language is named", () => {
    expect(caps.ttsProviderFor(null)).toBe("openai");
    expect(caps.ttsProviderFor("not-a-language", "elevenlabs")).toBe("elevenlabs");
  });

  it("offers both transcription providers, cheapest first", () => {
    expect(caps.sttProvidersFor("ar")).toEqual(["groq", "openai"]);
    expect(caps.sttProvidersFor("bn")).toEqual(["groq", "openai"]);
    // Unknown language: still listen. Whisper detects the language itself.
    expect(caps.sttProvidersFor(null)).toEqual(["groq", "openai"]);
  });
});

describe("transcribing", () => {
  it("uses the first capable provider and stops there", async () => {
    const p = provider({});
    const result = await stt.transcribe({
      bytes: AUDIO, mimeType: "audio/ogg", fetchImpl: p.fetchImpl, read: KEYS,
    });
    expect(result.outcome).toBe("transcript");
    if (result.outcome !== "transcript") return;
    expect(result.provider).toBe("groq");
    expect(result.model).toBe("whisper-large-v3-turbo");
    expect(result.attempts).toEqual([]);
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0].host).toBe(GROQ);
  });

  it("falls through to the next provider and records why", async () => {
    const p = provider({ [GROQ]: { status: 503 } });
    const result = await stt.transcribe({
      bytes: AUDIO, mimeType: "audio/ogg", fetchImpl: p.fetchImpl, read: KEYS,
    });
    expect(result.outcome).toBe("transcript");
    if (result.outcome !== "transcript") return;
    expect(result.provider).toBe("openai");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      provider: "groq",
      failure: { reason: "rejected", status: 503 },
    });
    expect(p.calls.map((c) => c.host)).toEqual([GROQ, OPENAI]);
  });

  it("treats an empty transcript as worth a second opinion", async () => {
    // Silence at one provider is not proof of silence. An empty question must
    // never reach the model.
    const p = provider({ [GROQ]: { text: "   " }, [OPENAI]: { text: "there was speech" } });
    const result = await stt.transcribe({
      bytes: AUDIO, mimeType: "audio/ogg", fetchImpl: p.fetchImpl, read: KEYS,
    });
    expect(result.outcome).toBe("transcript");
    if (result.outcome !== "transcript") return;
    expect(result.text).toBe("there was speech");
    expect(result.attempts[0].failure).toEqual({ reason: "empty", provider: "groq" });
  });

  it("skips a provider with no key instead of spending a request on it", async () => {
    const p = provider({});
    const result = await stt.transcribe({
      bytes: AUDIO, mimeType: "audio/ogg", fetchImpl: p.fetchImpl,
      read: (name) => (name === "OPENAI_API_KEY" ? "openai-key" : undefined),
    });
    expect(result.outcome).toBe("transcript");
    if (result.outcome !== "transcript") return;
    expect(result.provider).toBe("openai");
    // Recorded, so "why did this go to OpenAI?" has an answer.
    expect(result.attempts[0]).toMatchObject({ provider: "groq", failure: { reason: "no_key" }, ms: 0 });
    expect(p.calls.map((c) => c.host)).toEqual([OPENAI]);
  });

  it("reports the furthest failure when every provider fails", async () => {
    const p = provider({ [GROQ]: { throws: true }, [OPENAI]: { status: 429 } });
    const result = await stt.transcribe({
      bytes: AUDIO, mimeType: "audio/ogg", fetchImpl: p.fetchImpl, read: KEYS,
    });
    expect(result.outcome).toBe("failed");
    if (result.outcome !== "failed") return;
    expect(result.failure).toMatchObject({ reason: "rejected", provider: "openai", status: 429 });
    expect(result.attempts.map((a) => a.provider)).toEqual(["groq", "openai"]);
  });

  it("refuses empty audio before spending anything", async () => {
    const p = provider({});
    const result = await stt.transcribe({
      bytes: new Uint8Array(), mimeType: "audio/ogg", fetchImpl: p.fetchImpl, read: KEYS,
    });
    expect(result).toMatchObject({ outcome: "failed", failure: { reason: "invalid_input" } });
    expect(p.calls).toHaveLength(0);
  });

  it("fails explicitly when nothing claims the language", async () => {
    const p = provider({});
    const result = await stt.transcribe({
      bytes: AUDIO, mimeType: "audio/ogg", providers: [], fetchImpl: p.fetchImpl, read: KEYS,
    });
    expect(result).toMatchObject({
      outcome: "failed",
      failure: { reason: "no_capable_provider" },
    });
    expect(p.calls).toHaveLength(0);
  });

  it("sends no language hint unless the caller genuinely knows one", async () => {
    // The WhatsApp path passes nothing on purpose: its only hint would be the
    // language of earlier *typed* messages, and people switch mid-thread.
    const quiet = provider({});
    await stt.transcribe({ bytes: AUDIO, mimeType: "audio/ogg", fetchImpl: quiet.fetchImpl, read: KEYS });
    expect(quiet.calls[0].language).toBeNull();

    const hinted = provider({});
    await stt.transcribe({
      bytes: AUDIO, mimeType: "audio/ogg", language: "ja", fetchImpl: hinted.fetchImpl, read: KEYS,
    });
    expect(hinted.calls[0].language).toBe("ja");
  });

  it("names the file so the provider knows how to decode it", () => {
    expect(stt.filenameForMime("audio/ogg; codecs=opus")).toBe("voice.ogg");
    expect(stt.filenameForMime("audio/mpeg")).toBe("voice.mp3");
    expect(stt.filenameForMime("audio/mp4")).toBe("voice.m4a");
    expect(stt.filenameForMime("something/unknown")).toBe("voice.ogg");
  });
});

describe("the vocabulary a channel answers in", () => {
  it("reduces every failure to the four outcomes a channel distinguishes", () => {
    expect(stt.channelFailureOf({ reason: "invalid_input" })).toBe("invalid_input");
    expect(stt.channelFailureOf({ reason: "no_key", provider: "groq" })).toBe("no_provider");
    expect(stt.channelFailureOf({ reason: "no_capable_provider", language: "xx" })).toBe("no_provider");
    expect(stt.channelFailureOf({ reason: "empty", provider: "groq" })).toBe("empty");
    expect(stt.channelFailureOf({ reason: "transport", provider: "groq" })).toBe("provider_error");
    expect(stt.channelFailureOf({ reason: "rejected", provider: "groq", status: 500, detail: "x" }))
      .toBe("provider_error");
  });

  it("matches the reasons the WhatsApp path already answers in twenty languages", async () => {
    // `whatsappTranscribe.ts` maps each of these to a sentence. The seam must
    // not invent a fifth outcome that no channel has words for.
    const source = readFileSync("supabase/functions/_shared/whatsappTranscribe.ts", "utf8");
    for (const reason of ["no_provider", "empty", "provider_error"]) {
      expect(source, reason).toContain(reason);
    }
  });
});

describe("the capability document", () => {
  const doc = readFileSync("docs/voice-provider-capabilities.md", "utf8");

  it("lists every locale the code knows about", () => {
    for (const language of LANGS) {
      expect(doc, language).toContain(`(${language})`);
    }
  });

  it("keeps the vendor claim and the Visionex evidence in separate columns", () => {
    expect(doc).toContain("UNMEASURED");
    expect(doc).toContain("Vendor claim");
    expect(doc).toContain("Visionex evidence");
  });

  it("records how the language-list conflict was raised, and how it was settled", () => {
    // The brief asked for Ukrainian and no Chinese; the repository says the
    // opposite. Surfacing that rather than picking one quietly was the point,
    // and the answer — the repository is authoritative — belongs beside it, so
    // nobody reopens a decision that has already been made.
    expect(doc).toContain("Ukrainian");
    expect(doc).toContain("the repository is authoritative");
    expect(doc).not.toContain("| *Ukrainian (uk)* |");
  });
});
