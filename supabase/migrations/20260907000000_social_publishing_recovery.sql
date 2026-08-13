-- Phase 8, PR B: recovery — close the two gaps PR #108 shipped with.
--
-- PR #108 built the publishing gate and said so in its own description: a slot
-- that reaches PUBLISHING has no way back, and a slot that exhausts its
-- attempts has no way back either. Both were left open deliberately, because
-- nothing could reach those states without a worker. This migration closes
-- them, and it still adds no worker, no adapter and no external call.
--
--   reap_stale_content_publications()  - H1. Resolves a publication whose
--                                        worker stopped reporting.
--   requeue_content_slot()             - M2. The one path that resets attempts,
--                                        and it is a human decision.
--
-- No new table, no new column, no new slot_state, no new RLS policy. Both
-- functions work entirely through the vocabulary and the indexes PR #108
-- already declared.
--
-- ── Why the reaper does not simply retry ────────────────────────────────────
--
-- The database holds no evidence of whether a post actually went out.
-- record_content_publication() is what writes external_post_id, so a worker
-- that dies between "the platform accepted the post" and "the result was
-- recorded" leaves a row that says CLAIMED while the post is live.
--
-- That is true no matter how long the timeout is. A timeout proves the worker
-- is gone; it cannot prove the worker did nothing. So returning the slot
-- straight to a claimable state would publish the same content twice, and
-- social_publications_external_post_uniq would not stop it — the second post is
-- a genuinely different post with a different id.
--
-- The reaper therefore resolves and parks. A human looks at the platform and
-- decides, through requeue_content_slot(). Automatic retry after a reap only
-- becomes safe once the worker records an intent marker before it calls the
-- platform, or the platform accepts an idempotency key. Neither exists yet;
-- both belong to the PR that introduces the worker.

-- ── H1: reap what stalled ───────────────────────────────────────────────────
--
-- Drives off social_publications_open_idx — the partial index on (claimed_at)
-- WHERE state = 'CLAIMED' that PR #108 created and never used. This is the
-- reader it was built for.
--
-- The 15 minute default is provisional. Phase 8 contains no duration constant
-- of any kind, so there is nothing in the existing design to derive it from,
-- and the worker that would set the real bound does not exist yet. It is a
-- parameter rather than a literal in the logic precisely so the PR that builds
-- the worker can set it from that worker's actual execution envelope — whether
-- it ends up an Edge Function, a VPS process, or a queue consumer — without
-- editing this function.

