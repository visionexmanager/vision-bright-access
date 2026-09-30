-- Save an external Library result to My Library.
--
-- The Open Sources page (20261061) searches 40-odd open catalogues, but a result
-- could only be looked at: there was nowhere to keep one. This is that place — a
-- personal shelf of external items, one row per (user, item).
--
-- ── What is stored, and what is not ────────────────────────────────────────
--
-- Metadata and links only, exactly what the search already showed: title,
-- creator, source, licence, credit line, the item's page. Never the media file.
-- Every URL must be https and bounded, every text field is length-capped, and
-- the browser cannot write the table at all — the only way in is
-- library_save_external_item(), which re-checks the shape and the caller.
--
-- ── Who may save ───────────────────────────────────────────────────────────
--
-- An account whose plan opens the Library section (user_has_section, the same
-- server-side answer the Edge Functions ask). The free week does not: the
-- Library is not one of the trial's sections (trial_sections(), 20261063), so a
-- trial account cannot use the shelf as a side door into the Library.
--
-- At most 500 items per user, so the table cannot be used as free storage.

CREATE TABLE IF NOT EXISTS public.library_saved_external_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id       text        NOT NULL,
  provider      text        NOT NULL,
  provider_name text        NOT NULL,
  title         text        NOT NULL,
  content_type  text        NOT NULL,
  description   text,
  creator       text,
  thumbnail_url text,
  external_url  text        NOT NULL,
  download_url  text,
  license_name  text,
  license_url   text,
  attribution   text,
  language      text,
  published_at  text,
  note          text,
  saved_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT library_saved_external_items_unique UNIQUE (user_id, item_id),
  CONSTRAINT lsei_item_id_check      CHECK (item_id ~ '^[a-z0-9_]{2,40}:[^[:space:]]{1,250}$'),
  CONSTRAINT lsei_provider_check     CHECK (provider ~ '^[a-z0-9_]{2,40}$' AND left(item_id, char_length(provider) + 1) = provider || ':'),
  CONSTRAINT lsei_provider_name_check CHECK (char_length(provider_name) BETWEEN 1 AND 120),
  CONSTRAINT lsei_title_check        CHECK (char_length(title) BETWEEN 1 AND 300),
  CONSTRAINT lsei_content_type_check CHECK (content_type IN ('image','audio','video','book','document','article','dataset','podcast','radio')),
  CONSTRAINT lsei_description_check  CHECK (description IS NULL OR char_length(description) <= 600),
  CONSTRAINT lsei_creator_check      CHECK (creator IS NULL OR char_length(creator) <= 200),
  -- https only, no whitespace, at most 2048 characters (the regex engine caps {m,n} at 255, so length is its own test).
  CONSTRAINT lsei_urls_check         CHECK (
    external_url ~ '^https://[^[:space:]]+$' AND char_length(external_url) BETWEEN 12 AND 2048
    AND (thumbnail_url IS NULL OR (thumbnail_url ~ '^https://[^[:space:]]+$' AND char_length(thumbnail_url) BETWEEN 12 AND 2048))
    AND (download_url  IS NULL OR (download_url  ~ '^https://[^[:space:]]+$' AND char_length(download_url)  BETWEEN 12 AND 2048))
    AND (license_url   IS NULL OR (license_url   ~ '^https://[^[:space:]]+$' AND char_length(license_url)   BETWEEN 12 AND 2048))
  ),
  CONSTRAINT lsei_text_check         CHECK (
    (license_name IS NULL OR char_length(license_name) <= 120)
    AND (attribution IS NULL OR char_length(attribution) <= 400)
    AND (language IS NULL OR char_length(language) <= 20)
    AND (published_at IS NULL OR char_length(published_at) <= 40)
    AND (note IS NULL OR char_length(note) <= 500)
  )
);

COMMENT ON TABLE public.library_saved_external_items IS
  'A user''s shelf of external Library results: metadata and links only, never media. Written only by library_save_external_item(); readable and deletable by its owner.';

