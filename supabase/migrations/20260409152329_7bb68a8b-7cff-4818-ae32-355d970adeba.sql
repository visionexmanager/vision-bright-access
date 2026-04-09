
-- Insert default public rooms with fixed UUIDs
INSERT INTO public.voice_rooms (id, owner_id, room_name, room_type, max_users, cost_vx, is_active)
VALUES
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'Main Hall', 'public', 999, 0, true),
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'Tech Support', 'public', 999, 0, true),
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'Trade & Commerce', 'public', 999, 0, true)
ON CONFLICT (id) DO NOTHING;
