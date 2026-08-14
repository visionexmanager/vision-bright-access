-- Phase 8, PR C1: the intent marker, parking as a fact, and one ceiling.
--
-- PR #117 said what was missing and why it could not be supplied yet: "a
-- timeout proves the worker is gone; it cannot prove the worker did nothing",
-- and automatic retry after a reap becomes safe only "once the worker records
-- an intent marker before it calls the platform". This is that marker, and the
-- three consequences of having it. It still adds no worker, no adapter, no
-- external call, no Edge Function, no cron job and no credential.
--
--   social_publications.dispatched_at   the intent marker, written only by
--                                       mark_publication_dispatched()
--   content_calendar.parked_at          parking as a recorded fact, replacing
--                                       the attempts sentinel PR #117 used
--   content_publish_max_attempts()      one ceiling, which no caller can raise
--
-- ── The rule this migration exists to enforce ───────────────────────────────
--
--   dispatched_at IS NULL      the external call had not started. Nothing was
--                              published. Automatic retry is safe, bounded by
--                              content_publish_max_attempts().
--
--   dispatched_at IS NOT NULL  the external call had started. The outcome is
--                              not knowable from here — the platform may have
--                              accepted the post and the acknowledgement may
--                              have been lost. No automatic retry, at any
--                              attempt count, under any timeout, from any
--                              caller. The slot is parked and a human decides.
--
-- There is deliberately no third case. A failure reported *after* dispatch is
-- parked too, even when the adapter believes the platform rejected the post
-- outright, because the alternative is to let an unproven adapter classify its
-- own failure with duplicate publication as the penalty for getting it wrong.
-- A rejection therefore costs one requeue_content_slot() call. Nothing costs a
-- duplicate post. A finer taxonomy belongs to a later PR, and only once a
-- provider supplies evidence or an idempotency key that makes one safe.
--
-- ── Why parked_at rather than the sentinel ──────────────────────────────────
--
-- PR #117 parked a slot by setting content_calendar.attempts to 2147483647, so
-- that `attempts < greatest(_max_attempts, 1)` was false for every argument a
-- caller could pass. Its reasoning about caller-supplied ceilings was right;
-- what it cost was the meaning of the column, because after a reap `attempts`
-- no longer answered "how many times was this tried" — the one number a human
-- reviewing a parked slot most wants. It also expressed "never retry this
-- automatically" in units of a retry budget, which is the coupling it was
-- trying to escape.
--
-- A new slot_state 'PARKED' was the other candidate and was rejected: it needs
-- content_calendar's CHECK constraint dropped and re-added, changes a
-- vocabulary two shipped suites pin, and invalidates the partial indexes
-- declared over slot_state — real schema churn for what is a boolean.
--
-- Two additive nullable columns touch no constraint and no vocabulary, and are
-- backward compatible without the backfill below even being required: a row
-- still carrying the sentinel is refused by the attempt ceiling exactly as it
-- was. The backfill runs anyway so that such a row is described correctly and
-- not merely excluded.

-- ── One ceiling ─────────────────────────────────────────────────────────────
--
-- PR #108 took _max_attempts from the caller, which meant the retry budget was
-- whatever the most recently written worker happened to pass, and PR #117 built
-- its parking scheme around exactly that weakness.
--
-- The ceiling now lives here. claim_due_content_slot() still accepts the
-- parameter, because "try this platform less aggressively than the maximum" is
-- a legitimate thing for a caller to ask, but the value is clamped: a caller
-- can only ever lower the budget, never raise it.

CREATE OR REPLACE FUNCTION public.content_publish_max_attempts()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 3 $$;

REVOKE ALL ON FUNCTION public.content_publish_max_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.content_publish_max_attempts() TO service_role;

COMMENT ON FUNCTION public.content_publish_max_attempts() IS
  'The single source of truth for how many times a content slot may be attempted automatically. claim_due_content_slot() clamps its caller-supplied _max_attempts to this value, so a caller can lower the budget and cannot raise it.';

-- ── The intent marker ───────────────────────────────────────────────────────

ALTER TABLE public.social_publications
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

