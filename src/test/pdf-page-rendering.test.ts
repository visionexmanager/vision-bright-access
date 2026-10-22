// A scanned PDF, shown to a vision model as pictures rendered on our own server.
//
// Three layers, each tested where it lives: the processor's pure rules (what it
// accepts and returns), the edge client's validation of what comes back, and the
// reader's order of attempts (pictures first, the file as before when that does
// not produce a real reading). The rendering itself needs poppler, which is not
// installed on a development machine; it is proven by the deploy workflow's
// self-test against the real container, and nothing here claims otherwise.

import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test", ANTHROPIC_API_KEY: "ak-test", GEMINI_API_KEY: "gk-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
vi.mock("../../supabase/functions/_shared/whatsappPdfText.ts", () => ({ extractPdfText: async () => ({ ok: false, reason: "scanned" }) }));
vi.mock("../../supabase/functions/_shared/whatsappOffice.ts", () => ({ readOfficeLocally: async () => null }));

const pages = await import("../../services/media-processor/src/pdfpages.mjs");
const CLIENT = "../../supabase/functions/_shared/whatsappPdfPages.ts";
const client = await import(/* @vite-ignore */ CLIENT) as typeof import("../../supabase/functions/_shared/whatsappPdfPages.ts");
const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
const UNDERSTAND = "../../supabase/functions/_shared/whatsappUnderstand.ts";
type DocResult = { ok: true; value: { readable: boolean; answer: string } } | { ok: false; reason: string };
const understand = await import(/* @vite-ignore */ UNDERSTAND) as {
  readScannedPdf: (p: {
    bytes: Uint8Array; userText: string; languageName: string;
    targets?: Array<{ provider: string; model: string }>;
    renderPages?: (p: { bytes: Uint8Array }) => Promise<unknown>;
  }) => Promise<DocResult>;
};

const PDF = new TextEncoder().encode("%PDF-1.4 scan");
const JPEG_B64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBD"; // starts FF D8 FF
const CONFIG = { url: "https://visionex.app/internal/media", token: "t0ken" };

describe("what the processor accepts", () => {
  it("recognises a PDF by its bytes, even with junk before the header, and refuses the rest", () => {
    expect(pages.looksLikePdf(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true);
    expect(pages.looksLikePdf(new TextEncoder().encode("\u0000\u0000junk%PDF-1.4\n"))).toBe(true);
    expect(pages.looksLikePdf(new TextEncoder().encode("PK\u0003\u0004 not a pdf at all"))).toBe(false);
    expect(pages.looksLikePdf(new Uint8Array(0))).toBe(false);
    expect(pages.checkPdfUpload(new Uint8Array(0))).toEqual({ ok: false, reason: "empty" });
    expect(pages.checkPdfUpload(new Uint8Array(pages.MAX_PDF_BYTES + 1))).toEqual({ ok: false, reason: "too_large" });
    expect(pages.checkPdfUpload(new TextEncoder().encode("hello world, not a pdf"))).toEqual({ ok: false, reason: "not_a_pdf" });
    expect(pages.checkPdfUpload(PDF)).toEqual({ ok: true });
  });

  it("clamps the page count to a small integer, because it reaches a command line", () => {
    expect(pages.pagesFromQuery("3")).toBe(3);
    expect(pages.pagesFromQuery("99")).toBe(pages.MAX_PDF_PAGES);
    for (const bad of [null, "", "0", "-1", "3; rm -rf /", "1e3", "٣", "007x", "100"]) {
      expect(pages.pagesFromQuery(bad as string | null), String(bad)).toBeLessThanOrEqual(pages.MAX_PDF_PAGES);
    }
    expect(pages.pagesFromQuery("3; rm -rf /")).toBe(pages.DEFAULT_PDF_PAGES);
    expect(pages.pagesFromQuery("0")).toBe(pages.DEFAULT_PDF_PAGES);
  });

  it("reads the page count from pdfinfo and ignores anything else", () => {
    expect(pages.parsePdfInfo("Title: x\nPages:           12\nEncrypted:      no\n")).toEqual({ pages: 12, encrypted: false });
    expect(pages.parsePdfInfo("Pages: 3\nEncrypted: yes (print:yes copy:no)\n")).toEqual({ pages: 3, encrypted: true });
    expect(pages.parsePdfInfo("nothing useful")).toEqual({ pages: null, encrypted: false });
    expect(pages.parsePdfInfo(undefined)).toEqual({ pages: null, encrypted: false });
  });

  it("keeps real JPEGs in page order within the budget, and drops the rest", () => {
    const jpeg = (n: number) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(n)]);
    const kept = pages.selectPages([
      { n: 1, bytes: jpeg(100) },
      { n: 2, bytes: Buffer.from("not a jpeg at all") },
      { n: 3, bytes: jpeg(pages.MAX_PAGE_JPEG_BYTES + 1) },
      { n: 4, bytes: jpeg(200) },
    ]);
    expect(kept.map((p: { n: number }) => p.n)).toEqual([1, 4]);
    const many = Array.from({ length: 6 }, (_, i) => ({ n: i + 1, bytes: jpeg(800 * 1024) }));
    expect(pages.selectPages(many).length).toBeLessThanOrEqual(5);
    expect(pages.selectPages(many).length).toBeGreaterThan(0);
  });

  it("only treats `out-<n>.jpg` as a page", () => {
    expect(pages.pageNumberOf("out-1.jpg")).toBe(1);
    expect(pages.pageNumberOf("out-03.jpg")).toBe(3);
    for (const bad of ["in", "out.txt", "out-1.jpg.bak", "../out-1.jpg", "out-.jpg"]) expect(pages.pageNumberOf(bad)).toBeNull();
  });
});

