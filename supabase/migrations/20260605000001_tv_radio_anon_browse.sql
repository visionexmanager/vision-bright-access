-- ============================================================
-- Fix: Allow anonymous users to browse TV channel & radio
-- station METADATA (name, logo, category — NOT stream_url).
--
-- Root cause: tv_channels and radio_stations had SELECT policies
-- restricted to `authenticated` only, causing the React Query
-- cache to be poisoned with an empty array before the Supabase
-- session was established on page load.
--
-- Solution A (applied here): expose metadata to anon via a
-- security-definer view that explicitly excludes stream_url.
-- Solution B (also applied): add `enabled: !!user` guards in
-- useTVSubscription / useRadioSubscription hooks.
-- ============================================================

-- ── 1. TV channels — anon-safe metadata view ─────────────────
CREATE OR REPLACE VIEW public.tv_channels_public AS
  SELECT
    id, name, name_ar, description, description_ar,
    logo_url, official_url, category_id,
    quality, language, country,
    is_active, is_featured, sort_order, created_at
    -- stream_url intentionally excluded
  FROM public.tv_channels
  WHERE is_active = TRUE;

GRANT SELECT ON public.tv_channels_public TO anon, authenticated;

-- ── 2. Radio stations — anon-safe metadata view ──────────────
CREATE OR REPLACE VIEW public.radio_stations_public AS
  SELECT
    id, name, name_ar, description, description_ar,
    logo_url, official_url, genre_id,
    bitrate, language, country, website_url,
    is_active, is_featured, sort_order, created_at
    -- stream_url intentionally excluded
  FROM public.radio_stations
  WHERE is_active = TRUE;

GRANT SELECT ON public.radio_stations_public TO anon, authenticated;

-- ── 3. Also allow anon to read tv_categories & radio_genres ──
-- (These were already open to anon; this is a safety re-grant.)
GRANT SELECT ON public.tv_categories  TO anon, authenticated;
GRANT SELECT ON public.radio_genres   TO anon, authenticated;
