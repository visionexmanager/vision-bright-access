-- WhatsApp assistant: rolling memory and a retention policy.
--
-- Two problems this fixes.
--
-- Context was bounded by *turn count* (12) but not by size, so twelve long
-- messages could push tens of thousands of characters into every model call.
-- The fix is a rolling summary: older turns are condensed once and the summary
-- is replayed instead of the raw text, which keeps the conversation coherent
-- past the window without paying for it on every message.
--
-- And nothing was ever deleted. These rows hold a phone number and whatever a
-- customer typed, so keeping them indefinitely is a liability rather than a
-- feature. Transcripts are pruned on a schedule; the conversation row and its
-- summary survive, so the assistant still knows who it is talking to.

ALTER TABLE public.whatsapp_conversations
  -- Condensed record of everything older than the live window.
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz,
  -- Inbound messages already folded into the summary. Compared against the
  -- current count to decide when the summary is stale enough to redo.
  ADD COLUMN IF NOT EXISTS summarized_message_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.whatsapp_conversations.summary IS
  'Rolling summary of turns older than the replay window. Facts and open issues only — never credentials, card numbers or one-time codes.';

-- ── Retention ───────────────────────────────────────────────────────────
--
-- 90 days of transcript is far more than support needs and is the outer edge
-- of what is reasonable to hold. The summary is what carries continuity, and
-- it is not a transcript.
CREATE OR REPLACE FUNCTION public.whatsapp_prune_transcripts(_days integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer;
BEGIN
  IF _days < 7 THEN
    RAISE EXCEPTION 'retention floor is 7 days, got %', _days;
  END IF;

  WITH gone AS (
    DELETE FROM public.whatsapp_messages
    WHERE created_at < now() - make_interval(days => _days)
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM gone;

  RETURN removed;
END;
$$;

-- Service role only. Nothing about this belongs to an end user, and an
-- authenticated caller must not be able to erase a support transcript.
REVOKE ALL ON FUNCTION public.whatsapp_prune_transcripts(integer) FROM public;
REVOKE ALL ON FUNCTION public.whatsapp_prune_transcripts(integer) FROM anon;
REVOKE ALL ON FUNCTION public.whatsapp_prune_transcripts(integer) FROM authenticated;

COMMENT ON FUNCTION public.whatsapp_prune_transcripts(integer) IS
  'Deletes WhatsApp message rows older than _days (minimum 7). Conversation rows and their summaries are kept. Service role only.';

-- Schedule it where pg_cron is enabled. Kept as a comment for the same reason
-- the other recovery jobs in this repository are: the extension is enabled per
-- environment, and a migration that assumes it fails on the ones without it.
--
--   select cron.schedule('prune-whatsapp-transcripts', '30 3 * * *',
--     $$select public.whatsapp_prune_transcripts(90)$$);
