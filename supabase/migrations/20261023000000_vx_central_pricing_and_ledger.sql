-- Phase 1 — one price list, one usage ledger, one reservation flow.
--
-- Visionex has three VX-shaped systems today and they do not agree:
--
--   * `user_points` — the live balance. `SUM(points)`, append-only since
--     20260826 closed the client INSERT. Everything a user actually has is here.
--   * `credit_wallets` + `billing_consume()` — a complete billing authority
--     with idempotency, trial precedence and refunds, wired to nothing. No Edge
--     Function calls it and no screen calls it, so `usage_logs` is empty and
--     the Usage page shows every user a blank history.
--   * `whatsapp_usage` — a per-day count with no VX in it at all.
--
-- and a fourth shape hidden inside `charge_file_conversion()`, which is the
-- only charge-then-settle pattern in the repository, prices four converters in
-- its own function body, and decides plan tiers from a magic `balance >= 10000`.
--
-- This file adds the missing middle: a price list in a table, a single ledger,
-- and reserve/settle over `user_points` — which is adopted as the source of
-- truth, because it is the one people's balances are actually in.
--
-- ── What this migration deliberately does NOT do ────────────────────────────
--
-- It does not touch `credit_wallets`, `billing_consume`, `spend_vx`,
-- `charge_file_conversion` or `whatsapp_usage`. Nothing is migrated and nothing
-- is deleted. Every service below ships with `enabled = false`, so applying
-- this changes no production behaviour: it installs the mechanism, and turning
-- a service on is a row update an admin makes after the reconciliation report
-- has been read. The wallet migration is a separate, reviewed step.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. The price list
-- ════════════════════════════════════════════════════════════════════════════
--
-- One row per billable capability. No price, limit or tier may be written in
-- PL/pgSQL or TypeScript again: a price change is an UPDATE, not a deploy.

