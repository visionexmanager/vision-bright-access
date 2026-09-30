/**
 * Book catalogues that publish an OPDS (Atom) feed, keyless: Project Gutenberg
 * and Standard Ebooks. OPDS is the open standard for exactly this, so it is the
 * official machine-readable door — not a scrape of the sites' HTML.
 *
 * Gutenberg used to be read through Gutendex, a community JSON index that timed
 * out on 2026-09-30 (25 s, no answer) while Gutenberg's own OPDS answered in
 * 1.5 s. The catalogue is now read from Gutenberg itself.
 */

import { clean, cleanOrNull, getText, httpsUrl, makeItem, tagList } from "../http.ts";
import type { ContentProvider, ExternalContentItem } from "../types.ts";

const decode = (s: string) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, "&");
const tag = (xml: string, name: string): string =>
  decode(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))?.[1] ?? "");
const entries = (xml: string): string[] => xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) ?? [];
const links = (entry: string): Array<{ href: string; rel: string; type: string; length: number | null; title: string }> =>
  (entry.match(/<link\b[^>]*>/g) ?? []).map((l) => {
    const attr = (n: string) => decode(l.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1] ?? "");
    const length = Number(attr("length"));
    return { href: attr("href"), rel: attr("rel"), type: attr("type"), length: Number.isFinite(length) && length > 0 ? length : null, title: attr("title") };
  });

// ─── Project Gutenberg ─────────────────────────────────────────────────────

const GUTENBERG_LICENSE = { name: "Public domain in the USA", url: "https://www.gutenberg.org/policy/permission.html" };
const GUTENBERG_PAGE = 25;

/** The books in a Gutenberg OPDS search feed. Authors and subjects entries in the same feed are skipped. */
export function parseGutenbergOpds(xml: string): ExternalContentItem[] {
  return entries(xml).flatMap((entry) => {
    const id = tag(entry, "id").match(/^https:\/\/www\.gutenberg\.org\/ebooks\/(\d{1,8})\.opds$/)?.[1];
    const title = clean(tag(entry, "title"), 200);
    if (!id || !title) return [];
    const content = clean(tag(entry, "content"), 200);
    // The feed puts the author there, or "1217 downloads" when it has none.
    const creator = content && !/\bdownloads?$/i.test(content) ? content : null;
    return [makeItem("Project Gutenberg", {
      provider: "gutenberg",
      providerItemId: id,
      title,
      contentType: "book",
      mimeType: "application/epub+zip",
      thumbnailUrl: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
      externalUrl: `https://www.gutenberg.org/ebooks/${id}`,
      downloadUrl: `https://www.gutenberg.org/ebooks/${id}.epub.noimages`,
      creator,
      license: GUTENBERG_LICENSE,
      attribution: "Project Gutenberg",
    })];
  });
}

export const gutenberg: ContentProvider = {
  id: "gutenberg",
  name: "Project Gutenberg",
  homepage: "https://www.gutenberg.org",
  docs: "https://www.gutenberg.org/ebooks/search.opds/",
  categories: ["books", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: true },
  licenseNote: "Over 70,000 books in the US public domain, read from Gutenberg's own OPDS catalogue.",
  rateLimit: "No published quota; the OPDS search answered in 1.5 s on 2026-09-30, when the Gutendex mirror it replaced did not answer at all.",
  minIntervalMs: 500,
  healthQuery: "frankenstein",
  async search(params, ctx) {
    const q = new URLSearchParams({ query: params.query, start_index: String((params.page - 1) * GUTENBERG_PAGE + 1) });
    return parseGutenbergOpds(await getText(ctx, `https://www.gutenberg.org/ebooks/search.opds/?${q}`, { headers: { Accept: "application/atom+xml" } }))
      .slice(0, params.limit);
  },
};

// ─── Standard Ebooks ───────────────────────────────────────────────────────

const CC0 = { name: "CC0 (public domain dedication)", url: "https://creativecommons.org/publicdomain/zero/1.0/" };

export function parseStandardEbooks(xml: string): ExternalContentItem[] {
  return entries(xml).flatMap((entry) => {
    const page = httpsUrl(tag(entry, "id").trim());
    const slug = page?.match(/^https:\/\/standardebooks\.org\/ebooks\/([a-z0-9-]+\/[a-z0-9-]+)$/)?.[1];
    const title = clean(tag(entry, "title"), 200);
    if (!page || !slug || !title) return [];
    const files = links(entry);
    const epub = files.find((l) => l.rel === "http://opds-spec.org/acquisition/open-access" && l.type === "application/epub+zip");
    const thumb = files.find((l) => l.rel === "http://opds-spec.org/image/thumbnail");
    const authors = (entry.match(/<author>[\s\S]*?<\/author>/g) ?? []).map((a) => clean(tag(a, "name"), 80)).filter(Boolean);
    const rights = tag(entry, "rights");
    const subjects = (entry.match(/<category\b[^>]*standardebooks\.org\/vocab\/subjects[^>]*>/g) ?? [])
      .map((c) => decode(c.match(/term="([^"]*)"/)?.[1] ?? ""));
    return [makeItem("Standard Ebooks", {
      provider: "standard_ebooks",
      providerItemId: slug,
      title,
      description: cleanOrNull(tag(entry, "summary"), 500),
      contentType: "book",
      mimeType: "application/epub+zip",
      thumbnailUrl: httpsUrl(thumb?.href),
      externalUrl: page,
      // Their feed's own licence statement is CC0; a book whose entry says otherwise carries no licence and no file.
      downloadUrl: /\bCC0\b/.test(rights) ? httpsUrl(epub?.href) : null,
      sizeBytes: epub?.length ?? null,
      creator: authors.slice(0, 3).join(", ") || null,
      publisher: "Standard Ebooks",
      language: cleanOrNull(tag(entry, "dc:language"), 12),
      license: /\bCC0\b/.test(rights) ? CC0 : null,
      attribution: "Standard Ebooks",
      tags: tagList(subjects, 4),
      publishedAt: tag(entry, "dc:issued").slice(0, 10) || null,
    })];
  });
}

export const standardEbooks: ContentProvider = {
  id: "standard_ebooks",
  name: "Standard Ebooks",
  homepage: "https://standardebooks.org",
  docs: "https://standardebooks.org/manual/latest/single-page",
  categories: ["books", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: true },
  licenseNote: "Carefully produced, typeset editions of public-domain books, released under CC0. Read from their OPDS feed.",
  rateLimit: "No published quota; one request answered in 1.2 s on 2026-09-30.",
  healthQuery: "dickens",
  async search(params, ctx) {
    const q = new URLSearchParams({ query: params.query, page: String(params.page), "per-page": String(Math.min(params.limit, 48)) });
    return parseStandardEbooks(await getText(ctx, `https://standardebooks.org/feeds/opds/all?${q}`, { headers: { Accept: "application/atom+xml" } }));
  },
};
