-- Phase 4: human handoff and the owner control centre.
--
-- Two state machines, deliberately separate and both enforced by triggers
-- rather than by convention:
--
--   support_escalations  - a customer case that needs a person
--   owner_approvals      - ONE reusable "the owner must decide X" mechanism
--
-- The approval engine is generic on purpose (spec §6, §13). Content publishing,
-- refunds, discounts and sourcing confirmations all use the same table and the
-- same decision path; none of them gets its own bespoke approval logic.
--
-- Audit reuses the existing public.audit_logs rather than adding a parallel
-- log, so owner actions sit alongside everything else already recorded there.

-- ── Reference codes ─────────────────────────────────────────────────────────
--
-- A short code the owner can read aloud or type on a phone. The alphabet drops
-- 0/O/1/I/L because this is dictated over WhatsApp and misreading a character
-- would resolve a decision against the wrong pending action.
CREATE OR REPLACE FUNCTION public.generate_action_reference()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  _alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  _code text;
  _i int;
BEGIN
  LOOP
    _code := '';
    FOR _i IN 1..5 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.owner_approvals WHERE reference = _code);
  END LOOP;
  RETURN _code;
END;
$$;

-- ── Escalations ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_escalations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who and where. `customer_ref` carries a channel-native identifier (a
  -- WhatsApp number, a session id) when there is no Visionex account.
  user_id           uuid REFERENCES auth.users ON DELETE SET NULL,
  customer_ref      text,
  customer_name     text,
  channel           text NOT NULL DEFAULT 'website'
                    CHECK (channel IN ('website', 'whatsapp', 'email', 'facebook', 'instagram', 'tiktok', 'youtube')),

  -- The conversation, so nobody is asked to repeat themselves (spec §1).
  conversation_table text,
  conversation_id    uuid,
  transcript         jsonb NOT NULL DEFAULT '[]',

  customer_request  text NOT NULL,
  ai_summary        text,
  suggested_action  text,
  reason            text NOT NULL
                    CHECK (reason IN (
                      'customer_requested_human', 'ai_low_confidence', 'complex_sourcing',
                      'sourcing_confirmation', 'refund_or_financial', 'complaint',
                      'sensitive_issue', 'configured_rule', 'owner_approval_required',
                      'ai_unavailable')),

  subject_type      text,   -- 'product' | 'service' | 'order' | …
  subject_id        text,

  state             text NOT NULL DEFAULT 'WAITING_FOR_OWNER'
                    CHECK (state IN (
                      'WAITING_FOR_OWNER', 'OWNER_VIEWED', 'OWNER_APPROVED', 'OWNER_REJECTED',
                      'OWNER_RESPONDED', 'RETURNED_TO_AI', 'RESOLVED', 'FAILED')),

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  first_viewed_at   timestamptz,
  resolved_at       timestamptz,
  last_error        text
);

-- ── Approvals: the one reusable engine ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.owner_approvals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Short, dictatable, unique. Every decision is tied to this rather than to
  -- the text of a reply (spec §5).
  reference     text NOT NULL UNIQUE,

  action_type   text NOT NULL
                CHECK (action_type IN (
                  'customer_escalation', 'sourcing_approval', 'content_publish',
                  'discount', 'refund', 'sensitive_action', 'other')),

  title         text NOT NULL,
  summary       text,
  -- Everything the executor needs once approved. Generic so a new action type
  -- needs no schema change.
  payload       jsonb NOT NULL DEFAULT '{}',

  escalation_id uuid REFERENCES public.support_escalations(id) ON DELETE CASCADE,

  state         text NOT NULL DEFAULT 'WAITING_FOR_APPROVAL'
                CHECK (state IN (
                  'WAITING_FOR_APPROVAL', 'APPROVED', 'REJECTED',
                  'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED')),

  -- Decision provenance. `decided_by_identifier` records the channel identity
  -- that decided (a phone number), which is what authorization was checked
  -- against.
  decided_at            timestamptz,
  decided_via           text CHECK (decided_via IN ('whatsapp', 'admin_ui', 'system')),
  decided_by_user_id    uuid REFERENCES auth.users ON DELETE SET NULL,
  decided_by_identifier text,
  decision_note         text,

  -- A stale request must not be answerable weeks later.
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  notified_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  last_error    text
);

