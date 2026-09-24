// The OCR page's "PDF Scan" package never worked. Two bugs, both fixed here:
//   1. The page cleared its file input on selection and a PDF has no preview,
//      so a PDF scan stopped at "upload a file first" — after VX was spent.
//   2. Even if it had been sent, ocr-scan passed a PDF to the vision model,
//      which reads images only.
// Now: the page keeps the PDF, ocr-scan reads its text layer locally with the
// extractor the WhatsApp assistant already uses (no model call), and the page
// charges VX only once there is text to give. Images are unchanged.
//
// The extractor itself (pdf-parse, an npm: import) was run under Deno on a
// generated PDF when this was written: a text PDF came back as its text, a
// PDF with no text layer as "scanned". See the PR.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodePdfDataUrl,
  isPdfDataUrl,
  languageName,
  MAX_PDF_BYTES,
  PDF_NO_TEXT_CODE,
  pdfScanResult,
} from "../../supabase/functions/_shared/ocrDocument.ts";

const PDF_HEADER = "%PDF-1.4\n";
const asDataUrl = (body: string) => `data:application/pdf;base64,${btoa(body)}`;

describe("decodePdfDataUrl", () => {
  it("accepts an inline PDF and returns its bytes", () => {
    const r = decodePdfDataUrl(asDataUrl(`${PDF_HEADER}1 0 obj<<>>endobj`));
    expect(r.outcome).toBe("ok");
    if (r.outcome === "ok") expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("refuses a file that only claims to be a PDF", () => {
    expect(decodePdfDataUrl(asDataUrl("hello world"))).toEqual({ outcome: "refused", status: 400, error: "That file is not a PDF." });
  });

  it("refuses URLs, other types and garbage", () => {
    for (const v of ["https://example.com/a.pdf", "data:image/png;base64,AAAA", "data:application/pdf,raw", 7, null]) {
      expect(decodePdfDataUrl(v).outcome, String(v)).toBe("refused");
    }
  });

  it("refuses more than the page's own 20 MB ceiling with a 413", () => {
    const over = `data:application/pdf;base64,${"A".repeat(Math.ceil(((MAX_PDF_BYTES + 3) * 4) / 3))}`;
    expect(decodePdfDataUrl(over)).toMatchObject({ outcome: "refused", status: 413 });
  });

  it("only data:application/pdf is routed to the PDF path", () => {
    expect(isPdfDataUrl("data:application/pdf;base64,AAAA")).toBe(true);
    expect(isPdfDataUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isPdfDataUrl(undefined)).toBe(false);
  });
});

describe("pdfScanResult matches what the image path returns", () => {
  it("has exactly the OCR result's fields", () => {
    const r = pdfScanResult("Hello there world", "en");
    expect(r).toEqual({ extracted_text: "Hello there world", detected_language: "English", confidence: "High", word_count: 3, has_handwriting: false });
  });

  it("names the language in English, and says Unknown when it cannot", () => {
    expect(languageName("ar")).toBe("Arabic");
    expect(languageName("fr")).toBe("French");
    expect(languageName(null)).toBe("Unknown");
    expect(languageName("not a code!")).toBe("Unknown");
  });
});

describe("ocr-scan's PDF path", () => {
  const src = readFileSync("supabase/functions/ocr-scan/index.ts", "utf8");
  const handler = src.slice(src.indexOf("Deno.serve("));
  const pdfBranch = handler.slice(handler.indexOf("if (isPdfDataUrl(image))"), handler.indexOf("const checked = checkImageDataUrl(image);"));

  it("runs before the image check and before any model call", () => {
    expect(pdfBranch.length).toBeGreaterThan(0);
    expect(handler.indexOf("if (isPdfDataUrl(image))")).toBeLessThan(handler.indexOf("fetch("));
  });

  it("reads the text layer locally and never calls a provider", () => {
    expect(pdfBranch).toContain("await extractPdfText(upload.bytes)");
    expect(pdfBranch).not.toContain("fetch(");
    expect(pdfBranch).not.toMatch(/OPENAI|openai\.com/);
  });

  it("answers a PDF with no text with a 422 and a code the page understands", () => {
    expect(pdfBranch).toContain("JSON.stringify({ error: PDF_NO_TEXT_MESSAGE, code: PDF_NO_TEXT_CODE })");
    expect(pdfBranch).toContain("status: 422");
    expect(PDF_NO_TEXT_CODE).toBe("pdf_no_text");
  });

  it("is still behind sign-in and the daily limit", () => {
    expect(handler.indexOf("getUser(")).toBeLessThan(handler.indexOf("if (isPdfDataUrl(image))"));
    expect(handler.indexOf('rpc("check_ai_rate_limit"')).toBeLessThan(handler.indexOf("if (isPdfDataUrl(image))"));
  });

  it("returns the same { result } shape as an image scan", () => {
    expect(pdfBranch).toContain("return new Response(JSON.stringify({ result }), {");
  });
});

describe("the OCR page", () => {
  const page = readFileSync("src/pages/services/OCRScan.tsx", "utf8");
  const pdfScan = page.slice(page.indexOf("const handlePdfScan = async"), page.indexOf("const handleScan = async"));
  const scan = page.slice(page.indexOf("const handleScan = async"));

  it("keeps the PDF itself, since the input is cleared and a PDF has no preview", () => {
    expect(page).toContain("const [pdfFile, setPdfFile] = useState<File | null>(null);");
    expect(page).toContain("setPdfFile(file);");
    expect(page).toContain("setPdfFile(null);");
  });

  it("sends a PDF down its own path before any VX is spent", () => {
    const route = scan.indexOf("if (pdfFile)    { await handlePdfScan(pdfFile); return; }");
    expect(route).toBeGreaterThan(0);
    expect(route).toBeLessThan(scan.indexOf("spendVX("));
  });

  it("checks the balance first, and charges only after text came back", () => {
    const check = pdfScan.indexOf("!canSpendVX(price)");
    const invoke = pdfScan.indexOf('supabase.functions.invoke("ocr-scan"');
    const failure = pdfScan.indexOf("if (error || data?.error)");
    const charge = pdfScan.indexOf("await spendVX(price");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(invoke);
    expect(failure).toBeLessThan(charge);
    // The failure branch returns before the charge.
    expect(pdfScan.slice(failure, charge)).toContain("return;");
    expect(pdfScan.match(/spendVX\(/g)).toHaveLength(1);
  });

  it("shows the no-text advice for a scanned PDF, the generic message otherwise", () => {
    expect(pdfScan).toContain('body?.code === "pdf_no_text" ? t("ocr.errPdfNoText") : t("ocr.errScanFailed")');
    expect(page).toContain("async function functionErrorBody(error: unknown)");
  });

  it("leaves images exactly as they were: charged up front, then scanned", () => {
    const imagePath = scan.slice(scan.indexOf("if (pdfFile)"));
    expect(imagePath.indexOf('spendVX(price, "ocr_scan", t("ocr.pkgSingle"), fileName)'))
      .toBeLessThan(imagePath.indexOf('supabase.functions.invoke("ocr-scan"'));
  });

  it("both paths share one success handler", () => {
    expect(page.match(/finishScan\(data\.result as OCRResult\)/g)).toHaveLength(2);
    // One place builds a history entry from a scan (deleting one is separate).
    expect(page.match(/const updated = \[entry, \.\.\.history\];/g)).toHaveLength(1);
  });
});

describe("the wallet's read-only check mirrors spendVX", () => {
  const wallet = readFileSync("src/hooks/useVXWallet.ts", "utf8");

  it("applies the same three rules — signed in, trial, balance — and spends nothing", () => {
    const fn = wallet.slice(wallet.indexOf("const canSpendVX = useCallback("), wallet.indexOf("return { balance"));
    expect(fn).toContain("!!user && ((isOnTrial && !options?.chargeDuringTrial) || balance >= amount)");
    expect(fn).not.toMatch(/rpc\(|toast\(/);
  });
});

describe("the new sentence exists in every locale", () => {
  it("ocr.errPdfNoText is translated in all twenty", () => {
    const locales = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"];
    for (const loc of locales) {
      const text = [`src/i18n/${loc}.ts`, `src/i18n/chunks/${loc}.ts`]
        .map((p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } })
        .join("\n");
      const line = text.split("\n").find((l) => l.includes('"ocr.errPdfNoText"'));
      expect(line, loc).toBeTruthy();
      if (loc !== "en") expect(line, loc).not.toContain("This PDF has no readable text");
    }
  });
});