COMMENT ON COLUMN public.social_publications.dispatched_at IS
  'Set in the instant before the external publishing call, by mark_publication_dispatched() and nowhere else. NULL is positive evidence that no call was made and the attempt may be retried automatically; NOT NULL means the outcome is unknowable from here and the slot is parked instead of retried.';

-- ── Parking as a fact ───────────────────────────────────────────────────────

ALTER TABLE public.content_calendar
  ADD COLUMN IF NOT EXISTS parked_at    timestamptz,
  ADD COLUMN IF NOT EXISTS park_reason  text;

COMMENT ON COLUMN public.content_calendar.parked_at IS
  'When this slot was withdrawn from every automatic path. Set by the reaper and by record_content_publication() when a publication that had already dispatched did not complete successfully; cleared only by requeue_content_slot(). attempts keeps its real value, so a parked slot still says how many times it was tried.';

-- Claimability is now `slot_state IN (PLANNED, FAILED) AND parked_at IS NULL`,
-- so the index matches the predicate. PR #108's content_calendar_claimable_idx
-- is deliberately left in place: it is still a correct, if less selective,
-- index for the same scan, and dropping an index PR #108 declared is a change
-- this migration does not need to make.
CREATE INDEX IF NOT EXISTS content_calendar_claimable_unparked_idx
  ON public.content_calendar (scheduled_for)
  WHERE slot_state IN ('PLANNED', 'FAILED') AND parked_at IS NULL;

-- For the review queue a human works from.
CREATE INDEX IF NOT EXISTS content_calendar_parked_idx
  ON public.content_calendar (parked_at DESC)
  WHERE parked_at IS NOT NULL;

-- ── Backfill: describe the slots PR #117 parked, without losing anything ────
--
-- Additive and idempotent. It touches only rows carrying PR #117's exact
-- sentinel, restores `attempts` to a value that still refuses every automatic
-- claim, and records the parking as the fact it always was. A row that has
-- already been backfilled has attempts <> 2147483647 and is not matched again.
--
-- No row changes claimability: 2147483647 was unclaimable because it exceeded
-- every ceiling, and the replacement value is unclaimable because parked_at is
-- set. The original sentinel is preserved in the audit row, not discarded.

DO $$
DECLARE
  _slot record;
  _ceiling integer := public.content_publish_max_attempts();
  _reason  text;
BEGIN
  FOR _slot IN
    SELECT id, platform, attempts, last_error, updated_at
      FROM public.content_calendar
     WHERE attempts = 2147483647
     FOR UPDATE
  LOOP
    _reason := COALESCE(NULLIF(btrim(_slot.last_error), ''), 'reclaimed_stale');

    UPDATE public.content_calendar
       SET parked_at   = COALESCE(updated_at, now()),
           park_reason = _reason,
           attempts    = _ceiling
     WHERE id = _slot.id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'content_slot_parking_migrated', 'content_calendar', _slot.id,
            jsonb_build_object('platform', _slot.platform,
                               'previous_attempts', _slot.attempts,
                               'attempts', _ceiling,
                               'park_reason', _reason));
  END LOOP;
END $$;

-- ── One writer for the slot's resolution ────────────────────────────────────
--
-- Six statements across three functions used to write the same three things —
-- move the slot to FAILED, record why, and park it or not. Writing the parking
-- rule once means there is one place it can be got wrong, and one place to read
-- to know what it is.
--
--   _park_reason IS NULL        resolve the slot and leave it retryable
--   _park_reason IS NOT NULL    resolve it and park it
--
-- COALESCE on both parked columns, so the first park wins and a later one never
-- rewrites the reason a human is about to read. `_only_if_publishing` is the
-- guard the reaper needs, so a slot that has already moved on is not dragged
-- backwards; record_content_publication() passes false, exactly as PR #108's
-- unguarded UPDATE behaved.
--
-- Not granted to anybody. It is reachable only from inside the SECURITY DEFINER
-- functions below, where EXECUTE is checked against the owner, so there is no
-- reason to expose a direct writer of content_calendar over PostgREST.

