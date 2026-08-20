import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// `COMMENT ON FUNCTION f(args)` needs the argument types to match a function
// that exists at that point in the migration order. Name a signature that was
// dropped and Postgres answers 42883 — and because the Supabase CLI runs each
// migration file in a transaction, the whole file rolls back with it.
//
// That is how the content-publication reaper failed in production: 20260908
// dropped `reap_stale_content_publications(interval)` and recreated it as
// `(interval, int)`, and a later migration commented on the old signature. The
// deploy failed on every run, and nothing caught it before then, because no
// test and no type checker reads SQL.
//
// This replays CREATE and DROP across every migration in filename order — the
// same approach rpc-privilege-isolation.test.ts uses for grants — and checks
// each COMMENT against the signatures that exist when it runs.

const MIGRATIONS = "supabase/migrations";
const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

/** `_stale_after interval DEFAULT …, _limit int DEFAULT …` -> `interval,int`. */
function argTypes(params: string): string {
  const inner = params.trim();
  if (!inner) return "";
  return inner
    .split(",")
    .map((part) => {
      // Strip the parameter name and any DEFAULT clause, leaving the type.
      const withoutDefault = part.split(/\bDEFAULT\b/i)[0].trim();
      const words = withoutDefault.split(/\s+/).filter(Boolean);
      // `name type` or just `type`; also handles `IN name type`.
      const typeWords = words.length > 1 ? words.slice(1) : words;
      return typeWords.join(" ").toLowerCase()
        .replace(/\bint4\b/, "int").replace(/\binteger\b/, "int")
        .replace(/\btimestamp with time zone\b/, "timestamptz")
        .replace(/\bcharacter varying\b/, "varchar")
        .trim();
    })
    .filter(Boolean)
    .join(",");
}

/**
 * Balanced-paren slice, but only when the '(' *immediately* follows the name.
 *
 * Postgres lets `COMMENT ON FUNCTION f IS '…'` omit the argument list when the
 * name is unique, and most comments in this repository do. Searching forward
 * for the next '(' then finds one inside the comment's own prose — which is how
 * an earlier version of this file reported sixteen "signatures" like
 * `notify_self(academy certificate earned, unlocked)`.
 */
function paramList(sql: string, from: number): { params: string; end: number } | null {
  const open = from + (/^\s*/.exec(sql.slice(from))?.[0].length ?? 0);
  if (sql[open] !== "(") return null;
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    if (sql[i] === "(") depth++;
    else if (sql[i] === ")") {
      depth--;
      if (depth === 0) return { params: sql.slice(open + 1, i), end: i };
    }
  }
  return null;
}

interface Problem {
  file: string;
  name: string;
  wanted: string;
  available: string[];
}

function commentProblems(): Problem[] {
  /** name -> set of argument-type signatures currently defined. */
  const defined = new Map<string, Set<string>>();
  const problems: Problem[] = [];

  for (const file of files) {
    const sql = readFileSync(`${MIGRATIONS}/${file}`, "utf8");

    // Statements are checked in the order they appear inside the file.
    const statements = [...sql.matchAll(
      /\b(CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|DROP\s+FUNCTION(?:\s+IF\s+EXISTS)?|COMMENT\s+ON\s+FUNCTION)\s+(?:public\.)?(\w+)/gi,
    )];

    for (const match of statements) {
      const verb = match[1].replace(/\s+/g, " ").toUpperCase();
      const name = match[2];
      // End of the whole match, which ends at the name — not end-minus-name,
      // which points at the name's first letter and finds no '(' at all.
      const list = paramList(sql, match.index! + match[0].length);
      const signature = list ? argTypes(list.params) : "";

      if (verb.startsWith("CREATE")) {
        if (!defined.has(name)) defined.set(name, new Set());
        defined.get(name)!.add(signature);
      } else if (verb.startsWith("DROP")) {
        defined.get(name)?.delete(signature);
        if (defined.get(name)?.size === 0) defined.delete(name);
      } else {
        // No argument list means Postgres resolves by name alone, which is
        // legal and unambiguous here — nothing to check.
        if (!list) continue;
        const available = [...(defined.get(name) ?? [])];
        // A function this repository never creates is out of scope: it may be
        // a Supabase built-in, and guessing would only produce noise.
        if (available.length === 0) continue;
        if (!available.includes(signature)) {
          problems.push({ file, name, wanted: signature, available });
        }
      }
    }
  }

  return problems;
}

describe("COMMENT ON FUNCTION names a signature that exists", () => {
  it("finds no comment pointing at a dropped or never-created signature", () => {
    const problems = commentProblems();
    const described = problems.map(
      (p) => `${p.file}: ${p.name}(${p.wanted}) — defined: ${p.available.map((a) => `(${a})`).join(" ")}`,
    );
    expect(described, "a COMMENT would fail with 42883 and roll its migration back").toEqual([]);
  });

  it("actually parses signatures, rather than passing on an empty sweep", () => {
    // Guards the guard: if the regex stopped matching, the test above would
    // pass vacuously and this whole file would be worthless.
    const sql = readFileSync(
      `${MIGRATIONS}/20260908000000_social_publishing_intent_and_parking.sql`,
      "utf8",
    );
    expect(sql).toContain("DROP FUNCTION IF EXISTS public.reap_stale_content_publications(interval);");
    expect(files.length).toBeGreaterThan(50);
  });
});
