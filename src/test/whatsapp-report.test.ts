// ─── Explaining a report, and the line this assistant does not cross ────────
//
// A lab result or a radiologist's report is a page of terminology written for
// another clinician. Somebody holding one — especially somebody having it read
// aloud to them — is entitled to know what the words mean.
//
// They are not told what the findings mean *for them*. That is a diagnosis, it
// belongs to a doctor who has examined them, and most of what is asserted below
// is about keeping that distinction from eroding one prompt edit at a time.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const health = await import("../../supabase/functions/_shared/whatsappHealth.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

describe("asking for a report to be explained", () => {
  it("hears it as a caption, in either language", () => {
    for (
      const text of [
        "اشرح التقرير",
        "شو يعني هذا التحليل",
        "فسر لي نتيجة الفحص",
        "explain this report",
        "what does this report mean",
        "my lab result",
      ]
    ) {
      expect(health.asksToExplainReport(text), text).toBe(true);
    }
  });

  it("does not arm on a caption that is merely polite", () => {
    for (
      const text of [
        "here you go, thanks for your help with everything today my friend",
        "",
        "   ",
      ]
    ) {
      expect(health.asksToExplainReport(text), text).toBe(false);
    }
  });

  it("refuses a caption too long to be a caption", () => {
    expect(health.asksToExplainReport(`explain this report ${"x".repeat(90)}`)).toBe(false);
    expect(health.REPORT_MAX_CHARS).toBe(80);
  });
});

describe("what the explainer is forbidden to do", () => {
  const prompt = health.reportPrompt("Arabic");

  it("is told not to diagnose, in the words that matter", () => {
    expect(prompt).toContain("Explain terminology only.");
    expect(prompt).toMatch(/Do not diagnose/);
    // The three things a patient most wants and must not be told by this.
    expect(prompt).toMatch(/whether it is serious/);
    expect(prompt).toMatch(/what will happen next/);
    expect(prompt).toMatch(/Do not recommend, suggest or rule out any treatment, test, medicine or dose/);
  });

  it("may repeat a reference range but never what it implies", () => {
    expect(prompt).toMatch(/outside its own reference range/);
    expect(prompt).toMatch(/never what that implies/);
  });

  it("refuses the scan image itself, and says what to send instead", () => {
    // Software that tells a patient what is in an X-ray is a medical device in
    // most of the world, and a missed fracture reaches a person directly.
    expect(prompt).toMatch(/X-ray, CT, MRI or ultrasound image/);
    expect(prompt).toMatch(/cannot interpret images of scans/);
    expect(prompt).toMatch(/radiologist's written report/);
  });

  it("ends by handing the reader back to a doctor", () => {
    expect(prompt).toMatch(/questions the reader could ask their doctor/);
  });

  it("says so when it is not a medical document at all", () => {
    expect(prompt).toMatch(/not a medical document/);
  });
});

describe("the caveat that is added by code", () => {
  it("exists in every language and is never asked of the model", () => {
    for (const language of ["ar", "en", "fr", "ur", "zh"] as const) {
      const sentence = strings.say("reportDisclaimer", language);
      expect(sentence.trim(), language).not.toBe("");
    }
    // A caveat the model was asked for is a caveat the model can drop.
    expect(health.reportPrompt("Arabic")).not.toMatch(/disclaimer/i);
  });

  it("says it is not a diagnosis, and who decides", () => {
    expect(strings.say("reportDisclaimer", "en")).toMatch(/not a diagnosis/i);
    expect(strings.say("reportDisclaimer", "en")).toMatch(/doctor who has examined you/i);
    expect(strings.say("reportDisclaimer", "ar")).toMatch(/ليس تشخيصاً/);
  });

  it("is appended on both paths — a PDF and a photographed page", () => {
    // The same report reaches this assistant two ways, and they must not carry
    // different caveats.
    const both = webhook.match(/say\("reportDisclaimer", answerLanguage\)/g) ?? [];
    expect(both.length).toBe(2);
    expect(webhook).toContain("if (explainReport) log(\"report\", { kind: \"document\"");
    expect(webhook).toContain("if (explainReportImage) log(\"report\", { kind: \"image\"");
  });

  it("substitutes the instruction for the caption on both paths", () => {
    const uses = webhook.match(/reportPrompt\(LANGUAGE_ENDONYM\[answerLanguage\]\)/g) ?? [];
    expect(uses.length).toBe(2);
  });
});

describe("the row in the menu", () => {
  const node = catalog.nodeById("health.report")!;

  it("is a prompting row: built, and waiting for the thing it works on", () => {
    expect(node.enabled).toBe(true);
    expect(node.handler).toBe("prompt");
    expect(node.accepts).toEqual(expect.arrayContaining(["document", "image"]));
  });

  it("warns about the scan before somebody photographs one", () => {
    // The sentence belongs in the intro and not only in the model's
    // instruction: somebody about to take a picture of an X-ray should read it
    // before they take it, not after.
    for (const language of ["ar", "en"] as const) {
      const intro = catalog.localized(node.intro!, language);
      expect(intro.length, language).toBeGreaterThan(120);
    }
    expect(catalog.localized(node.intro!, "en")).toMatch(/do not interpret the scan image/i);
    expect(catalog.localized(node.intro!, "en")).toMatch(/will not diagnose/i);
    expect(catalog.localized(node.intro!, "ar")).toMatch(/لن أشخّص/);
    expect(catalog.localized(node.intro!, "ar")).toMatch(/صورة الأشعة نفسها لا أفسّرها/);
  });

  it("completes the Health section", () => {
    expect(catalog.childrenOf("health").map((n) => n.id)).toEqual([
      "health.emergency",
      "health.medicine",
      "health.report",
    ]);
  });
});
