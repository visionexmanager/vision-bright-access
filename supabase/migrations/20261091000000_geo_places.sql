-- A local place index, so a city named in any of the site's languages resolves
-- without calling an outside geocoder.
--
-- Filled from GeoNames cities15000 (CC BY 4.0) by scripts/datahub/load-geonames.mjs.
-- Every alternate name GeoNames lists goes into geo_place_names under a key
-- computed by supabase/functions/_shared/placeKey.ts, which the lookup in the
-- WhatsApp webhook computes the same way. The index is reference data and is
-- reachable only with the service role: no policy is created on purpose, and
-- every grant to the API roles is revoked.

CREATE TABLE IF NOT EXISTS public.geo_places (
  id           bigint PRIMARY KEY,           -- the GeoNames id
  name         text NOT NULL,
  country_code text,
  latitude     double precision NOT NULL,
  longitude    double precision NOT NULL,
  population   bigint,
  timezone     text
);

CREATE TABLE IF NOT EXISTS public.geo_place_names (
  place_id bigint NOT NULL REFERENCES public.geo_places (id) ON DELETE CASCADE,
  name_key text   NOT NULL,
  PRIMARY KEY (place_id, name_key)
);

CREATE INDEX IF NOT EXISTS geo_place_names_key_idx ON public.geo_place_names (name_key);

ALTER TABLE public.geo_places      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_place_names ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.geo_places      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.geo_place_names FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.geo_places      TO service_role;
GRANT ALL ON public.geo_place_names TO service_role;

-- The most populous place with this name key. Population is the tie-breaker
-- because "Paris" and "عمان" each name several places and the large one is
-- almost always the one meant.
CREATE OR REPLACE FUNCTION public.lookup_geo_place(_key text)
 RETURNS TABLE (name text, country_code text, latitude double precision, longitude double precision)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $$
  SELECT p.name, p.country_code, p.latitude, p.longitude
    FROM public.geo_place_names n
    JOIN public.geo_places p ON p.id = n.place_id
   WHERE n.name_key = _key
   ORDER BY p.population DESC NULLS LAST, p.id
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.lookup_geo_place(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_geo_place(text) TO service_role;
