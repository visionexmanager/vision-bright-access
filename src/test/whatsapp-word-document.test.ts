import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  documentFileName, documentFromAnswer, wantsWordDocument, WORD_DOCUMENT_DIRECTIVE,
} from "../../supabase/functions/_shared/whatsappWordDocument.ts";
import { buildDocx } from "../../supabase/functions/_shared/docxDocument.ts";
import { readZip } from "../../supabase/functions/_shared/archiveFormats.ts";
import { deliveryRuleFor } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";

// «سيرة ذاتية لمهندس مدني كملف وورد» — the answer, as a .docx on WhatsApp.

describe("asking for a Word file", () => {
  it("is recognised when a file is asked for, in Arabic and English", () => {
    for (const text of [
      "سيرة ذاتية لمهندس مدني كملف وورد",
      "اكتبلي خطة درس عن الكسور بصيغة وورد",
      "ابعتلي ياها ملف word",
      "بدي مستند وورد عن تاريخ لبنان",
      "a lesson plan on fractions as a Word document",
      "write my CV in Word format",
      "send it as a word file please",
      "cover letter, docx",
      "ملف وورد",
      "word document",
    ]) expect(wantsWordDocument(text), text).toBe(true);
  });

  it("is not triggered by the word on its own", () => {
    for (const text of [
      "what does the word ephemeral mean?",
      "give me a word that rhymes with orange",
      "in other words, no",
      "وورد بريس شو هو؟",
      "كلمة سر",
      "",
      null,
    ]) expect(wantsWordDocument(text), String(text)).toBe(false);
  });

  it("tells the model to write the document itself, in Markdown", () => {
    expect(WORD_DOCUMENT_DIRECTIVE).toMatch(/\.docx/);
    expect(WORD_DOCUMENT_DIRECTIVE).toMatch(/'# '/);
    expect(WORD_DOCUMENT_DIRECTIVE).toMatch(/no greeting, no preamble/);
  });
});

describe("the answer as a document", () => {
  it("takes the first heading as the title and keeps the rest as structure", () => {
    const doc = documentFromAnswer("# سيرة ذاتية\n\n## الخبرات\n- مهندس موقع\n- مشرف\n\nنص ختامي.", "ar", "ملف وورد");
    expect(doc).toEqual({
      title: "سيرة ذاتية",
      language: "ar",
      blocks: [
        { type: "heading", level: 2, text: "الخبرات" },
        { type: "bullet", text: "مهندس موقع" },
        { type: "bullet", text: "مشرف" },
        { type: "paragraph", text: "نص ختامي." },
      ],
    });
  });

  it("uses a short first line as the title when the model left out the '#'", () => {
    expect(documentFromAnswer("Lesson plan\n\nIntro text.", "en", "Word document").title).toBe("Lesson plan");
    expect(documentFromAnswer("Only one paragraph here.", "en", "Word document").title).toBe("Word document");
  });

  it("builds a .docx WhatsApp accepts as a document", async () => {
    const doc = documentFromAnswer("# خطة\n\n- أولاً", "ar", "ملف وورد");
    const bytes = await buildDocx(doc);
    const rule = deliveryRuleFor("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(rule?.kind).toBe("document");
    expect(rule!.looksRight(bytes)).toBe(true);
    const names = (await readZip(bytes)).map((e) => e.name);
    expect(names).toContain("word/document.xml");
  });

  it("names the file after its title, in any script, safely", () => {
    expect(documentFileName("سيرة ذاتية: مهندس/مدني")).toBe("سيرة-ذاتية-مهندس-مدني.docx");
    expect(documentFileName("Lesson plan — fractions (Grade 5)")).toBe("Lesson-plan-fractions-Grade-5.docx");
    expect(documentFileName("../../etc/passwd")).toBe("etc-passwd.docx");
    expect(documentFileName("!!!")).toBe("visionex-document.docx");
    expect(documentFileName("x".repeat(200)).length).toBeLessThanOrEqual(65);
  });
});

describe("the webhook", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("asks once, and only a typed request becomes a file", () => {
    expect(webhook).toContain("const wantsDocument = !spokenInput && wantsWordDocument(questionText);");
    expect(webhook).toContain("wantsDocument ? WORD_DOCUMENT_DIRECTIVE : null,");
    expect(webhook.indexOf("const wantsDocument")).toBeLessThan(webhook.indexOf("const asked = await askAssistant("));
  });

  it("sends the text instead whenever the file was not delivered", () => {
    const at = webhook.indexOf("let sentAsDocument = false;");
    const block = webhook.slice(at, webhook.indexOf("await saveSession();", at));
    expect(block).toContain('sentAsDocument = delivered.outcome.startsWith("delivered_");');
    expect(block).toMatch(/if \(!sentAsDocument\) \{\s+const parts = spokenInput \? \[answer\] : splitAnswer\(answer, limits\);/);
    // The answer is spent for once, before either path.
    expect(webhook.indexOf('await spent("ai");')).toBeLessThan(at);
  });
});
