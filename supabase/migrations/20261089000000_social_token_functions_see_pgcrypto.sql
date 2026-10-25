-- store_social_account_token and resolve_social_account_token encrypt and decrypt
-- with pgcrypto (pgp_sym_encrypt / pgp_sym_decrypt), which Supabase installs in
-- the `extensions` schema. Both were created with `SET search_path = public`, so
-- the call failed with "function pgp_sym_encrypt(text, text) does not exist"
-- the first time anything tried to store a token: the OAuth callback answered
-- connection=store_failed, and nothing could ever be connected.
--
-- Found on 2026-10-25 by completing a real Facebook connection and reading the
-- outcome the callback redirected with. Adding `extensions` to the function's
-- own search_path keeps the definer's path pinned (nothing the caller sets can
-- redirect it) while letting it see pgcrypto.

ALTER FUNCTION public.store_social_account_token(
  uuid, text, text, text, timestamptz, text[], text, text, timestamptz
) SET search_path = public, extensions;

ALTER FUNCTION public.resolve_social_account_token(uuid, text)
  SET search_path = public, extensions;
