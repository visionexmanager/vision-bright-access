-- Phase 8: social publishing — connect, publish, and record.
--
-- Phase 7 left PUBLISHED in the content_proposals vocabulary with no inbound
-- edge, and said publishing would be "a later migration adding that edge plus a
-- platform adapter, not a flag somebody can flip". This is that migration, and
-- it keeps the promise literally: the edge exists, and it is unreachable except
-- from inside record_content_publication().
--
-- Nothing here publishes anything. There is no adapter, no external call and no
-- credential in this file. What it adds is the ledger and the gate:
--
--   social_accounts      - which platform identity may be published to, and
--                          with which capabilities. Holds the NAME of a secret,
--                          never a secret.
--   social_publications  - one row per publish attempt, successful or not.
--   content_calendar     - gains publish tracking on the slot it already owns.
--
-- Two independent conditions must both hold before a slot can even be claimed:
-- the owner approved the proposal (Phase 4's engine, unchanged), and an active
-- account exists for that platform. Neither is checked in the browser or in an
-- edge function alone — both are predicates inside the claim statement.

-- ── Accounts ────────────────────────────────────────────────────────────────
--
-- Modelled on sourcing_sources and ph_providers: the row names a secret through
-- api_key_ref and the router resolves it from the environment. A row that
-- carried the token itself would put a publishing credential in a table that is
-- backed up, replicated and readable by every admin.

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Only the four externally publishable platforms. `website` and `newsletter`
  -- exist in the calendar vocabulary but are published by Visionex itself and
  -- have no external identity to connect.
  platform      text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'youtube')),

  -- The public handle, for the owner to recognise which account this is.
  handle        text NOT NULL,
  display_name  text,

  -- 'unverified' until the review below records that the platform actually
  -- granted publishing. The claim statement refuses anything but 'active', so a
  -- half-configured account cannot publish.
  status        text NOT NULL DEFAULT 'unverified'
                CHECK (status IN ('active', 'disabled', 'unverified')),

  -- What this platform lets this account do. Empty by default: a capability is
  -- something a platform granted, not something Visionex assumed.
  capabilities  text[] NOT NULL DEFAULT '{}',

  -- Name of an Edge Function secret. NEVER a credential — see the constraint
  -- below, which restricts this to an environment-variable identifier.
  api_key_ref   text,
  external_account_id text,
  base_url      text,

  -- Non-secret settings only; the constraint below refuses credential-shaped
  -- keys outright rather than trusting every future caller to be careful.
  config        jsonb NOT NULL DEFAULT '{}',

  priority      integer NOT NULL DEFAULT 100,
  health_score  integer NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  consecutive_failures integer NOT NULL DEFAULT 0,

  -- ── Platform review ───────────────────────────────────────────────────
  -- Facebook, Instagram, TikTok and YouTube each gate publishing behind an app
  -- review. These columns record that it happened; the constraint below is what
  -- makes recording it a precondition rather than a note.
  review_completed_at  timestamptz,
  reviewed_by          uuid REFERENCES auth.users ON DELETE SET NULL,
  publishing_permission_granted boolean NOT NULL DEFAULT false,
  review_reference     text,
  review_notes         text,

  last_connected_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (platform, handle)
);

CREATE INDEX IF NOT EXISTS social_accounts_publishable_idx
  ON public.social_accounts (platform, priority)
  WHERE status = 'active';