CREATE TABLE IF NOT EXISTS public.central_pricing_registry (
  service_id      text PRIMARY KEY,
  display_name    text NOT NULL,
  -- The preferred provider slug, or NULL to let the router choose. Commercial
  -- detail: never exposed to a user.
  provider        text,
  -- What one unit costs Visionex, in USD. Admin-only, and the reason the whole
  -- table is admin-read.
  base_cost       numeric(10,6) NOT NULL DEFAULT 0 CHECK (base_cost >= 0),
  -- What one unit costs the user, in VX.
  vx_price        integer NOT NULL CHECK (vx_price >= 0),
  -- Units per day before VX is charged at all. 0 = never free.
  free_limit      integer NOT NULL DEFAULT 0 CHECK (free_limit >= 0),
  -- Per-plan daily allowance, keyed on billing_plans.id:
  -- {"bronze": 50, "silver": 200, "gold": 0}  — 0 means unlimited, the
  -- convention billing_plans.vx_credits_monthly already uses.
  plan_limits     jsonb NOT NULL DEFAULT '{}',
  -- The hard ceiling per user per day, whatever the plan. NULL = no ceiling.
  max_daily_usage integer CHECK (max_daily_usage IS NULL OR max_daily_usage > 0),
  -- The switch. False means the capability refuses everyone, which is how this
  -- migration ships without changing behaviour.
  enabled         boolean NOT NULL DEFAULT false,
  -- True means only an admin may spend it — for a capability under trial.
  admin_only      boolean NOT NULL DEFAULT false,
  notes           text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.central_pricing_registry IS
  'The only place a VX price, a free allowance or a daily ceiling is written. base_cost and provider are commercial detail and never leave the admin surface — users read vx_price_list() instead.';

ALTER TABLE public.central_pricing_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'central_pricing_registry' AND policyname = 'pricing_read_admin') THEN
    CREATE POLICY "pricing_read_admin"
      ON public.central_pricing_registry FOR SELECT TO authenticated
      USING ((select public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;

REVOKE ALL ON TABLE public.central_pricing_registry FROM anon, authenticated;
GRANT SELECT ON TABLE public.central_pricing_registry TO authenticated;
GRANT ALL ON TABLE public.central_pricing_registry TO service_role;

-- The services Visionex already performs, priced from the two places that
-- already had numbers: billing_rules (tts/voice_cloning/text_to_video) and
-- charge_file_conversion's function body. Every one starts disabled.
INSERT INTO public.central_pricing_registry
  (service_id, display_name, provider, base_cost, vx_price, free_limit, plan_limits, max_daily_usage, notes)
VALUES
  ('ocr',           'OCR',                  NULL,         0.002000,  10,  3, '{}', 200, 'English on the Visionex server; Arabic falls back to a vision model.'),
  ('tts',           'Text to speech',       NULL,         0.015000, 100,  1, '{}',  50, 'Was billing_rules.tts = 100.'),
  ('voice_clone',   'Voice cloning',        'elevenlabs', 1.000000, 500,  0, '{}',   5, 'Was billing_rules.voice_cloning = 500. ELEVENLABS_API_KEY is unset.'),
  ('image',         'Image generation',     NULL,         0.040000,  60,  1, '{}',  30, 'gpt-image-1.'),
  ('video',         'Video generation',     NULL,         0.500000, 300,  0, '{}',  10, 'Was billing_rules.text_to_video = 300.'),
  ('translation',   'Document translation', NULL,         0.001000,   5, 10, '{}', 300, NULL),
  ('whatsapp_ai',   'WhatsApp assistant',   NULL,         0.000500,   2, 20, '{}', 500, 'Linked accounts only; an unlinked number keeps whatsapp_entitlements.'),
  ('document_ai',   'Document understanding', NULL,       0.004000,  15,  2, '{}', 100, NULL)
ON CONFLICT (service_id) DO NOTHING;

-- A price change is an operator action and is recorded like one.
CREATE TABLE IF NOT EXISTS public.central_pricing_audit (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text NOT NULL,
  operation  text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  actor_id   uuid,
  before     jsonb,
  after      jsonb,
  changed    text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.central_pricing_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'central_pricing_audit' AND policyname = 'pricing_audit_read_admin') THEN
    CREATE POLICY "pricing_audit_read_admin"
      ON public.central_pricing_audit FOR SELECT TO authenticated
      USING ((select public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;

REVOKE ALL ON TABLE public.central_pricing_audit FROM anon;
GRANT SELECT ON TABLE public.central_pricing_audit TO authenticated;
GRANT ALL ON TABLE public.central_pricing_audit TO service_role;

CREATE OR REPLACE FUNCTION public.central_pricing_audit_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _before jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  _after  jsonb := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  _changed text[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(array_agg(key ORDER BY key), '{}') INTO _changed
      FROM jsonb_each(_after)
     WHERE _before -> key IS DISTINCT FROM value AND key <> 'updated_at';
    IF _changed = '{}' THEN RETURN NEW; END IF;
  END IF;

  INSERT INTO public.central_pricing_audit (service_id, operation, actor_id, before, after, changed)
  VALUES (COALESCE(NEW.service_id, OLD.service_id), TG_OP, auth.uid(), _before, _after, _changed);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS central_pricing_audit_trigger ON public.central_pricing_registry;
CREATE TRIGGER central_pricing_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.central_pricing_registry
  FOR EACH ROW EXECUTE FUNCTION public.central_pricing_audit_change();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. The ledger
-- ════════════════════════════════════════════════════════════════════════════
--
-- One row per reservation, whichever surface asked. `source` is what makes a
-- single ledger answer "what did WhatsApp cost this month" without a second
-- table, and it is the column a future API client fills in too.

CREATE TABLE IF NOT EXISTS public.vx_usage_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_id      text NOT NULL REFERENCES public.central_pricing_registry(service_id),
  -- Which vendor served it. Commercial detail: my_vx_usage() omits it.
  provider        text,
  units           integer NOT NULL DEFAULT 1 CHECK (units > 0),
  reserved_vx     integer NOT NULL CHECK (reserved_vx >= 0),
  consumed_vx     integer NOT NULL DEFAULT 0 CHECK (consumed_vx >= 0),
  refunded_vx     integer NOT NULL DEFAULT 0 CHECK (refunded_vx >= 0),
  execution_time_ms integer CHECK (execution_time_ms IS NULL OR execution_time_ms >= 0),
  status          text NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved', 'settled', 'refunded', 'failed', 'expired')),
  source          text NOT NULL CHECK (source IN ('website', 'whatsapp', 'api', 'system')),
  -- The duplicate guard. A retried submit with the same key returns the first
  -- reservation instead of charging twice.
  idempotency_key text UNIQUE,
  -- What the internal cost turned out to be. Admin-only, like base_cost.
  actual_cost_usd numeric(10,6),
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  settled_at      timestamptz,
  -- Never more than was held.
  CONSTRAINT vx_ledger_settled_within_reserved CHECK (consumed_vx + refunded_vx <= reserved_vx)
);

CREATE INDEX IF NOT EXISTS vx_ledger_user_idx    ON public.vx_usage_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vx_ledger_service_idx ON public.vx_usage_ledger(service_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vx_ledger_source_idx  ON public.vx_usage_ledger(source, created_at DESC);
-- The reaper's index: open reservations, oldest first.
CREATE INDEX IF NOT EXISTS vx_ledger_open_idx    ON public.vx_usage_ledger(created_at)
  WHERE status = 'reserved';
-- The daily-allowance query, which runs on every reserve.
CREATE INDEX IF NOT EXISTS vx_ledger_daily_idx   ON public.vx_usage_ledger(user_id, service_id, created_at DESC);

COMMENT ON TABLE public.vx_usage_ledger IS
  'One row per VX reservation, from the website, WhatsApp or the API. Admin-read; a user reads their own through my_vx_usage(), which omits provider and cost.';

ALTER TABLE public.vx_usage_ledger ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                   AND tablename = 'vx_usage_ledger' AND policyname = 'vx_ledger_read_admin') THEN
    -- Deliberately not "users read their own". The row carries `provider` and
    -- `actual_cost_usd`; a user's view of it is my_vx_usage(), which is a
    -- column list rather than a policy nobody will re-read in a year.
    CREATE POLICY "vx_ledger_read_admin"
      ON public.vx_usage_ledger FOR SELECT TO authenticated
      USING ((select public.has_role(auth.uid(), 'admin')));
  END IF;
END $$;

REVOKE ALL ON TABLE public.vx_usage_ledger FROM anon;
GRANT SELECT ON TABLE public.vx_usage_ledger TO authenticated;
GRANT ALL ON TABLE public.vx_usage_ledger TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Balance
-- ════════════════════════════════════════════════════════════════════════════
--
-- `user_points` is the source of truth and a reservation is a real debit in it
-- — the same decision charge_file_conversion() took. That is what makes the
-- balance honest to every existing reader (usePoints, spend_vx, the Arcade)
-- without any of them learning that reservations exist. A hold kept outside
-- the ledger would be invisible to `SUM(points)` and double-spendable.

CREATE OR REPLACE FUNCTION public.vx_balance(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::integer FROM public.user_points WHERE user_id = _user_id
$$;

COMMENT ON FUNCTION public.vx_balance(uuid) IS
  'The one VX balance: SUM(user_points.points). Reservations are already debited here, so this never overstates what is spendable.';

REVOKE ALL ON FUNCTION public.vx_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_balance(uuid) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Reserve
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.vx_reserve(
  _user_id         uuid,
  _service_id      text,
  _source          text,
  _idempotency_key text DEFAULT NULL,
  _units           integer DEFAULT 1,
  _metadata        jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _price    public.central_pricing_registry%ROWTYPE;
  _existing public.vx_usage_ledger%ROWTYPE;
  _units_i  integer := GREATEST(1, COALESCE(_units, 1));
  _cost     integer;
  _balance  integer;
  _used     integer;
  _plan     text;
  _allowance integer;
  _free_left integer;
  _id       uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_required');
  END IF;
  IF _source IS NULL OR _source NOT IN ('website', 'whatsapp', 'api', 'system') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_source');
  END IF;

  -- Idempotency before anything else, and before the lock: a retry must be
  -- cheap and must never charge twice.
  IF _idempotency_key IS NOT NULL THEN
    SELECT * INTO _existing FROM public.vx_usage_ledger WHERE idempotency_key = _idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true, 'replayed', true,
        'reservation_id', _existing.id,
        'reserved_vx', _existing.reserved_vx,
        'status', _existing.status);
    END IF;
  END IF;

  SELECT * INTO _price FROM public.central_pricing_registry WHERE service_id = _service_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_service');
  END IF;
  IF NOT _price.enabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'service_disabled');
  END IF;
  IF _price.admin_only AND NOT public.has_role(_user_id, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'admin_only');
  END IF;

  -- One lock per user, for the whole decision. Two concurrent reserves for the
  -- same account must not both read the same balance and both pass.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  -- What this account has already used of this service today. Counted on
  -- reservations, not settlements: a job in flight has to count, or ten
  -- parallel submits all see zero.
  SELECT COALESCE(SUM(units), 0) INTO _used
    FROM public.vx_usage_ledger
   WHERE user_id = _user_id
     AND service_id = _service_id
     AND status <> 'refunded'
     AND created_at >= date_trunc('day', now());

  IF _price.max_daily_usage IS NOT NULL AND _used + _units_i > _price.max_daily_usage THEN
    RETURN jsonb_build_object('ok', false, 'error', 'daily_ceiling_reached',
                              'used_today', _used, 'max_daily_usage', _price.max_daily_usage);
  END IF;

  -- The plan's own allowance for this service, when the registry names one.
  SELECT s.plan_id INTO _plan
    FROM public.user_subscriptions s
   WHERE s.user_id = _user_id AND s.status = 'active'
     AND (s.ends_at IS NULL OR s.ends_at > now())
   ORDER BY s.started_at DESC LIMIT 1;

  IF _plan IS NOT NULL AND _price.plan_limits ? _plan THEN
    _allowance := (_price.plan_limits ->> _plan)::integer;
    -- 0 means unlimited, the convention billing_plans already uses.
    IF _allowance > 0 AND _used + _units_i > _allowance THEN
      RETURN jsonb_build_object('ok', false, 'error', 'plan_allowance_reached',
                                'used_today', _used, 'plan_allowance', _allowance);
    END IF;
  END IF;

  -- The free tier comes off the top, per day, before VX is touched.
  _free_left := GREATEST(0, _price.free_limit - _used);
  _cost := GREATEST(0, _units_i - _free_left) * _price.vx_price;

  IF _cost > 0 THEN
    _balance := public.vx_balance(_user_id);
    IF _balance < _cost THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_vx',
                                'balance', _balance, 'required', _cost,
                                'shortage', _cost - _balance);
    END IF;

    -- The debit lands now. See the note on vx_balance for why a hold outside
    -- user_points would be a double-spend waiting to happen.
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_user_id, -_cost, 'VX reserve: ' || _service_id);
  END IF;

  INSERT INTO public.vx_usage_ledger
    (user_id, service_id, provider, units, reserved_vx, status, source, idempotency_key, metadata)
  VALUES
    (_user_id, _service_id, _price.provider, _units_i, _cost, 'reserved', _source, _idempotency_key,
     COALESCE(_metadata, '{}'))
  RETURNING id INTO _id;

  RETURN jsonb_build_object(
    'ok', true, 'replayed', false,
    'reservation_id', _id,
    'reserved_vx', _cost,
    'free_units_used', LEAST(_units_i, _free_left),
    'balance_after', public.vx_balance(_user_id));
END;
$$;

COMMENT ON FUNCTION public.vx_reserve(uuid, text, text, text, integer, jsonb) IS
  'Hold VX for one job. Prices, allowances and ceilings all come from central_pricing_registry — never from the caller. The debit is real and immediate; vx_settle() returns the unused part.';

REVOKE ALL ON FUNCTION public.vx_reserve(uuid, text, text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_reserve(uuid, text, text, text, integer, jsonb) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Settle
-- ════════════════════════════════════════════════════════════════════════════

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

  IF _refund > 0 THEN
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
  'Close a reservation: keep what was used, return the rest. Idempotent, and never charges more than was held.';

REVOKE ALL ON FUNCTION public.vx_settle(uuid, integer, integer, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_settle(uuid, integer, integer, text, numeric) TO service_role;

-- ── Release: the whole hold comes back ──────────────────────────────────────
--
-- The failure path, kept separate from settle(0) so the ledger records *why*
-- nothing was charged. A job that failed and a job that happened to be free
-- are different facts.

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
  _row public.vx_usage_ledger%ROWTYPE;
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

  IF _row.reserved_vx > 0 THEN
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

REVOKE ALL ON FUNCTION public.vx_release(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_release(uuid, text, text) TO service_role;

-- ── The reaper ──────────────────────────────────────────────────────────────
--
-- `refund_stale_file_conversions()` does this job for File Studio and is
-- scoped to `auth.uid()`, so it only runs when the user happens to come back —
-- a crashed conversion holds their VX until then. This one is scheduled.

CREATE OR REPLACE FUNCTION public.vx_reap_stale_reservations(_older_than interval DEFAULT interval '1 hour')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _floor interval := GREATEST(COALESCE(_older_than, interval '1 hour'), interval '10 minutes');
  _row   record;
  _n     integer := 0;
BEGIN
  FOR _row IN
    SELECT id FROM public.vx_usage_ledger
     WHERE status = 'reserved' AND created_at < now() - _floor
     ORDER BY created_at
     LIMIT 500
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.vx_release(_row.id, 'stale reservation swept', 'expired');
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END;
$$;

COMMENT ON FUNCTION public.vx_reap_stale_reservations(interval) IS
  'Returns VX held by reservations nobody settled. Scheduled, unlike refund_stale_file_conversions(), which only runs when the user calls it.';

REVOKE ALL ON FUNCTION public.vx_reap_stale_reservations(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vx_reap_stale_reservations(interval) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('vx-reap-stale-reservations')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'vx-reap-stale-reservations');
    PERFORM cron.schedule(
      'vx-reap-stale-reservations',
      '*/10 * * * *',
      $cron$ SELECT public.vx_reap_stale_reservations(); $cron$
    );
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. What a user may see
-- ════════════════════════════════════════════════════════════════════════════
--
-- Column lists, not policies. The ledger and the price list both carry
-- commercial detail, and "users read their own rows" would hand it over.

CREATE OR REPLACE FUNCTION public.vx_price_list()
RETURNS TABLE (service_id text, display_name text, vx_price integer, free_limit integer, max_daily_usage integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.service_id, p.display_name, p.vx_price, p.free_limit, p.max_daily_usage
    FROM public.central_pricing_registry p
   WHERE p.enabled
     AND (NOT p.admin_only OR public.has_role(auth.uid(), 'admin'))
   ORDER BY p.display_name
$$;

COMMENT ON FUNCTION public.vx_price_list() IS
  'What a capability costs, for a price list on screen. No provider, no base_cost — those are commercial detail.';

REVOKE ALL ON FUNCTION public.vx_price_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vx_price_list() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_vx_usage(_limit integer DEFAULT 50, _offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid, service_id text, display_name text, units integer,
  reserved_vx integer, consumed_vx integer, refunded_vx integer,
  status text, source text, created_at timestamptz, settled_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.service_id, p.display_name, l.units,
         l.reserved_vx, l.consumed_vx, l.refunded_vx,
         l.status, l.source, l.created_at, l.settled_at
    FROM public.vx_usage_ledger l
    JOIN public.central_pricing_registry p ON p.service_id = l.service_id
   WHERE l.user_id = auth.uid()
   ORDER BY l.created_at DESC
   LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200)
  OFFSET GREATEST(COALESCE(_offset, 0), 0)
$$;

COMMENT ON FUNCTION public.my_vx_usage(integer, integer) IS
  'A user''s own usage: what they asked for, what it cost them in VX, and where from. Never provider, never actual_cost_usd.';

REVOKE ALL ON FUNCTION public.my_vx_usage(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vx_usage(integer, integer) TO authenticated, service_role;

-- ── The operator's view ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.vx_usage_analytics(_days integer DEFAULT 30)
RETURNS TABLE (
  service_id text, source text,
  reservations bigint, settled bigint, failed bigint,
  reserved_vx bigint, consumed_vx bigint, refunded_vx bigint,
  cost_usd numeric, avg_execution_ms numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.service_id, l.source,
         count(*),
         count(*) FILTER (WHERE l.status = 'settled'),
         count(*) FILTER (WHERE l.status IN ('failed', 'expired')),
         COALESCE(SUM(l.reserved_vx), 0),
         COALESCE(SUM(l.consumed_vx), 0),
         COALESCE(SUM(l.refunded_vx), 0),
         COALESCE(SUM(l.actual_cost_usd), 0),
         ROUND(AVG(l.execution_time_ms), 1)
    FROM public.vx_usage_ledger l
   WHERE public.has_role(auth.uid(), 'admin')
     AND l.created_at >= now() - (GREATEST(COALESCE(_days, 30), 1) || ' days')::interval
   GROUP BY l.service_id, l.source
   ORDER BY l.service_id, l.source
$$;

COMMENT ON FUNCTION public.vx_usage_analytics(integer) IS
  'Admin analytics over the one ledger. The has_role check is inside the query so a non-admin gets an empty set rather than an error that confirms the shape.';

REVOKE ALL ON FUNCTION public.vx_usage_analytics(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vx_usage_analytics(integer) TO authenticated, service_role;
