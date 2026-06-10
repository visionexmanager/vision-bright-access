-- Add per-room permission flags so the owner can control what participants can do
ALTER TABLE public.voice_rooms
  ADD COLUMN IF NOT EXISTS allow_camera       boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS allow_mic          boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS allow_chat         boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS allow_screen_share boolean DEFAULT true NOT NULL;