CREATE OR REPLACE FUNCTION public.resolve_content_slot(
  _calendar_id        uuid,
  _last_error         text,
  _park_reason        text    DEFAULT NULL,
  _only_if_publishing boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.content_calendar
     SET slot_state  = 'FAILED',
         last_error  = _last_error,
         parked_at   = CASE WHEN _park_reason IS NULL
                            THEN parked_at ELSE COALESCE(parked_at, now()) END,
         park_reason = CASE WHEN _park_reason IS NULL
                            THEN park_reason ELSE COALESCE(park_reason, _park_reason) END,
         updated_at  = now()
   WHERE id = _calendar_id
     AND (NOT _only_if_publishing OR slot_state = 'PUBLISHING');

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_content_slot(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.resolve_content_slot(uuid, text, text, boolean) IS
  'The single writer of content_calendar.parked_at. Moves a slot to FAILED and parks it when a park reason is given, leaving it retryable when one is not. Internal to the Phase 8 publishing functions; granted to nobody.';

-- ── mark_publication_dispatched(): the only writer of dispatched_at ─────────
--
-- The worker calls this immediately before it calls the platform, and treats a
-- non-ok answer as "do not call the platform". That ordering is the whole
-- guarantee: after this statement commits, a crash at any later point is
-- indistinguishable from a successful post that was never acknowledged, and the
-- system therefore refuses to retry it automatically. Before it commits, the
-- crash is provably harmless.
--
-- Guarded on state = 'CLAIMED' AND dispatched_at IS NULL, so a second call for
-- the same attempt matches nothing and is refused rather than silently
-- accepted. A worker that sees 'already_dispatched' has lost a race or is
-- replaying, and in both cases must not call the platform.

CREATE OR REPLACE FUNCTION public.mark_publication_dispatched(
  _publication_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pub public.social_publications%ROWTYPE;
BEGIN
  SELECT * INTO _pub FROM public.social_publications WHERE id = _publication_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _pub.state <> 'CLAIMED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending', 'state', _pub.state);
  END IF;

  UPDATE public.social_publications
     SET dispatched_at = now()
   WHERE id = _pub.id
     AND state = 'CLAIMED'
     AND dispatched_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_dispatched');
  END IF;

  -- No platform payload, no account and no caller input in the metadata.
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'content_publication_dispatched', 'social_publication', _pub.id,
          jsonb_build_object('platform', _pub.platform, 'attempt', _pub.attempt));

  RETURN jsonb_build_object('ok', true, 'publication_id', _pub.id);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_publication_dispatched(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_publication_dispatched(uuid) TO service_role;

COMMENT ON FUNCTION public.mark_publication_dispatched(uuid) IS
  'Records the intent to call the platform, immediately before the call. The only writer of social_publications.dispatched_at. Refuses a second call for the same attempt, so a replaying worker is told not to publish rather than publishing twice.';

-- ── claim_due_content_slot(): the ceiling and parking ───────────────────────
--
-- Same signature, same parameter names, same locking, same payload. Restated in
-- full because CREATE OR REPLACE has no partial form. The differences are:
-- the caller's _max_attempts is clamped, a parked slot is not claimable at any
-- ceiling, and the payload says which ceiling actually applied.

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
        -- An active account for this platform must exist. website/newsletter
        -- have no account and are therefore never claimable here.
        AND EXISTS (
          SELECT 1 FROM public.social_accounts a
           WHERE a.platform = s.platform AND a.status = 'active')
      ORDER BY s.scheduled_for
      FOR UPDATE OF s SKIP LOCKED
      LIMIT 1)
  RETURNING * INTO _slot;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_due_slot');
  END IF;

  SELECT * INTO _proposal FROM public.content_proposals WHERE id = _slot.proposal_id;

  SELECT * INTO _account
    FROM public.social_accounts
   WHERE platform = _slot.platform AND status = 'active'
   ORDER BY priority, health_score DESC
   LIMIT 1;

  IF NOT FOUND THEN
    -- Raced with an account being disabled between the predicate and here.
    -- No publication row exists and nothing was dispatched, so the slot stays
    -- retryable rather than parked.
    PERFORM public.resolve_content_slot(_slot.id, 'no_active_account');
    RETURN jsonb_build_object('ok', false, 'error', 'no_active_account');
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
  -- environment; this function has no access to the value and never will.
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
  'Claims one due slot atomically. _max_attempts is clamped to content_publish_max_attempts(), so a caller can only lower the retry budget; a slot with parked_at set is never claimable at any ceiling.';

-- ── record_content_publication(): the dispatch rule, applied ────────────────
--
-- Same signature — PR #108's transition guard names it literally, and the owner
-- check that makes SCHEDULED -> PUBLISHED unforgeable depends on that name
-- resolving. The success path is unchanged. Two additions:
--
--   • a success is refused unless the attempt was marked dispatched, which is
--     what makes the marker mandatory rather than advisory,
--   • a failure parks the slot if and only if the attempt had dispatched.

CREATE OR REPLACE FUNCTION public.record_content_publication(
  _publication_id   uuid,
  _success          boolean,
  _external_post_id text DEFAULT NULL,
  _external_url     text DEFAULT NULL,
  _error_code       text DEFAULT NULL,
  _error_message    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pub    public.social_publications%ROWTYPE;
  _reason text;
  _code   text;
  _dispatched boolean;
BEGIN
  SELECT * INTO _pub FROM public.social_publications WHERE id = _publication_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Replay guard, the same shape as decide_owner_approval's: a redelivered
  -- worker result matches nothing and changes nothing.
  IF _pub.state <> 'CLAIMED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending', 'state', _pub.state);
  END IF;

  _dispatched := _pub.dispatched_at IS NOT NULL;

  IF _success AND (_external_post_id IS NULL OR btrim(_external_post_id) = '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'external_post_id_required');
  END IF;

  -- A post cannot have been published by a call that was never announced.
  IF _success AND NOT _dispatched THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_dispatched');
  END IF;

  IF NOT _success THEN
    _reason := public.redact_publication_error(_error_message);

    -- error_code was stored and logged verbatim, and it is caller-supplied. A
    -- provider client that passes the failing request through as its "code"
    -- would put a bearer token into social_publications AND into audit_logs,
    -- neither of which redact_publication_error() is applied to. Truncating to
    -- 100 characters did not help: a token fits.
    --
    -- So the value is classified, not cleaned. A short machine code is kept as
    -- it is; anything else is replaced wholesale, because a value that is not a
    -- code carries no information worth the risk of storing part of it.
    --
    -- Both conditions, and the same two the column itself enforces: the shape,
    -- then the absence of an unbroken 32-character alphanumeric run, which is
    -- how redact_publication_error() recognises an unlabelled credential. The
    -- shape alone would accept a 32-character hex secret.
    _code := CASE
               WHEN _error_code IS NULL THEN 'publish_failed'
               WHEN _error_code ~ '^[a-z0-9_]{1,40}$'
                AND _error_code !~ '[a-z0-9]{32,}' THEN _error_code
               ELSE 'unknown_error'
             END;

    UPDATE public.social_publications
       SET state = 'FAILED',
           error_code = _code,
           error_message = _reason,
           completed_at = now()
     WHERE id = _pub.id;

    -- Dispatched: the external call had started, and this side cannot tell "the
    -- platform refused it" from "the platform accepted it and the answer was
    -- lost", so the slot is parked. Not dispatched: the slot returns to a
    -- retryable state; attempts is already counted, and claim_due_content_slot
    -- refuses it past content_publish_max_attempts().
    PERFORM public.resolve_content_slot(
      _pub.calendar_id, _reason,
      CASE WHEN _dispatched THEN 'failed_after_dispatch' ELSE NULL END);

    UPDATE public.social_accounts
       SET consecutive_failures = consecutive_failures + 1,
           health_score = greatest(health_score - 10, 0),
           updated_at = now()
     WHERE id = _pub.account_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'content_publication_failed', 'social_publication', _pub.id,
            jsonb_build_object('platform', _pub.platform, 'attempt', _pub.attempt,
                               'error_code', _code,
                               'dispatched', _dispatched,
                               'parked', _dispatched));

    RETURN jsonb_build_object('ok', true, 'state', 'FAILED',
                              'dispatched', _dispatched, 'parked', _dispatched);
  END IF;

  -- Success. Check the proposal before writing anything: a mismatch here means
  -- the world changed under the worker, and refusing early leaves the ledger
  -- consistent instead of relying on an exception to unwind a partial write.
  IF NOT EXISTS (
    SELECT 1 FROM public.content_proposals
     WHERE id = _pub.proposal_id AND state = 'SCHEDULED'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'proposal_not_scheduled');
  END IF;

  -- The unique index on (platform, external_post_id) is what makes a duplicated
  -- result harmless rather than a second recorded publication.
  BEGIN
    UPDATE public.social_publications
       SET state = 'PUBLISHED',
           external_post_id = btrim(_external_post_id),
           external_url = left(_external_url, 2000),
           completed_at = now()
     WHERE id = _pub.id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_publication');
  END;

  -- Transaction-local, and set only here. This is the single key to the
  -- SCHEDULED -> PUBLISHED edge.
  PERFORM set_config('visionex.publishing_proposal', _pub.proposal_id::text, true);

  UPDATE public.content_proposals
     SET state = 'PUBLISHED'
   WHERE id = _pub.proposal_id AND state = 'SCHEDULED';

  PERFORM set_config('visionex.publishing_proposal', '', true);

  UPDATE public.content_calendar
     SET slot_state = 'PUBLISHED',
         external_post_id = btrim(_external_post_id),
         published_at = now(),
         last_error = NULL,
         updated_at = now()
   WHERE id = _pub.calendar_id;

  UPDATE public.social_accounts
     SET consecutive_failures = 0,
         health_score = least(health_score + 5, 100),
         last_connected_at = now(),
         updated_at = now()
   WHERE id = _pub.account_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'content_publication_recorded', 'social_publication', _pub.id,
          jsonb_build_object('platform', _pub.platform, 'attempt', _pub.attempt,
                             'external_post_id', btrim(_external_post_id)));

  -- 'action_succeeded' is the existing vocabulary for "an AI-originated action
  -- completed". No new event type, and no second log.
  INSERT INTO public.ai_feedback_events
    (event_type, channel, subject_type, subject_id, summary, detail)
  VALUES ('action_succeeded', 'system', 'content_publication', btrim(_external_post_id),
          'Published an approved content proposal to ' || _pub.platform,
          jsonb_build_object('platform', _pub.platform, 'attempt', _pub.attempt));

  RETURN jsonb_build_object('ok', true, 'state', 'PUBLISHED',
                            'external_post_id', btrim(_external_post_id));
