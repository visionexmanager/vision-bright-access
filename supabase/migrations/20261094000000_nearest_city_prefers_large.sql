-- Prefer the city over its neighbourhoods.
--
-- GeoNames lists many neighbourhoods as ordinary populated places (Gulshan and
-- Hoàn Kiếm in the capitals of Bangladesh and Vietnam, Asagaya in Tokyo), so
-- "nearest place" named them. Within 15 km the most populous place now wins,
-- which is the city the sender would name; only when no place is that close does
-- the nearest within the cut-off answer. A pin in Zarqa still reads Zarqa because
-- Amman is farther than 15 km from it.

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
    SELECT p.id, p.name, p.country_code, p.population,
           2 * 6371 * asin(sqrt(
             power(sin(radians(p.latitude - _latitude) / 2), 2) +
             cos(radians(_latitude)) * cos(radians(p.latitude)) *
             power(sin(radians(p.longitude - _longitude) / 2), 2)
           )) AS km
      FROM public.geo_places p, box
     WHERE p.latitude  BETWEEN _latitude  - box.dlat AND _latitude  + box.dlat
       AND p.longitude BETWEEN _longitude - box.dlon AND _longitude + box.dlon
       AND coalesce(p.feature_code, '') <> 'PPLX'
  )
  SELECT coalesce(l.label, e.label, n.name), n.country_code, n.km
    FROM near n
    LEFT JOIN public.geo_place_labels l ON l.place_id = n.id AND l.lang = _lang
    LEFT JOIN public.geo_place_labels e ON e.place_id = n.id AND e.lang = 'en'
   WHERE n.km <= _max_km
   ORDER BY (n.km <= 15) DESC,
            CASE WHEN n.km <= 15 THEN n.population END DESC NULLS LAST,
            n.km
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.nearest_geo_place(double precision, double precision, text, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nearest_geo_place(double precision, double precision, text, double precision) TO service_role;
