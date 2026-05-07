
-- Add room topic to voice_rooms
ALTER TABLE public.voice_rooms
  ADD COLUMN IF NOT EXISTS room_topic TEXT;

-- Create voice_room_bans table
CREATE TABLE IF NOT EXISTS public.voice_room_bans (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID        NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

ALTER TABLE public.voice_room_bans ENABLE ROW LEVEL SECURITY;

-- Room owner can insert bans
CREATE POLICY "Room owners can ban users"
ON public.voice_room_bans FOR INSERT
TO authenticated
WITH CHECK (
  banned_by = auth.uid() AND
  EXISTS (SELECT 1 FROM public.voice_rooms WHERE id = room_id AND owner_id = auth.uid())
);

-- Room owner can remove bans
CREATE POLICY "Room owners can remove bans"
ON public.voice_room_bans FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.voice_rooms WHERE id = room_id AND owner_id = auth.uid())
);

-- Users can check their own ban status; owners can see who they banned
CREATE POLICY "Users can view their own bans"
ON public.voice_room_bans FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR banned_by = auth.uid());
