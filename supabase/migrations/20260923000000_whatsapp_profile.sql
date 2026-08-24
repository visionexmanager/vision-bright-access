-- The WhatsApp profile: who the sender is, asked once, on their first visit.
--
-- ── Why these columns and not a new table ───────────────────────────────────
--
-- `whatsapp_conversations` is already one row per phone number, already unique
-- on it, already service-role only, and already the row the webhook loads on
-- every single message. A second table keyed on the same phone number would be
-- a second round trip and a new way for the two to disagree about one person.
-- This is the same argument the navigation-state migration made, and it holds
-- for the same reason.
--
-- `public.profiles` was considered and is the wrong home: it is keyed on
-- `auth.users`, and a WhatsApp sender has no Visionex account to key against.
-- Linking them would mean either inventing an auth user per phone number or
-- making `profiles.user_id` nullable for the whole site. Nothing in the schema
-- keys an identity on a phone number, so `wa_phone` stays the canonical
-- WhatsApp identity and no row is duplicated anywhere.
--
-- ── The phone number is not one of these columns ────────────────────────────
--
-- It is `wa_phone`, and it was already here. It arrives inside the webhook
-- envelope Meta signs, so it is the one field on this row that was never typed
-- by anybody. Nothing asks the sender for it, and nothing accepts a typed one:
-- a number somebody types can name a different person, and a profile attached
-- to the wrong person is worse than no profile at all.
--
-- ── Established senders are not new ─────────────────────────────────────────
--
-- Every row that exists before this migration belongs to somebody who has been
-- using the assistant for months. They are backfilled to `complete` — not put
-- through onboarding, which would be this release interrogating its own
-- long-standing users. Only rows created after this point start at the
-- beginning, and that is the column default doing it.
--
-- Additive and idempotent throughout: no column is dropped, no data is
-- rewritten, and every statement can run twice. Conversations, transcripts and
-- AI threads are untouched.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS full_name          text,
  ADD COLUMN IF NOT EXISTS date_of_birth      date,
  ADD COLUMN IF NOT EXISTS gender             text,
  ADD COLUMN IF NOT EXISTS email              text,
  -- ISO 3166-1 alpha-2. Never a display name: a name is a translation, and a
  -- row reading 'Türkiye' after a locale update is a row that has quietly lost
  -- its country.
  ADD COLUMN IF NOT EXISTS country            char(2),
  ADD COLUMN IF NOT EXISTS onboarding_status  text,
  ADD COLUMN IF NOT EXISTS profile_updated_at timestamptz;

-- A closed set, checked in the database as well as in the application: a
-- typo'd value would otherwise sit in the column looking like a real answer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_conversations'::regclass
      AND conname = 'whatsapp_conversations_gender_check'
  ) THEN
    ALTER TABLE public.whatsapp_conversations
      ADD CONSTRAINT whatsapp_conversations_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female', 'other', 'undisclosed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.whatsapp_conversations'::regclass
      AND conname = 'whatsapp_conversations_onboarding_status_check'
  ) THEN
    ALTER TABLE public.whatsapp_conversations
      ADD CONSTRAINT whatsapp_conversations_onboarding_status_check
      CHECK (onboarding_status IS NULL OR onboarding_status IN (
        'language_selection',
        'profile_name',
        'profile_birth_date',
        'profile_gender',
        'profile_email',
        'profile_country',
        'complete'
      ));
  END IF;
END $$;

-- Everyone who was already here has finished. Runs once; a second run matches
-- no rows because none are left null.
UPDATE public.whatsapp_conversations
   SET onboarding_status = 'complete'
 WHERE onboarding_status IS NULL;

-- Applied after the backfill, so it governs new rows only.
ALTER TABLE public.whatsapp_conversations
  ALTER COLUMN onboarding_status SET DEFAULT 'language_selection';

COMMENT ON COLUMN public.whatsapp_conversations.full_name IS
  'The name the sender gave on their first visit. Used to address them; never sent to a model beyond the first name.';

COMMENT ON COLUMN public.whatsapp_conversations.date_of_birth IS
  'Stored as a date, normalised from whatever form the sender wrote. Not included in any model prompt.';

COMMENT ON COLUMN public.whatsapp_conversations.gender IS
  'How the sender asked to be referred to. One of male, female, other, undisclosed. Not included in any model prompt.';

COMMENT ON COLUMN public.whatsapp_conversations.email IS
  'Lowercased. Not included in any model prompt, and never written to a log.';

COMMENT ON COLUMN public.whatsapp_conversations.country IS
  'ISO 3166-1 alpha-2. The only country form ever persisted; display names come from the runtime per language.';

COMMENT ON COLUMN public.whatsapp_conversations.onboarding_status IS
  'Where the sender is in first-time onboarding. Rows that predate this column were backfilled to complete: they are established senders, not new ones.';

COMMENT ON COLUMN public.whatsapp_conversations.profile_updated_at IS
  'Last time a profile field was written. Separate from last_message_at, which moves on every message.';

-- The queue of people who started and stopped, so an abandoned onboarding is
-- visible rather than silent. Partial, so it stays small: a finished profile
-- has nothing to follow up.
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_onboarding
  ON public.whatsapp_conversations (onboarding_status, last_message_at)
  WHERE onboarding_status IS DISTINCT FROM 'complete';
