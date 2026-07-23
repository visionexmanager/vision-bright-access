-- ============================================================
-- Migration: Library Book Marketplace (Phase 10)
--
-- Purpose: the storefront layer on top of the existing catalog/Publishing
-- Studio — curated collections (covers Editor's Choice/Staff Picks/Award
-- Winners/Seasonal in one mechanism), series, awards, a Library-specific
-- wishlist, gift purchases, corporate/educational/family licenses, a
-- Publisher store, review media/verified-purchase/helpful-votes, book-level
-- semantic search, achievements (finally giving the orphaned Phase 6.5
-- tables a write path), daily rewards, referrals, and widening
-- library_purchases.payment_method for the new payment rails (Phase 10
-- edge functions). Reuses is_library_book_owner/can_edit_library_book/
-- has_role/touch_updated_at/bump_library_daily_stat/award_library_xp/
-- has_purchased_library_book throughout — no ownership/access primitive is
-- reinvented.
-- ============================================================

-- ============================================================
-- 1. Collections — one mechanism for Editor's Choice / Staff Picks / Award
-- Winners / Seasonal / Curated, not four separate ad-hoc tables. Also
-- covers the Audiobook Platform's identical "Collections/Award Winners/
-- Editor's Choice" asks for free, since audiobooks are library_books rows
-- (book_type='audiobook') — no separate audiobook-collections table needed.
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_collection_type AS ENUM ('editors_choice', 'staff_pick', 'award_winner', 'seasonal', 'curated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_collections (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_type public.library_collection_type NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  description     TEXT,
  cover_image_url TEXT,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_collections: public read active"
  ON public.library_collections FOR SELECT
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  );

CREATE POLICY "library_collections: admin manages"
  ON public.library_collections FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS library_collections_updated_at ON public.library_collections;
CREATE TRIGGER library_collections_updated_at
  BEFORE UPDATE ON public.library_collections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.library_collection_books (
  collection_id UUID NOT NULL REFERENCES public.library_collections(id) ON DELETE CASCADE,
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, book_id)
);

ALTER TABLE public.library_collection_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_collection_books: public read" ON public.library_collection_books FOR SELECT USING (true);
CREATE POLICY "library_collection_books: admin manages"
  ON public.library_collection_books FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_collection_books_collection ON public.library_collection_books(collection_id, display_order);

-- "Popular Publishers" needs no table — it's a GROUP BY aggregation query
-- over existing library_books/library_book_daily_stats, computed in a new
-- frontend hook, not schema.

-- ============================================================
-- 2. library_books additions: Coming Soon needs no new column (reuses
-- published_date > now()); Flash Deals reuse library_coupons + this one
-- column (drives the homepage countdown badge without scanning coupons).
-- ============================================================
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS flash_deal_ends_at TIMESTAMPTZ;

-- ============================================================
-- 3. Series
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_series (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  cover_image_url TEXT,
  author_id       UUID REFERENCES public.library_authors(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_series: public read" ON public.library_series FOR SELECT USING (true);
CREATE POLICY "library_series: author/admin manage"
  ON public.library_series FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (author_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.library_authors a WHERE a.id = author_id AND a.user_id = auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (author_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.library_authors a WHERE a.id = author_id AND a.user_id = auth.uid()))
  );

ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.library_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_position INTEGER;

CREATE INDEX IF NOT EXISTS idx_library_books_series ON public.library_books(series_id, series_position);

-- ============================================================
-- 4. Awards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_awards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  awarding_body TEXT,
  year          INTEGER,
  rank          TEXT,
  icon_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_awards: public read" ON public.library_book_awards FOR SELECT USING (true);
CREATE POLICY "library_book_awards: owner/admin manage"
  ON public.library_book_awards FOR ALL
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_book_awards_book ON public.library_book_awards(book_id);

-- library_book_files.file_size_bytes already exists
-- (20260720000000_library_core_catalog.sql) — nothing to add here.

-- ============================================================
-- 5. Wishlist — Library-specific (distinct from the generic, unrelated
-- `wishlists` table used elsewhere in the app for other products).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_wishlist (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id    UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id)
);

ALTER TABLE public.library_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_wishlist: user manages own"
  ON public.library_wishlist FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 6. Gift purchases — extends library_purchases, no new table.
