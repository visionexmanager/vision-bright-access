import { describe, expect, it } from "vitest";

import {
  DOC_BUDGET_MS,
  DOC_TARGETS,
  MIN_TEXT_LAYER_CHARS,
  canConvertDocument,
  hasTextLayer,
  isRtlParagraph,
  readDocQuery,
  sniffDocument,
  sofficeArgs,
  stepTimeout,
  stripBidiControls,
  textToHtml,
} from "../../services/media-processor/src/docconvert.mjs";

const bytes = (text: string) => new TextEncoder().encode(text);

describe("what can become what", () => {
  it.each([
    ["pdf", "docx", true],
    ["pdf", "odt", true],
    ["pdf", "txt", true],
    ["pdf", "pdf", false],
    ["pdf", "xlsx", false],
    ["docx", "pdf", true],
    ["doc", "pdf", true],
    ["odt", "docx", true],
    ["docx", "docx", false],
    ["xlsx", "pdf", true],
    ["csv", "xlsx", true],
    ["xlsx", "docx", false],
    ["pptx", "pdf", true],
    ["ppt", "pptx", true],
    ["mp3", "pdf", false],
    ["pdf", "mp3", false],
  ])("%s -> %s is %s", (from, to, expected) => {
    expect(canConvertDocument(from, to)).toBe(expected);
  });

  it("only knows targets that have a LibreOffice filter name", () => {
    for (const target of Object.values(DOC_TARGETS) as { convert: string; ext: string }[]) expect(target.convert.startsWith(target.ext)).toBe(true);
  });

  it("reads a query against the allowlists", () => {
    expect(readDocQuery(new URLSearchParams("from=pdf&to=docx"))).toEqual({ ok: true, from: "pdf", to: "docx" });
    expect(readDocQuery(new URLSearchParams("to=pdf"))).toEqual({ ok: true, from: null, to: "pdf" });
    expect(readDocQuery(new URLSearchParams("to=exe")).ok).toBe(false);
    expect(readDocQuery(new URLSearchParams("from=exe&to=pdf")).ok).toBe(false);
  });
});

describe("what a file is, by its bytes", () => {
  it("knows a PDF even with junk before it", () => {
    expect(sniffDocument(bytes("junk\n%PDF-1.7 stuff here"), "docx")).toBe("pdf");
  });

  it("tells the three OOXML kinds and OpenDocument apart", () => {
    const zip = (inner: string) => Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from(inner)]);
    expect(sniffDocument(zip("[Content_Types].xml word/document.xml"), null)).toBe("docx");
    expect(sniffDocument(zip("xl/workbook.xml"), null)).toBe("xlsx");
    expect(sniffDocument(zip("ppt/presentation.xml"), null)).toBe("pptx");
    expect(sniffDocument(zip("mimetypeapplication/vnd.oasis.opendocument.spreadsheet"), null)).toBe("ods");
    expect(sniffDocument(zip("nothing recognisable"), null)).toBeNull();
  });

  it("does not trust a name over the bytes", () => {
    expect(sniffDocument(bytes("this is plain text, honestly"), "pdf")).toBeNull();
    expect(sniffDocument(bytes("hello, plain text file"), "txt")).toBe("txt");
    expect(sniffDocument(Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), "txt")).toBeNull();
  });

  it("uses the claimed name only inside the old Office container", () => {
    const ole = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(sniffDocument(ole, "doc")).toBe("doc");
    expect(sniffDocument(ole, "xls")).toBe("xls");
    expect(sniffDocument(ole, "pdf")).toBeNull();
  });
});

describe("right-to-left text", () => {
  it("sees direction from letters, not from punctuation or digits", () => {
    expect(isRtlParagraph("السلام عليكم")).toBe(true);
    expect(isRtlParagraph("مرحبا بكم في موقع Visionex")).toBe(true);
    expect(isRtlParagraph("Hello world")).toBe(false);
    expect(isRtlParagraph("12345 - 678")).toBe(false);
    expect(isRtlParagraph("שלום עולם")).toBe(true);
    expect(isRtlParagraph("سلام دنیا")).toBe(true);
  });

  it("gives every paragraph its own direction and keeps page breaks", () => {
    const html = textToHtml(["مرحبا بالعالم\n\nHello there", "الصفحة الثانية"]);
    expect(html).toContain('<p dir="rtl" style="text-align:right">مرحبا بالعالم</p>');
    expect(html).toContain('<p dir="ltr">Hello there</p>');
    expect(html).toContain("page-break-before:always");
    expect(html).toContain('<meta charset="utf-8">');
  });

  it("escapes markup so a scan cannot inject it", () => {
    const html = textToHtml(["<script>alert(1)</script> & more"]);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; more");
  });

  it("turns single newlines into line breaks, not new paragraphs", () => {
    expect(textToHtml(["line one\nline two"])).toContain("line one<br/>line two");
  });
});

describe("the text-layer decision", () => {
  it("calls a PDF with real words text, and one with scraps a scan", () => {
    expect(hasTextLayer("x".repeat(MIN_TEXT_LAYER_CHARS))).toBe(true);
    expect(hasTextLayer("  \f \n ")).toBe(false);
    expect(hasTextLayer("page 1")).toBe(false);
    expect(hasTextLayer(null as unknown as string)).toBe(false);
  });
});

describe("the command line", () => {
  it("never passes a shell string, and puts the input last", () => {
    const args = sofficeArgs({ input: "/tmp/x/in.pdf", outDir: "/tmp/x", profileDir: "/tmp/x/profile", from: "pdf", to: "docx" });
    expect(Array.isArray(args)).toBe(true);
    expect(args.at(-1)).toBe("/tmp/x/in.pdf");
    expect(args).toContain("--headless");
    expect(args).toContain("--infilter=writer_pdf_import");
    expect(args).toContain("docx:MS Word 2007 XML");
    expect(args).toContain("-env:UserInstallation=file:///tmp/x/profile");
  });

  it("reads csv and html with their own import filters, and others with none", () => {
    const base = { input: "i", outDir: "o", profileDir: "p" };
    expect(sofficeArgs({ ...base, from: "csv", to: "xlsx" })).toContain("--infilter=CSV:44,34,76,1");
    expect(sofficeArgs({ ...base, from: "html", to: "pdf" })).toContain("--infilter=HTML (StarWriter)");
    expect(sofficeArgs({ ...base, from: "docx", to: "pdf" }).some((a: string) => a.startsWith("--infilter"))).toBe(false);
  });
});

describe("the time budget", () => {
  it("fits inside the proxy that fronts it", () => {
    expect(DOC_BUDGET_MS).toBeLessThan(120_000);
  });

  it("gives a step what is left, never less than a floor and never more than its own limit", () => {
    expect(stepTimeout(90_000, 1_000_000, 0)).toBe(90_000);
    expect(stepTimeout(90_000, 50_000, 0)).toBe(50_000);
    expect(stepTimeout(90_000, 1_000, 0)).toBe(15_000);
  });
});

describe("poppler's embedding marks", () => {
  it("removes them and nothing else", () => {
    const raw = String.fromCharCode(0x202b) + "السلام" + String.fromCharCode(0x202a) + "abc" + String.fromCharCode(0x202c, 0x202c);
    expect(stripBidiControls(raw)).toBe("السلامabc");
    expect(stripBidiControls("a" + String.fromCharCode(0x200d) + "b")).toBe("a" + String.fromCharCode(0x200d) + "b");
  });
});