DO $$
BEGIN
  -- An account cannot be switched on until the review is recorded, the platform
  -- granted publishing, and a secret has been named. Enforced in the database
  -- so no code path, present or future, can skip it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.social_accounts'::regclass
       AND conname = 'social_accounts_active_requires_review'
  ) THEN
    ALTER TABLE public.social_accounts
      ADD CONSTRAINT social_accounts_active_requires_review
      CHECK (
        status <> 'active'
        OR (review_completed_at IS NOT NULL
            AND publishing_permission_granted
            AND api_key_ref IS NOT NULL)
      );
  END IF;

  -- api_key_ref names an environment variable. An access token, an OAuth code
  -- or a client secret does not fit this shape, so pasting one here fails
  -- loudly instead of being stored.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.social_accounts'::regclass
       AND conname = 'social_accounts_api_key_ref_is_a_name'
  ) THEN
    ALTER TABLE public.social_accounts
      ADD CONSTRAINT social_accounts_api_key_ref_is_a_name
      CHECK (api_key_ref IS NULL OR api_key_ref ~ '^[A-Z][A-Z0-9_]{2,63}$');
  END IF;

  -- config is for non-secret settings. Refusing the credential-shaped keys
  -- outright is cheaper than auditing every future writer of this column.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.social_accounts'::regclass
       AND conname = 'social_accounts_config_holds_no_secret'
  ) THEN
    ALTER TABLE public.social_accounts
      ADD CONSTRAINT social_accounts_config_holds_no_secret
      CHECK (NOT (config ?| ARRAY[
        'token', 'access_token', 'refresh_token', 'secret', 'client_secret',
        'app_secret', 'api_key', 'apiKey', 'password', 'private_key'
      ]));
  END IF;
END $$;

COMMENT ON TABLE public.social_accounts IS
  'Platform identities that may be published to. api_key_ref names an Edge Function secret and is constrained to an environment-variable identifier; no credential is ever stored here. status = active requires a recorded platform review.';

-- ── Publications ────────────────────────────────────────────────────────────
--
-- One row per attempt, so a failure is evidence rather than a gap. The two
-- partial unique indexes are what make a retry safe: a slot can be attempted
-- again, and can still only succeed once.

