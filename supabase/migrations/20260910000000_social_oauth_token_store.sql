-- Phase 9, step 2: somewhere for an OAuth token to live.
--
-- The Phase 8 audit found this missing outright: no token storage, no refresh,
-- no per-account access token. `social_accounts.api_key_ref` is a static secret
-- NAME — it resolves to something like META_APP_SECRET, which identifies the
-- Visionex *app*, not the authorisation a page granted it. Every platform in
-- scope issues a per-account token that expires and is refreshed, and there was
-- no column, table or function in this database able to hold one.
--
-- What this adds: one table, three functions, and no policy.
--
-- What it does NOT add: any HTTP call, any platform hostname, any client id or
-- secret, any adapter, any account row, any token. Nothing here can publish, and
-- nothing here connects to anything. It is the place a token will be put by the
-- callback function that comes next.
--
-- ── Why a table and not api_key_ref ────────────────────────────────────────
--
-- Phase 8's rule was "the row names a secret, never holds it", and it is a good
-- rule. It cannot be kept literally for OAuth: a per-account token rotates on a
-- schedule the platform chooses, and an Edge Function environment variable is
-- deployed, not written at runtime. Storing a rotating token as an env var would
-- mean redeploying the function every time Meta refreshes it.
--
-- So the rule is kept in the form that still holds: no credential is ever stored
-- as readable text, and no role that can reach this database over PostgREST can
-- read one. api_key_ref keeps its meaning unchanged — the app-level secret's
-- name — and this table holds the per-account grant, encrypted.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── The store ───────────────────────────────────────────────────────────────
--
-- bytea columns only. There is deliberately no text column on this table that
-- could hold a token: a plaintext column is the kind of thing a later migration
-- adds "temporarily for debugging", and its absence is the guarantee.
--
-- One row per account. A second grant for the same account replaces the first
-- rather than accumulating, because two live tokens for one identity means the
-- publisher picks one and nobody knows which.

