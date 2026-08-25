-- Whether an inbound message was actually finished with.
--
-- ── The failure ─────────────────────────────────────────────────────────────
--
-- Deduplication works by inserting the inbound message with Meta's id on the
-- unique index `whatsapp_messages.wa_message_id`. The claim is taken before the
-- expensive work — transcription, retrieval, the model, synthesis — which is
-- correct: it is what stops a Meta retry becoming a second reply.
--
-- But nothing recorded whether the work ever finished. A delivery that died
-- halfway left the row inserted and the customer unanswered; Meta redelivered,
-- the insert collided, and the retry was discarded as a duplicate. The
-- mechanism that makes retries safe was also the mechanism that made recovery
-- impossible.
--
-- For a blind customer that is the worst outcome in the system. Not a wrong
-- answer — silence, with nothing on screen to reread and no way to tell whether
-- to wait or to send it again.
--
-- ── Two nullable columns, and nothing else ──────────────────────────────────
--
-- Additive, and safe against a schema the Edge Function is briefly ahead of:
-- `deploy.yml` runs migrations and function deploys in parallel, so for a few
-- minutes on release day the old function is live against these columns and the
-- new function is live against a table without them. Both work. The old
-- function never writes them and its rows read as NULL; the new function treats
-- NULL as "written before this existed", which the recovery rule then resolves
-- towards *not* reprocessing until the row is old enough that nothing can be in
-- flight. See `claimDecision` in `whatsappReliability.ts` for why the unknown
-- case resolves that way rather than the other.
--
-- No backfill. Every existing row is finished by definition — it is in the
-- transcript and it predates this migration — and an UPDATE across the whole
-- table to say so would take a lock on the hot path of a live channel to record
-- something the read rule already handles correctly.
--
-- No new table. The claim and the message are the same fact; a second table
-- keyed on the same message id would only be a way for the two to disagree.

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS processing_state text
    CHECK (processing_state IS NULL OR processing_state IN ('processing', 'done')),
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz;

COMMENT ON COLUMN public.whatsapp_messages.processing_state IS
  'processing: claimed, work not yet finished. done: fully handled, a redelivery is a true duplicate. NULL: written before this column, or by an outbound insert, and treated as unknown.';

COMMENT ON COLUMN public.whatsapp_messages.processing_started_at IS
  'When the claim was taken. A claim older than the recovery window with state still processing is treated as abandoned and may be retaken by a redelivery.';

-- Finding the abandoned claims, without scanning the transcript.
--
-- Partial on purpose: the only rows this index has to answer for are the
-- unfinished ones, which is a handful at any moment against a table that grows
-- forever. A full index here would be almost entirely 'done' rows nobody will
-- ever look up this way.
CREATE INDEX IF NOT EXISTS whatsapp_messages_unfinished_idx
  ON public.whatsapp_messages (processing_started_at)
  WHERE processing_state = 'processing';