CREATE TABLE IF NOT EXISTS public.social_publications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  proposal_id   uuid NOT NULL REFERENCES public.content_proposals(id) ON DELETE CASCADE,
  calendar_id   uuid NOT NULL REFERENCES public.content_calendar(id) ON DELETE CASCADE,
  -- RESTRICT: an account with publishing history is disabled, never deleted.
  account_id    uuid NOT NULL REFERENCES public.social_accounts(id) ON DELETE RESTRICT,

  platform      text NOT NULL CHECK (platform IN ('facebook', 'instagram', 'tiktok', 'youtube')),

  state         text NOT NULL DEFAULT 'CLAIMED'
                CHECK (state IN ('CLAIMED', 'PUBLISHED', 'FAILED')),

  attempt       integer NOT NULL DEFAULT 1 CHECK (attempt >= 1),

  -- The platform's own identifier for the post. Its uniqueness is the last line
  -- of defence against recording the same publication twice.
  external_post_id text,
  external_url  text,

  -- Redacted by record_content_publication() before it reaches this table: a
  -- provider error commonly quotes the request, and the request carries a
  -- bearer token.
  error_code    text,
  error_message text,

  claimed_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS social_publications_proposal_idx
  ON public.social_publications (proposal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS social_publications_open_idx
  ON public.social_publications (claimed_at)
  WHERE state = 'CLAIMED';

-- A slot may be attempted repeatedly and succeed at most once.
CREATE UNIQUE INDEX IF NOT EXISTS social_publications_one_success_per_slot
  ON public.social_publications (calendar_id)
  WHERE state = 'PUBLISHED';

-- The same external post is never recorded twice, whatever the caller believes.
CREATE UNIQUE INDEX IF NOT EXISTS social_publications_external_post_uniq
  ON public.social_publications (platform, external_post_id)
  WHERE external_post_id IS NOT NULL;

COMMENT ON TABLE public.social_publications IS
  'One row per publish attempt. A slot may be retried; two partial unique indexes keep at most one success per slot and one record per external post. Error text is redacted before it is stored.';

-- ── Calendar: publish tracking on the slot that already exists ──────────────
--
-- Phase 7 shipped this table with PLANNED/CANCELLED and no external identifier,
-- because there was nothing to publish to. The additions are strictly new
-- columns and new vocabulary; PLANNED and CANCELLED keep their meaning.

ALTER TABLE public.content_calendar
  ADD COLUMN IF NOT EXISTS external_post_id text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text;

DO $$
DECLARE
  _existing text;
BEGIN
  -- The Phase 7 CHECK was declared inline, so its name is whatever Postgres
  -- generated. Find it by definition rather than by assuming that name.
  SELECT conname INTO _existing
    FROM pg_constraint
   WHERE conrelid = 'public.content_calendar'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%slot_state%';

  IF _existing IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.content_calendar DROP CONSTRAINT %I', _existing);
  END IF;

  ALTER TABLE public.content_calendar
    ADD CONSTRAINT content_calendar_slot_state_check
    CHECK (slot_state IN ('PLANNED', 'CANCELLED', 'PUBLISHING', 'PUBLISHED', 'FAILED'));
END $$;

CREATE INDEX IF NOT EXISTS content_calendar_claimable_idx
  ON public.content_calendar (scheduled_for)
  WHERE slot_state IN ('PLANNED', 'FAILED');

-- ── The gate ────────────────────────────────────────────────────────────────
--
-- SCHEDULED -> PUBLISHED now exists, and is refused unless the transaction is
-- inside record_content_publication() for this exact proposal. The setting is
-- transaction-local (set_config(..., true)), so it cannot leak to the next
-- statement on a pooled connection, and it cannot be forged from a client:
-- reaching this table at all already requires the service role, and the only
-- SQL that sets it is a SECURITY DEFINER function that has just verified an
-- external post id.
--
-- Every other edge is byte-for-byte what Phase 7 defined.

CREATE OR REPLACE FUNCTION public.enforce_content_proposal_transition()
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
    WHEN 'PROPOSED'  THEN ARRAY['EDITED', 'APPROVED', 'REJECTED', 'SUPERSEDED']
    WHEN 'EDITED'    THEN ARRAY['EDITED', 'APPROVED', 'REJECTED', 'SUPERSEDED']
    WHEN 'APPROVED'  THEN ARRAY['SCHEDULED', 'REJECTED']
    -- Phase 8: the one new edge, gated below.
    WHEN 'SCHEDULED' THEN ARRAY['PUBLISHED']
    WHEN 'REJECTED'   THEN ARRAY[]::text[]
    WHEN 'SUPERSEDED' THEN ARRAY[]::text[]
    WHEN 'PUBLISHED'  THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.state = ANY (_allowed)) THEN
    RAISE EXCEPTION 'Illegal content proposal transition % -> % for %', OLD.state, NEW.state, OLD.proposal_ref
      USING ERRCODE = 'check_violation';
  END IF;

  -- A direct UPDATE ... SET state = 'PUBLISHED' fails here, including from the
  -- SQL editor and including with the service role.
  --
  -- Two independent conditions, because the first one alone is only an accident
  -- guard: anyone able to run SQL can also run set_config() and forge it. The
  -- second cannot be forged by the service role, because inside a SECURITY
  -- DEFINER function current_user is the function's OWNER, and a service-role
  -- session cannot assume that role. Whoever owns the database can still bypass
  -- all of this — they can drop the trigger — and no database guard can change
  -- that. What this closes is every path an application can take.
  IF NEW.state = 'PUBLISHED'
     AND (COALESCE(current_setting('visionex.publishing_proposal', true), '') <> OLD.id::text
          OR current_user <> COALESCE((
               SELECT pg_get_userbyid(p.proowner) FROM pg_proc p
                WHERE p.oid = to_regprocedure(
                  'public.record_content_publication(uuid, boolean, text, text, text, text)')), '')) THEN
    RAISE EXCEPTION 'Content proposal % may only reach PUBLISHED through record_content_publication()', OLD.proposal_ref
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS content_proposals_transition ON public.content_proposals;
CREATE TRIGGER content_proposals_transition
  BEFORE UPDATE ON public.content_proposals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_content_proposal_transition();

-- ── Redaction ───────────────────────────────────────────────────────────────
--
-- Provider errors quote the failing request, and the failing request carries the
-- credential. This runs before any error text is stored or returned, so a
-- token never reaches the table, the admin UI, or a log line derived from them.

