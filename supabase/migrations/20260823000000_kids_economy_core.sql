-- ============================================================
-- Migration: VisionKids Economy & Sustainability (Phase 17) — catalogs + state.
--
-- A SAFE kids economy. Core principles baked into the schema:
--   * The VX wallet is the existing public.user_points (+ spend_vx) — no new
--     currency, and NO real-money payment path here (a `provider` column is
--     reserved so a real gateway can be added later without a schema change).
--   * A CHILD never completes a paid subscription alone: child-initiated
--     subscriptions land as 'pending_parent' and only a linked GUARDIAN can
--     approve them (see kids_economy_guardians + approve RPC).
--   * Redeems/donations spend only VX coins, never money.
-- ============================================================

-- ── Guardian links (who may approve a child's spending) ──────────────────────
CREATE TABLE IF NOT EXISTS public.kids_economy_guardians (
  guardian_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guardian_id, child_id)
);
ALTER TABLE public.kids_economy_guardians ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_guardians_child ON public.kids_economy_guardians(child_id);
CREATE POLICY "kids_guardians: involved read" ON public.kids_economy_guardians FOR SELECT
  USING (auth.uid() = guardian_id OR auth.uid() = child_id);
-- The CHILD nominates their guardian (not the reverse), so no one can claim
-- guardianship over an arbitrary child and gain access to their records.
CREATE POLICY "kids_guardians: child links" ON public.kids_economy_guardians FOR INSERT
  WITH CHECK (auth.uid() = child_id);
CREATE POLICY "kids_guardians: child unlinks" ON public.kids_economy_guardians FOR DELETE
  USING (auth.uid() = child_id OR auth.uid() = guardian_id);

CREATE OR REPLACE FUNCTION public.is_kids_guardian_of(_guardian UUID, _child UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.kids_economy_guardians WHERE guardian_id = _guardian AND child_id = _child);
$$;

