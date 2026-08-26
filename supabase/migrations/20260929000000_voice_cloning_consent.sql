-- Consent, retention and a lifecycle for cloned voices.
--
-- ── What was already here, and what was missing ─────────────────────────────
--
-- `vs_voice_profiles` (20260628300000) already carries a training lifecycle in
-- `status` and `training_status`, owner-only RLS, and a `provider_voice_id`
-- holding the ElevenLabs voice. None of that is duplicated below.
--
-- What it did not carry is the part that makes cloning somebody's voice safe to
-- operate: who agreed to it, when, whether they have since withdrawn, when the
-- recordings stop being kept, and whether the copy at the provider was actually
-- destroyed when it was supposed to be. A clone with no consent record is not a
-- feature with a missing field — it is a recording of a real person's voice
-- that nobody can prove they agreed to.
--
-- ── Two dimensions, not a bigger enum ───────────────────────────────────────
--
-- Consent and deletion are orthogonal to training. A revoked voice may be fully
-- trained; a voice that failed to delete at the provider may have perfect
-- consent. Folding them into `status` would make illegal combinations
-- expressible and every existing query wrong.
--
-- So: `consent_status` and `lifecycle_state` are added alongside, and
-- `voice_state` is a generated column that reduces all three to the single
-- vocabulary the rest of the system speaks. Generated, not written, because a
-- derived state that anything can set is a derived state that will disagree
-- with the columns it came from.
--
-- ── Nothing here relaxes RLS ────────────────────────────────────────────────
--
-- The existing owner-only policies stay exactly as they are. The three RPCs at
-- the bottom are SECURITY DEFINER and granted to `service_role` alone, which is
-- how the WhatsApp webhook — which has no user session — reads a sender's own
-- voices without a policy that would let anyone else read them too.

-- ── Consent ─────────────────────────────────────────────────────────────────

ALTER TABLE public.vs_voice_profiles
  -- 'pending' is the default on purpose: an existing row has no recorded
  -- consent, and the honest representation of that is "not yet given", not a
  -- backfilled 'granted' that nobody actually agreed to.
  ADD COLUMN IF NOT EXISTS consent_status text NOT NULL DEFAULT 'pending'
    CHECK (consent_status IN ('pending', 'granted', 'revoked')),

  -- Who the voice belongs to, as attested by the person granting consent. Free
  -- text: it may be the account holder, and it may be somebody who authorised
  -- them. What matters is that a name was recorded at the time.
  ADD COLUMN IF NOT EXISTS consent_subject text,

  -- Who performed the act. Separate from `user_id`: the owner of the profile
  -- and the person who clicked are usually the same and are not always.
  ADD COLUMN IF NOT EXISTS consent_granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_granted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_revoked_at timestamptz,

  -- The exact wording agreed to, kept verbatim. A consent record that says only
  -- "true" cannot answer "consented to what?" two years later, and the wording
  -- will change over time.
  ADD COLUMN IF NOT EXISTS consent_statement text,

  -- ── Sample retention ──────────────────────────────────────────────────────
  --
  -- The recordings are the raw material: someone's actual voice, uploaded once
  -- and useful only until the clone exists. `samples_retain_until` is the clock
  -- the sweep at the bottom reads; `samples_deleted_at` is set only when the
  -- storage objects are genuinely gone, so it can never claim a deletion that
  -- did not happen.
  ADD COLUMN IF NOT EXISTS samples_retain_until timestamptz,
  ADD COLUMN IF NOT EXISTS samples_deleted_at timestamptz,

  -- ── Provider lifecycle ────────────────────────────────────────────────────
  --
  -- `provider_deleted_at` is set only on a confirmed delete at ElevenLabs.
  -- `provider_delete_error` records why a delete failed, in words, so an
  -- operator can retry it. It must never hold a key, a token or a URL carrying
  -- one — the writer is responsible for that and the edge function truncates.
  ADD COLUMN IF NOT EXISTS provider_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_delete_error text,

  -- Why a *retention* cleanup failed, kept apart from the provider's column.
  -- Deliberately not folded into `lifecycle_state`: failing to delete
  -- ninety-day-old recordings is a cleanup problem, and disabling somebody's
  -- working voice over it would be a punishment for our own failed cron job.
  -- The row simply stays in the queue and is retried.
  ADD COLUMN IF NOT EXISTS samples_delete_error text,

  ADD COLUMN IF NOT EXISTS lifecycle_state text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_state IN ('active', 'deleting', 'deleted', 'error')),

  -- Whether this voice may be chosen for WhatsApp replies. Off by default: a
  -- voice existing in the studio is not the same act as putting it on a channel
  -- that speaks to other people.
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT false;

