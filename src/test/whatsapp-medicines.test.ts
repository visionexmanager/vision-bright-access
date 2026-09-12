// ─── What is in this medicine ───────────────────────────────────────────────
//
// Two public sources, neither of which takes a key — which is not a preference
// here but a rule this repository already enforces. What the tests below are
// mostly about is the difference between information and advice, and the one
// sentence that must survive every way this can go wrong.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const medicines = await import("../../supabase/functions/_shared/whatsappMedicines.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

/** A label shaped the way openFDA actually answers. */
const label = (over: Record<string, unknown> = {}) => ({
  results: [{
    openfda: { brand_name: ["PANADOL PM"], generic_name: ["ACETAMINOPHEN AND DIPHENHYDRAMINE HCL"] },
    indications_and_usage: ["Uses temporarily relieves minor aches and pains"],
    dosage_and_administration: ["Directions do not take more than directed"],
    warnings: ["Warnings Liver warning: this product contains acetaminophen"],
    stop_use: ["Stop use and ask a doctor if pain gets worse"],
    ...over,
  }],
});

describe("asking about a medicine", () => {
  it("hears the trigger and takes the name after it", () => {
    for (
      const [text, name] of [
        ["دواء بنادول", "بنادول"],
        ["الدواء panadol", "panadol"],
        ["medicine Panadol", "Panadol"],
        ["drug ibuprofen", "ibuprofen"],
        ["معلومات عن دواء اسبرين", "اسبرين"],
      ] as const
    ) {
      expect(medicines.parseMedicineRequest(text)?.name, text).toBe(name);
    }
  });

  it("treats a bare trigger as somebody who has not said which yet", () => {
    // Not a refusal: they found the feature. The webhook asks them.
    expect(medicines.parseMedicineRequest("دواء")?.name).toBe("");
    expect(medicines.parseMedicineRequest("medicine")?.name).toBe("");
  });

  it("hears the ways people actually ask, not only the word «دواء»", () => {
    for (
      const [text, name] of [
        ["حبوب بنادول", "بنادول"],
        ["اقراص اسبرين", "اسبرين"],
        ["ما هو دواء بنادول", "بنادول"],
        ["شو الدواء بنادول", "بنادول"],
        ["ما فائدة دواء اسبرين", "اسبرين"],
        ["what is the drug ibuprofen", "ibuprofen"],
        ["tablets ibuprofen", "ibuprofen"],
        ["tell me about the drug aspirin", "aspirin"],
        ["what are the side effects of ibuprofen", "ibuprofen"],
      ] as const
    ) {
      expect(medicines.parseMedicineRequest(text)?.name, text).toBe(name);
    }
  });

  it("keeps a question word out of the drug database unless a medicine is named", () => {
    // «ما هو» opens a question about anything. On its own it must never route
    // a general question into a leaflet lookup — that one now gets a general
    // answer from the assistant, which is a better answer than "check the
    // spelling" ever was.
    for (
      const text of [
        "ما هو الذكاء الاصطناعي",
        "ما هي عاصمة اليابان",
        "what is the capital of Japan",
        "tell me about the weather tomorrow",
      ]
    ) {
      expect(medicines.parseMedicineRequest(text), text).toBeNull();
    }
  });

  it("does not answer a sentence that merely mentions medicine", () => {
    // "I took some medicine and now I feel worse" is a complaint, and a
    // leaflet would be the assistant talking over somebody who needs a person.
    for (
      const text of [
        "I took some medicine and now I feel much worse than before",
        "أخذت الدواء وما زلت أشعر بألم شديد في معدتي",
        "",
      ]
    ) {
      expect(medicines.parseMedicineRequest(text), text).toBeNull();
    }
  });
});

describe("reading the label", () => {
  it("keeps the sections somebody holding a box needs, in that order", () => {
    const read = medicines.readLabel(label())!;
    expect(read.brand).toBe("PANADOL PM");
    expect(read.sections.map((s) => s.key)).toEqual(["uses", "directions", "warnings", "stopUse"]);
  });

  it("returns nothing rather than an empty leaflet", () => {
    expect(medicines.readLabel({ results: [{ openfda: { brand_name: ["X"] } }] })).toBeNull();
    expect(medicines.readLabel({ results: [] })).toBeNull();
    expect(medicines.readLabel(null)).toBeNull();
    expect(medicines.readLabel("nonsense")).toBeNull();
  });

  it("caps a section rather than sending a whole leaflet", () => {
    const long = medicines.readLabel(label({ warnings: ["W".repeat(4000)] }))!;
    const warnings = long.sections.find((s) => s.key === "warnings")!;
    expect(warnings.text.length).toBeLessThanOrEqual(medicines.SECTION_CHARS);
    expect(medicines.sourceBlock(long).length).toBeLessThanOrEqual(medicines.SOURCE_CHARS);
  });

  it("rescues a misspelling through the vocabulary", () => {
    // "panadool" — RxNav answers with a concept id, and the id has a name.
    expect(medicines.readApproximate({ approximateGroup: { candidate: [{ rxcui: "202432" }] } }))
      .toBe("202432");
    expect(medicines.readRxName({ properties: { name: "Panadol" } })).toBe("Panadol");
    // And refuses anything that is not an id or a name.
    expect(medicines.readApproximate({ approximateGroup: { candidate: [{ rxcui: "../etc" }] } })).toBeNull();
    expect(medicines.readRxName({ properties: {} })).toBeNull();
  });
});