END;
$$;

REVOKE ALL ON FUNCTION public.record_content_publication(uuid, boolean, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_content_publication(uuid, boolean, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.record_content_publication(uuid, boolean, text, text, text, text) IS
  'The only writer of PUBLISHED on either table. Refuses a success whose attempt was never marked dispatched, and parks the slot on any failure that occurred after dispatch, so no ambiguous outcome can re-enter the automatic retry loop.';

-- ── The reaper, v2 ──────────────────────────────────────────────────────────
--
-- Three changes from PR #117:
--
--   • it reads dispatched_at, and therefore no longer parks everything. A
--     publication whose worker died before the external call is returned to the
--     ordinary retry budget — the case PR #117 could not distinguish and so had
--     to treat as the dangerous one.
--   • it takes a batch limit, so one sweep cannot hold an unbounded number of
--     row locks or run for an unbounded time.
--   • it sweeps a second class of stall: a slot left in PUBLISHING with no
--     CLAIMED publication at all. PR #117's reaper drove entirely off
--     social_publications, so such a slot was invisible to it and stayed in
--     PUBLISHING — a state no automatic path can leave — for ever.
--
-- Dropped rather than replaced: adding _limit to the signature would leave
-- PR #117's one-argument version in place as an overload, and a one-argument
-- call would silently resolve to the old body. No data is touched by the drop,
-- and the repository contains no caller of either signature.

DROP FUNCTION IF EXISTS public.reap_stale_content_publications(interval);

CREATE OR REPLACE FUNCTION public.reap_stale_content_publications(
  _stale_after interval DEFAULT interval '15 minutes',
  _limit       int      DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pub    public.social_publications%ROWTYPE;
  _slot   public.content_calendar%ROWTYPE;
  _cutoff timestamptz;
  _batch  integer;
  _before integer := 0;   -- reaped with no external call made
  _after  integer := 0;   -- reaped after dispatch: parked
  _orphan integer := 0;   -- slots stuck in PUBLISHING with no open publication
  _parked boolean;
BEGIN
  -- A zero or negative interval would sweep live claims. Refuse rather than
  -- coerce: a caller that passes one is wrong about something.
  IF _stale_after IS NULL OR _stale_after <= interval '0' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_interval');
  END IF;

  -- The batch limit is clamped, not refused: unlike the interval, an absurd
  -- value here cannot damage anything, it can only ask for too much work.
  _batch := least(greatest(COALESCE(_limit, 100), 1), 1000);
  _cutoff := now() - _stale_after;

  -- ── Pass 1: publications whose worker stopped reporting ─────────────────
  FOR _pub IN
    SELECT *
      FROM public.social_publications
     WHERE state = 'CLAIMED'
       AND claimed_at < _cutoff
     ORDER BY claimed_at
     -- SKIP LOCKED: a row another transaction is holding is a row something is
     -- actively working on. Skipping it is the point, not an optimisation —
     -- and it makes two reapers running at once safe by construction.
     FOR UPDATE SKIP LOCKED
     LIMIT _batch
  LOOP
    _parked := _pub.dispatched_at IS NOT NULL;

    -- Re-check the state inside the lock. Between the scan and here a worker
    -- may have come back and resolved this publication itself; if it did, the
    -- guarded UPDATE matches nothing and this row is left exactly as the worker
    -- left it. This is what keeps the reaper from overwriting a real result.
    --
    -- The stored message is a server-side constant: no parameter, no provider
    -- text, nothing derived from a caller reaches this column.
    UPDATE public.social_publications
       SET state         = 'FAILED',
           error_code    = CASE WHEN _parked THEN 'reclaimed_after_dispatch'
                                             ELSE 'reclaimed_before_dispatch' END,
           error_message = CASE WHEN _parked
                                THEN 'Reclaimed after the external call had started; the outcome is unknown.'
                                ELSE 'Reclaimed before the external call started; nothing was published.' END,
           completed_at  = now()
     WHERE id = _pub.id
       AND state = 'CLAIMED';

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Guarded on PUBLISHING so that a slot which has already moved on — because
    -- some other publication for it resolved first — is not dragged backwards.
    PERFORM public.resolve_content_slot(
      _pub.calendar_id,
      CASE WHEN _parked THEN 'reclaimed_after_dispatch' ELSE 'reclaimed_before_dispatch' END,
      CASE WHEN _parked THEN 'reclaimed_after_dispatch' ELSE NULL END,
      true);

    IF _parked THEN _after := _after + 1; ELSE _before := _before + 1; END IF;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'content_publication_reclaimed', 'social_publication', _pub.id,
            jsonb_build_object('platform', _pub.platform,
                               'attempt', _pub.attempt,
                               'dispatched', _parked,
                               'parked', _parked,
                               'stalled_seconds',
                               floor(extract(epoch FROM (now() - _pub.claimed_at)))::int));
  END LOOP;

  -- ── Pass 2: slots stranded in PUBLISHING with nothing open ──────────────
  --
  -- PUBLISHING is not a claimable state, so a slot that reaches it without a
  -- CLAIMED publication to resolve is stuck permanently, and pass 1 cannot see
  -- it because pass 1 scans publications.
  --
  -- The same rule decides its fate: if any publication for this slot ever
  -- dispatched, a post may exist and the slot is parked; if none did, nothing
  -- ever left this system and the slot rejoins the ordinary retry budget.
  FOR _slot IN
    SELECT *
      FROM public.content_calendar
     WHERE slot_state = 'PUBLISHING'
       AND updated_at < _cutoff
       AND NOT EXISTS (
         SELECT 1 FROM public.social_publications p
          WHERE p.calendar_id = content_calendar.id AND p.state = 'CLAIMED')
     ORDER BY updated_at
     FOR UPDATE SKIP LOCKED
     LIMIT _batch
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.social_publications p
       WHERE p.calendar_id = _slot.id AND p.dispatched_at IS NOT NULL)
      INTO _parked;

    IF NOT public.resolve_content_slot(
         _slot.id,
         CASE WHEN _parked THEN 'stranded_after_dispatch' ELSE 'stranded_before_dispatch' END,
         CASE WHEN _parked THEN 'stranded_after_dispatch' ELSE NULL END,
         true) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'content_slot_unstranded', 'content_calendar', _slot.id,
            jsonb_build_object('platform', _slot.platform,
                               'attempts', _slot.attempts,
                               'dispatched', _parked,
                               'parked', _parked));

    _orphan := _orphan + 1;
  END LOOP;

  -- Idempotent: a second run finds no CLAIMED row past the cutoff and no
  -- stranded slot, because the first run resolved every one of them.
  RETURN jsonb_build_object('ok', true,
                            'reaped', _before + _after,
                            'reaped_before_dispatch', _before,
                            'reaped_after_dispatch', _after,
                            'unstranded_slots', _orphan,
                            'batch_limit', _batch);
