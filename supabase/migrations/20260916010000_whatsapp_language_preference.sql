-- WhatsApp assistant: remember the language a sender asked to be answered in.
--
-- `language` already held the language detected from the last message, which is
-- the right default but the wrong memory: a user who asked for English gets
-- switched back to Arabic the moment they quote an Arabic product name. A
-- preference, once set, outranks detection until the user changes it.
--
-- NULL means "follow the message", which stays the behaviour for everyone who
-- never expresses a preference.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS preferred_language text
    CHECK (preferred_language IS NULL OR preferred_language IN (
      'ar','bn','de','en','es','fa','fr','hi','id','it',
      'ja','ko','nl','pl','pt','ru','tr','ur','vi','zh'
    ));

COMMENT ON COLUMN public.whatsapp_conversations.preferred_language IS
  'Language the sender explicitly asked for. Outranks per-message detection. NULL means follow the message.';

COMMENT ON COLUMN public.whatsapp_conversations.language IS
  'Language detected from the most recent message. One of the twenty locales the site is translated into.';
