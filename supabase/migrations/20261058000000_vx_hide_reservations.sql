-- A customer sees what a request cost them. Never what was held for it.
--
-- A hold is an internal upper bound. Under metered pricing it is the worst
-- case of a provider's price converted by policy, so the hold, and the refund
-- that is the hold minus the charge, together describe the cost structure
-- behind every request. Until now a customer could read both in three places:
--
--   1. my_vx_usage()      returned reserved_vx and refunded_vx per request;
--   2. my_vx_summary()    returned refunded_vx for today and this month;
--   3. user_points        kept a "VX reserve: <service>" row at the full hold,
--                         and settlement added a "VX refund: <service>" row
--                         beside it. user_points is readable by its owner.
--
-- After this migration:
--
--   1. my_vx_usage() returns consumed_vx and a status, and no hold or refund.
--   2. my_vx_summary() returns consumed_vx and requests, and no refund.
--   3. Settlement folds the hold into ONE row: the hold row is rewritten to the
--      amount actually kept ("VX: <service>"), and deleted when nothing was
--      kept. No refund row is written. The balance is unchanged either way —
--      SUM(user_points) is the same as the old hold + refund pair — so
--      vx_balance(), spend_vx and every client that sums the table agree.
--
-- The hold row is visible for the seconds a request is in flight: it has to
-- be, because the debit must land before the provider is called (see the note
-- on vx_balance in 20261023). Once settled it reads as the charge.
--
-- What is NOT changed: vx_usage_ledger keeps reserved_vx, consumed_vx and
-- refunded_vx exactly as before. It is admin-read only, and it is the audit
-- record of every hold. vx_reserve, vx_reserve_metered and
-- vx_reserve_for_whatsapp are untouched. Rows settled before this migration
-- keep their reserve + refund pair: history is not rewritten.
--
-- The hold row is found by what vx_reserve / vx_reserve_metered wrote in the
-- same transaction as the ledger row: the same user, the "VX reserve: " label
-- for the same service, points = -reserved_vx, and created_at equal to the
-- ledger row's (now() is the transaction's start time, so the two are equal).
-- If it is not found — a hold older than this rule, or one written some other
-- way — settlement falls back to the old refund row, so a refund is never lost.

-- ── Finding the hold row ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vx_hold_points_row(_ledger_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
    FROM public.vx_usage_ledger l
    JOIN public.user_points p
      ON p.user_id = l.user_id
     AND p.reason = 'VX reserve: ' || l.service_id
     AND p.points = -l.reserved_vx
     AND p.created_at = l.created_at
   WHERE l.id = _ledger_id
     AND l.reserved_vx > 0
   ORDER BY p.id
   LIMIT 1
$$;

COMMENT ON FUNCTION public.vx_hold_points_row(uuid) IS
  'The user_points row that holds a reservation''s VX, or NULL when none can be matched (a hold older than 20261058). Internal to vx_settle / vx_release.';

REVOKE ALL ON FUNCTION public.vx_hold_points_row(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_hold_points_row(uuid) TO service_role;

-- ── Settle: the hold row becomes the charge ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.vx_settle(
  _reservation_id   uuid,
  _consumed_vx      integer DEFAULT NULL,
  _execution_time_ms integer DEFAULT NULL,
  _provider         text DEFAULT NULL,
  _actual_cost_usd  numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row      public.vx_usage_ledger%ROWTYPE;
  _consumed integer;
  _refund   integer;
  _hold     uuid;
BEGIN
  SELECT * INTO _row FROM public.vx_usage_ledger WHERE id = _reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  END IF;

  -- Settling twice is a retry, not an error, and must not refund twice.
  IF _row.status <> 'reserved' THEN
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'status', _row.status,
                              'consumed_vx', _row.consumed_vx, 'refunded_vx', _row.refunded_vx);
  END IF;

  -- Null means "it cost what we held". Anything above the hold is clamped: a
  -- settlement may never charge more than the user agreed to when they started.
  _consumed := LEAST(GREATEST(COALESCE(_consumed_vx, _row.reserved_vx), 0), _row.reserved_vx);
  _refund   := _row.reserved_vx - _consumed;

  PERFORM pg_advisory_xact_lock(hashtextextended(_row.user_id::text, 0));

  _hold := public.vx_hold_points_row(_reservation_id);
  IF _hold IS NOT NULL THEN
    -- One row, the charge. Nothing kept means no row at all.
    IF _consumed > 0 THEN
      UPDATE public.user_points
         SET points = -_consumed, reason = 'VX: ' || _row.service_id
       WHERE id = _hold;
    ELSE
      DELETE FROM public.user_points WHERE id = _hold;
    END IF;
  ELSIF _refund > 0 THEN
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_row.user_id, _refund, 'VX refund: ' || _row.service_id);
  END IF;

  UPDATE public.vx_usage_ledger
     SET consumed_vx = _consumed,
         refunded_vx = _refund,
         execution_time_ms = COALESCE(_execution_time_ms, execution_time_ms),
         provider = COALESCE(_provider, provider),
         actual_cost_usd = COALESCE(_actual_cost_usd, actual_cost_usd),
         status = 'settled',
         settled_at = now()
   WHERE id = _reservation_id;

  RETURN jsonb_build_object('ok', true, 'replayed', false, 'status', 'settled',
                            'consumed_vx', _consumed, 'refunded_vx', _refund,
                            'balance_after', public.vx_balance(_row.user_id));
END;
$$;

COMMENT ON FUNCTION public.vx_settle(uuid, integer, integer, text, numeric) IS
  'Close a reservation: keep what was used, return the rest. The hold''s user_points row becomes the charge (or is removed when nothing was kept), so a customer''s history never shows the hold. Idempotent, and never charges more than was held.';

REVOKE ALL ON FUNCTION public.vx_settle(uuid, integer, integer, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_settle(uuid, integer, integer, text, numeric) TO service_role;

-- ── Release: the hold row goes ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vx_release(
  _reservation_id uuid,
  _reason         text DEFAULT 'failed',
  _status         text DEFAULT 'failed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row  public.vx_usage_ledger%ROWTYPE;
  _hold uuid;
BEGIN
  IF _status NOT IN ('failed', 'refunded', 'expired') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_status');
  END IF;

  SELECT * INTO _row FROM public.vx_usage_ledger WHERE id = _reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reservation_not_found');
  END IF;
  IF _row.status <> 'reserved' THEN
    RETURN jsonb_build_object('ok', true, 'replayed', true, 'status', _row.status,
                              'refunded_vx', _row.refunded_vx);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_row.user_id::text, 0));

  _hold := public.vx_hold_points_row(_reservation_id);
  IF _hold IS NOT NULL THEN
    DELETE FROM public.user_points WHERE id = _hold;
  ELSIF _row.reserved_vx > 0 THEN
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_row.user_id, _row.reserved_vx, 'VX refund: ' || _row.service_id);
  END IF;

  UPDATE public.vx_usage_ledger
     SET consumed_vx = 0,
         refunded_vx = _row.reserved_vx,
         status      = _status,
         settled_at  = now(),
         metadata    = metadata || jsonb_build_object('release_reason', _reason)
   WHERE id = _reservation_id;

  RETURN jsonb_build_object('ok', true, 'replayed', false, 'status', _status,
                            'refunded_vx', _row.reserved_vx,
                            'balance_after', public.vx_balance(_row.user_id));
