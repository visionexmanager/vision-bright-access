// The media processor's own rules, tested against the real module.
//
// `services/media-processor` has no build step and no test runner of its own —
// it is plain ESM that Node loads directly — so these import the actual file
// the container runs rather than a copy of its logic.
//
// The language rules get the attention here because that is where a real
// failure hid: the service was refusing every Arabic request, and the English
// path could not have revealed it.

import { describe, expect, it } from "vitest";

async function limits() {
  return await import("../../services/media-processor/src/limits.mjs");
}

describe("which languages the container can actually load", () => {
  it("allows only what the image has trained data for", async () => {
    const { SUPPORTED_LANGUAGES, isSupportedLanguage } = await limits();
    expect(SUPPORTED_LANGUAGES).toEqual(["ara", "eng", "ara+eng"]);
    for (const good of SUPPORTED_LANGUAGES) expect(isSupportedLanguage(good)).toBe(true);
  });

  it("refuses anything else, because the value reaches a command line", async () => {
    const { isSupportedLanguage } = await limits();
    for (const bad of ["deu", "ara+deu", "ara;whoami", "$(id)", "", "ara eng extra", null, 7]) {
      expect(isSupportedLanguage(bad as string)).toBe(false);
    }
  });
});

describe("reading the language out of a query string", () => {
  it("hears a plus that arrived as a space", async () => {
    // A plus in a query decodes to a space, so a caller writing the obvious
    // `?lang=ara+eng` was heard as `ara eng` and refused. Every Arabic
    // photograph failed and fell back to the paid model; English, which has no
    // plus in it, worked perfectly and hid the fault.
    const { languageFromQuery, isSupportedLanguage } = await limits();
    expect(languageFromQuery("ara eng")).toBe("ara+eng");
    expect(isSupportedLanguage(languageFromQuery("ara eng"))).toBe(true);
  });

  it("leaves a correctly encoded value alone", async () => {
    const { languageFromQuery } = await limits();
    expect(languageFromQuery("ara+eng")).toBe("ara+eng");
    expect(languageFromQuery("eng")).toBe("eng");
    expect(languageFromQuery("ara")).toBe("ara");
  });

  it("normalises without widening what is allowed", async () => {
    // This is the line between "be forgiving about syntax" and "accept more
    // languages". Only the allowlist decides; this just spells the input the
    // way the allowlist is written.
    const { languageFromQuery, isSupportedLanguage } = await limits();
    for (const hostile of ["deu", "ara deu", "ara;whoami", "$(id)", "ara eng extra"]) {
      expect(isSupportedLanguage(languageFromQuery(hostile))).toBe(false);
    }
  });

  it("survives a caller that sends nothing at all", async () => {
    const { languageFromQuery } = await limits();
    expect(languageFromQuery(null)).toBeNull();
    expect(languageFromQuery(undefined)).toBeUndefined();
  });
});

describe("how the page is carved up", () => {
  it("allows only the modes that suit a photograph", async () => {
    // 3 is Tesseract's own default and assumes a page. 6, 7 and 11 are a
    // uniform block, a single line, and sparse text — which is what a
    // photograph of a sign actually is.
    const { SUPPORTED_PSM, isSupportedPsm } = await limits();
    expect(SUPPORTED_PSM).toEqual(["3", "6", "7", "11"]);
    for (const good of SUPPORTED_PSM) expect(isSupportedPsm(good)).toBe(true);
  });

  it("refuses anything else, because this reaches a command line too", async () => {
    const { isSupportedPsm } = await limits();
    for (const bad of ["0", "13", "6; whoami", "$(id)", "--oem 0", "", " 6", "6 ", null, 6]) {
      expect(isSupportedPsm(bad as string)).toBe(false);
    }
  });

  it("is a whole-string allowlist, not a numeric range check", async () => {
    // A range check on a parsed number would accept "6abc" and " 6 ", and both
    // would then be handed to a process. Whole strings are simpler to be sure
    // about, which is the same argument the language allowlist makes.
    const { isSupportedPsm } = await limits();
    expect(isSupportedPsm("6abc")).toBe(false);
    expect(isSupportedPsm("06")).toBe(false);
  });
});

describe("which recognition engine runs", () => {
  it("allows the legacy engine, the LSTM one, and the automatic choice", async () => {
    const { SUPPORTED_OEM, isSupportedOem } = await limits();
    expect(SUPPORTED_OEM).toEqual(["0", "1", "3"]);
    for (const good of SUPPORTED_OEM) expect(isSupportedOem(good)).toBe(true);
  });

  it("refuses anything else, including the mode Tesseract does not have", async () => {
    // 2 exists in the enum and is not implemented in any current build. It is
    // absent here for that reason, not by oversight.
    const { isSupportedOem } = await limits();
    for (const bad of ["2", "4", "-1", "1; whoami", "$(id)", "", " 1", null, 1]) {
      expect(isSupportedOem(bad as string)).toBe(false);
    }
  });
});

describe("what counts as recognised text", () => {
  it("rejects what Tesseract does to a photograph of a wall", async () => {
    const { textIsUsable } = await limits();
    expect(textIsUsable("")).toBe(false);
    expect(textIsUsable("  \n ")).toBe(false);
    expect(textIsUsable("|.")).toBe(false);
  });

  it("accepts real words in either script", async () => {
    const { textIsUsable } = await limits();
    expect(textIsUsable("VISIONEX GATE 47")).toBe(true);
    expect(textIsUsable("مخرج")).toBe(true);
  });
});