describe("the route is wired the way the others are", () => {
  const server = readFileSync("services/media-processor/src/server.mjs", "utf8");
  const docker = readFileSync("services/media-processor/Dockerfile", "utf8");

  it("is authenticated, queued behind the same slots, and advertised in /capabilities", () => {
    // Everything but /health sits behind `authorised(req)` before any route runs.
    expect(server.indexOf("if (!authorised(req))")).toBeLessThan(server.indexOf('url.pathname === "/pdf-pages"'));
    const handler = server.slice(server.indexOf("async function handlePdfPages"), server.indexOf("const MAX_OVERPASS_BODY"));
    expect(handler).toContain("tooBusy(res, correlation)");
    expect(handler).toContain("await acquireSlot()");
    expect(handler).toContain("releaseSlot()");
    expect(server).toContain("pdf_pages: {");
  });

  it("hands arguments to the tools as arrays, never a shell string", () => {
    const handler = server.slice(server.indexOf("async function handlePdfPages"), server.indexOf("const MAX_OVERPASS_BODY"));
    expect(handler).toContain('command: "pdfinfo"');
    expect(handler).toContain('command: "pdftoppm"');
    expect(handler).toContain("build: (input, dir) => [");
    expect(handler).not.toMatch(/exec\(|execSync|shell:\s*true|`[^`]*\$\{[^}]*input/);
  });

  it("bounds the output by pixels, not by a DPI the file could inflate", () => {
    expect(server).toContain('"-scale-to", String(PDF_PAGE_EDGE_PX)');
    expect(server).not.toMatch(/"-r",/);
  });

  it("logs counts and timings, never what a page says", () => {
    const handler = server.slice(server.indexOf("async function handlePdfPages"), server.indexOf("const MAX_OVERPASS_BODY"));
    const logs = [...handler.matchAll(/log\("pdf_pages[a-z_]*", \{[^}]*\}/g)].map((m) => m[0]).join("\n");
    expect(logs.length).toBeGreaterThan(0);
    expect(logs).not.toMatch(/jpeg|base64|text|stdout|stderr/i);
  });

  it("is installed in the image from the distribution's own package", () => {
    expect(docker).toMatch(/poppler-utils/);
  });
});

describe("the edge client validates what the processor returns", () => {
  it("accepts real JPEG pages and numbers the total", () => {
    const r = client.readPdfPagesPayload({ ok: true, total_pages: 9, pages: [{ n: 1, jpeg_base64: JPEG_B64 }, { n: 2, jpeg_base64: JPEG_B64 }] });
    expect(r).toEqual({ ok: true, pages: [`data:image/jpeg;base64,${JPEG_B64}`, `data:image/jpeg;base64,${JPEG_B64}`], totalPages: 9 });
  });

  it("refuses what is not a JPEG, not base64, or oversize, rather than forwarding it to a provider", () => {
    for (const bad of ["AAAA", "/9j/ not base64 !!", `/9j/${"A".repeat(1_400_000)}`, 7, null, "data:image/png;base64,xx"]) {
      expect(client.readPdfPagesPayload({ ok: true, pages: [{ jpeg_base64: bad }] }), String(bad).slice(0, 12)).toEqual({ ok: false, reason: "unreadable" });
    }
    expect(client.readPdfPagesPayload(null)).toEqual({ ok: false, reason: "bad_response" });
    expect(client.readPdfPagesPayload({ ok: true })).toEqual({ ok: false, reason: "bad_response" });
    expect(client.readPdfPagesPayload({ ok: false, reason: "timeout" })).toEqual({ ok: false, reason: "timeout" });
    expect(client.readPdfPagesPayload({ ok: false, reason: "anything" })).toEqual({ ok: false, reason: "unreadable" });
  });

  it("never accepts more than six pages", () => {
    const many = Array.from({ length: 20 }, () => ({ jpeg_base64: JPEG_B64 }));
    const r = client.readPdfPagesPayload({ ok: true, pages: many });
    expect(r.ok && r.pages.length).toBe(6);
  });
});

