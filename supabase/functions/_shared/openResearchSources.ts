/**
 * Open research sources for the Library's research assistant.
 *
 * The assistant's own references come from the Library catalogue, which on
 * 2026-09-27 held 8 books: a topic almost never matched anything. This asks
 * three open, keyless catalogues instead, in parallel:
 *
 *   OpenAlex      scholarly works — title, authors, year, DOI, open-access link
 *   Open Library  books — title, authors, first publication year
 *   Wikipedia     encyclopedia articles, in the reader's language
 *
 * Every reference is a record one of them returned; nothing here is written by
 * a model, so nothing can be invented. A source that fails or is slow is
 * reported by name and the others still answer.
 *
 * Pure: `fetch` is passed in, so the suite exercises the parsing without a
 * network. Only fixed hosts are called, and the topic only ever travels as a
 * query parameter.
 */

export type OpenSource = "openalex" | "openlibrary" | "wikipedia";
export type SourceStatus = "ok" | "failed" | "timeout";

export interface OpenReference {
  source: OpenSource;
  kind: "article" | "book" | "encyclopedia";
  title: string;
  authors: string[];
  year: number | null;
  /** Where a reader can open it: the DOI, the open-access copy, or the page. */
  url: string;
  doi: string | null;
  openAccess: boolean;
  /** OpenAlex only: the open-access copy as a PDF, and its licence, when the record states both. */
  pdfUrl?: string | null;
  license?: string | null;
  /** Wikipedia only: the matching passage, as plain text. */
  snippet: string | null;
  /** One line to paste into a bibliography, with the link. */
  citation: string;
}

