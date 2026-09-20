// Which plan may call which of the four audited functions — all twenty cells.
//
// `section-entitlement.test.ts` pins *function → section*: that `voice-studio`
// asks about `mediaStudio`, that `file-convert` asks about `professional`, that
// `ocr-scan` asks about nothing. `plans.ts` holds *plan → sections*. Neither on
// its own says what a Pro subscriber gets when they call the speech generator,
// which is the question the product statement is written in.
//
// So this composes the two and asserts the grid. It needs no database: both
// halves are declarations in the repository, and composing them is arithmetic.
// The behavioural half — that `user_has_section` really answers this way for
// five real accounts — is covered against PostgreSQL in the PGlite suite.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FREE_SECTIONS, KIDS_PLAN, TIERS, type SectionKey } from "@/lib/billing/plans";

/**
 * The section each audited function is gated to, read from the function itself
 * rather than restated — so a gate that moves breaks this, and a gate that is
 * removed breaks it too.
 */
function gateOf(fn: string): SectionKey | null {
  const src = readFileSync(`supabase/functions/${fn}/index.ts`, "utf8");
  const call = src.match(/maySeeSection\([^,]+,\s*[^,]+,\s*"(\w+)"\)/);
  return (call?.[1] as SectionKey) ?? null;
}

const FUNCTIONS = ["ocr-scan", "voice-studio", "speech-generate", "file-convert"] as const;
type Fn = (typeof FUNCTIONS)[number];

/** Plan → the sections it opens. Free is the no-subscription set. */
const PLAN_SECTIONS: Record<string, readonly SectionKey[]> = {
  free: FREE_SECTIONS,
  kids: KIDS_PLAN.sections,
  basic: TIERS.basic.sections,
  pro: TIERS.pro.sections,
  business: TIERS.business.sections,
};

/**
 * The product statement, written out rather than derived.
 *
 * A table that computes its own expectations agrees with the code by
 * construction and cannot catch it changing.
 */
const EXPECTED: Record<string, Record<Fn, boolean>> = {
  free:     { "ocr-scan": true, "voice-studio": false, "speech-generate": false, "file-convert": false },
  kids:     { "ocr-scan": true, "voice-studio": false, "speech-generate": false, "file-convert": false },
  basic:    { "ocr-scan": true, "voice-studio": false, "speech-generate": false, "file-convert": false },
  pro:      { "ocr-scan": true, "voice-studio": false, "speech-generate": false, "file-convert": false },
  business: { "ocr-scan": true, "voice-studio": true,  "speech-generate": true,  "file-convert": true  },
};

/** What the Edge Function does: no gate serves anyone; a gate asks for its section. */
function mayCall(plan: string, fn: Fn): boolean {
  const section = gateOf(fn);
  if (section === null) return true;
  return PLAN_SECTIONS[plan].includes(section);
}

describe("every cell of the plan matrix", () => {
  for (const plan of Object.keys(EXPECTED)) {
    for (const fn of FUNCTIONS) {
      const want = EXPECTED[plan][fn];
      it(`${plan} → ${fn}: ${want ? "allowed" : "denied"}`, () => {
        expect(mayCall(plan, fn)).toBe(want);
      });
    }
  }
});

describe("the shape of the matrix, as statements", () => {
  it("only Business reaches the three gated functions", () => {
    const reaching = Object.keys(EXPECTED).filter((p) =>
      mayCall(p, "voice-studio") && mayCall(p, "speech-generate") && mayCall(p, "file-convert"));
    expect(reaching).toEqual(["business"]);
  });

  it("every plan reaches ocr-scan, including the one with no subscription", () => {
    for (const plan of Object.keys(EXPECTED)) {
      expect(mayCall(plan, "ocr-scan"), plan).toBe(true);
    }
  });

  it("ocr-scan is ungated at the source, not merely open to everyone by accident", () => {
    expect(gateOf("ocr-scan")).toBeNull();
    const src = readFileSync("supabase/functions/ocr-scan/index.ts", "utf8");
    // Still authenticated, and still rate-limited: ungated is not unprotected.
    expect(src).toContain("auth.getUser()");
    expect(src).toContain("check_ai_rate_limit");
  });

  it("the three gates point where the audit put them", () => {
    expect(gateOf("voice-studio")).toBe("mediaStudio");
    expect(gateOf("speech-generate")).toBe("mediaStudio");
    expect(gateOf("file-convert")).toBe("professional");
  });
});

describe("Kids is a product, not a cheap tier", () => {
  it("keeps its own section while reaching none of the three", () => {
    expect(KIDS_PLAN.sections).toContain("kids");
    for (const fn of ["voice-studio", "speech-generate", "file-convert"] as const) {
      expect(mayCall("kids", fn), fn).toBe(false);
    }
  });

  it("and Pro still includes the children's section, so upgrading loses nothing", () => {
    expect(TIERS.pro.sections).toContain("kids");
    expect(TIERS.business.sections).toContain("kids");
  });
});

describe("being signed in is not the gate", () => {
  it("would make every cell true, and does not", () => {
    const allTrue = Object.keys(EXPECTED).every((p) => FUNCTIONS.every((f) => mayCall(p, f)));
    expect(allTrue).toBe(false);
  });

  it("no gated function is satisfied by the free section set alone", () => {
    for (const fn of ["voice-studio", "speech-generate", "file-convert"] as const) {
      const section = gateOf(fn)!;
      expect(FREE_SECTIONS as readonly string[], fn).not.toContain(section);
    }
  });
});