describe("rendering over the wire", () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("is simply unavailable when the processor is not configured", async () => {
    expect(await client.renderPdfPages({ bytes: PDF, config: null })).toEqual({ ok: false, reason: "not_configured" });
  });

  it("does not send a file larger than the processor takes", async () => {
    const fetchImpl = vi.fn();
    const big = new Uint8Array(client.MAX_PDF_PAGES_UPLOAD_BYTES + 1);
    expect(await client.renderPdfPages({ bytes: big, config: CONFIG, fetchImpl })).toEqual({ ok: false, reason: "too_large" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts the PDF to /pdf-pages with the token, and returns the pages", async () => {
    const fetchImpl = vi.fn(async () => ok({ ok: true, total_pages: 2, pages: [{ n: 1, jpeg_base64: JPEG_B64 }] }));
    const r = await client.renderPdfPages({ bytes: PDF, config: CONFIG, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.ok && r.totalPages).toBe(2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://visionex.app/internal/media/pdf-pages?pages=4");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer t0ken");
    expect((init.headers as Record<string, string>)["content-type"]).toBe("application/pdf");
  });

  it("maps busy, a missing route and a hung service to a reason, and throws nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = (fetchImpl: unknown, timeoutMs?: number) => client.renderPdfPages({ bytes: PDF, config: CONFIG, fetchImpl: fetchImpl as typeof fetch, timeoutMs });
    expect(await run(async () => new Response("", { status: 503 }))).toEqual({ ok: false, reason: "busy" });
    expect(await run(async () => new Response("", { status: 404 }))).toEqual({ ok: false, reason: "error" });
    expect(await run(async () => { throw new Error("connect ECONNREFUSED"); })).toEqual({ ok: false, reason: "error" });
    const hung = (_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    expect(await run(hung, 20)).toEqual({ ok: false, reason: "timeout" });
  });
});

describe("the reader tries pictures first and never does worse than before", () => {
  const sent: Array<Record<string, unknown>> = [];
  const completion = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(value) } }] } }] }));
  const userParts = (body: Record<string, unknown>) =>
    ((body.messages as Array<{ role: string; content: unknown }>).find((m) => m.role === "user")!.content) as Array<Record<string, unknown>>;
  let replies: unknown[] = [];

  beforeEach(() => {
    sent.length = 0;
    replies = [];
    ai.resetProviderCooldowns();
    ai.setProviderRegistryView(null);
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      return completion(replies.shift() ?? { readable: false, answer: "" });
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => { vi.restoreAllMocks(); vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }); });

  const rendered = (n: number, total: number | null = n) => async () => ({
    ok: true as const, totalPages: total, pages: Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,${JPEG_B64}${i}`),
  });
  const read = (renderPages: (p: { bytes: Uint8Array }) => Promise<unknown>, targets?: Array<{ provider: string; model: string }>) =>
    understand.readScannedPdf({ bytes: PDF, userText: "What does it say?", languageName: "English", renderPages, targets });

  it("sends every rendered page as a high-detail image, and no PDF file, when they read", async () => {
    replies = [{ readable: true, answer: "Invoice 42" }];
    expect(await read(rendered(3))).toEqual({ ok: true, value: { readable: true, answer: "Invoice 42" } });
    expect(sent).toHaveLength(1);
    const parts = userParts(sent[0]);
    const images = parts.filter((p) => p.type === "image_url") as Array<{ image_url: { url: string; detail: string } }>;
    expect(images).toHaveLength(3);
    expect(images.every((i) => i.image_url.detail === "high")).toBe(true);
    expect(parts.some((p) => p.type === "file")).toBe(false);
    expect(String(parts[0].text)).toContain("3 page(s) of a scanned PDF");
  });

  it("says when only the opening pages were shown", async () => {
    replies = [{ readable: true, answer: "ok" }];
    await read(rendered(4, 30));
    expect(String(userParts(sent[0])[0].text)).toContain("first 4 of 30 pages");
  });

  it("falls back to handing over the file when the pictures were not a real reading", async () => {
    replies = [{ readable: false, answer: "" }, { readable: true, answer: "From the file" }];
    expect(await read(rendered(2))).toEqual({ ok: true, value: { readable: true, answer: "From the file" } });
    expect(sent).toHaveLength(2);
    expect(userParts(sent[1]).some((p) => p.type === "file")).toBe(true);
  });

  it("falls back to the file when the processor cannot render, and renders nothing for a provider that takes one image", async () => {
    replies = [{ readable: true, answer: "From the file" }];
    expect((await read(async () => ({ ok: false, reason: "not_configured" }))).ok).toBe(true);
    expect(userParts(sent[0]).some((p) => p.type === "file")).toBe(true);
    const render = vi.fn(rendered(2));
    await read(render, [{ provider: "gemini", model: "gemini-flash-latest" }]).catch(() => undefined);
    expect(render).not.toHaveBeenCalled();
  });

  it("tells the sender what to do when nothing could read it: photograph the pages, not 'unsupported'", async () => {
    replies = [{ readable: false, answer: "" }, { readable: false, answer: "" }];
    expect(await read(rendered(2))).toEqual({ ok: false, reason: "scanned_pdf" });
  });
});

describe("Gemini refuses several images instead of silently dropping them", () => {
  it("raises a 400 so a chain moves on", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    for (const provider of ["gemini"] as const) {
      await expect(ai.structuredCompletion({
        provider, model: "m", system: "s", userText: "u", image: "data:image/jpeg;base64,x", extraImages: ["data:image/jpeg;base64,y"],
        schema: { type: "object" }, toolName: "t",
      })).rejects.toMatchObject({ status: 400 });
    }
  });
});
