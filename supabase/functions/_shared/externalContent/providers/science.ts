/**
 * Open-access research, keyless: Europe PMC (life-science papers with their
 * open full text), Crossref (the DOI registry) and DOAJ (the Directory of Open
 * Access Journals). They complement OpenAlex and arXiv, which are connected in
 * scholarly.ts.
 *
 * Only what a provider states is passed on. A licence is a licence the provider
 * names; a file link is offered only when the licence lets anyone copy the
 * unchanged file.
 */

import { allowsRedistribution, clean, cleanOrNull, getJson, httpsUrl, licenseFromUrl, makeItem, tagList } from "../http.ts";
import type { ContentLicense, ContentProvider, ExternalContentItem } from "../types.ts";

/** A search string reduced to letters, digits and spaces, for engines that read query syntax. */
const plainTerms = (q: string): string => q.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// ─── Europe PMC ────────────────────────────────────────────────────────────

const EPMC_LICENSES: Record<string, ContentLicense> = {
  "cc0": { name: "CC0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "cc by": { name: "CC BY", url: "https://creativecommons.org/licenses/by/4.0/" },
  "cc by-sa": { name: "CC BY-SA", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
  "cc by-nd": { name: "CC BY-ND", url: "https://creativecommons.org/licenses/by-nd/4.0/" },
  "cc by-nc": { name: "CC BY-NC", url: "https://creativecommons.org/licenses/by-nc/4.0/" },
  "cc by-nc-sa": { name: "CC BY-NC-SA", url: "https://creativecommons.org/licenses/by-nc-sa/4.0/" },
  "cc by-nc-nd": { name: "CC BY-NC-ND", url: "https://creativecommons.org/licenses/by-nc-nd/4.0/" },
};

interface EpmcRecord {
  id?: string; source?: string; pmcid?: string; doi?: string; title?: string; authorString?: string;
  abstractText?: string; pubYear?: string; firstPublicationDate?: string; isOpenAccess?: string; license?: string;
  journalInfo?: { journal?: { title?: string } };
  language?: string;
  keywordList?: { keyword?: string[] };
  fullTextUrlList?: { fullTextUrl?: Array<{ availabilityCode?: string; documentStyle?: string; site?: string; url?: string }> };
}

export function parseEuropePmc(data: unknown): ExternalContentItem[] {
  const rows = ((data as { resultList?: { result?: EpmcRecord[] } })?.resultList?.result) ?? [];
  return rows.flatMap((r) => {
    const source = typeof r.source === "string" && /^[A-Z]{2,4}$/.test(r.source) ? r.source : null;
    const id = typeof r.id === "string" && /^[A-Za-z0-9]{1,20}$/.test(r.id) ? r.id : null;
    const title = clean(r.title, 300);
    if (!source || !id || !title) return [];
    const license = r.license ? EPMC_LICENSES[String(r.license).toLowerCase()] ?? null : null;
    const pdf = (r.fullTextUrlList?.fullTextUrl ?? []).find((u) =>
      u.availabilityCode === "OA" && u.documentStyle === "pdf" && u.site === "Europe_PMC");
    const pdfUrl = httpsUrl(pdf?.url);
    // The file is offered only for an open-access record whose licence allows copying it.
    const downloadUrl = r.isOpenAccess === "Y" && allowsRedistribution(license) && pdfUrl && /^https:\/\/europepmc\.org\//.test(pdfUrl) ? pdfUrl : null;
    const journal = clean(r.journalInfo?.journal?.title, 120);
    const year = r.pubYear ?? r.firstPublicationDate?.slice(0, 4);
    return [makeItem("Europe PMC", {
      provider: "europe_pmc",
      providerItemId: `${source}_${id}`,
      title,
      description: cleanOrNull(r.abstractText, 500),
      contentType: "document",
      mimeType: downloadUrl ? "application/pdf" : null,
      externalUrl: `https://europepmc.org/article/${source}/${id}`,
      downloadUrl,
      creator: cleanOrNull(r.authorString, 160),
      publisher: journal || null,
      language: cleanOrNull(r.language, 10),
      license,
      attribution: [clean(r.authorString, 100), year, journal, "Europe PMC"].filter(Boolean).join(", "),
      tags: tagList(r.keywordList?.keyword, 5),
      publishedAt: r.firstPublicationDate ?? (year ? String(year) : null),
    })];
  });
}

export const europePmc: ContentProvider = {
  id: "europe_pmc",
  name: "Europe PMC",
  homepage: "https://europepmc.org",
  docs: "https://europepmc.org/RestfulWebService",
  categories: ["documents", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: true },
  licenseNote: "Life-science literature. The search asks for open-access records only; a PDF is linked only when the record states a Creative Commons licence.",
  rateLimit: "No published hard limit; answered in 1.1 s on 2026-09-30 (12 s a day earlier).",
  healthQuery: "photosynthesis",
  async search(params, ctx) {
    const terms = plainTerms(params.query);
    if (!terms) return [];
    const q = new URLSearchParams({
      query: `${terms} AND OPEN_ACCESS:y`, format: "json", resultType: "core",
      pageSize: String(params.limit), page: String(params.page),
    });
    return parseEuropePmc(await getJson(ctx, `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${q}`));
  },
};

// ─── Crossref ──────────────────────────────────────────────────────────────

interface CrossrefWork {
  DOI?: string; title?: string[]; author?: Array<{ given?: string; family?: string; name?: string }>;
  abstract?: string; language?: string; publisher?: string; type?: string;
  "container-title"?: string[]; issued?: { "date-parts"?: number[][] };
  license?: Array<{ URL?: string }>;
}

const DOI = /^10\.\d{4,9}\/[^\s]{1,200}$/;

export function parseCrossref(data: unknown): ExternalContentItem[] {
  const works = ((data as { message?: { items?: CrossrefWork[] } })?.message?.items) ?? [];
  return works.flatMap((w) => {
    const doi = typeof w.DOI === "string" && DOI.test(w.DOI) ? w.DOI : null;
    const title = clean(w.title?.[0], 300);
    if (!doi || !title) return [];
    // Publisher-supplied and often about the text-mining terms, so only a Creative Commons URL is believed.
    const cc = (w.license ?? []).map((l) => licenseFromUrl(l.URL)).find((l) => l && /^CC|^Creative Commons|^Public Domain/i.test(l.name)) ?? null;
    const authors = (w.author ?? []).map((a) => clean(a.name ?? [a.given, a.family].filter(Boolean).join(" "), 80)).filter(Boolean);
    const year = w.issued?.["date-parts"]?.[0]?.[0];
    const journal = clean(w["container-title"]?.[0], 120);
    return [makeItem("Crossref", {
      provider: "crossref",
      providerItemId: doi,
      title,
      description: cleanOrNull(w.abstract, 500),
      contentType: "document",
      externalUrl: `https://doi.org/${doi}`,
      creator: authors.slice(0, 3).join(", ") || null,
      publisher: cleanOrNull(w.publisher, 120),
      language: cleanOrNull(w.language, 10),
      license: cc,
      attribution: [authors.slice(0, 2).join(", "), year, journal, "Crossref"].filter(Boolean).join(", "),
      publishedAt: typeof year === "number" ? String(year) : null,
    })];
  });
}

export const crossref: ContentProvider = {
  id: "crossref",
  name: "Crossref",
  homepage: "https://www.crossref.org",
  docs: "https://api.crossref.org/swagger-ui/index.html",
  categories: ["documents", "education"],
  auth: { kind: "optional", env: ["CROSSREF_MAILTO"] },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Metadata about 150 million scholarly works, free to reuse. Results link to the DOI; a licence is shown only when the publisher registered a Creative Commons one.",
  rateLimit: "Polite pool: a contact address in the request moves it to a faster, more reliable pool. Without CROSSREF_MAILTO the public pool is used.",
  healthQuery: "photosynthesis",
  async search(params, ctx) {
    const q = new URLSearchParams({
      query: params.query, rows: String(params.limit), offset: String((params.page - 1) * params.limit),
      select: "DOI,title,author,issued,container-title,license,abstract,publisher,type",
    });
    const mailto = ctx.env("CROSSREF_MAILTO")?.trim();
    if (mailto && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailto)) q.set("mailto", mailto);
    return parseCrossref(await getJson(ctx, `https://api.crossref.org/works?${q}`));
  },
};

// ─── DOAJ ──────────────────────────────────────────────────────────────────

interface DoajArticle {
  id?: string;
  bibjson?: {
    title?: string; abstract?: string; year?: string; keywords?: string[];
    author?: Array<{ name?: string }>;
    journal?: { title?: string; publisher?: string; language?: string[]; license?: Array<{ type?: string; url?: string }> };
    link?: Array<{ type?: string; url?: string }>;
    identifier?: Array<{ type?: string; id?: string }>;
  };
}

export function parseDoaj(data: unknown): ExternalContentItem[] {
  const rows = ((data as { results?: DoajArticle[] })?.results) ?? [];
  return rows.flatMap((row) => {
    const b = row.bibjson;
    const id = typeof row.id === "string" && /^[a-f0-9]{32}$/.test(row.id) ? row.id : null;
    const title = clean(b?.title, 300);
    if (!id || !b || !title) return [];
    const fulltext = httpsUrl(b.link?.find((l) => l.type === "fulltext")?.url);
    const doi = b.identifier?.find((i) => i.type === "doi")?.id;
    const licenseEntry = b.journal?.license?.[0];
    const license = licenseFromUrl(licenseEntry?.url) ?? (licenseEntry?.type ? { name: clean(licenseEntry.type, 40), url: null } : null);
    const authors = (b.author ?? []).map((a) => clean(a.name, 80)).filter(Boolean);
    return [makeItem("DOAJ", {
      provider: "doaj",
      providerItemId: id,
      title,
      description: cleanOrNull(b.abstract, 500),
      contentType: "document",
      externalUrl: fulltext ?? (doi && DOI.test(doi) ? `https://doi.org/${doi}` : `https://doaj.org/article/${id}`),
      creator: authors.slice(0, 3).join(", ") || null,
      publisher: cleanOrNull(b.journal?.title, 120),
      language: cleanOrNull(b.journal?.language?.[0], 10)?.toLowerCase() ?? null,
      license: license && /^CC|^Creative Commons/i.test(license.name) ? license : null,
      attribution: [authors.slice(0, 2).join(", "), b.year, clean(b.journal?.title, 100), "DOAJ"].filter(Boolean).join(", "),
      tags: tagList(b.keywords, 5),
      publishedAt: b.year ?? null,
    })];
  });
}

export const doaj: ContentProvider = {
  id: "doaj",
  name: "DOAJ",
  homepage: "https://doaj.org",
  docs: "https://doaj.org/api/v4/docs",
  categories: ["documents", "education"],
  auth: { kind: "none" },
  capabilities: { search: true, preview: false, embed: false, download: false },
  licenseNote: "Articles from peer-reviewed open-access journals; each result links to the journal's own full text, under the journal's licence.",
  rateLimit: "Two requests a second is the published guidance; answered in 0.3 s on 2026-09-30.",
  minIntervalMs: 500,
  healthQuery: "photosynthesis",
  async search(params, ctx) {
    const terms = plainTerms(params.query);
    if (!terms) return [];
    const q = new URLSearchParams({ page: String(params.page), pageSize: String(params.limit) });
    return parseDoaj(await getJson(ctx, `https://doaj.org/api/search/articles/${encodeURIComponent(terms)}?${q}`));
  },
};
