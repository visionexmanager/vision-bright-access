import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { deliveryRuleFor } from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";
import {
  WHATSAPP_DOC_TARGETS,
  docSourceFormat,
  offeredDocTargets,
  parseDocConvertRequest,
  type DocFormat,
} from "../../supabase/functions/_shared/whatsappDocConvert.ts";
import { WHATSAPP_DELIVERABLE_TARGETS } from "../../supabase/functions/_shared/whatsappConvertFormats.ts";
import { FAMILY_OF_INPUT, OUTPUTS_BY_FAMILY, DOC_TARGETS } from "../../services/media-processor/src/docconvert.mjs";

const ask = (text: string, source: DocFormat) => parseDocConvertRequest({ text, source });

describe("document conversion on WhatsApp", () => {
  it.each([
    ["pdf to word", "pdf", "docx"],
    ["حوّل إلى وورد", "pdf", "docx"],
    ["word", "pdf", "docx"],
    ["وورد", "pdf", "docx"],
    ["docx", "pdf", "docx"],
    ["to text", "pdf", "txt"],
    ["txt", "docx", "txt"],
    ["pdf", "docx", "pdf"],
    ["word to pdf", "docx", "pdf"],
    ["حول الى بي دي اف", "docx", "pdf"],
    ["excel", "pdf", null],
    ["pdf", "xlsx", "pdf"],
    ["powerpoint", "pdf", null],
    ["pdf", "pptx", "pdf"],
    ["convert to word", "doc", "docx"],
  ])("%s (from %s) -> %s", (text, source, target) => {
    expect(ask(text, source as DocFormat)?.target ?? null).toBe(target);
  });

  it("leaves ordinary captions alone", () => {
    expect(ask("translate this word to French", "pdf")).toBeNull();
    expect(ask("ترجم هذا الى الانجليزية", "pdf")).toBeNull();
    expect(ask("what does this say?", "pdf")).toBeNull();
    expect(ask("", "pdf")).toBeNull();
    expect(ask("please read the whole text and summarise it for me in a few lines", "pdf")).toBeNull();
  });

  it("never converts a file to its own format, and refuses two names", () => {
    expect(ask("pdf", "pdf")).toBeNull();
    expect(ask("pdf and word", "txt")).toBeNull();
  });

  it("reads the source from the type, then from the name", () => {
    expect(docSourceFormat({ mimeType: "application/pdf" })).toBe("pdf");
    expect(docSourceFormat({ mimeType: "application/octet-stream", filename: "تقرير.DOCX" })).toBe("docx");
    expect(docSourceFormat({ mimeType: "application/zip", filename: "a.zip" })).toBeNull();
    expect(docSourceFormat({})).toBeNull();
  });

  it("offers only what the service makes and Meta will deliver", () => {
    for (const source of Object.keys(FAMILY_OF_INPUT) as DocFormat[]) {
      for (const target of offeredDocTargets(source)) {
        const family = FAMILY_OF_INPUT[source] as keyof typeof OUTPUTS_BY_FAMILY;
        expect(OUTPUTS_BY_FAMILY[family], `${source} -> ${target}`).toContain(target);
        expect(WHATSAPP_DELIVERABLE_TARGETS.has(target), target).toBe(true);
        expect(deliveryRuleFor(WHATSAPP_DOC_TARGETS[target].mime)?.kind, target).toBe("document");
        expect(DOC_TARGETS[target as keyof typeof DOC_TARGETS].mime.split(";")[0]).toBe(WHATSAPP_DOC_TARGETS[target].mime);
      }
    }
  });

  it("is wired to the document route and the queue", () => {
    const processor = readFileSync("supabase/functions/_shared/whatsappProcessor.ts", "utf8");
    expect(processor).toContain("/doc-convert");
    const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(webhook).toContain("parseDocConvertRequest");
  });
});
