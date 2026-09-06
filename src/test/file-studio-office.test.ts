// ─── Reading a Word document and a deck in the browser ───────────────────────
//
// The fixtures here are built the way Word and PowerPoint build one — a ZIP of
// OOXML parts — so what is under test is the whole path: the ZIP reader written
// for the archive module, the part selection, the ordering, and the extraction.
//
// The rules are `services/media-processor/src/office.mjs`'s rules, on purpose.
// The last test in this file reads that file and fails if the two drift, which
// is the only thing standing between "one set of rules, two runtimes" and two
// implementations that quietly disagree about somebody's document.

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { writeZip } from "@/services/file-studio/modules/archiveFormats";
import { officeText, textFromOoxml } from "@/services/file-studio/modules/officeText";
import { DocumentModule } from "@/services/file-studio/modules/documents";
import { getWorkingOutputFormats } from "@/services/file-studio/engine";

const enc = new TextEncoder();

const docParagraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;

const docxBytes = (paragraphs: string[]) =>
  writeZip([
    { name: "[Content_Types].xml", data: enc.encode("<Types/>") },
    {
      name: "word/document.xml",
      data: enc.encode(
        `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${paragraphs.join("")}</w:body></w:document>`,
      ),
    },
    // Repeated on every page, and deliberately not read.
    { name: "word/header1.xml", data: enc.encode(`<w:hdr>${docParagraph("VISIONEX LLC")}</w:hdr>`) },
  ]);

const slide = (n: number, text: string) => ({
  name: `ppt/slides/slide${n}.xml`,
  data: enc.encode(`<p:sld xmlns:a="x"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`),
});

const fileOf = (name: string, bytes: Uint8Array): File =>
  new File([bytes as unknown as BlobPart], name);

/** jsdom's Blob has neither `text()` nor `arrayBuffer()`; every browser has both. */
const blobText = async (blob: Blob): Promise<string> =>
  new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));

beforeAll(() => {
  if (!URL.createObjectURL) URL.createObjectURL = () => "blob:test";
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function readAsBuffer(this: Blob) {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

describe("the words out of OOXML", () => {
  it("reads only the elements that hold visible text", () => {
    const xml =
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Calibri"/></w:rPr>' +
      "<w:t>Visible</w:t></w:r></w:p>";
    // A tag-stripping reader would return the style name and the font as well.
    expect(textFromOoxml(xml)).toBe("Visible");
  });

  it("keeps paragraphs apart, because an address run into one line is not an address", () => {
    expect(textFromOoxml(`${docParagraph("12 Hamra Street")}${docParagraph("Beirut")}`)).toBe(
      "12 Hamra Street\nBeirut",
    );
  });

  it("turns tabs and line breaks into the space they are", () => {
    expect(textFromOoxml("<w:p><w:r><w:t>a</w:t><w:tab/><w:t>b</w:t><w:br/><w:t>c</w:t></w:r></w:p>"))
      .toBe("a b c");
  });

  it("decodes the entities OOXML writes, named and numeric", () => {
    expect(textFromOoxml("<w:t>Tom &amp; Jerry &#x627;&#1604;&#1587;&#1604;&#1575;&#1605;</w:t>")).toBe(
      "Tom & Jerry السلام",
    );
  });
});

describe("a .docx, read as the archive it is", () => {
  it("returns the body and not the letterhead", async () => {
    const text = await officeText(
      await docxBytes([docParagraph("First line."), docParagraph("Second line.")]),
      "docx",
    );
    expect(text).toBe("First line.\nSecond line.");
    expect(text).not.toContain("VISIONEX LLC");
  });

  it("says what is wrong when the file is not one", async () => {
    await expect(officeText(enc.encode("this is a .doc from 1997"), "docx")).rejects.toThrow(
      /isn't a readable DOCX/i,
    );
  });

  it("says so rather than returning an empty file when there is no text", async () => {
    await expect(
      officeText(await writeZip([{ name: "word/document.xml", data: enc.encode("<w:document/>") }]), "docx"),
    ).rejects.toThrow(/no text|no readable text/i);
  });
});

describe("a .pptx", () => {
  it("puts slide 10 after slide 9, not next to slide 1", async () => {
    const deck = await writeZip([
      slide(10, "ten"),
      slide(1, "one"),
      slide(9, "nine"),
      slide(2, "two"),
    ]);
    expect((await officeText(deck, "pptx")).split(/\n{2,}/)).toEqual(["one", "two", "nine", "ten"]);
  });
});

describe("the document module, as the page uses it", () => {
  it("hands back the text of a Word document", async () => {
    const file = fileOf("report.docx", await docxBytes([docParagraph("Hello Visionex.")]));
    const result = await DocumentModule.convert(file, { targetFormat: "txt" }, () => {});
    expect(result.success).toBe(true);
    expect(await blobText(result.resultBlob!)).toBe("Hello Visionex.");
  });

  it("writes HTML with paragraphs rather than one preformatted block", async () => {
    const file = fileOf("report.docx", await docxBytes([docParagraph("One."), docParagraph("Two <b>.")]));
    const result = await DocumentModule.convert(file, { targetFormat: "html" }, () => {});
    const html = await blobText(result.resultBlob!);
    expect(html).toContain("<p>One.<br>Two &lt;b&gt;.</p>");
    expect(html).not.toContain("<pre>");
  });

  it("offers exactly what it implements", () => {
    expect(getWorkingOutputFormats("document", "report.docx")).toEqual(["txt", "html"]);
    expect(getWorkingOutputFormats("document", "deck.pptx")).toEqual(["txt", "html"]);
    // Writing a PDF or a Word file needs a document engine this project does
    // not run. Reading one and writing one are not the same capability.
    expect(getWorkingOutputFormats("document", "paper.pdf")).toEqual([]);
    expect(getWorkingOutputFormats("document", "report.docx")).not.toContain("docx");
  });
});

describe("one set of rules, two runtimes", () => {
  it("extracts with the same expression the WhatsApp assistant does", () => {
    const server = readFileSync("services/media-processor/src/office.mjs", "utf8");
    const browser = readFileSync("src/services/file-studio/modules/officeText.ts", "utf8");
    // The pattern is the rule: which elements hold text, what ends a paragraph,
    // what becomes a space. If one side changes it, this fails and the other
    // side gets changed with it.
    const pattern = /const pattern = (\/.+\/g);/;
    const fromServer = pattern.exec(server)?.[1];
    const fromBrowser = pattern.exec(browser)?.[1];
    // Two undefineds are equal to each other, and comparing them would pass for
    // ever while both files said whatever they liked.
    expect(fromServer).toMatch(/w\|a/);
    expect(fromBrowser).toBe(fromServer);
    for (const part of ["^word\\/document\\.xml$", "^ppt\\/slides\\/slide\\\\d+\\.xml$"]) {
      const escaped = part.replace(/\\\\/g, "\\");
      expect(server, escaped).toContain(escaped);
      expect(browser, escaped).toContain(escaped);
    }
  });
});