END;
$$;

REVOKE ALL ON FUNCTION public.reap_stale_content_publications(interval, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reap_stale_content_publications(interval, int) TO service_role;

COMMENT ON FUNCTION public.reap_stale_content_publications(interval, int) IS
  'Resolves publications whose worker stopped reporting and slots stranded in PUBLISHING, in bounded batches. Returns an undispatched attempt to the ordinary retry budget and parks a dispatched one, because only the first is known not to have published. Idempotent; safe to run concurrently with itself and with a worker.';

-- Still deliberately not scheduled. PR #117 declined to schedule this because
-- nothing could stall while there was no worker, and that is still true: PR C1
-- adds no worker, so a job running every five minutes would sweep an empty set
-- for ever. The scheduling belongs in the same change as the worker, where the
-- interval can be derived from that worker's real execution envelope, e.g.
--   select cron.schedule('reap-stale-content-publications', '*/5 * * * *',
--                        $$select public.reap_stale_content_publications()$$);

-- ── requeue_content_slot(): the manual path, with the dispatch question ─────
--
-- Two changes. It clears parked_at, because parking is now a column rather than
-- an attempt count. And it refuses a slot whose attempt had dispatched unless
-- the caller states explicitly that they checked the platform and nothing was
-- published — the one question a human must actually answer before this slot
-- may be tried again, asked where the answer can be recorded.
--
-- The authorization model is unchanged and deliberately not widened: the same
-- public.has_role(_actor_id, 'admin') predicate the Owner Control Centre
-- enforces server-side on every one of its actions. PR C1 adds no new caller,
-- no new endpoint and no new role.
--
-- Dropped rather than replaced: the fourth parameter has a default, so leaving
-- the three-argument version in place would keep an overload that bypasses the
-- confirmation entirely. No data is touched by the drop, and the repository
-- contains no caller of the three-argument form.

DROP FUNCTION IF EXISTS public.requeue_content_slot(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.requeue_content_slot(
  _calendar_id uuid,
  _actor_id    uuid,
  _reason      text DEFAULT NULL,
  _confirm_not_published boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slot public.content_calendar%ROWTYPE;
  _note text;
  _dispatched boolean;
  _was_parked boolean;
BEGIN
  -- Defence in depth, not decoration. The GRANT below keeps anon and
  -- authenticated out at the connection, and this keeps out anything holding
  -- the service role that has not established who is asking — a future edge
  -- function that forgets its admin check, a script, a mis-wired caller.
  -- Authorization is a property of this function, not of its callers.
  IF _actor_id IS NULL OR NOT public.has_role(_actor_id, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  -- Locked for the whole decision, so two requeues of the same slot serialise
  -- and the second one sees the state the first one left.
  SELECT * INTO _slot FROM public.content_calendar WHERE id = _calendar_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- FAILED only. PUBLISHED is finished, PUBLISHING belongs to a worker,
  -- CANCELLED was a decision, and PLANNED is already queued — requeueing any of
  -- them is a caller confusing itself, so each gets a refusal rather than a
  -- silent success.
  IF _slot.slot_state <> 'FAILED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_requeueable', 'state', _slot.slot_state);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.content_proposals
     WHERE id = _slot.proposal_id AND state = 'SCHEDULED'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'proposal_not_scheduled');
  END IF;

  -- The same predicate claim_due_content_slot() uses, and for the same reason:
  -- the owner decided through Phase 4's engine and nothing else counts. A
  -- requeue must not be a way to publish something whose approval was never
  -- given, or was given and then expired.
  IF NOT EXISTS (
    SELECT 1
      FROM public.content_proposals p
      JOIN public.owner_approvals   o ON o.id = p.approval_id
     WHERE p.id = _slot.proposal_id
       AND o.action_type = 'content_publish'
       AND o.state IN ('APPROVED', 'PROCESSING', 'COMPLETED')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_approved');
  END IF;

  -- Belt and braces over social_publications_one_success_per_slot: if this slot
  -- ever succeeded, requeueing it would be an instruction to publish the same
  -- content a second time.
  IF EXISTS (
    SELECT 1 FROM public.social_publications
     WHERE calendar_id = _slot.id AND state = 'PUBLISHED'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_published');
  END IF;

  -- The question the marker exists to make askable. If any attempt for this
  -- slot reached the platform, the database cannot rule out that a post is
  -- live, and this function will not queue another one on a shrug. The caller
  -- must assert that they looked.
  SELECT EXISTS (
    SELECT 1 FROM public.social_publications
     WHERE calendar_id = _slot.id AND dispatched_at IS NOT NULL)
    INTO _dispatched;

  IF _dispatched AND COALESCE(_confirm_not_published, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'dispatch_confirmation_required');
  END IF;

  -- Free text from a human, so it goes through the same redactor every other
  -- free-text field in this phase goes through before being stored.
  _note := public.redact_publication_error(_reason);
  _was_parked := _slot.parked_at IS NOT NULL;

  -- The only statement in the schema that lowers attempts, and the only one
  -- that clears parked_at. claim_due_content_slot raises attempts; the reaper
  -- and record_content_publication park; nothing else touches either.
  UPDATE public.content_calendar
     SET slot_state  = 'PLANNED',
         attempts    = 0,
         last_error  = NULL,
         parked_at   = NULL,
         park_reason = NULL,
         updated_at  = now()
   WHERE id = _slot.id
     AND slot_state = 'FAILED';

  IF NOT FOUND THEN
    -- Lost a race to something that moved the slot after the checks above.
    RETURN jsonb_build_object('ok', false, 'error', 'not_requeueable');
  END IF;

  -- No publication row is created here. social_publications is written by
  -- claim_due_content_slot() alone, so a requeue cannot produce a duplicate
  -- attempt record however many times it is called.
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor_id, 'content_slot_requeued', 'content_calendar', _slot.id,
          jsonb_build_object('platform', _slot.platform,
                             'previous_attempts', _slot.attempts,
                             'was_parked', _was_parked,
                             'park_reason', _slot.park_reason,
                             'had_dispatched_attempt', _dispatched,
                             'confirmed_not_published', COALESCE(_confirm_not_published, false),
                             'reason', _note));

  RETURN jsonb_build_object('ok', true, 'state', 'PLANNED', 'attempts', 0,
                            'was_parked', _was_parked);
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_content_slot(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_content_slot(uuid, uuid, text, boolean) TO service_role;

COMMENT ON FUNCTION public.requeue_content_slot(uuid, uuid, text, boolean) IS
  'The only path that resets content_calendar.attempts or clears parked_at. Admin-only by the same has_role predicate the Owner Control Centre enforces, refuses anything but a FAILED slot with a still-approved SCHEDULED proposal and no successful publication, and refuses a slot with a dispatched attempt unless the caller confirms the platform was checked. Every call is written to audit_logs.';

-- No account is activated, no credential is named, no platform is contacted and
-- no publishing surface is created by this migration. The worker, its schedule
-- and the real platform adapters are PR C2.
