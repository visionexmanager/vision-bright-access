import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Two faults the Phase 1 live route contract probe found in the Gemini adapter,
// both invisible to a "say OK" smoke test:
//   1. a stream whose first network chunk carried no text never ended;
//   2. a schema with a field named "title" (every generator's plan) lost that
//      field while `required` still named it, so Gemini answered 400.

const env: Record<string, string | undefined> = { GEMINI_API_KEY: "g-test" };
beforeEach(() => vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }));
afterEach(() => vi.unstubAllGlobals());
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const gemini = await import("../../supabase/functions/_shared/geminiProvider.ts");
const { GENERATION_SCHEMA } = await import("../../supabase/functions/_shared/generators.ts");

/** A response body delivered as exactly these network chunks. */
function chunked(parts: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(encoder.encode(p));
      controller.close();
    },
  }));
}

const event = (text: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  // Bounded: a stall fails the test instead of hanging the suite.
  const read = new Response(stream).text();
  const stall = new Promise<string>((_, reject) => setTimeout(() => reject(new Error("stream stalled")), 2000));
  return Promise.race([read, stall]);
}

describe("Gemini streaming", () => {
  it("keeps reading past chunks that carry no text, and ends", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => chunked([
      ": keep-alive\n",                                   // no data line at all
      `data: ${JSON.stringify({ candidates: [{ content: { role: "model" } }] })}\n\n`, // an event with no text
      event("Hel").slice(0, 10),                          // half a line
      event("Hel").slice(10) + event("lo"),
    ])));
    const out = await readAll(await gemini.geminiStreamChatCompletion({
      model: "gemini-flash-lite-latest", system: "s", messages: [{ role: "user", content: "hi" }],
    }));
    const text = out.split("\n").filter((l) => l.startsWith("data: {"))
      .map((l) => JSON.parse(l.slice(6)).choices[0].delta.content).join("");
    expect(text).toBe("Hello");
    expect(out.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("ends a stream that never carried any text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => chunked([": keep-alive\n", ": keep-alive\n"])));
    const out = await readAll(await gemini.geminiStreamChatCompletion({
      model: "gemini-flash-lite-latest", system: "s", messages: [{ role: "user", content: "hi" }],
    }));
    expect(out.trim()).toBe("data: [DONE]");
  });
});

describe("Gemini structured output", () => {
  it("sends every required field of the generator schema, including the one named title", async () => {
    const sent: Array<Record<string, any>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }));
    }));
    await gemini.geminiStructuredCompletion({
      model: "gemini-flash-lite-latest", system: "s", userText: "u", schema: GENERATION_SCHEMA as unknown as Record<string, unknown>,
    });
    const schema = sent[0].generationConfig.responseSchema;
    for (const field of schema.required) expect(Object.keys(schema.properties), field).toContain(field);
    expect(schema.properties.title).toEqual({ type: "string" });
    // Keywords Gemini refuses are still removed.
    expect(JSON.stringify(schema)).not.toContain("additionalProperties");
  });
});
