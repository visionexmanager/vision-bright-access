-- A monthly allowance of realtime voice minutes, per plan, owner-configurable.
--
-- Why it exists: a realtime voice session runs between the browser and OpenAI
-- over WebRTC, so the server never sees its tokens, and the only thing
-- `realtime-session` could limit was how many sessions a user may *start*
-- (10 a day, `check_ai_rate_limit`). A session had no length limit and the
-- minutes are billed by OpenAI (about $0.10 a minute), so one subscriber could
-- cost more than their plan pays.
--
-- What it does: before a session is minted the server reserves up to
-- `realtime_session_minutes` (default 10) from the user's month, refuses once
-- the month is spent, and records the reservation. When the client reports the
-- end of the session the reservation is shrunk to the wall-clock time that
-- really passed. The client's own number is never trusted: ending early only
-- refunds what the server's clock says was unused, and a session that is never
-- reported stays charged in full.
--
-- The setting lives where the other per-plan limits live,
-- `billing_plans.limits`:
--   realtime_monthly_minutes  integer   absent/NULL = no cap (today's behaviour)
--                                       0 = no realtime voice on this plan
--   realtime_session_minutes  integer   absent = 10; longest single session
--
-- This migration sets NO value, so applying it changes nothing for anybody. The
-- owner turns the cap on per plan, e.g.
--   UPDATE billing_plans
--      SET limits = limits || '{"realtime_monthly_minutes": 20}'::jsonb
--    WHERE id = 'pro';
-- and turns it off again by removing the key:
--   UPDATE billing_plans SET limits = limits - 'realtime_monthly_minutes' WHERE id = 'pro';
--
-- What it cannot do: end a session that is already running. A modified client
-- can ignore the timer the app sets and keep talking until OpenAI's own limit.
-- The cap bounds what the server will *hand out*; a hard cut-off needs a relay
-- in the media path, which this platform does not have.

CREATE TABLE IF NOT EXISTS public.realtime_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at       timestamptz NOT NULL DEFAULT now(),
  reserved_minutes integer NOT NULL CHECK (reserved_minutes > 0),
  ended_at         timestamptz,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX IF NOT EXISTS realtime_sessions_user_month_idx
  ON public.realtime_sessions (user_id, started_at);

ALTER TABLE public.realtime_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.realtime_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.realtime_sessions TO service_role;

-- Minutes a session counts for: the reservation until it is ended, then the
-- wall-clock time between start and end, rounded up to a minute and never more
-- than was reserved.
CREATE OR REPLACE FUNCTION public.realtime_session_minutes_used(_reserved integer, _started timestamptz, _ended timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _ended IS NULL THEN _reserved
    ELSE LEAST(_reserved, CEIL(GREATEST(0, EXTRACT(EPOCH FROM (_ended - _started))) / 60.0)::integer)
  END
$$;

CREATE OR REPLACE FUNCTION public.realtime_reserve(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _plan      text;
  _limits    jsonb;
  _cap       integer;
  _session   integer;
  _used      integer;
  _remaining integer;
  _reserve   integer;
  _month     timestamptz := date_trunc('month', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc';
  _id        uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_user');
  END IF;

  -- One reservation at a time per user: two parallel requests must not both
  -- read the same remaining balance.
  PERFORM pg_advisory_xact_lock(hashtextextended('realtime_reserve:' || _user_id::text, 0));

  _plan := public.plan_for_user(_user_id);
  IF _plan = 'admin' THEN
    RETURN jsonb_build_object('allowed', true, 'capped', false);
  END IF;

  SELECT p.limits INTO _limits FROM public.billing_plans p WHERE p.id = _plan AND p.is_active;
  _cap := CASE WHEN jsonb_typeof(_limits -> 'realtime_monthly_minutes') = 'number'
               THEN (_limits ->> 'realtime_monthly_minutes')::integer END;

  IF _cap IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'capped', false);
  END IF;

  _session := COALESCE(
    CASE WHEN jsonb_typeof(_limits -> 'realtime_session_minutes') = 'number'
         THEN (_limits ->> 'realtime_session_minutes')::integer END,
    10);
  IF _session < 1 THEN _session := 10; END IF;

  SELECT COALESCE(SUM(public.realtime_session_minutes_used(reserved_minutes, started_at, ended_at)), 0)
    INTO _used
    FROM public.realtime_sessions
   WHERE user_id = _user_id AND started_at >= _month;

  _remaining := GREATEST(0, _cap - _used);
  IF _remaining <= 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'monthly_limit', 'capped', true,
                              'limit_minutes', _cap, 'remaining_minutes', 0);
  END IF;

  _reserve := LEAST(_session, _remaining);
  INSERT INTO public.realtime_sessions (user_id, reserved_minutes)
  VALUES (_user_id, _reserve)
  RETURNING id INTO _id;

  RETURN jsonb_build_object('allowed', true, 'capped', true, 'reservation_id', _id,
                            'reserved_minutes', _reserve, 'limit_minutes', _cap,
                            'remaining_minutes', _remaining - _reserve);
END;
$$;

-- Ends a reservation. `_failed` is for a session that never started (the
-- provider refused): it costs nothing. Idempotent, and only the owner's row.
CREATE OR REPLACE FUNCTION public.realtime_end(_user_id uuid, _reservation_id uuid, _failed boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.realtime_sessions%ROWTYPE;
BEGIN
  UPDATE public.realtime_sessions
     SET ended_at = CASE WHEN _failed THEN started_at ELSE now() END
   WHERE id = _reservation_id AND user_id = _user_id AND ended_at IS NULL
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ended', false);
  END IF;
  RETURN jsonb_build_object('ended', true,
    'minutes', public.realtime_session_minutes_used(_row.reserved_minutes, _row.started_at, _row.ended_at));
END;
$$;

COMMENT ON FUNCTION public.realtime_reserve(uuid) IS
  'Reserve realtime voice minutes from the user''s month before a session is minted. No cap configured (billing_plans.limits.realtime_monthly_minutes absent) = allowed, nothing recorded.';
COMMENT ON FUNCTION public.realtime_end(uuid, uuid, boolean) IS
  'Shrink a reservation to the wall-clock time that passed. The client''s own duration is not an input.';

REVOKE ALL ON FUNCTION public.realtime_session_minutes_used(integer, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.realtime_reserve(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.realtime_end(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.realtime_session_minutes_used(integer, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.realtime_reserve(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.realtime_end(uuid, uuid, boolean) TO service_role;
