-- Account deletion: a person can ask for their account to be deleted, say why,
-- change their mind for 14 days, and is then erased.
--
-- ── Shape ──────────────────────────────────────────────────────────────────
--   account_deletion_requests  one row per request. user_id is SET NULL when
--                              the account goes, so the reason survives the
--                              person; the email is cleared at the same time.
--   deleted_account_marks      a one-way hash of the email of an account that
--                              was deleted, so a returning person is not given
--                              a second free week. See profiles_anchor_trial.
--
-- Both tables are an implementation detail: RLS on, NO policy, service role
-- only. Do not add a policy "to make it work" — every reader is an Edge
-- Function that has already proved who is asking.
--
-- ── The free week ──────────────────────────────────────────────────────────
-- The trial is granted by the database (profiles_anchor_trial, BEFORE INSERT
-- on profiles). It now looks the new account's email up in deleted_account_marks
-- and, on a hit, anchors the trial to the registration moment itself — which is
-- already over, so plan_for_user answers 'none'. The person can still subscribe
-- and order a plan; they only do not get the free week again.
-- Limit, stated plainly: the match is the lower-cased address. Another address
-- is another person as far as this table can tell.

-- ── 1. Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Needed to write to the person while the request is open; cleared once the
  -- account is gone.
  email         text,
  reason_code   text NOT NULL
    CHECK (reason_code IN ('not_using','privacy','too_expensive','missing_features',
                           'found_alternative','bad_experience','other')),
  reason_text   text CHECK (reason_text IS NULL OR char_length(reason_text) <= 1000),
  channel       text NOT NULL DEFAULT 'web' CHECK (channel IN ('web','whatsapp')),
  status        text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','cancelled','completed','anonymized')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  purge_after   timestamptz NOT NULL,
  cancelled_at  timestamptz,
  completed_at  timestamptz
);

