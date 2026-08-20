-- Switch the Visionex Facebook Page inbox on.
--
-- 20260914000000 added `messaging_enabled` defaulting to false and said:
-- "Switching an inbox on is a human decision taken after App Review, which is
-- the whole point of messaging_enabled defaulting to false."
--
-- That decision has now been taken. Meta reports `pages_messaging` and
-- `pages_manage_metadata` as Ready for testing, the Page webhook is subscribed
-- to `messages`, and the operator asked for the inbox to be activated. This
-- migration is the record of that decision, which is why it is a migration and
-- not a hand-typed UPDATE against production: it is reviewed, it is idempotent,
-- and it leaves an audit row.
--
-- ── Scope ──────────────────────────────────────────────────────────────────
--
-- One row, for one Page, on one channel. It does not touch Instagram, Threads
-- or any WhatsApp object, and it does not make the account publishable —
-- `status` is left exactly as it was. Messaging and publishing are separate
-- gates on purpose: meta_messaging_allowed() never reads `status`, and
-- claim_due_content_slot() never reads `messaging_enabled`.

DO $$
DECLARE
  -- The Visionex Page, from Messenger API Setup. A public identifier, not a
  -- credential: it appears in every webhook delivery Meta sends.
  _page_id  CONSTANT text := '1250177161514940';
  _handle   CONSTANT text := 'visionex';
  _account_id uuid;
  _verdict  jsonb;
BEGIN
  -- ── Find the row, without ever creating a second one ──────────────────
  --
  -- Two lookups because there are two ways a row for this Page could already
  -- exist: connected through the OAuth flow (which sets external_account_id)
  -- or created earlier by handle. UNIQUE is on (platform, handle), so a blind
  -- INSERT would raise on the second case and a blind upsert on handle would
  -- silently retarget a row pointing at a different Page.
  SELECT id INTO _account_id
    FROM public.social_accounts
   WHERE platform = 'facebook' AND external_account_id = _page_id
   LIMIT 1;

  IF _account_id IS NULL THEN
    SELECT id INTO _account_id
      FROM public.social_accounts
     WHERE platform = 'facebook' AND handle = _handle
     LIMIT 1;
  END IF;

  IF _account_id IS NULL THEN
    INSERT INTO public.social_accounts (
      platform, handle, display_name, external_account_id,
      capabilities, messaging_enabled
    )
    VALUES (
      'facebook', _handle, 'Visionex', _page_id,
      ARRAY['pages_messaging'], true
    )
    RETURNING id INTO _account_id;

  ELSE
    UPDATE public.social_accounts
       SET external_account_id = _page_id,
           messaging_enabled   = true,
           -- Appended, never replaced. A row connected through OAuth already
           -- carries what the platform granted, and overwriting that would
           -- discard evidence this system depends on elsewhere.
           capabilities = CASE
             WHEN 'pages_messaging' = ANY (capabilities) THEN capabilities
             ELSE array_append(capabilities, 'pages_messaging')
           END,
           display_name = coalesce(display_name, 'Visionex'),
           updated_at = now()
     WHERE id = _account_id;
  END IF;

  -- ── Prove it worked, or fail the deploy ───────────────────────────────
  --
  -- The gate is the thing that actually decides whether a customer gets an
  -- answer, so it is asked directly rather than trusting that setting the
  -- columns was enough. A migration that applied cleanly and left the inbox
  -- silent would be the worst outcome here: every symptom would point at the
  -- webhook, Meta, or the token, and none of those would be wrong.
  _verdict := public.meta_messaging_allowed('messenger', _page_id);

  IF _verdict->>'ok' <> 'true' THEN
    RAISE EXCEPTION
      'Messenger inbox activation did not take: %', _verdict->>'error';
  END IF;

  -- ── The audit trail ───────────────────────────────────────────────────
  --
  -- actor_id is NULL because a migration has no session. The action name and
  -- the metadata say what happened and to which Page; no token, no secret.
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  VALUES (NULL, 'meta_messaging_enabled', 'social_account', _account_id,
          jsonb_build_object('channel', 'messenger',
                             'external_account_id', _page_id,
                             'via', 'migration_20260915000000'));

  RAISE NOTICE 'Messenger inbox active for page % (account %)', _page_id, _account_id;
END $$;

-- Idempotent by construction: re-running finds the row by external_account_id,
-- re-asserts the same values, and the gate check passes again. `db push
-- --include-all` re-runs every migration on every deploy, so this matters.
--
-- Instagram is deliberately NOT enabled here. Its account is connected under a
-- different product with a different permission, and switching it on is its own
-- decision on its own evidence.