CREATE TABLE IF NOT EXISTS public.social_account_tokens (
  account_id    uuid PRIMARY KEY REFERENCES public.social_accounts(id) ON DELETE CASCADE,

  -- pgp_sym_encrypt output. The passphrase is supplied per call by the Edge
  -- Function and is never stored here — same contract as career_encrypt.
  access_token_cipher  bytea NOT NULL,
  refresh_token_cipher bytea,

  token_type    text NOT NULL DEFAULT 'bearer',

  -- What the platform actually granted, as it reported it — not what Visionex
  -- asked for. The difference between those two is the entire question of
  -- whether an app review has completed, and recording the request instead of
  -- the grant is how a dashboard ends up claiming a permission it lacks.
  scopes        text[] NOT NULL DEFAULT '{}',

  expires_at            timestamptz,
  refresh_expires_at    timestamptz,

  -- The platform's own id for the identity this token authorises — a page id, a
  -- channel id. Not a credential.
  external_user_id text,

  obtained_at   timestamptz NOT NULL DEFAULT now(),
  rotated_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- A token cannot be stored empty. An empty cipher would decrypt to nothing and
-- read as "connected" to every has-a-token check in the system.
ALTER TABLE public.social_account_tokens
  DROP CONSTRAINT IF EXISTS social_account_tokens_cipher_not_empty;
ALTER TABLE public.social_account_tokens
  ADD CONSTRAINT social_account_tokens_cipher_not_empty
  CHECK (octet_length(access_token_cipher) > 0
         AND (refresh_token_cipher IS NULL OR octet_length(refresh_token_cipher) > 0));

CREATE INDEX IF NOT EXISTS social_account_tokens_expiring_idx
  ON public.social_account_tokens (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON TABLE public.social_account_tokens IS
  'Per-account OAuth grants, encrypted with pgp_sym_encrypt under a passphrase the caller supplies and the database never stores. RLS is enabled with no policy at all: this table is unreadable over PostgREST by anon, authenticated and admin alike, and is reached only through the SECURITY DEFINER functions below.';

-- ── RLS: enabled, and empty on purpose ──────────────────────────────────────
--
-- social_accounts grants admins SELECT. This table does not, and that asymmetry
-- is the point. An admin session in a browser is one stolen cookie away from
-- being someone else's, and the thing behind that cookie would otherwise be a
-- live publishing credential for every Visionex channel.
--
-- With RLS enabled and no policy, every PostgREST role reads zero rows. The only
-- access is through the functions below, which are granted to service_role
-- alone. An admin who needs to know whether an account is connected uses
-- social_connection_status(), which answers that question without the token.

ALTER TABLE public.social_account_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_account_tokens FROM PUBLIC, anon, authenticated;

-- ── Store ───────────────────────────────────────────────────────────────────
--
-- Upsert on account_id. Returns what was stored ABOUT the token — never the
-- token — so a caller that logs its own return value cannot leak one.

CREATE OR REPLACE FUNCTION public.store_social_account_token(
  _account_id       uuid,
  _key              text,
  _access_token     text,
  _refresh_token    text DEFAULT NULL,
  _expires_at       timestamptz DEFAULT NULL,
  -- NULL means "the platform did not restate the grant on this call", which is
  -- different from "it granted nothing" — see the ON CONFLICT clause.
  _scopes           text[] DEFAULT NULL,
  _external_user_id text DEFAULT NULL,
  _token_type       text DEFAULT 'bearer',
  _refresh_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _platform text;
  _existed  boolean;
  _stored_scopes jsonb;
BEGIN
  -- A missing passphrase must fail loudly. pgp_sym_encrypt(x, '') succeeds and
  -- produces a cipher anyone can open, which is worse than no encryption
  -- because it reads as encrypted for the rest of the system's life.
  IF _key IS NULL OR btrim(_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'encryption_key_missing');
  END IF;

  IF _access_token IS NULL OR btrim(_access_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_token_required');
  END IF;

  SELECT platform INTO _platform FROM public.social_accounts WHERE id = _account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_not_found');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.social_account_tokens WHERE account_id = _account_id)
    INTO _existed;

  INSERT INTO public.social_account_tokens AS t (
    account_id, access_token_cipher, refresh_token_cipher, token_type,
    scopes, expires_at, refresh_expires_at, external_user_id
  ) VALUES (
    _account_id,
    pgp_sym_encrypt(_access_token, _key),
    CASE WHEN _refresh_token IS NULL OR btrim(_refresh_token) = ''
         THEN NULL ELSE pgp_sym_encrypt(_refresh_token, _key) END,
    coalesce(_token_type, 'bearer'),
    coalesce(_scopes, '{}'::text[]),
    _expires_at,
    _refresh_expires_at,
    _external_user_id
  )
  ON CONFLICT (account_id) DO UPDATE SET
    access_token_cipher  = EXCLUDED.access_token_cipher,
    -- Kept when the refresh omits one, not overwritten with NULL.
    --
    -- Several of these platforms issue a refresh token once, at first consent,
    -- and answer every later refresh with an access token alone. Taking
    -- EXCLUDED unconditionally would erase the only copy on the first
    -- successful refresh, and the account would then work until the new access
    -- token expired and never again — a failure that appears hours later and
    -- looks like the platform revoking access.
    refresh_token_cipher = coalesce(EXCLUDED.refresh_token_cipher, t.refresh_token_cipher),
    refresh_expires_at   = CASE
                             WHEN EXCLUDED.refresh_token_cipher IS NOT NULL
                             THEN EXCLUDED.refresh_expires_at
                             ELSE t.refresh_expires_at
                           END,
    token_type           = EXCLUDED.token_type,
    -- Kept when the refresh reports none, for the same reason as the refresh
    -- token above. A token refresh does not always restate the scope set, and
    -- overwriting with an empty one would make the connection screen report
    -- that a working account had been granted nothing — the exact false reading
    -- the scopes column exists to prevent, in the other direction. A genuine
    -- loss of every permission is revoke_social_account_token(), not a silent
    -- empty array.
    scopes               = CASE
                             WHEN coalesce(array_length(EXCLUDED.scopes, 1), 0) > 0
                             THEN EXCLUDED.scopes
                             ELSE t.scopes
                           END,
    expires_at           = EXCLUDED.expires_at,
    external_user_id     = coalesce(EXCLUDED.external_user_id, t.external_user_id),
    rotated_at           = now(),
    updated_at           = now();

  UPDATE public.social_accounts
     SET last_connected_at = now(), updated_at = now()
   WHERE id = _account_id;

  -- Scopes are recorded in the audit trail because "which permissions did this
  -- grant actually carry" is the question every later publishing failure will
  -- come back to. No token, no cipher, no key.
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (NULL,
          CASE WHEN _existed THEN 'social_token_rotated' ELSE 'social_token_stored' END,
          'social_account', _account_id,
          jsonb_build_object('platform', _platform,
                             -- Null, not [], when the platform did not restate
                             -- the grant: the trail should say "it did not say"
                             -- rather than "it granted nothing".
                             'scopes', to_jsonb(_scopes),
                             'expires_at', _expires_at,
                             'has_refresh_token', _refresh_token IS NOT NULL));

  -- Read back rather than echoed: after a refresh that restated neither the
  -- scopes nor the refresh token, what is stored is not what was passed, and
  -- the caller deciding whether the connection is usable needs the former.
  SELECT to_jsonb(scopes) INTO _stored_scopes
    FROM public.social_account_tokens WHERE account_id = _account_id;

  RETURN jsonb_build_object(
    'ok', true,
    'rotated', _existed,
    'platform', _platform,
    'scopes', _stored_scopes,
    'expires_at', _expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.store_social_account_token(uuid, text, text, text, timestamptz, text[], text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_social_account_token(uuid, text, text, text, timestamptz, text[], text, text, timestamptz) TO service_role;

-- ── Resolve ─────────────────────────────────────────────────────────────────
--
-- The one function in this database that yields a token in the clear, and the
-- reason every other path is closed. It is granted to service_role only, so
-- reaching it means already holding the service key.
--
-- An expired token is refused rather than returned. Returning it would send the
-- publisher to the platform with a credential it knows is dead, and the platform
-- would answer with a failure that costs the slot an attempt — the failure would
-- be recorded as the platform's, when the database knew before the call.

CREATE OR REPLACE FUNCTION public.resolve_social_account_token(
  _account_id uuid,
  _key        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.social_account_tokens%ROWTYPE;
  _access  text;
  _refresh text;
BEGIN
  IF _key IS NULL OR btrim(_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'encryption_key_missing');
  END IF;

  SELECT * INTO _row FROM public.social_account_tokens WHERE account_id = _account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_connected');
  END IF;

  IF _row.expires_at IS NOT NULL AND _row.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'token_expired',
      'expired_at', _row.expires_at,
      -- Whether a refresh is even possible, so the caller can tell "reconnect
      -- the account" apart from "refresh it".
      'can_refresh', _row.refresh_token_cipher IS NOT NULL
                     AND (_row.refresh_expires_at IS NULL OR _row.refresh_expires_at > now()));
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
$$;

-- Deliberately NOT audit-logged. A log line per resolve would record the shape
-- of Visionex's publishing activity on every attempt, and the useful event —
-- the publication itself — is already recorded by record_content_publication().
REVOKE ALL ON FUNCTION public.resolve_social_account_token(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_social_account_token(uuid, text) TO service_role;

-- ── Revoke ──────────────────────────────────────────────────────────────────
--
-- Deleting the grant also takes the account out of `active`. An active account
-- with no token would be claimable by claim_due_content_slot() and could only
-- fail, burning the slot's attempt budget on a connection that is known to be
-- gone. Disabling it is the honest state, and re-activating requires the review
-- constraint to be satisfied again.

CREATE OR REPLACE FUNCTION public.revoke_social_account_token(_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _platform text;
  _deleted  integer;
BEGIN
  SELECT platform INTO _platform FROM public.social_accounts WHERE id = _account_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'account_not_found');
  END IF;

  DELETE FROM public.social_account_tokens WHERE account_id = _account_id;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  UPDATE public.social_accounts
     SET status = 'disabled', updated_at = now()
   WHERE id = _account_id AND status = 'active';

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (auth.uid(), 'social_token_revoked', 'social_account', _account_id,
          jsonb_build_object('platform', _platform, 'had_token', _deleted > 0));

  RETURN jsonb_build_object('ok', true, 'had_token', _deleted > 0);
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_social_account_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_social_account_token(uuid) TO service_role;

-- ── Status, without the token ───────────────────────────────────────────────
--
-- What the connection screen needs, and nothing more. A function rather than a
-- view, because a view over a table with no policy returns nothing to an admin,
-- and a SECURITY DEFINER view would hand the decision to whoever writes the next
-- SELECT. Here the admin check is a statement in the body.
--
-- Five distinguishable states, because "not connected" and "connected but the
-- platform never granted publishing" are different problems with different
-- fixes, and a single green dot would hide which one you have:
--
--   not_reviewed  - no platform review recorded
--   not_permitted - reviewed, and the platform did not grant publishing
--   not_connected - permitted, but no OAuth grant stored
--   expired       - a grant exists and is past its expiry
--   connected     - a live grant exists
--
-- Every column returned is non-secret. There is no branch of this function that
-- touches access_token_cipher.

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

  -- Aliased `entry` rather than `row`: ROW is a Postgres keyword, and a column
  -- alias that only parses by luck is not worth the two saved characters.
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

-- Granted to authenticated, unlike the three above: the admin check is inside
-- the body, and the function returns no credential on any path.
REVOKE ALL ON FUNCTION public.social_connection_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.social_connection_status() TO authenticated, service_role;

-- No seed rows and no token. There is nothing to store until a platform has
-- actually granted something, and inventing a row here would make the
-- connection screen claim a connection that does not exist.
