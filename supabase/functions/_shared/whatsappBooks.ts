// Books: the Visionex library first, and the world's catalogue when it has none.
//
// A sender asked for a book the library does not hold and was given nothing.
// Open Library is the answer to that: an open catalogue of tens of millions of
// editions, searchable in Arabic, keyless, and it says which books are free to
// read (public domain, on the Internet Archive) or free to borrow.
//
// What leaves this module: the title a sender typed, to Open Library. Never
// their number, never anything else they said.
//
// Pure apart from `searchOpenLibrary`, which takes an injectable fetch.

import type { Language } from "./whatsappCatalog.ts";
import { say } from "./whatsappStrings.ts";

export const LIBRARY_BOOK_URL = "https://visionex.app/library/books/";

/** The longest title worth searching for. Longer is a sentence, not a title. */
export const BOOK_QUERY_MAX_CHARS = 80;

/** How many books one answer lists. A list read aloud stops helping past this. */
export const MAX_BOOKS = 5;

const OPEN_LIBRARY_TIMEOUT_MS = 8_000;

/**
 * "Book" in the twenty languages, and the few words people put before it.
 *
 * A request is the book word followed by a title: "كتاب الأمير الصغير",
 * "book the little prince", "libro cien años de soledad". The word alone is a
 * request with no title, which is answered by asking for one.
 */
const BOOK_WORDS = [
  // Not "كتب" (also "wrote") or "قصة" ("قصة حياتي…"): both start sentences
  // that are not requests.
  "كتاب", "رواية", "روايه",
  "book", "books", "novel", "ebook", "e-book",
  "libro", "livre", "roman", "buch", "livro", "książka", "ksiazka", "powieść",
  "boek", "kitap", "buku", "sách", "книга", "роман",
  // Not 本 or 書 alone: 本当 ("really") and 書く ("write") start with them.
  "书", "书籍", "書籍", "小说", "小説", "책", "소설",
  "किताब", "पुस्तक", "उपन्यास", "বই", "উপন্যাস", "کتاب", "ناول", "رمان",
];

const LEAD = /^(?:(?:بدي|بدّي|ابغى|أبغى|ابي|أبي|أريد|اريد|عايز|عاوز|محتاج|ابحث عن|ابحثلي عن|دور على|دورلي على|دوّرلي على|فتش على|فتشلي على|هات|اعطيني|أعطني|عندكم|في عندكم|فيه|هل يوجد|هل عندكم|وين بلاقي|وين الاقي|i want|i need|find me|find|search for|looking for|do you have|have you got|get me|send me|the|a|an|quiero|busco|je cherche|ich suche|procuro|szukam|ik zoek|arıyorum|saya cari)\s+)*/iu;
const CALLED = /^(?:(?:اسمه|اسمها|بعنوان|عنوانه|اللي اسمه|called|named|titled|by the name)\s+)/iu;
const QUOTES = /^[«"'“”‘’《「]+|[«»"'“”‘’》」]+$/gu;
const TRAILING = /[\s.,!?؟،。！？…]+$/u;

export type BookRequest = { query: string | null };

/**
 * A book request, or null.
 *
 * Deliberately needs the book word at the start (after at most a few "I want"
 * words), so "قرأت كتاب حلو امبارح" stays a conversation.
 */
export function parseBookRequest(text: string): BookRequest | null {
  const trimmed = (text ?? "").trim().replace(TRAILING, "");
  if (!trimmed || trimmed.length > BOOK_QUERY_MAX_CHARS + 30) return null;

  const rest = trimmed.replace(LEAD, "");
  const lower = rest.toLowerCase();
  // Longest first, so "books" is not read as "book" + "s".
  const word = [...BOOK_WORDS]
    .sort((a, b) => b.length - a.length)
    .find((candidate) => lower === candidate || [" ", ":", "：", "《", "「", "«"].some((gap) => lower.startsWith(candidate + gap)));
  if (!word) return null;
  // "book a table", "book me a flight": the verb, not the noun.
  if (/^(?:book|books)\s+(?:a|an|me|us|my|our|for|appointment|table|flight|hotel|ticket|tickets|room|session|consultation|now|it)(?:\s|$)/i.test(lower)) {
    return null;
  }

  const title = rest
    .slice(word.length)
    .replace(/^[\s:：《「«-]+/u, "")
    .replace(CALLED, "")
    .replace(QUOTES, "")
    .trim();
  if (!title) return { query: null };
  if (title.length > BOOK_QUERY_MAX_CHARS) return null;
  return { query: title };
}

/** One book, wherever it was found. */
export interface FoundBook {
  title: string;
  author: string | null;
  year: number | null;
  source: "visionex" | "openlibrary" | "archive";
  url: string;
  /** Free to read or download, with the address to do it. */
  freeReadUrl: string | null;
  /** Free to borrow online with an Open Library account. */
  borrowable: boolean;
}

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  ebook_access?: string;
  ia?: string[];
};