CREATE INDEX IF NOT EXISTS library_saved_external_items_user_saved_idx
  ON public.library_saved_external_items (user_id, saved_at DESC);

ALTER TABLE public.library_saved_external_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.library_saved_external_items FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.library_saved_external_items TO authenticated;
GRANT ALL ON TABLE public.library_saved_external_items TO service_role;

DROP POLICY IF EXISTS lsei_select_own ON public.library_saved_external_items;
CREATE POLICY lsei_select_own ON public.library_saved_external_items
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS lsei_delete_own ON public.library_saved_external_items;
CREATE POLICY lsei_delete_own ON public.library_saved_external_items
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- ── Saving ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.library_save_external_item(_item jsonb, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- The Library is a plan section; the free week does not include it.
  IF NOT public.user_has_section(_uid, 'library') THEN
    RAISE EXCEPTION 'subscription_required' USING ERRCODE = '42501';
  END IF;

  IF _item IS NULL OR jsonb_typeof(_item) <> 'object' THEN
    RAISE EXCEPTION 'invalid_item' USING ERRCODE = '22023';
  END IF;

  -- One lock per user, so two saves cannot both slip under the cap.
  PERFORM pg_advisory_xact_lock(hashtextextended('lsei:' || _uid::text, 0));
  IF (SELECT count(*) FROM public.library_saved_external_items WHERE user_id = _uid) >= 500
     AND NOT EXISTS (SELECT 1 FROM public.library_saved_external_items WHERE user_id = _uid AND item_id = _item ->> 'id')
  THEN
    RAISE EXCEPTION 'library_full' USING ERRCODE = '54000';
  END IF;

  INSERT INTO public.library_saved_external_items (
    user_id, item_id, provider, provider_name, title, content_type, description, creator,
    thumbnail_url, external_url, download_url, license_name, license_url, attribution, language, published_at, note
  ) VALUES (
    _uid, _item ->> 'id', _item ->> 'provider', _item ->> 'providerName', _item ->> 'title', _item ->> 'contentType',
    nullif(left(_item ->> 'description', 600), ''), nullif(left(_item ->> 'creator', 200), ''),
    nullif(_item ->> 'thumbnailUrl', ''), _item ->> 'externalUrl', nullif(_item ->> 'downloadUrl', ''),
    nullif(_item #>> '{license,name}', ''), nullif(_item #>> '{license,url}', ''),
    nullif(left(_item ->> 'attribution', 400), ''), nullif(_item ->> 'language', ''), nullif(_item ->> 'publishedAt', ''),
    nullif(left(_note, 500), '')
  )
  ON CONFLICT (user_id, item_id) DO UPDATE
    SET note = COALESCE(EXCLUDED.note, public.library_saved_external_items.note)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

COMMENT ON FUNCTION public.library_save_external_item(jsonb, text) IS
  'Saves one external Library result to the caller''s shelf. Requires the Library section; re-checks every field through the table constraints; at most 500 per user. Idempotent per item.';

REVOKE ALL ON FUNCTION public.library_save_external_item(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_save_external_item(jsonb, text) TO authenticated, service_role;

-- ── Removing ───────────────────────────────────────────────────────────────
--
-- Deliberately not gated by the plan: somebody whose plan lapsed can still tidy
-- their own shelf. (RLS would allow the plain DELETE too; this is the one call
-- the page makes, and it answers whether anything was there.)

CREATE OR REPLACE FUNCTION public.library_unsave_external_item(_item_id text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;
  DELETE FROM public.library_saved_external_items WHERE user_id = _uid AND item_id = _item_id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0;
END;
$$;

COMMENT ON FUNCTION public.library_unsave_external_item(text) IS
  'Removes one item from the caller''s shelf. Not plan-gated. True when something was removed.';

REVOKE ALL ON FUNCTION public.library_unsave_external_item(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_unsave_external_item(text) TO authenticated, service_role;
