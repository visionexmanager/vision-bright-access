-- A cache of photo descriptions, keyed by what the picture is.
--
-- The same photograph reaches the assistant again and again — a forwarded
-- picture, a product shot, a sticker — and every time it is described afresh by
-- a paid model. This remembers the answer to a plain "describe this" (no caption,
-- no mode) for fourteen days, so the second sender of identical bytes pays
-- nothing and waits for nothing.
--
-- What is stored, and what is not:
--   • the SHA-256 of the metadata-stripped picture, the language, the model's
--     description and a timestamp. No phone number, no user, no caption, no file.
--   • the hash cannot be turned back into a picture, and it can only be looked up
--     by someone who already holds the same bytes.
--   • rows older than fourteen days are never returned and are deleted whenever a
--     new one is written.
--
-- Service role only: RLS on with no policy, on purpose. Additive and re-runnable.

CREATE TABLE IF NOT EXISTS public.image_description_cache (
  image_hash text NOT NULL CHECK (image_hash ~ '^[0-9a-f]{64}$'),
  lang       text NOT NULL CHECK (char_length(lang) BETWEEN 2 AND 8),
  answer     text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (image_hash, lang)
);
ALTER TABLE public.image_description_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.image_description_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.image_description_cache TO service_role;
COMMENT ON TABLE public.image_description_cache IS
  'Descriptions of photographs by picture hash and language, kept 14 days. Service role only: no policy, deliberately.';

CREATE INDEX IF NOT EXISTS image_description_cache_created_idx
  ON public.image_description_cache (created_at);

CREATE OR REPLACE FUNCTION public.image_description_cache_get(_hash text, _lang text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.answer
    FROM public.image_description_cache c
   WHERE c.image_hash = _hash
     AND c.lang = _lang
     AND c.created_at > now() - interval '14 days'
$$;

CREATE OR REPLACE FUNCTION public.image_description_cache_put(_hash text, _lang text, _answer text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.image_description_cache WHERE created_at < now() - interval '14 days';
  INSERT INTO public.image_description_cache (image_hash, lang, answer)
  VALUES (_hash, _lang, left(_answer, 4000))
  ON CONFLICT (image_hash, lang) DO UPDATE SET answer = excluded.answer, created_at = now();
END;
$$;

-- REVOKE FROM PUBLIC also revokes service_role, so grant it back; name anon and
-- authenticated as well, since PUBLIC alone is not isolation.
DO $$
DECLARE
  _sig text;
BEGIN
  FOREACH _sig IN ARRAY ARRAY[
    'public.image_description_cache_get(text, text)',
    'public.image_description_cache_put(text, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', _sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', _sig);
  END LOOP;
END $$;
