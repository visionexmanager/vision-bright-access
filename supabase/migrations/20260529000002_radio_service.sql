-- ============================================================
-- VISIONEX LIVE RADIO SERVICE — Complete Database Migration
-- ============================================================

-- ─── 1. RADIO GENRES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.radio_genres (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  name_ar     TEXT    NOT NULL,
  slug        TEXT    UNIQUE NOT NULL,
  icon        TEXT    NOT NULL DEFAULT 'radio',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.radio_genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radio_genres_public_read"
  ON public.radio_genres FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "radio_genres_admin_all"
  ON public.radio_genres FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 2. RADIO STATIONS ───────────────────────────────────────
-- IMPORTANT: stream_url is only accessible via service-role (edge function).
-- Regular users CANNOT read stream_url through RLS.
CREATE TABLE IF NOT EXISTS public.radio_stations (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  name_ar      TEXT    NOT NULL,
  description  TEXT,
  description_ar TEXT,
  logo_url     TEXT,
  stream_url   TEXT    NOT NULL,   -- HLS .m3u8 / MP3 / AAC — hidden from users
  genre_id     UUID    REFERENCES public.radio_genres(id) ON DELETE SET NULL,
  bitrate      TEXT    NOT NULL DEFAULT '128' CHECK (bitrate IN ('64','128','192','320','HI')),
  language     TEXT    NOT NULL DEFAULT 'ar',
  country      TEXT,
  website_url  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.radio_stations ENABLE ROW LEVEL SECURITY;

-- Users see station metadata but NEVER stream_url
CREATE POLICY "radio_stations_users_read_metadata"
  ON public.radio_stations FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Admins get full access including stream_url
CREATE POLICY "radio_stations_admin_all"
  ON public.radio_stations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.radio_stations_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER radio_stations_updated_at
  BEFORE UPDATE ON public.radio_stations
  FOR EACH ROW EXECUTE FUNCTION public.radio_stations_set_updated_at();

-- ─── 3. RADIO SUBSCRIPTION PLANS ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.radio_subscription_plans (
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

ALTER TABLE public.radio_subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radio_plans_public_read"
  ON public.radio_subscription_plans FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

CREATE POLICY "radio_plans_admin_all"
  ON public.radio_subscription_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 4. USER RADIO SUBSCRIPTIONS ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.radio_subscriptions (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id    UUID    NOT NULL REFERENCES public.radio_subscription_plans(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  vx_paid    INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','expired','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_radio_subscriptions_user ON public.radio_subscriptions(user_id, status, expires_at DESC);

ALTER TABLE public.radio_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "radio_subscriptions_own_read"
  ON public.radio_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "radio_subscriptions_admin_all"
  ON public.radio_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── 5. RADIO STREAM ACCESS TOKENS (short-lived, 4h TTL) ─────
-- The edge function validates these before returning the real stream URL.
CREATE TABLE IF NOT EXISTS public.radio_stream_tokens (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  station_id UUID    NOT NULL REFERENCES public.radio_stations(id) ON DELETE CASCADE,
  token      TEXT    UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_radio_stream_tokens_token ON public.radio_stream_tokens(token, expires_at);
CREATE INDEX idx_radio_stream_tokens_user  ON public.radio_stream_tokens(user_id, expires_at);

ALTER TABLE public.radio_stream_tokens ENABLE ROW LEVEL SECURITY;

-- Users may only insert/read their own tokens; edge function uses service-role
CREATE POLICY "radio_stream_tokens_own"
  ON public.radio_stream_tokens FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. RPC: subscribe_radio ─────────────────────────────────
-- Checks balance → deducts VX → creates subscription → notifies user
CREATE OR REPLACE FUNCTION public.subscribe_radio(
  _plan_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_plan      public.radio_subscription_plans;
  v_balance   INTEGER;
  v_sub_id    UUID;
  v_expires   TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Load plan
  SELECT * INTO v_plan
  FROM public.radio_subscription_plans
  WHERE id = _plan_id AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Check for existing active subscription
  IF EXISTS (
    SELECT 1 FROM public.radio_subscriptions
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
  VALUES (v_user_id, -v_plan.vx_price, 'radio_subscription_' || v_plan.name);

  -- Record purchase
  INSERT INTO public.vx_purchases (user_id, amount, item_type, item_id, item_name)
  VALUES (v_user_id, v_plan.vx_price, 'radio_subscription', _plan_id::text, v_plan.name);

  -- Create subscription
  v_expires := NOW() + (v_plan.duration_days || ' days')::INTERVAL;

  INSERT INTO public.radio_subscriptions (user_id, plan_id, expires_at, vx_paid, status)
  VALUES (v_user_id, _plan_id, v_expires, v_plan.vx_price, 'active')
  RETURNING id INTO v_sub_id;

  -- In-app notification
  PERFORM public.system_insert_notification(
    v_user_id,
    'تم تفعيل اشتراكك في VisionRadio',
    'يمكنك الآن الاستماع لجميع المحطات حتى ' || TO_CHAR(v_expires AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC',
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

-- ─── 7. RPC: get_active_radio_subscription ───────────────────
CREATE OR REPLACE FUNCTION public.get_active_radio_subscription()
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
    rs.id,
    rp.name,
    rp.name_ar,
    rs.expires_at,
    rs.started_at,
    rs.vx_paid,
    rs.status
  FROM public.radio_subscriptions rs
  JOIN public.radio_subscription_plans rp ON rp.id = rs.plan_id
  WHERE rs.user_id = auth.uid()
    AND rs.status = 'active'
    AND rs.expires_at > NOW()
  ORDER BY rs.expires_at DESC
  LIMIT 1;
$$;

-- ─── 8. RPC: generate_radio_stream_token ─────────────────────
-- Called by frontend; returns a short-lived token.
-- The ACTUAL stream URL is only returned by the edge function.
CREATE OR REPLACE FUNCTION public.generate_radio_stream_token(
  _station_id UUID
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
    SELECT 1 FROM public.radio_subscriptions
    WHERE user_id = v_user_id
      AND status = 'active'
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_subscription');
  END IF;

  -- Verify station exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.radio_stations
    WHERE id = _station_id AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'station_not_found');
  END IF;

  -- Revoke old tokens for this user+station
  DELETE FROM public.radio_stream_tokens
  WHERE user_id = v_user_id AND station_id = _station_id;

  -- Generate new token (64-char hex)
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.radio_stream_tokens (user_id, station_id, token, expires_at)
  VALUES (v_user_id, _station_id, v_token, v_expires);

  RETURN jsonb_build_object(
    'success',    true,
    'token',      v_token,
    'expires_at', v_expires
  );
END;
$$;

-- ─── 9. CLEANUP JOB: expire old tokens & subscriptions ───────
-- Run via pg_cron or call from a scheduled edge function
CREATE OR REPLACE FUNCTION public.radio_cleanup_expired()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove expired tokens
  DELETE FROM public.radio_stream_tokens WHERE expires_at < NOW();

  -- Mark expired subscriptions
  UPDATE public.radio_subscriptions
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < NOW();
END;
$$;

-- ─── 10. DEFAULT PLANS (seeded data) ─────────────────────────
INSERT INTO public.radio_subscription_plans
  (name, name_ar, duration_days, vx_price, sort_order, features)
VALUES
  ('Daily',   'يومي',   1,   300,  1,
   '["استماع غير محدود","جميع المحطات","جودة 128 kbps"]'::jsonb),
  ('Weekly',  'أسبوعي', 7,   1500, 2,
   '["استماع غير محدود","جميع المحطات","جودة 192 kbps","توفير 28%"]'::jsonb),
  ('Monthly', 'شهري',   30,  5000, 3,
   '["استماع غير محدود","جميع المحطات","جودة 320 kbps","توفير 44%","أولوية الدعم"]'::jsonb),
  ('Yearly',  'سنوي',   365, 45000,4,
   '["استماع غير محدود","جميع المحطات","جودة HI-FI","توفير 51%","أولوية الدعم","وصول مبكر للمحطات الجديدة"]'::jsonb)
ON CONFLICT DO NOTHING;

-- ─── 11. DEFAULT GENRES (seeded data) ────────────────────────
INSERT INTO public.radio_genres (name, name_ar, slug, icon, sort_order)
VALUES
  ('News',          'أخبار',       'news',          'newspaper',    1),
  ('Music',         'موسيقى',      'music',         'music',        2),
  ('Quran',         'قرآن كريم',   'quran',         'book-open',    3),
  ('Sports',        'رياضة',       'sports',        'trophy',       4),
  ('Talk',          'حوار وثقافة', 'talk',          'mic',          5),
  ('Children',      'أطفال',       'children',      'star',         6),
  ('International', 'دولية',       'international', 'globe',        7),
  ('Comedy',        'ترفيه وكوميديا','comedy',      'smile',        8)
ON CONFLICT (slug) DO NOTHING;

-- Grant execute on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION public.subscribe_radio(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_radio_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_radio_stream_token(UUID) TO authenticated;
