import { describe, expect, it } from "vitest";

import {
  DOC_BUDGET_MS,
  DOC_TARGETS,
  MIN_READ_CHARS,
  sparseReadWins,
  MIN_TEXT_LAYER_CHARS,
  visibleChars,
  canConvertDocument,
  hasTextLayer,
  isRtlParagraph,
  needsOcrForArabic,
  OCR_LANGUAGE_BY_SCRIPT,
  OCR_MODELS,
  DEFAULT_OCR_LANGUAGE,
  MAX_JOB_PAGES,
  MAX_SYNC_OCR_PAGES,
  JOB_TTL_MS,
  JOB_MAX_MS,
  isJobId,
  languageForScript,
  parseOsdScript,
  pdftoppmArgs,
  refineArabicLanguage,
  pdftotextArgs,
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

describe("which PDFs are read by eye", () => {
  it("reads Arabic-script text from the page, Persian and Urdu included", () => {
    expect(needsOcrForArabic("السلام عليكم")).toBe(true);
    expect(needsOcrForArabic("سلام دنیا گل")).toBe(true);
    expect(needsOcrForArabic("آپ کیسے ہیں")).toBe(true);
    expect(needsOcrForArabic("Hello world")).toBe(false);
    expect(needsOcrForArabic(null as unknown as string)).toBe(false);
  });

  it("asks poppler for a later range only when told to", () => {
    expect(pdftotextArgs("in", "out")).not.toContain("-f");
    expect(pdftotextArgs("in", "out", 11)).toEqual(["-enc", "UTF-8", "-nopgbrk", "-f", "11", "in", "out"]);
  });
});

describe("which language a page is read in", () => {
  it("reads the script out of Tesseract's detection output", () => {
    expect(parseOsdScript("Page number: 0\nOrientation in degrees: 90\nScript: Arabic\nScript confidence: 3.2\n")).toBe("Arabic");
    expect(parseOsdScript("Script: Latin\n")).toBe("Latin");
    expect(parseOsdScript("Too few characters. Skipping this page")).toBeNull();
    expect(parseOsdScript(undefined as unknown as string)).toBeNull();
  });

  it("maps a script to models, and falls back to Arabic with English", () => {
    expect(languageForScript("Latin")).toContain("fra");
    expect(languageForScript("Han")).toContain("chi_sim");
    expect(languageForScript("Cyrillic")).toContain("rus");
    expect(languageForScript("Klingon")).toBe(DEFAULT_OCR_LANGUAGE);
    expect(languageForScript(null as unknown as string)).toBe(DEFAULT_OCR_LANGUAGE);
  });

  it("only ever names models the image installs", () => {
    for (const language of [...Object.values(OCR_LANGUAGE_BY_SCRIPT), "fas+eng", "urd+eng"] as string[]) {
      for (const model of language.split("+")) expect(OCR_MODELS, model).toContain(model);
    }
  });

  it("looks again at Arabic-script text for Urdu and Persian letters", () => {
    expect(refineArabicLanguage("یہ ایک ٹیسٹ ہے")).toBe("urd+eng");
    expect(refineArabicLanguage("این یک گل است")).toBe("fas+eng");
    expect(refineArabicLanguage("هذا اختبار")).toBeNull();
    expect(refineArabicLanguage(undefined as unknown as string)).toBeNull();
  });
});

describe("long documents", () => {
  it("answers a short one in the request and a long one with a job", () => {
    expect(MAX_SYNC_OCR_PAGES).toBeLessThanOrEqual(10);
    expect(MAX_JOB_PAGES).toBeGreaterThan(100);
    expect(JOB_TTL_MS).toBeGreaterThan(JOB_MAX_MS);
  });

  it("accepts only 128-bit hex as a job id", () => {
    expect(isJobId("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isJobId("0123456789ABCDEF0123456789abcdef")).toBe(false);
    expect(isJobId("../etc/passwd")).toBe(false);
    expect(isJobId("abc")).toBe(false);
    expect(isJobId(null as unknown as string)).toBe(false);
  });

  it("renders a page range", () => {
    expect(pdftoppmArgs("in", "pg", 10, 6)).toEqual(["-png", "-gray", "-r", "200", "-f", "6", "-l", "10", "in", "pg"]);
    expect(pdftoppmArgs("in", "pg")).toContain("-f");
  });
});

describe("did the reader find words", () => {
  it("accepts a short document that was really read, and refuses a blank one", () => {
    expect(MIN_READ_CHARS).toBeLessThan(MIN_TEXT_LAYER_CHARS);
    expect(visibleChars("صفحة رقم 1")).toBeGreaterThanOrEqual(MIN_READ_CHARS);
    expect(visibleChars(" 
 ")).toBeLessThan(MIN_READ_CHARS);
  });
});

describe("the second, sparse reading", () => {
  it("is kept only when it found clearly more", () => {
    expect(sparseReadWins(10, 40)).toBe(true);
    expect(sparseReadWins(100, 105)).toBe(false);
    expect(sparseReadWins(100, 100)).toBe(false);
    expect(sparseReadWins(0, 5)).toBe(true);
  });
});