-- ── Subscription plans (catalog) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_subscription_plans (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  tier         TEXT NOT NULL CHECK (tier IN ('free','plus','premium','family','school','enterprise','ngo')),
  audience     TEXT NOT NULL DEFAULT 'individual' CHECK (audience IN ('individual','family','school','ngo','enterprise')),
  emoji        TEXT NOT NULL DEFAULT '⭐',
  price_usd    NUMERIC(8,2) NOT NULL DEFAULT 0,
  period       TEXT NOT NULL DEFAULT 'month' CHECK (period IN ('month','year','once')),
  features     JSONB NOT NULL DEFAULT '[]'::jsonb,
  color        TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary','secondary','accent','pink','green','purple')),
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_plans: public read" ON public.kids_subscription_plans FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_plans: admins manage" ON public.kids_subscription_plans FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_subscription_plans (slug, name, tier, audience, emoji, price_usd, period, color, order_index, features) VALUES
  ('free',       'Free',       'free',       'individual', '🆓', 0,     'month', 'green',     0, '["Core stories & games","Daily challenges","Basic progress"]'),
  ('plus',       'Plus',       'plus',       'individual', '➕', 4.99,  'month', 'primary',   1, '["Everything in Free","All STEM labs","Ad-free","More widgets"]'),
  ('premium',    'Premium',    'premium',    'individual', '💎', 9.99,  'month', 'purple',    2, '["Everything in Plus","AI Companion","Premium content","Priority support"]'),
  ('family',     'Family',     'family',     'family',     '👨‍👩‍👧', 14.99, 'month', 'pink',   3, '["Up to 5 children","Parent dashboard","Shared library"]'),
  ('school',     'School',     'school',     'school',     '🏫', 0,     'year',  'secondary', 4, '["Whole-school access","Classrooms & rosters","Reports & analytics"]'),
  ('enterprise', 'Enterprise', 'enterprise', 'enterprise', '🏢', 0,     'year',  'accent',    5, '["Multi-school","Custom branding","SSO ready","Dedicated support"]'),
  ('ngo',        'NGO',        'ngo',        'ngo',        '🤝', 0,     'year',  'green',     6, '["Discounted access","Impact reporting","Community programs"]')
ON CONFLICT (slug) DO NOTHING;

-- ── Subscriptions (per user or org) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID REFERENCES public.kids_organizations(id) ON DELETE CASCADE,
  plan_slug    TEXT NOT NULL REFERENCES public.kids_subscription_plans(slug),
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending_parent','cancelled','expired')),
  provider     TEXT NOT NULL DEFAULT 'none',
  approved_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  renews_at    TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_subscriptions_user ON public.kids_subscriptions(user_id, status);
CREATE POLICY "kids_subscriptions: owner or guardian or org-admin reads" ON public.kids_subscriptions FOR SELECT
  USING (auth.uid() = user_id
      OR public.is_kids_guardian_of(auth.uid(), user_id)
      OR (org_id IS NOT NULL AND public.is_kids_org_admin(org_id, auth.uid()))
      OR public.has_role(auth.uid(), 'admin'));
-- Inserts/updates go through RPCs (subscribe / approve / cancel).

-- ── Invoices (records only; no real charge yet) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.kids_subscriptions(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_usd      NUMERIC(8,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','void')),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_invoices_user ON public.kids_invoices(user_id, issued_at DESC);
CREATE POLICY "kids_invoices: owner or guardian reads" ON public.kids_invoices FOR SELECT
  USING (auth.uid() = user_id OR public.is_kids_guardian_of(auth.uid(), user_id) OR public.has_role(auth.uid(), 'admin'));

-- ── Redeemables (spend VX on cosmetics) + redemptions ────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_redeemables (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('theme','avatar','decoration','pet','skin','mission')),
  emoji        TEXT NOT NULL DEFAULT '🎁',
  cost_coins   INTEGER NOT NULL CHECK (cost_coins >= 0 AND cost_coins <= 100000),
  color        TEXT NOT NULL DEFAULT 'primary' CHECK (color IN ('primary','secondary','accent','pink','green','purple')),
  order_index  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_redeemables ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_redeemables_cat ON public.kids_redeemables(category, order_index);
CREATE POLICY "kids_redeemables: public read" ON public.kids_redeemables FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_redeemables: admins manage" ON public.kids_redeemables FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.kids_redeemables (slug, name, category, emoji, cost_coins, color, order_index) VALUES
  ('theme-ocean',   'Ocean Theme',    'theme',      '🌊', 500,  'secondary', 0),
  ('theme-space',   'Space Theme',    'theme',      '🪐', 500,  'purple',    1),
  ('avatar-robot',  'Robot Avatar',   'avatar',     '🤖', 300,  'primary',   2),
  ('avatar-cat',    'Cat Avatar',     'avatar',     '🐱', 300,  'pink',      3),
  ('decor-lamp',    'Star Lamp',      'decoration', '🌟', 200,  'accent',    4),
  ('pet-dragon',    'Baby Dragon',    'pet',        '🐉', 2000, 'green',     5),
  ('skin-hero',     'Hero Skin',      'skin',       '🦸', 800,  'pink',      6),
  ('mission-legend','Legend Mission', 'mission',    '🗺️', 1000, 'purple',    7)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.kids_redemptions (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redeemable_slug  TEXT NOT NULL REFERENCES public.kids_redeemables(slug) ON DELETE CASCADE,
  redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, redeemable_slug)
);
ALTER TABLE public.kids_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_redemptions: owner reads" ON public.kids_redemptions FOR SELECT USING (auth.uid() = user_id);
-- Minted by redeem RPC.

-- ── Gifts (guardian → child) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_gifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('subscription','coins','book','course','certificate','bundle')),
  ref_slug    TEXT,
  amount      INTEGER NOT NULL DEFAULT 0,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at  TIMESTAMPTZ
);
ALTER TABLE public.kids_gifts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_gifts_to ON public.kids_gifts(to_id, status);
CREATE POLICY "kids_gifts: involved read" ON public.kids_gifts FOR SELECT
  USING (auth.uid() = from_id OR auth.uid() = to_id OR public.has_role(auth.uid(), 'admin'));
-- Create/claim via RPCs.

-- ── Donations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_donations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cause       TEXT NOT NULL CHECK (cause IN ('free_content','support_schools','children_in_need')),
  amount_coins INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_donations: donor or admin reads" ON public.kids_donations FOR SELECT
  USING (auth.uid() = donor_id OR public.has_role(auth.uid(), 'admin'));
-- Created via donate RPC.

-- ── Partners (showcase catalog) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_partners (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('school','university','library','organization','publisher')),
  emoji       TEXT NOT NULL DEFAULT '🤝',
  description TEXT,
  url         TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kids_partners: public read" ON public.kids_partners FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "kids_partners: admins manage" ON public.kids_partners FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── Economy audit ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kids_economy_audit (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.kids_economy_audit ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_kids_economy_audit_actor ON public.kids_economy_audit(actor_id, created_at DESC);
CREATE POLICY "kids_economy_audit: actor or admin reads" ON public.kids_economy_audit FOR SELECT
  USING (auth.uid() = actor_id OR public.has_role(auth.uid(), 'admin'));
