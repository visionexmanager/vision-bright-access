/**
 * Library — Citation Export (Phase 11: Academic Support)
 *
 * Pure, client-side formatting from a book's existing catalog metadata
 * (title/author/publisher/year/ISBN/DOI) — no AI call, no edge function;
 * citation formatting is a deterministic transform, not something that
 * benefits from an LLM.
 */

import type { LibraryBookRow } from "@/lib/types/library-book";

export type CitationFormat = "apa" | "mla" | "chicago" | "harvard" | "ieee" | "bibtex" | "ris";

function authorLastFirst(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(" ");
  return `${last}, ${first}`;
}

/** IEEE puts the initial(s) before the surname: "John Smith" -> "J. Smith". */
function authorInitialFirst(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => `${p.charAt(0).toUpperCase()}.`).join(" ");
  return `${initials} ${last}`;
}

function citeKey(book: LibraryBookRow): string {
  const lastName = book.author_name.trim().split(/\s+/).pop() ?? "book";
  const year = book.published_year ?? "";
  return `${lastName.toLowerCase().replace(/[^a-z0-9]/g, "")}${year}`;
}

export function formatCitation(book: LibraryBookRow, format: CitationFormat): string {
  const year = book.published_year ?? "n.d.";
  const publisher = book.publisher_name ?? "";

  switch (format) {
    case "apa": {
      // Author, A. A. (Year). Title: Subtitle. Publisher.
      const title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
      return [`${authorLastFirst(book.author_name)} (${year}). ${title}.`, publisher ? `${publisher}.` : "", book.doi ? `https://doi.org/${book.doi}` : ""]
        .filter(Boolean).join(" ");
    }
    case "mla": {
      // Author. Title. Publisher, Year.
      const title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
      return [`${authorLastFirst(book.author_name)}.`, `${title}.`, publisher ? `${publisher},` : "", `${year}.`].filter(Boolean).join(" ");
    }
    case "chicago": {
      // Author. Title. Place: Publisher, Year.
      const title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
      return [`${authorLastFirst(book.author_name)}.`, `${title}.`, publisher ? `${publisher},` : "", `${year}.`].filter(Boolean).join(" ");
    }
    case "harvard": {
      // Surname, Initial. (Year) Title: Subtitle. Publisher.
      const title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
      return [`${authorLastFirst(book.author_name)} (${year})`, `${title}.`, publisher ? `${publisher}.` : ""]
        .filter(Boolean).join(" ");
    }
    case "ieee": {
      // A. Author, Title. Publisher, Year.
      const title = book.subtitle ? `${book.title}: ${book.subtitle}` : book.title;
      return [`${authorInitialFirst(book.author_name)},`, `${title}.`, publisher ? `${publisher},` : "", `${year}.`]
        .filter(Boolean).join(" ");
    }
    case "bibtex": {
      const fields = [
        `  author    = {${book.author_name}}`,
        `  title     = {${book.title}}`,
        book.published_year ? `  year      = {${book.published_year}}` : "",
        publisher ? `  publisher = {${publisher}}` : "",
        book.isbn ? `  isbn      = {${book.isbn}}` : "",
        book.doi ? `  doi       = {${book.doi}}` : "",
      ].filter(Boolean).join(",\n");
      return `@book{${citeKey(book)},\n${fields}\n}`;
    }
    case "ris": {
      const lines = [
        "TY  - BOOK",
        `AU  - ${book.author_name}`,
        `TI  - ${book.title}`,
        book.published_year ? `PY  - ${book.published_year}` : "",
        publisher ? `PB  - ${publisher}` : "",
        book.isbn ? `SN  - ${book.isbn}` : "",
        book.doi ? `DO  - ${book.doi}` : "",
        "ER  - ",
      ].filter(Boolean);
      return lines.join("\n");
    }
    default:
      return "";
  }
}

export const CITATION_FORMATS: { value: CitationFormat; label: string }[] = [
  { value: "apa", label: "APA" },
  { value: "mla", label: "MLA" },
  { value: "chicago", label: "Chicago" },
  { value: "harvard", label: "Harvard" },
  { value: "ieee", label: "IEEE" },
  { value: "bibtex", label: "BibTeX" },
  { value: "ris", label: "RIS" },
];

/** Citation Validation — checks the fields a citation needs to be
 *  minimally complete, regardless of format. Deterministic, no AI. */
export interface CitationValidationResult {
  isValid: boolean;
  missingFields: string[];
}

export function validateCitation(book: LibraryBookRow): CitationValidationResult {
  const missingFields: string[] = [];
  if (!book.author_name?.trim()) missingFields.push("author");
  if (!book.title?.trim()) missingFields.push("title");
  if (!book.published_year) missingFields.push("year");
  return { isValid: missingFields.length === 0, missingFields };
}
