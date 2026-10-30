-- Peer-to-peer moves for two-player games.
--
-- Moves now travel over a WebRTC data channel between the players' devices;
-- the row only carries the connection handshake (rtc_signal, written twice per
-- game) and a checkpoint of the game. p2p_seq says how many moves the
-- checkpoint includes, so a late row update can never rewind a newer local
-- state. Both columns sit under the existing participant-only RLS.

ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS rtc_signal jsonb,
  ADD COLUMN IF NOT EXISTS p2p_seq integer NOT NULL DEFAULT 0;
