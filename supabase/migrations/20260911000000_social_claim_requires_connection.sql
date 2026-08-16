-- Phase 9, step 3: a slot is not claimed for an account that cannot publish.
--
-- Step 2 gave a token somewhere to live and deliberately stopped there, leaving
-- the publishing path exactly as Phase 8 wrote it. That path asks one question
-- about the account — is it `active` — and `active` is a statement about the
-- platform review, recorded by a human, not about whether an OAuth grant exists
-- right now. The two came apart the moment tokens became a thing that expires.
--
-- What that costs, concretely. `resolve_social_account_token()` already refuses
-- to hand back an expired token, so the worker cannot publish with one. But the
-- refusal happens after the slot has been claimed, which means:
--
--   * the claim incremented `attempts`, so an outage on the platform's refresh
--     schedule eats the slot's retry budget,
--   * once the budget is gone the slot is out of the queue for good, and the
--     cause recorded against it is whatever the worker said, not "nobody had
--     reconnected the account",
--   * every poll repeats it, so a token that expires overnight can exhaust
--     every due slot on that platform before anyone is awake to reconnect it.
--
-- So the connection check belongs in the claim predicate, where it costs
-- nothing: an unconnected platform simply has no claimable slot, and the slot
-- waits, unaltered, for the reconnection instead of being spent against it.
--
-- What this migration does NOT do: contact anything, name a platform endpoint,
-- read or store a credential, or change what `active` means. It redefines one
-- function and adds one predicate helper.
--
-- ── The silence this would otherwise create ─────────────────────────────────
--
-- A slot that stops being claimable also stops being visible. Before this
-- change a disconnected platform failed loudly and wrongly; after it, it would
-- fail silently and correctly, and the worker would report `no_due_slot` — the
-- same answer it gives for an empty calendar. That is the worse bug of the two,
-- because nothing in the system would ever mention it again.
--
-- `claim_due_content_slot()` therefore answers the second question whenever it
-- answers the first negatively: how many due slots were withheld because the
-- platform they are for has no live grant, and which platforms those were.
-- Zero and `[]` on a genuinely empty queue, so "nothing to do" and "blocked"
-- are distinguishable by the caller that already had to handle `no_due_slot`.

-- ── One statement of what "connected" means ─────────────────────────────────
--
-- The same rule `resolve_social_account_token()` enforces and
-- `social_connection_status()` reports: a grant row exists, and it has not
-- passed its expiry. A NULL `expires_at` is a token the platform did not put a
-- clock on, and counts as live in all three places.
--
-- SECURITY INVOKER, and granted to nobody. Its callers are SECURITY DEFINER and
-- reach `social_account_tokens` as the owner; leaving this one as invoker means
-- that even if some later migration grants it to a browser role, the role still
-- cannot read the table through it. It touches no cipher column on any path —
-- existence and expiry are the only facts it reads.

CREATE OR REPLACE FUNCTION public.social_account_has_live_grant(_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.social_account_tokens t
     WHERE t.account_id = _account_id
       AND (t.expires_at IS NULL OR t.expires_at > now()));
$$;

REVOKE ALL ON FUNCTION public.social_account_has_live_grant(uuid) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.social_account_has_live_grant(uuid) IS
  'Whether an account holds an OAuth grant that has not expired. The single statement of what "connected" means for the claim path; reads no cipher column and is granted to nobody, being reachable only from the SECURITY DEFINER functions that call it.';

-- ── claim_due_content_slot(): connection joins the claimability rule ────────
--
-- Restated in full because CREATE OR REPLACE has no partial form. Same
-- signature, same parameter names, same clamping, same locking, same success
-- payload — a caller written against step 2's version needs no change. The
-- differences are all in the negative paths:
--
--   * the account predicate requires a live grant, so an expired or missing one
--     leaves the slot unclaimed rather than claimed-and-doomed,
--   * the same requirement applies to the account actually selected, and the
--     race is reported as `no_connected_account` rather than being folded into
--     `no_active_account` — the fix for one is reconnecting, for the other it
--     is re-enabling, and a worker log that conflates them sends a human to the
--     wrong screen,
--   * `no_due_slot` now carries how many due slots are waiting on a connection.

