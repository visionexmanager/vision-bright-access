-- ============================================================
-- Migration: Library core commerce & gamification (Phase 2 backend)
-- Purpose:   Purchases, borrowing, VX rewards, challenges, achievements for
--            the Library section. Also upgrades
--            public.can_access_library_book_content() (defined in
--            20260720000000_library_core_catalog.sql) to check real
--            purchases/active-borrows now that those tables exist —
--            RLS policies already referencing that function by name pick up
--            the new logic automatically, no need to touch them again.
--
-- Tables added: library_purchases, library_borrowed_books, library_xp_events,
--   library_challenges, library_challenge_progress, library_achievements,
--   library_user_achievements.
--
-- VX: does NOT introduce a parallel wallet. public.user_points is the real,
-- existing ledger (same one src/hooks/useVXWallet.ts already reads). This
-- migration adds award_library_xp(), mirroring the existing self-only
-- award_academy_xp() (20260705000000_award_academy_xp_self_only.sql)
-- exactly: derives the user from auth.uid() internally (never trusts a
-- caller-supplied user id), logs to library_xp_events for audit, then
-- inserts into public.user_points so the balance is real everywhere.
-- ============================================================

-- ============================================================
-- library_purchases (mirrors bazaar_orders' dual VX/cash shape —
-- 20260615010000_bazaar_commerce.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_purchases (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id                      UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  book_id                       UUID NOT NULL REFERENCES public.library_books(id) ON DELETE RESTRICT,
  payment_method                TEXT NOT NULL CHECK (payment_method IN ('vx','cash')),
  amount_vx                     INTEGER CHECK (amount_vx IS NULL OR amount_vx >= 0),
  amount_usd                    NUMERIC(10,2) CHECK (amount_usd IS NULL OR amount_usd >= 0),
  status                        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','completed','cancelled','refunded','payment_failed')),
  stripe_checkout_session_id    TEXT UNIQUE,
  stripe_payment_intent_id      TEXT,
  purchased_at                  TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_purchases: buyer reads own"
  ON public.library_purchases FOR SELECT
  USING (
    auth.uid() = buyer_id
    OR public.is_library_book_owner(book_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "library_purchases: buyer creates own pending"
  ON public.library_purchases FOR INSERT
  WITH CHECK (auth.uid() = buyer_id AND status = 'pending');

-- Status transitions (pending -> paid/completed/refunded/etc.) are admin- or
-- service-role-only — a buyer cannot mark their own purchase as paid.
-- Payment-confirmation edge functions use the service-role client, which
-- bypasses RLS entirely, so no separate policy is needed for that path.
CREATE POLICY "library_purchases: admin updates status"
  ON public.library_purchases FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_purchases_updated_at
  BEFORE UPDATE ON public.library_purchases
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_library_purchases_buyer ON public.library_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_library_purchases_book ON public.library_purchases(book_id);
CREATE INDEX IF NOT EXISTS idx_library_purchases_status ON public.library_purchases(status);

CREATE OR REPLACE FUNCTION public.has_purchased_library_book(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_purchases
    WHERE book_id = _book_id AND buyer_id = auth.uid() AND status IN ('paid','completed')
  )
$$;

-- ============================================================
-- library_borrowed_books (limited-copy lending — library_books.
-- lending_copies_total NULL means "not lendable" or "unlimited" depending
-- on is_free; a NULL total is never oversold-checked, see the trigger below)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_borrowed_books (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id        UUID NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  borrowed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at         TIMESTAMPTZ NOT NULL,
  returned_at    TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned','overdue')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.check_library_lending_availability()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _total INTEGER;
  _active INTEGER;
BEGIN
  SELECT lending_copies_total INTO _total FROM public.library_books WHERE id = NEW.book_id;
  IF _total IS NOT NULL THEN
    SELECT COUNT(*) INTO _active FROM public.library_borrowed_books
      WHERE book_id = NEW.book_id AND status = 'active';
    IF _active >= _total THEN
      RAISE EXCEPTION 'No available copies to borrow for this book';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER library_borrowed_books_check_availability
  BEFORE INSERT ON public.library_borrowed_books
  FOR EACH ROW EXECUTE FUNCTION public.check_library_lending_availability();

ALTER TABLE public.library_borrowed_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_borrowed_books: user manages own"
  ON public.library_borrowed_books FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_borrowed_books: admin manages all"
  ON public.library_borrowed_books FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_borrowed_books_user ON public.library_borrowed_books(user_id);
CREATE INDEX IF NOT EXISTS idx_library_borrowed_books_book ON public.library_borrowed_books(book_id);
CREATE INDEX IF NOT EXISTS idx_library_borrowed_books_status ON public.library_borrowed_books(status);

CREATE OR REPLACE FUNCTION public.has_active_library_borrow(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.library_borrowed_books
    WHERE book_id = _book_id AND user_id = auth.uid() AND status = 'active'
  )
$$;

-- ── Upgrade can_access_library_book_content now that purchases/borrows
--    exist (see migration header note) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_access_library_book_content(_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_library_book_free(_book_id)
    OR public.is_library_book_owner(_book_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_purchased_library_book(_book_id)
    OR public.has_active_library_borrow(_book_id)
$$;

-- ============================================================
-- library_xp_events (audit log — the real balance lives in
-- public.user_points, written by award_library_xp() below)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_xp_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,
  reason        TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_xp_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_xp_events: user reads own"
  ON public.library_xp_events FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_xp_events_user ON public.library_xp_events(user_id, created_at DESC);

-- Self-only VX award (auth.uid() derived internally, never caller-supplied),
-- same security model as public.award_academy_xp() — PLUS a per-reason
-- amount whitelist, same pattern as public.award_points()
-- (20260622000000_fix_award_points_whitelist.sql). This function is
-- GRANTed directly to `authenticated`, so it's callable from devtools/any
-- client bypassing the library-reward-vx edge function entirely — the cap
-- must live here, not just in the edge function, or it's not a real cap.
-- award_academy_xp() itself has no such cap; this deliberately does not
-- copy that gap.
CREATE OR REPLACE FUNCTION public.award_library_xp(_amount INTEGER, _reason TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _user_id UUID := auth.uid();
  _max_amount INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Must be signed in';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  CASE
    WHEN _reason LIKE 'Book completed:%'      THEN _max_amount := 100;
    WHEN _reason LIKE 'Review written:%'      THEN _max_amount := 25;
    WHEN _reason LIKE 'Reading streak:%'      THEN _max_amount := 50;
    WHEN _reason LIKE 'Challenge completed:%' THEN _max_amount := 300;
    WHEN _reason LIKE 'Daily reading goal:%'  THEN _max_amount := 20;
    ELSE RAISE EXCEPTION 'Invalid reason: %', _reason;
  END CASE;

  IF _amount > _max_amount THEN
    RAISE EXCEPTION 'Amount exceeds maximum (%) for reason: %', _max_amount, _reason;
  END IF;

  INSERT INTO public.library_xp_events(user_id, amount, reason)
  VALUES (_user_id, _amount, _reason);

  INSERT INTO public.user_points(user_id, points, reason)
  VALUES (_user_id, _amount, _reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_library_xp(INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.award_library_xp IS 'Self-only, amount-capped VX award for Library actions (book completed, streaks, challenges) — writes to library_xp_events (audit) and public.user_points (the real balance).';

-- ============================================================
-- library_challenges + library_challenge_progress
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_challenges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  description     TEXT,
  goal_type       TEXT NOT NULL CHECK (goal_type IN ('books_count','pages_count','minutes_read')),
  goal_target     INTEGER NOT NULL CHECK (goal_target > 0),
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  reward_vx       INTEGER NOT NULL DEFAULT 0 CHECK (reward_vx >= 0),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_challenges: public reads active"
  ON public.library_challenges FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "library_challenges: admins manage"
  ON public.library_challenges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER library_challenges_updated_at
  BEFORE UPDATE ON public.library_challenges
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE IF NOT EXISTS public.library_challenge_progress (
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id    UUID NOT NULL REFERENCES public.library_challenges(id) ON DELETE CASCADE,
  current_value   INTEGER NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, challenge_id)
);

ALTER TABLE public.library_challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_challenge_progress: user manages own"
  ON public.library_challenge_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_challenge_progress: admin reads all"
  ON public.library_challenge_progress FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_library_challenge_progress_challenge ON public.library_challenge_progress(challenge_id);

-- ============================================================
-- library_achievements + library_user_achievements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.library_achievements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  icon          TEXT,
  criteria      JSONB NOT NULL DEFAULT '{}'::jsonb,
  reward_vx     INTEGER NOT NULL DEFAULT 0 CHECK (reward_vx >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.library_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "library_achievements: public read"
  ON public.library_achievements FOR SELECT
  USING (true);

CREATE POLICY "library_achievements: admins manage"
  ON public.library_achievements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.library_user_achievements (
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id    UUID NOT NULL REFERENCES public.library_achievements(id) ON DELETE CASCADE,
  earned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

ALTER TABLE public.library_user_achievements ENABLE ROW LEVEL SECURITY;

-- Earned badges are shown on public reader profiles, same visibility model
-- as library_reviews (public read).
CREATE POLICY "library_user_achievements: public read"
  ON public.library_user_achievements FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_library_user_achievements_achievement ON public.library_user_achievements(achievement_id);
