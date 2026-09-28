import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The Image Studio tools on OpenAI's image edit while Replicate is parked.
//
// Every mode used to answer "unavailable": Replicate has no token and is
// parked. gpt-image-1's edit endpoint genuinely performs four of the five
// modes; upscaling it cannot (it redraws at most 1536 px), so that one is still
// refused rather than faked. These pin the request each mode sends, the
// failures, and the handler's order: refuse before charging, own uploads only,
// the result in the studio's bucket, no VX.

vi.stubGlobal("Deno", { env: { get: (k: string) => (k === "OPENAI_API_KEY" ? "sk-test" : undefined) } });
const edit = await import("../../supabase/functions/_shared/providers/openaiImageEdit.ts");

const handler = (() => {
  const s = readFileSync("supabase/functions/image-tools-generate/index.ts", "utf8");
  return s.slice(s.indexOf("Deno.serve("));
})();
const PNG_B64 = btoa("\x89PNG\r\n\x1a\n" + "x".repeat(64));

function captureFetch(respond: () => Response) {
  const sent: Array<{ url: string; form: FormData; auth: string | null }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), form: init.body as FormData, auth: new Headers(init.headers).get("Authorization") });
    return respond();
  }));
  return sent;
}

beforeEach(() => vi.stubGlobal("Deno", { env: { get: (k: string) => (k === "OPENAI_API_KEY" ? "sk-test" : undefined) } }));
afterEach(() => vi.unstubAllGlobals());

describe("which modes OpenAI serves", () => {
  it("the four it genuinely performs; never upscale", () => {
    expect([...edit.OPENAI_MODES].sort()).toEqual(["avatar", "bg-remove", "img2img", "restore"]);
    expect(edit.OPENAI_MODES.has("upscale")).toBe(false);
  });

  it("refuses upscale without calling anything", async () => {
    const sent = captureFetch(() => new Response("{}"));
    expect(await edit.editWithOpenAI("upscale", new Blob([], { type: "image/png" }), undefined)).toEqual({ ok: false, error: "openai edit unsupported upscale" });
    expect(sent).toEqual([]);
  });
});

describe("the request each mode sends", () => {
  for (const mode of ["img2img", "avatar", "bg-remove", "restore"] as const) {
    it(`${mode}: gpt-image-1, size auto, medium quality, PNG out`, async () => {
      const sent = captureFetch(() => new Response(JSON.stringify({ data: [{ b64_json: PNG_B64 }] })));
      const out = await edit.editWithOpenAI(mode, new Blob([new Uint8Array(8)], { type: "image/jpeg" }), mode === "img2img" ? "make it brighter" : undefined);
      expect(out.ok).toBe(true);
      expect(sent).toHaveLength(1);
      const { url, form, auth } = sent[0];
      expect(url).toBe("https://api.openai.com/v1/images/edits");
      expect(auth).toBe("Bearer sk-test");
      expect(form.get("model")).toBe("gpt-image-1");
      expect(form.get("size")).toBe("auto");
      expect(form.get("quality")).toBe("medium");
      expect(form.get("output_format")).toBe("png");
      expect((form.get("image") as File).name).toBe("source.jpg");
      expect(form.get("background")).toBe(mode === "bg-remove" ? "transparent" : null);
      expect(form.get("prompt")).toBe(edit.openaiEditPrompt(mode, mode === "img2img" ? "make it brighter" : undefined));
      expect(String(form.get("prompt")).length).toBeGreaterThan(10);
    });
  }

  it("the caller's prompt leads img2img and avatar; bg-remove and restore use their own instruction", () => {
    expect(edit.openaiEditPrompt("img2img", "watercolour style")).toBe("watercolour style");
    expect(edit.openaiEditPrompt("avatar", "a pilot")).toMatch(/^a pilot\. A portrait avatar/);
    expect(edit.openaiEditPrompt("bg-remove", "ignored")).toMatch(/^Remove the background completely/);
    expect(edit.openaiEditPrompt("restore", "ignored")).toMatch(/^Restore this photo/);
  });

  it("returns the image's bytes", async () => {
    captureFetch(() => new Response(JSON.stringify({ data: [{ b64_json: PNG_B64 }] })));
    const out = await edit.editWithOpenAI("restore", new Blob([new Uint8Array(8)], { type: "image/png" }), undefined);
    expect(out.ok && out.bytes[1]).toBe(0x50); // "P" of the PNG signature
  });
});