-- ============================================================
-- recipient_email is the pending identifier a gift is bought against before
-- it resolves to a real account: profiles has no public email/username
-- lookup (by design — its RLS is strictly "own row only"), so the giver's
-- client can never resolve an arbitrary email to a user_id itself. The
-- checkout edge function resolves it server-side via
-- find_user_id_by_email() (service_role only, see below) at purchase time;
-- if the email doesn't match an existing account yet, handle_new_user()
-- backfills recipient_user_id the moment that person signs up.
ALTER TABLE public.library_purchases
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS gift_message TEXT,
  ADD COLUMN IF NOT EXISTS gifted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Deliberately NOT granted to anon/authenticated — an email-existence oracle
-- would let anyone probe which addresses have accounts. Only callable via
-- the service-role client (library-checkout-session's gift branch).
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email TEXT)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.find_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_id_by_email(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.has_purchased_library_book(_book_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_purchases
    WHERE book_id = _book_id AND status IN ('paid', 'completed')
      AND (buyer_id = auth.uid() OR (recipient_user_id = auth.uid()))
  )
$$;

-- A recipient must also be able to SELECT their own gifted purchase row
-- (the existing "buyer reads own" policy only covers buyer_id).
CREATE POLICY "library_purchases: recipient reads own gift"
  ON public.library_purchases FOR SELECT
  USING (auth.uid() = recipient_user_id);

-- ============================================================
-- 7. Licenses — corporate / educational / family sharing.
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_license_type AS ENUM ('individual', 'corporate', 'educational', 'family');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.library_licenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  purchaser_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  license_type  public.library_license_type NOT NULL,
  seat_count    INTEGER NOT NULL DEFAULT 1 CHECK (seat_count > 0),
  purchase_id   UUID REFERENCES public.library_purchases(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_licenses: purchaser reads own"
  ON public.library_licenses FOR SELECT
  USING (auth.uid() = purchaser_id OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

-- id is a surrogate PK (not (license_id, user_id)) specifically because a
-- seat starts life as an invited_email-only row with user_id NULL — a
-- composite PRIMARY KEY would make user_id implicitly NOT NULL and reject
-- exactly that insert. Uniqueness for claimed seats is enforced separately
-- via the partial index below.
CREATE TABLE IF NOT EXISTS public.library_license_seats (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id    UUID NOT NULL REFERENCES public.library_licenses(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT,
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'revoked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_library_license_seats_license_user
  ON public.library_license_seats(license_id, user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.library_license_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_license_seats: seat holder or license owner reads"
  ON public.library_license_seats FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.library_licenses l WHERE l.id = license_id AND l.purchaser_id = auth.uid())
  );

CREATE POLICY "library_license_seats: license owner manages"
  ON public.library_license_seats FOR ALL
  USING (EXISTS (SELECT 1 FROM public.library_licenses l WHERE l.id = license_id AND l.purchaser_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_licenses l WHERE l.id = license_id AND l.purchaser_id = auth.uid()));

-- Claim-by-email policy, same shape as library_book_collaborators' claim
-- policy (Phase 9) — a seat holder claims their own invite by email match.
CREATE POLICY "library_license_seats: invited user claims own by email"
  ON public.library_license_seats FOR UPDATE
  USING (user_id IS NULL AND status = 'invited' AND invited_email = auth.email())
  WITH CHECK (user_id = auth.uid() AND status = 'active' AND invited_email = auth.email());

CREATE OR REPLACE FUNCTION public.has_active_library_license_seat(_book_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_license_seats s
    JOIN public.library_licenses l ON l.id = s.license_id
    WHERE l.book_id = _book_id AND s.user_id = auth.uid() AND s.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_library_book_content(_book_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_library_book_free(_book_id)
    OR public.is_library_book_owner(_book_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_purchased_library_book(_book_id)
    OR public.has_active_library_borrow(_book_id)
    OR (
      public.has_active_library_subscription()
      AND EXISTS (SELECT 1 FROM public.library_books WHERE id = _book_id AND pricing_model = 'subscription')
    )
    OR public.has_active_library_license_seat(_book_id)
$$;

-- ============================================================
-- 8. Publisher Store
-- ============================================================
ALTER TABLE public.library_publishers
  ADD COLUMN IF NOT EXISTS bio             TEXT,
  ADD COLUMN IF NOT EXISTS banner_url      TEXT,
  ADD COLUMN IF NOT EXISTS social_links    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS follower_count  INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.library_publisher_followers (
  publisher_id UUID NOT NULL REFERENCES public.library_publishers(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (publisher_id, user_id)
);

ALTER TABLE public.library_publisher_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_publisher_followers: public read" ON public.library_publisher_followers FOR SELECT USING (true);
CREATE POLICY "library_publisher_followers: user manages own"
  ON public.library_publisher_followers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Mirrors trg_library_author_follower_count (added in the Phase 9
-- migration) exactly, for publishers instead of authors — no notification
-- insert here, since library_publishers has no user_id/owner account to
-- notify (confirmed: publishers are admin-curated catalog entities, not
-- self-service accounts, unlike authors).
CREATE OR REPLACE FUNCTION public.trg_library_publisher_follower_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.library_publishers SET follower_count = follower_count + 1 WHERE id = NEW.publisher_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.library_publishers SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.publisher_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS library_publisher_followers_count ON public.library_publisher_followers;
CREATE TRIGGER library_publisher_followers_count
  AFTER INSERT OR DELETE ON public.library_publisher_followers
  FOR EACH ROW EXECUTE FUNCTION public.trg_library_publisher_follower_count();

-- ============================================================
-- 9. Reviews — media, verified purchase, helpful votes
-- ============================================================
ALTER TABLE public.library_reviews
  ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS helpful_count      INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.library_review_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id     UUID NOT NULL REFERENCES public.library_reviews(id) ON DELETE CASCADE,
  media_type    TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  url           TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_review_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_review_media: public read" ON public.library_review_media FOR SELECT USING (true);
CREATE POLICY "library_review_media: review author manages own"
  ON public.library_review_media FOR ALL
  USING (EXISTS (SELECT 1 FROM public.library_reviews r WHERE r.id = review_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_reviews r WHERE r.id = review_id AND r.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.library_review_helpful_votes (
  review_id  UUID NOT NULL REFERENCES public.library_reviews(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

ALTER TABLE public.library_review_helpful_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_review_helpful_votes: public read" ON public.library_review_helpful_votes FOR SELECT USING (true);
CREATE POLICY "library_review_helpful_votes: user manages own"
  ON public.library_review_helpful_votes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.trg_bump_library_review_helpful_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.library_reviews SET helpful_count = helpful_count + 1 WHERE id = NEW.review_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.library_reviews SET helpful_count = GREATEST(0, helpful_count - 1) WHERE id = OLD.review_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS library_review_helpful_votes_bump ON public.library_review_helpful_votes;
CREATE TRIGGER library_review_helpful_votes_bump
  AFTER INSERT OR DELETE ON public.library_review_helpful_votes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_review_helpful_count();

CREATE OR REPLACE FUNCTION public.trg_set_library_review_verified_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.verified_purchase := EXISTS (
    SELECT 1 FROM public.library_purchases
    WHERE book_id = NEW.book_id AND status IN ('paid', 'completed')
      AND (buyer_id = NEW.user_id OR recipient_user_id = NEW.user_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_reviews_set_verified_purchase ON public.library_reviews;
CREATE TRIGGER library_reviews_set_verified_purchase
  BEFORE INSERT ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_library_review_verified_purchase();

-- ============================================================
-- 10. Semantic search (book-level) — mirrors match_library_chapter_chunks'
-- exact SECURITY DEFINER + explicit-access-check shape, one row per book
-- (title+description+keywords is small; no chunk table needed).
-- ============================================================
ALTER TABLE public.library_books ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

CREATE OR REPLACE FUNCTION public.match_library_books_semantic(_query_embedding VECTOR(1536), _match_count INTEGER DEFAULT 20)
RETURNS TABLE (book_id UUID, similarity FLOAT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id, 1 - (embedding <=> _query_embedding) AS similarity
  FROM public.library_books
  WHERE embedding IS NOT NULL AND publish_status = 'published'
  ORDER BY embedding <=> _query_embedding
  LIMIT GREATEST(_match_count, 1)
$$;

GRANT EXECUTE ON FUNCTION public.match_library_books_semantic(VECTOR, INTEGER) TO anon, authenticated;

-- ============================================================
-- 11. Achievements — the tables already exist (Phase 6.5) but have never
-- had a write path. Seed a first criteria set + one trigger function
-- checked from three existing tables.
-- ============================================================
INSERT INTO public.library_achievements (code, name, description, icon, criteria, reward_vx)
VALUES
  ('first_book_finished', 'First Finish', 'Complete your first book', 'BookOpenCheck', '{"books_completed":1}', 20),
  ('5_books_finished', 'Bookworm', 'Complete 5 books', 'Library', '{"books_completed":5}', 50),
  ('first_review', 'First Words', 'Write your first review', 'MessageSquare', '{"reviews_written":1}', 10),
  ('10_reviews', 'Critic', 'Write 10 reviews', 'Star', '{"reviews_written":10}', 40),
  ('1000_vx_earned', 'VX Collector', 'Earn 1000 lifetime VX from Library activity', 'Coins', '{"vx_earned":1000}', 50)
ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_check_library_achievements()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _user_id UUID;
  _books_completed INTEGER;
  _reviews_written INTEGER;
  _vx_earned NUMERIC;
BEGIN
  IF TG_TABLE_NAME = 'library_reading_progress' THEN
    IF NEW.completed_at IS NULL OR OLD.completed_at IS NOT NULL THEN
      RETURN NEW;
    END IF;
    _user_id := NEW.user_id;
    SELECT COUNT(*) INTO _books_completed FROM public.library_reading_progress WHERE user_id = _user_id AND completed_at IS NOT NULL;
    IF _books_completed >= 1 THEN
      INSERT INTO public.library_user_achievements (user_id, achievement_id)
      SELECT _user_id, id FROM public.library_achievements WHERE code = 'first_book_finished'
      ON CONFLICT DO NOTHING;
    END IF;
    IF _books_completed >= 5 THEN
      INSERT INTO public.library_user_achievements (user_id, achievement_id)
      SELECT _user_id, id FROM public.library_achievements WHERE code = '5_books_finished'
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME = 'library_reviews' THEN
    _user_id := NEW.user_id;
    SELECT COUNT(*) INTO _reviews_written FROM public.library_reviews WHERE user_id = _user_id;
    IF _reviews_written >= 1 THEN
      INSERT INTO public.library_user_achievements (user_id, achievement_id)
      SELECT _user_id, id FROM public.library_achievements WHERE code = 'first_review'
      ON CONFLICT DO NOTHING;
    END IF;
    IF _reviews_written >= 10 THEN
      INSERT INTO public.library_user_achievements (user_id, achievement_id)
      SELECT _user_id, id FROM public.library_achievements WHERE code = '10_reviews'
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF TG_TABLE_NAME = 'library_xp_events' THEN
    _user_id := NEW.user_id;
    SELECT COALESCE(SUM(amount), 0) INTO _vx_earned FROM public.library_xp_events WHERE user_id = _user_id;
    IF _vx_earned >= 1000 THEN
      INSERT INTO public.library_user_achievements (user_id, achievement_id)
      SELECT _user_id, id FROM public.library_achievements WHERE code = '1000_vx_earned'
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_reading_progress_check_achievements ON public.library_reading_progress;
CREATE TRIGGER library_reading_progress_check_achievements
  AFTER UPDATE OF completed_at ON public.library_reading_progress
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_achievements();

DROP TRIGGER IF EXISTS library_reviews_check_achievements ON public.library_reviews;
CREATE TRIGGER library_reviews_check_achievements
  AFTER INSERT ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_achievements();

DROP TRIGGER IF EXISTS library_xp_events_check_achievements ON public.library_xp_events;
CREATE TRIGGER library_xp_events_check_achievements
  AFTER INSERT ON public.library_xp_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_check_library_achievements();

-- ============================================================
-- 12. Daily Rewards — plain RPC, self-scoped, matches the award_library_xp/
-- spend_vx precedent (no edge function needed for a self-contained VX op).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_daily_reward_claims (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date  DATE NOT NULL,
  streak_day  INTEGER NOT NULL,
  vx_awarded  INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, claim_date)
);

ALTER TABLE public.library_daily_reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_daily_reward_claims: user reads own"
  ON public.library_daily_reward_claims FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_library_daily_reward()
RETURNS TABLE (streak_day INTEGER, vx_awarded INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _yesterday_claim RECORD;
  _streak_day INTEGER;
  _reward_curve INTEGER[] := ARRAY[5, 10, 15, 20, 25, 30, 50];
  _vx INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;

  IF EXISTS (SELECT 1 FROM public.library_daily_reward_claims WHERE user_id = _user_id AND claim_date = CURRENT_DATE) THEN
    RAISE EXCEPTION 'Already claimed today''s reward';
  END IF;

  SELECT * INTO _yesterday_claim FROM public.library_daily_reward_claims
  WHERE user_id = _user_id AND claim_date = CURRENT_DATE - INTERVAL '1 day';

  _streak_day := CASE WHEN _yesterday_claim IS NULL THEN 1 ELSE (_yesterday_claim.streak_day % 7) + 1 END;
  _vx := _reward_curve[_streak_day];

  INSERT INTO public.library_daily_reward_claims (user_id, claim_date, streak_day, vx_awarded)
  VALUES (_user_id, CURRENT_DATE, _streak_day, _vx);

  -- Reuses the existing 'Reading streak:%' reason prefix (award_library_xp's
  -- whitelist caps it at 50, which matches this curve's max exactly) rather
  -- than adding a new prefix + touching that function's CASE whitelist.
  PERFORM public.award_library_xp(_vx, format('Reading streak:%s', _streak_day));

  RETURN QUERY SELECT _streak_day, _vx;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_library_daily_reward() TO authenticated;

-- ============================================================
-- 13. Referrals — confirmed zero existing referral capture anywhere in
-- this app before this migration.
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.library_referrals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id    UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_granted BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_referrals: referrer reads own"
  ON public.library_referrals FOR SELECT USING (auth.uid() = referrer_id);

-- Extends the existing handle_new_user() trigger (CREATE OR REPLACE, same
-- signature/trigger — a true replace) to also capture referred_by exactly
-- like it already captures display_name, plus record the referral.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _referred_by UUID;
BEGIN
  -- referred_by comes from a client-supplied ?ref= query param (see
  -- Signup.tsx) — a malformed OR fabricated (well-formed but nonexistent)
  -- value must never be able to break account creation itself, so both
  -- cases are normalized to NULL up front, before it's used in the
  -- profiles insert below (an FK violation there would fail the whole
  -- trigger, since that insert isn't optional).
  BEGIN
    _referred_by := (NEW.raw_user_meta_data->>'referred_by')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    _referred_by := NULL;
  END;
  IF _referred_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _referred_by) THEN
    _referred_by := NULL;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, referred_by)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), _referred_by);

  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (NEW.id, 100, 'Welcome bonus');

  IF _referred_by IS NOT NULL AND _referred_by <> NEW.id THEN
    INSERT INTO public.library_referrals (referrer_id, referred_id)
    VALUES (_referred_by, NEW.id)
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;

  -- Resolves any gift purchases bought against this email before the
  -- recipient had an account (see recipient_email / find_user_id_by_email
  -- above) — same "invite by email, claim on signup" shape as
  -- library_book_collaborators / library_license_seats.
  UPDATE public.library_purchases
  SET recipient_user_id = NEW.id
  WHERE recipient_user_id IS NULL AND lower(recipient_email) = lower(NEW.email);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Rewards the referrer once, on the referred user's FIRST completed purchase.
CREATE OR REPLACE FUNCTION public.trg_reward_library_referral()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _referral RECORD;
BEGIN
  IF NEW.status NOT IN ('paid', 'completed') OR (TG_OP = 'UPDATE' AND OLD.status IN ('paid', 'completed')) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _referral FROM public.library_referrals WHERE referred_id = NEW.buyer_id AND NOT reward_granted;
  IF _referral IS NOT NULL THEN
    INSERT INTO public.library_xp_events (user_id, amount, reason)
    VALUES (_referral.referrer_id, 50, format('Referral rewarded:%s', NEW.buyer_id));
    INSERT INTO public.user_points (user_id, points, reason)
    VALUES (_referral.referrer_id, 50, format('Referral rewarded:%s', NEW.buyer_id));
    UPDATE public.library_referrals SET reward_granted = true WHERE id = _referral.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_purchases_reward_referral ON public.library_purchases;
CREATE TRIGGER library_purchases_reward_referral
  AFTER INSERT OR UPDATE OF status ON public.library_purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_reward_library_referral();

-- ============================================================
-- 14. Payment method widening for the new payment rails (Stripe already
-- writes 'cash' — kept as-is for existing rows; new rails get their own
-- distinct values so revenue analytics can break out by rail without
-- touching old semantics retroactively).
-- ============================================================
ALTER TABLE public.library_purchases DROP CONSTRAINT IF EXISTS library_purchases_payment_method_check;
ALTER TABLE public.library_purchases ADD CONSTRAINT library_purchases_payment_method_check
  CHECK (payment_method IN ('vx', 'cash', 'stripe', 'paypal', 'crypto'));

-- Match columns for the PayPal/crypto webhooks (mirrors
-- stripe_checkout_session_id's role exactly — set at checkout-creation
-- time, looked up when the provider's webhook reports completion).
ALTER TABLE public.library_purchases
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS crypto_charge_id TEXT UNIQUE;
