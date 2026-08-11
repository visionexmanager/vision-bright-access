-- Phase 5: the dashboard's write path into the Phase 4 engines.
--
-- The dashboard must not UPDATE these tables directly. Both are admin-read
-- only, with no write policy, so every change goes through a SECURITY DEFINER
-- function that the transition triggers still police. The browser can never
-- authorize a decision — it asks, and the database decides.
--
-- No second approval mechanism is introduced. Approvals continue to go through
-- decide_owner_approval() from Phase 4; this migration only adds the
-- escalation-side transitions the dashboard needs.

/**
 * Move an escalation, and flip conversation control with it where that is
 * implied.
 *
 * Transition legality is not re-checked here: enforce_escalation_transition()
 * already rejects an illegal move, and duplicating the rule would let the two
 * copies drift apart. This function is about doing the side effects atomically.
 */
CREATE OR REPLACE FUNCTION public.transition_escalation(
  _escalation_id uuid,
  _next_state    text,
  _via           text,
  _actor_id      uuid DEFAULT NULL,
  _note          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.support_escalations%ROWTYPE;
  _control text;
BEGIN
  SELECT * INTO _row FROM public.support_escalations WHERE id = _escalation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- Guarded by the trigger; a rejected transition surfaces as a clean error
  -- rather than a 500 the caller cannot interpret.
  BEGIN
    UPDATE public.support_escalations
       SET state = _next_state,
           last_error = NULL
     WHERE id = _escalation_id
    RETURNING * INTO _row;
  EXCEPTION WHEN check_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'illegal_transition',
                              'from', _row.state, 'to', _next_state);
  END;

  -- Taking over hands the conversation to a person; returning it or resolving
  -- gives it back. Anything else leaves control alone.
  _control := CASE
    WHEN _next_state IN ('OWNER_RESPONDED') THEN 'human'
    WHEN _next_state IN ('RETURNED_TO_AI', 'RESOLVED') THEN 'ai'
    ELSE NULL
  END;

  IF _control IS NOT NULL AND _row.channel = 'whatsapp' AND _row.customer_ref IS NOT NULL THEN
    UPDATE public.whatsapp_conversations
       SET control = _control,
           control_changed_at = now(),
           control_changed_by = _via
     WHERE wa_phone = _row.customer_ref;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor_id, 'escalation_' || lower(_next_state), 'support_escalation', _escalation_id,
          jsonb_build_object('via', _via, 'note', _note, 'control', _control));

  INSERT INTO public.ai_feedback_events (event_type, channel, user_id, subject_type, subject_id, summary, detail)
  VALUES (
    CASE
      WHEN _next_state = 'OWNER_RESPONDED' THEN 'owner_correction'
      WHEN _next_state = 'RETURNED_TO_AI'  THEN 'action_succeeded'
      WHEN _next_state = 'RESOLVED'        THEN 'action_succeeded'
      WHEN _next_state = 'FAILED'          THEN 'action_failed'
      ELSE 'human_escalation'
    END,
    _via, _actor_id, 'escalation', _escalation_id::text,
    'Escalation moved to ' || _next_state,
    jsonb_build_object('note', _note)
  );

  RETURN jsonb_build_object('ok', true, 'state', _row.state, 'control', _control);
END;
$$;

REVOKE ALL ON FUNCTION public.transition_escalation(uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_escalation(uuid, text, text, uuid, text) TO service_role;

-- Marking an escalation as seen is a transition like any other, but it happens
-- on open and must not fail loudly when the case has already moved on.
CREATE OR REPLACE FUNCTION public.mark_escalation_viewed(_escalation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_escalations
     SET state = 'OWNER_VIEWED'
   WHERE id = _escalation_id
     AND state = 'WAITING_FOR_OWNER';
EXCEPTION WHEN check_violation THEN
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_escalation_viewed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_escalation_viewed(uuid) TO service_role;

-- Admins read the sourcing internals behind an approval (spec §13). The
-- customer-facing projection already strips these; this is the other side of
-- that boundary and stays admin-only.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='ai_feedback_events' AND policyname='Admins read ai feedback') THEN
    CREATE POLICY "Admins read ai feedback" ON public.ai_feedback_events
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='audit_logs' AND policyname='Admins read audit logs') THEN
    CREATE POLICY "Admins read audit logs" ON public.audit_logs
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

COMMENT ON FUNCTION public.transition_escalation IS
  'Dashboard write path for escalations. Legality is enforced by enforce_escalation_transition(); this only performs the side effects atomically and records audit + feedback.';
