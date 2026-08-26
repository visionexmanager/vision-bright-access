// The shared text-to-speech seam.
//
// Four call sites used to synthesise speech independently. This is the contract
// they now share, and what it has to keep true is not "TTS works" — it is that
// each caller's *existing* request still goes out byte for byte. So most of
// what follows inspects the request the seam builds rather than the audio it
// returns: a body that gains a field, or a model that drifts to a default, is
// exactly the kind of silent behaviour change this phase promised not to make.
//
// No provider is ever called: `fetchImpl` and `read` are injected.

import { describe, expect, it, vi } from "vitest";

const tts = await import("../../supabase/functions/_shared/voice/tts.ts");

const KEYS = (name: string) =>
  name === "OPENAI_API_KEY" ? "openai-key" : name === "ELEVENLABS_API_KEY" ? "eleven-key" : undefined;

/** A provider that answers with audio, and records what it was asked. */
function recorder(bytes = new Uint8Array([1, 2, 3]), status = 200) {
  const calls: Array<{ url: string; init: RequestInit; body: Record<string, unknown> }> = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
    return Promise.resolve(
      status === 200
        ? new Response(bytes, { status: 200 })
        : new Response(JSON.stringify({ error: { message: "nope" } }), { status }),
    );
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("what each caller asks for", () => {
  it("sends the WhatsApp voice reply's request unchanged", async () => {
    const rec = recorder();
    await tts.synthesize({
      text: "hello", provider: "openai", model: "tts-1", voice: "alloy",
      format: "opus", fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(rec.calls[0].url).toBe("https://api.openai.com/v1/audio/speech");
    expect(rec.calls[0].body).toEqual({
      model: "tts-1", input: "hello", voice: "alloy", response_format: "opus",
    });
    // The WhatsApp path has never sent these, and must not start.
    expect(rec.calls[0].body).not.toHaveProperty("speed");
    expect(rec.calls[0].body).not.toHaveProperty("instructions");
  });

  it("sends the assistant voices' request unchanged, style instructions included", async () => {
    const rec = recorder();
    await tts.synthesize({
      text: "hello", provider: "openai", model: "gpt-4o-mini-tts", voice: "nova",
      instructions: "Speak warmly.", format: "mp3", fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(rec.calls[0].body).toEqual({
      model: "gpt-4o-mini-tts", input: "hello", voice: "nova",
      response_format: "mp3", instructions: "Speak warmly.",
    });
  });

  it("sends the studio's request unchanged, speed clamped as before", async () => {
    const rec = recorder();
    await tts.synthesize({
      text: "hello", provider: "openai", model: "tts-1", voice: "shimmer",
      format: "wav", speed: 9, fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(rec.calls[0].body.speed).toBe(4);
    expect(rec.calls[0].body.response_format).toBe("wav");

    const slow = recorder();
    await tts.synthesize({
      text: "hello", provider: "openai", model: "tts-1", voice: "shimmer",
      format: "mp3", speed: 0.1, fetchImpl: slow.fetchImpl, read: KEYS,
    });
    expect(slow.calls[0].body.speed).toBe(0.25);
  });

  it("sends ElevenLabs to the voice's own URL, with its own clamp", async () => {
    const rec = recorder();
    await tts.synthesize({
      text: "hello", provider: "elevenlabs", model: "eleven_multilingual_v2",
      voice: "voice/id needing encoding", format: "mp3", speed: 5,
      fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(rec.calls[0].url).toContain("voice%2Fid%20needing%20encoding");
    expect(rec.calls[0].url).toContain("output_format=mp3_44100_128");
    expect(rec.calls[0].init.headers).toMatchObject({ "xi-api-key": "eleven-key" });
    expect(rec.calls[0].body.model_id).toBe("eleven_multilingual_v2");
    expect((rec.calls[0].body.voice_settings as { speed: number }).speed).toBe(1.2);
  });

  it("keeps the rule that `tts-1` reaching ElevenLabs means its own default", () => {
    // Preserved from `speech-generate`, where the shared config carries the
    // OpenAI default model even when the chosen provider is ElevenLabs.
    const { init } = tts.ttsRequestFor({
      text: "x", provider: "elevenlabs", model: "tts-1", voice: "v", format: "mp3",
    }, "k");
    expect(JSON.parse(String(init.body)).model_id).toBe("eleven_multilingual_v2");
  });

  it("asks ElevenLabs for pcm only when wav was requested", () => {
    const wav = tts.ttsRequestFor({ text: "x", provider: "elevenlabs", model: "m", voice: "v", format: "wav" }, "k");
    expect(wav.url).toContain("output_format=pcm_16000");
  });
});

describe("what comes back", () => {
  it("labels OpenAI opus as the OGG container WhatsApp expects", async () => {
    const rec = recorder();
    const result = await tts.synthesize({
      text: "hello", provider: "openai", model: "tts-1", voice: "alloy",
      format: "opus", fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(result.outcome).toBe("audio");
    if (result.outcome !== "audio") return;
    expect(result.mimeType).toBe("audio/ogg");
    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(result).toMatchObject({ provider: "openai", model: "tts-1", voice: "alloy" });
  });

  it("labels each format the way the callers already labelled it", () => {
    expect(tts.mimeFor("openai", "mp3")).toBe("audio/mpeg");
    expect(tts.mimeFor("openai", "wav")).toBe("audio/wav");
    expect(tts.mimeFor("openai", "flac")).toBe("audio/flac");
    expect(tts.mimeFor("openai", "aac")).toBe("audio/aac");
    expect(tts.mimeFor("elevenlabs", "mp3")).toBe("audio/mpeg");
    expect(tts.mimeFor("elevenlabs", "wav")).toBe("audio/wav");
    // Carried over rather than corrected: ElevenLabs returns mp3 bytes here.
    expect(tts.mimeFor("elevenlabs", "ogg")).toBe("audio/ogg");
  });
});

describe("when it fails", () => {
  it("refuses empty text before spending a request", async () => {
    const rec = recorder();
    const result = await tts.synthesize({
      text: "   ", provider: "openai", model: "tts-1", voice: "alloy",
      format: "mp3", fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(result).toEqual({ outcome: "failed", failure: { reason: "invalid_input" } });
    expect(rec.calls).toHaveLength(0);
  });

  it("names the missing key, per provider", async () => {
    for (const provider of ["openai", "elevenlabs"] as const) {
      const result = await tts.synthesize({
        text: "hello", provider, model: "m", voice: "v", format: "mp3",
        fetchImpl: recorder().fetchImpl, read: () => undefined,
      });
      expect(result).toEqual({ outcome: "failed", failure: { reason: "no_key", provider } });
    }
  });

  it("classifies a rejection with its status and the provider's own detail", async () => {
    const rec = recorder(new Uint8Array(), 429);
    const result = await tts.synthesize({
      text: "hello", provider: "openai", model: "tts-1", voice: "alloy",
      format: "mp3", fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(result.outcome).toBe("failed");
    if (result.outcome !== "failed") return;
    expect(result.failure).toMatchObject({ reason: "rejected", status: 429, detail: "nope" });
  });

  it("tells an empty body apart from a transport fault", async () => {
    const empty = await tts.synthesize({
      text: "hello", provider: "openai", model: "tts-1", voice: "alloy", format: "mp3",
      read: KEYS,
      fetchImpl: (() => Promise.resolve(new Response(new Uint8Array(), { status: 200 }))) as unknown as typeof fetch,
    });
    expect(empty).toEqual({ outcome: "failed", failure: { reason: "empty", provider: "openai" } });

    const broken = await tts.synthesize({
      text: "hello", provider: "openai", model: "tts-1", voice: "alloy", format: "mp3",
      read: KEYS,
      fetchImpl: (() => Promise.reject(new Error("socket"))) as unknown as typeof fetch,
    });
    expect(broken).toEqual({ outcome: "failed", failure: { reason: "transport", provider: "openai" } });
  });

  it("keeps the sentences the studio has always shown", () => {
    // These are read by a person on the Speech Studio screen, so the wording is
    // carried over from `speech-generate` unchanged.
    expect(tts.describeTtsFailure({ reason: "no_key", provider: "openai" }))
      .toBe("OPENAI_API_KEY not configured");
    expect(tts.describeTtsFailure({ reason: "no_key", provider: "elevenlabs" }))
      .toContain("Project Settings → Edge Functions → Secrets");
    expect(tts.describeTtsFailure({ reason: "rejected", provider: "openai", status: 429, detail: "x" }))
      .toBe("OpenAI rate limit reached. Please wait a moment and try again.");
    expect(tts.describeTtsFailure({ reason: "rejected", provider: "elevenlabs", status: 404, detail: "x" }))
      .toContain("no longer exists on ElevenLabs");
    expect(tts.describeTtsFailure({ reason: "rejected", provider: "openai", status: 418, detail: "teapot" }))
      .toBe("OpenAI TTS error (418): teapot");
    expect(tts.describeTtsFailure({ reason: "rejected", provider: "elevenlabs", status: 422, detail: "bad" }))
      .toBe("Invalid request to ElevenLabs: bad");
  });
});

describe("streaming, for the caller that streams", () => {
  it("hands back an unread body on success", async () => {
    const rec = recorder(new Uint8Array([9, 9]));
    const call = await tts.synthesizeResponse({
      text: "hello", provider: "openai", model: "gpt-4o-mini-tts", voice: "nova",
      format: "mp3", fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(call.outcome).toBe("response");
    if (call.outcome !== "response") return;
    expect(call.response.bodyUsed).toBe(false);
    expect(new Uint8Array(await call.response.arrayBuffer())).toEqual(new Uint8Array([9, 9]));
  });

  it("classifies a failure without the caller touching the body", async () => {
    const rec = recorder(new Uint8Array(), 503);
    const call = await tts.synthesizeResponse({
      text: "hello", provider: "openai", model: "gpt-4o-mini-tts", voice: "nova",
      format: "mp3", fetchImpl: rec.fetchImpl, read: KEYS,
    });
    expect(call.outcome).toBe("failed");
    if (call.outcome !== "failed") return;
    expect(call.failure).toMatchObject({ reason: "rejected", status: 503 });
  });
});

describe("the callers still behave as they did", () => {
  it("keeps the WhatsApp reply silent on failure, and logs the same four lines", async () => {
    const voice = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    // `synthesiseSpeech` reads the key through the same `Deno.env` probe it
    // always did, and there is no `Deno` under Vitest — so without this stub it
    // short-circuits on the missing key and never reaches the branches under
    // test. Standing one in is what lets the other three be exercised; no
    // provider is called either way.
    const original = (globalThis as { Deno?: unknown }).Deno;
    (globalThis as { Deno?: unknown }).Deno = { env: { get: () => "test-key" } };

    const missing = await voice.synthesiseSpeech({
      text: "hello",
      fetchImpl: (() => Promise.reject(new Error("unused"))) as unknown as typeof fetch,
    });
    expect(missing).toEqual({ ok: false });

    const rejected = await voice.synthesiseSpeech({
      text: "hello",
      fetchImpl: (() => Promise.resolve(new Response("no", { status: 500 }))) as unknown as typeof fetch,
    });
    expect(rejected).toEqual({ ok: false });
    expect(error.mock.calls.some((c) => String(c[0]).includes("synthesis rejected"))).toBe(true);

    const broken = await voice.synthesiseSpeech({
      text: "hello",
      fetchImpl: (() => Promise.reject(new Error("x"))) as unknown as typeof fetch,
    });
    expect(broken).toEqual({ ok: false });
    expect(error.mock.calls.some((c) => String(c[0]).includes("transport error"))).toBe(true);

    // No line names the sender or the words being spoken.
    for (const call of error.mock.calls.flat()) {
      expect(String(call)).not.toContain("hello");
    }

    // And the branch that runs in production when the key really is absent.
    (globalThis as { Deno?: unknown }).Deno = original;
    error.mockClear();
    const noKey = await voice.synthesiseSpeech({
      text: "hello",
      fetchImpl: (() => Promise.reject(new Error("unused"))) as unknown as typeof fetch,
    });
    expect(noKey).toEqual({ ok: false });
    expect(error.mock.calls.some((c) => String(c[0]).includes("no OPENAI_API_KEY"))).toBe(true);
    error.mockRestore();
  });

  it("keeps the model and voice the cache key is built from", async () => {
    const voice = await import("../../supabase/functions/_shared/whatsappVoiceReply.ts");
    expect(voice.SPEECH_MODEL).toBe("tts-1");
    expect(voice.DEFAULT_VOICE).toBe("alloy");
  });
});