-- ── The single vocabulary everything else speaks ────────────────────────────
--
-- Order matters. Deletion outranks revocation outranks consent outranks
-- training, because that is the order in which each makes the others moot.
ALTER TABLE public.vs_voice_profiles
  ADD COLUMN IF NOT EXISTS voice_state text
    GENERATED ALWAYS AS (
      CASE
        WHEN lifecycle_state = 'deleted'  THEN 'deleted'
        WHEN lifecycle_state = 'deleting' THEN 'deleting'
        WHEN lifecycle_state = 'error'    THEN 'error'
        WHEN consent_status  = 'revoked'  THEN 'revoked'
        WHEN consent_status <> 'granted'  THEN 'pending_consent'
        WHEN status = 'completed' AND provider_voice_id IS NOT NULL THEN 'ready'
        WHEN status = 'failed'            THEN 'error'
        ELSE 'pending_consent'
      END
    ) STORED;

COMMENT ON COLUMN public.vs_voice_profiles.voice_state IS
  'Derived, never written. pending_consent | ready | revoked | deleting | deleted | error. A voice is usable only when this is ''ready''.';

-- Partial index on exactly the rows the WhatsApp lookup reads.
CREATE INDEX IF NOT EXISTS vs_profiles_usable_idx
  ON public.vs_voice_profiles (user_id, created_at)
  WHERE voice_state = 'ready' AND whatsapp_enabled;

-- ── Which voice a WhatsApp sender picked ────────────────────────────────────
--
-- On the identity rather than the conversation, because the right to use a
-- cloned voice belongs to the linked account and not to a phone number. Unlink
-- is a hard delete of this row, so the selection goes with it, and a deleted
-- profile clears it rather than leaving a dangling reference.
ALTER TABLE public.whatsapp_identities
  ADD COLUMN IF NOT EXISTS voice_profile_id uuid
    REFERENCES public.vs_voice_profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.whatsapp_identities.voice_profile_id IS
  'The cloned voice this sender chose for replies. NULL means the default voice. Never sent to the sender.';

-- ── Cloning costs money, so it goes through the existing meter ──────────────
--
-- `check_ai_rate_limit` already exists, already writes `ai_usage_log` and
-- already defaults unknown function names to 30/day. Cloning is not a 30/day
-- operation: each call uploads a dataset and creates a permanent voice at the
-- provider. Five is the number, and it is added to the existing CASE rather
-- than to a second rate limiter.
--
-- ── The body below is copied forward, not written fresh ────────────────────
--
-- `CREATE OR REPLACE` on a function whose body you did not start from is how
-- limits get silently reverted. This has already happened once here:
-- 20260726000000 added `library-generate-narration` at 20, and 20260728000000
-- redefined the function two days later without it, sending it back to the
-- default 30. Nobody noticed because nothing fails — a limit simply becomes
-- looser.
--
-- So this body is 20260728000000's, arm for arm, plus one line. The only
-- difference from what production runs today is `voice-studio-clone`.
-- `library-generate-narration` is deliberately still absent: restoring it would
-- change an unrelated limit inside a voice-cloning migration, and it is worth a
-- decision of its own rather than a silent fix here.
--
-- `src/test/voice-cloning-consent.test.ts` pins this CASE against the previous
-- definition so the next person cannot repeat it.
--
-- Privileges are untouched by `CREATE OR REPLACE` — 20260906000000 revoked this
-- function from PUBLIC, anon and authenticated, and that survives. The grant
-- below is idempotent and restates the intent.
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id      UUID,
  _function_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _daily_count  BIGINT;
  _daily_limit  INTEGER;
