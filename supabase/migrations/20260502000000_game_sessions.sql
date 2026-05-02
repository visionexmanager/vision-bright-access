-- Game sessions table for online multiplayer
CREATE TABLE IF NOT EXISTS game_sessions (
  id          text        PRIMARY KEY,
  game_type   text        NOT NULL,
  host_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  status      text        NOT NULL DEFAULT 'waiting',
  max_players int         NOT NULL DEFAULT 2,
  players     jsonb       NOT NULL DEFAULT '[]',
  game_state  jsonb,
  current_player_id uuid,
  winner_id   uuid,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  expires_at  timestamptz DEFAULT (now() + interval '2 hours')
);

ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gs_select" ON game_sessions FOR SELECT TO authenticated
  USING (
    status = 'waiting' OR host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(players) p WHERE (p->>'id') = auth.uid()::text)
  );

CREATE POLICY "gs_insert" ON game_sessions FOR INSERT TO authenticated
  WITH CHECK (host_id = auth.uid());

CREATE POLICY "gs_update" ON game_sessions FOR UPDATE TO authenticated
  USING (
    host_id = auth.uid()
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(players) p WHERE (p->>'id') = auth.uid()::text)
  );

CREATE POLICY "gs_delete" ON game_sessions FOR DELETE TO authenticated
  USING (host_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;

CREATE OR REPLACE FUNCTION update_game_session_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_gs_ts BEFORE UPDATE ON game_sessions
  FOR EACH ROW EXECUTE FUNCTION update_game_session_ts();
