/**
 * Books and open textbooks, keyless: Open Library, Project Gutenberg (through
 * Gutendex), the Directory of Open Access Books and OpenStax.
 */

import { embeds } from "../embed.ts";
import { clean, cleanOrNull, getJson, httpsUrl, licenseFromUrl, makeItem, tagList } from "../http.ts";
import type { ContentProvider, ExternalContentItem, ProviderContext } from "../types.ts";

// ─── Open Library ──────────────────────────────────────────────────────────

export function parseOpenLibrary(data: unknown): ExternalContentItem[] {
  const docs = ((data as { docs?: Array<Record<string, unknown>> })?.docs) ?? [];
  return docs.flatMap((doc) => {
    const key = typeof doc.key === "string" && /^\/works\/OL\d+W$/.test(doc.key) ? doc.key : null;
    const title = clean(doc.title, 200);
    if (!key || !title) return [];
    const cover = typeof doc.cover_i === "number" && doc.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null;
    const ia = Array.isArray(doc.ia) ? doc.ia.find((v): v is string => typeof v === "string" && /^[A-Za-z0-9._-]{1,120}$/.test(v)) : undefined;
    // "public" is a scan anyone may read on archive.org; "borrowable" needs a
    // loan there, so it is only linked, never embedded.
    const readable = doc.ebook_access === "public" && ia ? embeds.archive(ia) : null;
    const authors = Array.isArray(doc.author_name) ? doc.author_name.map((a) => clean(a, 80)).filter(Boolean) : [];
    return [makeItem("Open Library", {
      provider: "open_library",
      providerItemId: key.replace("/works/", ""),
      title,
      contentType: "book",
      thumbnailUrl: cover,
      embedUrl: readable,
      externalUrl: `https://openlibrary.org${key}`,
      creator: authors.slice(0, 3).join(", ") || null,
      language: Array.isArray(doc.language) && typeof doc.language[0] === "string" ? doc.language[0] : null,
      tags: tagList(doc.subject, 6),
      publishedAt: typeof doc.first_publish_year === "number" ? String(doc.first_publish_year) : null,
    })];
  });
}

export const openLibrary: ContentProvider = {
  id: "open_library",
  name: "Open Library",
  homepage: "https://openlibrary.org",
  docs: "https://openlibrary.org/dev/docs/api/search",
  categories: ["books", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: true, download: false },
  licenseNote: "Catalogue data is open. Only public-domain scans are embedded; lending-only books are linked.",
  rateLimit: "Asks for a descriptive User-Agent; response time varied from 2 s to over 10 s on 2026-09-29.",
  healthQuery: "science",
  async search(params, ctx) {
    const q = new URLSearchParams({
      q: params.query, page: String(params.page), limit: String(params.limit), lang: params.language,
      fields: "key,title,author_name,first_publish_year,cover_i,ebook_access,ia,language,subject",
    });
    return parseOpenLibrary(await getJson(ctx, `https://openlibrary.org/search.json?${q}`));
  },
};

// ─── Project Gutenberg (Gutendex) ──────────────────────────────────────────

const GUTENBERG_LICENSE = { name: "Public domain in the USA", url: "https://www.gutenberg.org/policy/permission.html" };

export function parseGutendex(data: unknown): ExternalContentItem[] {
  const results = ((data as { results?: Array<Record<string, unknown>> })?.results) ?? [];
  return results.flatMap((book) => {
    const title = clean(book.title, 200);
    if (typeof book.id !== "number" || !title) return [];
    const formats = (book.formats ?? {}) as Record<string, string>;
    const publicDomain = book.copyright === false;
    const authors = ((book.authors as Array<{ name?: string }>) ?? []).map((a) => clean(a.name, 80)).filter(Boolean);
    const summary = Array.isArray(book.summaries) ? book.summaries[0] : null;
    return [makeItem("Project Gutenberg", {
      provider: "gutenberg",
      providerItemId: String(book.id),
      title,
      description: cleanOrNull(summary, 500),
      contentType: "book",
      mimeType: "application/epub+zip",
      thumbnailUrl: httpsUrl(formats["image/jpeg"]),
      externalUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
      downloadUrl: publicDomain ? httpsUrl(formats["application/epub+zip"]) : null,
      creator: authors.join("; ") || null,
      language: Array.isArray(book.languages) && typeof book.languages[0] === "string" ? book.languages[0] : null,
      license: publicDomain ? GUTENBERG_LICENSE : null,
      attribution: publicDomain ? "Project Gutenberg" : null,
      tags: tagList(book.bookshelves, 4).map((s) => s.replace(/^Category:\s*/, "")),
    })];
  });
}