describe("failures are short reasons, never the provider's sentence", () => {
  const blob = () => new Blob([new Uint8Array(8)], { type: "image/png" });
  for (const status of [400, 401, 403, 404, 408, 429, 500, 503]) {
    it(`HTTP ${status}`, async () => {
      captureFetch(() => new Response("the provider's own words about your prompt", { status }));
      expect(await edit.editWithOpenAI("img2img", blob(), "p")).toEqual({ ok: false, error: `openai edit ${status}` });
    });
  }
  it("a safety refusal is named as such, so the user is told to change the prompt", async () => {
    captureFetch(() => new Response('{"error":{"code":"moderation_blocked","message":"Your request was rejected by the safety system."}}', { status: 400 }));
    expect(await edit.editWithOpenAI("img2img", blob(), "p")).toEqual({ ok: false, error: "content policy" });
  });
  it("a malformed or empty answer", async () => {
    captureFetch(() => new Response("not json"));
    expect(await edit.editWithOpenAI("img2img", blob(), "p")).toEqual({ ok: false, error: "openai edit empty" });
    captureFetch(() => new Response(JSON.stringify({ data: [] })));
    expect(await edit.editWithOpenAI("img2img", blob(), "p")).toEqual({ ok: false, error: "openai edit empty" });
  });
  it("a provider that never answers is abandoned at the deadline", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));
    expect(await edit.editWithOpenAI("img2img", blob(), "p", { timeoutMs: 20 })).toEqual({ ok: false, error: "openai edit timeout" });
  });
  it("a network failure is not called a timeout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await edit.editWithOpenAI("img2img", blob(), "p")).toEqual({ ok: false, error: "openai edit network" });
  });
  it("no key: not configured, and nothing sent", async () => {
    const sent = captureFetch(() => new Response("{}"));
    expect(await edit.editWithOpenAI("img2img", blob(), "p", { read: () => undefined })).toEqual({ ok: false, error: "OPENAI_API_KEY is not configured" });
    expect(sent).toEqual([]);
  });
});

describe("the handler", () => {
  it("reads the source from the caller's own upload, after the ownership check", () => {
    const run = handler.slice(handler.indexOf("async function runOpenAIJob"));
    expect(run).toContain('serviceClient.storage.from("image-tool-inputs").download(sourcePath)');
    expect(handler.indexOf('isOwnStorageUpload(image_url, supabaseUrl, "image-tool-inputs", user.id)'))
      .toBeLessThan(handler.indexOf("if (provider === \"openai\") return await runOpenAIJob(jobId);"));
    expect(run).toContain("source.size > MAX_SOURCE_BYTES");
  });

  it("stores the result in the studio's bucket under the owner's folder, linked by a signed URL", () => {
    const run = handler.slice(handler.indexOf("async function runOpenAIJob"));
    expect(run).toContain("const objectPath = `${user!.id}/tools-${id}.png`;");
    expect(run).toContain('.from("image-outputs")');
    expect(run).toContain("createSignedUrl(objectPath, 60 * 60 * 24 * 7)");
    expect(run).toMatch(/status: "completed", image_url: imageUrl/);
  });

  it("charges nothing but the daily request unit: no VX, no reservation", () => {
    const s = readFileSync("supabase/functions/image-tools-generate/index.ts", "utf8");
    expect(s).not.toMatch(/vx_reserve|vx_settle|billedRequest|spend_vx|user_points/);
    expect(handler.match(/chargeDailyLimit\(/g)).toHaveLength(1);
  });

  it("the live probe calls this exact edit, and runs again whenever it changes", () => {
    const probe = readFileSync("scripts/ai-eval/live-route-contract.ts", "utf8");
    expect(probe).toContain('import { editWithOpenAI } from "../../supabase/functions/_shared/providers/openaiImageEdit.ts";');
    expect(probe).toContain("await run(`image tool ${mode}`");
    expect(readFileSync(".github/workflows/live-route-contract.yml", "utf8")).toContain("supabase/functions/_shared/providers/openaiImageEdit.ts");
  });

  it("logs the mode, provider, model, outcome and time — no prompt, no key", () => {
    expect(handler).toContain("console.info(`[image-tools-generate] mode=${mode} provider=openai model=${OPENAI_EDIT_MODEL} ok=${edited.ok} ms=${Date.now() - started}`);");
  });
});