BEGIN
  _daily_limit := CASE _function_name
    WHEN 'ai-chat'              THEN 60
    WHEN 'academy-chat'         THEN 60
    WHEN 'ocr-scan'             THEN 20
    WHEN 'radar-ai'             THEN 20
    WHEN 'analyze-meal'         THEN 20
    WHEN 'generate-diet-plan'   THEN 10
    WHEN 'realtime-session'     THEN 10
    WHEN 'enrich-product'       THEN 50
    WHEN 'library-ai-assistant' THEN 40
    WHEN 'library-ai-chat'      THEN 60
    WHEN 'library-ai-writing-assistant' THEN 40
    WHEN 'voice-studio-clone'   THEN 5
    ELSE 30
  END;

  SELECT COUNT(*) INTO _daily_count
  FROM public.ai_usage_log
  WHERE user_id       = _user_id
    AND function_name = _function_name
    AND created_at   >= current_date::timestamptz
    AND created_at   <  (current_date + interval '1 day')::timestamptz;

  IF _daily_count >= _daily_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage_log (user_id, function_name)
  VALUES (_user_id, _function_name);

  DELETE FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND created_at < now() - interval '48 hours';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;

-- ── What the WhatsApp conversation may know ─────────────────────────────────
--
-- The same principle `whatsapp_identity_state` was built on: the assistant is
-- told the least that lets it hold the conversation. A slot number and a name.
-- No profile uuid, no provider voice id, no user id — none of which the sender
-- has any use for and all of which would be disclosed by putting them in a list
-- row id that comes straight back as a reply.
--
-- Slots are positions in a stable ordering, so the same list renders the same
-- way twice. A voice that stopped being usable between render and tap simply is
-- not there, and the selection RPC returns the name it actually chose so the
-- confirmation names the right voice rather than the tapped position.
CREATE OR REPLACE FUNCTION public.whatsapp_voice_options(_wa_phone text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object('slot', v.slot, 'name', v.name, 'language', v.language, 'selected', v.selected)
      ORDER BY v.slot
    ),
    '[]'::jsonb
  )
  FROM (
    SELECT
      row_number() OVER (ORDER BY p.created_at, p.id) AS slot,
      p.name,
      p.language,
      -- IS NOT DISTINCT FROM, so "nothing selected" is false rather than NULL:
      -- a three-valued flag in a menu is a bug waiting for a renderer to trip on.
      (p.id IS NOT DISTINCT FROM i.voice_profile_id) AS selected
    FROM public.whatsapp_identities i
    JOIN public.vs_voice_profiles p ON p.user_id = i.user_id
    WHERE i.wa_phone = _wa_phone
      AND i.user_id IS NOT NULL
      AND p.voice_state = 'ready'
      AND p.whatsapp_enabled
    LIMIT 8
  ) v;
$$;

COMMENT ON FUNCTION public.whatsapp_voice_options(text) IS
  'The linked account''s WhatsApp-enabled ready voices, as slot + name. Carries no profile id, provider id or user id by design. Service role only.';

