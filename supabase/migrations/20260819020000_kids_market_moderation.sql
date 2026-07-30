-- ============================================================
-- Migration: VisionKids Creator & Education Marketplace (Phase 13) — the
-- moderation pipeline and every value-moving RPC.
--
-- Kid-safety pipeline: creator submits → AUTOMATED review (keyword + policy
-- checks) → HUMAN moderator review → published. Nothing reaches children
-- without a moderator approving it (also enforced by the products guard trigger
-- in the core migration). Purchases use the real VX wallet via spend_vx; the
-- selling creator is credited directly. All sensitive actions are audited and
-- rate-limited.
-- ============================================================

-- ============================================================
-- kids_market_moderation — one review record per product (its latest state).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_moderation (
  product_id   UUID PRIMARY KEY REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  auto_status  TEXT NOT NULL DEFAULT 'pending' CHECK (auto_status IN ('pending', 'passed', 'flagged')),
  auto_flags   JSONB NOT NULL DEFAULT '[]'::jsonb,
  human_status TEXT NOT NULL DEFAULT 'pending' CHECK (human_status IN ('pending', 'approved', 'rejected')),
  reviewer_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes        TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_market_moderation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_moderation: creator or mod reads" ON public.kids_market_moderation FOR SELECT
  USING (public.is_kids_moderator(auth.uid())
      OR EXISTS (SELECT 1 FROM public.kids_market_products p WHERE p.id = product_id AND p.creator_id = auth.uid()));
-- Writes only via SECURITY DEFINER RPCs below.

CREATE INDEX IF NOT EXISTS idx_kids_market_moderation_queue ON public.kids_market_moderation(human_status, submitted_at);

-- Rate limiter shared by the marketplace RPCs (per action, per minute).
CREATE OR REPLACE FUNCTION public.kids_market_rate_ok(_action TEXT, _max INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _n INTEGER;
BEGIN
  SELECT count(*) INTO _n FROM public.kids_market_audit
  WHERE actor_id = auth.uid() AND action = _action AND created_at > now() - interval '1 minute';
  RETURN _n < _max;
END;
$$;

-- ============================================================
-- run_kids_auto_moderation — automated first-pass content scan. Flags banned
-- words, missing required fields for paid products, and impossible age ranges.
-- Returns { auto_status, flags }. Called from submit_kids_product.
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_kids_auto_moderation(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.kids_market_products%ROWTYPE;
  _flags JSONB := '[]'::jsonb;
  _text TEXT;
  _banned TEXT[] := ARRAY['casino','gambling','weapon','violence','drug','http://','https://bit.ly'];
  _word TEXT;
BEGIN
  SELECT * INTO _p FROM public.kids_market_products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  _text := lower(coalesce(_p.title,'') || ' ' || coalesce(_p.description,''));

  FOREACH _word IN ARRAY _banned LOOP
    IF position(_word IN _text) > 0 THEN
      _flags := _flags || to_jsonb('banned_word:' || _word);
    END IF;
  END LOOP;

  IF length(coalesce(_p.title,'')) < 3 THEN _flags := _flags || to_jsonb('title_too_short'::text); END IF;
  IF length(coalesce(_p.description,'')) < 10 THEN _flags := _flags || to_jsonb('description_too_short'::text); END IF;
  IF _p.price_coins > 0 AND coalesce(_p.file_url,'') = '' THEN _flags := _flags || to_jsonb('paid_without_file'::text); END IF;
  IF _p.age_min > _p.age_max THEN _flags := _flags || to_jsonb('bad_age_range'::text); END IF;

  RETURN jsonb_build_object('auto_status', CASE WHEN jsonb_array_length(_flags) = 0 THEN 'passed' ELSE 'flagged' END, 'flags', _flags);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_kids_auto_moderation(UUID) TO authenticated;

-- ============================================================
-- submit_kids_product — a creator submits their product for review. Sets the
-- product to 'pending', runs auto-moderation, and upserts the moderation row.
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_kids_product(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _p public.kids_market_products%ROWTYPE;
  _auto JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  SELECT * INTO _p FROM public.kids_market_products WHERE id = _product_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF _p.creator_id <> auth.uid() AND NOT public.is_kids_moderator(auth.uid()) THEN
    RAISE EXCEPTION 'Not your product';
  END IF;
  IF NOT public.kids_market_rate_ok('submit', 20) THEN RAISE EXCEPTION 'Submitting too fast — please slow down'; END IF;

  _auto := public.run_kids_auto_moderation(_product_id);

  UPDATE public.kids_market_products SET status = 'pending', updated_at = now() WHERE id = _product_id;

  INSERT INTO public.kids_market_moderation (product_id, auto_status, auto_flags, human_status, submitted_at, updated_at)
  VALUES (_product_id, _auto->>'auto_status', _auto->'flags', 'pending', now(), now())
  ON CONFLICT (product_id) DO UPDATE
    SET auto_status = EXCLUDED.auto_status, auto_flags = EXCLUDED.auto_flags,
        human_status = 'pending', reviewer_id = NULL, submitted_at = now(), updated_at = now();

  INSERT INTO public.kids_market_audit (actor_id, action, detail)
  VALUES (auth.uid(), 'submit_product', jsonb_build_object('product', _product_id, 'auto', _auto));

  RETURN _auto;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_kids_product(UUID) TO authenticated;

-- ============================================================
-- moderate_kids_product — a moderator's human decision. Approve → 'published';
-- reject → 'rejected'. Moderator-gated + audited.
-- ============================================================
CREATE OR REPLACE FUNCTION public.moderate_kids_product(_product_id UUID, _approve BOOLEAN, _notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_kids_moderator(auth.uid()) THEN RAISE EXCEPTION 'Moderators only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids_market_products WHERE id = _product_id) THEN RAISE EXCEPTION 'Product not found'; END IF;

  UPDATE public.kids_market_products
    SET status = CASE WHEN _approve THEN 'published' ELSE 'rejected' END, updated_at = now()
    WHERE id = _product_id;

  INSERT INTO public.kids_market_moderation (product_id, human_status, reviewer_id, notes, updated_at)
  VALUES (_product_id, CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, auth.uid(), _notes, now())
  ON CONFLICT (product_id) DO UPDATE
    SET human_status = EXCLUDED.human_status, reviewer_id = auth.uid(), notes = _notes, updated_at = now();

  INSERT INTO public.kids_market_audit (actor_id, action, detail)
  VALUES (auth.uid(), 'moderate_product', jsonb_build_object('product', _product_id, 'approved', _approve));
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_kids_product(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- verify_kids_creator — a moderator approves/rejects a creator's verification.
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_kids_creator(_user_id UUID, _approve BOOLEAN, _note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_kids_moderator(auth.uid()) THEN RAISE EXCEPTION 'Moderators only'; END IF;

  UPDATE public.kids_market_creators
    SET verified = _approve,
        verification_status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        verification_note = _note, updated_at = now()
    WHERE user_id = _user_id;

  INSERT INTO public.kids_market_audit (actor_id, action, detail)
  VALUES (auth.uid(), 'verify_creator', jsonb_build_object('creator', _user_id, 'approved', _approve));
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_kids_creator(UUID, BOOLEAN, TEXT) TO authenticated;

-- ============================================================
-- purchase_kids_product — acquire a product. Free → grants a license. Paid →
-- spends VX (buyer) via spend_vx, credits the creator's wallet, records order +
-- earnings, grants the license, bumps a download. Idempotent per (user,product).
-- Returns { ok, already_owned }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.purchase_kids_product(_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _p public.kids_market_products%ROWTYPE;
  _order_id UUID;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT public.kids_market_rate_ok('purchase', 30) THEN RAISE EXCEPTION 'Too many purchases — please slow down'; END IF;

  SELECT * INTO _p FROM public.kids_market_products WHERE id = _product_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not available'; END IF;

  IF EXISTS (SELECT 1 FROM public.kids_market_licenses WHERE user_id = _user_id AND product_id = _product_id) THEN
    RETURN jsonb_build_object('ok', true, 'already_owned', true);
  END IF;

  IF _p.price_coins > 0 THEN
    IF _p.creator_id = _user_id THEN RAISE EXCEPTION 'You already own your own product'; END IF;
    -- Spend from the buyer's wallet (raises if insufficient).
    PERFORM public.spend_vx(_p.price_coins, 'kids_market', _p.slug, _p.title);
    -- Credit the seller directly (SECURITY DEFINER; user_points is the wallet).
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_p.creator_id, _p.price_coins, 'Marketplace sale: ' || _p.slug);
  END IF;

  INSERT INTO public.kids_market_orders (user_id, product_id, price_coins)
  VALUES (_user_id, _product_id, _p.price_coins) RETURNING id INTO _order_id;

  INSERT INTO public.kids_market_licenses (user_id, product_id, order_id, license)
  VALUES (_user_id, _product_id, _order_id, _p.license)
  ON CONFLICT (user_id, product_id) DO NOTHING;

  IF _p.price_coins > 0 THEN
    INSERT INTO public.kids_market_creator_earnings (creator_id, product_id, order_id, amount_coins)
    VALUES (_p.creator_id, _product_id, _order_id, _p.price_coins);
  END IF;

  UPDATE public.kids_market_products SET downloads = downloads + 1 WHERE id = _product_id;
  INSERT INTO public.kids_market_analytics (product_id, day, downloads)
  VALUES (_product_id, CURRENT_DATE, 1)
  ON CONFLICT (product_id, day) DO UPDATE SET downloads = public.kids_market_analytics.downloads + 1;

  INSERT INTO public.kids_market_audit (actor_id, action, detail)
  VALUES (_user_id, 'purchase', jsonb_build_object('product', _product_id, 'price', _p.price_coins));

  RETURN jsonb_build_object('ok', true, 'already_owned', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.purchase_kids_product(UUID) TO authenticated;

-- ============================================================
-- add_kids_review — leave/replace a rating+comment. License-gated (you must own
-- the product). Recomputes the product's rating_avg/count.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_kids_review(_product_id UUID, _rating INTEGER, _comment TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _avg NUMERIC;
  _cnt INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _rating < 1 OR _rating > 5 THEN RAISE EXCEPTION 'Rating must be 1-5'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids_market_licenses WHERE user_id = _user_id AND product_id = _product_id) THEN
    RAISE EXCEPTION 'Get the product first to review it';
  END IF;
  IF NOT public.kids_market_rate_ok('review', 15) THEN RAISE EXCEPTION 'Reviewing too fast — please slow down'; END IF;

  INSERT INTO public.kids_market_reviews (product_id, user_id, rating, comment, updated_at)
  VALUES (_product_id, _user_id, _rating, NULLIF(btrim(coalesce(_comment,'')), ''), now())
  ON CONFLICT (product_id, user_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now();

  SELECT round(avg(rating), 2), count(*) INTO _avg, _cnt
  FROM public.kids_market_reviews WHERE product_id = _product_id AND status = 'visible';

  UPDATE public.kids_market_products
    SET rating_avg = COALESCE(_avg, 0), rating_count = COALESCE(_cnt, 0), updated_at = now()
    WHERE id = _product_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_kids_review(UUID, INTEGER, TEXT) TO authenticated;

-- ============================================================
-- like_kids_review — toggle a "helpful" like and keep the count in sync.
-- Returns { liked, likes }.
-- ============================================================
CREATE OR REPLACE FUNCTION public.like_kids_review(_review_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _liked BOOLEAN;
  _cnt INTEGER;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.kids_market_reviews WHERE id = _review_id AND status = 'visible') THEN
    RAISE EXCEPTION 'Review not available';
  END IF;

  IF EXISTS (SELECT 1 FROM public.kids_market_review_likes WHERE user_id = _user_id AND review_id = _review_id) THEN
    DELETE FROM public.kids_market_review_likes WHERE user_id = _user_id AND review_id = _review_id;
    _liked := FALSE;
  ELSE
    INSERT INTO public.kids_market_review_likes (user_id, review_id) VALUES (_user_id, _review_id);
    _liked := TRUE;
  END IF;

  SELECT count(*) INTO _cnt FROM public.kids_market_review_likes WHERE review_id = _review_id;
  UPDATE public.kids_market_reviews SET likes = _cnt WHERE id = _review_id;
  RETURN jsonb_build_object('liked', _liked, 'likes', _cnt);
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_kids_review(UUID) TO authenticated;

-- ============================================================
-- toggle_kids_wishlist — add/remove a product from the wishlist. Returns the
-- new membership boolean.
-- ============================================================
CREATE OR REPLACE FUNCTION public.toggle_kids_wishlist(_product_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _user_id UUID := auth.uid(); _in BOOLEAN;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF EXISTS (SELECT 1 FROM public.kids_market_wishlist WHERE user_id = _user_id AND product_id = _product_id) THEN
    DELETE FROM public.kids_market_wishlist WHERE user_id = _user_id AND product_id = _product_id;
    _in := FALSE;
  ELSE
    INSERT INTO public.kids_market_wishlist (user_id, product_id) VALUES (_user_id, _product_id);
    _in := TRUE;
  END IF;
  RETURN _in;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_kids_wishlist(UUID) TO authenticated;

-- ============================================================
-- report_kids_review — flag a review for moderators.
-- ============================================================
CREATE OR REPLACE FUNCTION public.report_kids_review(_review_id UUID, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT public.kids_market_rate_ok('report', 10) THEN RAISE EXCEPTION 'Reporting too fast'; END IF;
  INSERT INTO public.kids_market_review_reports (review_id, reporter_id, reason)
  VALUES (_review_id, auth.uid(), left(coalesce(_reason,''), 300));
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_kids_review(UUID, TEXT) TO authenticated;

-- ============================================================
-- record_kids_product_view — best-effort daily view counter bump (rate-limited).
-- ============================================================
CREATE OR REPLACE FUNCTION public.record_kids_product_view(_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT public.kids_market_rate_ok('view', 120) THEN RETURN; END IF;
  INSERT INTO public.kids_market_analytics (product_id, day, views)
  VALUES (_product_id, CURRENT_DATE, 1)
  ON CONFLICT (product_id, day) DO UPDATE SET views = public.kids_market_analytics.views + 1;
  INSERT INTO public.kids_market_audit (actor_id, action, detail)
  VALUES (auth.uid(), 'view', jsonb_build_object('product', _product_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_kids_product_view(UUID) TO authenticated;

-- ============================================================
-- get_kids_creator_stats — dashboard aggregate for the signed-in creator:
-- counts by status, total downloads, total earnings, average rating.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_kids_creator_stats()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _published INTEGER := 0; _pending INTEGER := 0; _draft INTEGER := 0; _rejected INTEGER := 0;
  _downloads INTEGER := 0; _earnings BIGINT := 0; _avg NUMERIC := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('published',0,'pending',0,'draft',0,'rejected',0,'downloads',0,'earnings',0,'avg_rating',0);
  END IF;

  SELECT
    count(*) FILTER (WHERE status = 'published'),
    count(*) FILTER (WHERE status = 'pending'),
    count(*) FILTER (WHERE status = 'draft'),
    count(*) FILTER (WHERE status = 'rejected'),
    COALESCE(sum(downloads), 0),
    COALESCE(round(avg(NULLIF(rating_avg, 0)), 2), 0)
  INTO _published, _pending, _draft, _rejected, _downloads, _avg
  FROM public.kids_market_products WHERE creator_id = _uid;

  SELECT COALESCE(sum(amount_coins), 0) INTO _earnings FROM public.kids_market_creator_earnings WHERE creator_id = _uid;

  RETURN jsonb_build_object(
    'published', _published, 'pending', _pending, 'draft', _draft, 'rejected', _rejected,
    'downloads', _downloads, 'earnings', _earnings, 'avg_rating', _avg
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_kids_creator_stats() TO authenticated;