export const gutenberg: ContentProvider = {
  id: "gutenberg",
  name: "Project Gutenberg",
  homepage: "https://www.gutenberg.org",
  docs: "https://gutendex.com/",
  categories: ["books", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: true },
  licenseNote: "Over 70,000 books in the US public domain; searched through Gutendex, a community JSON index of the Gutenberg catalogue.",
  rateLimit: "No published quota; Gutendex answered in 0.5 s on one probe and timed out on another.",
  healthQuery: "frankenstein",
  async search(params, ctx) {
    // Gutendex pages hold 32 books; map this page's window onto one of them.
    const start = (params.page - 1) * params.limit;
    const q = new URLSearchParams({ search: params.query, page: String(Math.floor(start / 32) + 1) });
    const offset = start % 32;
    return parseGutendex(await getJson(ctx, `https://gutendex.com/books/?${q}`)).slice(offset, offset + params.limit);
  },
};

// ─── Directory of Open Access Books ────────────────────────────────────────

interface DoabItem {
  uuid?: string;
  handle?: string;
  name?: string;
  metadata?: Array<{ key?: string; value?: unknown }>;
  bitstreams?: Array<{ uuid?: string; bundleName?: string; code?: string; metadata?: Array<{ key?: string; value?: unknown }> }>;
}

export function parseDoab(data: unknown): ExternalContentItem[] {
  const items = Array.isArray(data) ? data as DoabItem[] : [];
  return items.flatMap((item) => {
    const meta = (key: string) => (item.metadata ?? []).filter((m) => m.key === key).map((m) => clean(m.value, 400)).filter(Boolean);
    const title = meta("dc.title")[0] ?? clean(item.name, 200);
    const handle = typeof item.handle === "string" && /^[\d.]+\/\d+$/.test(item.handle) ? item.handle : null;
    if (!title || !handle) return [];
    const thumb = (item.bitstreams ?? []).find((b) => b.bundleName === "THUMBNAIL" && typeof b.uuid === "string" && /^[0-9a-f-]{36}$/.test(b.uuid));
    const rights = (item.bitstreams ?? []).flatMap((b) => b.metadata ?? []).find((m) => m.key === "dc.rights.uri")?.value;
    const license = licenseFromUrl(rights);
    const people = [...meta("dc.contributor.author"), ...meta("dc.contributor.editor")];
    return [makeItem("Directory of Open Access Books", {
      provider: "doab",
      providerItemId: handle,
      title: title.slice(0, 200),
      description: meta("dc.description.abstract")[0]?.slice(0, 500) ?? null,
      contentType: "book",
      thumbnailUrl: thumb ? `https://directory.doabooks.org/rest/bitstreams/${thumb.uuid}/retrieve` : null,
      externalUrl: `https://directory.doabooks.org/handle/${handle}`,
      creator: people.slice(0, 3).join("; ") || null,
      publisher: meta("publisher.name")[0]?.slice(0, 120) ?? null,
      language: meta("dc.language")[0]?.slice(0, 40) ?? null,
      license,
      attribution: license ? [people[0], license.name].filter(Boolean).join(", ") : null,
      tags: meta("dc.subject.other").slice(0, 6).map((s) => s.slice(0, 60)),
      publishedAt: meta("dc.date.issued")[0]?.slice(0, 10) ?? null,
    })];
  });
}

