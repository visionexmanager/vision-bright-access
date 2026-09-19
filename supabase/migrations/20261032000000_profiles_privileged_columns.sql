-- A profile row is the account's name and picture. It is not where the account
-- decides its own trial, its own ban or its own admin flag.
--
-- `Users can update their own profile` is `FOR UPDATE USING (auth.uid() =
-- user_id)` with no WITH CHECK and no column list, and `authenticated` holds
-- UPDATE on all eighteen columns — read from production, not inferred. So a
-- signed-in account could PATCH its own row and set:
--
--   trial_expires_at   → a date in 2099. `plan_for_user` reads that column to
--                        decide the free week, so this is no longer only a
--                        trial bypass: it unlocks every section of every tier.
--   is_admin           → true. Nothing reads it today — authorization goes
--                        through `user_roles` and `has_role()` — but a column
--                        a user can set is a trap for the first code that does.
--   status, banned_at,
--   suspended_until    → clearing your own moderation state.
--   is_verified        → marking yourself verified.
--
-- RLS was never the gap. The policy correctly stops you writing somebody
-- else's row; it says nothing about which columns you may write in your own.
-- That is what column privileges are for, and they were never narrowed.
--
-- ── The trial stops being something the browser grants ─────────────────────
--
-- `AuthProvider` sent `trial_expires_at` in the INSERT, anchored to the auth
-- registration time so an existing session could not win extra days. Good
-- intent, wrong side of the wire. The anchor moves into a trigger that reads
-- `auth.users.created_at` and ignores whatever the client supplied, so the
-- guarantee holds whoever is calling.

-- ── 1. The trial is set by the database, from the registration time ────────

CREATE OR REPLACE FUNCTION public.profiles_anchor_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _registered timestamptz;
BEGIN
  SELECT u.created_at INTO _registered FROM auth.users u WHERE u.id = NEW.user_id;

  -- Anchored to registration, not to now(): a row created late for an old
  -- account must not hand it a fresh week. COALESCE covers a profile inserted
  -- by a path where the auth row is not visible, which falls back to now().
  NEW.trial_expires_at :=
    COALESCE(_registered, now()) + (public.trial_period_days() || ' days')::interval;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_anchor_trial() IS
  'Sets trial_expires_at from auth.users.created_at on insert, ignoring whatever the client sent. The free week is granted by the database, not asked for by the browser.';

DROP TRIGGER IF EXISTS profiles_anchor_trial ON public.profiles;
CREATE TRIGGER profiles_anchor_trial
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_anchor_trial();

-- ── 2. Which columns a session may actually write ──────────────────────────
--
-- Everything else on the row is set by the platform: the trial by the trigger
-- above, moderation state by an admin, `referred_by` at signup, `last_login_at`
-- by the sign-in path, timestamps by the database. A service-role caller — an
-- Edge Function that has already verified a JWT — keeps full access, which is
-- how every legitimate write to those columns still happens.

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
REVOKE INSERT ON TABLE public.profiles FROM authenticated;

GRANT UPDATE (display_name, avatar_url) ON TABLE public.profiles TO authenticated;
GRANT INSERT (user_id, display_name, avatar_url) ON TABLE public.profiles TO authenticated;

-- anon has no business here at all.
REVOKE ALL ON TABLE public.profiles FROM anon;

COMMENT ON TABLE public.profiles IS
  'An account''s name and picture. A session may write display_name and avatar_url and nothing else: trial_expires_at is set by a trigger from the registration time, and moderation state, is_admin, is_verified and referred_by are the platform''s to set. RLS decides whose row; column privileges decide which columns.';
