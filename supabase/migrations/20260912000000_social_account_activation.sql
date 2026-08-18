-- Phase 9, step 5 — the step that lets a connected account actually publish.
--
-- Phase 8 made `active` conditional on a recorded platform review, and was
-- right to. What it did not add was any way to record one. The audit of this
-- phase found the consequence: no code path in the repository — not the OAuth
-- callback, not owner-control, not the admin screen — sets review_completed_at,
-- api_key_ref or status. Every account ever created by the connection flow is
-- born `unverified`, and claim_due_content_slot() requires `active`.
--
-- So the publishing queue could not have produced a single post regardless of
-- how many platforms were connected, and nothing would have said why: a slot
-- for an unverified account is simply never claimable, which looks exactly like
-- an empty calendar. Every later stage of this programme depends on this one,
-- and none of them would have failed loudly without it.
--
-- What this migration adds: two functions and an audit trail.
--
-- What it does NOT add: any relaxation of the Phase 8 constraint, any HTTP
-- call, any credential, any account row, and any way for a browser to reach
-- either function directly.

-- ── Recording a review ──────────────────────────────────────────────────────
--
-- The review is a human statement — "I checked in the Meta console that this
-- app may publish as this identity" — and the columns exist to hold evidence of
-- it. The actor is passed in rather than read from auth.uid(): the caller is an
-- Edge Function holding the service key, where auth.uid() is null, and a
-- reviewer of NULL would defeat the point of recording who decided.
--
-- api_key_ref is supplied by the caller and constrained by the table to an
-- environment-variable identifier, so a pasted access token fails here rather
-- than being stored. The Edge Function derives it from the provider registry
-- instead of asking a human to type it, which is what keeps a token from ever
-- being offered to this parameter in the first place.

CREATE OR REPLACE FUNCTION public.record_social_account_review(
  _account_id  uuid,
  _actor       uuid,
  _api_key_ref text,
  _reference   text DEFAULT NULL,
  _notes       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _platform text;
BEGIN
  IF _actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actor_required');
  END IF;

  -- Checked here as well as by the table constraint so the caller gets a code
  -- it can turn into a sentence, rather than a raised constraint violation.
  IF _api_key_ref IS NULL OR _api_key_ref !~ '^[A-Z][A-Z0-9_]{2,63}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'api_key_ref_invalid');
  END IF;

  SELECT platform INTO _platform FROM public.social_accounts WHERE id = _account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_not_found');
  END IF;

  UPDATE public.social_accounts
     SET review_completed_at = now(),
         reviewed_by         = _actor,
         api_key_ref         = _api_key_ref,
         review_reference    = coalesce(nullif(btrim(_reference), ''), review_reference),
         review_notes        = coalesce(nullif(btrim(_notes), ''), review_notes),
         updated_at          = now()
   WHERE id = _account_id;

  -- Deliberately does NOT set status. Recording a review is evidence; switching
  -- an account on is a second, separate decision, and collapsing the two would
  -- mean a single click both attests to a review and starts publishing.
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor, 'social_account_review_recorded', 'social_account', _account_id,
          jsonb_build_object('platform', _platform, 'api_key_ref', _api_key_ref,
                             'reference', _reference));

  RETURN jsonb_build_object('ok', true, 'platform', _platform);
END;
$$;

