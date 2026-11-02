-- The last document a sender shared, so "حوّله إلى Word" typed afterwards has a
-- file to act on. A conversion used to need the request in the caption of the
-- same message; a PDF that was sent to be summarised, then asked about, left
-- the follow-up with nothing attached and the sender with no answer.
--
-- One row per conversation, replaced by the next document. Only Meta's media
-- id and the file's type are kept, never its contents or its text; Meta
-- expires the id on its own, and the webhook ignores a row older than a week.

CREATE TABLE IF NOT EXISTS public.whatsapp_recent_documents (
  conversation_id uuid PRIMARY KEY REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  media_id        text NOT NULL,
  mime_type       text,
  filename        text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_recent_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_recent_documents: service role only" ON public.whatsapp_recent_documents;
CREATE POLICY "whatsapp_recent_documents: service role only"
  ON public.whatsapp_recent_documents FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
