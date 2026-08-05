-- ============================================================
-- Migration: VisionKids — every launch game now has a playable engine
-- Purpose:   The Phase 3 catalog seeded 20 games but only 6 shipped with an
--            implementation; the other 14 were left with engine_key = NULL,
--            which makes the frontend registry render the "coming soon"
--            placeholder instead of a game.
--
--            All 14 engines now exist under
--            src/features/visionkids/games/<slug>/ and are registered in
--            src/features/visionkids/games/registry.ts. This points each row
--            at its engine and publishes it.
--
--            Idempotent: keyed on slug, and only fills a NULL engine_key so
--            re-running never overwrites a value set later by hand.
-- ============================================================

UPDATE public.kids_games AS g
SET engine_key = v.engine_key
FROM (VALUES
  ('word-search',         'word-search'),
  ('puzzle',              'puzzle'),
  ('sudoku-kids',         'sudoku-kids'),
  ('guess-sound',         'guess-sound'),
  ('shape-matching',      'shape-matching'),
  ('typing-kids',         'typing-kids'),
  ('coding-puzzle',       'coding-puzzle'),
  ('planet-explorer',     'planet-explorer'),
  ('solar-system-quiz',   'solar-system-quiz'),
  ('geography-quiz',      'geography-quiz'),
  ('multiplication-hero', 'multiplication-hero'),
  ('alphabet-adventure',  'alphabet-adventure'),
  ('number-adventure',    'number-adventure'),
  ('drawing-challenge',   'drawing-challenge')
) AS v(slug, engine_key)
WHERE g.slug = v.slug
  AND g.engine_key IS DISTINCT FROM v.engine_key
  AND g.engine_key IS NULL;

-- guess-sound is played entirely by ear (Web Audio tones, no visuals needed),
-- so it belongs in the audio-accessible set alongside the other games that
-- carry that flag.
UPDATE public.kids_games
SET is_accessible_audio = true
WHERE slug = 'guess-sound'
  AND is_accessible_audio = false;

-- A game with an engine should be playable. Only promotes drafts; an
-- intentionally archived row stays archived.
UPDATE public.kids_games
SET status = 'published',
    published_at = COALESCE(published_at, now())
WHERE engine_key IS NOT NULL
  AND status = 'draft';
