-- Security fix: take EXECUTE away from anon and authenticated on the RPCs that
-- were only ever meant to run server-side.
--
-- Privileges only. No function body, no table, no policy, no data is touched by
-- this file.
--
-- ── Why the existing protection did not work ────────────────────────────────
--
-- Most of these already said:
--
--     REVOKE ALL ON FUNCTION … FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION … TO service_role;
--
-- That reads like isolation and is not. Supabase grants EXECUTE on every new
-- function in `public` to anon, authenticated and service_role **directly**,
-- through ALTER DEFAULT PRIVILEGES. Revoking PUBLIC does not remove a direct
-- grant, so the direct grant survives and PostgREST keeps exposing the function
-- to anyone holding the browser's anon key.
--
-- Measured, not assumed: on Postgres 16 with that default-privilege condition
-- reproduced, all of these answer has_function_privilege('anon', …, 'EXECUTE')
-- with true. On production, an anonymous POST to
-- /rest/v1/rpc/content_sources_in_cooldown returns 200, and one to
-- /rest/v1/rpc/decide_owner_approval reaches the function body.
--
-- For a SECURITY DEFINER function that means an anonymous caller executing it
-- with the owner's privileges. decide_owner_approval decides owner approvals;
-- its reference space is 31^5, which is guessable over HTTP.
--
-- The library and bazaar migrations already use the three-role form. This
-- brings the rest of the project to it.
--
-- ── What is deliberately NOT here ───────────────────────────────────────────
--
-- * RLS predicates — has_role, is_library_*, is_kids_*, can_access_*. Policy
--   expressions run as the querying user, so revoking these would break reads
--   platform-wide.
-- * Admin RPCs the browser calls on purpose — ban_user, admin_grant_points,
--   toggle_user_feature and friends. Each checks has_role(auth.uid(),'admin')
--   in its own body; their exposure is the design, not a defect.
-- * Everything the browser genuinely calls — arcade_*, spend_vx, subscribe_tv,
--   match_embeddings, get_leaderboard, record_tv_watch and the rest.
--
-- Every name below was checked for callers first: none is called from `src/`
-- outside tests, none appears in a column DEFAULT or a policy expression, and
-- every SQL caller of one is itself SECURITY DEFINER — inside such a caller the
-- privilege check runs as the function owner, so composition still works.
-- subscribe_tv and subscribe_radio calling system_insert_notification is the
-- case that made this worth checking: both are browser-callable, and both are
-- SECURITY DEFINER, so they keep working.

DO $$
DECLARE
  -- Group A — already declared service-role intent, isolation incomplete.
  _names text[] := ARRAY[
    'decide_owner_approval',              -- decides owner approvals (Phase 4)
    'transition_escalation',              -- moves the escalation state machine
    'mark_escalation_viewed',
    'create_content_proposal',            -- creates a proposal and its approval
    'decide_content_proposal',
    'record_content_proposal_edit',
    'schedule_content_proposal',
    'match_content_proposals',            -- exposes unpublished drafts
    'content_sources_in_cooldown',
    'check_ai_budget',                    -- spend ceiling
    'check_ai_rate_limit',                -- per-user ceiling
    'cleanup_old_tv_data',                -- deletes rows
    'tv_cleanup_expired',
    'radio_cleanup_expired',
    'publish_scheduled_library_books',    -- publishes books
    'bump_library_daily_dimension_stat',
    'refresh_library_monthly_stats',      -- was revoked from authenticated but not anon

  -- Group B — SECURITY DEFINER, mutating, no internal authorization, and no
  -- privilege statement at all, so the default grant stood untouched.
    'system_deduct_vx',                   -- deducts VX points from any user
    'system_insert_notification',         -- injects a notification to any user
    'billing_consume',
    'billing_grant_credits',              -- grants credits
    'billing_initialize_user',
    'billing_refund',
    'claim_queue_jobs',
    'enqueue_due_organization_reports',
    'increment_career_usage',
    'log_career_security_event',
    'record_career_login_attempt',
    'ph_record_metric',
    'recompute_kids_story_count',
    'vs_log_training'
  ];
  _name    text;
  _fn      record;
  _touched int;
BEGIN
  FOREACH _name IN ARRAY _names LOOP
    _touched := 0;

    -- Signatures are read from the catalogue rather than written out here.
    -- Spelling an argument list wrong would abort the whole deploy, and this
    -- also covers every overload of a name rather than one chosen by hand.
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

    -- A name that matches nothing is a typo or a function that was renamed. It
    -- must fail loudly: silently protecting nothing is how this defect survived
    -- in the first place.
    IF _touched = 0 THEN
      RAISE EXCEPTION 'rpc_execute_isolation: no function named public.% exists', _name;
    END IF;
  END LOOP;
END $$;
