-- Visionex AI Media Studio — Billing, Credits & Subscription System
-- VX Token economy: TTS=100, Video=300, Voice Clone=500

-- ─── SUBSCRIPTION PLANS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_plans (
  id                    text PRIMARY KEY,   -- 'free_trial','basic','pro','enterprise'
  name                  text NOT NULL,
  description           text,
  price_monthly_usd     numeric(8,2) NOT NULL DEFAULT 0,
  vx_credits_monthly    integer NOT NULL DEFAULT 0,   -- 0 = unlimited
  is_unlimited          boolean NOT NULL DEFAULT false,
  features              jsonb NOT NULL DEFAULT '[]',
  limits                jsonb NOT NULL DEFAULT '{}',
  is_active             boolean NOT NULL DEFAULT true,
  sort_order            integer NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- No RLS — plans are public
INSERT INTO billing_plans (id, name, description, price_monthly_usd, vx_credits_monthly, is_unlimited, features, limits, sort_order)
VALUES
  ('free_trial', 'Free Trial', '5 days full access — no credit card required',
    0, 0, true,
    '["Full AI Media Studio access","All voice styles","All video styles","All quality settings"]'::jsonb,
    '{"trial_days": 5}'::jsonb,
    0),
  ('basic', 'Basic', 'Great for individuals and small projects',
    9.99, 5000, false,
    '["5,000 VX credits/month","All speech voices","Standard video quality","Email support"]'::jsonb,
    '{"max_video_resolution": "720p", "max_video_duration_sec": 10}'::jsonb,
    1),
  ('pro', 'Pro', 'For professionals who create at scale',
    29.99, 20000, false,
    '["20,000 VX credits/month","Priority processing queue","HD video quality","Voice cloning","Analytics dashboard","Priority support"]'::jsonb,
    '{"max_video_resolution": "1080p", "max_video_duration_sec": 30, "priority_queue": true}'::jsonb,
    2),
  ('enterprise', 'Enterprise', 'Unlimited generation for teams and businesses',
    99.99, 100000, false,
    '["100,000 VX credits/month","Dedicated provider routing","4K video quality","Advanced analytics","SLA support","Custom integrations"]'::jsonb,
    '{"max_video_resolution": "4k", "max_video_duration_sec": 60, "priority_queue": true, "dedicated_routing": true}'::jsonb,
    3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly_usd = EXCLUDED.price_monthly_usd,
  vx_credits_monthly = EXCLUDED.vx_credits_monthly,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits;

-- ─── BILLING RULES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_rules (
  id          text PRIMARY KEY,
  vx_cost     integer NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO billing_rules (id, vx_cost, description) VALUES
  ('tts',            100, 'Text-to-Speech generation'),
  ('voice_cloning',  500, 'Voice cloning training job'),
  ('text_to_video',  300, 'Text-to-Video generation')
ON CONFLICT (id) DO UPDATE SET
  vx_cost = EXCLUDED.vx_cost,
  updated_at = now();

-- ─── TRIAL STATUS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trial_status (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at    timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  is_active     boolean NOT NULL DEFAULT true,
  expired_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trial_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trial_owner_select" ON trial_status FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "trial_service_all"  ON trial_status FOR ALL USING (true);

-- ─── CREDIT WALLETS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_wallets (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_vx    integer NOT NULL DEFAULT 0 CHECK (balance_vx >= 0),
  lifetime_earned_vx  integer NOT NULL DEFAULT 0,
  lifetime_spent_vx   integer NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE credit_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_owner_select" ON credit_wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wallet_service_all"  ON credit_wallets FOR ALL USING (true);

-- ─── SUBSCRIPTIONS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id         text NOT NULL REFERENCES billing_plans(id),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','cancelled','expired','past_due')),
  started_at      timestamptz NOT NULL DEFAULT now(),
  ends_at         timestamptz,          -- null = monthly rolling
  cancelled_at    timestamptz,
  next_renewal_at timestamptz,
  vx_credits_remaining integer NOT NULL DEFAULT 0,
  vx_reset_at     timestamptz,          -- when monthly credits reset
  external_sub_id text,                 -- Stripe subscription ID
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_subs_user_idx   ON user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS user_subs_status_idx ON user_subscriptions(status);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sub_owner_select"  ON user_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "sub_service_all"   ON user_subscriptions FOR ALL USING (true);

CREATE TRIGGER user_subs_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── CREDIT TRANSACTIONS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS credit_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            text NOT NULL
                    CHECK (type IN ('earn','spend','refund','subscription_grant','admin_grant','purchase')),
  amount_vx       integer NOT NULL,    -- positive = credit in; negative = debit out
  balance_after   integer NOT NULL,
  description     text NOT NULL,
  -- Linked to AI operation
  operation_type  text,                -- 'tts','voice_cloning','text_to_video'
  job_id          text,                -- ID from respective studio
  project_id      uuid,
  provider_slug   text,
  -- Idempotency
  idempotency_key text UNIQUE,         -- prevents double-deduction
  -- Metadata
  meta            jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS txn_user_idx   ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS txn_type_idx   ON credit_transactions(type, created_at DESC);
CREATE INDEX IF NOT EXISTS txn_job_idx    ON credit_transactions(job_id) WHERE job_id IS NOT NULL;

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_owner_select"  ON credit_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "txn_service_all"   ON credit_transactions FOR ALL USING (true);

-- ─── USAGE LOGS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_type  text NOT NULL,          -- 'tts','voice_cloning','text_to_video'
  credits_used    integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'success'
                    CHECK (status IN ('success','failed','refunded','blocked')),
  provider_slug   text,
  project_id      uuid,
  job_id          text,
  billing_mode    text NOT NULL DEFAULT 'credits'
                    CHECK (billing_mode IN ('trial','credits','subscription')),
  plan_id         text,
  transaction_id  uuid REFERENCES credit_transactions(id),
  meta            jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_user_idx  ON usage_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_type_idx  ON usage_logs(operation_type, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_date_idx  ON usage_logs(created_at DESC);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_owner_select" ON usage_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "usage_service_all"  ON usage_logs FOR ALL USING (true);

-- ─── USERS BILLING (aggregate view) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users_billing (
  user_id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text,
  display_name        text,
  active_plan_id      text DEFAULT 'free_trial',
  is_in_trial         boolean NOT NULL DEFAULT true,
  trial_ends_at       timestamptz,
  total_operations    integer NOT NULL DEFAULT 0,
  total_credits_spent integer NOT NULL DEFAULT 0,
  last_operation_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ubilling_owner_select" ON users_billing FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ubilling_service_all"  ON users_billing FOR ALL USING (true);

CREATE TRIGGER users_billing_updated_at
  BEFORE UPDATE ON users_billing
  FOR EACH ROW EXECUTE FUNCTION ams_touch_updated_at();

-- ─── ATOMIC BILLING FUNCTIONS ────────────────────────────────────────────────

-- Initialize a new user's billing records
CREATE OR REPLACE FUNCTION billing_initialize_user(p_user_id uuid, p_email text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trial_end timestamptz := now() + interval '5 days';
BEGIN
  -- Wallet
  INSERT INTO credit_wallets (user_id, balance_vx)
  VALUES (p_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Trial
  INSERT INTO trial_status (user_id, started_at, ends_at, is_active)
  VALUES (p_user_id, now(), v_trial_end, true)
  ON CONFLICT (user_id) DO NOTHING;

  -- users_billing
  INSERT INTO users_billing (user_id, email, is_in_trial, trial_ends_at, active_plan_id)
  VALUES (p_user_id, p_email, true, v_trial_end, 'free_trial')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN jsonb_build_object(
    'initialized', true,
    'trial_ends_at', v_trial_end
  );
END;
$$;

-- Atomic billing check + consume (returns ok/error)
CREATE OR REPLACE FUNCTION billing_consume(
  p_user_id         uuid,
  p_operation_type  text,
  p_job_id          text DEFAULT NULL,
  p_project_id      uuid DEFAULT NULL,
  p_provider_slug   text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_meta            jsonb DEFAULT '{}'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cost          integer;
  v_trial         record;
  v_wallet        record;
  v_subscription  record;
  v_plan          record;
  v_balance_after integer;
  v_txn_id        uuid;
  v_billing_mode  text;
  v_description   text;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM credit_transactions WHERE idempotency_key = p_idempotency_key) THEN
      RETURN jsonb_build_object('ok', true, 'already_processed', true);
    END IF;
  END IF;

  -- Get cost
  SELECT vx_cost INTO v_cost FROM billing_rules WHERE id = p_operation_type;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_operation_type');
  END IF;

  -- Check trial status
  SELECT * INTO v_trial FROM trial_status WHERE user_id = p_user_id;

  IF v_trial IS NULL THEN
    -- Auto-initialize
    PERFORM billing_initialize_user(p_user_id);
    SELECT * INTO v_trial FROM trial_status WHERE user_id = p_user_id;
  END IF;

  -- Trial active and not expired?
  IF v_trial.is_active AND v_trial.ends_at > now() THEN
    v_billing_mode := 'trial';
    v_description  := format('Trial: %s generation', p_operation_type);

    -- Log usage (no VX deduction during trial)
    INSERT INTO usage_logs
      (user_id, operation_type, credits_used, status, provider_slug, project_id, job_id, billing_mode, plan_id)
    VALUES
      (p_user_id, p_operation_type, 0, 'success', p_provider_slug, p_project_id, p_job_id, 'trial', 'free_trial');

    -- Update users_billing
    UPDATE users_billing SET
      total_operations = total_operations + 1,
      last_operation_at = now(),
      updated_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'ok', true,
      'billing_mode', 'trial',
      'credits_used', 0,
      'trial_ends_at', v_trial.ends_at
    );
  END IF;

  -- Trial expired — expire it in DB if not done
  IF v_trial.is_active AND v_trial.ends_at <= now() THEN
    UPDATE trial_status SET is_active = false, expired_at = now() WHERE user_id = p_user_id;
    UPDATE users_billing SET is_in_trial = false, updated_at = now() WHERE user_id = p_user_id;
  END IF;

  -- Check active subscription
  SELECT us.*, bp.is_unlimited INTO v_subscription
  FROM user_subscriptions us
  JOIN billing_plans bp ON bp.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.ends_at IS NULL OR us.ends_at > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_subscription IS NOT NULL AND v_subscription.is_unlimited THEN
    -- Unlimited plan
    v_billing_mode := 'subscription';
    INSERT INTO usage_logs
      (user_id, operation_type, credits_used, status, provider_slug, project_id, job_id, billing_mode, plan_id)
    VALUES
      (p_user_id, p_operation_type, 0, 'success', p_provider_slug, p_project_id, p_job_id, 'subscription', v_subscription.plan_id);

    UPDATE users_billing SET
      total_operations = total_operations + 1,
      last_operation_at = now(),
      updated_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('ok', true, 'billing_mode', 'subscription', 'credits_used', 0);
  END IF;

  -- Subscription with VX credits
  IF v_subscription IS NOT NULL AND v_subscription.vx_credits_remaining >= v_cost THEN
    UPDATE user_subscriptions SET
      vx_credits_remaining = vx_credits_remaining - v_cost,
      updated_at = now()
    WHERE id = v_subscription.id;

    v_billing_mode := 'subscription';
    INSERT INTO usage_logs
      (user_id, operation_type, credits_used, status, provider_slug, project_id, job_id, billing_mode, plan_id)
    VALUES
      (p_user_id, p_operation_type, v_cost, 'success', p_provider_slug, p_project_id, p_job_id, 'subscription', v_subscription.plan_id);

    UPDATE users_billing SET
      total_operations = total_operations + 1,
      total_credits_spent = total_credits_spent + v_cost,
      last_operation_at = now(),
      updated_at = now()
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object('ok', true, 'billing_mode', 'subscription', 'credits_used', v_cost);
  END IF;

  -- Fall back to VX wallet credits
  SELECT * INTO v_wallet FROM credit_wallets WHERE user_id = p_user_id FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'wallet_not_found', 'code', 'NO_WALLET');
  END IF;

  IF v_wallet.balance_vx < v_cost THEN
    RETURN jsonb_build_object(
      'ok',             false,
      'error',          'insufficient_credits',
      'code',           'INSUFFICIENT_CREDITS',
      'balance',        v_wallet.balance_vx,
      'required',       v_cost,
      'shortage',       v_cost - v_wallet.balance_vx
    );
  END IF;

  -- Deduct
  v_balance_after := v_wallet.balance_vx - v_cost;
  UPDATE credit_wallets SET
    balance_vx         = v_balance_after,
    lifetime_spent_vx  = lifetime_spent_vx + v_cost,
    updated_at         = now()
  WHERE user_id = p_user_id;

  v_description := format('VX spent: %s generation (%s VX)', p_operation_type, v_cost);

  INSERT INTO credit_transactions
    (user_id, type, amount_vx, balance_after, description, operation_type, job_id, project_id, provider_slug, idempotency_key, meta)
  VALUES
    (p_user_id, 'spend', -v_cost, v_balance_after, v_description, p_operation_type, p_job_id, p_project_id, p_provider_slug, p_idempotency_key, p_meta)
  RETURNING id INTO v_txn_id;

  INSERT INTO usage_logs
    (user_id, operation_type, credits_used, status, provider_slug, project_id, job_id, billing_mode, transaction_id)
  VALUES
    (p_user_id, p_operation_type, v_cost, 'success', p_provider_slug, p_project_id, p_job_id, 'credits', v_txn_id);

  UPDATE users_billing SET
    total_operations    = total_operations + 1,
    total_credits_spent = total_credits_spent + v_cost,
    last_operation_at   = now(),
    updated_at          = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok',           true,
    'billing_mode', 'credits',
    'credits_used', v_cost,
    'balance_after', v_balance_after,
    'transaction_id', v_txn_id
  );
END;
$$;

-- Refund VX credits on failed generation
CREATE OR REPLACE FUNCTION billing_refund(
  p_user_id    uuid,
  p_job_id     text,
  p_reason     text DEFAULT 'generation_failed'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_original      record;
  v_balance       integer;
  v_new_bal       integer;
  v_refund_amount integer;
BEGIN
  -- Find the original spend transaction for this job
  SELECT * INTO v_original
  FROM credit_transactions
  WHERE user_id = p_user_id
    AND job_id  = p_job_id
    AND type    = 'spend'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_original IS NULL THEN
    -- No credits were spent (trial/subscription), nothing to refund
    RETURN jsonb_build_object('ok', true, 'refunded', false, 'reason', 'no_spend_found');
  END IF;

  -- Already refunded?
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE user_id = p_user_id AND job_id = p_job_id AND type = 'refund'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'refunded', false, 'reason', 'already_refunded');
  END IF;

  v_refund_amount := ABS(v_original.amount_vx);
  SELECT balance_vx INTO v_balance FROM credit_wallets WHERE user_id = p_user_id FOR UPDATE;
  v_new_bal := v_balance + v_refund_amount;

  UPDATE credit_wallets SET
    balance_vx = v_new_bal,
    lifetime_spent_vx = GREATEST(0, lifetime_spent_vx - v_refund_amount),
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions
    (user_id, type, amount_vx, balance_after, description, operation_type, job_id)
  VALUES
    (p_user_id, 'refund', v_refund_amount, v_new_bal,
     format('Refund: %s failed (%s VX)', v_original.operation_type, v_refund_amount),
     v_original.operation_type, p_job_id);

  UPDATE usage_logs SET status = 'refunded'
  WHERE user_id = p_user_id AND job_id = p_job_id AND status = 'success';

  UPDATE users_billing SET
    total_credits_spent = GREATEST(0, total_credits_spent - v_refund_amount),
    updated_at = now()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'ok', true, 'refunded', true,
    'amount_vx', v_refund_amount,
    'balance_after', v_new_bal
  );
END;
$$;

-- Grant VX credits (subscription renewal / purchase / admin)
CREATE OR REPLACE FUNCTION billing_grant_credits(
  p_user_id    uuid,
  p_amount_vx  integer,
  p_type       text DEFAULT 'admin_grant',   -- 'subscription_grant','purchase','admin_grant'
  p_description text DEFAULT 'Credits granted'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF p_amount_vx <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'amount must be positive');
  END IF;

  INSERT INTO credit_wallets (user_id, balance_vx, lifetime_earned_vx)
  VALUES (p_user_id, p_amount_vx, p_amount_vx)
  ON CONFLICT (user_id) DO UPDATE SET
    balance_vx        = credit_wallets.balance_vx + p_amount_vx,
    lifetime_earned_vx = credit_wallets.lifetime_earned_vx + p_amount_vx,
    updated_at        = now()
  RETURNING balance_vx INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    SELECT balance_vx INTO v_new_balance FROM credit_wallets WHERE user_id = p_user_id;
  END IF;

  INSERT INTO credit_transactions
    (user_id, type, amount_vx, balance_after, description)
  VALUES
    (p_user_id, p_type, p_amount_vx, v_new_balance, p_description);

  RETURN jsonb_build_object('ok', true, 'balance', v_new_balance, 'granted', p_amount_vx);
END;
$$;

-- Get full billing status for a user
CREATE OR REPLACE FUNCTION billing_get_status(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trial    record;
  v_wallet   record;
  v_sub      record;
  v_usage    record;
BEGIN
  SELECT * INTO v_trial  FROM trial_status        WHERE user_id = p_user_id;
  SELECT * INTO v_wallet FROM credit_wallets       WHERE user_id = p_user_id;
  SELECT us.*, bp.name as plan_name, bp.vx_credits_monthly, bp.is_unlimited, bp.features, bp.limits
    INTO v_sub
    FROM user_subscriptions us
    JOIN billing_plans bp ON bp.id = us.plan_id
    WHERE us.user_id = p_user_id AND us.status = 'active'
    ORDER BY us.created_at DESC LIMIT 1;

  SELECT
    COUNT(*)                         AS total_ops,
    SUM(credits_used)                AS total_spent,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS ops_24h,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days')  AS ops_30d
  INTO v_usage
  FROM usage_logs
  WHERE user_id = p_user_id AND status = 'success';

  RETURN jsonb_build_object(
    'trial', CASE WHEN v_trial IS NULL THEN NULL ELSE jsonb_build_object(
      'started_at',  v_trial.started_at,
      'ends_at',     v_trial.ends_at,
      'is_active',   v_trial.is_active AND v_trial.ends_at > now(),
      'hours_left',  GREATEST(0, EXTRACT(EPOCH FROM (v_trial.ends_at - now())) / 3600)
    ) END,
    'wallet', CASE WHEN v_wallet IS NULL THEN jsonb_build_object('balance_vx', 0)
              ELSE jsonb_build_object(
                'balance_vx',         v_wallet.balance_vx,
                'lifetime_earned_vx', v_wallet.lifetime_earned_vx,
                'lifetime_spent_vx',  v_wallet.lifetime_spent_vx
              ) END,
    'subscription', CASE WHEN v_sub IS NULL THEN NULL ELSE jsonb_build_object(
      'plan_id',               v_sub.plan_id,
      'plan_name',             v_sub.plan_name,
      'status',                v_sub.status,
      'is_unlimited',          v_sub.is_unlimited,
      'vx_credits_remaining',  v_sub.vx_credits_remaining,
      'vx_credits_monthly',    v_sub.vx_credits_monthly,
      'next_renewal_at',       v_sub.next_renewal_at,
      'features',              v_sub.features,
      'limits',                v_sub.limits
    ) END,
    'usage', jsonb_build_object(
      'total_operations',  COALESCE(v_usage.total_ops, 0),
      'total_credits_spent', COALESCE(v_usage.total_spent, 0),
      'ops_last_24h',      COALESCE(v_usage.ops_24h, 0),
      'ops_last_30d',      COALESCE(v_usage.ops_30d, 0)
    ),
    'can_generate', (
      (v_trial IS NOT NULL AND v_trial.is_active AND v_trial.ends_at > now()) OR
      (v_sub IS NOT NULL AND v_sub.is_unlimited) OR
      (v_sub IS NOT NULL AND v_sub.vx_credits_remaining > 0) OR
      (v_wallet IS NOT NULL AND v_wallet.balance_vx > 0)
    )
  );
END;
$$;
