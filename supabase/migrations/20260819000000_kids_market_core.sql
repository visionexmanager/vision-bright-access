-- ============================================================
-- Migration: VisionKids Creator & Education Marketplace (Phase 13) — core.
--
-- A professional marketplace where teachers, publishers, creators, and
-- developers publish SAFE, kid-appropriate educational content. Architecture
-- (same polymorphic discipline as every prior phase): ONE kids_market_products
-- catalog holds EVERY content type (course, book, game, worksheet, 3D model,
-- AI prompt, bundle, …), discriminated by `type`. Adding a new content type is
-- a CHECK value + UI wrapper — never a new table. Scales to tens of thousands.
--
-- SAFETY (the core property): nothing reaches children un-reviewed. Products
-- flow draft → pending → published|rejected, and a BEFORE trigger forbids any
-- non-moderator from moving a product to 'published'. Public read is limited to
-- 'published' rows. The Marketplace is VX-coin-only for kids (spend_vx wallet);
-- NO real-money path exists in the kids surface.
-- ============================================================

-- Designated content moderators (admins are always moderators). Populated by
-- admins; gate for the human-review actions in the moderation migration.
CREATE TABLE IF NOT EXISTS public.kids_market_moderators (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_market_moderators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_moderators: public read" ON public.kids_market_moderators FOR SELECT USING (true);
CREATE POLICY "kids_market_moderators: admins manage" ON public.kids_market_moderators FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_kids_moderator(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (SELECT 1 FROM public.kids_market_moderators WHERE user_id = _user_id);
$$;

-- ============================================================
-- kids_market_creators — a seller profile. ONE table for every seller role via
-- `kind` (creator | publisher | developer | teacher). Verification is a
-- separate, moderator-approved flag so a "verified" badge means something.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_creators (
  user_id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT NOT NULL,
  kind                TEXT NOT NULL DEFAULT 'creator' CHECK (kind IN ('creator', 'publisher', 'developer', 'teacher')),
  bio                 TEXT,
  avatar              TEXT NOT NULL DEFAULT '🧑‍🏫',
  verified            BOOLEAN NOT NULL DEFAULT FALSE,
  verification_status TEXT NOT NULL DEFAULT 'none' CHECK (verification_status IN ('none', 'pending', 'approved', 'rejected')),
  verification_note   TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_market_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kids_market_creators: public read" ON public.kids_market_creators FOR SELECT USING (true);
CREATE POLICY "kids_market_creators: owner inserts" ON public.kids_market_creators FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_market_creators: owner updates" ON public.kids_market_creators FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kids_market_creators: admins manage" ON public.kids_market_creators FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Guard: a creator can never set their own verified flag / verification_status
-- to approved — only a moderator RPC does that.
CREATE OR REPLACE FUNCTION public.kids_market_creators_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_kids_moderator(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified := FALSE;
      IF NEW.verification_status = 'approved' THEN NEW.verification_status := 'none'; END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.verified := OLD.verified;
      IF NEW.verification_status = 'approved' AND OLD.verification_status <> 'approved' THEN
        NEW.verification_status := OLD.verification_status;
      END IF;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kids_market_creators_guard ON public.kids_market_creators;
CREATE TRIGGER trg_kids_market_creators_guard
  BEFORE INSERT OR UPDATE ON public.kids_market_creators
  FOR EACH ROW EXECUTE FUNCTION public.kids_market_creators_guard();

-- ============================================================
-- kids_market_categories — subject categories for browse/search facets.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_categories (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '📦',
  order_index INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft'))
);

ALTER TABLE public.kids_market_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_categories: public read" ON public.kids_market_categories FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_market_categories: admins manage" ON public.kids_market_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_market_categories (slug, title, emoji, order_index) VALUES
  ('literacy',   'Reading & Literacy', '📚', 0),
  ('math',       'Math',               '➗', 1),
  ('science',    'Science',            '🔬', 2),
  ('arts',       'Arts & Music',       '🎨', 3),
  ('coding',     'Coding',             '💻', 4),
  ('languages',  'Languages',          '🗣️', 5),
  ('life-skills','Life Skills',        '🌱', 6),
  ('games',      'Learning Games',     '🎮', 7)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- kids_market_products — THE polymorphic product catalog. `type` selects the
-- content kind; `content`/`file_url` carry the asset. `status` is the review
-- lifecycle. Rich facets (age range, language, level, price) power search.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_products (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN (
                  'course','book','game','template','music','video','worksheet',
                  'model3d','prompt','bundle','story','activity','pdf','epub','audio','character','puzzle','sfx')),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  emoji         TEXT NOT NULL DEFAULT '📦',
  thumbnail_url TEXT,
  category      TEXT NOT NULL DEFAULT 'literacy',
  age_min       INTEGER NOT NULL DEFAULT 3 CHECK (age_min >= 0 AND age_min <= 18),
  age_max       INTEGER NOT NULL DEFAULT 12 CHECK (age_max >= 0 AND age_max <= 18),
  language      TEXT NOT NULL DEFAULT 'en',
  level         TEXT NOT NULL DEFAULT 'all' CHECK (level IN ('beginner','intermediate','advanced','all')),
  price_coins   INTEGER NOT NULL DEFAULT 0 CHECK (price_coins >= 0 AND price_coins <= 1000000),
  is_free       BOOLEAN NOT NULL DEFAULT TRUE,
  license       TEXT NOT NULL DEFAULT 'standard' CHECK (license IN ('standard','extended','personal','cc')),
  file_url      TEXT,
  preview_url   TEXT,
  content       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','published','rejected')),
  downloads     INTEGER NOT NULL DEFAULT 0,
  rating_avg    NUMERIC(3,2) NOT NULL DEFAULT 0,
  rating_count  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kids_market_products ENABLE ROW LEVEL SECURITY;

-- Public sees ONLY published products; creators see their own; moderators/admins see all.
CREATE POLICY "kids_market_products: public read published"
  ON public.kids_market_products FOR SELECT
  USING (status = 'published' OR auth.uid() = creator_id OR public.is_kids_moderator(auth.uid()));
CREATE POLICY "kids_market_products: creator inserts"
  ON public.kids_market_products FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "kids_market_products: creator updates"
  ON public.kids_market_products FOR UPDATE
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "kids_market_products: creator deletes"
  ON public.kids_market_products FOR DELETE USING (auth.uid() = creator_id);
CREATE POLICY "kids_market_products: moderators manage"
  ON public.kids_market_products FOR ALL
  USING (public.is_kids_moderator(auth.uid())) WITH CHECK (public.is_kids_moderator(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_kids_market_products_browse ON public.kids_market_products(status, type, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kids_market_products_creator ON public.kids_market_products(creator_id, created_at DESC);

-- Guard: the CRITICAL kid-safety property. A non-moderator can only ever leave
-- a product in 'draft' or 'pending'. Only a moderator (via SECURITY DEFINER RPC
-- or direct as admin) may set 'published' or 'rejected'. Also keeps is_free in
-- sync with price and validates the age range.
CREATE OR REPLACE FUNCTION public.kids_market_products_guard()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.is_free := (NEW.price_coins = 0);
  IF NEW.age_max < NEW.age_min THEN NEW.age_max := NEW.age_min; END IF;
  NEW.updated_at := now();

  IF public.is_kids_moderator(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('draft', 'pending') THEN NEW.status := 'draft'; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- A creator may move draft/rejected → pending (submit) or back to draft,
    -- but can never self-publish or self-approve.
    IF NEW.status IN ('published', 'rejected') AND OLD.status <> NEW.status THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kids_market_products_guard ON public.kids_market_products;
CREATE TRIGGER trg_kids_market_products_guard
  BEFORE INSERT OR UPDATE ON public.kids_market_products
  FOR EACH ROW EXECUTE FUNCTION public.kids_market_products_guard();

-- ============================================================
-- kids_market_bundle_items — a 'bundle' product groups other products.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.kids_market_bundle_items (
  bundle_id   UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.kids_market_products(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_id, product_id)
);

ALTER TABLE public.kids_market_bundle_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_market_bundle_items: public read" ON public.kids_market_bundle_items FOR SELECT USING (true);
CREATE POLICY "kids_market_bundle_items: bundle owner manages"
  ON public.kids_market_bundle_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.kids_market_products p WHERE p.id = bundle_id AND (p.creator_id = auth.uid() OR public.is_kids_moderator(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.kids_market_products p WHERE p.id = bundle_id AND (p.creator_id = auth.uid() OR public.is_kids_moderator(auth.uid()))));
