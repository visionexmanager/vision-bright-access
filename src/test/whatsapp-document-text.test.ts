// Getting the words out of a document, which is not the same as reading it.
//
// `understandDocument` reads a document *and answers a question about it*: it
// picks a provider, builds a prompt, and returns what a model said. That is the
// right shape for "summarise this" and the wrong one for "translate this",
// where the model must be handed the sender's own words rather than a summary
// of them. This is the extraction half on its own — and two of its three paths
// are entirely local.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  documentShape,
  extractDocumentText,
  MAX_DOCUMENT_TEXT_CHARS,
} from "../../supabase/functions/_shared/whatsappDocumentText.ts";

const bytesOf = (text: string) => new TextEncoder().encode(text);

// ── 1. Working out what a file is ────────────────────────────────────────────

describe("what kind of document this is", () => {
  it("reads the declared type first", () => {
    expect(documentShape("application/pdf")).toBe("pdf");
    expect(documentShape("text/plain")).toBe("text");
    expect(documentShape("text/csv")).toBe("text");
    expect(documentShape(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )).toBe("office");
  });

  it("ignores the parameters a type carries", () => {
    expect(documentShape("text/plain; charset=utf-8")).toBe("text");
    expect(documentShape("APPLICATION/PDF")).toBe("pdf");
  });

  it("falls back to the extension for the types WhatsApp will not name", () => {
    // An `.srt` routinely arrives as `application/octet-stream`, which says
    // nothing at all — and a subtitle file is exactly the thing somebody wants
    // translated.
    expect(documentShape("application/octet-stream", "movie.srt")).toBe("text");
    expect(documentShape("application/octet-stream", "captions.VTT")).toBe("text");
    expect(documentShape("application/octet-stream", "notes.md")).toBe("text");
  });

  it("refuses a type it does not know rather than guessing", () => {
    for (const [mime, name] of [
      ["application/octet-stream", "thing.bin"],
      ["application/zip", "archive.zip"],
      ["image/png", "photo.png"],
      ["", ""],
    ]) {
      expect(documentShape(mime, name), `${mime} ${name}`).toBeNull();
    }
  });
});

// ── 2. Reading one ───────────────────────────────────────────────────────────

describe("pulling the text out", () => {
  it("decodes a plain text file", async () => {
    const result = await extractDocumentText({
      bytes: bytesOf("The meeting is at nine."),
      mimeType: "text/plain",
    });
    expect(result).toEqual({ ok: true, text: "The meeting is at nine." });
  });

  it("keeps a document with one bad byte in it", async () => {
    // `fatal: false`: a file should lose the broken character, not the file.
    const broken = new Uint8Array([...bytesOf("before "), 0xff, ...bytesOf(" after")]);
    const result = await extractDocumentText({ bytes: broken, mimeType: "text/plain" });
    expect(result.ok).toBe(true);
    expect(result.text).toContain("before");
    expect(result.text).toContain("after");
  });

  it("reads a subtitle file whose type says nothing", async () => {
    const srt = "1\n00:00:01,000 --> 00:00:04,000\nHello.\n";
    const result = await extractDocumentText({
      bytes: bytesOf(srt),
      mimeType: "application/octet-stream",
      filename: "movie.srt",
    });
    expect(result.ok).toBe(true);
    expect(result.text).toContain("00:00:01,000 --> 00:00:04,000");
  });

  it("calls an empty file empty rather than returning nothing", async () => {
    for (const source of ["", "   \n\n  "]) {
      const result = await extractDocumentText({ bytes: bytesOf(source), mimeType: "text/plain" });
      expect(result).toEqual({ ok: false, reason: "empty" });
    }
  });

  it("refuses a format it has no extractor for", async () => {
    const result = await extractDocumentText({
      bytes: bytesOf("PK"),
      mimeType: "application/zip",
      filename: "a.zip",
    });
    expect(result).toEqual({ ok: false, reason: "unsupported_format" });
  });

  it("has a ceiling, and applies it to what came out", async () => {
    const huge = "x".repeat(MAX_DOCUMENT_TEXT_CHARS + 5_000);
    const result = await extractDocumentText({ bytes: bytesOf(huge), mimeType: "text/plain" });
    expect(result.ok).toBe(true);
    expect(result.text?.length).toBe(MAX_DOCUMENT_TEXT_CHARS);
  });

  it("never throws, whatever the extractor does", async () => {
    // Every caller is deciding what to say to somebody about a file they sent,
    // and an exception is not something to say.
    const source = readModuleSource();
    expect(source).toContain("} catch {");
    expect(source).toContain('reason: "extract_failed"');

    // And the behaviour: an extractor that throws becomes a reason.
    const result = await extractDocumentText({
      bytes: bytesOf("not a pdf"),
      mimeType: "application/pdf",
      readPdf: async () => { throw new Error("/tmp/somebodys-file.pdf: bad xref"); },
    });
    expect(result).toEqual({ ok: false, reason: "extract_failed" });
  });

  it("reads a PDF and a Word file through the readers it is given", async () => {
    const pdf = await extractDocumentText({
      bytes: bytesOf("%PDF"),
      mimeType: "application/pdf",
      readPdf: async () => ({ ok: true, text: "Page one." }),
    });
    expect(pdf).toEqual({ ok: true, text: "Page one." });

    const docx = await extractDocumentText({
      bytes: bytesOf("PK"),
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      readOffice: async () => ({ ok: true, text: "Paragraph one." }),
    });
    expect(docx).toEqual({ ok: true, text: "Paragraph one." });
  });

  it("declines a PDF when no reader was supplied, rather than crashing", async () => {
    const result = await extractDocumentText({ bytes: bytesOf("%PDF"), mimeType: "application/pdf" });
    expect(result).toEqual({ ok: false, reason: "unsupported_format" });
  });
});

// ── 3. The one failure that needs different advice ───────────────────────────

describe("a scanned page", () => {
  it("is a reason of its own, not a generic failure", () => {
    // The file is fine — there is simply no text layer in it. The sender should
    // be told to photograph the page, which this assistant reads well, rather
    // than to send a different file.
    const source = readModuleSource();
    expect(source).toContain('"scanned_pdf"');
    expect(source).toContain('pdf.reason === "scanned"');
  });

  it("has an answer for every reason the PDF extractor can return", async () => {
    // Read out of the extractor rather than trusted from this file's list: a
    // reason added there and unmapped here becomes a generic failure, and the
    // sender is told to send a different file when their file was fine.
    //
    // Behavioural rather than textual, because `failed` maps through the
    // fallback and appears nowhere in the source — checking for the literal
    // string called that a gap when it is the correct handling.
    const pdf = readFileSync("supabase/functions/_shared/whatsappPdfText.ts", "utf8");
    const declared = /PdfTextFailure\s*=\s*([^;]+);/.exec(pdf)?.[1] ?? "";
    const reasons = [...declared.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(reasons.length).toBeGreaterThan(2);

    const known = ["unsupported_format", "empty", "scanned_pdf", "encrypted_pdf", "extract_failed"];
    for (const reason of reasons) {
      const result = await extractDocumentText({
        bytes: bytesOf("%PDF"),
        mimeType: "application/pdf",
        readPdf: async () => ({ ok: false, reason }),
      });
      expect(result.ok, reason).toBe(false);
      expect(known, `pdf reason ${reason} produced an unknown answer`).toContain(result.reason);
    }
  });
});

function readModuleSource(): string {
  return readFileSync("supabase/functions/_shared/whatsappDocumentText.ts", "utf8");
}
