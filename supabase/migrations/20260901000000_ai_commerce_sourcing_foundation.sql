-- Phase 1: AI Commerce Agent foundation.
--
-- Four concerns, deliberately separate tables:
--   sourcing_sources  - the registry an admin edits; no core logic hard-codes a vendor
--   pricing_rules     - margins live here, never in an AI prompt
--   sourcing_requests - one customer request, for audit and rate accounting
--   sourcing_results  - normalized candidates, with supplier identity kept internal
--
-- Modelled on the existing ph_providers pattern: the row names a secret
-- (`api_key_ref`) rather than holding one, priority and health drive routing,
-- and an admin can disable a source without a deploy.
--
-- Nothing here scrapes anything. A source stays `status = 'unverified'` until
-- someone records that its terms actually permit the intended use.

-- ── Source registry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sourcing_sources (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text NOT NULL UNIQUE,
  name              text NOT NULL,

  -- How results are obtained. Ordered by preference in the spec; 'none' means
  -- no permitted mechanism has been established yet.
  access_method     text NOT NULL DEFAULT 'none'
                    CHECK (access_method IN ('internal', 'official_api', 'product_feed', 'affiliate_api', 'permitted_search', 'none')),

  -- 'unverified' until the terms review below is filled in. The router refuses
  -- anything that is not 'active', so a half-configured vendor cannot leak into
  -- customer results.
  status            text NOT NULL DEFAULT 'unverified'
                    CHECK (status IN ('active', 'disabled', 'unverified')),

  -- Which kinds of request this source is good for; the router matches these
  -- against the intent it derives from the customer's words.
  categories        text[] NOT NULL DEFAULT '{}',
  conditions        text[] NOT NULL DEFAULT ARRAY['new'],

  priority          integer NOT NULL DEFAULT 100,
  health_score      integer NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  consecutive_failures integer NOT NULL DEFAULT 0,

  -- Name of an Edge Function secret, never a credential. Same convention as
  -- ph_providers.api_key_ref.
  api_key_ref       text,
  base_url          text,
  config            jsonb NOT NULL DEFAULT '{}',

  -- ── Terms review (spec §4) ────────────────────────────────────────────
  -- A source may only go 'active' once these describe reality.
  terms_reviewed_at   timestamptz,
  terms_reviewed_by   uuid REFERENCES auth.users ON DELETE SET NULL,
  commercial_reuse_allowed boolean NOT NULL DEFAULT false,
  -- Some agreements (affiliate programmes especially) require the merchant to
  -- be named. When true, §8 confidentiality must not be applied.
  attribution_required     boolean NOT NULL DEFAULT false,
  rate_limit_per_hour      integer,
  terms_url                text,
  terms_notes              text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- A source cannot be switched on until someone has recorded the review and
-- confirmed commercial reuse. Enforced in the database so no code path,
-- present or future, can skip it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.sourcing_sources'::regclass
      AND conname = 'sourcing_sources_active_requires_review'
  ) THEN
    ALTER TABLE public.sourcing_sources
      ADD CONSTRAINT sourcing_sources_active_requires_review
      CHECK (
        status <> 'active'
        OR access_method = 'internal'
        OR (terms_reviewed_at IS NOT NULL AND commercial_reuse_allowed)
      );
  END IF;
END $$;

