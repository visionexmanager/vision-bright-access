import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A WhatsApp video, read on OpenAI: a sheet of frames from the media processor
// for a vision model, and a transcript of what is said. Before this, every
// clip got "I can't watch videos" — the only reader was Gemini, unfunded.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
vi.mock("../../supabase/functions/_shared/whatsappPdfText.ts", () => ({ extractPdfText: async () => null }));
vi.mock("../../supabase/functions/_shared/whatsappOffice.ts", () => ({ readOfficeLocally: async () => null }));

// Loaded by a computed path so the app's `tsc -b` does not pull this Deno
// module (and its npm: imports) into its own program; vitest runs it as is.
const UNDERSTAND = "../../supabase/functions/_shared/whatsappUnderstand.ts";
type Heard = (r: { bytes: Uint8Array; mimeType: string }) => Promise<unknown>;
const understand = await import(/* @vite-ignore */ UNDERSTAND) as {
  sheetInterval: (seconds: number | null) => string;
  understandVideo: (p: {
    bytes: Uint8Array; mimeType: string; question: string; languageName: string;
    processor?: { url: string; token: string } | null; fetchImpl?: typeof fetch; transcribeImpl?: Heard;
  }) => Promise<{ readable: boolean; answer: string } | null>;
};
const ai = await import("../../supabase/functions/_shared/aiProvider.ts");

const PROC = { url: "https://media.example", token: "proc-token" };
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const CLIP = new Uint8Array(64);
const answer = (value: unknown) => new Response(JSON.stringify({
  choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(value) } }] } }],
}));

type Call = { url: string; body: string };
function stubFetch(opts: { duration?: number | null; sheet?: "ok" | "fail" } = {}) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, body: typeof init?.body === "string" ? init.body : "" });
    if (u.endsWith("/probe")) return new Response(JSON.stringify({ ok: true, durationSeconds: opts.duration ?? 30, kind: "video" }));
    if (u.includes("/convert?")) {
      return opts.sheet === "fail"
        ? new Response(JSON.stringify({ reason: "conversion_failed" }), { status: 422 })
        : new Response(JPEG, { headers: { "content-type": "image/jpeg" } });
    }
    return answer({ readable: true, answer: "The clip shows a login screen and the person says the code expired." });
  });
  vi.stubGlobal("fetch", fetchImpl);
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}
const heard = (text: string) => async () => ({ outcome: "transcript" as const, text, provider: "openai" as const, model: "whisper-1", ms: 5, attempts: [] });
const unheard = async () => ({ outcome: "failed" as const, failure: { kind: "no_speech" } as never, attempts: [] });

beforeEach(() => { ai.resetProviderCooldowns(); ai.setProviderRegistryView(null); });
afterEach(() => { vi.restoreAllMocks(); vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }); });

describe("the frame sheet's spacing", () => {
  it("spreads six frames across the clip, within the processor's bounds", () => {
    expect(understand.sheetInterval(30)).toBe("5");
    expect(understand.sheetInterval(null)).toBe("2"); // unknown length: twelve seconds
    expect(understand.sheetInterval(1)).toBe("0.5");
    expect(understand.sheetInterval(100_000)).toBe("600");
  });
});

describe("reading a clip with no provider that takes video whole", () => {
  it("frames and speech: one vision call carrying the sheet and the transcript", async () => {
    const { calls, fetchImpl } = stubFetch({ duration: 30 });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const out = await understand.understandVideo({
      bytes: CLIP, mimeType: "video/mp4", question: "What is wrong here?", languageName: "English",
      processor: PROC, fetchImpl, transcribeImpl: heard("my code has expired and I cannot log in"),
    });
    expect(out).toEqual({ readable: true, answer: "The clip shows a login screen and the person says the code expired." });
    expect(calls.map((c) => c.url.replace(/\?.*/, ""))).toEqual(["https://media.example/probe", "https://media.example/convert", "https://api.openai.com/v1/chat/completions"]);
    expect(calls[1].url).toBe("https://media.example/convert?to=jpg&sheet=5&quality=balanced");
    const request = JSON.parse(calls[2].body);
    expect(request.model).toBe("gpt-4o-mini");
    const text = JSON.stringify(request.messages);
    expect(text).toContain("data:image/jpeg;base64,");
    expect(text).toContain("one every 5 seconds");
    expect(text).toContain("my code has expired and I cannot log in");
    // The log carries codes and sizes, never what was said.
    const logged = info.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logged).toMatch(/\[whatsapp-video\] frames=yes speech=\d+ch interval=5s/);
    expect(logged).not.toContain("expired");
  });

  it("speech only (no processor): a text call that says it could not see the clip", async () => {
    const { calls } = stubFetch();
    const out = await understand.understandVideo({
      bytes: CLIP, mimeType: "video/mp4", question: "", languageName: "English",
      processor: null, transcribeImpl: heard("please cancel my order"),
    });
    expect(out?.readable).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(["https://api.openai.com/v1/chat/completions"]);
    const text = JSON.stringify(JSON.parse(calls[0].body).messages);
    expect(text).not.toContain("data:image");
    expect(text).toContain("No frames could be taken from the clip");
    expect(text).toContain("please cancel my order");
  });

  it("frames only (nothing said): a vision call told to answer from the frames", async () => {
    const { calls, fetchImpl } = stubFetch({ duration: 12 });
    await understand.understandVideo({
      bytes: CLIP, mimeType: "video/mp4", question: "", languageName: "Arabic",
      processor: PROC, fetchImpl, transcribeImpl: unheard,
    });
    const text = JSON.stringify(JSON.parse(calls.at(-1)!.body).messages);
    expect(text).toContain("data:image/jpeg;base64,");
    expect(text).toContain("Nothing said in the clip could be transcribed");
  });

  it("neither frames nor speech: null, and no model is asked to guess", async () => {
    const { calls, fetchImpl } = stubFetch({ sheet: "fail" });
    const out = await understand.understandVideo({
      bytes: CLIP, mimeType: "video/mp4", question: "", languageName: "English",
      processor: PROC, fetchImpl, transcribeImpl: unheard,
    });
    expect(out).toBeNull();
    expect(calls.some((c) => c.url.includes("api.openai.com"))).toBe(false);
  });

  it("a model that fails: null, never an invented answer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push(String(url)); return new Response("{}", { status: 500 }); }));
    const out = await understand.understandVideo({
      bytes: CLIP, mimeType: "video/mp4", question: "", languageName: "English",
      processor: null, transcribeImpl: heard("hello"),
    });
    expect(out).toBeNull();
  });
});

describe("the webhook and the availability flag", () => {
  const source = readFileSync("supabase/functions/_shared/whatsappUnderstand.ts", "utf8");
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("video is readable whenever frames or speech can be had", () => {
    expect(source).toContain("export const VIDEO_READING_AVAILABLE = VIDEO_TARGETS.length > 0 || processorAvailable() ||");
    expect(source).toContain('!!(denoEnv("OPENAI_API_KEY")?.trim() || denoEnv("GROQ_API_KEY")?.trim());');
  });

  it("the webhook still refuses before downloading when nothing can read a video, and caps the size before paying", () => {
    const branch = webhook.slice(webhook.indexOf('} else if (incoming.media.kind === "video") {'));
    expect(branch.indexOf("VIDEO_READING_AVAILABLE")).toBeLessThan(branch.indexOf("downloadMedia"));
    expect(branch.indexOf("MAX_VIDEO_BYTES")).toBeLessThan(branch.indexOf("understandVideo({"));
  });
});