END;
$$;

COMMENT ON FUNCTION public.vx_release(uuid, text, text) IS
  'Return a whole hold: its user_points row is removed (or, for a hold older than 20261058, a refund row is added). Idempotent.';

REVOKE ALL ON FUNCTION public.vx_release(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_release(uuid, text, text) TO service_role;

-- ── A customer's statement: what it cost, never what was held ───────────────
--
-- The return type changes, so the function is dropped and created again. The
-- website is deployed before migrations run, and the new page reads neither
-- dropped column, so there is no window in which it breaks.

DROP FUNCTION IF EXISTS public.my_vx_usage(integer, integer);

CREATE FUNCTION public.my_vx_usage(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, service_id text, display_name text, units integer,
  consumed_vx integer,
  status text, source text, created_at timestamptz, settled_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.service_id, p.display_name, l.units,
         l.consumed_vx,
         l.status, l.source, l.created_at, l.settled_at
    FROM public.vx_usage_ledger l
    JOIN public.central_pricing_registry p ON p.service_id = l.service_id
   WHERE l.user_id = auth.uid()
   ORDER BY l.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(_offset, 0), 0)
$$;

COMMENT ON FUNCTION public.my_vx_usage(integer, integer) IS
  'A user''s own usage: what they asked for, what it cost them in VX, and where from. Never provider, never actual_cost_usd, never the hold or the refund.';

REVOKE ALL ON FUNCTION public.my_vx_usage(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vx_usage(integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_vx_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id  uuid := auth.uid();
  _plan     text;
  _row      public.billing_plans%ROWTYPE;
  _balance  bigint;
  _today    jsonb;
  _month    jsonb;
  _trial    timestamptz;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_signed_in');
  END IF;
  _plan := public.plan_for_user(_user_id);
  SELECT * INTO _row FROM public.billing_plans WHERE id = _plan AND is_active;
  SELECT p.trial_expires_at INTO _trial FROM public.profiles p WHERE p.user_id = _user_id;
  _balance := public.vx_balance(_user_id);
  -- Consumed is what was kept. The hold and the refund are not a customer's
  -- figures (20261058).
  SELECT jsonb_build_object(
           'consumed_vx', COALESCE(SUM(consumed_vx), 0),
           'requests',    COUNT(*))
    INTO _today
    FROM public.vx_usage_ledger
   WHERE user_id = _user_id
     AND created_at >= date_trunc('day', now());
  SELECT jsonb_build_object(
           'consumed_vx', COALESCE(SUM(consumed_vx), 0),
           'requests',    COUNT(*))
    INTO _month
    FROM public.vx_usage_ledger
   WHERE user_id = _user_id
     AND created_at >= date_trunc('month', now());
  RETURN jsonb_build_object(
    'ok',      true,
    'balance_vx', _balance,
    'plan', jsonb_build_object(
      'id',           _plan,
      'name',         COALESCE(_row.name, CASE WHEN _plan = 'admin' THEN 'Admin' ELSE 'Free' END),
      'monthly_vx',   NULLIF(COALESCE(_row.vx_credits_monthly, 0), 0),
      'whatsapp_daily', (_row.limits ->> 'whatsapp_daily_messages')::integer,
      'is_trial',     _plan = 'free_trial',
      'trial_ends_at', CASE WHEN _plan = 'free_trial' THEN _trial END),
    'today',   _today,
    'month',   _month);
END;
$$;

COMMENT ON FUNCTION public.my_vx_summary() IS
  'The Usage screen''s header: balance, plan, monthly allowance and what today and this month have cost. Takes no argument and resolves auth.uid() internally. Returns no provider, no cost, no margin, and no hold or refund.';

REVOKE ALL ON FUNCTION public.my_vx_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vx_summary() TO authenticated, service_role;
