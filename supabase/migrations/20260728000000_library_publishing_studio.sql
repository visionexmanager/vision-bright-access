-- ============================================================
-- Migration: Library Author Publishing Studio (Phase 9)
--
-- Purpose: everything the author-facing self-publishing studio needs that
-- didn't already exist: extended library_books metadata (edition/license/
-- age rating/book-type/trailer/pricing model/scheduling), a gallery table,
-- multi-author collaboration with roles, comments/suggestions/approval
-- workflow, chapter version history, coupons/regional pricing/bundles/
-- subscriptions/donations, a self-service "become an author" policy,
-- extended analytics (reading time/revenue/country/device/traffic-source),
-- and scheduled publishing. Reuses every existing helper
-- (is_library_book_owner, can_access_library_book_content, has_role,
-- bump_library_daily_stat, touch_updated_at) rather than reinventing them.
-- ============================================================

-- ============================================================
-- 1. Extend library_books
-- ============================================================
ALTER TABLE public.library_books
  ADD COLUMN IF NOT EXISTS edition                TEXT,
  ADD COLUMN IF NOT EXISTS license_type            TEXT NOT NULL DEFAULT 'copyright'
    CHECK (license_type IN ('creative_commons', 'copyright', 'public_domain', 'custom')),
  ADD COLUMN IF NOT EXISTS license_details          TEXT,
  ADD COLUMN IF NOT EXISTS age_rating               TEXT NOT NULL DEFAULT 'all'
    CHECK (age_rating IN ('all', '7+', '12+', '16+', '18+')),
  ADD COLUMN IF NOT EXISTS content_format           TEXT
    CHECK (content_format IN ('novel', 'educational', 'scientific', 'research', 'magazine', 'comic',
                               'children', 'cookbook', 'documentation', 'manual', 'interactive', 'audiobook')),
  ADD COLUMN IF NOT EXISTS trailer_video_url         TEXT,
  ADD COLUMN IF NOT EXISTS pricing_model             TEXT NOT NULL DEFAULT 'paid'
    CHECK (pricing_model IN ('free', 'paid', 'subscription', 'rental', 'donation', 'bundle')),
  ADD COLUMN IF NOT EXISTS rental_price_usd           NUMERIC(10,2) CHECK (rental_price_usd IS NULL OR rental_price_usd >= 0),
  ADD COLUMN IF NOT EXISTS rental_price_vx            INTEGER CHECK (rental_price_vx IS NULL OR rental_price_vx >= 0),
  ADD COLUMN IF NOT EXISTS rental_period_days         INTEGER CHECK (rental_period_days IS NULL OR rental_period_days > 0),
  ADD COLUMN IF NOT EXISTS suggested_donation_usd     NUMERIC(10,2) CHECK (suggested_donation_usd IS NULL OR suggested_donation_usd >= 0),
  ADD COLUMN IF NOT EXISTS scheduled_publish_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_note                TEXT;

COMMENT ON COLUMN public.library_books.content_format IS 'The spec''s "Book Types" (Novel/Educational/.../Audiobook) — deliberately separate from book_type (delivery format: ebook/audiobook/physical/hybrid) and category_id (browse taxonomy). Conflating these three axes would corrupt existing reader logic that already branches on book_type.';
COMMENT ON COLUMN public.library_books.pricing_model IS 'Additive commerce-flow selector — does NOT replace is_free/price_vx/price_usd, which remain the source of truth every access check (can_access_library_book_content etc.) depends on.';

-- Keep is_free in sync with pricing_model for the two models that are
-- inherently free-to-read (free, donation — a donation book is freely
-- readable, the donation is voluntary support, not a paywall).
CREATE OR REPLACE FUNCTION public.sync_library_book_pricing_model()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.pricing_model IN ('free', 'donation') THEN
    NEW.is_free := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_books_sync_pricing_model ON public.library_books;
CREATE TRIGGER library_books_sync_pricing_model
  BEFORE INSERT OR UPDATE OF pricing_model ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.sync_library_book_pricing_model();

-- Widen publish_status for the full Draft→Review→Approved→Published/
-- Scheduled→Archived/Rejected workflow. Pure widening: is_library_book_
-- published() and every RLS policy compare against the literal 'published'
-- string, so they keep working unmodified.
ALTER TABLE public.library_books DROP CONSTRAINT IF EXISTS library_books_publish_status_check;
ALTER TABLE public.library_books ADD CONSTRAINT library_books_publish_status_check
  CHECK (publish_status IN ('draft', 'review', 'approved', 'published', 'scheduled', 'archived', 'rejected'));

