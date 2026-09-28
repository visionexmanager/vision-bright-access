import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Scanned PDFs, read on OpenAI. A PDF with no text layer used to be refused
// everywhere with "send photos of the pages instead" — on WhatsApp and in the
// site's OCR. OpenAI's Chat Completions take a PDF as a `file` part and give
// the model an image of every page, so a scan is read like a photograph.

const env: Record<string, string | undefined> = { OPENAI_API_KEY: "sk-test", GROQ_API_KEY: "gsk-test" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
let pdfText: { ok: boolean; reason?: string; text?: string } = { ok: false, reason: "scanned" };
vi.mock("../../supabase/functions/_shared/whatsappPdfText.ts", () => ({ extractPdfText: async () => pdfText }));
vi.mock("../../supabase/functions/_shared/whatsappOffice.ts", () => ({ readOfficeLocally: async () => null }));

const ai = await import("../../supabase/functions/_shared/aiProvider.ts");
// Loaded by a computed path so the app's `tsc -b` does not pull this Deno
// module (and its npm: imports) into its own program; vitest runs it as is.
const UNDERSTAND = "../../supabase/functions/_shared/whatsappUnderstand.ts";
type DocResult = { ok: true; value: { readable: boolean; answer: string } } | { ok: false; reason: string };
const understand = await import(/* @vite-ignore */ UNDERSTAND) as {
  understandDocument: (p: { bytes: Uint8Array; mimeType: string; filename?: string; question: string; languageName: string }) => Promise<DocResult>;
  readScannedPdf: (p: { bytes: Uint8Array; userText: string; languageName: string; targets?: Array<{ provider: string; model: string }> }) => Promise<DocResult>;
};

const PDF = new TextEncoder().encode("%PDF-1.4 scanned");
const PDF_URL = `data:application/pdf;base64,${btoa("%PDF-1.4 scanned")}`;
const SCHEMA = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"], additionalProperties: false };
const tool = (value: unknown) => new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(value) } }] } }] }));

function capture(respond: (url: string) => Response) {
  const sent: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), body: JSON.parse(String(init.body)) });
    return respond(String(url));
  }));
  return sent;
}
const userContent = (body: Record<string, unknown>) =>
  ((body.messages as Array<{ role: string; content: unknown }>).find((m) => m.role === "user")!.content) as Array<Record<string, unknown>>;

beforeEach(() => { ai.resetProviderCooldowns(); ai.setProviderRegistryView(null); pdfText = { ok: false, reason: "scanned" }; });
afterEach(() => { vi.restoreAllMocks(); vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } }); });

describe("the adapter carries a PDF to OpenAI as a file part", () => {
  it("openai: a `file` part with the PDF's data URL, beside the text", async () => {
    const sent = capture(() => tool({ answer: "42" }));
    await ai.structuredCompletion({ provider: "openai", model: "gpt-4o-mini", system: "s", userText: "read it", pdf: PDF_URL, schema: SCHEMA, toolName: "t" });
    const content = userContent(sent[0].body);
    expect(content[0]).toEqual({ type: "text", text: "read it" });
    expect(content[1]).toEqual({ type: "file", file: { filename: "document.pdf", file_data: PDF_URL } });
  });

  it("a provider with no PDF input refuses before any request is sent", async () => {
    const sent = capture(() => tool({ answer: "never" }));
    await expect(ai.structuredCompletion({ provider: "groq", model: "openai/gpt-oss-20b", system: "s", userText: "u", pdf: PDF_URL, schema: SCHEMA, toolName: "t" }))
      .rejects.toMatchObject({ status: 400 });
    expect(sent).toEqual([]);
  });

  it("a chain skips it for OpenAI, and the refusal never cools the provider for chat", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sent = capture(() => tool({ answer: "42" }));
    const out = await ai.structuredCompletionWithFallback({
      targets: [{ provider: "groq", model: "openai/gpt-oss-20b" }, { provider: "openai", model: "gpt-4o-mini" }],
      system: "s", userText: "u", pdf: PDF_URL, schema: SCHEMA, toolName: "t",
    });
    expect(out.provider).toBe("openai");
    expect(sent.map((s) => new URL(s.url).host)).toEqual(["api.openai.com"]);
    expect(ai.COOLDOWN_MS).not.toHaveProperty("http_400");
  });
});

describe("WhatsApp: a scanned PDF is read, not refused", () => {
  it("understandDocument sends the scan to OpenAI's vision chain as a file", async () => {
    const sent = capture(() => tool({ readable: true, answer: "The number is 42." }));
    const read = await understand.understandDocument({ bytes: PDF, mimeType: "application/pdf", filename: "scan.pdf", question: "What number?", languageName: "English" });
    expect(read).toEqual({ ok: true, value: { readable: true, answer: "The number is 42." } });
    expect(sent[0].body.model).toBe("gpt-4o-mini");
    const content = userContent(sent[0].body);
    expect(content.some((p) => p.type === "file")).toBe(true);
    expect(String(content[0].text)).toContain("The PDF is a scan");
  });

  it("a PDF with a text layer still travels as text, with no file part", async () => {
    pdfText = { ok: true, text: "Invoice number 42", pages: 1 } as never;
    const sent = capture(() => tool({ readable: true, answer: "42" }));
    await understand.understandDocument({ bytes: PDF, mimeType: "application/pdf", question: "", languageName: "English" });
    expect(userContent(sent[0].body).some((p) => p.type === "file")).toBe(false);
  });

  it("when no model can read it, the answer is still 'send photos' (scanned_pdf), never a guess", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    capture(() => new Response("{}", { status: 500 }));
    expect(await understand.readScannedPdf({ bytes: PDF, userText: "u", languageName: "English" })).toEqual({ ok: false, reason: "scanned_pdf" });
    const sent = capture(() => tool({ readable: true, answer: "x" }));
    expect(await understand.readScannedPdf({ bytes: PDF, userText: "u", languageName: "English", targets: [{ provider: "groq", model: "m" }] }))
      .toEqual({ ok: false, reason: "scanned_pdf" });
    expect(sent).toEqual([]);
  });
});

describe("site OCR: a scanned PDF goes to the same OCR call as a photograph", () => {
  const ocr = readFileSync("supabase/functions/ocr-scan/index.ts", "utf8");
  it("refuses only a PDF that is not a scan; a scan falls through as a file part", () => {
    expect(ocr).toContain('if (!pdf.ok && pdf.reason !== "scanned") {');
    expect(ocr).toContain("scannedPdf = true;");
    expect(ocr).toContain('? { type: "file", file: { filename: "scan.pdf", file_data: image } }');
    expect(ocr).toMatch(/content: \[\s*\{ type: "text", text: userText \},\s*attachment,\s*\]/);
  });
  it("an image is still bounded exactly as before; a scan is bounded by decodePdfDataUrl", () => {
    expect(ocr).toMatch(/if \(!scannedPdf\) \{\s*const checked = checkImageDataUrl\(image\);/);
    expect(ocr).toContain("const upload = decodePdfDataUrl(image);");
  });
});
