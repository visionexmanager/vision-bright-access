-- A district is not a city.
--
-- GeoNames lists city sections as populated places too (feature code PPLX):
-- "Gulshan" in Dhaka, "Sé" in São Paulo, a ward of Tokyo. Nearest-place by
-- distance picked them, so a weather line read "Weather in Se". The feature code
-- is stored so the nearest-city lookup can leave sections out and answer with
-- the city itself.

ALTER TABLE public.geo_places ADD COLUMN IF NOT EXISTS feature_code text;

CREATE OR REPLACE FUNCTION public.nearest_geo_place(
  _latitude double precision,
  _longitude double precision,
  _lang text,
  _max_km double precision DEFAULT 25
) RETURNS TABLE (label text, country_code text, distance_km double precision)
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $$
  WITH box AS (
    SELECT _max_km / 111.0 AS dlat,
           _max_km / (111.0 * GREATEST(cos(radians(LEAST(abs(_latitude), 85))), 0.05)) AS dlon
  ), near AS (
    SELECT p.id, p.name, p.country_code,
           2 * 6371 * asin(sqrt(
             power(sin(radians(p.latitude - _latitude) / 2), 2) +
             cos(radians(_latitude)) * cos(radians(p.latitude)) *
             power(sin(radians(p.longitude - _longitude) / 2), 2)
           )) AS km
      FROM public.geo_places p, box
     WHERE p.latitude  BETWEEN _latitude  - box.dlat AND _latitude  + box.dlat
       AND p.longitude BETWEEN _longitude - box.dlon AND _longitude + box.dlon
       -- Sections of a city (PPLX) are districts. A row with no code yet,
       -- loaded before this column existed, is kept rather than dropped.
       AND coalesce(p.feature_code, '') <> 'PPLX'
  )
  SELECT coalesce(l.label, e.label, n.name), n.country_code, n.km
    FROM near n
    LEFT JOIN public.geo_place_labels l ON l.place_id = n.id AND l.lang = _lang
    LEFT JOIN public.geo_place_labels e ON e.place_id = n.id AND e.lang = 'en'
   WHERE n.km <= _max_km
   ORDER BY n.km
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.nearest_geo_place(double precision, double precision, text, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearest_geo_place(double precision, double precision, text, double precision) TO service_role;