describe("the ceilings", () => {
  it("bounds an upload, the pixels behind it, and how long OCR may run", async () => {
    const { MAX_UPLOAD_BYTES, MAX_IMAGE_PIXELS, OCR_TIMEOUT_MS, MAX_CONCURRENT } = await limits();
    expect(MAX_UPLOAD_BYTES).toBe(8 * 1024 * 1024);
    // A few megabytes of flat colour expands to hundreds of megabytes of
    // pixels, so the byte ceiling alone does not bound the decode.
    expect(MAX_IMAGE_PIXELS).toBeGreaterThan(0);
    expect(OCR_TIMEOUT_MS).toBeGreaterThan(0);
    // Four cores, and the box is also serving the website.
    expect(MAX_CONCURRENT).toBeLessThanOrEqual(2);
  });
});

// ── Barcodes ────────────────────────────────────────────────────────────────
//
// Two things are load-bearing here and both are security properties rather than
// features.
//
// The check digit is what separates "zbar returned some digits" from "these
// digits are a real product number". Without it a misdecode is read aloud to
// somebody who cannot check it against the packet.
//
// And the `product` / `text` split is what keeps a stranger's sentence out of a
// model prompt. A QR code can be printed by anybody and left on a shelf, so the
// rule is that only digits are ever treated as verified — everything else is
// somebody else's text.

describe("the check digit, which is what makes a barcode provable", () => {
  it("accepts real retail numbers", async () => {
    const { gtinChecksumOk } = await limits();
    // EAN-13, EAN-8 and UPC-A, each with its own correct check digit.
    for (const good of ["5000112637922", "6281006540019", "96385074", "036000291452"]) {
      expect(gtinChecksumOk(good)).toBe(true);
    }
  });

  it("rejects a number whose last digit is wrong", async () => {
    const { gtinChecksumOk } = await limits();
    // The same EAN-13 as above with the check digit moved by one. A misdecode
    // looks exactly like this, and it is the case the checksum exists for.
    expect(gtinChecksumOk("5000112637923")).toBe(false);
    expect(gtinChecksumOk("1234567890123")).toBe(false);
  });

  it("rejects anything that is not a run of digits of a retail length", async () => {
    const { gtinChecksumOk } = await limits();
    for (const bad of ["", "12345", "50001126379221", "500011263792X", "  5000112637922  ", null, 5000112637922]) {
      expect(gtinChecksumOk(bad as string)).toBe(false);
    }
  });
});

describe("reading what zbar printed", () => {
  it("splits on the first colon, so a URL survives intact", async () => {
    const { parseBarcodeOutput } = await limits();
    const symbols = parseBarcodeOutput("QR-Code:https://visionex.app/a?b=1&c=2\n");
    expect(symbols).toHaveLength(1);
    expect(symbols[0].value).toBe("https://visionex.app/a?b=1&c=2");
    // Nobody printed this on a packet with a check digit, so it is text.
    expect(symbols[0].kind).toBe("text");
  });

  it("calls a checksummed retail symbol a product, and nothing else one", async () => {
    const { parseBarcodeOutput } = await limits();
    const symbols = parseBarcodeOutput(
      [
        "EAN-13:5000112637922",
        // A retail symbology whose digits do not check out. zbar can misdecode;
        // this is the case where it did, and it must not be trusted as a number.
        "EAN-13:5000112637923",
        // A symbology that carries free text, holding digits. Still text: the
        // symbology, not the shape of the payload, is what decides.
        "CODE-128:5000112637922",
      ].join("\n"),
    );
    expect(symbols.map((symbol) => symbol.kind)).toEqual(["product", "text", "text"]);
  });

  it("drops the lines that are not symbols", async () => {
    const { parseBarcodeOutput } = await limits();
    const symbols = parseBarcodeOutput(
      ["scanned 1 barcode symbols from 1 images", "", "no colon here", "QR-Code:", ":leading colon", "QR-Code:ok"].join("\n"),
    );
    expect(symbols).toHaveLength(1);
    expect(symbols[0].value).toBe("ok");
  });

  it("bounds both the payload and the number of symbols", async () => {
    const { parseBarcodeOutput, MAX_BARCODE_VALUE_CHARS, MAX_BARCODE_SYMBOLS } = await limits();

    const long = parseBarcodeOutput(`QR-Code:${"x".repeat(MAX_BARCODE_VALUE_CHARS + 500)}`);
    expect(long[0].value).toHaveLength(MAX_BARCODE_VALUE_CHARS);
    expect(long[0].truncated).toBe(true);

    // A shelf photographed straight on genuinely contains a dozen barcodes.
    const many = parseBarcodeOutput(Array.from({ length: 30 }, (_, i) => `QR-Code:v${i}`).join("\n"));
    expect(many).toHaveLength(MAX_BARCODE_SYMBOLS);
  });

  it("survives being handed nothing at all", async () => {
    const { parseBarcodeOutput } = await limits();
    for (const empty of ["", null, undefined]) {
      expect(parseBarcodeOutput(empty as string)).toEqual([]);
    }
  });
});
