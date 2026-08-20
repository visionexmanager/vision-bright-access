-- WhatsApp assistant: the mode a sender armed for their next picture.
--
-- The five visual-assistance modes (describe, read text, find object, product,
-- translate) can be set in a photo's caption, but that is the interaction this
-- audience can least afford: typing a caption while aiming a camera one-handed,
-- with a screen reader running, is the hardest step in the whole flow.
--
-- So a mode can also be set as a message of its own — including a voice note —
-- and it waits here for the picture that follows. That turns the hard case into
-- "say what you want, then take the photo".
--
-- Deliberately three columns on the conversation rather than a queue table:
-- exactly one mode can be armed at a time, and the next picture consumes it.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS pending_vision_mode text
    CHECK (pending_vision_mode IS NULL OR pending_vision_mode IN (
      'describe', 'read_text', 'find_object', 'product', 'translate'
    )),
  -- What to look for (find_object), or the language to translate into.
  ADD COLUMN IF NOT EXISTS pending_vision_target text,
  -- When it was armed. The webhook ignores anything older than ten minutes.
  ADD COLUMN IF NOT EXISTS pending_vision_at timestamptz;

COMMENT ON COLUMN public.whatsapp_conversations.pending_vision_mode IS
  'Visual-assistance mode armed by a text or voice message, waiting for the next image. Consumed on use and expired after ten minutes: a stale mode would answer confidently about the wrong picture.';

COMMENT ON COLUMN public.whatsapp_conversations.pending_vision_target IS
  'The object being searched for (find_object), or the target language (translate). NULL when the mode needs no argument.';
