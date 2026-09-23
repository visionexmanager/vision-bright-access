-- A proposal can carry a picture or a video.
--
-- `createInstagramAdapter` refuses at readiness when a request has no media,
-- and the content engine produced a hook, a body and hashtags and nothing
-- else — so every Instagram proposal the daily run has ever made was a draft
-- that could be approved, scheduled, and then refused forever. Facebook takes
-- text, so Facebook was the only platform that could ever publish.
--
-- Three pieces: somewhere public to put the file, four columns to remember it
-- by, and the claim payload carrying it to the worker.

-- ── Somewhere Meta can fetch from ───────────────────────────────────────────
--
-- Public, and that is not an oversight. Meta's servers fetch `image_url` and
-- `video_url` themselves, anonymously, from their own network — a signed URL
-- would have to outlive the container build and would still be a bearer
-- credential in a query string. What lands here is artwork generated for a
-- post that is about to be published to the world; nothing private has any
-- business in this bucket, which is why it is separate from `image-outputs`
-- and `video-outputs` rather than a folder inside them.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'social-media',
  'social-media',
  true,
  104857600,  -- 100 MB, the same ceiling the studio buckets use
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'video/mp4']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Read by anyone, written by nobody but the service role. There is no INSERT,
-- UPDATE or DELETE policy on purpose: RLS with no policy denies every role
-- that is not the service role, and the only writer is the content engine.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage'
                   AND tablename = 'objects' AND policyname = 'Social media art is public') THEN
    CREATE POLICY "Social media art is public"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'social-media');
  END IF;
END $$;

-- ── What the proposal remembers ─────────────────────────────────────────────

ALTER TABLE public.content_proposals
  ADD COLUMN IF NOT EXISTS media_kind         text,
  ADD COLUMN IF NOT EXISTS media_url          text,
  -- Kept so a regeneration can be compared with what was asked for, and so an
  -- owner reading a proposal can see why the picture looks like it does.
  ADD COLUMN IF NOT EXISTS media_prompt       text,
  ADD COLUMN IF NOT EXISTS media_generated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_proposals_media_kind_check') THEN
    ALTER TABLE public.content_proposals
      ADD CONSTRAINT content_proposals_media_kind_check
      CHECK (media_kind IS NULL OR media_kind IN ('image', 'video'));
  END IF;
END $$;

COMMENT ON COLUMN public.content_proposals.media_url IS
  'Public URL of the generated artwork, in the social-media bucket. Meta fetches this itself, so it must be reachable without a credential.';

-- ── Recording one ───────────────────────────────────────────────────────────
--
-- A function rather than an update from the worker, for the same reason every
-- other write in this area is one: `content_proposals` has no write policy at
-- all, and the one path in is a SECURITY DEFINER function granted to
-- service_role. A proposal that has been published is refused — replacing the
-- artwork under a live post would make the record disagree with the post.

CREATE OR REPLACE FUNCTION public.record_content_proposal_media(
  _proposal_ref text,
  _kind         text,
  _url          text,
  _prompt       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _proposal public.content_proposals%ROWTYPE;
BEGIN
  IF _kind IS NOT NULL AND _kind NOT IN ('image', 'video') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_kind');
  END IF;

  SELECT * INTO _proposal FROM public.content_proposals
   WHERE proposal_ref = upper(_proposal_ref);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF _proposal.state = 'PUBLISHED' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_published');
  END IF;

  UPDATE public.content_proposals
     SET media_kind = _kind,
         media_url  = _url,
         media_prompt = COALESCE(_prompt, media_prompt),
         media_generated_at = CASE WHEN _url IS NULL THEN NULL ELSE now() END
   WHERE id = _proposal.id;

  RETURN jsonb_build_object('ok', true, 'proposal_ref', _proposal.proposal_ref, 'kind', _kind);
END;
$$;

REVOKE ALL ON FUNCTION public.record_content_proposal_media(text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_content_proposal_media(text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.record_content_proposal_media(text, text, text, text) IS
  'Attach generated artwork to a proposal. The only write path to the media columns; refuses a published proposal.';

-- ── The claim payload carries it ────────────────────────────────────────────
--
-- Re-declared in full rather than patched, because that is the only way to
-- change a payload without leaving two definitions to disagree. Everything
-- below is identical to 20260911 apart from the two lines marked NEW: the
-- connection predicate, the withheld-slot accounting, the race handling and
-- every comment explaining them are unchanged.

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
    'media_url', _proposal.media_url,    -- NEW
    'media_kind', _proposal.media_kind,  -- NEW
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
  'Claims one due slot atomically for an account that is active AND holds an unexpired OAuth grant, and hands the worker the proposal''s generated media with it. A slot for a disconnected platform is left unclaimed rather than spent, and no_due_slot reports how many were withheld for that reason and on which platforms.';
