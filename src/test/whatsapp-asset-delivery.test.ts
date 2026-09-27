import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

// Phase 2A: one way to put a file in front of a WhatsApp sender.
// Upload, send, retry what is transient, fall back to a link only when the
// file itself cannot be delivered, and never report a delivery that did not happen.

import {
  deliverAsset,
  deliveryCaption,
  deliveryFallbackText,
  deliveryLogFields,
  deliveryRuleFor,
  fetchAssetBytes,
  isDeliverableMime,
  isFetchableAssetUrl,
  safeFileName,
} from "../../supabase/functions/_shared/whatsappAssetDelivery.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.4\n...");
const MP3 = new TextEncoder().encode("ID3\u0004rest");
const MP4 = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypisom"), 1, 2]);
const DOCX = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
const OGG_OPUS = new TextEncoder().encode("OggS\u0000\u0002....OpusHead....");
const OGG_VORBIS = new TextEncoder().encode("OggS\u0000\u0002....\u0001vorbis....");
const HTML = new TextEncoder().encode("<!doctype html><title>error</title>");

type Call = { url: string; method: string; body: unknown };

/** A Graph API that answers each call from a script, recording what it was asked. */
function graph(script: Array<{ status: number; json?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit = {}) => {
    const body = init.body instanceof FormData
      ? Object.fromEntries([...init.body.entries()].map(([k, v]) => [k, typeof v === "string" ? v : (v as File).name]))
      : init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url: String(url), method: init.method ?? "GET", body });
    const next = script.shift() ?? { status: 200, json: {} };
    return new Response(JSON.stringify(next.json ?? {}), { status: next.status });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const UPLOAD_OK = { status: 200, json: { id: "media-1" } };
const SEND_OK = { status: 200, json: { messages: [{ id: "wamid" }] } };
const base = { phoneNumberId: "PN", token: "TOKEN", to: "15550001111", sleep: async () => {} };
const uploads = (calls: Call[]) => calls.filter((c) => c.url.endsWith("/media"));
const messages = (calls: Call[]) => calls.filter((c) => c.url.endsWith("/messages"));

afterEach(() => vi.unstubAllGlobals());

describe("what WhatsApp carries (Meta's list, checked against Meta)", () => {
  it("maps each type to the message that plays or opens it in place", () => {
    expect(deliveryRuleFor("image/png")?.kind).toBe("image");
    expect(deliveryRuleFor("image/jpeg")?.kind).toBe("image");
    expect(deliveryRuleFor("audio/mpeg")?.kind).toBe("audio");
    expect(deliveryRuleFor("audio/mp4")?.kind).toBe("audio");
    expect(deliveryRuleFor("video/mp4")?.kind).toBe("video");
    expect(deliveryRuleFor("application/pdf")?.kind).toBe("document");
    expect(deliveryRuleFor("application/vnd.openxmlformats-officedocument.wordprocessingml.document")?.kind).toBe("document");
    expect(deliveryRuleFor("text/plain; charset=utf-8")?.kind).toBe("document");
  });

  it("labels an upload with Meta's name for the type where ours differs", () => {
    expect(deliveryRuleFor("audio/opus")?.uploadMime).toBe("audio/ogg");
    expect(deliveryRuleFor("application/x-subrip")?.uploadMime).toBe("text/plain");
    expect(deliveryRuleFor("text/vtt")?.uploadMime).toBe("text/plain");
  });

  it("refuses what Meta refused in the acceptance probe, and anything unknown", () => {
    for (const mime of ["audio/wav", "audio/flac", "video/webm", "video/quicktime", "video/x-matroska", "image/gif", "image/webp", "image/bmp", "image/tiff", "application/octet-stream", "", "nonsense"]) {
      expect(isDeliverableMime(mime), mime).toBe(false);
    }
  });

  it("holds the published size limits: images 5 MB, audio and video 16 MB, documents 100 MB", () => {
    expect(deliveryRuleFor("image/png")?.maxBytes).toBe(5 * 1024 * 1024);
    expect(deliveryRuleFor("audio/mpeg")?.maxBytes).toBe(16 * 1024 * 1024);
    expect(deliveryRuleFor("video/mp4")?.maxBytes).toBe(16 * 1024 * 1024);
    expect(deliveryRuleFor("application/pdf")?.maxBytes).toBe(100 * 1024 * 1024);
  });
});

