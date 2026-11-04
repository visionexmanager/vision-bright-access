-- The free week gains three WhatsApp features that cost nothing to run, each
-- with a small allowance the sender is told about.
--
-- The free week stays closed to every AI service (20261063): the subscription
-- gate is untouched and a trial number is still refused by it. What this adds is
-- a separate, narrow lane in the WhatsApp webhook for work done on Visionex's
-- own server with no paid provider and no model fallback:
--
--   read_text  text in a photo, read by the local OCR      10 per free week
--   barcode    QR codes and barcodes, read locally         10 per free week
--   office     the text of a .docx / .pptx, read locally    3 per free week
--
-- The allowance is counted here, atomically, so two messages arriving together
-- cannot both take the last unit. `trial_local_take` answers with the limit and
-- what is left, which is what the sender is told. A unit is handed back with
-- `trial_local_release` when the work produced nothing, so a blurry photo does
-- not cost a try.
--
-- Only an account whose plan_for_user is exactly 'free_trial' may take a unit:
-- a paid plan already has the assistant, an expired week has nothing, a number
-- with no account has nothing to count against. Nothing here widens a section,
-- a grant or a policy; the new table is service-role only like its neighbours.
--
-- Additive and re-runnable.

CREATE TABLE IF NOT EXISTS public.trial_local_usage (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature    text NOT NULL CHECK (feature IN ('read_text', 'barcode', 'office')),
  used       integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature)
);
ALTER TABLE public.trial_local_usage ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.trial_local_usage IS
  'Units of the free-week local features a user has taken. Counts only: no text, no file, no phone number. Service role only: no policy, deliberately.';

CREATE OR REPLACE FUNCTION public.trial_local_limit(_feature text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _feature WHEN 'read_text' THEN 10 WHEN 'barcode' THEN 10 WHEN 'office' THEN 3 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.trial_local_take(_wa_phone text, _feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user  uuid;
  _limit integer := public.trial_local_limit(_feature);
  _used  integer;
BEGIN
  IF _limit = 0 OR _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN
    RETURN jsonb_build_object('status', 'not_trial');
  END IF;

  SELECT i.user_id INTO _user FROM public.whatsapp_identities i WHERE i.wa_phone = _wa_phone;
  IF _user IS NULL OR public.plan_for_user(_user) IS DISTINCT FROM 'free_trial' THEN
    RETURN jsonb_build_object('status', 'not_trial');
  END IF;

  INSERT INTO public.trial_local_usage AS t (user_id, feature, used, updated_at)
  VALUES (_user, _feature, 1, now())
  ON CONFLICT (user_id, feature) DO UPDATE SET used = t.used + 1, updated_at = now()
    WHERE t.used < _limit
  RETURNING t.used INTO _used;

  IF _used IS NULL THEN
    RETURN jsonb_build_object('status', 'exhausted', 'feature', _feature, 'limit', _limit, 'used', _limit, 'remaining', 0);
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'feature', _feature, 'limit', _limit, 'used', _used, 'remaining', _limit - _used);
END;
$$;

CREATE OR REPLACE FUNCTION public.trial_local_release(_wa_phone text, _feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit integer := public.trial_local_limit(_feature);
  _used  integer;
BEGIN
  UPDATE public.trial_local_usage u
     SET used = greatest(u.used - 1, 0), updated_at = now()
   WHERE u.feature = _feature
     AND u.user_id = (SELECT i.user_id FROM public.whatsapp_identities i WHERE i.wa_phone = _wa_phone)
  RETURNING u.used INTO _used;
  IF _used IS NULL THEN RETURN jsonb_build_object('status', 'none'); END IF;
  RETURN jsonb_build_object('status', 'ok', 'feature', _feature, 'limit', _limit, 'used', _used, 'remaining', _limit - _used);
END;
$$;

DO $$
DECLARE
  _sig text;
BEGIN
  FOREACH _sig IN ARRAY ARRAY[
    'public.trial_local_limit(text)',
    'public.trial_local_take(text, text)',
    'public.trial_local_release(text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _sig);
  END LOOP;
END $$;
