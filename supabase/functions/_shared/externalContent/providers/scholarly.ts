/**
 * Scholarly documents, keyless: OpenAlex (250M+ works, reusing the research
 * assistant's adapter) and arXiv preprints.
 */

import { searchOpenAlex } from "../../openResearchSources.ts";
import { clean, cleanOrNull, getText, makeItem } from "../http.ts";
import type { ContentProvider, ExternalContentItem } from "../types.ts";

export const openAlex: ContentProvider = {
  id: "openalex",
  name: "OpenAlex",
  homepage: "https://openalex.org",
  docs: "https://docs.openalex.org/",
  categories: ["documents", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Catalogue data is CC0. Links go to the DOI or to the open-access copy when one exists.",
  rateLimit: "100,000 requests per day, 10 per second.",
  healthQuery: "photosynthesis",
  async search(params, ctx) {
    // The research adapter applies the same 8-second timeout itself.
    const refs = await searchOpenAlex(ctx.fetch, params.query, params.limit, params.page);
    return refs.map((ref) => makeItem("OpenAlex", {
      provider: "openalex",
      providerItemId: ref.doi ?? ref.url,
      title: ref.title,
      contentType: "document",
      externalUrl: ref.url,
      creator: ref.authors.slice(0, 3).join(", ") || null,
      publishedAt: ref.year ? String(ref.year) : null,
      attribution: ref.citation,
      tags: ref.openAccess ? ["open access"] : [],
    }));
  },
};

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (xml: string, name: string): string => decode(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "");

/** arXiv answers Atom XML; the fields needed are flat enough to read without a parser. */
export function parseArxiv(xml: string): ExternalContentItem[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.flatMap((entry) => {
    const absUrl = tag(entry, "id").trim();
    const id = absUrl.match(/^https?:\/\/arxiv\.org\/abs\/([\w./-]+?)(v\d+)?$/)?.[1];
    const title = clean(tag(entry, "title"), 250);
    if (!id || !title) return [];
    const authors = (entry.match(/<author>[\s\S]*?<\/author>/g) ?? []).map((a) => clean(tag(a, "name"), 80)).filter(Boolean);
    return [makeItem("arXiv", {
      provider: "arxiv",
      providerItemId: id,
      title,
      description: cleanOrNull(tag(entry, "summary"), 500),
      contentType: "document",
      externalUrl: `https://arxiv.org/abs/${id}`,
      creator: authors.slice(0, 3).join(", ") + (authors.length > 3 ? ", et al." : "") || null,
      publisher: "arXiv",
      publishedAt: tag(entry, "published").slice(0, 10) || null,
    })];
  });
}

export const arxiv: ContentProvider = {
  id: "arxiv",
  name: "arXiv",
  homepage: "https://arxiv.org",
  docs: "https://info.arxiv.org/help/api/user-manual.html",
  categories: ["documents"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Metadata is CC0; each paper has its own licence, so the Library links to the abstract page rather than copying the PDF.",
  rateLimit: "One request every three seconds (arXiv API terms).",
  minIntervalMs: 3000,
  healthQuery: "neural network",
  async search(params, ctx) {
    const terms = params.query.replace(/[():"\\]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 8);
    if (terms.length === 0) return [];
    const q = new URLSearchParams({
      search_query: terms.map((t) => `all:${t}`).join(" AND "),
      start: String((params.page - 1) * params.limit), max_results: String(params.limit),
    });
    return parseArxiv(await getText(ctx, `https://export.arxiv.org/api/query?${q}`));
  },
};