describe("filenames", () => {
  it("keeps a meaningful name, with the extension the type really has", () => {
    expect(safeFileName("report.pdf", "application/pdf")).toBe("report.pdf");
    expect(safeFileName("movie.ar.srt", "application/x-subrip")).toBe("movie.ar.srt");
    expect(safeFileName("notes.srt", "text/plain")).toBe("notes.srt");
    expect(safeFileName("evil.exe", "application/pdf")).toBe("evil.pdf");
    expect(safeFileName(undefined, "image/png")).toBe("visionex.png");
  });

  it("strips paths, control and forbidden characters, and caps the length", () => {
    expect(safeFileName("../../etc/passwd", "application/pdf")).toBe("passwd.pdf");
    expect(safeFileName("C:\\Users\\x\\secret.pdf", "application/pdf")).toBe("secret.pdf");
    expect(safeFileName("a\u0000b\u001fc<>:\"|?*.pdf", "application/pdf")).toBe("abc.pdf");
    expect(safeFileName("...", "application/pdf")).toBe("visionex.pdf");
    const long = safeFileName(`${"x".repeat(300)}.pdf`, "application/pdf");
    expect(long.length).toBeLessThanOrEqual(84);
    expect(long.endsWith(".pdf")).toBe(true);
  });
});

describe("fetching a file from a URL: only for delivery, only from named hosts", () => {
  const HOSTS = ["files.example.org"];

  it("accepts HTTPS on an allowed host or its subdomain, and nothing else", () => {
    expect(isFetchableAssetUrl("https://files.example.org/a.pdf", HOSTS)).toBe(true);
    expect(isFetchableAssetUrl("https://cdn.files.example.org/a.pdf", HOSTS)).toBe(true);
    for (const bad of [
      "http://files.example.org/a.pdf",            // not HTTPS
      "https://files.example.org.evil.com/a.pdf",   // look-alike host
      "https://evil.com/a.pdf",                     // not allowed
      "https://user:pass@files.example.org/a.pdf",  // credentials in the URL
      "https://169.254.169.254/latest/meta-data",   // metadata endpoint
      "https://127.0.0.1/a.pdf",                    // loopback
      "https://[::1]/a.pdf",                        // IPv6 loopback
      "https://2130706433/a.pdf",                   // 127.0.0.1 written as a number
      "https://localhost/a.pdf",
      "file:///etc/passwd",
      "not a url",
    ]) {
      expect(isFetchableAssetUrl(bad, [...HOSTS, "169.254.169.254", "127.0.0.1", "localhost"]), bad).toBe(false);
    }
  });

  const serve = (responses: Record<string, () => Response>) =>
    vi.fn(async (url: string) => (responses[String(url)] ?? (() => new Response("", { status: 404 })))()) as unknown as typeof fetch;

  it("downloads, and re-checks every redirect against the same rules", async () => {
    const ok = await fetchAssetBytes({
      url: "https://files.example.org/a", allowedHosts: HOSTS, maxBytes: 1000,
      fetchImpl: serve({
        "https://files.example.org/a": () => new Response(null, { status: 302, headers: { location: "https://cdn.files.example.org/b" } }),
        "https://cdn.files.example.org/b": () => new Response(PDF, { headers: { "content-type": "application/pdf" } }),
      }),
    });
    expect(ok.ok && ok.bytes.length).toBe(PDF.length);

    const escaped = await fetchAssetBytes({
      url: "https://files.example.org/a", allowedHosts: HOSTS, maxBytes: 1000,
      fetchImpl: serve({ "https://files.example.org/a": () => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/" } }) }),
    });
    expect(escaped).toEqual({ ok: false, reason: "asset_invalid" });
  });

  it("stops after three redirects", async () => {
    const loop = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://files.example.org/again" } }));
    const out = await fetchAssetBytes({ url: "https://files.example.org/a", allowedHosts: HOSTS, maxBytes: 1000, fetchImpl: loop as unknown as typeof fetch });
    expect(out).toEqual({ ok: false, reason: "asset_download_failed" });
    expect(loop).toHaveBeenCalledTimes(4);
  });

  it("classifies a missing file, a server error and a timeout", async () => {
    const at = (res: () => Response | Promise<Response>) =>
      fetchAssetBytes({ url: "https://files.example.org/a", allowedHosts: HOSTS, maxBytes: 1000, timeoutMs: 20, fetchImpl: vi.fn(res) as unknown as typeof fetch });
    expect(await at(() => new Response("", { status: 404 }))).toEqual({ ok: false, reason: "asset_not_found" });
    expect(await at(() => new Response("", { status: 500 }))).toEqual({ ok: false, reason: "asset_download_failed" });
    const hang = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const timedOut = await fetchAssetBytes({ url: "https://files.example.org/a", allowedHosts: HOSTS, maxBytes: 1000, timeoutMs: 20, fetchImpl: hang as unknown as typeof fetch });
    expect(timedOut).toEqual({ ok: false, reason: "asset_download_timeout" });
  });

  it("refuses an oversized file by its header, and by its bytes while reading — without reading on", async () => {
    const declared = await fetchAssetBytes({
      url: "https://files.example.org/a", allowedHosts: HOSTS, maxBytes: 10,
      fetchImpl: vi.fn(async () => new Response(PDF, { headers: { "content-length": "999999" } })) as unknown as typeof fetch,
    });
    expect(declared).toEqual({ ok: false, reason: "asset_too_large" });

    // Large but finite, and with no Content-Length: only the cap while reading
    // can stop it, and without the cap this returns the whole thing (a clean
    // failure, not a hang).
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(c) { pulled++; if (pulled > 1000) c.close(); else c.enqueue(new Uint8Array(8)); },
    });
    const streamed = await fetchAssetBytes({
      url: "https://files.example.org/a", allowedHosts: HOSTS, maxBytes: 20,
      fetchImpl: vi.fn(async () => new Response(endless)) as unknown as typeof fetch,
    });
    expect(streamed).toEqual({ ok: false, reason: "asset_too_large" });
    expect(pulled).toBeLessThan(10);
  });
});

