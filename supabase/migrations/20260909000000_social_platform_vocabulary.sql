-- Phase 9, step 1: the platform vocabulary Visionex actually has accounts on.
--
-- Phase 8 shipped four externally publishable platforms — facebook, instagram,
-- tiktok, youtube — and said so in a comment: "Only the four externally
-- publishable platforms." That was true of the schema, not of the business.
-- Visionex also holds @visionexworld on Threads and on X, and Visionex World LLC
-- will hold a LinkedIn company page. Three platforms that exist could not be
-- named anywhere in this database, so the first step of connecting them was not
-- an adapter or a token — it was that `INSERT INTO social_accounts (platform)
-- VALUES ('threads')` failed a CHECK.
--
-- This migration widens the vocabulary and nothing else.
--
-- It does NOT:
--   * publish anything, or contact any platform
--   * store, name or resolve a credential
--   * create an account row — an account exists once a real platform review has
--     happened, which is the rule Phase 8 set and this keeps
--   * implement the LinkedIn organization connection, which stays out until the
--     company page exists
--
-- Widening a CHECK is the one direction that is safe on live data: every value
-- currently stored still satisfies the new constraint, so the ALTER validates
-- without a rewrite and without a failure mode on existing rows.
--
-- What still gates publishing, unchanged: claim_due_content_slot() requires an
-- `active` account for the slot's platform, and social_accounts_active_requires_
-- review refuses `active` unless the review is recorded, the platform granted
-- publishing, and a secret has been named. A newly nameable platform is
-- therefore exactly as unable to publish as it was five minutes ago.

-- ── Drop the old platform CHECKs, whatever Postgres called them ──────────────
--
-- All four were declared inline inside CREATE TABLE, so their names are
-- generated. The Phase 8 migration hit the same problem with content_calendar's
-- slot_state and solved it by looking the constraint up by definition; this does
-- the same, but keys on the constrained COLUMN rather than on a substring of the
-- definition text. content_proposals has a second CHECK — `section IN (…)` —
-- and an ILIKE '%platform%' search would be one careless rename away from
-- dropping it too. conkey is the column set the constraint is actually attached
-- to, so it cannot match the wrong one.

DO $$
DECLARE
  _table text;
  _constraint text;
BEGIN
  FOREACH _table IN ARRAY ARRAY[
    'content_proposals', 'content_calendar', 'social_accounts', 'social_publications'
  ] LOOP
    FOR _constraint IN
      SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid
         AND att.attnum = ANY (con.conkey)
       WHERE con.conrelid = format('public.%I', _table)::regclass
         AND con.contype = 'c'
         AND att.attname = 'platform'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', _table, _constraint);
    END LOOP;
  END LOOP;
END $$;

-- ── Re-add them, named, with the wider vocabulary ────────────────────────────
--
-- Two vocabularies, deliberately different:
--
--   content_proposals / content_calendar  - everything Visionex can plan for,
--     including `website` and `newsletter`, which Visionex publishes itself and
--     which have no external identity to connect.
--
--   social_accounts / social_publications - only platforms with an external
--     identity. `website` and `newsletter` must stay out: an account row for
--     them would make claim_due_content_slot() consider a slot Visionex has no
--     external account for, and there is nothing to authenticate against.
--
-- Named this time, so the next migration to touch them finds them by name.

ALTER TABLE public.content_proposals
  ADD CONSTRAINT content_proposals_platform_check
  CHECK (platform IN (
    'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'x', 'linkedin',
    'website', 'newsletter'));

ALTER TABLE public.content_calendar
  ADD CONSTRAINT content_calendar_platform_check
  CHECK (platform IN (
    'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'x', 'linkedin',
    'website', 'newsletter'));

ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_platform_check
  CHECK (platform IN (
    'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'x', 'linkedin'));

ALTER TABLE public.social_publications
  ADD CONSTRAINT social_publications_platform_check
  CHECK (platform IN (
    'facebook', 'instagram', 'threads', 'tiktok', 'youtube', 'x', 'linkedin'));

COMMENT ON CONSTRAINT social_accounts_platform_check ON public.social_accounts IS
  'The seven platforms Visionex has, or will have, an external identity on. website and newsletter are excluded on purpose: Visionex publishes those itself and there is no account to authenticate.';

-- No seed rows, and no LinkedIn connection. Naming a platform is not connecting
-- to it, and this migration draws that line where Phase 8 drew it.
