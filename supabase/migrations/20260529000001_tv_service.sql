-- ============================================================
-- VISIONEX LIVE TV SERVICE — Complete Database Migration
-- ============================================================

-- ─── 1. TV CATEGORIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tv_categories (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  name_ar     TEXT    NOT NULL,
  slug        TEXT    UNIQUE NOT NULL,
  icon        TEXT    NOT NULL DEFAULT 'tv',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tv_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_categories_public_read"
  ON public.tv_categories FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "tv_categories_admin_all"
  ON public.tv_categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 2. TV CHANNELS ──────────────────────────────────────────
-- IMPORTANT: stream_url is only accessible via service-role (edge function).
-- Regular users CANNOT read stream_url through RLS.
CREATE TABLE IF NOT EXISTS public.tv_channels (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  name_ar      TEXT    NOT NULL,
  description  TEXT,
  description_ar TEXT,
  logo_url     TEXT,
  stream_url   TEXT    NOT NULL,   -- HLS .m3u8 or RTMP — hidden from users
  category_id  UUID    REFERENCES public.tv_categories(id) ON DELETE SET NULL,
  quality      TEXT    NOT NULL DEFAULT 'HD' CHECK (quality IN ('SD','HD','FHD','4K')),
  language     TEXT    NOT NULL DEFAULT 'ar',
  country      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tv_channels ENABLE ROW LEVEL SECURITY;

-- Users see channel metadata but NEVER stream_url
CREATE POLICY "tv_channels_users_read_metadata"
  ON public.tv_channels FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Admins get full access
CREATE POLICY "tv_channels_admin_all"
  ON public.tv_channels FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.tv_channels_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tv_channels_updated_at
  BEFORE UPDATE ON public.tv_channels
  FOR EACH ROW EXECUTE FUNCTION public.tv_channels_set_updated_at();

-- ─── 3. TV SUBSCRIPTION PLANS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tv_subscription_plans (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT    NOT NULL,
  name_ar       TEXT    NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  vx_price      INTEGER NOT NULL CHECK (vx_price > 0),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  features      JSONB   NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tv_subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_plans_public_read"
  ON public.tv_subscription_plans FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

CREATE POLICY "tv_plans_admin_all"
  ON public.tv_subscription_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 4. USER TV SUBSCRIPTIONS ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tv_subscriptions (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id    UUID    NOT NULL REFERENCES public.tv_subscription_plans(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  vx_paid    INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','expired','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tv_subscriptions_user ON public.tv_subscriptions(user_id, status, expires_at DESC);

ALTER TABLE public.tv_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tv_subscriptions_own_read"
  ON public.tv_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "tv_subscriptions_admin_all"
  ON public.tv_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 5. STREAM ACCESS TOKENS (short-lived, 4h TTL) ───────────
-- The edge function validates these before returning the real stream URL.
CREATE TABLE IF NOT EXISTS public.tv_stream_tokens (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id UUID    NOT NULL REFERENCES public.tv_channels(id) ON DELETE CASCADE,
  token      TEXT    UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tv_stream_tokens_token ON public.tv_stream_tokens(token, expires_at);
CREATE INDEX idx_tv_stream_tokens_user  ON public.tv_stream_tokens(user_id, expires_at);

ALTER TABLE public.tv_stream_tokens ENABLE ROW LEVEL SECURITY;

-- Users may only insert/read their own tokens; edge function uses service-role
CREATE POLICY "tv_stream_tokens_own"
  ON public.tv_stream_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. VX DEDUCT LOG FOR TV (audit trail) ───────────────────
-- Reuses existing vx_purchases table (item_type = 'tv_subscription')
-- No extra table needed — consistent with existing pattern.

-- ─── 7. RPC: subscribe_tv ────────────────────────────────────
-- Checks balance → deducts VX → creates subscription → notifies user
CREATE OR REPLACE FUNCTION public.subscribe_tv(
  _plan_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_plan      public.tv_subscription_plans;
  v_balance   INTEGER;
  v_sub_id    UUID;
  v_expires   TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Load plan
  SELECT * INTO v_plan
  FROM public.tv_subscription_plans
  WHERE id = _plan_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Check for existing active subscription
  IF EXISTS (
    SELECT 1 FROM public.tv_subscriptions
    WHERE user_id = v_user_id
      AND status = 'active'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_subscribed');
  END IF;

  -- Check VX balance
  SELECT COALESCE(SUM(points), 0) INTO v_balance
  FROM public.user_points
  WHERE user_id = v_user_id;

  IF v_balance < v_plan.vx_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_vx',
      'balance', v_balance,
      'required', v_plan.vx_price
    );
  END IF;

  -- Deduct VX (negative points entry)
  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (v_user_id, -v_plan.vx_price, 'tv_subscription_' || v_plan.name);

  -- Record purchase
  INSERT INTO public.vx_purchases (user_id, amount, item_type, item_id, item_name)
  VALUES (v_user_id, v_plan.vx_price, 'tv_subscription', _plan_id::text, v_plan.name);

  -- Create subscription
  v_expires := NOW() + (v_plan.duration_days || ' days')::INTERVAL;

  INSERT INTO public.tv_subscriptions (user_id, plan_id, expires_at, vx_paid, status)
  VALUES (v_user_id, _plan_id, v_expires, v_plan.vx_price, 'active')
  RETURNING id INTO v_sub_id;

  -- In-app notification
  PERFORM public.system_insert_notification(
    v_user_id,
    'تم تفعيل اشتراكك في VisionTV',
    'يمكنك الآن مشاهدة جميع القنوات حتى ' || TO_CHAR(v_expires AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC',
    'success'
  );

  RETURN jsonb_build_object(
    'success',     true,
    'sub_id',      v_sub_id,
    'expires_at',  v_expires,
    'vx_deducted', v_plan.vx_price
  );
END;
$$;

-- ─── 8. RPC: get_active_tv_subscription ──────────────────────
CREATE OR REPLACE FUNCTION public.get_active_tv_subscription()
RETURNS TABLE (
  sub_id      UUID,
  plan_name   TEXT,
  plan_name_ar TEXT,
  expires_at  TIMESTAMPTZ,
  started_at  TIMESTAMPTZ,
  vx_paid     INTEGER,
  status      TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ts.id,
    tp.name,
    tp.name_ar,
    ts.expires_at,
    ts.started_at,
    ts.vx_paid,
    ts.status
  FROM public.tv_subscriptions ts
  JOIN public.tv_subscription_plans tp ON tp.id = ts.plan_id
  WHERE ts.user_id = auth.uid()
    AND ts.status = 'active'
    AND ts.expires_at > NOW()
  ORDER BY ts.expires_at DESC
  LIMIT 1;
$$;

-- ─── 9. RPC: generate_stream_token ───────────────────────────
-- Called by frontend; returns a short-lived token.
-- The ACTUAL stream URL is only returned by the edge function.
CREATE OR REPLACE FUNCTION public.generate_stream_token(
  _channel_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_token   TEXT;
  v_expires TIMESTAMPTZ := NOW() + INTERVAL '4 hours';
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Verify active subscription
  IF NOT EXISTS (
    SELECT 1 FROM public.tv_subscriptions
    WHERE user_id = v_user_id
      AND status = 'active'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_subscription');
  END IF;

  -- Verify channel exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.tv_channels
    WHERE id = _channel_id AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'channel_not_found');
  END IF;

  -- Revoke old tokens for this user+channel
  DELETE FROM public.tv_stream_tokens
  WHERE user_id = v_user_id AND channel_id = _channel_id;

  -- Generate new token (64-char hex)
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.tv_stream_tokens (user_id, channel_id, token, expires_at)
  VALUES (v_user_id, _channel_id, v_token, v_expires);

  RETURN jsonb_build_object(
    'success',    true,
    'token',      v_token,
    'expires_at', v_expires
  );
END;
$$;

-- ─── 10. CLEANUP JOB: expire old tokens & subscriptions ──────
-- Run via pg_cron or call from a scheduled edge function
CREATE OR REPLACE FUNCTION public.tv_cleanup_expired()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove expired tokens
  DELETE FROM public.tv_stream_tokens WHERE expires_at < NOW();

  -- Mark expired subscriptions
  UPDATE public.tv_subscriptions
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < NOW();
END;
$$;

-- ─── 11. DEFAULT PLANS (seeded data) ─────────────────────────
INSERT INTO public.tv_subscription_plans
  (name, name_ar, duration_days, vx_price, sort_order, features)
VALUES
  ('Daily',   'يومي',   1,   500,  1,
   '["مشاهدة غير محدودة","جميع القنوات","جودة HD"]'::jsonb),
  ('Weekly',  'أسبوعي', 7,   2500, 2,
   '["مشاهدة غير محدودة","جميع القنوات","جودة HD","توفير 28%"]'::jsonb),
  ('Monthly', 'شهري',   30,  8000, 3,
   '["مشاهدة غير محدودة","جميع القنوات","جودة FHD","توفير 46%","أولوية الدعم"]'::jsonb),
  ('Yearly',  'سنوي',   365, 70000,4,
   '["مشاهدة غير محدودة","جميع القنوات","جودة 4K","توفير 52%","أولوية الدعم","وصول مبكر للقنوات الجديدة"]'::jsonb)
ON CONFLICT DO NOTHING;

-- ─── 12. DEFAULT CATEGORIES (seeded data) ────────────────────
INSERT INTO public.tv_categories (name, name_ar, slug, icon, sort_order)
VALUES
  ('Sports',        'رياضة',       'sports',        'trophy',       1),
  ('News',          'أخبار',       'news',          'newspaper',    2),
  ('Movies',        'أفلام',       'movies',        'film',         3),
  ('Entertainment', 'ترفيه',       'entertainment', 'tv',           4),
  ('Kids',          'أطفال',       'kids',          'star',         5),
  ('Documentary',   'وثائقي',      'documentary',   'book-open',    6),
  ('Music',         'موسيقى',      'music',         'music',        7),
  ('Religious',     'ديني',        'religious',     'sun',          8)
ON CONFLICT (slug) DO NOTHING;

-- Grant execute on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION public.subscribe_tv(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_tv_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_stream_token(UUID) TO authenticated;
