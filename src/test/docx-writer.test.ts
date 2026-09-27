import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { DOCX_MIME, blocksFromHtml, blocksFromMarkdown, blocksFromPlainText, buildDocx, isRtlText, xmlText, type DocxDocument } from "@/lib/documents/docx";
import { downloadResearchExport } from "@/lib/library/researchExport";
import { DocumentModule } from "@/services/file-studio/modules/documents";
import { readZip } from "@/services/file-studio/modules/archiveFormats";

// "DOCX" on this site used to be HTML saved as .doc. These build real
// documents, open the ZIP, and parse every XML part the way a word processor
// would. DOCX_OUT=<dir> also writes them there, for an independent reader.

const WHEN = new Date(Date.UTC(2026, 8, 28, 12, 0, 0));

// jsdom has no object URLs, and its Blob has neither text() nor arrayBuffer();
// every browser has all four. The same polyfill as file-studio-office.test.ts.
beforeAll(() => {
  if (!URL.createObjectURL) URL.createObjectURL = () => "blob:test";
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;
  const read = (blob: Blob, as: "text" | "buffer") => new Promise<string | ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string | ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    if (as === "text") reader.readAsText(blob);
    else reader.readAsArrayBuffer(blob);
  });
  if (!Blob.prototype.arrayBuffer) Blob.prototype.arrayBuffer = function (this: Blob) { return read(this, "buffer") as Promise<ArrayBuffer>; };
  if (!Blob.prototype.text) Blob.prototype.text = function (this: Blob) { return read(this, "text") as Promise<string>; };
});

async function open(name: string, doc: DocxDocument) {
  const bytes = await buildDocx(doc, WHEN);
  if (process.env.DOCX_OUT) {
    mkdirSync(process.env.DOCX_OUT, { recursive: true });
    writeFileSync(join(process.env.DOCX_OUT, `${name}.docx`), bytes);
  }
  const entries = await readZip(bytes);
  const parts = new Map(entries.map((e) => [e.name, new TextDecoder().decode(e.data)]));
  const xml = (part: string) => {
    const text = parts.get(part);
    expect(text, `${part} is in the package`).toBeDefined();
    const parsed = new DOMParser().parseFromString(text!, "application/xml");
    expect(parsed.getElementsByTagName("parsererror"), `${part} is well-formed XML`).toHaveLength(0);
    return parsed;
  };
  return { bytes, parts, xml };
}

const paragraphsOf = (doc: Document) =>
  [...doc.getElementsByTagName("w:p")].map((p) => ({
    style: p.getElementsByTagName("w:pStyle")[0]?.getAttribute("w:val") ?? null,
    bidi: p.getElementsByTagName("w:bidi").length > 0,
    bullet: p.getElementsByTagName("w:numPr").length > 0,
    text: [...p.getElementsByTagName("w:t")].map((t) => t.textContent).join(""),
  }));

