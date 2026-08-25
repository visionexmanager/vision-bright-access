-- Answers from the map services, kept so they are not asked twice.
--
-- ── Why cache something that is free ────────────────────────────────────────
--
-- Every geo service this channel uses is keyless and free: Open-Meteo,
-- Nominatim, BigDataCloud, Overpass. There are no credits at stake. What is at
-- stake is the usage policy — Nominatim asks for at most one request per second
-- and reserves the right to block, and Overpass is a small volunteer cluster.
-- Today this channel calls both once per message with no cache and no throttle.
-- A busy hour is a ban, and a ban is a feature that stops working for everybody
-- at once.
--
-- It is also faster for the person waiting, and a coordinate answered from
-- cache is a coordinate that was never sent anywhere.
--
-- ── This table holds no personal data, by construction ──────────────────────
--
-- A row is keyed on a *rounded* coordinate and nothing else. No phone number,
-- no conversation id, no user reference, and no foreign key to anything that
-- has one. What it stores is a fact about a place — "the locality near roughly
-- 31.951, 35.923 is called Amman" — which is true for everybody and identifies
-- nobody. Two customers on the same street share the row, which is the point.
--
-- The rounding is what makes that true: three decimal places is about 110
-- metres, so a stored key names a neighbourhood rather than a doorway. See
-- PLACE_PRECISION in `whatsappGeoCache.ts`.
--
-- Deliberately separate from `whatsapp_conversations.last_latitude`, which *is*
-- personal, is precise, and already expires on its own six-hour clock. Nothing
-- here links the two.

CREATE TABLE IF NOT EXISTS public.whatsapp_geo_cache (
  -- The rounded lookup key. See `reverseKey`, `geocodeKey`, `nearbyKey`,
  -- `weatherKey`. Its shape is validated in code before any read or write.
  cache_key   text PRIMARY KEY,
  -- The provider's answer, as returned. jsonb so a shape change needs no
  -- migration; the code validates what it reads back.
  value       jsonb       NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.whatsapp_geo_cache IS
  'Place-name, geocode, nearby and weather answers keyed on rounded coordinates. Contains no personal data and no user reference by construction: a key names a neighbourhood, not a person.';

COMMENT ON COLUMN public.whatsapp_geo_cache.cache_key IS
  'Rounded lookup key, e.g. reverse:31.951:35.923:ar. Three decimals is ~110 m for places, two is ~1.1 km for weather.';

-- Expiry is read on every lookup and swept periodically, so it is the only
-- column worth an index of its own.
CREATE INDEX IF NOT EXISTS whatsapp_geo_cache_expires_idx
  ON public.whatsapp_geo_cache (expires_at);

ALTER TABLE public.whatsapp_geo_cache ENABLE ROW LEVEL SECURITY;

-- No policy, deliberately.
--
-- Only the service role writes and reads this, and the service role bypasses
-- RLS. With RLS enabled and no policy, every other role — including `anon` and
-- `authenticated` — gets nothing. That is the correct answer for a table whose
-- contents are an implementation detail of the assistant, and it matches how
-- `whatsapp_conversations` is treated.

-- ── Sweeping ────────────────────────────────────────────────────────────────
--
-- An expired row is already ignored by every read, so this is housekeeping
-- rather than correctness. It is a function rather than a trigger because
-- sweeping on write would make an unrelated customer pay for the deletion.
CREATE OR REPLACE FUNCTION public.sweep_whatsapp_geo_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.whatsapp_geo_cache WHERE expires_at < now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

COMMENT ON FUNCTION public.sweep_whatsapp_geo_cache() IS
  'Deletes expired geo cache rows. Housekeeping only — expired rows are already ignored on read.';

REVOKE ALL ON FUNCTION public.sweep_whatsapp_geo_cache() FROM PUBLIC;