-- One open request per account.
CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_one_pending
  ON public.account_deletion_requests (user_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS account_deletion_due
  ON public.account_deletion_requests (purge_after) WHERE status = 'pending';

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.account_deletion_requests IS
  'Account deletion requests and the reason given. Service role only on purpose: RLS on, no policy.';

CREATE TABLE IF NOT EXISTS public.deleted_account_marks (
  identity_hash text PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deleted_account_marks ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.deleted_account_marks IS
  'SHA-256 of the lower-cased email of each deleted account, kept only so a returning person is not granted a second free week. Service role only on purpose: RLS on, no policy.';

REVOKE ALL ON public.account_deletion_requests, public.deleted_account_marks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_deletion_requests, public.deleted_account_marks TO service_role;

-- ── 2. The email fingerprint ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.account_identity_hash(_email text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to('email:' || lower(btrim(coalesce(_email, ''))), 'utf8')), 'hex');
$$;

REVOKE ALL ON FUNCTION public.account_identity_hash(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_identity_hash(text) TO service_role;

-- ── 3. No second free week ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.profiles_anchor_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _registered timestamptz;
  _email      text;
BEGIN
  SELECT u.created_at, u.email INTO _registered, _email
    FROM auth.users u WHERE u.id = NEW.user_id;

  -- An address that belonged to a deleted account gets no free week: the trial
  -- is anchored to the registration moment, which has already passed.
  IF _email IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.deleted_account_marks m
        WHERE m.identity_hash = public.account_identity_hash(_email)
     )
  THEN
    NEW.trial_expires_at := COALESCE(_registered, now());
    RETURN NEW;
  END IF;

  -- Anchored to registration, not to now(): a row created late for an old
  -- account must not hand it a fresh week.
  NEW.trial_expires_at :=
    COALESCE(_registered, now()) + (public.trial_period_days() || ' days')::interval;

  RETURN NEW;
END;
$$;

-- ── 4. Requesting, cancelling, purging ─────────────────────────────────────
-- Every function below is called by an Edge Function that has already proved
-- who the caller is (a verified session, or a WhatsApp number linked to the
-- account by an emailed code). None is callable by a browser.

CREATE OR REPLACE FUNCTION public.request_account_deletion(
  _user_id uuid, _reason_code text, _reason_text text, _channel text DEFAULT 'web'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  _row   public.account_deletion_requests%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'no_user'; END IF;

  SELECT u.email INTO _email FROM auth.users u WHERE u.id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_user'; END IF;

  -- Staff accounts carry roles and audit history; they are removed by hand.
  IF public.has_role(_user_id, 'admin') THEN RAISE EXCEPTION 'staff_account'; END IF;

  SELECT * INTO _row FROM public.account_deletion_requests
   WHERE user_id = _user_id AND status = 'pending';
  IF FOUND THEN
    RETURN jsonb_build_object('request_id', _row.id, 'purge_after', _row.purge_after,
                              'email', _email, 'already', true);
  END IF;

  INSERT INTO public.account_deletion_requests
    (user_id, email, reason_code, reason_text, channel, purge_after)
  VALUES
    (_user_id, _email, _reason_code, NULLIF(btrim(_reason_text), ''),
     CASE WHEN _channel = 'whatsapp' THEN 'whatsapp' ELSE 'web' END,
     now() + interval '14 days')
  RETURNING * INTO _row;

  RETURN jsonb_build_object('request_id', _row.id, 'purge_after', _row.purge_after,
                            'email', _email, 'already', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.account_deletion_requests
     SET status = 'cancelled', cancelled_at = now()
   WHERE user_id = _user_id AND status = 'pending';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.account_deletion_status(_user_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.purge_after FROM public.account_deletion_requests r
   WHERE r.user_id = _user_id AND r.status = 'pending';
$$;

CREATE OR REPLACE FUNCTION public.due_account_deletions(_limit integer DEFAULT 20)
RETURNS TABLE (request_id uuid, user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.user_id FROM public.account_deletion_requests r
   WHERE r.status = 'pending' AND r.user_id IS NOT NULL AND r.purge_after <= now()
   ORDER BY r.purge_after
   LIMIT GREATEST(1, LEAST(coalesce(_limit, 20), 100));
$$;

-- Written BEFORE the account goes, so a failure half way never leaves an
-- address that can claim a second free week.
CREATE OR REPLACE FUNCTION public.begin_account_purge(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _email text;
BEGIN
  SELECT r.email INTO _email FROM public.account_deletion_requests r
   WHERE r.id = _request_id AND r.status = 'pending';
  IF _email IS NULL THEN RETURN; END IF;
  INSERT INTO public.deleted_account_marks (identity_hash)
  VALUES (public.account_identity_hash(_email))
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_account_purge(_request_id uuid, _outcome text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.account_deletion_requests
     SET status = CASE WHEN _outcome = 'anonymized' THEN 'anonymized' ELSE 'completed' END,
         completed_at = now(),
         email = NULL
   WHERE id = _request_id AND status = 'pending';
$$;

-- REVOKE FROM PUBLIC also takes service_role's right, so it is granted back by
-- name. anon and authenticated are named too: a function is not isolated by
-- revoking PUBLIC alone.
REVOKE ALL ON FUNCTION public.request_account_deletion(uuid, text, text, text),
                       public.cancel_account_deletion(uuid),
                       public.account_deletion_status(uuid),
                       public.due_account_deletions(integer),
                       public.begin_account_purge(uuid),
                       public.finish_account_purge(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(uuid, text, text, text),
                          public.cancel_account_deletion(uuid),
                          public.account_deletion_status(uuid),
                          public.due_account_deletions(integer),
                          public.begin_account_purge(uuid),
                          public.finish_account_purge(uuid, text)
  TO service_role;

-- ── 5. From WhatsApp ───────────────────────────────────────────────────────
-- The webhook knows a number, never an account id. These two resolve the
-- account from a number that was LINKED by an emailed code (verified_at set),
-- so possession of the number alone is never enough: an unlinked number is
-- refused with 'not_linked' and told to use the website.

CREATE OR REPLACE FUNCTION public.whatsapp_request_account_deletion(
  _wa_phone text, _reason_code text, _reason_text text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _user uuid;
BEGIN
  SELECT i.user_id INTO _user FROM public.whatsapp_identities i
   WHERE i.wa_phone = _wa_phone AND i.user_id IS NOT NULL AND i.verified_at IS NOT NULL;
  IF _user IS NULL THEN RETURN jsonb_build_object('error', 'not_linked'); END IF;
  BEGIN
    RETURN public.request_account_deletion(_user, _reason_code, _reason_text, 'whatsapp');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%staff_account%' THEN RETURN jsonb_build_object('error', 'staff_account'); END IF;
    RAISE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_cancel_account_deletion(_wa_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _user uuid;
BEGIN
  SELECT i.user_id INTO _user FROM public.whatsapp_identities i
   WHERE i.wa_phone = _wa_phone AND i.user_id IS NOT NULL AND i.verified_at IS NOT NULL;
  IF _user IS NULL THEN RETURN jsonb_build_object('error', 'not_linked'); END IF;
  RETURN jsonb_build_object('cancelled', public.cancel_account_deletion(_user));
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_request_account_deletion(text, text, text),
                       public.whatsapp_cancel_account_deletion(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_request_account_deletion(text, text, text),
                          public.whatsapp_cancel_account_deletion(text)
  TO service_role;