describe("delivering a file", () => {
  it("an image goes as an image, with its caption", async () => {
    const g = graph([UPLOAD_OK, SEND_OK]);
    const out = await deliverAsset({ ...base, fetchImpl: g.fetchImpl, asset: { bytes: PNG, mimeType: "image/png", caption: "Your image is ready." } });
    expect(out.outcome).toBe("delivered_image");
    expect(uploads(g.calls)[0].body).toMatchObject({ type: "image/png", file: "visionex.png" });
    expect(messages(g.calls)[0].body).toMatchObject({ type: "image", image: { id: "media-1", caption: "Your image is ready." } });
  });

  it("a PDF, a DOCX and a text file go as documents with their names", async () => {
    for (const [bytes, mimeType, fileName] of [
      [PDF, "application/pdf", "report.pdf"],
      [DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "letter.docx"],
      [new TextEncoder().encode("hello"), "text/plain", "notes.txt"],
    ] as const) {
      const g = graph([UPLOAD_OK, SEND_OK]);
      const out = await deliverAsset({ ...base, fetchImpl: g.fetchImpl, asset: { bytes, mimeType, fileName } });
      expect(out.outcome, mimeType).toBe("delivered_document");
      expect(messages(g.calls)[0].body, mimeType).toMatchObject({ type: "document", document: { id: "media-1", filename: fileName } });
    }
  });

  it("a video goes as a video", async () => {
    const g = graph([UPLOAD_OK, SEND_OK]);
    expect((await deliverAsset({ ...base, fetchImpl: g.fetchImpl, asset: { bytes: MP4, mimeType: "video/mp4" } })).outcome).toBe("delivered_video");
    expect(messages(g.calls)[0].body).toMatchObject({ type: "video" });
  });

  it("audio carries no caption, so its sentence is sent first", async () => {
    const g = graph([UPLOAD_OK, SEND_OK, SEND_OK]);
    const out = await deliverAsset({ ...base, fetchImpl: g.fetchImpl, asset: { bytes: MP3, mimeType: "audio/mpeg", caption: "A song." } });
    expect(out.outcome).toBe("delivered_audio");
    const sent = messages(g.calls).map((c) => (c.body as { type: string }).type);
    expect(sent).toEqual(["text", "audio"]);
    expect(messages(g.calls)[1].body).toMatchObject({ audio: { id: "media-1" } });
    expect(JSON.stringify(messages(g.calls)[1].body)).not.toContain("caption");
  });

  it("an Opus file is uploaded as Meta's audio/ogg; a Vorbis one is refused before any upload", async () => {
    const g = graph([UPLOAD_OK, SEND_OK]);
    expect((await deliverAsset({ ...base, fetchImpl: g.fetchImpl, asset: { bytes: OGG_OPUS, mimeType: "audio/opus" } })).outcome).toBe("delivered_audio");
    expect(uploads(g.calls)[0].body).toMatchObject({ type: "audio/ogg" });

    const v = graph([]);
    const out = await deliverAsset({ ...base, fetchImpl: v.fetchImpl, asset: { bytes: OGG_VORBIS, mimeType: "audio/ogg" } });
    expect(out).toMatchObject({ outcome: "failed", reason: "asset_content_mismatch" });
    expect(v.calls).toEqual([]);
  });

  it("checks the bytes against the declared type, the size and the type before spending a call", async () => {
    const cases: Array<[Uint8Array, string, string]> = [
      [HTML, "image/png", "asset_content_mismatch"],
      [JPEG, "application/pdf", "asset_content_mismatch"],
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Uint8Array(5 * 1024 * 1024)]), "image/png", "asset_too_large"],
      [PNG, "image/gif", "asset_type_unsupported"],
      [new Uint8Array(), "image/png", "asset_invalid"],
    ];
    for (const [bytes, mimeType, reason] of cases) {
      const g = graph([]);
      const out = await deliverAsset({ ...base, fetchImpl: g.fetchImpl, asset: { bytes, mimeType } });
      expect(out, reason).toMatchObject({ outcome: "failed", reason });
      expect(g.calls, reason).toEqual([]);
    }
  });

  it("retries a transient upload failure with backoff, and not a refusal", async () => {
    const sleeps: number[] = [];
    const g = graph([{ status: 503 }, { status: 429 }, UPLOAD_OK, SEND_OK]);
    const out = await deliverAsset({ ...base, sleep: async (ms) => { sleeps.push(ms); }, fetchImpl: g.fetchImpl, asset: { bytes: PNG, mimeType: "image/png" } });
    expect(out).toMatchObject({ outcome: "delivered_image", uploadTries: 3, sendTries: 1 });
    expect(sleeps).toEqual([250, 500]);

    const refused = graph([{ status: 400 }]);
    const no = await deliverAsset({ ...base, fetchImpl: refused.fetchImpl, asset: { bytes: PNG, mimeType: "image/png" } });
    expect(no).toMatchObject({ outcome: "failed", reason: "whatsapp_upload_rejected" });
    expect(uploads(refused.calls)).toHaveLength(1);
  });

  it("gives up after three transport failures — no loop — and only then falls back to the link", async () => {
    const g = graph([UPLOAD_OK, { status: 500 }, { status: 500 }, { status: 500 }, SEND_OK]);
    const out = await deliverAsset({
      ...base, fetchImpl: g.fetchImpl,
      asset: { bytes: PDF, mimeType: "application/pdf", fallbackUrl: "https://visionex.app/f/1", fallbackText: "Here is a link: {url}" },
    });
    expect(out).toMatchObject({ outcome: "fallback_url", reason: "whatsapp_transport_error" });
    const sent = messages(g.calls);
    expect(sent).toHaveLength(4);
    expect(sent[3].body).toMatchObject({ type: "text", text: { body: "Here is a link: https://visionex.app/f/1" } });
    expect(uploads(g.calls)).toHaveLength(1);
  });

  it("sends no link when the file arrived, and fails plainly when there is no link to offer", async () => {
    const ok = graph([UPLOAD_OK, SEND_OK]);
    await deliverAsset({ ...base, fetchImpl: ok.fetchImpl, asset: { bytes: PDF, mimeType: "application/pdf", fallbackUrl: "https://visionex.app/f/1", fallbackText: "{url}" } });
    expect(messages(ok.calls)).toHaveLength(1);

    const g = graph([UPLOAD_OK, { status: 400 }]);
    expect(await deliverAsset({ ...base, fetchImpl: g.fetchImpl, asset: { bytes: PDF, mimeType: "application/pdf" } }))
      .toMatchObject({ outcome: "failed", reason: "whatsapp_send_rejected" });

    // A link that is not HTTPS is never offered.
    const h = graph([UPLOAD_OK, { status: 400 }]);
    const out = await deliverAsset({ ...base, fetchImpl: h.fetchImpl, asset: { bytes: PDF, mimeType: "application/pdf", fallbackUrl: "http://x.test/f", fallbackText: "{url}" } });
    expect(out.outcome).toBe("failed");
    expect(messages(h.calls)).toHaveLength(1);
  });

  it("fetches a URL source from an allowed host, and refuses what the server says is something else", async () => {
    const served = vi.fn(async (url: string, init: RequestInit = {}) => {
      if (String(url).startsWith("https://files.example.org/")) {
        const html = String(url).endsWith("/page");
        return new Response(html ? HTML : PDF, { headers: { "content-type": html ? "text/html" : "application/pdf" } });
      }
      return graph([UPLOAD_OK]).fetchImpl(url, init);
    });
    const good = await deliverAsset({ ...base, fetchImpl: served as unknown as typeof fetch, asset: { url: "https://files.example.org/r.pdf", allowedHosts: ["files.example.org"], mimeType: "application/pdf" } });
    expect(good.outcome).toBe("delivered_document");
    const page = await deliverAsset({ ...base, fetchImpl: served as unknown as typeof fetch, asset: { url: "https://files.example.org/page", allowedHosts: ["files.example.org"], mimeType: "application/pdf" } });
    expect(page).toMatchObject({ outcome: "failed", reason: "asset_content_mismatch" });
    const noHosts = await deliverAsset({ ...base, fetchImpl: served as unknown as typeof fetch, asset: { url: "https://files.example.org/r.pdf", mimeType: "application/pdf" } });
    expect(noHosts).toMatchObject({ outcome: "failed", reason: "asset_invalid" });
  });

  it("never throws, and reports a transport fault as such", async () => {
    const out = await deliverAsset({ ...base, fetchImpl: vi.fn(async () => { throw new Error("reset"); }) as unknown as typeof fetch, asset: { bytes: PNG, mimeType: "image/png" } });
    expect(out).toMatchObject({ outcome: "failed", reason: "whatsapp_transport_error" });
  });
});

