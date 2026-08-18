-- Facebook Messenger and Instagram Direct — the conversation log and the gate.
--
-- Visionex already answers customers on WhatsApp in production. This adds the
-- other two Meta inboxes to the same assistant, and deliberately adds nothing
-- else: no second AI, no second provider chain, no second escalation model.
--
-- ── Why new tables rather than widening the WhatsApp ones ───────────────────
--
-- whatsapp_conversations is keyed `wa_phone text NOT NULL UNIQUE`. A Messenger
-- PSID and an Instagram IGSID are not phone numbers, and they are only unique
-- WITHIN a page — the same person messaging the page and the Instagram account
-- has two different ids. Reusing that table would mean dropping its unique
-- constraint and repurposing a column whose name would then be a lie, on a
-- table the live WhatsApp path writes to on every inbound message.
--
-- The WhatsApp tables are therefore untouched. Nothing in this migration alters
-- them, reads them, or changes any policy on them.
--
-- ── The activation gate ────────────────────────────────────────────────────
--
-- Two independent conditions must hold before a single automatic reply is sent,
-- mirroring what Phase 8 did for publishing:
--
--   1. The platform granted the messaging permission — recorded in
--      social_accounts.capabilities from the OAuth grant, never assumed.
--   2. A human switched this channel on — messaging_enabled, default false.
--
-- Neither implies the other. An approved App Review does not start the bot, and
-- an operator cannot start it before the review lands.

-- ── The switch ──────────────────────────────────────────────────────────────

ALTER TABLE public.social_accounts
  ADD COLUMN IF NOT EXISTS messaging_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.social_accounts.messaging_enabled IS
  'Whether automatic AI replies are switched on for this account''s inbox. Default false. Independent of `status`, which governs publishing: an account may publish without answering messages and vice versa.';

-- ── Conversations ───────────────────────────────────────────────────────────
--
-- One row per (channel, person). Modelled on whatsapp_conversations so the
-- triage queue reads the same way, with `control` and the escalation columns
-- carrying identical meaning.

CREATE TABLE IF NOT EXISTS public.meta_conversations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  channel           text NOT NULL CHECK (channel IN ('messenger', 'instagram')),

  -- The platform's id for the customer: a page-scoped id (PSID) on Messenger,
  -- an Instagram-scoped id (IGSID) on Instagram. Scoped per channel, which is
  -- why it is unique together with the channel and not on its own.
  external_user_id  text NOT NULL,

  -- Which Visionex inbox received it — the page id or the Instagram account id.
  -- Kept so a second page or account later does not need a schema change.
  external_account_id text NOT NULL,

  -- The account whose token answers this conversation. RESTRICT because a
  -- conversation history must not disappear with a reconnection.
  account_id        uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,

  language          text NOT NULL DEFAULT 'en',

  -- Same vocabulary as the WhatsApp path: `escalated` is automatic, `control`
  -- is what a human deliberately took.
  escalated         boolean NOT NULL DEFAULT false,
  escalated_at      timestamptz,
  escalation_reason text,
  control           text NOT NULL DEFAULT 'ai' CHECK (control IN ('ai', 'human')),

  -- When the CUSTOMER last wrote. This is the clock Meta's 24-hour standard
  -- messaging window runs on, so it is stored rather than derived: deriving it
  -- from the messages table would mean an extra query on the one path where
  -- being wrong means sending outside the window.
  last_inbound_at   timestamptz,
  last_message_at   timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (channel, external_user_id)
);

