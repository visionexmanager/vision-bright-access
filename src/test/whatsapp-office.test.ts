// Reading a Word document or a slide deck locally.
//
// ── What is actually being protected here ───────────────────────────────────
//
// This is the first local capability that *replaces a refusal* rather than a
// provider call. Local OCR and barcode scanning both fall through to a model
// when they fail, so their worst case is the behaviour that existed before
// them. This one has no model behind it: a `.docx` was answered with "I can't
// open Word files yet" and now it is unpacked, so if the unpacker is wrong the
// sender gets a wrong answer where they used to get an honest refusal.
//
// That changes what the tests have to cover. It is not enough to check the
// happy path and the fall-through. The archive reader is being handed files
// that arrived from the internet, so the interesting cases are the malformed
// ones: a ZIP that is not a ZIP, one whose directory points past the end of the
// file, one that declares a small entry and contains a large one, and one built
// specifically to expand until the container dies.
//
// The fixtures are real archives, built here with `zlib.deflateRawSync` and a
// hand-written central directory, rather than recorded blobs. A recorded blob
// cannot be made hostile on purpose.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";

async function office() {
  return await import("../../services/media-processor/src/office.mjs");
}

async function client() {
  return await import("../../supabase/functions/_shared/whatsappOffice.ts");
}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const CONFIG = { url: "https://visionex.app/internal/media", token: "t0ken" };

// ── A ZIP writer ────────────────────────────────────────────────────────────
//
// `zlib.crc32` exists only from Node 20.15, and CI runs Node 20. Eight lines of
// table-free CRC removes the version question entirely — and nothing in the
// extractor verifies the CRC anyway, so this is here to make the fixtures real
// archives rather than to satisfy a check.

