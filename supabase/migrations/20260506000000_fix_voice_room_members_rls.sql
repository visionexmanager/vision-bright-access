
-- Fix infinite recursion in voice_room_members RLS policy.
-- The previous policy queried voice_room_members from within a voice_room_members policy,
-- causing PostgreSQL to detect infinite recursion.
-- Solution: use a SECURITY DEFINER function that bypasses RLS when fetching room IDs.

CREATE OR REPLACE FUNCTION public.get_my_voice_room_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT room_id FROM public.voice_room_members WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "Users can view members of their rooms" ON public.voice_room_members;
DROP POLICY IF EXISTS "Authenticated users can view room members" ON public.voice_room_members;
DROP POLICY IF EXISTS "Anyone can view room members" ON public.voice_room_members;

CREATE POLICY "Users can view members of their rooms"
ON public.voice_room_members
FOR SELECT
TO authenticated
USING (room_id IN (SELECT public.get_my_voice_room_ids()));
