import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  formatCitation, searchOpenSources, wikipediaLanguage, type OpenReference,
} from "../../supabase/functions/_shared/openResearchSources.ts";

// The research assistant's own references come from the Library catalogue,
// which held 8 books: a topic almost never matched. external_sources asks
// OpenAlex, Open Library and Wikipedia instead. Every reference must be a
// record one of them returned — nothing a model wrote.
//
// Payloads below are trimmed copies of the shapes each API returned on
// 2026-09-28.

const OPENALEX = {
  results: [
    {
      id: "https://openalex.org/W2033",
      title: "Reading habits and attitude in the digital age",
      publication_year: 2007,
      doi: "https://doi.org/10.1108/02640470710754805",
      authorships: [{ author: { display_name: "Nor Shahriza Abdul Karim" } }, { author: { display_name: "Amelia Hasan" } }],
      open_access: { is_oa: false, oa_url: null },
      primary_location: { landing_page_url: "https://www.emerald.com/insight/content/doi/10.1108/02640470710754805" },
    },
    {
      id: "https://openalex.org/W9",
      title: "<i>Open</i> &amp; free reading",
      publication_year: 2020,
      doi: null,
      authorships: [1, 2, 3, 4].map((n) => ({ author: { display_name: `Author ${n}` } })),
      open_access: { is_oa: true, oa_url: "https://example.org/paper.pdf" },
      primary_location: {},
    },
    { id: "https://openalex.org/W0", title: "", publication_year: 2020, doi: null, authorships: [] },
  ],
};
const OPENLIBRARY = {
  docs: [
    { key: "/works/OL17930368W", title: "Atomic Habits", author_name: ["James Clear"], first_publish_year: 2016 },
    { key: "javascript:alert(1)", title: "Not a work key", author_name: ["X"] },
  ],
};
const WIKIPEDIA = {
  query: { search: [{ title: "قراءة", snippet: "<span class=\"searchmatch\">القراءة</span> هي عملية", timestamp: "2025-03-01T00:00:00Z" }] },
};

function fakeFetch(overrides: Partial<Record<"openalex" | "openlibrary" | "wikipedia", () => Promise<Response>>> = {}) {
  const calls: string[] = [];
  const fetchFn = vi.fn(async (url: string) => {
    calls.push(url);
    const host = new URL(url).hostname;
    const key = host.includes("openalex") ? "openalex" : host.includes("openlibrary") ? "openlibrary" : "wikipedia";
    if (overrides[key]) return overrides[key]!();
    const body = key === "openalex" ? OPENALEX : key === "openlibrary" ? OPENLIBRARY : WIKIPEDIA;
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return { fetchFn, calls };
}

describe("open research sources", () => {
  it("returns real records from all three, each with a link and a citation", async () => {
    const { fetchFn } = fakeFetch();
    const { references, sources } = await searchOpenSources(fetchFn, "القراءة", "ar");
    expect(sources).toEqual({ openalex: "ok", openlibrary: "ok", wikipedia: "ok" });
    expect(references.map((r) => r.source)).toEqual(["openalex", "openalex", "openlibrary", "wikipedia"]);
    for (const ref of references) {
      expect(ref.url).toMatch(/^https:\/\//);
      expect(ref.citation).toContain(ref.url);
      expect(ref.title).not.toMatch(/[<>]/);
    }
    const [paper, open, book, article] = references;
    expect(paper.url).toBe("https://doi.org/10.1108/02640470710754805");
    expect(paper.doi).toBe("10.1108/02640470710754805");
    expect(paper.citation).toBe("Nor Shahriza Abdul Karim & Amelia Hasan (2007). Reading habits and attitude in the digital age. https://doi.org/10.1108/02640470710754805");
    expect(open).toMatchObject({ title: "Open & free reading", url: "https://example.org/paper.pdf", openAccess: true });
    expect(open.citation).toMatch(/^Author 1, Author 2, & Author 3, et al\. \(2020\)/);
    expect(book).toMatchObject({ title: "Atomic Habits", url: "https://openlibrary.org/works/OL17930368W", authors: ["James Clear"], year: 2016 });
    expect(article.url).toBe(`https://ar.wikipedia.org/wiki/${encodeURIComponent("قراءة")}`);
    expect(article.snippet).toBe("القراءة هي عملية");
  });

  it("drops records without a title or with an unexpected link", async () => {
    const { fetchFn } = fakeFetch();
    const { references } = await searchOpenSources(fetchFn, "reading");
    expect(references.some((r) => r.title === "")).toBe(false);
    expect(references.some((r) => r.url.includes("javascript"))).toBe(false);
  });

  it("names a source that fails and still answers with the others", async () => {
    const { fetchFn } = fakeFetch({
      openalex: async () => new Response("down", { status: 503 }),
      wikipedia: async () => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); },
    });
    const { references, sources } = await searchOpenSources(fetchFn, "reading");
    expect(sources).toEqual({ openalex: "failed", openlibrary: "ok", wikipedia: "timeout" });
    expect(references.map((r) => r.source)).toEqual(["openlibrary"]);
  });

  it("calls only the three fixed hosts, with the topic as a query parameter", async () => {
    const { fetchFn, calls } = fakeFetch();
    await searchOpenSources(fetchFn, "a&b=c/../x", "en");
    expect(calls.map((u) => new URL(u).hostname).sort()).toEqual(["api.openalex.org", "en.wikipedia.org", "openlibrary.org"]);
    for (const url of calls) expect([...new URL(url).searchParams.values()]).toContain("a&b=c/../x");
  });

  it("reads Wikipedia in the reader's language, and Arabic for an Arabic topic", () => {
    expect(wikipediaLanguage("reading", "fr")).toBe("fr");
    expect(wikipediaLanguage("القراءة", "en")).toBe("ar");
    expect(wikipediaLanguage("خواندن", "fa")).toBe("fa");
    expect(wikipediaLanguage("reading", "xx")).toBe("en");
  });

  it("formats a citation without authors or year", () => {
    const ref: Omit<OpenReference, "citation"> = {
      source: "wikipedia", kind: "encyclopedia", title: "Reading", authors: [], year: null,
      url: "https://en.wikipedia.org/wiki/Reading", doi: null, openAccess: true, snippet: null,
    };
    expect(formatCitation(ref)).toBe("(n.d.). Reading. Wikipedia. https://en.wikipedia.org/wiki/Reading");
  });

  it("is a mode of the existing research assistant, not a new function", () => {
    const fn = readFileSync("supabase/functions/library-research-assistant/index.ts", "utf8");
    expect(fn).toMatch(/body\.mode === "external_sources"/);
    expect(fn).toMatch(/searchOpenSources\(fetch, body\.topic, body\.language\)/);
    // It sits behind the same sign-in and daily limit as every other mode.
    expect(fn.indexOf("check_ai_rate_limit")).toBeLessThan(fn.indexOf('body.mode === "external_sources"'));
  });
});