CREATE OR REPLACE FUNCTION public.redact_publication_error(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN _text IS NULL THEN NULL ELSE left(
    regexp_replace(
      regexp_replace(
        regexp_replace(_text, '(?i)(bearer|token|secret|password|api[_-]?key|access_token|refresh_token)([=:\s"'']+)[^\s"'',;}]+', '\1\2[redacted]', 'g'),
        -- Anything long enough and random enough to be a credential, whether or
        -- not it was labelled.
        '[A-Za-z0-9_\-]{32,}', '[redacted]', 'g'),
      'eyJ[A-Za-z0-9_\-\.]+', '[redacted]', 'g'),
    500) END;
$$;

-- ── Claim a due slot, atomically ────────────────────────────────────────────
--
-- The whole publish precondition is one statement: owner-approved proposal,
-- scheduled slot that is actually due, and an active account for that platform.
-- Nothing is checked by the caller, because a caller can be replaced.
--
-- Concurrency: the inner SELECT takes a row lock with SKIP LOCKED and the outer
-- UPDATE moves the row out of the claimable states in the same statement. A
-- second worker therefore either skips the locked row or finds it no longer
-- PLANNED. Two workers cannot claim one slot.

CREATE OR REPLACE FUNCTION public.claim_due_content_slot(
  _platform text DEFAULT NULL,
  _max_attempts int DEFAULT 3
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
BEGIN
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
        AND s.attempts < greatest(_max_attempts, 1)
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
    UPDATE public.content_calendar
       SET slot_state = 'FAILED', last_error = 'no_active_account', updated_at = now()
     WHERE id = _slot.id;
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

REVOKE ALL ON FUNCTION public.claim_due_content_slot(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_due_content_slot(text, int) TO service_role;

-- ── Record the outcome ──────────────────────────────────────────────────────
--
-- The only writer of PUBLISHED, on either table. Success requires an external
-- post id: "it worked" with nothing to point at is not evidence of publication,
-- and would leave a proposal permanently marked published with no way to check.

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

  IF _success AND (_external_post_id IS NULL OR btrim(_external_post_id) = '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'external_post_id_required');
  END IF;

  IF NOT _success THEN
    _reason := public.redact_publication_error(_error_message);

    UPDATE public.social_publications
       SET state = 'FAILED',
           error_code = left(coalesce(_error_code, 'publish_failed'), 100),
           error_message = _reason,
           completed_at = now()
     WHERE id = _pub.id;

    -- The slot returns to a retryable state; attempts is already counted, and
    -- claim_due_content_slot refuses it past _max_attempts.
    UPDATE public.content_calendar
       SET slot_state = 'FAILED', last_error = _reason, updated_at = now()
     WHERE id = _pub.calendar_id;

    UPDATE public.social_accounts
       SET consecutive_failures = consecutive_failures + 1,
           health_score = greatest(health_score - 10, 0),
           updated_at = now()
     WHERE id = _pub.account_id;

    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    VALUES (NULL, 'content_publication_failed', 'social_publication', _pub.id,
            jsonb_build_object('platform', _pub.platform, 'attempt', _pub.attempt,
                               'error_code', left(coalesce(_error_code, 'publish_failed'), 100)));

    RETURN jsonb_build_object('ok', true, 'state', 'FAILED');
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

REVOKE ALL ON FUNCTION public.record_content_publication(uuid, boolean, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_content_publication(uuid, boolean, text, text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.redact_publication_error(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redact_publication_error(text) TO service_role;

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Same shape as Phase 7: admin read, and no write policy at all. Every write
-- above happens in a SECURITY DEFINER function granted to service_role. A
-- browser holding an admin session can read the ledger and change nothing in it.

ALTER TABLE public.social_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_publications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'social_accounts' AND policyname = 'Admins read social accounts') THEN
    CREATE POLICY "Admins read social accounts"
      ON public.social_accounts FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'social_publications' AND policyname = 'Admins read social publications') THEN
    CREATE POLICY "Admins read social publications"
      ON public.social_publications FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- No seed rows. An account exists once a real platform review has happened;
-- inventing one here would make the dashboard claim a connection that does not
-- exist.