-- ── Pricing rules ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  -- NULL matches any source / category / condition; the most specific active
  -- rule wins. Kept nullable rather than using a wildcard string so the
  -- specificity ordering is a plain NULLS LAST sort.
  source_slug    text REFERENCES public.sourcing_sources(slug) ON DELETE CASCADE,
  category       text,
  condition      text CHECK (condition IN ('new', 'used', 'refurbished')),

  margin_percent numeric(6,3) NOT NULL DEFAULT 0 CHECK (margin_percent >= 0 AND margin_percent <= 500),
  margin_flat_usd numeric(10,2) NOT NULL DEFAULT 0 CHECK (margin_flat_usd >= 0),
  fees_percent   numeric(6,3) NOT NULL DEFAULT 0 CHECK (fees_percent >= 0 AND fees_percent <= 100),
  -- Used marketplace listings must not silently gain a margin (spec §9).
  apply_to_used  boolean NOT NULL DEFAULT false,
  round_to       numeric(10,2) NOT NULL DEFAULT 1 CHECK (round_to > 0),

  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── Requests and results ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sourcing_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users ON DELETE SET NULL,
  channel       text NOT NULL DEFAULT 'website'
                CHECK (channel IN ('website', 'whatsapp', 'email', 'facebook', 'instagram', 'tiktok', 'youtube')),
  query         text NOT NULL,
  intent        jsonb NOT NULL DEFAULT '{}',
  condition_filter text NOT NULL DEFAULT 'all'
                CHECK (condition_filter IN ('new', 'used', 'refurbished', 'all')),
  sources_used  text[] NOT NULL DEFAULT '{}',
  result_count  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sourcing_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid NOT NULL REFERENCES public.sourcing_requests(id) ON DELETE CASCADE,

  -- The reference a customer sees and quotes back. Generated, not the
  -- supplier's id, so the supplier is not inferable from it.
  visionex_ref     text NOT NULL UNIQUE DEFAULT ('VX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),

  -- Customer-facing
  title            text NOT NULL,
  brand            text,
  model            text,
  category         text,
  specifications   jsonb NOT NULL DEFAULT '{}',
  condition        text NOT NULL DEFAULT 'new' CHECK (condition IN ('new', 'used', 'refurbished')),
  availability     text NOT NULL DEFAULT 'requires_sourcing_confirmation'
                   CHECK (availability IN ('in_visionex', 'available_for_sourcing', 'external_recommendation', 'requires_sourcing_confirmation', 'unavailable')),
  final_price_usd  numeric(12,2),
  currency         text NOT NULL DEFAULT 'USD',

  -- Internal only. RLS below keeps every one of these columns away from the
  -- browser; the customer-facing projection lives in code and is tested.
  source_slug      text NOT NULL REFERENCES public.sourcing_sources(slug) ON DELETE RESTRICT,
  source_url       text,
  source_product_id text,
  source_price_usd numeric(12,2),
  shipping_usd     numeric(12,2) NOT NULL DEFAULT 0,
  pricing_rule_id  uuid REFERENCES public.pricing_rules(id) ON DELETE SET NULL,
  pricing_breakdown jsonb NOT NULL DEFAULT '{}',
  confidence       numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  retrieved_at     timestamptz NOT NULL DEFAULT now(),

  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- No table here is client-readable. sourcing_results in particular holds
-- supplier identity, source URL and source price; the customer-facing shape is
-- produced server-side by projectForCustomer(). Admins read for triage.

ALTER TABLE public.sourcing_sources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sourcing_results  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sourcing_sources', 'pricing_rules', 'sourcing_requests', 'sourcing_results'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND policyname = 'Admins manage ' || t
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
        'Admins manage ' || t, t
      );
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS sourcing_sources_routing_idx
  ON public.sourcing_sources (status, priority) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sourcing_results_request_idx
  ON public.sourcing_results (request_id, condition);
CREATE INDEX IF NOT EXISTS sourcing_requests_user_idx
  ON public.sourcing_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pricing_rules_lookup_idx
  ON public.pricing_rules (active, source_slug, category, condition);

-- ── Seed ────────────────────────────────────────────────────────────────────
--
-- Only the internal catalogue is active: it is Visionex's own data, so no
-- terms review applies. Every external example from the spec is seeded
-- 'unverified' and disabled, as a checklist rather than an integration. None
-- of them will be routed to until someone verifies the terms and flips them.

INSERT INTO public.sourcing_sources (slug, name, access_method, status, categories, conditions, priority, terms_notes)
VALUES
  ('visionex-catalog', 'Visionex catalog', 'internal', 'active',
   ARRAY['all'], ARRAY['new'], 1,
   'Visionex''s own products and services. Always searched first.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.sourcing_sources (slug, name, access_method, status, categories, conditions, priority, terms_notes)
VALUES
  ('amazon',      'Amazon',              'none', 'unverified', ARRAY['general','electronics','home','appliances'], ARRAY['new'],                       50, 'Needs Product Advertising API approval; PA-API requires qualifying sales and mandates attribution.'),
  ('alibaba',     'Alibaba',             'none', 'unverified', ARRAY['general','wholesale'],                        ARRAY['new'],                       60, 'Open Platform application required; verify commercial reuse of listing data.'),
  ('shein',       'SHEIN',               'none', 'unverified', ARRAY['fashion'],                                    ARRAY['new'],                       70, 'No public product API confirmed; affiliate network may be the only permitted route.'),
  ('ebay',        'eBay',                'none', 'unverified', ARRAY['general','electronics','used'],               ARRAY['new','used','refurbished'],  55, 'Browse API exists; check listing-data reuse and required attribution.'),
  ('olx',         'OLX',                 'none', 'unverified', ARRAY['used','general'],                             ARRAY['used'],                      65, 'Regional; verify per-country terms. Classifieds are third-party listings, never Visionex stock.'),
  ('assistive-800','Assistive tech distributors','none','unverified', ARRAY['assistive','accessibility'],           ARRAY['new','refurbished'],         20, 'Specialist blindness/low-vision retailers. Most have no API; a supplier feed or a direct agreement is the likely route.')
ON CONFLICT (slug) DO NOTHING;

-- A conservative default so pricing is never undefined. Applies to new items
-- only; used listings deliberately get no automatic margin (spec §9).
INSERT INTO public.pricing_rules (name, margin_percent, fees_percent, apply_to_used, round_to)
SELECT 'Default new-item margin', 15, 3, false, 1
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_rules WHERE name = 'Default new-item margin');

COMMENT ON TABLE public.sourcing_results IS
  'Normalized sourcing candidates. Supplier identity, source URL and source price are internal: RLS is admin-only and the customer-facing shape is produced by projectForCustomer() in _shared/sourcing/confidentiality.ts.';
