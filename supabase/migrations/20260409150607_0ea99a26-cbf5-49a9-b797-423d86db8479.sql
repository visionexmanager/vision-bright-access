
-- Create voice_rooms table
CREATE TABLE public.voice_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  room_name TEXT NOT NULL DEFAULT 'My Room',
  room_type TEXT NOT NULL DEFAULT 'mini',
  max_users INTEGER NOT NULL DEFAULT 4,
  cost_vx INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.voice_rooms ENABLE ROW LEVEL SECURITY;

-- Anyone can view active rooms
CREATE POLICY "Anyone can view active voice rooms"
ON public.voice_rooms
FOR SELECT
TO public
USING (is_active = true);

-- Authenticated users can create their own rooms
CREATE POLICY "Users can create their own voice rooms"
ON public.voice_rooms
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Owners can update their own rooms
CREATE POLICY "Owners can update their own voice rooms"
ON public.voice_rooms
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Owners can delete their own rooms
CREATE POLICY "Owners can delete their own voice rooms"
ON public.voice_rooms
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Admins can manage all rooms
CREATE POLICY "Admins can manage all voice rooms"
ON public.voice_rooms
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at
CREATE TRIGGER update_voice_rooms_updated_at
BEFORE UPDATE ON public.voice_rooms
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
