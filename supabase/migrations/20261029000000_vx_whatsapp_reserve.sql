-- Billing a WhatsApp sender centrally, without telling the webhook who they are.
--
-- `whatsapp_identity_state()` returns `linked`, and deliberately no user id:
-- "the webhook needs to know what somebody is allowed, not who they are, and a
-- function that hands identity to a message handler is a function that will
-- eventually log it" (20260928). The central VX system needs a `user_id` to
-- reserve against. Both of those are right, so the resolution happens here,
-- inside the database, and what comes back is a reservation id — never an
-- identity.
--
-- ── The two populations ─────────────────────────────────────────────────────
--
-- A number linked to an `auth.users` account is the same customer as the
-- website session: same balance, same price list, same ledger, `source =
-- 'whatsapp'`. An unlinked number is refused here with `not_linked` and the
-- webhook falls back to `whatsapp_entitlements()` — its existing count-based
-- free floor, its abuse limiter and its repeat-message guard, all unchanged.
-- No anonymous wallet, no placeholder account, no invented subject.
--
-- ── Inert until somebody enables it ─────────────────────────────────────────
--
-- `central_pricing_registry.whatsapp_ai.enabled` is false, so this answers
-- `service_disabled` today and the caller takes the legacy path. Turning it on
-- is a row update, reviewed separately.

CREATE OR REPLACE FUNCTION public.vx_reserve_for_whatsapp(
  _wa_phone        text,
  _service_id      text,
  _idempotency_key text DEFAULT NULL,
  _units           integer DEFAULT 1,
  _metadata        jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _result  jsonb;
BEGIN
  IF _wa_phone IS NULL OR btrim(_wa_phone) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_linked');
  END IF;

  SELECT i.user_id INTO _user_id
    FROM public.whatsapp_identities i
   WHERE i.wa_phone = _wa_phone;

  -- The one answer an unlinked number gets. It is not an error condition: it
  -- is the larger of the two populations, and its route is the legacy quota.
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_linked');
  END IF;

  _result := public.vx_reserve(_user_id, _service_id, 'whatsapp', _idempotency_key, _units, _metadata);

  -- Strip anything that could identify the sender before it leaves the
  -- database. `vx_reserve` returns no user id today; this is the guard that
  -- keeps that true if it ever gains one.
  RETURN _result - 'user_id';
END;
$$;

COMMENT ON FUNCTION public.vx_reserve_for_whatsapp(text, text, text, integer, jsonb) IS
  'Reserve VX for a linked WhatsApp sender. Resolves the identity internally and returns a reservation id, never a user id — the webhook still never learns who the sender is. An unlinked number is refused with not_linked and keeps whatsapp_entitlements.';

REVOKE ALL ON FUNCTION public.vx_reserve_for_whatsapp(text, text, text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_reserve_for_whatsapp(text, text, text, integer, jsonb) TO service_role;

-- Settling and releasing need no equivalent: they take a reservation id, which
-- carries no identity, so `vx_settle` and `vx_release` are already safe for the
-- webhook to call directly.
