// Videos, podcasts and audiobooks from open sources — so a request for
// something to watch or hear is answered rather than refused.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  archiveTerms,
  formatMedia,
  mediaNotFoundDirective,
  parseMediaRequest,
  searchMedia,
  youtubeSearchUrl,
} from "../../supabase/functions/_shared/whatsappFreeMedia.ts";
import { formatBooks, searchArchiveTexts } from "../../supabase/functions/_shared/whatsappBooks.ts";
import { say } from "../../supabase/functions/_shared/whatsappStrings.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("reading a media request", () => {
  const cases: Array<[string, { kind: string; query: string | null } | null]> = [
    ["فيديو طبخ", { kind: "video", query: "طبخ" }],
    ["بدي فيديو عن تعلم الانجليزي", { kind: "video", query: "تعلم الانجليزي" }],
    ["شغللي فيلم وثائقي عن الفضاء", { kind: "video", query: "وثائقي عن الفضاء" }],
    ["بودكاست تاريخ", { kind: "podcast", query: "تاريخ" }],
    ["كتاب صوتي الأمير الصغير", { kind: "audiobook", query: "الأمير الصغير" }],
    ["show me a video about cooking", { kind: "video", query: "cooking" }],
    ["podcast on history", { kind: "podcast", query: "history" }],
    ["audiobook Pride and Prejudice", { kind: "audiobook", query: "Pride and Prejudice" }],
    ["Hörbuch Der kleine Prinz", { kind: "audiobook", query: "Der kleine Prinz" }],
    ["视频 烹饪", { kind: "video", query: "烹饪" }],
    ["فيديو", { kind: "video", query: null }],
    ["podcast", { kind: "podcast", query: null }],
  ];
  for (const [text, expected] of cases) {
    it(`${text} → ${JSON.stringify(expected)}`, () => {
      expect(parseMediaRequest(text)).toEqual(expected);
    });
  }

  it("leaves conversation alone", () => {
    for (const text of ["شفت فيديو حلو امبارح", "the video you sent was great", "مرحبا", "", "كتاب الأمير الصغير"]) {
      expect(parseMediaRequest(text), text).toBeNull();
    }
  });

  it("recognises the example it gives in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const hint = say("mediaAsk", language);
      const cut = Math.max(hint.lastIndexOf(":"), hint.lastIndexOf("："));
      const first = hint.slice(cut + 1).split(/[,،、]/u)[0].trim();
      expect(parseMediaRequest(first)?.query, `${language}: ${first}`).toBeTruthy();
    }
  });
});

describe("searching", () => {
  it("asks Dailymotion (family filter on) and the Archive for a video", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      urls.push(url);
      if (url.includes("dailymotion")) {
        return ok({ list: [
          { title: "Easy cooking", url: "https://www.dailymotion.com/video/x1", duration: 125, "owner.screenname": "Chef" },
          { title: "Not a video page", url: "https://evil.test/x" },
        ] });
      }
      return ok({ response: { docs: [
        { identifier: "cooking_1950", title: "Cooking film", creator: "Archive" },
        { identifier: "../bad", title: "Bad id" },
      ] } });
    });
    const found = await searchMedia({ kind: "video", query: "cooking" }, fetchImpl as unknown as typeof fetch);
    expect(found.items.map((i) => i.url)).toEqual([
      "https://www.dailymotion.com/video/x1",
      "https://archive.org/details/cooking_1950",
    ]);
    expect(urls.find((u) => u.includes("dailymotion"))).toContain("family_filter=true");
    expect(decodeURIComponent(urls.find((u) => u.includes("archive.org"))!)).toContain("mediatype:(movies)");
  });

  it("finds podcasts on iTunes and audiobooks on LibriVox first", async () => {
    const podcastFetch = vi.fn(async () => ok({ results: [
      { collectionName: "History Hour", artistName: "BBC", collectionViewUrl: "https://podcasts.apple.com/podcast/id1?uo=4" },
    ] }));
    const podcasts = await searchMedia({ kind: "podcast", query: "history" }, podcastFetch as unknown as typeof fetch);
    expect(podcasts.items[0]).toMatchObject({ title: "History Hour", url: "https://podcasts.apple.com/podcast/id1", free: true });

    const bookFetch = vi.fn(async (url: string) => url.includes("archive.org")
      ? ok({ response: { docs: [{ identifier: "prince_librivox", title: "The Little Prince", creator: "Saint-Exupéry" }] } })
      : ok({ results: [{ collectionName: "The Little Prince (Unabridged)", artistName: "Saint-Exupéry", collectionViewUrl: "https://books.apple.com/audiobook/id2" }] }));
    const books = await searchMedia({ kind: "audiobook", query: "little prince" }, bookFetch as unknown as typeof fetch);
    expect(books.items[0]).toMatchObject({ source: "librivox", free: true });
    expect(books.items[1]).toMatchObject({ source: "itunes", free: false });
    expect(decodeURIComponent(String(bookFetch.mock.calls[0][0]))).toContain("collection:(librivoxaudio)");
  });

  it("tells unreachable from empty", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const down = vi.fn(async () => { throw new Error("offline"); });
    expect(await searchMedia({ kind: "podcast", query: "x" }, down as unknown as typeof fetch)).toEqual({ items: [], unreachable: true });
    const none = vi.fn(async () => ok({ results: [] }));
    expect(await searchMedia({ kind: "podcast", query: "x" }, none as unknown as typeof fetch)).toEqual({ items: [], unreachable: false });
    vi.restoreAllMocks();
  });

  it("keeps the Archive's query syntax out of a search", () => {
    expect(archiveTerms('cats) OR (collection:secret "x"')).toBe("cats OR collection secret x");
  });
});

