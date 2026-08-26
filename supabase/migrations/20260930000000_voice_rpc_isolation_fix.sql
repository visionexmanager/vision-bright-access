-- The six voice RPCs were reachable by anyone. This closes that.
--
-- ── What went wrong ─────────────────────────────────────────────────────────
--
-- 20260929000000 ended each new function with:
--
--     REVOKE ALL ON FUNCTION public.<fn>(...) FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION public.<fn>(...) TO service_role;
--
-- which reads like isolation and is not. Supabase's default privileges grant
-- EXECUTE on functions in `public` to `anon` and `authenticated` explicitly, and
-- revoking from PUBLIC does not touch an explicit grant to a named role. So all
-- six stayed callable by anybody holding the publishable key — which ships in
-- the page source.
--
-- 20260906000000 had already got this right, in one line that says all three:
-- `REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated`. That migration
-- is where this block comes from.
--
-- ── What was exposed ────────────────────────────────────────────────────────
--
-- Confirmed by probing production with the publishable key, 2026-08-26:
--
--   whatsapp_voice_options       200 — a linked account's voice names, for any
--                                      phone number somebody cares to type
--   whatsapp_resolve_voice       200 — the ElevenLabs voice id behind it
--   whatsapp_select_voice        200 — change which voice answers a stranger
--   vs_expired_sample_batch      200 — storage paths, which begin with a user id
--   vs_mark_samples_deleted      204 — *deletes* vs_voice_datasets rows
--   vs_mark_samples_delete_failed 204 — writes an arbitrary string to a profile
--
-- The last two are the serious ones: they mutate, and one of them destroys rows
-- belonging to a stranger.
--
-- ── Why the catalogue, not a written list of signatures ─────────────────────
--
-- Copied from 20260906000000 for its reason as well as its shape: spelling an
-- argument list wrong aborts the deploy, and reading `pg_proc` covers every
-- overload rather than the one somebody remembered. A name that matches nothing
-- raises, because silently protecting nothing is how this survived a review.

DO $$
DECLARE
  _names text[] := ARRAY[
    'whatsapp_voice_options',
    'whatsapp_select_voice',
    'whatsapp_resolve_voice',
    'vs_expired_sample_batch',
    'vs_mark_samples_deleted',
    'vs_mark_samples_delete_failed'
  ];
  _name    text;
  _fn      record;
  _touched int;
BEGIN
  FOREACH _name IN ARRAY _names LOOP
    _touched := 0;

    FOR _fn IN
      SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname = _name
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _fn.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _fn.sig);
      _touched := _touched + 1;
    END LOOP;

    IF _touched = 0 THEN
      RAISE EXCEPTION 'voice_rpc_isolation_fix: no function named public.% exists', _name;
    END IF;
  END LOOP;
END $$;