describe("what the sender reads, in their language", () => {
  it("captions pictures and files, and not audio", () => {
    expect(deliveryCaption("image/png", "ar")).toBe("صورتك جاهزة.");
    expect(deliveryCaption("application/pdf", "en")).toBe("Your file is ready.");
    expect(deliveryCaption("video/mp4", "fr")).toBe("Votre fichier est prêt.");
    expect(deliveryCaption("audio/mpeg", "en")).toBeUndefined();
  });

  it("has every delivery sentence in all twenty languages, and the fallback keeps its link", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(20);
    for (const language of SUPPORTED_LANGUAGES) {
      const fallback = deliveryFallbackText(language);
      expect(fallback, language).toContain("{url}");
      expect(deliveryCaption("image/png", language), language).toBeTruthy();
      expect(deliveryCaption("application/pdf", language), language).toBeTruthy();
      if (language !== "en") {
        expect(deliveryCaption("application/pdf", language), language).not.toBe("Your file is ready.");
        expect(fallback, language).not.toBe(deliveryFallbackText("en"));
      }
    }
  });

  it("says something a screen reader can read: words, not emoji or symbols alone", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const text of [deliveryCaption("image/png", language)!, deliveryFallbackText(language)]) {
        expect([...text].filter((ch) => /\p{L}/u.test(ch)).length, language).toBeGreaterThan(3);
      }
    }
  });
});