describe("DOCX writer", () => {
  it("writes a real Word package: every part present and well-formed", async () => {
    const { bytes, parts, xml } = await open("english", {
      title: "Library project plan", subtitle: "A presentation for 2026", language: "en",
      blocks: [{ type: "heading", text: "Goals" }, { type: "bullet", text: "Grow readers by 40%" }, { type: "paragraph", text: "Line one\nLine two" }],
    });
    expect(new TextDecoder().decode(bytes.slice(0, 2))).toBe("PK");
    expect([...parts.keys()]).toEqual([
      "[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels",
      "word/styles.xml", "word/numbering.xml", "docProps/core.xml",
    ]);
    for (const part of parts.keys()) xml(part);
    const doc = xml("word/document.xml");
    expect(paragraphsOf(doc)).toEqual([
      { style: "Title", bidi: false, bullet: false, text: "Library project plan" },
      { style: "Subtitle", bidi: false, bullet: false, text: "A presentation for 2026" },
      { style: "Heading1", bidi: false, bullet: false, text: "Goals" },
      { style: "ListParagraph", bidi: false, bullet: true, text: "Grow readers by 40%" },
      { style: null, bidi: false, bullet: false, text: "Line oneLine two" },
    ]);
    // The line break is a break, not a new paragraph.
    expect(doc.getElementsByTagName("w:br")).toHaveLength(1);
    const core = xml("docProps/core.xml");
    expect(core.getElementsByTagName("dc:title")[0].textContent).toBe("Library project plan");
    expect(core.getElementsByTagName("dc:language")[0].textContent).toBe("en");
  });

  it("lays out Arabic right to left, paragraph by paragraph and page by page", async () => {
    const { xml } = await open("arabic", {
      title: "خطة مشروع المكتبة", language: "ar",
      blocks: [
        { type: "heading", text: "الأهداف" },
        { type: "bullet", text: "إطلاق Visionex Library في 20 مدرسة" },
        { type: "paragraph", text: "Visionex is a platform." },
        { type: "paragraph", text: "2026" },
      ],
    });
    const doc = xml("word/document.xml");
    const paragraphs = paragraphsOf(doc);
    expect(paragraphs.map((p) => p.bidi)).toEqual([true, true, true, false, true]);
    // An English paragraph in an Arabic document stays left to right; a
    // paragraph with no letters follows the document.
    expect(paragraphs[3].text).toBe("Visionex is a platform.");
    expect(doc.getElementsByTagName("w:sectPr")[0].getElementsByTagName("w:bidi")).toHaveLength(1);
    const runs = [...doc.getElementsByTagName("w:p")][1].getElementsByTagName("w:rtl");
    expect(runs.length).toBeGreaterThan(0);
    const styles = xml("word/styles.xml");
    expect(styles.getElementsByTagName("w:lang")[0].getAttribute("w:bidi")).toBe("ar");
  });

  it("escapes markup and drops characters XML cannot carry", async () => {
    const nul = String.fromCharCode(0);
    const vt = String.fromCharCode(11);
    const lone = String.fromCharCode(0xd800);
    const { xml } = await open("escaping", {
      title: `Tom & Jerry <script>"x"</script>${nul}`,
      blocks: [{ type: "paragraph", text: `a${vt}b${lone}c` }],
    });
    const paragraphs = paragraphsOf(xml("word/document.xml"));
    expect(paragraphs[0].text).toBe('Tom & Jerry <script>"x"</script>');
    expect(paragraphs[1].text).toBe("abc");
    expect(xmlText("<&>")).toBe("&lt;&amp;&gt;");
  });

  it("skips empty blocks rather than writing empty paragraphs", async () => {
    const { xml } = await open("empty", { title: "T", blocks: [{ type: "bullet", text: "  " }, { type: "paragraph", text: "x" }] });
    expect(paragraphsOf(xml("word/document.xml")).map((p) => p.text)).toEqual(["T", "x"]);
  });

  it("turns Markdown and HTML structure into Word structure", () => {
    expect(blocksFromMarkdown("# Plan\n\nIntro **bold** and [a link](https://x.org).\nSame paragraph.\n\n## Goals\n- one\n* two\n1. three")).toEqual([
      { type: "heading", level: 1, text: "Plan" },
      { type: "paragraph", text: "Intro bold and a link (https://x.org). Same paragraph." },
      { type: "heading", level: 2, text: "Goals" },
      { type: "bullet", text: "one" },
      { type: "bullet", text: "two" },
      { type: "bullet", text: "three" },
    ]);
    expect(blocksFromHtml("<h1>Plan</h1><p>Intro</p><ul><li><p>one</p></li><li>two</li></ul><script>x()</script>")).toEqual([
      { type: "heading", level: 1, text: "Plan" },
      { type: "paragraph", text: "Intro" },
      { type: "bullet", text: "one" },
      { type: "bullet", text: "two" },
    ]);
    expect(blocksFromPlainText("a\nb\n\n\nc")).toEqual([{ type: "paragraph", text: "a\nb" }, { type: "paragraph", text: "c" }]);
  });

  it("converts a Markdown file to a Word document in File Studio", async () => {
    const file = new File(["# خطة\n\n- أولاً\n- ثانياً"], "plan.md", { type: "text/markdown" });
    const result = await DocumentModule.convert(file, { targetFormat: "docx" } as never, () => undefined);
    expect(result.success).toBe(true);
    expect(result.resultBlob!.type).toBe(DOCX_MIME);
    const entries = await readZip(new Uint8Array(await result.resultBlob!.arrayBuffer()));
    const document = new TextDecoder().decode(entries.find((e) => e.name === "word/document.xml")!.data);
    const doc = new DOMParser().parseFromString(document, "application/xml");
    expect(paragraphsOf(doc)).toEqual([
      { style: "Title", bidi: false, bullet: false, text: "plan" },
      { style: "Heading1", bidi: true, bullet: false, text: "خطة" },
      { style: "ListParagraph", bidi: true, bullet: true, text: "أولاً" },
      { style: "ListParagraph", bidi: true, bullet: true, text: "ثانياً" },
    ]);
  });

  it("exports a research project as a real .docx, not HTML saved as .doc", async () => {
    let blob: Blob | null = null;
    let name = "";
    const createObjectURL = URL.createObjectURL;
    URL.createObjectURL = ((b: Blob) => { blob = b; return "blob:x"; }) as typeof URL.createObjectURL;
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { name = this.download; };
    try {
      await downloadResearchExport({
        projectTitle: "Reading study", projectDescription: "Why people read.",
        items: [{ itemType: "reference", title: "Atomic Habits", citation: "James Clear (2016). Atomic Habits." }],
      }, "docx");
    } finally {
      URL.createObjectURL = createObjectURL;
      HTMLAnchorElement.prototype.click = click;
    }
    expect(name).toBe("Reading study.docx");
    expect(blob!.type).toBe(DOCX_MIME);
    const entries = await readZip(new Uint8Array(await blob!.arrayBuffer()));
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(entries.find((e) => e.name === "word/document.xml")!.data), "application/xml");
    expect(paragraphsOf(doc).map((p) => [p.style, p.text])).toEqual([
      ["Title", "Reading study"], [null, "Why people read."], ["Heading2", "Atomic Habits"], [null, "James Clear (2016). Atomic Habits."],
    ]);
  });

  it("decides direction from the first strong letter", () => {
    expect(isRtlText("١٢٣ مرحبا")).toBe(true);
    expect(isRtlText("(2026) Hello مرحبا")).toBe(false);
    expect(isRtlText("123", true)).toBe(true);
    expect(isRtlText("שלום")).toBe(true);
  });
});
