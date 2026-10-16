// The coverage and candidate report for prerecorded WhatsApp phrases.
import { describe, expect, it } from "vitest";
import { candidates, coverage, ineligibleReason } from "../../scripts/local-audio/coverage.mjs";

const strings = {
  processing: { en: "Processing your request…", ar: "عم عالج طلبك…" },
  planLimit: { en: "You reached your plan limit today." },
  shortLabel: { en: "Back" },
  withNumber: { en: "You have 3 messages left." },
  goodOne: { en: "Please send that again, I missed it." },
  goodTwo: { en: "Sorry, that is not available right now." },
};
const responses = { processing: { uiKey: "processing", purpose: "progress" } };

describe("coverage", () => {
  it("counts a clip only when it is active", () => {
    const assets = {
      "processing.en.ogg": { bytes: 1, sha256: "x", durationMs: 1, status: "active", verifiedAt: "d" },
      "processing.ar.ogg": { bytes: 1, sha256: "x", durationMs: 1, status: "disabled", verifiedAt: "d" },
    };
    const r = coverage(assets, responses, strings, ["en", "ar", "fr"]);
    expect(r.en).toMatchObject({ approved: 1, withAudio: 1, textOnly: 0 });
    expect(r.ar).toMatchObject({ approved: 1, withAudio: 0, disabled: 1 });
    expect(r.fr.approved).toBe(0);
  });

  it("claims nothing for a language with no text", () => {
    expect(coverage({}, responses, strings, ["fr"]).fr).toMatchObject({ approved: 0, withAudio: 0, textOnly: 0 });
  });
});

describe("candidates", () => {
  it("never offers plan, number or label text", () => {
    expect(ineligibleReason("planLimit", strings.planLimit.en)).toBe("dynamic_key");
    expect(ineligibleReason("withNumber", strings.withNumber.en)).toBe("variable_or_list");
    expect(ineligibleReason("shortLabel", strings.shortLabel.en)).toBe("label_not_sentence");
    expect(candidates(null, responses, strings).map((c: { key: string }) => c.key)).toEqual(["goodOne", "goodTwo"]);
  });

  it("is unranked without usage and ranks by real counts with it", () => {
    expect(candidates(null, responses, strings).every((c: { ranked: boolean }) => !c.ranked)).toBe(true);
    const ranked = candidates({ goodOne: 5, goodTwo: 90, planLimit: 999, processing: 500 }, responses, strings);
    expect(ranked.map((c: { key: string }) => c.key)).toEqual(["goodTwo", "goodOne"]);
  });

  it("ignores junk counts instead of trusting them", () => {
    expect(candidates({ goodOne: -4, goodTwo: Number.NaN }, responses, strings)).toEqual([]);
  });
});
