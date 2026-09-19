// The plan and usage screens, read by somebody who cannot see them.
//
// Both were already close: semantic headings, real lists, decorative icons
// hidden, and "current plan" said in words rather than drawn as a ring. These
// pin that, and cover the two places it fell short — five buttons that all
// announced the same word, and a state with no programmatic equivalent.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pricing = readFileSync("src/pages/Pricing.tsx", "utf8");
const usage = readFileSync("src/pages/services/ai-media-studio/components/billing/UsageChart.tsx", "utf8");
const gate = readFileSync("src/components/PlanGate.tsx", "utf8");

describe("the pricing page", () => {
  it("has one h1 and puts every card under an h2", () => {
    expect((pricing.match(/<h1/g) ?? []).length).toBe(1);
    expect(pricing).toContain("<h2 className=\"text-xl font-bold\">{translateText(plan.name)}</h2>");
  });

  it("labels each landmark section it names", () => {
    for (const id of ["free-week", "whatsapp-plans"]) {
      expect(pricing, id).toContain(`aria-labelledby="${id}"`);
      expect(pricing, id).toContain(`id="${id}"`);
    }
  });

  it("announces loading as a status rather than leaving silence", () => {
    expect(pricing).toContain('role="status"');
  });

  it("marks lists as lists, so the count is announced", () => {
    expect((pricing.match(/role="list"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("hides the decorative tick from the screen reader", () => {
    expect(pricing).toMatch(/<Check[^>]*aria-hidden="true"/);
  });

  it("says which plan each button chooses", () => {
    // Without this every card's button announces the same word.
    expect(pricing).toContain("aria-label={`${");
    expect(pricing).toContain("translateText(plan.name)}`}");
  });

  it("says 'this is your plan' three ways, only one of which is colour", () => {
    expect(pricing).toContain('aria-current={isCurrent ? "true" : undefined}');
    expect(pricing).toContain('t("plans.currentPlan")');
    expect(pricing).toContain("ring-2 ring-primary/30");
  });

  it("carries the page direction, so RTL is not left to the browser", () => {
    expect(pricing).toContain("dir={dir}");
  });
});

describe("the usage screen", () => {
  it("pairs every figure with its label in a description list", () => {
    const summary = usage.slice(usage.indexOf("function PlanSummary"), usage.indexOf("export function UsageChart"));
    expect(summary).toContain("<dl");
    expect(summary).toContain("<dt");
    expect(summary).toContain("<dd");
    expect(summary).toContain('aria-labelledby="vx-plan-heading"');
    expect(summary).toContain('id="vx-plan-heading"');
  });

  it("puts the unit in the text rather than relying on a column header", () => {
    expect(usage).toContain("VX`");
    expect(usage).toContain("} VX");
  });

  it("announces that it is loading, and says so to a screen reader", () => {
    expect(usage).toContain('aria-busy="true"');
    expect(usage).toContain('className="sr-only"');
    expect(usage).toContain("Loading your usage");
  });

  it("tells an error from an emptiness", () => {
    expect(usage).toContain("could not be loaded");
    expect(usage).toContain("No VX spent yet");
  });

  it("names every outcome in words, not by colour", () => {
    // Each status has a label as well as a tone; the tone is the extra.
    for (const status of ["settled", "reserved", "refunded", "failed", "expired"]) {
      expect(usage, status).toMatch(new RegExp(`${status}:\\s*\\{\\s*label:`));
    }
    expect(usage).toContain("VX returned");
    expect(usage).toContain("Timed out");
  });

  it("marks time as time, so it can be read in the viewer's locale", () => {
    expect(usage).toContain("<time dateTime=");
  });
});

describe("the locked-section screen", () => {
  it("is a real heading and a real link, not a styled div", () => {
    expect(gate).toMatch(/<h1|role="heading"/);
    expect(gate).toContain("planGate.seePlans");
  });

  it("says what is still open, so the refusal is not a dead end", () => {
    expect(gate).toContain("planGate.stillFree");
  });
});
