
-- Voice room members table
CREATE TABLE public.voice_room_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);

ALTER TABLE public.voice_room_members ENABLE ROW LEVEL SECURITY;

-- Anyone can see who is in a room
CREATE POLICY "Anyone can view room members"
ON public.voice_room_members
FOR SELECT
TO public
USING (true);

-- Authenticated users can join rooms (insert themselves only)
CREATE POLICY "Users can join rooms"
ON public.voice_room_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can leave rooms (delete themselves only)
CREATE POLICY "Users can leave rooms"
ON public.voice_room_members
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for live member counts
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_members;