export const doab: ContentProvider = {
  id: "doab",
  name: "Directory of Open Access Books",
  homepage: "https://www.doabooks.org",
  docs: "https://www.doabooks.org/en/resources/metadata-harvesting-and-content-dissemination",
  categories: ["books", "documents", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Peer-reviewed open-access books; each record states its licence, usually Creative Commons.",
  rateLimit: "No published quota; responses are large (about 25 KB per book).",
  healthQuery: "climate",
  async search(params, ctx) {
    const q = new URLSearchParams({
      query: params.query, expand: "metadata,bitstreams",
      limit: String(params.limit), offset: String((params.page - 1) * params.limit),
    });
    return parseDoab(await getJson(ctx, `https://directory.doabooks.org/rest/search?${q}`));
  },
};

// ─── OpenStax ──────────────────────────────────────────────────────────────

interface OpenStaxBook {
  id?: number;
  title?: string;
  book_state?: string;
  cover_url?: string;
  description?: string;
  high_resolution_pdf_url?: string;
  license_name?: string;
  license_url?: string;
  meta?: { slug?: string; locale?: string };
  book_subjects?: Array<{ subject_name?: string }>;
}

// OpenStax publishes ~130 books and no search endpoint, so the catalogue is
// read once per server instance per hour and matched here.
let catalogue: { books: OpenStaxBook[]; at: number } | null = null;
const CATALOGUE_TTL_MS = 60 * 60 * 1000;

async function openStaxCatalogue(ctx: ProviderContext): Promise<OpenStaxBook[]> {
  if (catalogue && Date.now() - catalogue.at < CATALOGUE_TTL_MS) return catalogue.books;
  const fields = "title,cover_url,book_state,description,book_subjects,high_resolution_pdf_url,license_name,license_url";
  const data = await getJson<{ items?: OpenStaxBook[] }>(ctx, `https://openstax.org/apps/cms/api/v2/pages/?type=books.Book&fields=${fields}&limit=250`);
  catalogue = { books: data.items ?? [], at: Date.now() };
  return catalogue.books;
}

export function resetOpenStaxCatalogue(): void {
  catalogue = null;
}

export function matchOpenStax(books: OpenStaxBook[], query: string): ExternalContentItem[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  if (words.length === 0) return [];
  const scored = books.flatMap((book) => {
    const slug = book.meta?.slug;
    const title = clean(book.title, 200);
    if (book.book_state !== "live" || !slug || !/^[a-z0-9-]+$/.test(slug) || !title) return [];
    const subjects = (book.book_subjects ?? []).map((s) => clean(s.subject_name, 60)).filter(Boolean);
    const haystackTitle = `${title} ${subjects.join(" ")}`.toLowerCase();
    const description = clean(book.description, 600);
    const score = words.reduce((sum, w) => sum + (haystackTitle.includes(w) ? 3 : 0) + (description.toLowerCase().includes(w) ? 1 : 0), 0);
    if (score === 0) return [];
    const licenseName = clean(book.license_name, 120);
    const license = licenseName ? { name: licenseName, url: httpsUrl(book.license_url) } : null;
    return [{ score, item: makeItem("OpenStax", {
      provider: "openstax",
      providerItemId: slug,
      title,
      description: description.slice(0, 400) || null,
      contentType: "book",
      mimeType: "application/pdf",
      thumbnailUrl: httpsUrl(book.cover_url),
      externalUrl: `https://openstax.org/details/books/${slug}`,
      downloadUrl: license ? httpsUrl(book.high_resolution_pdf_url) : null,
      publisher: "OpenStax, Rice University",
      language: typeof book.meta?.locale === "string" ? book.meta.locale.slice(0, 5) : null,
      license,
      attribution: license ? `OpenStax, ${license.name}` : null,
      tags: subjects.slice(0, 4),
    }) }];
  });
  return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
}

export const openStax: ContentProvider = {
  id: "openstax",
  name: "OpenStax",
  homepage: "https://openstax.org",
  docs: "https://openstax.org/apps/cms/api/v2/pages/?type=books.Book",
  categories: ["books", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: true },
  licenseNote: "Free peer-reviewed textbooks, CC BY or CC BY-NC-SA per book. Read from the public catalogue endpoint openstax.org itself uses; OpenStax documents no search API.",
  rateLimit: "One catalogue read per server instance per hour.",
  healthQuery: "biology",
  async search(params, ctx) {
    const matches = matchOpenStax(await openStaxCatalogue(ctx), params.query);
    return matches.slice((params.page - 1) * params.limit, params.page * params.limit);
  },
};
