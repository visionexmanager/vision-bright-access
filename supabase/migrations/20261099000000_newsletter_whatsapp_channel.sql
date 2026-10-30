-- WhatsApp delivery for the daily news.
--
-- Pull, not push: a business can only start a WhatsApp conversation with an
-- approved template, so the bulletin goes out when the subscriber asks for it
-- (they send the word "news" to the Visionex number), once per day. Nothing
-- here sends a message by itself; wa_phone is only used to recognise the
-- sender, so entering somebody else's number cannot make us message them.

ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS wa_phone text,
  ADD COLUMN IF NOT EXISTS wa_last_sent_date date;

DO $$ BEGIN
  ALTER TABLE public.newsletter_subscribers
    ADD CONSTRAINT newsletter_channel_valid CHECK (channel IN ('email', 'whatsapp', 'both'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_subscribers
    ADD CONSTRAINT newsletter_wa_phone_format CHECK (wa_phone IS NULL OR wa_phone ~ '^[0-9]{8,15}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.newsletter_subscribers
    ADD CONSTRAINT newsletter_wa_phone_required CHECK (channel = 'email' OR wa_phone IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS newsletter_subscribers_wa_phone_idx
  ON public.newsletter_subscribers (wa_phone) WHERE wa_phone IS NOT NULL;

-- One bulletin per number per day (Beirut calendar day, the owner's day).
-- The UPDATE is the lock: two messages at the same instant cannot both win.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_news(p_phone text)
RETURNS TABLE (status text, topics text[], lang text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today  date := (now() AT TIME ZONE 'Asia/Beirut')::date;
  v_topics text[];
  v_lang   text;
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^[0-9]{8,15}$' THEN
    RETURN QUERY SELECT 'not_subscribed'::text, '{}'::text[], 'en'::text;
    RETURN;
  END IF;

  SELECT s.topics, s.lang INTO v_topics, v_lang
    FROM public.newsletter_subscribers s
   WHERE s.wa_phone = p_phone AND s.channel IN ('whatsapp', 'both')
   ORDER BY s.subscribed_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_subscribed'::text, '{}'::text[], 'en'::text;
    RETURN;
  END IF;

  UPDATE public.newsletter_subscribers s
     SET wa_last_sent_date = v_today
   WHERE s.wa_phone = p_phone
     AND s.channel IN ('whatsapp', 'both')
     AND s.wa_last_sent_date IS DISTINCT FROM v_today;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'already'::text, COALESCE(v_topics, '{}'::text[]), COALESCE(v_lang, 'en');
    RETURN;
  END IF;

  RETURN QUERY SELECT 'claimed'::text, COALESCE(v_topics, '{}'::text[]), COALESCE(v_lang, 'en');
END;
$$;

-- Hands today's turn back when the message could not be delivered.
CREATE OR REPLACE FUNCTION public.release_whatsapp_news(p_phone text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.newsletter_subscribers
     SET wa_last_sent_date = NULL
   WHERE wa_phone = p_phone
     AND wa_last_sent_date = (now() AT TIME ZONE 'Asia/Beirut')::date;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_news(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_whatsapp_news(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_news(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_whatsapp_news(text) TO service_role;