ALTER TABLE public.owner_approvals
  ALTER COLUMN reference SET DEFAULT public.generate_action_reference();

-- ── Transition enforcement ──────────────────────────────────────────────────
--
-- "Explicit and auditable" (spec §2) means the database refuses an illegal
-- move, not that a comment describes the intended one. In particular a decided
-- approval can never be decided again — that is the replay protection for an
-- owner reply arriving twice (spec §11).

CREATE OR REPLACE FUNCTION public.enforce_approval_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _allowed text[];
BEGIN
  IF NEW.state = OLD.state THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  _allowed := CASE OLD.state
    WHEN 'WAITING_FOR_APPROVAL' THEN ARRAY['APPROVED', 'REJECTED', 'EXPIRED', 'FAILED']
    WHEN 'APPROVED'             THEN ARRAY['PROCESSING', 'COMPLETED', 'FAILED']
    WHEN 'PROCESSING'           THEN ARRAY['COMPLETED', 'FAILED']
    -- Terminal.
    WHEN 'REJECTED'  THEN ARRAY[]::text[]
    WHEN 'COMPLETED' THEN ARRAY[]::text[]
    WHEN 'EXPIRED'   THEN ARRAY[]::text[]
    WHEN 'FAILED'    THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.state = ANY (_allowed)) THEN
    RAISE EXCEPTION 'Illegal approval transition % -> % for %', OLD.state, NEW.state, OLD.reference
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS owner_approvals_transition ON public.owner_approvals;
CREATE TRIGGER owner_approvals_transition
  BEFORE UPDATE ON public.owner_approvals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_approval_transition();

CREATE OR REPLACE FUNCTION public.enforce_escalation_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _allowed text[];
BEGIN
  IF NEW.state = OLD.state THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  _allowed := CASE OLD.state
    WHEN 'WAITING_FOR_OWNER' THEN ARRAY['OWNER_VIEWED', 'OWNER_APPROVED', 'OWNER_REJECTED', 'OWNER_RESPONDED', 'RETURNED_TO_AI', 'FAILED']
    WHEN 'OWNER_VIEWED'      THEN ARRAY['OWNER_APPROVED', 'OWNER_REJECTED', 'OWNER_RESPONDED', 'RETURNED_TO_AI', 'RESOLVED', 'FAILED']
    WHEN 'OWNER_APPROVED'    THEN ARRAY['OWNER_RESPONDED', 'RETURNED_TO_AI', 'RESOLVED', 'FAILED']
    WHEN 'OWNER_REJECTED'    THEN ARRAY['OWNER_RESPONDED', 'RETURNED_TO_AI', 'RESOLVED', 'FAILED']
    WHEN 'OWNER_RESPONDED'   THEN ARRAY['RETURNED_TO_AI', 'RESOLVED', 'FAILED']
    WHEN 'RETURNED_TO_AI'    THEN ARRAY['WAITING_FOR_OWNER', 'RESOLVED', 'FAILED']
    WHEN 'RESOLVED'          THEN ARRAY[]::text[]
    WHEN 'FAILED'            THEN ARRAY['WAITING_FOR_OWNER']
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.state = ANY (_allowed)) THEN
    RAISE EXCEPTION 'Illegal escalation transition % -> %', OLD.state, NEW.state
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.state = 'OWNER_VIEWED' AND NEW.first_viewed_at IS NULL THEN
    NEW.first_viewed_at := now();
  END IF;
  IF NEW.state = 'RESOLVED' AND NEW.resolved_at IS NULL THEN
    NEW.resolved_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_escalations_transition ON public.support_escalations;
