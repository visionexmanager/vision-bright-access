-- YouTube channels and playlists on the My Library shelf.
--
-- The shelf (20261065, library_saved_external_items) already keeps one row per
-- external result: metadata and links, never media. YouTube joins it rather than
-- getting a table of its own. Three additive changes, and nothing existing moves:
--
--   1. content_type also accepts 'channel' and 'playlist' — a reference to a
--      collection at its source (YouTube has no other kind of thing to call them).
--   2. a small `metadata` object for provider facts worth keeping (a YouTube
--      channel id, a view count). Flat, an object, at most 2,000 characters.
--   3. a YouTube row must be a YouTube resource: its id and its address both
--      follow YouTube's own patterns, and agree with its type. Nothing can be
--      saved as "youtube" that points anywhere else.
--
-- library_save_external_item() is replaced to carry `metadata` through; its
-- checks, its plan gate (the Library section) and its 500-item cap are unchanged.

ALTER TABLE public.library_saved_external_items
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.library_saved_external_items DROP CONSTRAINT IF EXISTS lsei_content_type_check;
ALTER TABLE public.library_saved_external_items ADD CONSTRAINT lsei_content_type_check
  CHECK (content_type IN ('image','audio','video','book','document','article','dataset','podcast','radio','channel','playlist'));

ALTER TABLE public.library_saved_external_items DROP CONSTRAINT IF EXISTS lsei_metadata_check;
ALTER TABLE public.library_saved_external_items ADD CONSTRAINT lsei_metadata_check
  CHECK (metadata IS NULL OR (jsonb_typeof(metadata) = 'object' AND char_length(metadata::text) <= 2000));

ALTER TABLE public.library_saved_external_items DROP CONSTRAINT IF EXISTS lsei_youtube_check;
ALTER TABLE public.library_saved_external_items ADD CONSTRAINT lsei_youtube_check
  CHECK (
    provider <> 'youtube'
    OR (content_type = 'video'
        AND item_id ~ '^youtube:[A-Za-z0-9_-]{11}$'
        AND external_url ~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$'
        AND left(item_id, 8) = 'youtube:' AND right(external_url, 11) = right(item_id, 11))
    OR (content_type = 'channel'
        AND item_id ~ '^youtube:channel:UC[A-Za-z0-9_-]{22}$'
        AND external_url ~ '^https://www\.youtube\.com/channel/UC[A-Za-z0-9_-]{22}$'
        AND right(external_url, 24) = right(item_id, 24))
    OR (content_type = 'playlist'
        AND item_id ~ '^youtube:playlist:[A-Za-z0-9_-]{10,64}$'
        AND external_url ~ '^https://www\.youtube\.com/playlist\?list=[A-Za-z0-9_-]{10,64}$'
        AND substring(external_url from 'list=(.*)$') = substring(item_id from '^youtube:playlist:(.*)$'))
  );

COMMENT ON COLUMN public.library_saved_external_items.metadata IS
  'Small flat provider facts (for YouTube: resourceType, channelId, counts). An object of at most 2,000 characters.';

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
    thumbnail_url, external_url, download_url, license_name, license_url, attribution, language, published_at, note, metadata
  ) VALUES (
    _uid, _item ->> 'id', _item ->> 'provider', _item ->> 'providerName', _item ->> 'title', _item ->> 'contentType',
    nullif(left(_item ->> 'description', 600), ''), nullif(left(_item ->> 'creator', 200), ''),
    nullif(_item ->> 'thumbnailUrl', ''), _item ->> 'externalUrl', nullif(_item ->> 'downloadUrl', ''),
    nullif(_item #>> '{license,name}', ''), nullif(_item #>> '{license,url}', ''),
    nullif(left(_item ->> 'attribution', 400), ''), nullif(_item ->> 'language', ''), nullif(_item ->> 'publishedAt', ''),
    nullif(left(_note, 500), ''),
    CASE WHEN jsonb_typeof(_item -> 'metadata') = 'object' THEN _item -> 'metadata' END
  )
  ON CONFLICT (user_id, item_id) DO UPDATE
    SET note = COALESCE(EXCLUDED.note, public.library_saved_external_items.note)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

COMMENT ON FUNCTION public.library_save_external_item(jsonb, text) IS
  'Saves one external Library result to the caller''s shelf. Requires the Library section; re-checks every field through the table constraints (a YouTube row must be a real YouTube id and address); at most 500 per user. Idempotent per item.';

REVOKE ALL ON FUNCTION public.library_save_external_item(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.library_save_external_item(jsonb, text) TO authenticated, service_role;