/**
 * Open Library's search, as books.
 *
 * `null` when it could not be reached, `[]` when it has nothing by that title —
 * the caller says different things for the two.
 */
export async function searchOpenLibrary(
  query: string,
  options: { fetchImpl?: typeof fetch; limit?: number } = {},
): Promise<FoundBook[] | null> {
  const doFetch = options.fetchImpl ?? fetch;
  const term = query.trim().slice(0, BOOK_QUERY_MAX_CHARS);
  if (!term) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPEN_LIBRARY_TIMEOUT_MS);
  try {
    const response = await doFetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}` +
      `&limit=${options.limit ?? MAX_BOOKS * 2}&fields=key,title,author_name,first_publish_year,ebook_access,ia`,
      {
        signal: controller.signal,
        headers: { "User-Agent": "VisionexAssistant/1.0 (+https://visionex.app; support@visionex.app)", Accept: "application/json" },
      },
    );
    if (!response.ok) {
      console.error(`[whatsapp-books] open library responded ${response.status}`);
      return null;
    }
    const body = await response.json() as { docs?: OpenLibraryDoc[] };
    const books: FoundBook[] = [];
    // The same book is often catalogued twice, under two spellings of its
    // author's name. One line each is what a listener needs.
    const seen = new Set<string>();
    for (const doc of body.docs ?? []) {
      if (!doc.title || !doc.key || !doc.key.startsWith("/works/")) continue;
      const identity = `${doc.title.trim().toLowerCase()}|${doc.first_publish_year ?? ""}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const archive = doc.ia?.find((id) => /^[A-Za-z0-9._-]{1,100}$/.test(id)) ?? null;
      books.push({
        title: doc.title,
        author: doc.author_name?.[0] ?? null,
        year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
        source: "openlibrary",
        url: `https://openlibrary.org${doc.key}`,
        freeReadUrl: doc.ebook_access === "public" && archive ? `https://archive.org/details/${archive}` : null,
        borrowable: doc.ebook_access === "borrowable",
      });
    }
    return books;
  } catch {
    // Never the message: it quotes the URL, which carries what was searched.
    console.error("[whatsapp-books] open library request failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Free books on the Internet Archive — public domain and openly licensed
 * texts, many of them Arabic, readable and downloadable in full.
 *
 * Lending-only scans (the "inlibrary" and "printdisabled" collections) are
 * excluded: those need an account and a loan, which is not "free to read".
 */
export async function searchArchiveTexts(
  query: string,
  options: { fetchImpl?: typeof fetch } = {},
): Promise<FoundBook[] | null> {
  const doFetch = options.fetchImpl ?? fetch;
  // Letters, digits and spaces only: nothing of the Archive's query syntax gets in.
  const terms = query.replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, BOOK_QUERY_MAX_CHARS);
  if (!terms) return [];
  const q = `title:(${terms}) AND mediatype:(texts) AND NOT collection:(inlibrary) AND NOT collection:(printdisabled)`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPEN_LIBRARY_TIMEOUT_MS);
  try {
    const response = await doFetch(
      `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
      "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=year&rows=5&sort%5B%5D=downloads+desc&output=json",
      {
        signal: controller.signal,
        headers: { "User-Agent": "VisionexAssistant/1.0 (+https://visionex.app; support@visionex.app)", Accept: "application/json" },
      },
    );
    if (!response.ok) {
      console.error(`[whatsapp-books] archive responded ${response.status}`);
      return null;
    }
    const body = await response.json() as {
      response?: { docs?: Array<{ identifier?: string; title?: string; creator?: string | string[]; year?: string | number }> };
    };
    return (body.response?.docs ?? [])
      .filter((doc) => doc.title && doc.identifier && /^[A-Za-z0-9._-]{1,100}$/.test(doc.identifier))
      .map((doc) => {
        const year = Number(String(doc.year ?? "").slice(0, 4));
        return {
          title: String(doc.title),
          author: Array.isArray(doc.creator) ? doc.creator[0] ?? null : doc.creator ?? null,
          year: Number.isFinite(year) && year > 0 ? year : null,
          source: "archive" as const,
          url: `https://archive.org/details/${doc.identifier}`,
          freeReadUrl: `https://archive.org/details/${doc.identifier}`,
          borrowable: false,
        };
      });
  } catch {
    console.error("[whatsapp-books] archive request failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** A Visionex library row, as a book. */
export function libraryBook(row: {
  id: string;
  title: string;
  is_free?: boolean | null;
  published_date?: string | null;
  author?: string | null;
}): FoundBook {
  const year = row.published_date ? Number(String(row.published_date).slice(0, 4)) : NaN;
  return {
    title: row.title,
    author: row.author ?? null,
    year: Number.isFinite(year) ? year : null,
    source: "visionex",
    url: `${LIBRARY_BOOK_URL}${row.id}`,
    freeReadUrl: null,
    borrowable: false,
  };
}

function bookLine(book: FoundBook, language: Language): string[] {
  const byline = [book.author, book.year ? String(book.year) : null].filter(Boolean).join(", ");
  const lines = [`• ${book.title}${byline ? ` — ${byline}` : ""}`];
  if (book.freeReadUrl) lines.push(`  ${say("booksFreeRead", language)}: ${book.freeReadUrl}`);
  else if (book.borrowable) lines.push(`  ${say("booksBorrow", language)}: ${book.url}`);
  else lines.push(`  ${book.url}`);
  return lines;
}

/**
 * The answer: the library's own books first, then the outside catalogue, each
 * under a heading that says which is which — a sender must never think a
 * book from outside is one Visionex holds.
 */
export function formatBooks(params: {
  language: Language;
  query: string;
  library: FoundBook[];
  outside: FoundBook[];
  /** Free full texts from the Internet Archive. */
  archive?: FoundBook[];
}): string {
  const { language, query } = params;
  const library = params.library.slice(0, MAX_BOOKS);
  const outside = params.outside.slice(0, Math.max(MAX_BOOKS - library.length, 2));
  const archive = (params.archive ?? []).slice(0, 3);
  const lines = [`📚 ${say("booksHeading", language).replace("{query}", query)}`];
  if (library.length > 0) {
    lines.push("", `*${say("booksInVisionex", language)}*`);
    for (const book of library) lines.push(...bookLine(book, language));
  }
  if (outside.length > 0) {
    lines.push("", `*${say("booksFromOutside", language)}*`);
    for (const book of outside) lines.push(...bookLine(book, language));
  }
  if (archive.length > 0) {
    lines.push("", `*${say("booksFromArchive", language)}*`);
    for (const book of archive) lines.push(...bookLine(book, language));
  }
  return lines.join("\n");
}

/** Asked for a book without naming one. */
export const bookAskNotice = (language: Language): string => say("booksAsk", language);

/** Neither catalogue could be reached. */
export const booksUnavailableNotice = (language: Language): string => say("booksUnavailable", language);

/**
 * For the assistant, when no catalogue has the book: say what is known about
 * it without inventing where to get it.
 */
export function bookNotFoundDirective(query: string): string {
  return [
    `The sender asked for a book: "${query.replace(/["\n]/g, " ").slice(0, BOOK_QUERY_MAX_CHARS)}".`,
    "It is not in the Visionex library, and the Open Library catalogue returned nothing for that title.",
    "Do not say only that it was not found. Tell them what you reliably know about the book or the closest titles it may be (author, subject, year), ask for the author's name or a different spelling if that would help, and suggest they try again with it.",
    "Never invent a link, a price or a download source.",
  ].join(" ");
}
