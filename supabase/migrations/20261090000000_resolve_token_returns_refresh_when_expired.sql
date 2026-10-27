-- An expired access token could never be refreshed.
--
-- resolve_social_account_token returned early for an expired access token and
-- reported only `can_refresh`, without the refresh token itself. The refresh
-- action in social-oauth reads `refresh_token` from that payload, found none and
-- answered `no_refresh_token`, so every OAuth 2.0 platform (YouTube, TikTok, X)
-- that had passed its first hour was stuck until reconnected.
--
-- The expired case still reports ok = false, so publishing keeps refusing an
-- expired access token. It now also carries the decrypted refresh token, which
-- is what the refresh action needs. The function stays callable only where it
-- already was; CREATE OR REPLACE keeps its grants.

CREATE OR REPLACE FUNCTION public.resolve_social_account_token(_account_id uuid, _key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public, extensions
AS $function$
DECLARE
  _row public.social_account_tokens%ROWTYPE;
  _access  text;
  _refresh text;
  _can_refresh boolean;
BEGIN
  IF _key IS NULL OR btrim(_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'encryption_key_missing');
  END IF;

  SELECT * INTO _row FROM public.social_account_tokens WHERE account_id = _account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_connected');
  END IF;

  IF _row.expires_at IS NOT NULL AND _row.expires_at <= now() THEN
    _can_refresh := _row.refresh_token_cipher IS NOT NULL
                    AND (_row.refresh_expires_at IS NULL OR _row.refresh_expires_at > now());

    IF _can_refresh THEN
      BEGIN
        _refresh := pgp_sym_decrypt(_row.refresh_token_cipher, _key);
      EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('ok', false, 'error', 'decryption_failed');
      END;
    END IF;

    RETURN jsonb_build_object(
      'ok', false,
      'error', 'token_expired',
      'expired_at', _row.expires_at,
      -- Whether a refresh is even possible, so the caller can tell "reconnect
      -- the account" apart from "refresh it".
      'can_refresh', _can_refresh,
      'refresh_token', _refresh);
  END IF;

  -- A wrong passphrase raises here rather than returning nonsense. Caught so the
  -- caller gets a code instead of an exception carrying cipher bytes.
  BEGIN
    _access  := pgp_sym_decrypt(_row.access_token_cipher, _key);
    _refresh := CASE WHEN _row.refresh_token_cipher IS NULL THEN NULL
                     ELSE pgp_sym_decrypt(_row.refresh_token_cipher, _key) END;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'decryption_failed');
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'access_token', _access,
    'refresh_token', _refresh,
    'token_type', _row.token_type,
    'scopes', to_jsonb(_row.scopes),
    'expires_at', _row.expires_at,
    'external_user_id', _row.external_user_id);
END;
$function$;