export interface OpenSourcesResult {
  references: OpenReference[];
  sources: Record<OpenSource, SourceStatus>;
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

const USER_AGENT = "Visionex-Library/1.0 (+https://visionex.app)";
const TIMEOUT_MS = 8000;
const WIKIPEDIA_LANGUAGES = new Set(["ar", "en", "fr", "es", "de", "it", "pt", "ru", "tr", "fa", "ur", "hi", "bn", "zh", "ja", "ko", "id", "nl", "sv", "pl"]);
const ARABIC_SCRIPT = new RegExp(`[${String.fromCharCode(0x0600)}-${String.fromCharCode(0x06ff)}]`);

const clean = (value: unknown, max = 400): string =>
  typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ").trim().slice(0, max) : "";

/** "A", "A & B", "A, B, & C" — up to three authors, "et al." after. */
function authorList(authors: string[]): string {
  if (authors.length === 0) return "";
  const shown = authors.slice(0, 3);
  const joined = shown.length === 1 ? shown[0]
    : shown.length === 2 ? `${shown[0]} & ${shown[1]}`
    : `${shown.slice(0, -1).join(", ")}, & ${shown.at(-1)}`;
  return authors.length > 3 ? `${joined}, et al.` : joined;
}

export function formatCitation(ref: Omit<OpenReference, "citation">): string {
  const who = authorList(ref.authors);
  const when = ref.year ? `(${ref.year})` : "(n.d.)";
  const where = ref.source === "wikipedia" ? "Wikipedia." : ref.source === "openlibrary" ? "Open Library." : "";
  return [who ? `${who} ${when}.` : `${when}.`, `${ref.title}.`, where, ref.url].filter(Boolean).join(" ");
}

function withCitation(ref: Omit<OpenReference, "citation">): OpenReference {
  return { ...ref, citation: formatCitation(ref) };
}

async function getJson(fetchFn: Fetch, url: string): Promise<unknown> {
  // AbortSignal.timeout is in Deno and every current browser; jsdom's
  // AbortSignal lacks it, and a missing timeout must not become a failed search.
  const signal = typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const res = await fetchFn(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function searchOpenAlex(fetchFn: Fetch, topic: string, limit = 6, page = 1): Promise<OpenReference[]> {
  const params = new URLSearchParams({
    search: topic,
    "per-page": String(limit),
    page: String(page),
    select: "id,title,publication_year,doi,authorships,open_access,primary_location,best_oa_location",
  });
  const data = await getJson(fetchFn, `https://api.openalex.org/works?${params}`) as { results?: Array<Record<string, unknown>> };
  return (data.results ?? []).flatMap((work) => {
    const title = clean(work.title, 300);
    if (!title) return [];
    const authors = ((work.authorships as Array<{ author?: { display_name?: string } }>) ?? [])
      .map((a) => clean(a.author?.display_name, 120)).filter(Boolean);
    const doi = typeof work.doi === "string" && work.doi.startsWith("https://doi.org/") ? work.doi : null;
    const oa = (work.open_access ?? {}) as { is_oa?: boolean; oa_url?: string | null };
    const landing = ((work.primary_location ?? {}) as { landing_page_url?: string | null }).landing_page_url ?? null;
    // A PDF is offered only with a stated open licence: an open-access copy without one is a link, not a file to pass on.
    const best = (work.best_oa_location ?? {}) as { pdf_url?: unknown; license?: unknown };
    const oaLicense = typeof best.license === "string" && /^(cc[-0]|public-domain)/i.test(best.license) ? best.license.slice(0, 40) : null;
    const pdfUrl = oaLicense && typeof best.pdf_url === "string" && /^https:\/\//.test(best.pdf_url) && best.pdf_url.length <= 500 ? best.pdf_url : null;
    const url = doi ?? (oa.oa_url && /^https:\/\//.test(oa.oa_url) ? oa.oa_url : null) ?? (landing && /^https:\/\//.test(landing) ? landing : null) ?? (typeof work.id === "string" ? work.id : null);
    if (!url) return [];
    return [withCitation({
      source: "openalex", kind: "article", title, authors,
      year: typeof work.publication_year === "number" ? work.publication_year : null,
      url, doi: doi ? doi.replace("https://doi.org/", "") : null, openAccess: oa.is_oa === true, snippet: null,
      ...(pdfUrl ? { pdfUrl, license: oaLicense } : {}),
    })];
  });
}

export async function searchOpenLibrary(fetchFn: Fetch, topic: string, limit = 5): Promise<OpenReference[]> {
  const params = new URLSearchParams({ q: topic, limit: String(limit), fields: "key,title,author_name,first_publish_year,ebook_access" });
  const data = await getJson(fetchFn, `https://openlibrary.org/search.json?${params}`) as { docs?: Array<Record<string, unknown>> };
  return (data.docs ?? []).flatMap((doc) => {
    const title = clean(doc.title, 300);
    const key = typeof doc.key === "string" && /^\/works\/OL\d+W$/.test(doc.key) ? doc.key : null;
    if (!title || !key) return [];
    return [withCitation({
      source: "openlibrary", kind: "book", title,
      authors: ((doc.author_name as string[]) ?? []).map((a) => clean(a, 120)).filter(Boolean),
      year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
      url: `https://openlibrary.org${key}`, doi: null, openAccess: doc.ebook_access === "public", snippet: null,
    })];
  });
}

export function wikipediaLanguage(topic: string, language?: string): string {
  if (ARABIC_SCRIPT.test(topic) && !(language === "fa" || language === "ur")) return "ar";
  const lang = (language ?? "en").toLowerCase().slice(0, 2);
  return WIKIPEDIA_LANGUAGES.has(lang) ? lang : "en";
}

export async function searchWikipedia(fetchFn: Fetch, topic: string, language?: string, limit = 3): Promise<OpenReference[]> {
  const lang = wikipediaLanguage(topic, language);
  const params = new URLSearchParams({ action: "query", list: "search", srsearch: topic, srlimit: String(limit), format: "json" });
  const data = await getJson(fetchFn, `https://${lang}.wikipedia.org/w/api.php?${params}`) as { query?: { search?: Array<Record<string, unknown>> } };
  return (data.query?.search ?? []).flatMap((page) => {
    const title = clean(page.title, 300);
    if (!title) return [];
    const timestamp = typeof page.timestamp === "string" ? Number(page.timestamp.slice(0, 4)) : NaN;
    return [withCitation({
      source: "wikipedia", kind: "encyclopedia", title, authors: [],
      year: Number.isFinite(timestamp) ? timestamp : null,
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      doi: null, openAccess: true, snippet: clean(page.snippet, 300) || null,
    })];
  });
}

/** All three, in parallel. A source that fails is named; the rest still answer. */
export async function searchOpenSources(fetchFn: Fetch, topic: string, language?: string): Promise<OpenSourcesResult> {
  const query = topic.trim().slice(0, 300);
  const runs: Array<[OpenSource, Promise<OpenReference[]>]> = [
    ["openalex", searchOpenAlex(fetchFn, query)],
    ["openlibrary", searchOpenLibrary(fetchFn, query)],
    ["wikipedia", searchWikipedia(fetchFn, query, language)],
  ];
  const settled = await Promise.allSettled(runs.map(([, run]) => run));
  const sources = {} as Record<OpenSource, SourceStatus>;
  const references: OpenReference[] = [];
  settled.forEach((outcome, i) => {
    const name = runs[i][0];
    if (outcome.status === "fulfilled") {
      sources[name] = "ok";
      references.push(...outcome.value);
    } else {
      const reason = outcome.reason as { name?: string };
      sources[name] = reason?.name === "TimeoutError" || reason?.name === "AbortError" ? "timeout" : "failed";
    }
  });
  return { references, sources };
}