CREATE OR REPLACE FUNCTION public.claim_due_content_slot(
  _platform text DEFAULT NULL,
  _max_attempts int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slot     public.content_calendar%ROWTYPE;
  _proposal public.content_proposals%ROWTYPE;
  _account  public.social_accounts%ROWTYPE;
  _publication_id uuid;
  _attempt  integer;
  _ceiling  integer;
  _withheld integer;
  _awaiting jsonb;
  _reason   text;
BEGIN
  -- A caller may ask for fewer attempts than the maximum and can never ask for
  -- more, so no worker's argument can re-open work the system has stopped.
  _ceiling := least(
                greatest(COALESCE(_max_attempts, public.content_publish_max_attempts()), 1),
                public.content_publish_max_attempts());

  UPDATE public.content_calendar c
     SET slot_state = 'PUBLISHING',
         attempts   = c.attempts + 1,
         updated_at = now()
   WHERE c.id = (
     SELECT s.id
       FROM public.content_calendar s
       JOIN public.content_proposals p ON p.id = s.proposal_id
       JOIN public.owner_approvals   o ON o.id = p.approval_id
      WHERE s.slot_state IN ('PLANNED', 'FAILED')
        AND s.scheduled_for <= now()
        AND s.attempts < _ceiling
        -- Parked means withdrawn from every automatic path, and it is not
        -- expressed in attempts.
        AND s.parked_at IS NULL
        -- The owner decided, through Phase 4's engine. Nothing else counts.
        AND p.state = 'SCHEDULED'
        AND o.action_type = 'content_publish'
        AND o.state IN ('APPROVED', 'PROCESSING', 'COMPLETED')
        AND (_platform IS NULL OR s.platform = _platform)
        -- An active account for this platform must exist AND hold a live grant.
        -- website/newsletter have no account and are therefore never claimable
        -- here; a reviewed account whose token expired is, from here, in the
        -- same position — there is nothing to publish with, and claiming would
        -- only spend an attempt discovering that.
        AND EXISTS (
          SELECT 1 FROM public.social_accounts a
           WHERE a.platform = s.platform
             AND a.status = 'active'
             AND public.social_account_has_live_grant(a.id))
      ORDER BY s.scheduled_for
      FOR UPDATE OF s SKIP LOCKED
      LIMIT 1)
  RETURNING * INTO _slot;

  IF NOT FOUND THEN
    -- Nothing was claimable. Whether that is an empty calendar or a blocked one
    -- is the question the caller cannot otherwise ask: the connection predicate
    -- above removes those slots from the queue, and without this they would
    -- disappear from the worker's view entirely.
    --
    -- The clauses are the claimability rule again, minus the connection test,
    -- plus its inverse: due, approved, unparked, under the ceiling, on a
    -- platform Visionex holds an account row for and currently has no active
    -- account with a live grant for. Slots for `website`, `newsletter`, or any
    -- platform with no account row at all, are not counted — nobody is waiting
    -- on a connection there.
    --
    -- An account ROW, deliberately, not an ACTIVE one:
    -- revoke_social_account_token() disables the account it disconnects, so
    -- requiring `active` here would make a revoked platform the one case that
    -- vanished silently — the exact failure this block exists to prevent, and
    -- the likeliest one, since revoking is a thing a person does on purpose and
    -- then waits for the reconnection to take effect.
    SELECT count(*), coalesce(jsonb_agg(DISTINCT s.platform), '[]'::jsonb)
      INTO _withheld, _awaiting
      FROM public.content_calendar s
      JOIN public.content_proposals p ON p.id = s.proposal_id
      JOIN public.owner_approvals   o ON o.id = p.approval_id
     WHERE s.slot_state IN ('PLANNED', 'FAILED')
       AND s.scheduled_for <= now()
       AND s.attempts < _ceiling
       AND s.parked_at IS NULL
       AND p.state = 'SCHEDULED'
       AND o.action_type = 'content_publish'
       AND o.state IN ('APPROVED', 'PROCESSING', 'COMPLETED')
       AND (_platform IS NULL OR s.platform = _platform)
       AND EXISTS (
         SELECT 1 FROM public.social_accounts a
          WHERE a.platform = s.platform)
       AND NOT EXISTS (
         SELECT 1 FROM public.social_accounts a
          WHERE a.platform = s.platform
            AND a.status = 'active'
            AND public.social_account_has_live_grant(a.id));

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'no_due_slot',
      'withheld_for_connection', _withheld,
      'awaiting_connection', _awaiting);
  END IF;

  SELECT * INTO _proposal FROM public.content_proposals WHERE id = _slot.proposal_id;

  SELECT * INTO _account
    FROM public.social_accounts a
   WHERE a.platform = _slot.platform
     AND a.status = 'active'
     AND public.social_account_has_live_grant(a.id)
   ORDER BY a.priority, a.health_score DESC
   LIMIT 1;

  IF NOT FOUND THEN
    -- Raced with the account being disabled, or with its grant being revoked or
    -- expiring, between the predicate and here. No publication row exists and
    -- nothing was dispatched, so the slot is resolved retryable rather than
    -- parked — but which of the two happened is recorded, because reconnecting
    -- an account and re-enabling one are different actions on different screens.
    _reason := CASE
      WHEN EXISTS (SELECT 1 FROM public.social_accounts a
                    WHERE a.platform = _slot.platform AND a.status = 'active')
      THEN 'no_connected_account'
      ELSE 'no_active_account'
    END;

    PERFORM public.resolve_content_slot(_slot.id, _reason);
    RETURN jsonb_build_object('ok', false, 'error', _reason);
  END IF;

  SELECT count(*) + 1 INTO _attempt
    FROM public.social_publications WHERE calendar_id = _slot.id;

  INSERT INTO public.social_publications
    (proposal_id, calendar_id, account_id, platform, state, attempt)
  VALUES (_proposal.id, _slot.id, _account.id, _slot.platform, 'CLAIMED', _attempt)
  RETURNING id INTO _publication_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'content_slot_claimed', 'content_calendar', _slot.id,
          jsonb_build_object('proposal_ref', _proposal.proposal_ref,
                             'platform', _slot.platform,
                             'attempt', _attempt));

  -- api_key_ref is the NAME of a secret. The worker resolves it from the
  -- environment; this function has no access to the value and never will. The
  -- per-account token is not here either — the worker asks
  -- resolve_social_account_token() for it, with a passphrase this function
  -- never sees. What the claim guarantees is only that one existed a moment ago.
  RETURN jsonb_build_object(
    'ok', true,
    'publication_id', _publication_id,
    'calendar_id', _slot.id,
    'proposal_ref', _proposal.proposal_ref,
    'platform', _slot.platform,
    'content_type', _proposal.content_type,
    'language', _proposal.language,
    'hook', _proposal.hook,
    'body', _proposal.body,
    'hashtags', to_jsonb(_proposal.hashtags),
    'attempt', _attempt,
    'max_attempts', _ceiling,
    'account', jsonb_build_object(
      'id', _account.id,
      'handle', _account.handle,
      'external_account_id', _account.external_account_id,
      'capabilities', to_jsonb(_account.capabilities),
      'api_key_ref', _account.api_key_ref,
      'base_url', _account.base_url,
      'config', _account.config)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_content_slot(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_content_slot(text, int) TO service_role;

COMMENT ON FUNCTION public.claim_due_content_slot(text, int) IS
  'Claims one due slot atomically for an account that is active AND holds an unexpired OAuth grant. A slot for a disconnected platform is left unclaimed rather than spent, and no_due_slot reports how many were withheld for that reason and on which platforms. _max_attempts is still clamped to content_publish_max_attempts(), and a parked slot is never claimable at any ceiling.';
