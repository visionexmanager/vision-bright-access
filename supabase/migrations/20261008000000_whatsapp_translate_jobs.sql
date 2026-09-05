-- Translating a document is the second thing that cannot be done in a webhook.
--
-- A conversion is one call to ffmpeg. A translation is one provider call per
-- chunk, and a PDF is many chunks — so it is slower than a transcode, not
-- faster, and the same reasoning applies: Meta redelivers a webhook that does
-- not answer promptly, and a redelivery would start the whole document again.
--
-- The queue built for conversions already holds everything this needs. A job is
-- a file, an operation and a target; the only difference is that `target` is a
-- language rather than a container. Adding a second table would be a second
-- claim, a second lease, a second sweep and a second thing to reason about at
-- three in the morning, for a row that is the same shape.

-- ── The operation ────────────────────────────────────────────────────────────
--
-- The CHECK is replaced rather than dropped. A column with no constraint would
-- accept `operation = 'delete_everything'` from any future typo, and the value
-- is what the worker branches on.

ALTER TABLE public.whatsapp_media_jobs
  DROP CONSTRAINT IF EXISTS whatsapp_media_jobs_operation_check;

ALTER TABLE public.whatsapp_media_jobs
  ADD CONSTRAINT whatsapp_media_jobs_operation_check
  CHECK (operation IN ('convert', 'translate'));

-- ── The filename ─────────────────────────────────────────────────────────────
--
-- Needed for one specific case and worth the column for it: WhatsApp hands over
-- an `.srt` as `application/octet-stream`, a MIME type that says nothing, and a
-- subtitle file is exactly the thing people ask to have translated. Without the
-- name there is no way to know a subtitle file from a text file until it has
-- already been translated as prose — which destroys its timings.
--
-- It is the sender's own filename, so it is bounded and it is dropped with the
-- row on the same one-day clock as everything else here. Nothing reads it but
-- the extractor's format guess.
ALTER TABLE public.whatsapp_media_jobs
  ADD COLUMN IF NOT EXISTS source_filename text;

COMMENT ON COLUMN public.whatsapp_media_jobs.source_filename IS
  'The sender''s filename, used only to tell a subtitle file from a text file when WhatsApp declares neither.';