REVOKE ALL ON FUNCTION public.record_social_account_review(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_account_review(uuid, uuid, text, text, text)
  TO service_role;

COMMENT ON FUNCTION public.record_social_account_review(uuid, uuid, text, text, text) IS
  'Records that a human verified this account may publish on its platform, and names the app-level secret. Does not activate the account: that is a separate decision with its own function.';

-- ── Switching an account on and off ─────────────────────────────────────────
--
-- The table constraint already refuses `active` without a review, a granted
-- publishing permission and a named secret. This function adds the one
-- condition a CHECK cannot express, because it lives in another table: a live
-- OAuth grant.
--
-- Without that check an account could be activated while disconnected, and
-- claim_due_content_slot() would then withhold its slots as "no live grant" —
-- correct behaviour reached by a confusing route, since the screen would show
-- the account as active and the queue would silently do nothing.
--
-- Deactivation has no preconditions at all. Turning something off must never be
-- the operation that fails.

CREATE OR REPLACE FUNCTION public.set_social_account_status(
  _account_id uuid,
  _actor      uuid,
  _status     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account public.social_accounts%ROWTYPE;
BEGIN
  IF _actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actor_required');
  END IF;

  IF _status NOT IN ('active', 'disabled') THEN
    -- 'unverified' is a state an account is BORN in, not one it is returned to.
    -- Allowing a caller to set it would erase the distinction between "never
    -- reviewed" and "reviewed and switched off".
    RETURN jsonb_build_object('ok', false, 'error', 'status_not_settable');
  END IF;

  SELECT * INTO _account FROM public.social_accounts WHERE id = _account_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_not_found');
  END IF;

  IF _status = 'active' THEN
    IF _account.review_completed_at IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'review_not_recorded');
    END IF;
    IF NOT _account.publishing_permission_granted THEN
      RETURN jsonb_build_object('ok', false, 'error', 'publishing_not_granted');
    END IF;
    IF _account.api_key_ref IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'api_key_ref_missing');
    END IF;
    IF NOT public.social_account_has_live_grant(_account_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_connected');
    END IF;
  END IF;

  UPDATE public.social_accounts
     SET status = _status, updated_at = now()
   WHERE id = _account_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (_actor,
          CASE WHEN _status = 'active' THEN 'social_account_activated'
               ELSE 'social_account_disabled' END,
          'social_account', _account_id,
          jsonb_build_object('platform', _account.platform,
                             'previous_status', _account.status));

  RETURN jsonb_build_object('ok', true, 'status', _status, 'platform', _account.platform);
END;
$$;

REVOKE ALL ON FUNCTION public.set_social_account_status(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_social_account_status(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.set_social_account_status(uuid, uuid, text) IS
  'The only path to status = active. Enforces the Phase 8 review constraint plus a live OAuth grant, which a CHECK cannot see because it lives in social_account_tokens. Disabling has no preconditions.';

-- ── The screen needs to know what is still missing ──────────────────────────
--
-- social_connection_status() already reports every fact these functions check,
-- with one exception: whether a secret has been named. Without it the screen
-- can show an account as reviewed, permitted and connected, offer an activate
-- button, and have it refused for a reason nothing on the page mentioned.
--
-- Restated in full because CREATE OR REPLACE has no partial form. The only
-- change from step 2's version is the added `api_key_ref_present` key; every
-- other key, the admin check and the connection vocabulary are unchanged. The
-- value is a boolean, never the name itself — an environment variable name is
-- not a credential, but it is also not something a browser needs.

CREATE OR REPLACE FUNCTION public.social_connection_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rows jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(entry ORDER BY entry->>'platform'), '[]'::jsonb) INTO _rows
  FROM (
    SELECT jsonb_build_object(
             'account_id', a.id,
             'platform', a.platform,
             'handle', a.handle,
             'display_name', a.display_name,
             'status', a.status,
             'capabilities', to_jsonb(a.capabilities),
             'health_score', a.health_score,
             'consecutive_failures', a.consecutive_failures,
             'review_completed_at', a.review_completed_at,
             'publishing_permission_granted', a.publishing_permission_granted,
             'review_reference', a.review_reference,
             'api_key_ref_present', a.api_key_ref IS NOT NULL,
             'last_connected_at', a.last_connected_at,
             'granted_scopes', to_jsonb(coalesce(t.scopes, '{}'::text[])),
             'token_expires_at', t.expires_at,
             'can_refresh', t.refresh_token_cipher IS NOT NULL
                            AND (t.refresh_expires_at IS NULL OR t.refresh_expires_at > now()),
             'connection', CASE
               WHEN a.review_completed_at IS NULL THEN 'not_reviewed'
               WHEN NOT a.publishing_permission_granted THEN 'not_permitted'
               WHEN t.account_id IS NULL THEN 'not_connected'
               WHEN t.expires_at IS NOT NULL AND t.expires_at <= now() THEN 'expired'
               ELSE 'connected'
             END) AS entry
      FROM public.social_accounts a
      LEFT JOIN public.social_account_tokens t ON t.account_id = a.id
  ) s;

  RETURN jsonb_build_object('ok', true, 'accounts', _rows);
END;
$$;

REVOKE ALL ON FUNCTION public.social_connection_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_connection_status() TO authenticated, service_role;

-- No account is activated here. There is nothing connected to activate, and a
-- migration that switched one on would be making exactly the human decision
-- these two functions exist to keep human.