-- ── Messages ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meta_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.meta_conversations(id) ON DELETE CASCADE,
  direction       text NOT NULL CHECK (direction IN ('inbound', 'outbound')),

  -- Meta's own message id. NULL for anything Visionex originates.
  external_message_id text,

  -- NULL or 'reply' is conversational and is replayed to the model. The rest is
  -- canned text and is not, exactly as on the WhatsApp side.
  kind            text CHECK (kind IN ('welcome', 'reply', 'handover', 'unsupported', 'window_closed')),
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- The idempotency guarantee, and the reason a webhook retry is free.
--
-- Meta redelivers any delivery it did not get a prompt 200 for, and it does so
-- with the SAME message id. A partial unique index rather than a column
-- constraint because outbound rows carry NULL here and there are many of them.
--
-- Scoped by channel: Messenger and Instagram mint ids independently and a
-- collision across the two is possible in principle.
CREATE UNIQUE INDEX IF NOT EXISTS meta_messages_external_id_uniq
  ON public.meta_messages (conversation_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS meta_messages_conversation_idx
  ON public.meta_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS meta_conversations_escalated_idx
  ON public.meta_conversations (escalated_at)
  WHERE escalated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- These rows hold what a customer typed and a platform id that identifies them,
-- so they follow the WhatsApp precedent exactly: service-role writes, admin
-- reads, and no "users can read their own" policy — a Messenger sender has no
-- Visionex session to match against.

ALTER TABLE public.meta_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_messages      ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'meta_conversations'
       AND policyname = 'Admins can view meta conversations'
  ) THEN
    CREATE POLICY "Admins can view meta conversations"
      ON public.meta_conversations FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'meta_messages'
       AND policyname = 'Admins can view meta messages'
  ) THEN
    CREATE POLICY "Admins can view meta messages"
      ON public.meta_messages FOR SELECT TO authenticated
      USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- ── May this inbox answer automatically? ────────────────────────────────────
--
-- One statement of the rule, so the webhook cannot drift from it and a later
-- caller cannot answer the question a different way.
--
-- The scope check reads `capabilities`, which the OAuth callback fills from
-- what the platform reported it GRANTED. Asking for a permission is not being
-- given one, and this function must never be satisfied by the request.

CREATE OR REPLACE FUNCTION public.meta_messaging_allowed(
  _channel text,
  _external_account_id text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account public.social_accounts%ROWTYPE;
  _platform text;
  -- Every permission name that grants this channel, and the one to NAME when
  -- none is present.
  --
  -- Instagram ships two product configurations with two vocabularies:
  --   Instagram API with Facebook Login  → instagram_manage_messages
  --   Instagram API with Instagram Login → instagram_business_manage_messages
  -- Visionex uses the second. Accepting only one name would report a correctly
  -- approved app as unapproved, which is indistinguishable from a real refusal.
  _scopes text[];
  _scope text;
BEGIN
  IF _channel = 'messenger' THEN
    _platform := 'facebook';
    _scopes := ARRAY['pages_messaging'];
    _scope := 'pages_messaging';
  ELSIF _channel = 'instagram' THEN
    _platform := 'instagram';
    _scopes := ARRAY['instagram_business_manage_messages', 'instagram_manage_messages'];
    _scope := 'instagram_business_manage_messages';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_channel');
  END IF;

  SELECT * INTO _account
    FROM public.social_accounts
   WHERE platform = _platform
     AND external_account_id = _external_account_id
   LIMIT 1;

  IF NOT FOUND THEN
    -- The inbox is not one Visionex has connected. Recorded, never answered.
    RETURN jsonb_build_object('ok', false, 'error', 'account_not_connected');
  END IF;

  IF NOT _account.messaging_enabled THEN
    RETURN jsonb_build_object('ok', false, 'error', 'messaging_not_enabled',
                              'account_id', _account.id);
  END IF;

  -- Any accepted name satisfies it; the refusal names the current one.
  IF NOT (_account.capabilities && _scopes) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'messaging_scope_not_granted',
                              'account_id', _account.id, 'required_scope', _scope);
  END IF;

  RETURN jsonb_build_object('ok', true, 'account_id', _account.id,
                            'platform', _platform);
END;
$$;

REVOKE ALL ON FUNCTION public.meta_messaging_allowed(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_messaging_allowed(text, text) TO service_role;

COMMENT ON FUNCTION public.meta_messaging_allowed(text, text) IS
  'Whether an inbox may answer automatically: the account is connected, a human enabled messaging, and the platform granted the messaging scope. Returns a reason code when not, so the webhook can log why rather than failing silently.';

COMMENT ON TABLE public.meta_conversations IS
  'One row per person per Meta inbox (Messenger, Instagram Direct). Written only by the meta-messaging-webhook edge function with the service role; readable by admins for triage. The WhatsApp tables are separate and unchanged.';

-- No account is enabled here, and no conversation is seeded. Switching an inbox
-- on is a human decision taken after App Review, which is the whole point of
-- messaging_enabled defaulting to false.