CREATE OR REPLACE FUNCTION public.whatsapp_select_voice(_wa_phone text, _slot integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile_id uuid;
  _name       text;
BEGIN
  -- Slot 0 is "the default voice", and is always available. It is the only way
  -- back for somebody whose chosen voice has since been revoked.
  IF _slot = 0 THEN
    UPDATE public.whatsapp_identities
       SET voice_profile_id = NULL, updated_at = now()
     WHERE wa_phone = _wa_phone AND user_id IS NOT NULL;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_linked');
    END IF;
    RETURN jsonb_build_object('ok', true, 'name', NULL, 'default', true);
  END IF;

  -- Re-derived with the identical ordering the list used. A voice that stopped
  -- being usable in between is simply absent, and the caller is told so rather
  -- than being given whatever slid into its place.
  SELECT v.id, v.name INTO _profile_id, _name
  FROM (
    SELECT
      row_number() OVER (ORDER BY p.created_at, p.id) AS slot,
      p.id,
      p.name
    FROM public.whatsapp_identities i
    JOIN public.vs_voice_profiles p ON p.user_id = i.user_id
    WHERE i.wa_phone = _wa_phone
      AND i.user_id IS NOT NULL
      AND p.voice_state = 'ready'
      AND p.whatsapp_enabled
    LIMIT 8
  ) v
  WHERE v.slot = _slot;

  IF _profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unavailable');
  END IF;

  UPDATE public.whatsapp_identities
     SET voice_profile_id = _profile_id, updated_at = now()
   WHERE wa_phone = _wa_phone AND user_id IS NOT NULL;

  RETURN jsonb_build_object('ok', true, 'name', _name, 'default', false);
END;
$$;

COMMENT ON FUNCTION public.whatsapp_select_voice(text, integer) IS
  'Point a linked sender at one of their own ready voices, or slot 0 for the default. Returns the name actually selected. Service role only.';

-- The one place a provider voice id is handed out, and it goes to the webhook
-- at synthesis time — never into a message, a list row or a log line.
CREATE OR REPLACE FUNCTION public.whatsapp_resolve_voice(_wa_phone text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'provider', p.provider,
    'voice_id', p.provider_voice_id,
    'model', coalesce(p.provider_model, 'eleven_multilingual_v2')
  )
  FROM public.whatsapp_identities i
  JOIN public.vs_voice_profiles p ON p.id = i.voice_profile_id
  WHERE i.wa_phone = _wa_phone
    AND i.user_id IS NOT NULL
    -- Checked again here, not merely at selection time. A voice revoked after
    -- it was chosen must stop speaking immediately, and this is the query that
    -- decides. No row means the default voice, which is the safe fallback.
    AND p.voice_state = 'ready'
    AND p.whatsapp_enabled
    AND p.provider_voice_id IS NOT NULL;
$$;

COMMENT ON FUNCTION public.whatsapp_resolve_voice(text) IS
  'The provider voice for this sender''s current selection, re-checking consent and lifecycle. NULL means use the default. Service role only.';

-- These are service-role tools. REVOKE FROM PUBLIC also revokes service_role,
-- so the grant is not optional — without it every call fails in production.
REVOKE ALL ON FUNCTION public.whatsapp_voice_options(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_select_voice(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_resolve_voice(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.whatsapp_voice_options(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_select_voice(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_resolve_voice(text) TO service_role;

-- ── Retention: the queue, and the two ways out of it ────────────────────────
--
-- ── Why there is no marking step ──────────────────────────────────────────
--
-- The first version of this marked expired rows `lifecycle_state = 'deleting'`
-- and left a worker to drain them. That was wrong twice over. `deleting` feeds
-- `voice_state`, so every voice whose recordings aged out would have silently
-- stopped working — a retention cleanup is not a reason to take somebody's
-- voice away. And a marked row is a row that can be marked and then abandoned.
--
-- So the queue is a predicate, not a column: expired, and not yet deleted. A
-- row leaves it only by having its storage objects actually removed. Nothing
-- has to be un-marked if a run dies half way, and running the drainer twice is
-- the same as running it once.
--
-- ── Why storage deletion is not done here ─────────────────────────────────
--
-- Storage objects live outside Postgres and can only be removed through the
-- Storage API. A SQL function that set `samples_deleted_at` would be recording
-- a deletion it had not performed, which is the exact lie this whole phase
-- exists to prevent. These three functions read the queue and record outcomes;
-- the `voice-studio` Edge Function does the deleting.

/**
 * The next batch of profiles whose recordings have outlived their retention.
 *
 * Returns the storage paths so the drainer needs one round trip rather than one
 * per profile. Bounded, so a backlog is drained over several runs instead of in
 * one request that times out half way.
 */
CREATE OR REPLACE FUNCTION public.vs_expired_sample_batch(_limit integer DEFAULT 25)
RETURNS TABLE (profile_id uuid, storage_paths text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, array_agg(d.storage_path) FILTER (WHERE d.storage_path IS NOT NULL)
  FROM public.vs_voice_profiles p
  JOIN public.vs_voice_datasets d ON d.profile_id = p.id
  WHERE p.samples_retain_until IS NOT NULL
    AND p.samples_retain_until < now()
    AND p.samples_deleted_at IS NULL
    -- A profile mid-deletion is already having the same objects removed by the
    -- request that asked for it. Both paths are idempotent, so overlapping is
    -- harmless, but there is no reason to race.
    AND p.lifecycle_state = 'active'
  GROUP BY p.id
  ORDER BY p.samples_retain_until
  LIMIT greatest(1, least(coalesce(_limit, 25), 200));
$$;

COMMENT ON FUNCTION public.vs_expired_sample_batch(integer) IS
  'Profiles whose uploaded recordings have outlived retention, with their storage paths. Reading this deletes nothing. Service role only.';

/**
 * Record that a profile's recordings are genuinely gone.
 *
 * Called only after the Storage API has confirmed it. Setting
 * `samples_deleted_at` is what removes the row from the queue, so it is the one
 * write that must never happen on a guess.
 *
 * The voice itself is untouched: the clone is what the recordings were uploaded
 * for, and it goes on working. Only the raw audio of a real person goes away.
 */
CREATE OR REPLACE FUNCTION public.vs_mark_samples_deleted(_profile_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.vs_voice_datasets WHERE profile_id = _profile_id
  )
  UPDATE public.vs_voice_profiles
     SET samples_deleted_at = now(),
         samples_delete_error = NULL,
         sample_count = 0,
         updated_at = now()
   WHERE id = _profile_id;
$$;

COMMENT ON FUNCTION public.vs_mark_samples_deleted(uuid) IS
  'Marks a profile''s recordings deleted and drops their rows. Call only after Storage confirmed removal. Idempotent. Service role only.';

/**
 * Record that a retention cleanup failed, and leave it retryable.
 *
 * `samples_deleted_at` stays null, so the row is still in the queue and the
 * next run tries again. The reason is stored for an operator and is expected to
 * have been stripped of anything credential-shaped before it arrives.
 */
CREATE OR REPLACE FUNCTION public.vs_mark_samples_delete_failed(_profile_id uuid, _reason text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.vs_voice_profiles
     SET samples_delete_error = left(coalesce(_reason, 'unknown'), 300),
         updated_at = now()
   WHERE id = _profile_id;
$$;

COMMENT ON FUNCTION public.vs_mark_samples_delete_failed(uuid, text) IS
  'Records why a retention cleanup failed without leaving the queue. The voice stays usable: a failed cron job is not a reason to silence somebody. Service role only.';

REVOKE ALL ON FUNCTION public.vs_expired_sample_batch(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vs_mark_samples_deleted(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vs_mark_samples_delete_failed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vs_expired_sample_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.vs_mark_samples_deleted(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vs_mark_samples_delete_failed(uuid, text) TO service_role;

-- No pg_cron job. Draining needs the Storage API, which means outbound HTTP
-- with a credential, and 20260913000000 already settled how this repository
-- does that: a GitHub Actions schedule calling the Edge Function, rather than
-- pg_net plus the service key and CRON_SECRET stored inside the database —
-- two credentials in a table to save one workflow file. The schedule lives in
-- `.github/workflows/voice-retention-cron.yml`.
