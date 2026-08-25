-- Voice notes that have already been synthesised, kept so they are not paid
-- for twice.
--
-- ── Why this is the largest saving available ────────────────────────────────
--
-- The self-hosting audit's own arithmetic: text-to-speech is billed per
-- character on every single voice reply, and it is the one high-frequency
-- provider call with an exact local equivalent — the *same audio*, not a
-- similar one. Every other saving on that list trades quality for cost. This
-- one trades nothing, because a cache hit returns the bytes the provider
-- returned the first time.
--
-- And the traffic is unusually repetitive. The main menu, the list of twenty
-- language names, "send the photo and I'll read it", every refusal notice and
-- every welcome message are fixed strings that are synthesised again for every
-- sender who hears them, forever. Those are the rows this table exists for.
--
-- ── What is cached is Meta's media id, not the audio ────────────────────────
--
-- A synthesised voice note is uploaded to the phone number's media store before
-- it can be sent, and Meta returns an id. Caching that id skips both the
-- synthesis *and* the upload, leaving one Graph call to deliver a reply that
-- previously took three.
--
-- The cost of that choice is expiry: Meta keeps uploaded media for thirty days,
-- so a cached id has a shelf life. The TTL below is deliberately well inside it,
-- and a send that fails on a cached id deletes the row and synthesises again —
-- so a stale id costs one retry, never a missing voice note.
--
-- ── This table holds no words and no recipient ──────────────────────────────
--
-- A row is a SHA-256 of the spoken text, the voice and the sending phone
-- number id. The text itself is never stored, and there is no reference to a
-- conversation, a customer or a phone number that received anything.
--
-- That matters because, unlike the geo cache, the input here is not always
-- impersonal. Most of it is a menu; some of it is "your appointment is on
-- Tuesday". Storing the hash keeps the cache useful for the repeated strings —
-- which are the only ones that can ever produce a second hit — while a one-off
-- sentence leaves behind a hash of itself and nothing else.
--
-- A hash is still a hash, and somebody who could read this table and guess a
-- sentence exactly could confirm the assistant once said it. That is worth
-- naming rather than glossing: it is a real property. It is also strictly less
-- than what the same reader already has, because `whatsapp_messages.body`
-- stores those words in full, alongside the conversation they belong to. No
-- pepper is added for that reason — it would defend a weaker copy of data that
-- is already sitting in plain text one table away, which is theatre rather than
-- a control.

CREATE TABLE IF NOT EXISTS public.whatsapp_speech_cache (
  -- SHA-256 hex of `phone_number_id | voice | model | text`. Built by
  -- `speechCacheKey` in `whatsappSpeechCache.ts`; its shape is validated in
  -- code before any read or write.
  cache_key   text PRIMARY KEY,
  -- The id Meta returned when the synthesised audio was uploaded. This is what
  -- makes a hit cost one Graph call instead of three.
  media_id    text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- There is deliberately no hit counter and no last-used column.
--
-- Both were written and removed. Either one turns a cache hit into a database
-- *write* on the reply path, which is the path this table exists to shorten,
-- and it would be paid on every hit forever to answer a question that belongs
-- in a log line. "Is this cache doing anything" is answered by the `cached`
-- field the webhook already prints, at no cost to the person waiting.

COMMENT ON TABLE public.whatsapp_speech_cache IS
  'Media ids for voice notes that have already been synthesised and uploaded, keyed by a hash of the spoken text. Stores no words and no recipient. Rows expire well inside Meta''s 30-day media retention.';

COMMENT ON COLUMN public.whatsapp_speech_cache.cache_key IS
  'SHA-256 hex of phone_number_id|voice|model|text. The text is never stored.';

COMMENT ON COLUMN public.whatsapp_speech_cache.media_id IS
  'Meta media id from the upload. Expires on Meta''s side after 30 days; expires_at is set well inside that.';

-- Expiry is read on every lookup and swept periodically, so it is the only
-- column worth an index of its own.
CREATE INDEX IF NOT EXISTS whatsapp_speech_cache_expires_idx
  ON public.whatsapp_speech_cache (expires_at);

ALTER TABLE public.whatsapp_speech_cache ENABLE ROW LEVEL SECURITY;

-- No policy, deliberately.
--
-- Only the service role writes and reads this, and the service role bypasses
-- RLS. With RLS enabled and no policy, every other role — including `anon` and
-- `authenticated` — gets nothing. That is the correct answer for a table whose
-- contents are an implementation detail of the assistant, and it matches how
-- `whatsapp_geo_cache` and `whatsapp_conversations` are treated.

-- ── Sweeping ────────────────────────────────────────────────────────────────
--
-- An expired row is already ignored by every read, so this is housekeeping
-- rather than correctness. A function rather than a trigger because sweeping on
-- write would make an unrelated customer pay for the deletion.
CREATE OR REPLACE FUNCTION public.sweep_whatsapp_speech_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  DELETE FROM public.whatsapp_speech_cache WHERE expires_at < now();
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

COMMENT ON FUNCTION public.sweep_whatsapp_speech_cache() IS
  'Deletes expired speech cache rows. Housekeeping only — expired rows are already ignored on read.';

REVOKE ALL ON FUNCTION public.sweep_whatsapp_speech_cache() FROM PUBLIC;
