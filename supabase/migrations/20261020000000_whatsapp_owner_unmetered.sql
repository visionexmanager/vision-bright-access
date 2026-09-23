-- The number that runs the service is not a customer of it.
--
-- `whatsapp_entitlements` knew about plans, trials and the twenty-a-day free
-- floor, and about nothing else — so the owner's own handset was metered like
-- a stranger who had just found the number. Twenty paid operations into a day
-- of testing, the assistant answered every further question with "you have
-- used today's allowance", which reads, to the person who built it, as the
-- assistant refusing to do the work. The abuse limiter had already been given
-- an owner exemption for exactly this reason (see the webhook's rate-limit
-- section); the allowance never got one.
--
-- Two exemptions, both of them the ones the system already trusts elsewhere:
--
--   * the configured owner number — the same `site_settings.owner_contact`
--     value the Owner Control Centre authorises commands by, compared the same
--     way the webhook compares it;
--   * a linked account holding the `admin` role — proved by the identity link
--     (a code emailed to the account), never by the phone number alone.
--
-- Nothing else changes. The answer still carries no user id, no email and no
-- name, a lapsed subscription still falls back to the free allowance rather
-- than to a locked door, and every other number is metered exactly as before.

-- ── Comparing two numbers the way the webhook does ──────────────────────────
--
-- WhatsApp reports a bare international number; an admin types the same one
-- with a plus, with spaces, or behind a `00`. `normalizePhone`/`isOwner` in
-- `_shared/ownerControl.ts` reduce both sides to digits and compare the
-- trailing significant ones — long enough that two subscribers cannot collide,
-- short enough that a missing country code still matches. This is that rule in
-- SQL, kept deliberately identical: two places that decide "is this the owner"
-- differently is a bug waiting for the day somebody edits one of them.

CREATE OR REPLACE FUNCTION public.whatsapp_same_number(_a text, _b text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _left        text := regexp_replace(COALESCE(_a, ''), '\D', '', 'g');
  _right       text := regexp_replace(COALESCE(_b, ''), '\D', '', 'g');
  _significant integer;
BEGIN
  IF left(_left, 2) = '00' THEN _left := substr(_left, 3); END IF;
  IF left(_right, 2) = '00' THEN _right := substr(_right, 3); END IF;
  IF _left = '' OR _right = '' THEN RETURN false; END IF;

  _significant := LEAST(length(_left), length(_right), 12);
  IF _significant < 8 THEN RETURN false; END IF;

  RETURN right(_left, _significant) = right(_right, _significant);
END;
$$;

COMMENT ON FUNCTION public.whatsapp_same_number(text, text) IS
  'Do these two phone numbers name the same handset? Trailing significant digits, so a missing country code still matches. Mirrors isOwner() in _shared/ownerControl.ts — change both together.';

REVOKE ALL ON FUNCTION public.whatsapp_same_number(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_same_number(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_same_number(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_same_number(text, text) TO service_role;

-- ── Is this the number that runs the service? ───────────────────────────────

CREATE OR REPLACE FUNCTION public.whatsapp_is_owner_number(_wa_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.site_settings s
     WHERE s.key = 'owner_contact'
       AND public.whatsapp_same_number(_wa_phone, s.value ->> 'whatsapp_number')
  )
$$;

COMMENT ON FUNCTION public.whatsapp_is_owner_number(text) IS
  'True for the configured owner handset. Reads site_settings.owner_contact, never a hard-coded number.';

REVOKE ALL ON FUNCTION public.whatsapp_is_owner_number(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_is_owner_number(text) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_is_owner_number(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_is_owner_number(text) TO service_role;

-- ── What may this number do today ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.whatsapp_entitlements(_wa_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id   uuid;
  _expires   timestamptz;
  _plan_id   text;
  _plan_name text;
  _limit     integer;
  _used      integer;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN
    RETURN jsonb_build_object('linked', false, 'plan', 'none', 'plan_name', 'Free',
                              'daily_limit', 0, 'used_today', 0, 'remaining', 0, 'allowed', false);
  END IF;

  SELECT i.user_id INTO _user_id
    FROM public.whatsapp_identities i
   WHERE i.wa_phone = _wa_phone;

  -- The two exemptions, before any plan is read. Both return the shape an
  -- unlimited plan returns — limit 0, remaining -1 — so every caller that
  -- already understands "unlimited" understands this without a new branch.
  IF public.whatsapp_is_owner_number(_wa_phone) THEN
    RETURN jsonb_build_object('linked', _user_id IS NOT NULL, 'plan', 'owner', 'plan_name', 'Owner',
                              'daily_limit', 0, 'used_today', 0, 'remaining', -1, 'allowed', true);
  END IF;

  IF _user_id IS NOT NULL AND public.has_role(_user_id, 'admin') THEN
    RETURN jsonb_build_object('linked', true, 'plan', 'admin', 'plan_name', 'Admin',
                              'daily_limit', 0, 'used_today', 0, 'remaining', -1, 'allowed', true);
  END IF;

  IF _user_id IS NOT NULL THEN
    SELECT p.trial_expires_at INTO _expires
      FROM public.profiles p WHERE p.user_id = _user_id;

    IF _expires IS NOT NULL AND _expires > now() THEN
      _plan_id := 'free_trial';
    ELSE
      SELECT s.plan_id INTO _plan_id
        FROM public.user_subscriptions s
       WHERE s.user_id = _user_id
         AND s.status = 'active'
         AND (s.ends_at IS NULL OR s.ends_at > now())
       ORDER BY s.started_at DESC
       LIMIT 1;
    END IF;
  END IF;

  IF _plan_id IS NOT NULL THEN
    SELECT p.name, COALESCE((p.limits ->> 'whatsapp_daily_messages')::integer, 0)
      INTO _plan_name, _limit
      FROM public.billing_plans p
     WHERE p.id = _plan_id AND p.is_active;
  END IF;

  IF _plan_name IS NULL THEN
    _plan_id   := 'none';
    _plan_name := 'Free';
    _limit     := public.whatsapp_free_daily_allowance();
  END IF;

  SELECT COALESCE(u.metered_count, 0) INTO _used
    FROM public.whatsapp_usage u
   WHERE u.wa_phone = _wa_phone
     AND u.usage_date = (now() AT TIME ZONE 'utc')::date;
  _used := COALESCE(_used, 0);

  RETURN jsonb_build_object(
    'linked',      _user_id IS NOT NULL,
    'plan',        _plan_id,
    'plan_name',   _plan_name,
    'daily_limit', _limit,
    'used_today',  _used,
    'remaining',   CASE WHEN _limit = 0 THEN -1 ELSE GREATEST(0, _limit - _used) END,
    'allowed',     _limit = 0 OR _used < _limit
  );
END;
$$;

COMMENT ON FUNCTION public.whatsapp_entitlements(text) IS
  'What a number may do today: plan, daily limit, used, remaining — the free week included, and the owner handset and admin accounts unmetered. Carries no user id, email or name by design. Service role only.';

REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_entitlements(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_entitlements(text) TO service_role;
