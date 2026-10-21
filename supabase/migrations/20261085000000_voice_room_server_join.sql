-- Voice rooms: the password, the price and the capacity are decided by the server.
--
-- Until now they lived in the browser. voice_rooms.room_password was plain text, readable by anon
-- and signed-in users alike (the room is public while active) and compared in the page; join_cost_vx
-- was charged by the page; max_users was only used to grey out a button; and membership is a row any
-- signed-in user may insert for themselves, so it proved nothing. A direct call to livekit-token
-- skipped all three.
--
-- This migration:
--   1. Stops storing the password in the room row. A trigger hashes whatever a room owner writes to
--      room_password (bcrypt, per-password salt) into voice_room_secrets, blanks the column, and keeps
--      a readable has_password flag so the page can still ask for one. The owner's write path is
--      unchanged; nothing about the column can be read back.
--   2. Adds voice_room_join(): one function, called only by livekit-token with the service role, that
--      under a lock on the room row checks the password (with a failed-attempt throttle), the capacity
--      (members with a recent heartbeat), and charges the join price once per user and room, then
--      records the membership. Owners and admins pass without a password, price or capacity.
--
-- It sets no limit and no price, creates no room, and changes no plan, price or balance. Existing
-- plain-text passwords (production has none: 0 rooms) are hashed in place and blanked.
--
-- Rollback (no data to restore beyond the hashes): DROP FUNCTION public.voice_room_join(uuid, uuid, text, text, boolean, boolean);
-- DROP TRIGGER voice_rooms_protect_password ON public.voice_rooms; DROP TRIGGER kids_voice_rooms_protect_password
-- ON public.kids_voice_rooms; the three new tables can be dropped. A password already blanked cannot be
-- recovered (by design); owners would set it again.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.voice_rooms      ADD COLUMN IF NOT EXISTS has_password boolean NOT NULL DEFAULT false;
ALTER TABLE public.kids_voice_rooms ADD COLUMN IF NOT EXISTS has_password boolean NOT NULL DEFAULT false;

-- ── Server-only tables: no policy, no grant to anon or authenticated ──────────────────────────
CREATE TABLE IF NOT EXISTS public.voice_room_secrets (
  kind          text        NOT NULL CHECK (kind IN ('adult', 'kids')),
  room_id       uuid        NOT NULL,
  password_hash text        NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, room_id)
);

-- One row per user and room once they are in: what they paid and which password they gave.
-- A changed password has a new stamp, so a member must give the new one.
CREATE TABLE IF NOT EXISTS public.voice_room_joins (
  room_id        uuid        NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paid_vx        integer     NOT NULL DEFAULT 0 CHECK (paid_vx >= 0),
  password_stamp text,
  first_joined_at timestamptz NOT NULL DEFAULT now(),
  last_joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);

