-- The five merchants, configured for the resale model.
--
-- Visionex buys from the supplier and sells to the customer with a margin, so
-- the supplier is not named: `attribution_required` goes back to false on eBay
-- and stays false everywhere else, and §8 confidentiality applies to all of
-- them. What the customer sees is a product, a price and a VX reference.
--
-- Every row below stays `unverified`. That is not caution for its own sake:
-- `sourcing_sources_active_requires_review` refuses to activate a non-internal
-- source unless `terms_reviewed_at` is set and `commercial_reuse_allowed` is
-- true, and a migration cannot honestly assert either. Activation is one
-- statement per source, documented in docs/ai-commerce-sourcing.md, run by the
-- person who obtained the credentials and read the agreement.
--
-- Each row records where its adapter goes and which secrets it needs. A row
-- whose secrets are unset returns nothing and logs one line — an active row
-- with no keys is silent, never an error in front of a customer.

-- ── eBay: search API ────────────────────────────────────────────────────────

UPDATE public.sourcing_sources
SET attribution_required = false,
    terms_notes = 'Browse API adapter (ebayBrowse.ts). Secrets: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET. '
                  'Reported under the resale model: supplier not named, margin applied. '
                  'Note for whoever reviews the terms — eBay''s API agreement expects listing data to '
                  'carry attribution and a link back to the item; reselling it unattributed is the '
                  'question that review has to answer.',
    updated_at = now()
WHERE slug = 'ebay';

-- The pass-through rule was written when eBay results were recommendations we
-- pointed at. Under resale the margin engine applies, so the rule is retired
-- rather than deleted: an audit of an old sourcing_result can still find it.
UPDATE public.pricing_rules
SET active = false, updated_at = now()
WHERE source_slug = 'ebay' AND name = 'eBay pass-through (recommendation, not resale)';

-- ── Amazon: Product Advertising API 5.0 ─────────────────────────────────────

UPDATE public.sourcing_sources
SET access_method = 'official_api',
    api_key_ref   = 'AMAZON_PAAPI_ACCESS_KEY',
    base_url      = 'https://webservices.amazon.com/paapi5/searchitems',
    conditions    = ARRAY['new', 'used', 'refurbished'],
    terms_url     = 'https://webservices.amazon.com/paapi5/documentation/',
    terms_notes   = 'PA-API 5.0 adapter (amazonPaapi.ts), SigV4 signed. Secrets: AMAZON_PAAPI_ACCESS_KEY, '
                    'AMAZON_PAAPI_SECRET_KEY, AMAZON_PARTNER_TAG. The obstacle is not the code: PA-API '
                    'access requires an Associates account that has already made qualifying sales, so this '
                    'is the slowest of the five to come alive.',
    updated_at    = now()
WHERE slug = 'amazon';

-- ── AliExpress and Alibaba.com: one gateway design, two rows ────────────────
--
-- `config.method` names the API call and `base_url` the gateway, so moving
-- either is an admin edit. `config.fields` may override the field map the
-- adapter defaults to; it is left unset here so the defaults apply.

-- AliExpress was not in the seeded list; create the row, then configure both
-- the same way.
INSERT INTO public.sourcing_sources
  (slug, name, access_method, status, categories, conditions, priority)
VALUES
  ('aliexpress', 'AliExpress', 'affiliate_api', 'unverified',
   ARRAY['general', 'electronics', 'home', 'appliances', 'fashion', 'children'], ARRAY['new'], 58)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.sourcing_sources
SET access_method = 'affiliate_api',
    api_key_ref   = 'ALIEXPRESS_APP_KEY',
    base_url      = 'https://api-sg.aliexpress.com/sync',
    categories    = ARRAY['general', 'electronics', 'home', 'appliances', 'fashion', 'children'],
    config        = jsonb_build_object('method', 'aliexpress.affiliate.product.query'),
    terms_url     = 'https://portals.aliexpress.com/',
    terms_notes   = 'Open platform adapter (aliOpenPlatform.ts). Secrets: ALIEXPRESS_APP_KEY, '
                    'ALIEXPRESS_APP_SECRET. Needs an affiliate account. The HMAC signature is written from '
                    'the published spec and has never been run against the live gateway — verify it in the '
                    'sandbox as part of the terms review, and set config.sign_path if the REST-style '
                    'gateway is used instead.',
    updated_at    = now()
WHERE slug = 'aliexpress';

UPDATE public.sourcing_sources
SET access_method = 'official_api',
    api_key_ref   = 'ALIBABA_APP_KEY',
    base_url      = 'https://api.alibaba.com/router/rest',
    config        = jsonb_build_object('method', 'alibaba.icbu.product.search'),
    terms_url     = 'https://open.alibaba.com/',
    terms_notes   = 'Open platform adapter (aliOpenPlatform.ts), same gateway family as AliExpress. '
                    'Secrets: ALIBABA_APP_KEY, ALIBABA_APP_SECRET. Wholesale prices are quoted as ranges; '
                    'the adapter costs against the low end, which is what a small order is honoured at. '
                    'Endpoint and signature variant must be confirmed in the sandbox.',
    updated_at    = now()
WHERE slug = 'alibaba';

-- ── SHEIN: no product API exists, so a feed ─────────────────────────────────
--
-- Fashion retail is reached through an affiliate network's feed or a supplier
-- agreement, not a search endpoint. `productFeed.ts` reads any JSON feed given
-- a URL and a field map, so switching SHEIN on is configuration, and the same
-- adapter serves the next merchant in the same position without a deploy.

UPDATE public.sourcing_sources
SET access_method = 'product_feed',
    conditions    = ARRAY['new'],
    terms_url     = 'https://www.shein.com/affiliate',
    terms_notes   = 'No public product API exists. Reached through a feed: set base_url to the feed URL, '
                    'config.fields to its field map, and config.auth_ref to the name of a secret holding a '
                    'bearer token if the network needs one. Prices in a feed are a snapshot, so results are '
                    'marked requires_sourcing_confirmation and somebody checks before we promise one.',
    updated_at    = now()
WHERE slug = 'shein';

-- A spare row for the next merchant reachable only by feed, so adding one is
-- an admin edit rather than a migration.
INSERT INTO public.sourcing_sources
  (slug, name, access_method, status, categories, conditions, priority, terms_notes)
VALUES
  ('product-feed', 'Supplier feed', 'product_feed', 'unverified',
   ARRAY['general'], ARRAY['new'], 80,
   'Generic feed source. Set base_url to the JSON feed, config.fields to its field map, and '
   'config.auth_ref to a secret name if the feed needs a bearer token.')
ON CONFLICT (slug) DO NOTHING;

-- ── Margin on second-hand stock ─────────────────────────────────────────────
--
-- Spec §9 refuses a margin on used listings, and its reason was that Visionex
-- does not own the item, so marking it up would invent a transaction nobody
-- agreed to. Under the resale model that premise no longer holds: we buy the
-- item and then sell it, on every condition. So used gets its own rule, opted
-- in explicitly rather than by widening the default.

INSERT INTO public.pricing_rules
  (name, source_slug, condition, margin_percent, margin_flat_usd, fees_percent, apply_to_used, round_to, active)
SELECT 'Resale margin, second-hand', NULL, 'used', 18, 0, 3, true, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules WHERE name = 'Resale margin, second-hand'
);

INSERT INTO public.pricing_rules
  (name, source_slug, condition, margin_percent, margin_flat_usd, fees_percent, apply_to_used, round_to, active)
SELECT 'Resale margin, refurbished', NULL, 'refurbished', 16, 0, 3, false, 1, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.pricing_rules WHERE name = 'Resale margin, refurbished'
);
