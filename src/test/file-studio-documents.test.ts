import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getWorkingOutputFormats, requiresServer, detectModuleType } from "@/services/file-studio/engine";
import { SERVER_DOC_FAMILY, SERVER_DOC_OUTPUTS, serverDocumentTargets } from "@/services/file-studio/serverDocuments";
import {
  DOC_INPUT_NAMES,
  DOC_TARGET_NAMES,
  FAMILY_OF_INPUT,
  OUTPUTS_BY_FAMILY,
  OCR_MODELS,
  canConvertDocument,
} from "../../services/media-processor/src/docconvert.mjs";

describe("the page and the document engine agree", () => {
  it("shares one matrix with the service", () => {
    expect({ ...SERVER_DOC_FAMILY }).toEqual({ ...FAMILY_OF_INPUT });
    expect({ ...SERVER_DOC_OUTPUTS }).toEqual({ ...OUTPUTS_BY_FAMILY });
  });

  it("offers every pair the service accepts, and only those", () => {
    for (const from of DOC_INPUT_NAMES) {
      for (const to of DOC_TARGET_NAMES) {
        expect(serverDocumentTargets(from).includes(to), `${from} -> ${to}`).toBe(canConvertDocument(from, to));
      }
    }
  });

  it("opens PDF to Word, and Word and the Office family to PDF", () => {
    expect(getWorkingOutputFormats("document", "arabic.pdf")).toContain("docx");
    expect(getWorkingOutputFormats("document", "report.docx")).toContain("pdf");
    expect(getWorkingOutputFormats("document", "old.doc")).toContain("pdf");
    expect(getWorkingOutputFormats("document", "sheet.xlsx")).toContain("pdf");
    expect(getWorkingOutputFormats("document", "deck.pptx")).toContain("pdf");
    for (const name of ["a.pdf", "a.doc", "a.odt", "a.xls", "a.ods", "a.ppt", "a.odp"]) {
      expect(detectModuleType(name), name).toBe("document");
    }
  });

  it("says before the wait whether a conversion leaves the tab", () => {
    expect(requiresServer("document", "pdf", "report.docx")).toBe(true);
    expect(requiresServer("document", "docx", "paper.pdf")).toBe(true);
    expect(requiresServer("document", "txt", "report.docx")).toBe(false);
    expect(requiresServer("document", "docx", "notes.txt")).toBe(false);
  });

  it("routes the service's route through the function that holds the token", () => {
    const fn = readFileSync("supabase/functions/file-convert/index.ts", "utf8");
    expect(fn).toContain('"/doc-convert"');
    expect(fn).toContain("buildDocumentQuery");
    const server = readFileSync("services/media-processor/src/server.mjs", "utf8");
    expect(server).toContain('url.pathname === "/doc-convert"');
    expect(server).toContain("x-conversion-method");
  });

  it("installs a model for every language the reader may choose, and the script detector", () => {
    const docker = readFileSync("services/media-processor/Dockerfile", "utf8");
    expect(docker).toContain("tesseract-ocr-osd");
    for (const model of OCR_MODELS as string[]) {
      if (model === "ara") continue; // pinned separately, as the best-quality model
      expect(docker, model).toContain("tesseract-ocr-" + model.replace("_", "-"));
    }
  });

  it("lets a long PDF be followed as a job, on the site and in the function", () => {
    const fn = readFileSync("supabase/functions/file-convert/index.ts", "utf8");
    expect(fn).toContain("document-status");
    expect(fn).toContain("document-result");
    const client = readFileSync("src/services/file-studio/serverConvert.ts", "utf8");
    expect(client).toContain("followDocumentJob");
    const server = readFileSync("services/media-processor/src/server.mjs", "utf8");
    expect(server).toContain("/doc-job/");
  });

  it("installs the engine and an Arabic-capable font in the image", () => {
    const docker = readFileSync("services/media-processor/Dockerfile", "utf8");
    for (const pkg of ["libreoffice-writer", "libreoffice-calc", "libreoffice-impress", "libreoffice-draw", "fonts-noto-core", "fonts-hosny-amiri"]) {
      expect(docker, pkg).toContain(pkg);
    }
  });
});
