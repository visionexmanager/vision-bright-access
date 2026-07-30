-- ============================================================
-- Migration: VisionKids Creator & Education Marketplace (Phase 13) — commerce:
-- orders, licenses, reviews, wishlist, reports, analytics, creator earnings.
--
-- PRIVACY / SECURITY: buyer-owned rows are owner-only. Orders, licenses,
-- earnings, and analytics counters are minted ONLY by SECURITY DEFINER RPCs
-- (Phase 13 moderation migration) — no client INSERT policy — so ownership and
-- money can't be forged. Reviews are public when visible; a child can only
-- review a product they own a license to (enforced in add_kids_review).
-- ============================================================

-- ============================================================
-- kids_market_orders — a completed purchase (free or VX-coin). Minted by
-- purchase_kids_product only.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  price_coins INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_market_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_orders: buyer reads" ON public.kids_market_orders FOR SELECT
  USING (auth.uid() = user_id OR public.is_kids_moderator(auth.uid()));
-- No client INSERT: minted by purchase_kids_product (SECURITY DEFINER).

CREATE INDEX IF NOT EXISTS idx_kids_market_orders_user ON public.kids_market_orders(user_id, created_at DESC);

-- ============================================================
-- kids_market_licenses — proof a child owns/may access a product. One per
-- (user, product). Minted by purchase_kids_product.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_licenses (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  order_id    UUID REFERENCES public.kids_market_orders(id) ON DELETE SET NULL,
  license     TEXT NOT NULL DEFAULT 'standard',
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

ALTER TABLE public.kids_market_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_licenses: owner reads" ON public.kids_market_licenses FOR SELECT
  USING (auth.uid() = user_id OR public.is_kids_moderator(auth.uid()));
-- No client INSERT: minted by purchase_kids_product.

-- ============================================================
-- kids_market_reviews — one rating+comment per (product, user). Public when
-- 'visible'. Product rating_avg/count kept in sync by add_kids_review.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment     TEXT,
  likes       INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, user_id)
);

ALTER TABLE public.kids_market_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_reviews: public read visible" ON public.kids_market_reviews FOR SELECT
  USING (status = 'visible' OR auth.uid() = user_id OR public.is_kids_moderator(auth.uid()));
CREATE POLICY "kids_market_reviews: owner updates" ON public.kids_market_reviews FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_market_reviews: owner deletes" ON public.kids_market_reviews FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "kids_market_reviews: moderators manage" ON public.kids_market_reviews FOR ALL
  USING (public.is_kids_moderator(auth.uid())) WITH CHECK (public.is_kids_moderator(auth.uid()));
-- No open INSERT policy: reviews are created via add_kids_review (license-gated).

CREATE INDEX IF NOT EXISTS idx_kids_market_reviews_product ON public.kids_market_reviews(product_id, created_at DESC);

-- ============================================================
-- kids_market_review_likes — a "helpful" tap on a review. Owner-only writes;
-- like count synced onto the review by like_kids_review.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_review_likes (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  review_id  UUID NOT NULL REFERENCES public.kids_market_reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, review_id)
);

ALTER TABLE public.kids_market_review_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_review_likes: owner reads" ON public.kids_market_review_likes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_market_review_likes: owner writes" ON public.kids_market_review_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_market_review_likes: owner deletes" ON public.kids_market_review_likes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- kids_market_review_reports — flag a review for moderator attention.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_review_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES public.kids_market_reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_market_review_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_review_reports: reporter inserts" ON public.kids_market_review_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "kids_market_review_reports: reporter or mod reads" ON public.kids_market_review_reports FOR SELECT
  USING (auth.uid() = reporter_id OR public.is_kids_moderator(auth.uid()));

-- ============================================================
-- kids_market_wishlist — a child's saved products.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_wishlist (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

ALTER TABLE public.kids_market_wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_wishlist: owner reads" ON public.kids_market_wishlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kids_market_wishlist: owner writes" ON public.kids_market_wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_market_wishlist: owner deletes" ON public.kids_market_wishlist FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- kids_market_analytics — per-product daily rollup (views / downloads /
-- completions). Readable by the product's creator + moderators. Counters bumped
-- by SECURITY DEFINER RPCs.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_analytics (
  product_id  UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  day         DATE NOT NULL DEFAULT CURRENT_DATE,
  views       INTEGER NOT NULL DEFAULT 0,
  downloads   INTEGER NOT NULL DEFAULT 0,
  completions INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, day)
);

ALTER TABLE public.kids_market_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_analytics: creator or mod reads" ON public.kids_market_analytics FOR SELECT
  USING (public.is_kids_moderator(auth.uid())
      OR EXISTS (SELECT 1 FROM public.kids_market_products p WHERE p.id = product_id AND p.creator_id = auth.uid()));
-- No client writes: bumped by SECURITY DEFINER RPCs.

-- ============================================================
-- kids_market_creator_earnings — a creator's VX-coin earnings ledger (one row
-- per sale). Minted by purchase_kids_product. Owner reads own.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_creator_earnings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES public.kids_market_orders(id) ON DELETE SET NULL,
  amount_coins INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_market_creator_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_creator_earnings: owner reads" ON public.kids_market_creator_earnings FOR SELECT
  USING (auth.uid() = creator_id OR public.is_kids_moderator(auth.uid()));
-- No client INSERT: minted by purchase_kids_product.

CREATE INDEX IF NOT EXISTS idx_kids_market_earnings_creator ON public.kids_market_creator_earnings(creator_id, created_at DESC);

-- ============================================================
-- kids_market_audit — audit trail of sensitive marketplace actions (purchases,
-- moderation decisions, verification). Written only by SECURITY DEFINER RPCs.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_audit (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_market_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_audit: actor or mod reads" ON public.kids_market_audit FOR SELECT
  USING (auth.uid() = actor_id OR public.is_kids_moderator(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_kids_market_audit_actor ON public.kids_market_audit(actor_id, created_at DESC);
