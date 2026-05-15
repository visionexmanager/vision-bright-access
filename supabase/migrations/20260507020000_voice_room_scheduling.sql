
-- Add scheduled_at to voice_rooms
ALTER TABLE public.voice_rooms
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Update SELECT policy so that upcoming scheduled default rooms are visible to
-- all users (they show as a countdown card before the room opens).
DROP POLICY IF EXISTS "Anyone can view active voice rooms" ON public.voice_rooms;

CREATE POLICY "Anyone can view active or upcoming default rooms"
ON public.voice_rooms
FOR SELECT
TO public
USING (
  is_active = true
  OR (is_default = true AND scheduled_at IS NOT NULL)
);

-- pg_cron: auto-activate default rooms when their scheduled time arrives.
-- Runs every minute; no-op if no rooms are due.
SELECT cron.schedule(
  'activate-scheduled-voice-rooms',
  '* * * * *',
  $$
    UPDATE public.voice_rooms
    SET    is_active    = true,
           scheduled_at = NULL
    WHERE  is_default   = true
      AND  is_active    = false
      AND  scheduled_at IS NOT NULL
      AND  scheduled_at <= now();
  $$
);