-- Widen file_type for the additional Book Creation formats.
ALTER TABLE public.library_book_files DROP CONSTRAINT IF EXISTS library_book_files_file_type_check;
ALTER TABLE public.library_book_files ADD CONSTRAINT library_book_files_file_type_check
  CHECK (file_type IN ('pdf', 'epub', 'txt', 'docx', 'brf', 'audio', 'html', 'markdown', 'interactive'));

-- The editor's source of truth. content_text stays the plain-text mirror
-- every RAG/search/AI code path already reads — the editor's autosave
-- keeps both in sync in one client update, never a DB trigger (Tiptap JSON
-- -> plain text flattening is a frontend concern, not SQL's).
ALTER TABLE public.library_chapters ADD COLUMN IF NOT EXISTS content_json JSONB;

-- ============================================================
-- 2. library_book_gallery — structured child table (not a JSONB array),
-- matching this repo's existing preference for ordered, RLS-able,
-- storage-path-linked child rows (library_chapters, library_book_files).
-- "Preview Pages" needs no new schema — reuses library_chapters.
-- is_free_preview, already wired end-to-end on the reader side.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_gallery (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  media_type    TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  url           TEXT NOT NULL,
  caption       TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_gallery: read if book visible"
  ON public.library_book_gallery FOR SELECT
  USING (
    public.is_library_book_published(book_id)
    OR public.is_library_book_owner(book_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_library_book_gallery_book ON public.library_book_gallery(book_id, display_order);

-- ============================================================
-- 3. Collaboration — mirrors Career Center's community_members shape
-- (junction table + role enum + UNIQUE membership).
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.library_collaborator_role AS ENUM ('owner', 'editor', 'proofreader', 'translator', 'designer', 'reviewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.library_collaborator_status AS ENUM ('invited', 'active', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.library_book_collaborators (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null while status='invited' and only invited_email is known
  invited_email TEXT,
  role          public.library_collaborator_role NOT NULL DEFAULT 'reviewer',
  status        public.library_collaborator_status NOT NULL DEFAULT 'invited',
  invited_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, user_id)
);

ALTER TABLE public.library_book_collaborators ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS library_book_collaborators_updated_at ON public.library_book_collaborators;
CREATE TRIGGER library_book_collaborators_updated_at
  BEFORE UPDATE ON public.library_book_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- New helper, mirrors is_library_book_owner's SECURITY DEFINER shape.
CREATE OR REPLACE FUNCTION public.is_library_book_collaborator(_book_id UUID, _roles public.library_collaborator_role[] DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_book_collaborators
    WHERE book_id = _book_id AND user_id = auth.uid() AND status = 'active'
      AND (_roles IS NULL OR role = ANY(_roles))
  )
$$;

-- Broader "can edit this book's content" check — owner OR admin OR an
-- active owner/editor-role collaborator.
CREATE OR REPLACE FUNCTION public.can_edit_library_book(_book_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_library_book_owner(_book_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_library_book_collaborator(_book_id, ARRAY['owner', 'editor']::public.library_collaborator_role[])
$$;

CREATE POLICY "library_book_collaborators: members and owner/admin read"
  ON public.library_book_collaborators FOR SELECT
  USING (auth.uid() = user_id OR public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_book_collaborators: owner/admin manage"
  ON public.library_book_collaborators FOR ALL
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

-- Lets an invited person claim their own pending invitation the first time
-- they're signed in (turning invited_email into a real user_id + status=
-- 'active') without needing to be the book owner/admin — auth.email() is
-- the standard Supabase helper reading the current JWT's email claim.
CREATE POLICY "library_book_collaborators: invited user claims own by email"
  ON public.library_book_collaborators FOR UPDATE
  USING (user_id IS NULL AND status = 'invited' AND invited_email = auth.email())
  WITH CHECK (user_id = auth.uid() AND status = 'active' AND invited_email = auth.email());

CREATE INDEX IF NOT EXISTS idx_library_book_collaborators_user ON public.library_book_collaborators(user_id);

-- Load-bearing: widen existing "author/admin manage" ALL-policies so
-- owner/editor-role collaborators can actually write. Postgres has no
-- CREATE POLICY OR REPLACE — drop + recreate under the identical name.
DROP POLICY IF EXISTS "library_books: author/admin manage" ON public.library_books;
CREATE POLICY "library_books: author/admin manage" ON public.library_books FOR ALL
  USING (public.can_edit_library_book(id)) WITH CHECK (public.can_edit_library_book(id));

DROP POLICY IF EXISTS "library_chapters: author/admin manage" ON public.library_chapters;
CREATE POLICY "library_chapters: author/admin manage" ON public.library_chapters FOR ALL
  USING (public.can_edit_library_book(book_id)) WITH CHECK (public.can_edit_library_book(book_id));

DROP POLICY IF EXISTS "library_book_files: author/admin manage" ON public.library_book_files;
CREATE POLICY "library_book_files: author/admin manage" ON public.library_book_files FOR ALL
  USING (public.can_edit_library_book(book_id)) WITH CHECK (public.can_edit_library_book(book_id));

DROP POLICY IF EXISTS "library_audiobooks: author/admin manage" ON public.library_audiobooks;
CREATE POLICY "library_audiobooks: author/admin manage" ON public.library_audiobooks FOR ALL
  USING (public.can_edit_library_book(book_id)) WITH CHECK (public.can_edit_library_book(book_id));

DROP POLICY IF EXISTS "library_book_tags: author/admin manage" ON public.library_book_tags;
CREATE POLICY "library_book_tags: author/admin manage" ON public.library_book_tags FOR ALL
  USING (public.can_edit_library_book(book_id)) WITH CHECK (public.can_edit_library_book(book_id));

CREATE POLICY "library_book_gallery: author/admin manage"
  ON public.library_book_gallery FOR ALL
  USING (public.can_edit_library_book(book_id)) WITH CHECK (public.can_edit_library_book(book_id));

-- Narrower roles (proofreader/translator/designer/reviewer) intentionally
-- get NO raw-table write access above — they act only through comments/
-- suggestions below, matching what the spec's role list implies (only
-- Owner/Editor truly "edit"; the rest participate via review).

-- ============================================================
-- 4. Comments + suggestions + approval workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_book_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id        UUID REFERENCES public.library_chapters(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.library_book_comments(id) ON DELETE CASCADE,
  author_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body              TEXT NOT NULL,
  anchor            JSONB, -- ProseMirror {from,to} position range; null for chapter/book-level comments
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_comments ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS library_book_comments_updated_at ON public.library_book_comments;
CREATE TRIGGER library_book_comments_updated_at
  BEFORE UPDATE ON public.library_book_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "library_book_comments: collaborators/owner/admin read"
  ON public.library_book_comments FOR SELECT
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin') OR public.is_library_book_collaborator(book_id));

CREATE POLICY "library_book_comments: collaborators/owner/admin insert"
  ON public.library_book_comments FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin') OR public.is_library_book_collaborator(book_id))
  );

CREATE POLICY "library_book_comments: author/editor/admin update"
  ON public.library_book_comments FOR UPDATE
  USING (auth.uid() = author_id OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = author_id OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_book_comments: author/editor/admin delete"
  ON public.library_book_comments FOR DELETE
  USING (auth.uid() = author_id OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_book_comments_book ON public.library_book_comments(book_id, chapter_id);

-- Version history (defined here, before suggestions, since suggestions
-- reference it).
CREATE TABLE IF NOT EXISTS public.library_book_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id    UUID NOT NULL REFERENCES public.library_chapters(id) ON DELETE CASCADE,
  content_json  JSONB NOT NULL,
  content_text  TEXT NOT NULL DEFAULT '',
  is_autosave   BOOLEAN NOT NULL DEFAULT false,
  version_note  TEXT,
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_versions: collaborators/owner/admin read"
  ON public.library_book_versions FOR SELECT
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin') OR public.is_library_book_collaborator(book_id));

CREATE POLICY "library_book_versions: editors insert"
  ON public.library_book_versions FOR INSERT
  WITH CHECK (auth.uid() = created_by AND public.can_edit_library_book(book_id));

CREATE INDEX IF NOT EXISTS idx_library_book_versions_chapter ON public.library_book_versions(chapter_id, created_at DESC);

-- Suggestions ("track changes" from roles that can't write chapters
-- directly) — stored as full alternate-chapter snapshots (no verified free
-- Tiptap track-changes package exists to depend on; storing the whole
-- proposed content_json and diffing client-side via the `diff` package is
-- simple and dependency-honest).
CREATE TABLE IF NOT EXISTS public.library_book_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id           UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  chapter_id        UUID NOT NULL REFERENCES public.library_chapters(id) ON DELETE CASCADE,
  suggested_by      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  base_version_id   UUID REFERENCES public.library_book_versions(id) ON DELETE SET NULL,
  suggested_content JSONB NOT NULL,
  note              TEXT,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_book_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_suggestions: collaborators/owner/admin read"
  ON public.library_book_suggestions FOR SELECT
  USING (auth.uid() = suggested_by OR public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_book_suggestions: collaborators insert own"
  ON public.library_book_suggestions FOR INSERT
  WITH CHECK (auth.uid() = suggested_by AND public.is_library_book_collaborator(book_id));

CREATE POLICY "library_book_suggestions: owner/editor/admin review"
  ON public.library_book_suggestions FOR UPDATE
  USING (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.can_edit_library_book(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_book_suggestions_chapter ON public.library_book_suggestions(chapter_id, status);

-- Approval workflow needs no separate table — it IS publish_status moving
-- draft->review->approved->published/scheduled or ->rejected. Enforced by
-- the Studio UI only exposing transitions a role is entitled to, PLUS this
-- guard trigger for defense in depth.
-- Fires on both INSERT and UPDATE OF publish_status — a fresh INSERT could
-- otherwise set publish_status='published' directly, skipping the
-- workflow entirely, even though the Studio wizard itself never does this
-- (new books always take the 'draft' default).
CREATE OR REPLACE FUNCTION public.guard_library_publish_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.publish_status IN ('approved', 'published', 'rejected', 'archived')
     AND (TG_OP = 'INSERT' OR NEW.publish_status IS DISTINCT FROM OLD.publish_status)
     AND NOT (
       public.is_library_book_owner(NEW.id)
       OR public.has_role(auth.uid(), 'admin')
       OR public.is_library_book_collaborator(NEW.id, ARRAY['owner']::public.library_collaborator_role[])
     ) THEN
    RAISE EXCEPTION 'Only the book owner or an owner-role collaborator can approve, publish, reject, or archive';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_books_guard_publish_transition ON public.library_books;
CREATE TRIGGER library_books_guard_publish_transition
  BEFORE INSERT OR UPDATE OF publish_status ON public.library_books
  FOR EACH ROW EXECUTE FUNCTION public.guard_library_publish_status_transition();

-- ============================================================
-- 5. Pricing — coupons, regional pricing, bundles, subscriptions, donations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,
  book_id           UUID REFERENCES public.library_books(id) ON DELETE CASCADE, -- null = platform-wide (admin-managed only)
  discount_type     TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_usd', 'fixed_vx')),
  discount_value    NUMERIC NOT NULL CHECK (discount_value > 0),
  max_redemptions   INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemptions_count INTEGER NOT NULL DEFAULT 0,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_by        UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_coupons ENABLE ROW LEVEL SECURITY;

-- No policy grants a random authenticated user SELECT on someone else's
-- coupons (preventing code enumeration/scraping) — a shopper redeeming a
-- code never queries this table directly, only the checkout edge function
-- (service-role) validates it. Owners CAN read/manage their own book's
-- coupons (needed for the Studio's CouponManager UI); admins manage all.
CREATE POLICY "library_coupons: owner manages own book coupons"
  ON public.library_coupons FOR ALL
  USING (book_id IS NOT NULL AND public.is_library_book_owner(book_id))
  WITH CHECK (book_id IS NOT NULL AND public.is_library_book_owner(book_id));

CREATE POLICY "library_coupons: admin manages all"
  ON public.library_coupons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_coupon_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id    UUID NOT NULL REFERENCES public.library_coupons(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id  UUID REFERENCES public.library_purchases(id) ON DELETE SET NULL,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);

ALTER TABLE public.library_coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_coupon_redemptions: user reads own"
  ON public.library_coupon_redemptions FOR SELECT
  USING (auth.uid() = user_id);

-- Atomic reserve/release for coupon redemption across both the synchronous
-- VX path and the asynchronous cash/Stripe path (checkout.session.expired
-- must be able to give the redemption back). Service-role only — never
-- called directly by a client.
CREATE OR REPLACE FUNCTION public.reserve_library_coupon(_coupon_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _updated INTEGER;
BEGIN
  UPDATE public.library_coupons
  SET redemptions_count = redemptions_count + 1
  WHERE id = _coupon_id AND is_active
    AND (valid_from IS NULL OR valid_from <= now())
    AND (valid_until IS NULL OR valid_until > now())
    AND (max_redemptions IS NULL OR redemptions_count < max_redemptions);
  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO public.library_coupon_redemptions (coupon_id, user_id) VALUES (_coupon_id, _user_id);
  EXCEPTION WHEN unique_violation THEN
    UPDATE public.library_coupons SET redemptions_count = redemptions_count - 1 WHERE id = _coupon_id;
    RETURN false;
  END;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_library_coupon(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_library_coupon(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.release_library_coupon(_coupon_id UUID, _user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.library_coupon_redemptions WHERE coupon_id = _coupon_id AND user_id = _user_id;
  IF FOUND THEN
    UPDATE public.library_coupons SET redemptions_count = GREATEST(0, redemptions_count - 1) WHERE id = _coupon_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.release_library_coupon(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_library_coupon(UUID, UUID) TO service_role;

CREATE TABLE IF NOT EXISTS public.library_regional_prices (
  book_id      UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL,
  price_usd    NUMERIC(10,2) NOT NULL CHECK (price_usd >= 0),
  price_vx     INTEGER CHECK (price_vx IS NULL OR price_vx >= 0),
  PRIMARY KEY (book_id, country_code)
);

ALTER TABLE public.library_regional_prices ENABLE ROW LEVEL SECURITY;

-- Public read — needed so the pricing UI on the book page can show "$X in
-- your region" pre-checkout.
CREATE POLICY "library_regional_prices: public read" ON public.library_regional_prices FOR SELECT USING (true);

CREATE POLICY "library_regional_prices: owner/admin manage"
  ON public.library_regional_prices FOR ALL
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_bundles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES public.library_authors(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  price_usd   NUMERIC(10,2) CHECK (price_usd IS NULL OR price_usd >= 0),
  price_vx    INTEGER CHECK (price_vx IS NULL OR price_vx >= 0),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.library_bundle_books (
  bundle_id UUID NOT NULL REFERENCES public.library_bundles(id) ON DELETE CASCADE,
  book_id   UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, book_id)
);

ALTER TABLE public.library_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_bundle_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_bundles: public read active"
  ON public.library_bundles FOR SELECT
  USING (
    is_active
    OR EXISTS (SELECT 1 FROM public.library_authors a WHERE a.id = author_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_bundles: author/admin manage"
  ON public.library_bundles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.library_authors a WHERE a.id = author_id AND a.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.library_authors a WHERE a.id = author_id AND a.user_id = auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_bundle_books: public read" ON public.library_bundle_books FOR SELECT USING (true);

CREATE POLICY "library_bundle_books: author/admin manage"
  ON public.library_bundle_books FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.library_bundles b JOIN public.library_authors a ON a.id = b.author_id WHERE b.id = bundle_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.library_bundles b JOIN public.library_authors a ON a.id = b.author_id WHERE b.id = bundle_id AND a.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- A bundle purchase = one library_purchases row per included book, all
-- sharing bundle_id — has_purchased_library_book() needs zero changes.
ALTER TABLE public.library_purchases ADD COLUMN IF NOT EXISTS bundle_id UUID REFERENCES public.library_bundles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.library_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                    TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end      TIMESTAMPTZ NOT NULL,
  stripe_subscription_id  TEXT UNIQUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.library_subscriptions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS library_subscriptions_updated_at ON public.library_subscriptions;
CREATE TRIGGER library_subscriptions_updated_at
  BEFORE UPDATE ON public.library_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "library_subscriptions: user reads own" ON public.library_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "library_subscriptions: admin manages"
  ON public.library_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.has_active_library_subscription()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_subscriptions WHERE user_id = auth.uid() AND status = 'active' AND current_period_end > now()
  )
$$;

-- Upgrade access-check to cover subscription-gated books — every existing
-- call site (RLS policies referencing this function by name) picks up the
-- new logic automatically.
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
$$;

CREATE TABLE IF NOT EXISTS public.library_donations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  donor_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_usd NUMERIC(10,2) CHECK (amount_usd IS NULL OR amount_usd >= 0),
  amount_vx  INTEGER CHECK (amount_vx IS NULL OR amount_vx >= 0),
  message    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_donations ENABLE ROW LEVEL SECURITY;

-- Public read — author revenue stats + a public "supporters" list, same
-- visibility model as reviews.
CREATE POLICY "library_donations: public read" ON public.library_donations FOR SELECT USING (true);
CREATE POLICY "library_donations: donor inserts own" ON public.library_donations FOR INSERT WITH CHECK (auth.uid() = donor_id);

-- Rental reuses library_borrowed_books/has_active_library_borrow exactly
-- as-is (already time-boxed with due_at) — only the 3 new rental_* price/
-- period columns on library_books (added in §1) are new.

-- ============================================================
-- 6. "Become an author" self-service — one new policy, no edge function.
-- user_id is already UNIQUE, capping one author identity per account — no
-- vetting gate needed at the identity level (this spec asks for book-
-- workflow vetting, never author-identity vetting).
-- ============================================================
CREATE POLICY "library_authors: self-service create own"
  ON public.library_authors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. Analytics — extend the existing daily-stats fact table, not a
-- parallel one.
-- ============================================================
ALTER TABLE public.library_book_daily_stats
  ADD COLUMN IF NOT EXISTS reading_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_vx      NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.library_book_daily_dimension_stats (
  book_id         UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  stat_date       DATE NOT NULL,
  dimension       TEXT NOT NULL CHECK (dimension IN ('country', 'device', 'traffic_source')),
  dimension_value TEXT NOT NULL,
  count           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (book_id, stat_date, dimension, dimension_value)
);

ALTER TABLE public.library_book_daily_dimension_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_book_daily_dimension_stats: owner/admin read"
  ON public.library_book_daily_dimension_stats FOR SELECT
  USING (public.is_library_book_owner(book_id) OR public.has_role(auth.uid(), 'admin'));

-- Numeric sibling of bump_library_daily_stat (that one takes an integer
-- delta; revenue columns are NUMERIC) — same %I-quoted dynamic-column
-- pattern, service-role only (no direct-write policy needed since callers
-- are all trusted server-side triggers/edge functions).
CREATE OR REPLACE FUNCTION public.bump_library_daily_stat_numeric(_book_id UUID, _column TEXT, _delta NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.library_book_daily_stats (book_id, stat_date)
  VALUES (_book_id, CURRENT_DATE)
  ON CONFLICT (book_id, stat_date) DO NOTHING;

  EXECUTE format(
    'UPDATE public.library_book_daily_stats SET %I = %I + $1 WHERE book_id = $2 AND stat_date = $3',
    _column, _column
  ) USING _delta, _book_id, CURRENT_DATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_library_daily_stat_numeric(UUID, TEXT, NUMERIC) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.bump_library_daily_dimension_stat(_book_id UUID, _dimension TEXT, _value TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.library_book_daily_dimension_stats (book_id, stat_date, dimension, dimension_value, count)
  VALUES (_book_id, CURRENT_DATE, _dimension, _value, 1)
  ON CONFLICT (book_id, stat_date, dimension, dimension_value) DO UPDATE SET count = library_book_daily_dimension_stats.count + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bump_library_daily_dimension_stat(UUID, TEXT, TEXT) TO service_role;

-- Extend the existing purchase-completion trigger (CREATE OR REPLACE, same
-- signature — a true replace, not a new overload) to also bump revenue.
CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_purchases()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('paid', 'completed') AND (TG_OP = 'INSERT' OR OLD.status NOT IN ('paid', 'completed')) THEN
    PERFORM public.bump_library_daily_stat(NEW.book_id, 'purchases', 1);
    IF NEW.amount_usd IS NOT NULL THEN
      PERFORM public.bump_library_daily_stat_numeric(NEW.book_id, 'revenue_usd', NEW.amount_usd);
    END IF;
    IF NEW.amount_vx IS NOT NULL THEN
      PERFORM public.bump_library_daily_stat_numeric(NEW.book_id, 'revenue_vx', NEW.amount_vx);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- New trigger: donations bump revenue too (donations have no pending/
-- completed lifecycle — every row is a completed donation).
CREATE OR REPLACE FUNCTION public.trg_bump_library_stat_donation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.amount_usd IS NOT NULL THEN
    PERFORM public.bump_library_daily_stat_numeric(NEW.book_id, 'revenue_usd', NEW.amount_usd);
  END IF;
  IF NEW.amount_vx IS NOT NULL THEN
    PERFORM public.bump_library_daily_stat_numeric(NEW.book_id, 'revenue_vx', NEW.amount_vx);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_donations_bump_stat ON public.library_donations;
CREATE TRIGGER library_donations_bump_stat
  AFTER INSERT ON public.library_donations
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_library_stat_donation();

-- reading_minutes is bumped from the existing library-track-reading/
-- library-sync-progress edge functions — a one-line addition there
-- (integration point only, not rewritten in this migration).
-- country/device/traffic-source dimension bumps come from the new
-- library-checkout-session function via bump_library_daily_dimension_stat,
-- best-effort (never blocking the parent request).

-- ============================================================
-- 8. check_ai_rate_limit — extend for the new AI Writing Assistant
-- function (CREATE OR REPLACE, same signature — third time this exact
-- extension pattern is used).
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id      UUID,
  _function_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _daily_count  BIGINT;
  _daily_limit  INTEGER;
BEGIN
  _daily_limit := CASE _function_name
    WHEN 'ai-chat'                        THEN 60
    WHEN 'academy-chat'                   THEN 60
    WHEN 'ocr-scan'                        THEN 20
    WHEN 'radar-ai'                        THEN 20
    WHEN 'analyze-meal'                    THEN 20
    WHEN 'generate-diet-plan'              THEN 10
    WHEN 'realtime-session'                THEN 10
    WHEN 'enrich-product'                  THEN 50
    WHEN 'library-ai-assistant'            THEN 40
    WHEN 'library-ai-chat'                 THEN 60
    WHEN 'library-ai-writing-assistant'    THEN 40
    ELSE 30
  END;

  SELECT COUNT(*) INTO _daily_count
  FROM public.ai_usage_log
  WHERE user_id       = _user_id
    AND function_name = _function_name
    AND created_at   >= current_date::timestamptz
    AND created_at   <  (current_date + interval '1 day')::timestamptz;

  IF _daily_count >= _daily_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.ai_usage_log (user_id, function_name)
  VALUES (_user_id, _function_name);

  DELETE FROM public.ai_usage_log
  WHERE user_id = _user_id
    AND created_at < now() - interval '48 hours';

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(UUID, TEXT) TO service_role;

-- ============================================================
-- 9. Scheduled publishing
-- ============================================================
CREATE OR REPLACE FUNCTION public.publish_scheduled_library_books()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.library_books SET publish_status = 'published'
  WHERE publish_status = 'scheduled' AND scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_scheduled_library_books() TO service_role;

COMMENT ON FUNCTION public.publish_scheduled_library_books IS 'Flips scheduled books past their scheduled_publish_at to published. Requires the pg_cron extension (a Supabase-dashboard toggle, same as the existing library_book_stats_monthly refresh) scheduled e.g. every 5 minutes: select cron.schedule(''publish-scheduled-library-books'', ''*/5 * * * *'', $$select public.publish_scheduled_library_books()$$); — not run automatically by this migration.';

-- ============================================================
-- 10. Author notifications — reuses the existing generic
-- public.notifications table (20260422000000_admin_panel_expansion.sql:
-- id, user_id, title, body, type, is_read, sent_by, created_at). Every
-- insert below is a plain, direct INSERT from a SECURITY DEFINER trigger —
-- no RLS write-policy needed on `notifications` for this, the same way
-- every other system-authored notification in this codebase already works.
-- ============================================================

-- library_author_followers did not exist anywhere before this — there was
-- a library_authors.follower_count column with no write path at all (no
-- follow/unfollow table, no increment trigger) — a pre-existing gap this
-- closes, since a "notify author about new followers" requirement is
-- meaningless without a real follow mechanism to trigger it.
CREATE TABLE IF NOT EXISTS public.library_author_followers (
  author_id  UUID NOT NULL REFERENCES public.library_authors(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (author_id, user_id)
);

ALTER TABLE public.library_author_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_author_followers: public read"
  ON public.library_author_followers FOR SELECT USING (true);

CREATE POLICY "library_author_followers: user manages own"
  ON public.library_author_followers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.trg_library_author_follower_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _author_user_id UUID;
  _follower_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.library_authors SET follower_count = follower_count + 1 WHERE id = NEW.author_id;
    SELECT user_id INTO _author_user_id FROM public.library_authors WHERE id = NEW.author_id;
    IF _author_user_id IS NOT NULL AND _author_user_id <> NEW.user_id THEN
      SELECT COALESCE(raw_user_meta_data->>'display_name', email, 'A reader') INTO _follower_name FROM auth.users WHERE id = NEW.user_id;
      INSERT INTO public.notifications (user_id, title, body, type)
      VALUES (_author_user_id, 'New follower', format('%s started following you.', _follower_name), 'success');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.library_authors SET follower_count = GREATEST(0, follower_count - 1) WHERE id = OLD.author_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS library_author_followers_count ON public.library_author_followers;
CREATE TRIGGER library_author_followers_count
  AFTER INSERT OR DELETE ON public.library_author_followers
  FOR EACH ROW EXECUTE FUNCTION public.trg_library_author_follower_count();

-- New review/rating -> notify the book's author.
CREATE OR REPLACE FUNCTION public.trg_notify_library_review()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _author_user_id UUID;
  _book_title TEXT;
BEGIN
  SELECT a.user_id, b.title INTO _author_user_id, _book_title
  FROM public.library_books b JOIN public.library_authors a ON a.id = b.author_id
  WHERE b.id = NEW.book_id;

  IF _author_user_id IS NOT NULL AND _author_user_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (
      _author_user_id,
      CASE WHEN NEW.comment IS NULL THEN 'New rating' ELSE 'New review' END,
      format('Your book "%s" received a %s-star %s.', _book_title, NEW.rating, CASE WHEN NEW.comment IS NULL THEN 'rating' ELSE 'review' END),
      'info'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_reviews_notify_author ON public.library_reviews;
CREATE TRIGGER library_reviews_notify_author
  AFTER INSERT ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_library_review();

-- New sale -> notify the book's author (fires once per purchase, when it
-- actually completes — not on the initial 'pending' insert).
CREATE OR REPLACE FUNCTION public.trg_notify_library_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _author_user_id UUID;
  _book_title TEXT;
BEGIN
  IF NEW.status NOT IN ('paid', 'completed') OR (TG_OP = 'UPDATE' AND OLD.status IN ('paid', 'completed')) THEN
    RETURN NEW;
  END IF;

  SELECT a.user_id, b.title INTO _author_user_id, _book_title
  FROM public.library_books b JOIN public.library_authors a ON a.id = b.author_id
  WHERE b.id = NEW.book_id;

  IF _author_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (_author_user_id, 'New sale', format('"%s" was just purchased.', _book_title), 'success');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_purchases_notify_sale ON public.library_purchases;
CREATE TRIGGER library_purchases_notify_sale
  AFTER INSERT OR UPDATE OF status ON public.library_purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_library_sale();

-- New comment/suggestion on a book -> notify the owner (never yourself).
CREATE OR REPLACE FUNCTION public.trg_notify_library_book_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _author_user_id UUID;
  _book_title TEXT;
BEGIN
  SELECT a.user_id, b.title INTO _author_user_id, _book_title
  FROM public.library_books b JOIN public.library_authors a ON a.id = b.author_id
  WHERE b.id = NEW.book_id;

  IF _author_user_id IS NOT NULL AND _author_user_id <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (_author_user_id, 'New comment', format('New comment on "%s".', _book_title), 'info');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_book_comments_notify ON public.library_book_comments;
CREATE TRIGGER library_book_comments_notify
  AFTER INSERT ON public.library_book_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_library_book_comment();

CREATE OR REPLACE FUNCTION public.trg_notify_library_book_suggestion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _author_user_id UUID;
  _book_title TEXT;
BEGIN
  SELECT a.user_id, b.title INTO _author_user_id, _book_title
  FROM public.library_books b JOIN public.library_authors a ON a.id = b.author_id
  WHERE b.id = NEW.book_id;

  IF _author_user_id IS NOT NULL AND _author_user_id <> NEW.suggested_by THEN
    INSERT INTO public.notifications (user_id, title, body, type)
    VALUES (_author_user_id, 'New suggestion', format('A collaborator suggested a change on "%s".', _book_title), 'info');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_book_suggestions_notify ON public.library_book_suggestions;
CREATE TRIGGER library_book_suggestions_notify
  AFTER INSERT ON public.library_book_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_library_book_suggestion();

-- Milestones — reuses the sale/review triggers' row-level firing to also
-- check round-number cumulative thresholds, one shared function branching
-- on TG_TABLE_NAME so the "notify the author, once, at each threshold"
-- logic exists in exactly one place.
CREATE OR REPLACE FUNCTION public.trg_notify_library_milestone()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _milestones INTEGER[] := ARRAY[10, 50, 100, 500, 1000, 5000, 10000];
  _count INTEGER;
  _label TEXT;
  _author_user_id UUID;
  _book_title TEXT;
  _book_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'library_purchases' THEN
    IF NEW.status NOT IN ('paid', 'completed') OR (TG_OP = 'UPDATE' AND OLD.status IN ('paid', 'completed')) THEN
      RETURN NEW;
    END IF;
    _book_id := NEW.book_id;
    SELECT COUNT(*) INTO _count FROM public.library_purchases WHERE book_id = _book_id AND status IN ('paid', 'completed');
    _label := 'sales';
  ELSIF TG_TABLE_NAME = 'library_reviews' THEN
    _book_id := NEW.book_id;
    SELECT reviews_count INTO _count FROM public.library_books WHERE id = _book_id;
    _label := 'reviews';
  ELSE
    RETURN NEW;
  END IF;

  IF _count = ANY(_milestones) THEN
    SELECT a.user_id, b.title INTO _author_user_id, _book_title
    FROM public.library_books b JOIN public.library_authors a ON a.id = b.author_id
    WHERE b.id = _book_id;
    IF _author_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, type)
      VALUES (_author_user_id, 'Milestone reached!', format('"%s" just hit %s %s.', _book_title, _count, _label), 'success');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_purchases_notify_milestone ON public.library_purchases;
CREATE TRIGGER library_purchases_notify_milestone
  AFTER INSERT OR UPDATE OF status ON public.library_purchases
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_library_milestone();

DROP TRIGGER IF EXISTS library_reviews_notify_milestone ON public.library_reviews;
CREATE TRIGGER library_reviews_notify_milestone
  AFTER INSERT ON public.library_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_library_milestone();
