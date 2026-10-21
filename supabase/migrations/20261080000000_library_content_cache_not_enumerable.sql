-- library_ai_content_cache: a stored answer can be fetched by its key, not listed.
--
-- The table holds the result of every "translate this passage" / "explain this
-- passage" request (keyed by a sha-256 of mode, language, reading mode and the
-- text). Its only policy let ANY signed-in account `SELECT` EVERY ROW
-- (`USING (true)`, 20260727), so a PostgREST `select=*` returned every other
-- user's translations and explanations, including of text they pasted rather
-- than a book passage. The saved-answer path (cost-aware trial policy) puts this
-- table in front of every account, including the free week and Kids, so it must
-- not be a bulk-readable store.
--
-- What changes:
--   * the "authenticated read" policy is dropped and the table's grants to anon
--     and authenticated are revoked. RLS stays on; with no policy only the
--     service role can read or write it.
--   * library-ai-assistant looks a stored answer up with the service role, by the
--     exact hash only (`.eq("content_hash", key)`), so a caller still gets back
--     precisely the answer for the text it sent, and nothing it did not ask for.
--     (Nothing in the browser reads this table; it had no other reader.)
--
-- What does not change: library_ai_summaries (still readable only where the
-- caller may access the book), every per-user saved table (owner-only policies),
-- and the table's contents. Idempotent. Rollback: re-create the policy
--   CREATE POLICY "library_ai_content_cache: authenticated read"
--     ON public.library_ai_content_cache FOR SELECT TO authenticated USING (true);
-- and `GRANT SELECT ON public.library_ai_content_cache TO authenticated;`
-- (not recommended: it restores the bulk read).

DROP POLICY IF EXISTS "library_ai_content_cache: authenticated read" ON public.library_ai_content_cache;

ALTER TABLE public.library_ai_content_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.library_ai_content_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.library_ai_content_cache TO service_role;

COMMENT ON TABLE public.library_ai_content_cache IS
  'Stored results of translate/explain-paragraph, keyed by sha-256. RLS on with NO policy on purpose: service role only, looked up by exact hash, never listable. Do not add a read policy.';
