-- Two sources for the Commerce Agent: VXBazaar, and eBay.
--
-- Phase 1 shipped the agent with one shelf to look at — `products`, the
-- curated catalogue. Meanwhile the other half of the site let people open a
-- shop and list things, into `bazaar_products`, which the agent could not see.
-- A buyer asking the AI for something a Visionex shop was selling was told
-- nothing was found. The first row below closes that.
--
-- The second prepares eBay. It does NOT switch it on: `sourcing_sources` has a
-- CHECK that refuses `status = 'active'` on an external source until a person
-- has recorded a terms review, and a migration is not a person. What this does
-- is everything else — the access method, the secret's name, the base URL, and
-- the attribution flag that makes the customer see eBay's name and eBay's link
-- rather than an anonymous offer.

-- ── VXBazaar listings ───────────────────────────────────────────────────────
--
-- `internal`, like the catalogue: these are goods on Visionex, so no margin is
-- added and they rank ahead of anything external. Every condition is claimed
-- because a shop may list a used item; the listing's own words decide, and the
-- router does not filter internal sources by condition anyway.

INSERT INTO public.sourcing_sources
  (slug, name, access_method, status, categories, conditions, priority,
   commercial_reuse_allowed, terms_notes)
VALUES
  ('visionex-bazaar', 'VXBazaar shops', 'internal', 'active',
   ARRAY['all'], ARRAY['new', 'used', 'refurbished'], 2,
   true,
   'Listings by shops on Visionex. Our own marketplace: no external terms apply, no margin is added, and only listings from active, non-vacation shops are returned.')
ON CONFLICT (slug) DO UPDATE
  SET name          = EXCLUDED.name,
      access_method = EXCLUDED.access_method,
      status        = EXCLUDED.status,
      categories    = EXCLUDED.categories,
      conditions    = EXCLUDED.conditions,
      priority      = EXCLUDED.priority,
      updated_at    = now();

-- ── eBay, prepared but not switched on ──────────────────────────────────────
--
-- Browse API, application (client-credentials) token, US marketplace so prices
-- arrive in USD. `attribution_required` is the important column: it tells
-- confidentiality.ts to name the merchant and show the link, which is what the
-- API licence asks for and what makes these results a recommendation rather
-- than a resale.

UPDATE public.sourcing_sources
SET access_method        = 'official_api',
    api_key_ref          = 'EBAY_CLIENT_ID',
    base_url             = 'https://api.ebay.com/buy/browse/v1',
    attribution_required = true,
    conditions           = ARRAY['new', 'used', 'refurbished'],
    terms_url            = 'https://developer.ebay.com/api-docs/static/api-license-agreement.html',
    terms_notes          = 'Browse API adapter implemented (ebayBrowse.ts) and inert without EBAY_CLIENT_ID / EBAY_CLIENT_SECRET. '
                           'Results are shown WITH attribution and WITHOUT a Visionex margin, so they are recommendations, not stock. '
                           'To switch on: create the eBay app keys (which is the acceptance of the API licence), set both secrets, then '
                           'record the review and set status = ''active''.',
    updated_at           = now()
WHERE slug = 'ebay';

-- ── eBay pricing: pass-through ──────────────────────────────────────────────
--
-- The buyer pays eBay, not us. A margin here would print a price on the page
-- that nobody ever charges, so the most specific rule for this source adds
-- nothing at all. `apply_to_used` is irrelevant at 0% but is left false to
-- match spec §9's default.

INSERT INTO public.pricing_rules
  (name, source_slug, margin_percent, margin_flat_usd, fees_percent, apply_to_used, round_to, active)
SELECT 'eBay pass-through (recommendation, not resale)', 'ebay', 0, 0, 0, false, 0.01, true
WHERE EXISTS (SELECT 1 FROM public.sourcing_sources WHERE slug = 'ebay')
  AND NOT EXISTS (
    SELECT 1 FROM public.pricing_rules
    WHERE source_slug = 'ebay' AND name = 'eBay pass-through (recommendation, not resale)'
  );

COMMENT ON COLUMN public.sourcing_sources.attribution_required IS
  'When true, projectForCustomer() names the merchant and shows its link — used for sources whose licence requires it (eBay). When false, spec §8 confidentiality applies.';
