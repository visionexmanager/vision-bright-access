-- WhatsApp assistant: the last place a sender shared, held briefly.
--
-- WhatsApp's location attachment is the cheapest precise input this channel
-- has for a blind sender — 📎 → Location, two taps, no typing and no camera to
-- aim — and until now the webhook answered one with "I can't read that kind of
-- message (location) yet".
--
-- Answering a pin needs no storage. Answering the *next* question does: "and
-- what's the weather?" five minutes later should not require a second pin, and
-- asking for one is precisely the interaction this audience finds hardest.
--
-- Three things make holding a coordinate defensible here.
--
--   1. It is short-lived by construction. The webhook ignores anything older
--      than six hours (LOCATION_TTL_MS in whatsappLocation.ts), so a stale pin
--      can never answer today's question from yesterday's town. A wrong
--      location is worse than none: it is confidently wrong about the one
--      thing the sender could not verify for themselves.
--   2. It is erasable on a schedule, by the function below, independently of
--      the transcript retention job — because six hours of usefulness does not
--      justify ninety days of storage.
--   3. It is on the conversation row, not a history table. There is exactly one
--      current location, and keeping a trail of where somebody has been is a
--      different product with a different consent conversation attached.
--
-- RLS is unchanged and already correct: whatsapp_conversations is service-role
-- write and admin-only read, so these columns inherit that. No new policy.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS last_latitude double precision,
  ADD COLUMN IF NOT EXISTS last_longitude double precision,
  -- The place in words, as the sender would hear it. Cached so a follow-up
  -- question costs no second reverse-geocode round trip.
  ADD COLUMN IF NOT EXISTS last_place text,
  ADD COLUMN IF NOT EXISTS last_location_at timestamptz;

-- Coordinates that cannot exist are a broken payload, not a place. The check
-- is NOT VALID so it applies to new writes without scanning or rejecting any
-- row already present — the columns are new, so in practice there are none.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'whatsapp_conversations_last_location_range'
      AND conrelid = 'public.whatsapp_conversations'::regclass
  ) THEN
    ALTER TABLE public.whatsapp_conversations
      ADD CONSTRAINT whatsapp_conversations_last_location_range
      CHECK (
        (last_latitude IS NULL AND last_longitude IS NULL)
        OR (
          last_latitude BETWEEN -90 AND 90
          AND last_longitude BETWEEN -180 AND 180
        )
      ) NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.whatsapp_conversations.last_latitude IS
  'Latitude of the last pin the sender shared. Used for at most six hours (LOCATION_TTL_MS) and cleared by whatsapp_forget_locations. Never a location history — one row, overwritten.';

COMMENT ON COLUMN public.whatsapp_conversations.last_place IS
  'The last shared location in words, in the sender''s language, cached so a follow-up question needs no second reverse-geocode call.';

COMMENT ON COLUMN public.whatsapp_conversations.last_location_at IS
  'When the pin arrived. The webhook treats anything older than six hours as absent, because a stale location answers confidently about the wrong place.';

-- ── Erasure ─────────────────────────────────────────────────────────────
--
-- Separate from whatsapp_prune_transcripts rather than folded into it. That
-- function's contract is "delete old messages, keep the conversation and its
-- summary", and it runs on a 90-day horizon; a coordinate that stops being
-- useful after six hours has no business waiting three months for the same
-- broom. Different data, different clock, different function.
CREATE OR REPLACE FUNCTION public.whatsapp_forget_locations(_hours integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleared integer;
BEGIN
  IF _hours < 1 THEN
    RAISE EXCEPTION 'retention floor is 1 hour, got %', _hours;
  END IF;

  WITH gone AS (
    UPDATE public.whatsapp_conversations
    SET last_latitude = NULL,
        last_longitude = NULL,
        last_place = NULL,
        last_location_at = NULL
    WHERE last_location_at IS NOT NULL
      AND last_location_at < now() - make_interval(hours => _hours)
    RETURNING 1
  )
  SELECT count(*) INTO cleared FROM gone;

  RETURN cleared;
END;
$$;

-- Service role only. A sender's whereabouts is not something an authenticated
-- caller of any other kind should be able to read, write or erase.
REVOKE ALL ON FUNCTION public.whatsapp_forget_locations(integer) FROM public;
REVOKE ALL ON FUNCTION public.whatsapp_forget_locations(integer) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_forget_locations(integer) FROM authenticated;

COMMENT ON FUNCTION public.whatsapp_forget_locations(integer) IS
  'Clears cached WhatsApp locations older than _hours (minimum 1). Service role only. Separate from whatsapp_prune_transcripts: a six-hour-useful coordinate should not wait on a ninety-day retention clock.';

-- SCHEDULED. Left as a comment on the same mistaken premise as the transcript
-- prune (see 20260916020000): pg_cron is installed on this project by
-- 20260808000000_library_enable_pg_cron.sql, and
-- 20260927000000_whatsapp_retention_schedule.sql registers this job for real as
--   whatsapp-forget-locations, hourly at :15, six hours — not the twenty-four
--   suggested here, because six is the TTL the read path already enforces.