describe("the sentence that must survive everything", () => {
  it("is appended by code, in the reader's language", () => {
    for (const language of ["ar", "en", "fr", "tr", "hi"] as const) {
      const message = medicines.withDisclaimer("body", language);
      expect(message.startsWith("body"), language).toBe(true);
      expect(message, language).toContain(strings.say("medicineDisclaimer", language));
    }
  });

  it("names the country of the label, because a brand is not the same box everywhere", () => {
    // "Panadol" is paracetamol across the Middle East; the first US match is
    // "PANADOL PM", which also contains an antihistamine. Naming the source is
    // the difference between information and a confident wrong answer.
    for (const language of ["ar", "en"] as const) {
      expect(strings.say("medicineDisclaimer", language)).toMatch(/FDA/);
    }
    expect(strings.say("medicineDisclaimer", "en")).toMatch(/pharmacist/i);
    expect(strings.say("medicineDisclaimer", "ar")).toMatch(/الصيدلي/);
  });

  it("is never asked of the model", () => {
    // The prompt must not mention it: a rendering that was asked to include a
    // disclaimer is a rendering that can decide not to.
    expect(medicines.renderPrompt("Arabic")).not.toMatch(/disclaimer|FDA|pharmacist/i);
    // And the code appends it on both paths — rendered and untranslated alike.
    const branch = webhook.slice(
      webhook.indexOf("const medicineAsk"),
      webhook.indexOf("const newsAsk ="),
    );
    expect(branch).toContain("withDisclaimer(body, answerLanguage)");
  });
});

describe("what the renderer is forbidden to do", () => {
  it("is told, in order, everything it may not add", () => {
    const prompt = medicines.renderPrompt("Arabic");
    expect(prompt).toContain("Arabic");
    for (const rule of ["Keep every warning", "Keep every dose", "Do not add", "Do not tell the reader"]) {
      expect(prompt, rule).toContain(rule);
    }
  });

  it("is given the leaflet and no conversation", () => {
    // Replaying the thread here would let an earlier message change what a
    // leaflet says.
    const branch = webhook.slice(webhook.indexOf("const medicineAsk"), webhook.indexOf("const newsAsk ="));
    expect(branch).toContain("systemParts: [renderPrompt(");
    expect(branch).not.toContain("turns:");
  });

  it("falls back to the label's own words rather than to nothing", () => {
    const branch = webhook.slice(webhook.indexOf("const medicineAsk"), webhook.indexOf("const newsAsk ="));
    expect(branch).toContain("sourceBlock(label)");
    expect(branch).toContain('rendered.status === "answered"');
  });
});

describe("the lookup", () => {
  const lookup = webhook.slice(webhook.indexOf("const lookupMedicine"), webhook.indexOf("const showStories"));

  it("asks openFDA by brand or generic — the two names for one box", () => {
    expect(lookup).toContain("api.fda.gov/drug/label.json");
    expect(lookup).toContain("openfda.brand_name");
    expect(lookup).toContain("openfda.generic_name");
  });

  it("takes no key, on either source", () => {
    // The rule this channel already enforces: a key is a bill, a quota and an
    // outage, and a health answer that stops working because a plan lapsed is
    // worse than no health answer.
    expect(lookup).not.toMatch(/api_key|apikey|Bearer|Authorization/i);
    expect(lookup).toContain("rxnav.nlm.nih.gov");
  });

  it("tells a source that was unreachable apart from one that had nothing", () => {
    // A source that could not be reached is still worth a sentence: "try
    // again" is something the sender can act on.
    expect(lookup).toContain('return "unavailable"');
    expect(lookup).toContain("if (response.status === 404) return null;");
    const branch = webhook.slice(
      webhook.indexOf("const medicineAsk"),
      webhook.indexOf("const newsAsk ="),
    );
    expect(branch).toContain('say("medicineUnavailable"');

    // A source that answered and had nothing is *not* a refusal any more.
    // openFDA holds US labels, so a name that is not in it is usually a box
    // sold under another name rather than a spelling somebody got wrong — and
    // "check the spelling" ended the conversation on a correct question. The
    // miss is logged and the message carries on to the assistant, which
    // answers it.
    expect(branch).toContain('log("medicine", { outcome: "not_found" });');
    expect(branch).not.toContain('say("medicineNone"');
  });

  it("gives each lookup a deadline, because Meta redelivers a slow answer", () => {
    expect(lookup).toContain("AbortSignal.timeout(MEDICINE_TIMEOUT_MS)");
    expect(medicines.MEDICINE_TIMEOUT_MS).toBeLessThanOrEqual(8000);
  });
});

describe("the row in the menu", () => {
  it("is switched on, under Health, and says what it gives", () => {
    const node = catalog.nodeById("health.medicine")!;
    expect(node.enabled).toBe(true);
    expect(node.parent).toBe("health");
    expect(node.phrase).toBeTruthy();
    for (const language of ["ar", "en"] as const) {
      expect(catalog.localized(node.intro!, language)).toBeTruthy();
    }
  });

  it("promises information rather than a prescription", () => {
    // The row is the first thing somebody reads. It should not sound like a
    // clinician.
    expect(catalog.localized(catalog.nodeById("health.medicine")!.intro!, "en"))
      .toMatch(/not a prescription/i);
  });
});
