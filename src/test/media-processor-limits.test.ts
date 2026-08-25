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