CREATE TRIGGER support_escalations_transition
  BEFORE UPDATE ON public.support_escalations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_escalation_transition();

-- ── Conversation control (spec §8) ──────────────────────────────────────────
--
-- While a person owns a conversation the assistant must stay quiet, or the
-- customer is talking to two parties at once.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS control text NOT NULL DEFAULT 'ai'
    CHECK (control IN ('ai', 'human')),
  ADD COLUMN IF NOT EXISTS control_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS control_changed_by text;

-- ── Atomic decision ─────────────────────────────────────────────────────────
--
-- Claims a pending approval and records the decision in one statement. The
-- WHERE clause is the concurrency and replay guard: a second delivery of the
-- same owner reply matches no row and returns not_pending rather than
-- overwriting a decision that was already made.

CREATE OR REPLACE FUNCTION public.decide_owner_approval(
  _reference   text,
  _approve     boolean,
  _via         text,
  _identifier  text,
  _note        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.owner_approvals%ROWTYPE;
BEGIN
  UPDATE public.owner_approvals
     SET state = CASE WHEN _approve THEN 'APPROVED' ELSE 'REJECTED' END,
         decided_at = now(),
         decided_via = _via,
         decided_by_identifier = _identifier,
         decision_note = _note
   WHERE reference = upper(_reference)
     AND state = 'WAITING_FOR_APPROVAL'
     AND expires_at > now()
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (
    NULL,
    CASE WHEN _approve THEN 'owner_approved' ELSE 'owner_rejected' END,
    'owner_approval',
    _row.id,
    jsonb_build_object(
      'reference', _row.reference,
      'action_type', _row.action_type,
      'via', _via,
      -- Masked, not hashed: pgcrypto's digest() lives in the extensions schema
      -- on Supabase and would not resolve under this function's pinned
      -- search_path. Only the configured owner number can reach this call at
      -- all, so the last four digits are enough to identify which authorized
      -- party decided, without putting a full phone number in the audit table.
      'decided_by_masked', CASE
        WHEN _identifier IS NULL OR length(_identifier) < 4 THEN NULL
        ELSE '***' || right(_identifier, 4)
      END,
      'escalation_id', _row.escalation_id,
      'note', _note
    )
  );

  INSERT INTO public.ai_feedback_events (event_type, channel, subject_type, subject_id, summary, detail)
  VALUES (
    CASE WHEN _approve THEN 'owner_approval' ELSE 'owner_rejection' END,
    _via,
    _row.action_type,
    _row.reference,
    left(coalesce(_row.title, 'Owner decision'), 300),
    jsonb_build_object('payload', _row.payload, 'note', _note)
  );

  RETURN jsonb_build_object('ok', true, 'reference', _row.reference,
                            'action_type', _row.action_type, 'escalation_id', _row.escalation_id);
END;
$$;

REVOKE ALL ON FUNCTION public.decide_owner_approval(text, boolean, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_owner_approval(text, boolean, text, text, text) TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Both tables hold customer conversations and business decisions. Admin read
-- only; all writes come from edge functions with the service role.

ALTER TABLE public.support_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_approvals     ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='support_escalations' AND policyname='Admins read escalations') THEN
    CREATE POLICY "Admins read escalations" ON public.support_escalations
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='owner_approvals' AND policyname='Admins read approvals') THEN
    CREATE POLICY "Admins read approvals" ON public.owner_approvals
      FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS support_escalations_open_idx
  ON public.support_escalations (state, created_at)
  WHERE state IN ('WAITING_FOR_OWNER', 'OWNER_VIEWED');

CREATE INDEX IF NOT EXISTS owner_approvals_pending_idx
  ON public.owner_approvals (created_at DESC)
  WHERE state = 'WAITING_FOR_APPROVAL';

COMMENT ON TABLE public.owner_approvals IS
  'One reusable owner-decision mechanism for every action type. Decisions go through decide_owner_approval(), which is single-use by construction: the WHERE state = WAITING_FOR_APPROVAL clause is the replay guard.';