function crc32(buffer: Buffer): number {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

interface ZipOptions {
  /** Store rather than deflate, which some writers do for small parts. */
  store?: boolean;
  /** Claim a different uncompressed size than the entry really has. */
  lieAboutSize?: number;
  /** Corrupt the end-of-central-directory offset. */
  breakOffset?: boolean;
}

function buildZip(files: Record<string, string | Buffer>, options: ZipOptions = {}): Uint8Array {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const body = options.store ? raw : deflateRawSync(raw);
    const nameBytes = Buffer.from(name, "ascii");
    const crc = crc32(raw);
    const declared = options.lieAboutSize ?? raw.length;

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(options.store ? 0 : 8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(declared, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);
    locals.push(local, body);

    const dir = Buffer.alloc(46 + nameBytes.length);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(options.store ? 0 : 8, 10);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(declared, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt32LE(offset, 42);
    nameBytes.copy(dir, 46);
    central.push(dir);

    offset += local.length + body.length;
  }

  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length, 8);
  eocd.writeUInt16LE(central.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(options.breakOffset ? 0xfffffff0 : offset, 16);

  return new Uint8Array(Buffer.concat([...locals, directory, eocd]));
}

const wordDocument = (body: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://x"><w:body>${body}</w:body></w:document>`;

const docx = (body: string, extra: Record<string, string> = {}) =>
  buildZip({ "[Content_Types].xml": "<Types/>", "word/document.xml": wordDocument(body), ...extra });

describe("pulling the words out of the markup", () => {
  it("reads a paragraph and keeps its line break", async () => {
    const { extractOfficeText } = await office();
    const file = docx("<w:p><w:r><w:t>First line</w:t></w:r></w:p><w:p><w:r><w:t>Second line</w:t></w:r></w:p>");
    const read = extractOfficeText(file, "docx");
    expect(read.ok).toBe(true);
    // Structure carries meaning: an address, a list of ingredients and a set of
    // bullets all stop being usable when they are run into one line, and this
    // text is going to be read aloud to somebody who cannot see the layout.
    expect(read.text).toBe("First line\nSecond line");
  });

  it("joins the runs inside one paragraph, because Word splits mid-sentence", async () => {
    const { extractOfficeText } = await office();
    // Word starts a new run at every formatting change, so a single bolded word
    // splits a sentence into three. Treating each run as a line would shred it.
    const file = docx('<w:p><w:r><w:t xml:space="preserve">Take </w:t></w:r><w:r><w:t>two</w:t></w:r><w:r><w:t xml:space="preserve"> tablets</w:t></w:r></w:p>');
    expect(extractOfficeText(file, "docx").text).toBe("Take two tablets");
  });

  it("reads text in any script, which is the point of doing it this way", async () => {
    const { extractOfficeText } = await office();
    // Local OCR is English-only because Arabic recognition does not work on
    // this box. That limitation does not reach here: the text in a `.docx` is
    // already text, and unzipping has no opinion about script.
    const file = docx("<w:p><w:r><w:t>موعد الفحص يوم الثلاثاء</w:t></w:r></w:p>");
    expect(extractOfficeText(file, "docx").text).toBe("موعد الفحص يوم الثلاثاء");
  });

  it("decodes the entities OOXML uses, including numeric ones", async () => {
    const { extractOfficeText } = await office();
    const file = docx("<w:p><w:r><w:t>Tom &amp; Jerry &#1605;&#1585;&#1581;&#1576;&#1575; &#x41;</w:t></w:r></w:p>");
    expect(extractOfficeText(file, "docx").text).toBe("Tom & Jerry مرحبا A");
  });

  it("ignores everything that is not a text element", async () => {
    const { extractOfficeText } = await office();
    // Stripping every tag instead would be shorter and would sweep up revision
    // identifiers, style names and relationship targets — handing the model
    // somebody's document plus a page of noise.
    const file = docx(
      '<w:p w:rsidR="00AB12CD"><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Only this</w:t></w:r></w:p>',
    );
    expect(extractOfficeText(file, "docx").text).toBe("Only this");
  });

  it("puts a deck's slides back in the order a person reads them", async () => {
    const { extractOfficeText } = await office();
    // The archive lists slide10 before slide2, and a string sort would leave it
    // there. Ten slides is a small deck; forty is normal.
    const deck = buildZip({
      "ppt/slides/slide10.xml": "<a:p><a:t>ten</a:t></a:p>",
      "ppt/slides/slide2.xml": "<a:p><a:t>two</a:t></a:p>",
      "ppt/slides/slide1.xml": "<a:p><a:t>one</a:t></a:p>",
    });
    const read = extractOfficeText(deck, "pptx");
    expect(read.ok).toBe(true);
    expect(read.text).toBe("one\n\ntwo\n\nten");
    expect(read.parts).toBe(3);
  });

  it("reads an entry that was stored rather than deflated", async () => {
    const { extractOfficeText } = await office();
    const file = buildZip({ "word/document.xml": wordDocument("<w:p><w:r><w:t>stored</w:t></w:r></w:p>") }, { store: true });
    expect(extractOfficeText(file, "docx").text).toBe("stored");
  });

  it("calls a file with no words in it `no_text`, not a failure to open it", async () => {
    const { extractOfficeText } = await office();
    // A deck that is entirely photographs is a real thing to send, and what the
    // sender should do about it — photograph the slide — is different from what
    // they should do about a file that would not open.
    const file = docx("<w:p><w:r><w:drawing/></w:r></w:p>");
    expect(extractOfficeText(file, "docx")).toEqual({ ok: false, reason: "no_text" });
  });
});

describe("archives that are not what they say they are", () => {
  it("refuses something that is not a ZIP at all", async () => {
    const { extractOfficeText } = await office();
    expect(extractOfficeText(new Uint8Array([1, 2, 3, 4, 5]), "docx")).toEqual({ ok: false, reason: "not_a_zip" });
  });

  it("refuses a directory that points past the end of the file", async () => {
    const { extractOfficeText } = await office();
    const file = docx("<w:p><w:r><w:t>x</w:t></w:r></w:p>");
    expect(extractOfficeText(buildZip({ "word/document.xml": "x" }, { breakOffset: true }), "docx").ok).toBe(false);
    // And the intact one still reads, so the test above is testing the damage
    // rather than the fixture.
    expect(extractOfficeText(file, "docx").ok).toBe(true);
  });

  it("refuses an archive with no part it knows how to read", async () => {
    const { extractOfficeText } = await office();
    const file = buildZip({ "notes.txt": "hello", "[Content_Types].xml": "<Types/>" });
    expect(extractOfficeText(file, "docx")).toEqual({ ok: false, reason: "no_text_part" });
  });

  it("refuses a format it was not built for", async () => {
    const { extractOfficeText } = await office();
    // `.xlsx` above all: extracting a spreadsheet's shared strings returns an
    // invoice with every line item and no amounts, which is worse than a
    // refusal for somebody who cannot see the file.
    expect(extractOfficeText(docx("<w:p><w:t>x</w:t></w:p>"), "xlsx")).toEqual({ ok: false, reason: "unsupported_kind" });
  });

  it("stops an entry that expands past the ceiling instead of inflating it", async () => {
    const { extractOfficeText, MAX_ENTRY_BYTES } = await office();
    // The declaration is a claim, so it is checked before the decoder runs.
    // This entry is a few hundred bytes and says it is twenty megabytes.
    const file = buildZip(
      { "word/document.xml": wordDocument("<w:p><w:r><w:t>x</w:t></w:r></w:p>") },
      { lieAboutSize: MAX_ENTRY_BYTES + 1 },
    );
    expect(extractOfficeText(file, "docx")).toEqual({ ok: false, reason: "entry_too_large" });
  });

  it("runs out of archive budget rather than unpacking the whole thing", async () => {
    const { readEntry, readCentralDirectory, MAX_ENTRY_BYTES } = await office();
    // Incompressible content on purpose, so this test is about the *budget* and
    // not about the ratio guard below — a megabyte of one repeated byte would
    // be stopped a step earlier and this would prove nothing about the budget.
    // A seeded xorshift rather than a multiple of the index: `i * k & 0xff`
    // looks random and deflates 240 to 1, which trips the ratio guard and would
    // have made this test pass for the wrong reason.
    const noise = Buffer.alloc(1024 * 1024);
    let state = 0x9e3779b9;
    for (let i = 0; i < noise.length; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      noise[i] = state & 0xff;
    }

    const bytes = buildZip({ "word/document.xml": noise });
    const directory = readCentralDirectory(bytes);
    expect(directory.ok).toBe(true);

    const entry = directory.entries.find((e: { name: string }) => e.name === "word/document.xml");
    expect(readEntry(bytes, entry, { remaining: 4_096 })).toEqual({ ok: false, reason: "archive_too_large" });

    // And with room, the same entry reads — so the refusal above is the budget
    // and not a broken fixture.
    expect(readEntry(bytes, entry, { remaining: MAX_ENTRY_BYTES }).ok).toBe(true);
  });

  it("refuses an entry that expands the way a bomb expands", async () => {
    const { extractOfficeText } = await office();
    // A megabyte of one repeated byte deflates to about a kilobyte: a thousand
    // to one, past the ratio ceiling and past the size floor that stops the
    // ceiling from firing on ordinary documents.
    const bomb = buildZip({ "word/document.xml": Buffer.alloc(2 * 1024 * 1024, 0x41) });
    expect(extractOfficeText(bomb, "docx")).toEqual({ ok: false, reason: "suspicious_ratio" });
  });

  it("does not refuse a real document for compressing well", async () => {
    const { extractOfficeText, RATIO_CHECK_FLOOR_BYTES } = await office();
    // A line of dashes, a paragraph of spaces, a repeated heading: all compress
    // several hundred times and are completely ordinary. A ratio check with no
    // size floor refuses these, which is why there is a floor.
    const file = docx(`<w:p><w:r><w:t>${"-".repeat(4_000)}</w:t></w:r></w:p>`);
    const read = extractOfficeText(file, "docx");
    expect(read.ok).toBe(true);
    expect(RATIO_CHECK_FLOOR_BYTES).toBeGreaterThan(4_000);
  });
});

describe("the client, and every way it declines to answer", () => {
  const answering = (status: number, body: unknown): typeof fetch =>
    (async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })) as unknown as typeof fetch;

  it("is off, quietly, when the service is not configured", async () => {
    const { readOfficeLocally } = await client();
    const result = await readOfficeLocally({ bytes: new Uint8Array([0x50, 0x4b]), mimeType: DOCX_MIME, config: null });
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  it("refuses a format it does not read before opening a connection", async () => {
    const { readOfficeLocally } = await client();
    let called = false;
    const result = await readOfficeLocally({
      bytes: new Uint8Array([0x50, 0x4b]),
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      config: CONFIG,
      fetchImpl: (async () => {
        called = true;
        return new Response("{}");
      }) as unknown as typeof fetch,
    });
    expect(result).toEqual({ ok: false, reason: "unsupported_kind" });
    expect(called).toBe(false);
  });

  it("collapses every archive fault into one thing the sender can act on", async () => {
    const { readOfficePayload } = await client();
    // "The ZIP end-of-central-directory record is malformed" helps nobody. The
    // distinctions stay in the service's log, which is where they are useful.
    for (const reason of ["not_a_zip", "truncated", "inflate_failed", "suspicious_ratio", "zip64_unsupported"]) {
      expect(readOfficePayload({ ok: false, reason })).toEqual({ ok: false, reason: "corrupt" });
    }
  });

  it("keeps `no_text` separate, because it needs different advice", async () => {
    const { readOfficePayload } = await client();
    expect(readOfficePayload({ ok: false, reason: "no_text" })).toEqual({ ok: false, reason: "no_text" });
    // And a successful answer with nothing in it is the same outcome.
    expect(readOfficePayload({ ok: true, text: "   " })).toEqual({ ok: false, reason: "no_text" });
  });

  it("refuses an answer that is not the shape it claims", async () => {
    const { readOfficePayload } = await client();
    for (const bad of [null, "text", 7, {}, { ok: true }, { ok: true, text: 42 }]) {
      expect(readOfficePayload(bad).ok).toBe(false);
    }
  });

  it("gives up on its own deadline rather than holding the reply", async () => {
    const { readOfficeLocally } = await client();
    const hangs: typeof fetch = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })) as unknown as typeof fetch;

    const result = await readOfficeLocally({
      bytes: new Uint8Array([0x50, 0x4b]),
      mimeType: DOCX_MIME,
      config: CONFIG,
      fetchImpl: hangs,
      timeoutMs: 20,
    });
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("reads a 503 as the two workers being full", async () => {
    const { readOfficeLocally } = await client();
    const result = await readOfficeLocally({
      bytes: new Uint8Array([0x50, 0x4b]),
      mimeType: PPTX_MIME,
      config: CONFIG,
      fetchImpl: answering(503, { ok: false, reason: "busy" }),
    });
    expect(result).toEqual({ ok: false, reason: "busy" });
  });

  it("returns the words when the service found some", async () => {
    const { readOfficeLocally } = await client();
    const result = await readOfficeLocally({
      bytes: new Uint8Array([0x50, 0x4b]),
      mimeType: DOCX_MIME,
      config: CONFIG,
      fetchImpl: answering(200, { ok: true, readable: true, text: "موعد الفحص", chars: 10, parts: 1, ms: 12 }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.text).toBe("موعد الفحص");
  });
});

describe("what the sender is told", () => {
  it("no longer claims Word files cannot be opened", async () => {
    const { unsupportedDocumentNotice } = await import("../../supabase/functions/_shared/whatsappAttachments.ts");
    // The old sentence is now false, and a false refusal is worse than a vague
    // one: it sends somebody off to export a PDF they did not need to make.
    for (const language of ["ar", "en"] as const) {
      const notice = unsupportedDocumentNotice(language);
      expect(notice).toContain("Word");
      expect(notice).not.toMatch(/can't open Word|لا أستطيع فتح ملفات Word/);
    }
  });

  it("says something different for a file that opened and one that would not", async () => {
    const { emptyOfficeNotice, corruptOfficeNotice } = await client();
    for (const language of ["ar", "en"] as const) {
      expect(emptyOfficeNotice(language, "pptx")).not.toBe(corruptOfficeNotice(language));
      expect(emptyOfficeNotice(language, "pptx")).not.toBe(emptyOfficeNotice(language, "docx"));
    }
  });
});

describe("the format policy, in one place", () => {
  it("classifies the two formats the service can unpack, and nothing else", async () => {
    const { classifyDocument } = await import("../../supabase/functions/_shared/whatsappAttachments.ts");
    expect(classifyDocument(DOCX_MIME)).toBe("office");
    expect(classifyDocument(PPTX_MIME)).toBe("office");
    expect(classifyDocument("application/pdf")).toBe("pdf");
    expect(classifyDocument("text/plain")).toBe("text");
    // Still declined, and deliberately.
    expect(classifyDocument("application/msword")).toBe("unsupported");
    expect(classifyDocument("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe("unsupported");
  });

  it("lets a deck past the download allowlist, which refused it one step earlier", async () => {
    const { ALLOWED_MIME } = await import("../../supabase/functions/_shared/whatsappMedia.ts");
    // Without this the unpacker would be reachable only by a `.docx`: a `.pptx`
    // was refused at the allowlist, before anything looked at the bytes.
    expect(ALLOWED_MIME.document).toContain(PPTX_MIME);
    expect(ALLOWED_MIME.document).toContain(DOCX_MIME);
  });

  it("agrees with the service and with nginx about how big a document may be", async () => {
    const { MAX_OFFICE_UPLOAD_BYTES } = await client();
    const { MEDIA_LIMITS } = await import("../../supabase/functions/_shared/whatsappMedia.ts");
    // Three ceilings on one path again. The Edge Function will download twelve
    // megabytes, so a service or a proxy that refuses at eight turns a readable
    // file into a 413 with no useful message anywhere.
    expect(MAX_OFFICE_UPLOAD_BYTES).toBe(MEDIA_LIMITS.document);

    const limits = readFileSync("services/media-processor/src/limits.mjs", "utf8");
    const declared = /MAX_DOCUMENT_BYTES\s*=\s*([\d\s*_]+)/.exec(limits)?.[1] ?? "";
    const product = declared.split("*").map((part) => Number(part.trim().replace(/_/g, ""))).reduce((a, b) => a * b, 1);
    expect(product).toBe(MAX_OFFICE_UPLOAD_BYTES);

    const nginx = readFileSync("services/media-processor/nginx/visionex-media.location.conf", "utf8");
    const bodyLimit = Number(/client_max_body_size\s+(\d+)m/.exec(nginx)?.[1]);
    // nginx sits in front of both endpoints, so it must admit the larger.
    expect(bodyLimit * 1024 * 1024).toBe(MAX_OFFICE_UPLOAD_BYTES);
  });
});