describe("what delivery must never do", () => {
  const source = readFileSync("supabase/functions/_shared/whatsappAssetDelivery.ts", "utf8");

  it("charges nothing and generates nothing: no VX, billing, meter or provider call", () => {
    expect(source).not.toMatch(/vx_|billing|whatsapp_meter|chargeDailyLimit|aiProvider|structuredCompletion|streamChatCompletion/);
  });

  it("logs nothing itself, and its log fields name no URL, number, token or media id", () => {
    expect(source).not.toMatch(/console\.(log|error|warn)/);
    const fields = deliveryLogFields(
      { outcome: "fallback_url", reason: "whatsapp_transport_error", ms: 5 }, "url", "application/pdf; name=secret",
    );
    expect(Object.keys(fields).sort()).toEqual(["mime", "ms", "outcome", "reason", "source"]);
    expect(JSON.stringify(fields)).not.toMatch(/https?:|secret|TOKEN|media-1|1555/);
  });

  it("does not send by link: a link accepted before Meta fetches it is a failure nobody would see", () => {
    expect(source).not.toMatch(/\blink:\s/);
  });
});

describe("the WhatsApp flows that deliver a file all go through it", () => {
  const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");

  it("conversions, translated subtitles, songs and Word documents use deliverAsset and log the outcome", () => {
    for (const flow of ["convert", "translate", "song", "document"]) {
      expect(webhook, flow).toContain(`log("asset_delivery", { flow: "${flow}", ...deliveryLogFields(`);
    }
    expect(webhook.match(/await deliverAsset\(\{/g)).toHaveLength(4);
  });

  it("no longer uploads or sends a file any other way", () => {
    expect(webhook).not.toMatch(/uploadWhatsAppMedia\(|sendWhatsAppMediaById\(|sendWhatsAppAudio\(/);
  });

  it("tells a sender whose converted file was too large what would get it through", () => {
    expect(webhook).toContain('body: kind === "too_large" ? say("assetTooLarge", jobLanguage) : failedNotice(jobLanguage),');
  });
});