-- Wrong-password attempts, only to throttle guessing. Holds no password and no text.
CREATE TABLE IF NOT EXISTS public.voice_room_join_failures (
  id      bigserial   PRIMARY KEY,
  kind    text        NOT NULL,
  room_id uuid        NOT NULL,
  user_id uuid        NOT NULL,
  at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS voice_room_join_failures_room_idx ON public.voice_room_join_failures (kind, room_id, at);

ALTER TABLE public.voice_room_secrets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_room_joins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_room_join_failures  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.voice_room_secrets, public.voice_room_joins, public.voice_room_join_failures FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.voice_room_secrets, public.voice_room_joins, public.voice_room_join_failures TO service_role;
REVOKE ALL ON SEQUENCE public.voice_room_join_failures_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.voice_room_join_failures_id_seq TO service_role;

-- ── The password never stays in the room row ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.voice_room_protect_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _kind text := TG_ARGV[0];
  _pw   text := NEW.room_password;
BEGIN
  IF _pw IS NULL OR btrim(_pw) = '' THEN
    DELETE FROM public.voice_room_secrets WHERE kind = _kind AND room_id = NEW.id;
    NEW.has_password := false;
  ELSE
    INSERT INTO public.voice_room_secrets (kind, room_id, password_hash, updated_at)
    VALUES (_kind, NEW.id, crypt(_pw, gen_salt('bf', 8)), now())
    ON CONFLICT (kind, room_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();
    NEW.has_password := true;
  END IF;
  NEW.room_password := NULL;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.voice_room_drop_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.voice_room_secrets WHERE kind = TG_ARGV[0] AND room_id = OLD.id;
  DELETE FROM public.voice_room_join_failures WHERE kind = TG_ARGV[0] AND room_id = OLD.id;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.voice_room_protect_password() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.voice_room_drop_secret() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS voice_rooms_protect_password ON public.voice_rooms;
CREATE TRIGGER voice_rooms_protect_password
  BEFORE INSERT OR UPDATE OF room_password ON public.voice_rooms
  FOR EACH ROW EXECUTE FUNCTION public.voice_room_protect_password('adult');
DROP TRIGGER IF EXISTS kids_voice_rooms_protect_password ON public.kids_voice_rooms;
CREATE TRIGGER kids_voice_rooms_protect_password
  BEFORE INSERT OR UPDATE OF room_password ON public.kids_voice_rooms
  FOR EACH ROW EXECUTE FUNCTION public.voice_room_protect_password('kids');
DROP TRIGGER IF EXISTS voice_rooms_drop_secret ON public.voice_rooms;
CREATE TRIGGER voice_rooms_drop_secret AFTER DELETE ON public.voice_rooms
  FOR EACH ROW EXECUTE FUNCTION public.voice_room_drop_secret('adult');
DROP TRIGGER IF EXISTS kids_voice_rooms_drop_secret ON public.kids_voice_rooms;
CREATE TRIGGER kids_voice_rooms_drop_secret AFTER DELETE ON public.kids_voice_rooms
  FOR EACH ROW EXECUTE FUNCTION public.voice_room_drop_secret('kids');

-- Hash any password that is still stored in plain text (the UPDATE OF room_password trigger does it).
UPDATE public.voice_rooms      SET room_password = room_password WHERE room_password IS NOT NULL;
UPDATE public.kids_voice_rooms SET room_password = room_password WHERE room_password IS NOT NULL;

-- ── The join ─────────────────────────────────────────────────────────────────────────────────
-- Called by livekit-token with the service role only. Takes the room row lock, so two people
-- joining the last seat, or one person joining twice, are decided one after the other.
-- Reasons: room_not_found, password_required, wrong_password, too_many_attempts, room_full,
-- insufficient_vx, invalid.
--
-- A member counts toward capacity while their heartbeat is under 90 seconds old (the page beats
-- every 30 seconds); a user already in the room never counts against themselves.
CREATE OR REPLACE FUNCTION public.voice_room_join(
  _user_id  uuid,
  _room_id  uuid,
  _kind     text,
  _password text,
  _listener boolean DEFAULT false,
  _is_admin boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _owner      uuid;
  _max        integer;
  _cost       integer := 0;
  _active     boolean;
  _name       text;
  _hash       text;
  _stamp      text;
  _led        public.voice_room_joins%ROWTYPE;
  _have_led   boolean := false;
  _members    integer;
  _balance    bigint;
  _own_fail   integer;
  _room_fail  integer;
  _charged    integer := 0;
  _window     constant interval := interval '10 minutes';
BEGIN
  IF _user_id IS NULL OR _room_id IS NULL OR _kind IS NULL OR _kind NOT IN ('adult', 'kids') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid');
  END IF;

  IF _kind = 'adult' THEN
    SELECT owner_id, max_users, COALESCE(join_cost_vx, 0), is_active, room_name
      INTO _owner, _max, _cost, _active, _name
      FROM public.voice_rooms WHERE id = _room_id FOR UPDATE;
  ELSE
    SELECT owner_id, max_users, 0, (status IN ('scheduled', 'live')), room_name
      INTO _owner, _max, _cost, _active, _name
      FROM public.kids_voice_rooms WHERE id = _room_id FOR UPDATE;
  END IF;
  IF NOT FOUND OR NOT COALESCE(_active, false) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'room_not_found');
  END IF;

  -- The owner and an admin are always let in, with no password, price or capacity.
  IF _owner = _user_id OR COALESCE(_is_admin, false) THEN
    IF _kind = 'adult' THEN
      INSERT INTO public.voice_room_members (room_id, user_id, raise_hand, is_listener, last_seen_at)
      VALUES (_room_id, _user_id, false, COALESCE(_listener, false), now())
      ON CONFLICT (room_id, user_id) DO UPDATE SET raise_hand = false, is_listener = EXCLUDED.is_listener, last_seen_at = now();
    END IF;
    RETURN jsonb_build_object('allowed', true, 'charged', 0);
  END IF;

  SELECT password_hash INTO _hash FROM public.voice_room_secrets WHERE kind = _kind AND room_id = _room_id;
  _stamp := CASE WHEN _hash IS NULL THEN NULL ELSE md5(_hash) END;
  IF _kind = 'adult' THEN
    SELECT * INTO _led FROM public.voice_room_joins WHERE room_id = _room_id AND user_id = _user_id;
    _have_led := FOUND;
  END IF;

  -- Password: not needed when the user already gave the current one.
  IF _hash IS NOT NULL AND NOT (_have_led AND _led.password_stamp IS NOT DISTINCT FROM _stamp) THEN
    IF _password IS NULL OR _password = '' THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'password_required');
    END IF;
    DELETE FROM public.voice_room_join_failures WHERE at < now() - interval '1 hour';
    SELECT count(*) FILTER (WHERE user_id = _user_id), count(*)
      INTO _own_fail, _room_fail
      FROM public.voice_room_join_failures
     WHERE kind = _kind AND room_id = _room_id AND at > now() - _window;
    IF _own_fail >= 5 OR _room_fail >= 50 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'too_many_attempts');
    END IF;
    IF crypt(_password, _hash) <> _hash THEN
      INSERT INTO public.voice_room_join_failures (kind, room_id, user_id) VALUES (_kind, _room_id, _user_id);
      RETURN jsonb_build_object('allowed', false, 'reason', 'wrong_password');
    END IF;
  END IF;

  IF _kind = 'adult' THEN
    -- Capacity: 999 or more (the page's "no limit") and NULL mean unlimited.
    IF _max IS NOT NULL AND _max < 999 THEN
      SELECT count(*) INTO _members FROM public.voice_room_members
       WHERE room_id = _room_id AND user_id <> _user_id AND last_seen_at > now() - interval '90 seconds';
      IF _members >= _max THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'room_full');
      END IF;
    END IF;

    -- Price: charged once per user and room, with the same two rows spend_vx writes.
    IF _cost > 0 AND NOT _have_led THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('vx_spend:' || _user_id::text, 0));
      SELECT COALESCE(SUM(points), 0) INTO _balance FROM public.user_points WHERE user_id = _user_id;
      IF _balance < _cost THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'insufficient_vx', 'needed', _cost);
      END IF;
      INSERT INTO public.user_points (user_id, points, reason) VALUES (_user_id, -_cost, 'VX Purchase: ' || COALESCE(_name, 'voice room'));
      INSERT INTO public.vx_purchases (user_id, amount, item_type, item_id, item_name)
      VALUES (_user_id, _cost, 'voice_room_join', _room_id::text, COALESCE(_name, 'voice room'));
      _charged := _cost;
    END IF;

    INSERT INTO public.voice_room_joins (room_id, user_id, paid_vx, password_stamp)
    VALUES (_room_id, _user_id, _charged, _stamp)
    ON CONFLICT (room_id, user_id) DO UPDATE
      SET paid_vx = voice_room_joins.paid_vx + EXCLUDED.paid_vx, password_stamp = EXCLUDED.password_stamp, last_joined_at = now();

    INSERT INTO public.voice_room_members (room_id, user_id, raise_hand, is_listener, last_seen_at)
    VALUES (_room_id, _user_id, false, COALESCE(_listener, false), now())
    ON CONFLICT (room_id, user_id) DO UPDATE SET raise_hand = false, is_listener = EXCLUDED.is_listener, last_seen_at = now();
  END IF;

  RETURN jsonb_build_object('allowed', true, 'charged', _charged);
END;
$$;

COMMENT ON FUNCTION public.voice_room_join(uuid, uuid, text, text, boolean, boolean) IS
  'Server-side voice room join: password (hashed, throttled), capacity (recent heartbeats), join price (once per user and room), membership. Service role only.';

REVOKE ALL ON FUNCTION public.voice_room_join(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.voice_room_join(uuid, uuid, text, text, boolean, boolean) TO service_role;
