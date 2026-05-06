
-- Add privacy flag and per-join cost to voice_rooms
ALTER TABLE public.voice_rooms
  ADD COLUMN IF NOT EXISTS is_private   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS join_cost_vx INTEGER NOT NULL DEFAULT 0;