CREATE OR REPLACE FUNCTION public.reap_stale_content_publications(
  _stale_after interval DEFAULT interval '15 minutes'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pub    public.social_publications%ROWTYPE;
  _cutoff timestamptz;
  _reaped integer := 0;
BEGIN
  -- A zero or negative interval would sweep live claims. Refuse rather than
  -- coerce: a caller that passes one is wrong about something.
  IF _stale_after IS NULL OR _stale_after <= interval '0' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_interval');
  END IF;

  _cutoff := now() - _stale_after;

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
  LOOP
    -- Re-check the state inside the lock. Between the scan and here a worker
    -- may have come back and resolved this publication itself; if it did, the
    -- guarded UPDATE matches nothing and this row is left exactly as the worker
    -- left it. This is what keeps the reaper from overwriting a real result.
    UPDATE public.social_publications
       SET state         = 'FAILED',
           error_code    = 'reclaimed_stale',
           -- A server-side constant. No parameter, no provider text, nothing
           -- derived from a caller reaches this column, so there is no path by
           -- which a credential could arrive here.
           error_message = 'Reclaimed after the worker stopped reporting.',
           completed_at  = now()
     WHERE id = _pub.id
       AND state = 'CLAIMED';

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- The slot is parked, not re-offered. FAILED is a claimable slot_state, so
    -- what stops the claimer is the attempt count, which is the mechanism
    -- PR #108 already provides for "stop trying".
    --
    -- The parking value is int4's maximum rather than the claimer's ceiling,
    -- and that is the whole point. Parking is not a retry budget and must not
    -- be expressed in the same units as one: claim_due_content_slot() takes
    -- _max_attempts from its caller, so parking at that ceiling would only be
    -- as strong as the number the next caller happens to pass. A worker calling
    -- claim_due_content_slot('facebook', 5) would have re-opened every slot
    -- parked at 3 — and a parked slot may correspond to a post that is already
    -- live, which is exactly the duplicate this phase exists to prevent.
    --
    -- _max_attempts is int4, so `attempts < greatest(_max_attempts, 1)` is
    -- false for every argument any caller can pass. No number re-opens a parked
    -- slot; only requeue_content_slot() does, and it lowers this to 0.
    --
    -- Guarded on PUBLISHING so that a slot which has already moved on — because
    -- some other publication for it resolved first — is not dragged backwards.
    UPDATE public.content_calendar
       SET slot_state = 'FAILED',
           last_error = 'reclaimed_stale',
           attempts   = 2147483647,
           updated_at = now()
     WHERE id = _pub.calendar_id
       AND slot_state = 'PUBLISHING';

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'content_publication_reclaimed', 'social_publication', _pub.id,
            jsonb_build_object('platform', _pub.platform,
                               'attempt', _pub.attempt,
                               'stalled_seconds',
                               floor(extract(epoch FROM (now() - _pub.claimed_at)))::int));

    _reaped := _reaped + 1;
  END LOOP;

  -- Idempotent: a second run finds no CLAIMED row past the cutoff, because the
  -- first run moved every one of them to FAILED. It reaps zero and writes
  -- nothing.
  RETURN jsonb_build_object('ok', true, 'reaped', _reaped);
END;
$$;

REVOKE ALL ON FUNCTION public.reap_stale_content_publications(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reap_stale_content_publications(interval) TO service_role;

-- Deliberately not scheduled here. pg_cron is available and used elsewhere in
-- this repository, but nothing can stall while there is no worker, and adding a
-- job that sweeps an empty set every five minutes is production behaviour with
-- no work to do. The PR that introduces the worker should schedule it in the
-- same change, e.g.
--   select cron.schedule('reap-stale-content-publications', '*/5 * * * *',
--                        $$select public.reap_stale_content_publications()$$);

-- ── M2: requeue, and the only place attempts is reset ───────────────────────
--
-- A slot that exhausted its attempts, or one the reaper parked, is finished as
-- far as every automatic path is concerned. This is the deliberate way back,
-- and it is deliberate in the strict sense: a named person decides, the
-- decision is written to audit_logs, and nothing about it is automatic.

CREATE OR REPLACE FUNCTION public.requeue_content_slot(
  _calendar_id uuid,
  _actor_id    uuid,
  _reason      text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _slot public.content_calendar%ROWTYPE;
  _note text;
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

  -- Free text from a human, so it goes through the same redactor every other
  -- free-text field in this phase goes through before being stored.
  _note := public.redact_publication_error(_reason);

  -- The only statement in the schema that lowers attempts. claim_due_content_slot
  -- raises it, the reaper raises it, nothing else touches it.
  UPDATE public.content_calendar
     SET slot_state = 'PLANNED',
         attempts   = 0,
         last_error = NULL,
         updated_at = now()
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
                             'reason', _note));

  RETURN jsonb_build_object('ok', true, 'state', 'PLANNED', 'attempts', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_content_slot(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_content_slot(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.reap_stale_content_publications(interval) IS
  'Resolves publications whose worker stopped reporting: marks them FAILED and parks the slot at the attempt ceiling. Never republishes and never returns a slot to PLANNED — that is requeue_content_slot(). Idempotent; safe to run concurrently with itself and with a worker.';

COMMENT ON FUNCTION public.requeue_content_slot(uuid, uuid, text) IS
  'The only path that resets content_calendar.attempts. Admin-only by the actor check inside the function as well as by grant, refuses anything but a FAILED slot with a still-approved SCHEDULED proposal and no successful publication, and writes every call to audit_logs.';
