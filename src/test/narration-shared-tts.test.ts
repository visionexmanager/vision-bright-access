// Phase 2G: `library-generate-narration` synthesises through the shared
// `_shared/voice/tts.ts` instead of its own fetch to OpenAI — and OpenAI
// receives exactly the request it always did.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { synthesize, ttsRequestFor } from "../../supabase/functions/_shared/voice/tts.ts";

const src = readFileSync("supabase/functions/library-generate-narration/index.ts", "utf8");

/** What the function sent before Phase 2G, copied from its removed fetch. */
function legacyRequest(apiKey: string, text: string, voice: string, instructions: string, speed: number) {
  return {
    url: "https://api.openai.com/v1/audio/speech",
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: { model: "gpt-4o-mini-tts", input: text, voice, instructions, speed, response_format: "mp3" },
  };
}

/** The request the function now makes, as the shared module builds it. */
function sharedRequest(apiKey: string, text: string, voice: string, instructions: string, speed: number) {
  const { url, init } = ttsRequestFor(
    { text, provider: "openai", model: "gpt-4o-mini-tts", voice, format: "mp3", speed, instructions },
    apiKey,
  );
  return { url, method: init.method, headers: init.headers, body: JSON.parse(String(init.body)) };
}

describe("the request OpenAI receives is unchanged", () => {
  // Every speed the function can produce: it clamps to [0.5, 2] before this.
  const cases: Array<[string, number]> = [
    ["onyx", 0.5], ["nova", 1], ["fable", 2], ["coral", 1.25], ["shimmer", 0.75],
  ];
  const instructions =
    "Narrate this audiobook chapter clearly and naturally, like a professional audiobook narrator. " +
    "Use a Levantine accent. Speak with a warm tone. Use natural pauses between sentences and paragraphs.";

  for (const [voice, speed] of cases) {
    it(`voice ${voice} at speed ${speed}`, () => {
      const text = "الفصل الأول. كان يا ما كان.\nIt was a quiet morning.";
      expect(sharedRequest("sk-test", text, voice, instructions, speed))
        .toEqual(legacyRequest("sk-test", text, voice, instructions, speed));
    });
  }
});

describe("synthesize, as the function calls it", () => {
  const request = {
    text: "Chapter one.",
    provider: "openai" as const,
    model: "gpt-4o-mini-tts",
    voice: "fable",
    format: "mp3" as const,
    speed: 1,
    instructions: "Narrate.",
    read: (name: string) => (name === "OPENAI_API_KEY" ? "sk-test" : undefined),
  };

  it("returns the audio bytes exactly as OpenAI sent them", async () => {
    const audio = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
    const fetchImpl = vi.fn(async () => new Response(audio, { status: 200 }));
    const result = await synthesize({ ...request, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result.outcome).toBe("audio");
    if (result.outcome === "audio") {
      expect([...result.bytes]).toEqual([...audio]);
      expect(result.mimeType).toBe("audio/mpeg");
    }
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("classifies a rejection with its status, which the function reports", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { message: "bad" } }), { status: 400 }));
    const result = await synthesize({ ...request, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toMatchObject({ outcome: "failed", failure: { reason: "rejected", status: 400 } });
  });

  it("refuses an empty body instead of storing a silent audio file", async () => {
    const fetchImpl = vi.fn(async () => new Response(new Uint8Array(0), { status: 200 }));
    const result = await synthesize({ ...request, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toMatchObject({ outcome: "failed", failure: { reason: "empty" } });
  });

  it("never calls the network without a key", async () => {
    const fetchImpl = vi.fn();
    const result = await synthesize({ ...request, read: () => undefined, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toMatchObject({ outcome: "failed", failure: { reason: "no_key" } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("library-generate-narration's wiring", () => {
  it("has no fetch of its own to OpenAI", () => {
    expect(src).not.toContain("api.openai.com");
    expect(src).not.toMatch(/\bfetch\(/);
  });

  it("goes through the shared module with the model, format and options it always used", () => {
    expect(src).toContain('from "../_shared/voice/tts.ts"');
    const call = src.slice(src.indexOf("await synthesize({"), src.indexOf("await synthesize({") + 250);
    expect(call).toContain('provider: "openai"');
    expect(call).toContain('model: "gpt-4o-mini-tts"');
    expect(call).toContain('format: "mp3"');
    expect(call).toMatch(/\bspeed,/);
    expect(call).toMatch(/\binstructions,/);
  });

  it("logs the provider's detail and tells the caller only the status", () => {
    expect(src).toContain("describeTtsFailure(result.failure)");
    expect(src).toMatch(/throw new Error\(`Narration synthesis failed \(\$\{status\}\)`\)/);
  });

  it("keeps the rest of its policy: chunking, voices, speed clamp, rate limit and owner gate", () => {
    expect(src).toContain("const CHUNK_TARGET_CHARS = 3900;");
    expect(src).toContain("const MAX_CHAPTER_CHARS = 48000;");
    expect(src).toContain("Math.min(2, Math.max(0.5, body.speed ?? 1))");
    expect(src).toContain('_function_name: "library-generate-narration"');
    expect(src).toContain('rpc("is_library_book_owner"');
  });
});