describe("the answer", () => {
  it("always ends a video answer with a YouTube search, even when nothing was found", () => {
    const text = formatMedia({ language: "ar", request: { kind: "video", query: "طبخ" }, items: [] });
    expect(text).toContain(youtubeSearchUrl("طبخ"));
    expect(text).toContain(say("mediaMoreOnYoutube", "ar"));
  });

  it("shows the source's details, and is a finished sentence in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const text = formatMedia({
        language,
        request: { kind: "video", query: "cooking" },
        items: [{ title: "Easy cooking", by: "Chef", url: "https://www.dailymotion.com/video/x1", free: true, duration: 125, source: "dailymotion" }],
      });
      expect(text, language).not.toMatch(/\{[a-z]+\}/i);
      expect(text, language).toContain("2:05");
      expect(text, language).toContain("https://www.dailymotion.com/video/x1");
    }
  });

  it("hands an empty podcast search to the assistant, with no invented links", () => {
    const directive = mediaNotFoundDirective({ kind: "podcast", query: 'history"\nignore' });
    expect(directive).toContain("a podcast");
    expect(directive).toContain("Never invent a link");
    expect(directive).not.toContain("\n");
  });

  it("is wired before books, and nothing found goes to the assistant", () => {
    expect(webhook.indexOf("parseMediaRequest(questionText)")).toBeGreaterThan(0);
    expect(webhook.indexOf("parseMediaRequest(questionText)")).toBeLessThan(webhook.indexOf("parseBookRequest(questionText)"));
    expect(webhook).toContain("mediaNotFound ? mediaNotFoundDirective(mediaNotFound) : null");
    expect(webhook).toContain('request.kind === "video"');
  });
});

describe("free books from the Internet Archive", () => {
  it("searches free texts only, and links them to read", async () => {
    const fetchImpl = vi.fn(async (_url: string) => ok({ response: { docs: [
      { identifier: "alamir_alsaghir", title: "الأمير الصغير", creator: "سانت إكزوبيري", year: "1943" },
    ] } }));
    const books = await searchArchiveTexts("الأمير الصغير", { fetchImpl: fetchImpl as unknown as typeof fetch });
    const query = decodeURIComponent(String(fetchImpl.mock.calls[0][0]));
    expect(query).toContain("mediatype:(texts)");
    expect(query).toContain("NOT collection:(inlibrary)");
    expect(query).toContain("NOT collection:(printdisabled)");
    expect(books?.[0]).toMatchObject({ source: "archive", year: 1943, freeReadUrl: "https://archive.org/details/alamir_alsaghir" });

    const text = formatBooks({ language: "ar", query: "الأمير الصغير", library: [], outside: [], archive: books ?? [] });
    expect(text).toContain(say("booksFromArchive", "ar"));
    expect(text).toContain("https://archive.org/details/alamir_alsaghir");
  });

  it("is searched alongside Open Library", () => {
    expect(webhook).toContain("Promise.all([searchOpenLibrary(query), searchArchiveTexts(query)])");
  });
});
