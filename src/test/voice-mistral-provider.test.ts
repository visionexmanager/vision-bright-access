import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Voice cloning moved to Mistral Voxtral on 2026-09-25: ELEVENLABS_API_KEY was
// never configured, so every clone failed. The request shapes below come from
// Mistral's own SDK (POST /v1/audio/speech → { audio_data: base64 };
// POST /v1/audio/voices → { id }). No test here reaches the network.

const tts = await import("../../supabase/functions/_shared/voice/tts.ts");
const caps = await import("../../supabase/functions/_shared/voice/capabilities.ts");
const choice = await import("../../supabase/functions/_shared/whatsappVoiceChoice.ts");

const studio = readFileSync("supabase/functions/voice-studio/index.ts", "utf8");
const env = (values: Record<string, string>) => (name: string) => values[name];

describe("speaking a Mistral voice", () => {
  const request = {
    text: "مرحبا", provider: "mistral" as const, model: "tts-1", voice: "voice-uuid", format: "mp3" as const, speed: 1.3,
  };

  it("reads MISTRAL_API_KEY and calls /v1/audio/speech with the voice id", () => {
    expect(tts.KEY_FOR.mistral).toBe("MISTRAL_API_KEY");
    const { url, init } = tts.ttsRequestFor(request, "k");
    expect(url).toBe("https://api.mistral.ai/v1/audio/speech");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    // The shared "tts-1" default is not a Voxtral model, and speed is refused by Mistral.
    expect(JSON.parse(init.body as string)).toEqual({
      model: "voxtral-mini-tts-2603", input: "مرحبا", voice_id: "voice-uuid", response_format: "mp3",
    });
  });

  it("maps formats Mistral lacks onto ones it has", () => {
    const body = (format: "ogg" | "aac") => JSON.parse(tts.ttsRequestFor({ ...request, format }, "k").init.body as string);
    expect(body("ogg").response_format).toBe("opus");
    expect(body("aac").response_format).toBe("mp3");
    expect(tts.mimeFor("mistral", "ogg")).toBe("audio/ogg");
  });

  it("decodes the base64 audio_data Mistral answers with", async () => {
    const audio = new Uint8Array([73, 68, 51, 4]);
    const fetchImpl = async () => new Response(JSON.stringify({ audio_data: Buffer.from(audio).toString("base64") }), {
      headers: { "Content-Type": "application/json" },
    });
    const result = await tts.synthesize({ ...request, fetchImpl: fetchImpl as typeof fetch, read: env({ MISTRAL_API_KEY: "k" }) });
    expect(result.outcome).toBe("audio");
    if (result.outcome === "audio") {
      expect([...result.bytes]).toEqual([...audio]);
      expect(result.mimeType).toBe("audio/mpeg");
    }
  });

  it("treats a response with no audio as empty, not as success", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({}), { headers: { "Content-Type": "application/json" } });
    const result = await tts.synthesize({ ...request, fetchImpl: fetchImpl as typeof fetch, read: env({ MISTRAL_API_KEY: "k" }) });
    expect(result).toEqual({ outcome: "failed", failure: { reason: "empty", provider: "mistral" } });
  });

  it("hands streaming callers decoded audio, not Mistral's JSON", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ audio_data: Buffer.from([1, 2, 3]).toString("base64") }));
    const result = await tts.synthesizeResponse({ ...request, fetchImpl: fetchImpl as typeof fetch, read: env({ MISTRAL_API_KEY: "k" }) });
    expect(result.outcome).toBe("response");
    if (result.outcome === "response") {
      expect([...new Uint8Array(await result.response.arrayBuffer())]).toEqual([1, 2, 3]);
      expect(result.response.headers.get("Content-Type")).toBe("audio/mpeg");
    }
  });

  it("names the missing key when it is absent", async () => {
    const result = await tts.synthesize({ ...request, read: env({}) });
    expect(result).toEqual({ outcome: "failed", failure: { reason: "no_key", provider: "mistral" } });
    if (result.outcome === "failed") expect(tts.describeTtsFailure(result.failure)).toContain("MISTRAL_API_KEY");
  });
});

describe("which languages a Mistral clone may speak", () => {
  it("claims only the nine languages Voxtral documents", () => {
    for (const language of ["en", "fr", "es", "pt", "it", "nl", "de", "hi", "ar"] as const) {
      expect(caps.CAPABILITIES[language].ttsClaim.mistral, language).toBe("documented");
    }
    for (const language of ["ja", "zh", "ur", "fa", "tr", "ru"] as const) {
      expect(caps.CAPABILITIES[language].ttsClaim.mistral, language).toBe("unknown");
    }
  });

  it("uses the clone where it can, and OpenAI where it cannot", () => {
    expect(caps.ttsProviderFor("ar", "mistral")).toBe("mistral");
    expect(caps.ttsProviderFor("ja", "mistral")).toBe("openai");
    // Nothing is preferred into Mistral by default.
    expect(caps.ttsProviderFor("ar")).toBe("openai");
  });
});

describe("WhatsApp speaks a Mistral clone", () => {
  it("resolves a Mistral row to its voice and a Voxtral model", () => {
    expect(choice.readResolvedVoice({ provider: "mistral", voice_id: "v-1", model: "voxtral-mini-tts-2603" }))
      .toEqual({ provider: "mistral", voice: "v-1", model: "voxtral-mini-tts-2603" });
    // A stale ElevenLabs model name on a Mistral row is replaced, not sent.
    expect(choice.readResolvedVoice({ provider: "mistral", voice_id: "v-1", model: "eleven_multilingual_v2" }))
      .toEqual({ provider: "mistral", voice: "v-1", model: "voxtral-mini-tts-2603" });
  });

  it("still refuses a provider it cannot speak with", () => {
    expect(choice.readResolvedVoice({ provider: "openai", voice_id: "alloy" })).toBeNull();
    expect(choice.readResolvedVoice({ provider: "mistral", voice_id: "" })).toBeNull();
  });
});

describe("voice-studio clones with Mistral when ElevenLabs is not configured", () => {
  it("prefers ElevenLabs when its key exists, otherwise Mistral, otherwise a clear refusal", () => {
    const factory = studio.slice(studio.indexOf("function getProvider(): VoiceProvider"));
    expect(factory.indexOf("ELEVENLABS_API_KEY")).toBeLessThan(factory.indexOf("MISTRAL_API_KEY"));
    expect(factory).toContain("return new MistralVoiceProvider(mistralKey);");
    expect(factory).toContain("Voice cloning is not configured");
  });

  it("creates and deletes voices at the endpoints Mistral's SDK uses", () => {
    expect(studio).toContain('fetch("https://api.mistral.ai/v1/audio/voices", {');
    expect(studio).toContain("sample_audio: btoa(binary),");
    expect(studio).toContain("`https://api.mistral.ai/v1/audio/voices/${encodeURIComponent(providerVoiceId)}`");
  });

  it("names the real provider on the job and the profile, so speech and deletion find it", () => {
    expect(studio).toContain("provider: providerName,");
    expect(studio).not.toContain('provider: "elevenlabs",\n');
    expect(studio).toMatch(/provider:\s+provider\.name,\s+provider_model:\s+provider\.model,/);
    expect(studio).toContain('profile.provider === "mistral"');
  });

  it("never returns Mistral's error body, only its status", () => {
    const provider = studio.slice(studio.indexOf("class MistralVoiceProvider"), studio.indexOf("function getProvider(): VoiceProvider"));
    expect(provider).toContain("Mistral voice cloning failed (HTTP ${response.status})");
    expect(provider).not.toMatch(/await response\.text\(\)/);
  });
});
