-- Name the nearest city for a pair of coordinates, in the sender's language.
--
-- geo_place_labels holds one display name per place and language, filled from
-- GeoNames' alternate names by scripts/datahub/load-geonames-alternates.mjs.
-- nearest_geo_place answers only when a city is close enough to be a fair
-- description of where somebody is; otherwise it returns nothing and the caller
-- uses the outside services, which can name a district or a village.
--
-- Reference data, reachable only with the service role, like the rest of the
-- place index.

CREATE TABLE IF NOT EXISTS public.geo_place_labels (
  place_id bigint NOT NULL REFERENCES public.geo_places (id) ON DELETE CASCADE,
  lang     text   NOT NULL,
  label    text   NOT NULL,
  PRIMARY KEY (place_id, lang)
);

ALTER TABLE public.geo_place_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.geo_place_labels FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.geo_place_labels TO service_role;

CREATE INDEX IF NOT EXISTS geo_places_latitude_idx ON public.geo_places (latitude);

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
    -- One degree of latitude is about 111 km; longitude shrinks with latitude.
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
