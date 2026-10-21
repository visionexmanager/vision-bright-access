// Loads the REAL table and policy statements for the library's saved-result tables
// into a PGlite database that cannot replay their migrations whole (the library AI
// migrations need pgvector and a realtime publication, which PGlite lacks).
//
// Nothing is retyped: each statement is read out of the migration that defines it, so a
// weakened policy in a migration is a weakened policy here. Foreign keys are dropped
// (their targets are not loaded and are irrelevant to row-level security); two helper
// objects the policies call are stubbed and said so.
import { readFileSync } from "node:fs";

const SOURCES = {
  library_ai_summaries: "supabase/migrations/20260725000000_library_ai_reading_assistant.sql",
  library_ai_chat_sessions: "supabase/migrations/20260725000000_library_ai_reading_assistant.sql",
  library_ai_content_cache: "supabase/migrations/20260727000000_library_ai_assistant_v2.sql",
  library_librarian_daily_plans: "supabase/migrations/20260805000000_library_ai_personal_librarian.sql",
  library_librarian_summaries: "supabase/migrations/20260805000000_library_ai_personal_librarian.sql",
  library_flashcard_decks: "supabase/migrations/20260802000000_library_learning_hub.sql",
  library_research_analyses: "supabase/migrations/20260803000000_library_knowledge_research_platform.sql",
};
const LATER = "supabase/migrations/20261080000000_library_content_cache_not_enumerable.sql";

/** The one book id the stubbed access function says the caller may read. */
export const ACCESSIBLE_BOOK = "00000000-0000-0000-0000-0000000000b1";
export const HIDDEN_BOOK = "00000000-0000-0000-0000-0000000000b2";

const read = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const statements = (text) => text.split(/;\s*\n/).map((s) => s.replace(/^(\s*--[^\n]*\n)+/g, "").trim()).filter(Boolean);

export async function loadLibrarySavedTables(db) {
  // As on Supabase: the service role bypasses row-level security (the stub role is created without it).
  await db.exec("ALTER ROLE service_role BYPASSRLS");
  // Stubs for what the policies call. can_access_library_book_content is the real
  // function's contract (may this caller read this book), decided here by book id.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS public.library_chapters (id uuid PRIMARY KEY, is_free_preview boolean NOT NULL DEFAULT false);
    CREATE OR REPLACE FUNCTION public.can_access_library_book_content(_book_id uuid) RETURNS boolean
      LANGUAGE sql STABLE AS $$ SELECT _book_id = '${ACCESSIBLE_BOOK}'::uuid $$;
  `);
  const loaded = [];
  for (const [table, file] of Object.entries(SOURCES)) {
    const re = new RegExp(`^(CREATE TABLE( IF NOT EXISTS)? public\\.${table} \\(|ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY|CREATE POLICY "[^"]+"\\s+ON public\\.${table}\\b)`, "i");
    const picked = statements(read(file)).filter((s) => re.test(s));
    if (!picked.some((s) => /^CREATE TABLE/i.test(s))) throw new Error(`no CREATE TABLE for ${table} in ${file}`);
    for (let s of picked) {
      s = s.replace(/\s+REFERENCES\s+[\w.]+\s*\(\s*\w+\s*\)(\s+ON DELETE (CASCADE|SET NULL))?/gi, "");
      if (/^CREATE TABLE/i.test(s) && /library_summary_period/.test(s)) {
        await db.exec("DO $$ BEGIN CREATE TYPE public.library_summary_period AS ENUM ('daily','weekly','monthly','yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$");
      }
      await db.exec(s);
    }
    loaded.push(table);
  }
  // Then the migration that closes the shared cache to listing.
  await db.exec(read(LATER));
  return loaded;
}
