
-- Allow system-seeded default rooms to have no owner
ALTER TABLE public.voice_rooms ALTER COLUMN owner_id DROP NOT NULL;

-- Flag to distinguish admin-managed default rooms from user-created rooms
ALTER TABLE public.voice_rooms
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Seed the three default rooms (inactive until an admin activates them).
-- join_cost_vx=5 keeps the same economics as before.
INSERT INTO public.voice_rooms
  (id, owner_id, room_name, room_type, max_users, cost_vx, join_cost_vx, is_private, is_active, is_default)
VALUES
  ('00000000-0000-4000-a000-000000000001', NULL, 'Main Hall',        'event', 999, 0, 5, false, false, true),
  ('00000000-0000-4000-a000-000000000002', NULL, 'Tech Support',     'event', 999, 0, 5, false, false, true),
  ('00000000-0000-4000-a000-000000000003', NULL, 'Trade & Commerce', 'event', 999, 0, 5, false, false, true)
ON CONFLICT (id) DO UPDATE SET
  is_default   = true,
  owner_id     = NULL,
  is_active    = EXCLUDED.is_active;

-- Allow admins to see inactive rooms (needed for the admin toggle panel).
-- The existing "Admins can manage all voice rooms" FOR ALL policy already covers
-- SELECT for admins, but the public SELECT policy filters is_active=true.
-- Postgres evaluates permissive policies with OR, so admins already bypass it.
-- No extra policy needed — just documenting why.

-- Owners can update their own rooms (existing policy stays).
-- Admins can update default rooms via the existing admin FOR ALL policy.
