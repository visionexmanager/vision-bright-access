-- The one source that answers today.
--
-- Every merchant adapter waits on credentials somebody has to go and obtain.
-- This one waits on nothing: 21 researched assistive equipment types, with the
-- range the market actually charges, committed to the repository and read from
-- a JSON snapshot. No key, no approval, no network call.
--
-- It is `internal` because it is Visionex's own reference material, which also
-- means no margin is added — there is nothing to add a margin to, since the
-- adapter reports a range and no single price. The customer sees the range and
-- a "request sourcing" button, and a person quotes the real number.
--
-- Priority 3 puts it behind the catalogue and the bazaar: if we are selling
-- the thing, that answer comes first.

INSERT INTO public.sourcing_sources
  (slug, name, access_method, status, categories, conditions, priority,
   commercial_reuse_allowed, terms_notes)
VALUES
  ('visionex-assistive-guide', 'Visionex assistive equipment guide', 'internal', 'active',
   ARRAY['assistive', 'accessibility'], ARRAY['new'], 3,
   true,
   'Visionex''s own researched reference, snapshotted from src/data/assistiveProducts.ts by '
   'scripts/generate-assistive-index.ts. Reports a market price range and never a quoted price, '
   'and every result is requires_sourcing_confirmation: these are equipment types, not listings, '
   'and nobody is holding one.')
ON CONFLICT (slug) DO UPDATE
  SET name          = EXCLUDED.name,
      access_method = EXCLUDED.access_method,
      status        = EXCLUDED.status,
      categories    = EXCLUDED.categories,
      priority      = EXCLUDED.priority,
      terms_notes   = EXCLUDED.terms_notes,
      updated_at    = now();

COMMENT ON TABLE public.sourcing_sources IS
  'Sources the Commerce Agent may ask, in priority order. Internal sources are Visionex''s own data and carry no margin; external ones cannot go active until a person records the terms review.';
