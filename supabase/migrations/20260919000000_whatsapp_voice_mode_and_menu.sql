-- WhatsApp assistant: answer in the medium you were asked in, and remember
-- that a menu was offered.
--
-- ── voice_mode ──────────────────────────────────────────────────────────────
--
-- `voice_replies` was a single boolean: spoken replies on, or off, and off by
-- default. That framing forced the wrong question on the sender. Somebody who
-- sends a voice note has already said how they want to be answered — out loud
-- — and somebody who typed has said the opposite, in the same breath. Making
-- them go and set a preference to get that is asking them to configure the
-- obvious.
--
--   mirror - voice in, voice out; typed in, typed out. The new default, and
--            the one nobody has to ask for.
--   always - spoken even when they typed. For someone who cannot read a screen
--            at all, and asked for it.
--   never  - text only, whatever arrives. For someone whose phone is in a room
--            they do not control.
--
-- The backfill maps `voice_replies = true` to 'always', because that was an
-- explicit request and staying quiet on a typed message would take away
-- something they asked for. Everything else becomes 'mirror'. That does mean a
-- conversation that once said "text only" now hears its voice notes answered
-- out loud: `false` was both "asked for text" and "never asked", the two are
-- indistinguishable in the column, and mirroring is the better guess for the
-- overwhelming majority who never asked. "اكتب فقط" sets 'never' again.
--
-- `voice_replies` is deliberately left in place and still written by the
-- webhook. It is one line at one call site, and it means a rollback of the
-- Edge Function to the previous release finds the column it expects, holding
-- what it expects, rather than speaking to everybody or nobody.

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS voice_mode text NOT NULL DEFAULT 'mirror'
    CHECK (voice_mode IN ('mirror', 'always', 'never')),
  -- When the numbered menu was last offered. A bare "3" is a menu choice only
  -- for a short while after that; outside the window it is the number three,
  -- and reading it as a tap would hijack an ordinary sentence.
  ADD COLUMN IF NOT EXISTS menu_sent_at timestamptz;

UPDATE public.whatsapp_conversations
   SET voice_mode = 'always'
 WHERE voice_replies IS TRUE
   AND voice_mode = 'mirror';

COMMENT ON COLUMN public.whatsapp_conversations.voice_mode IS
  'How replies are delivered: mirror (match the sender, the default), always (speak everything), never (text only).';

COMMENT ON COLUMN public.whatsapp_conversations.menu_sent_at IS
  'When the numbered menu was last sent. A bare number is read as a menu choice only shortly after this.';

COMMENT ON COLUMN public.whatsapp_conversations.voice_replies IS
  'Superseded by voice_mode; still written so a rollback of the Edge Function finds a truthful value. Read nothing new from it.';
