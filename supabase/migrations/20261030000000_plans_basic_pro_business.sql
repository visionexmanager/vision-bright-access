-- The paid tiers are named for what they are: Basic, Pro, Business.
--
-- Bronze/Silver/Gold said nothing about who a tier was for, and the ordering
-- was a convention a reader had to already know. The economics do not move:
-- Basic is the old Bronze at $5 and 5,000 VX, Pro the old Silver at $7 and
-- 12,000, Business the old Gold at $10 and 30,000. Kids keeps its own id, its
-- own $3 and its place beside the tiers rather than inside them.
--
-- FREE is deliberately not a row here. An account with no subscription already
-- gets the free sections — news, community, the assistive catalogue — from
-- `plans.ts`, and the pricing page shows that as FREE. Adding a row would mean
-- two code paths for one state.
--
-- ── Why insert-repoint-delete rather than UPDATE ... SET id ─────────────────
--
-- `user_subscriptions.plan_id` and `subscription_orders.plan_id` both carry a
-- plain `REFERENCES billing_plans(id)` — no ON UPDATE CASCADE — so renaming a
-- primary key in place would be refused the moment a row pointed at it.
-- Production holds zero subscriptions and zero orders today, but a migration
-- that is only correct while a table is empty is a migration waiting to fail.
-- So: create the new row, move any children onto it, drop the old row.
--
-- Nothing here deletes a subscription, an order or a balance.

-- ── 1. The three dormant rows from the pre-2026-10 pricing model ────────────
--
-- `basic` ($9.99), `pro` ($29.99) and `enterprise` ($99.99) were deactivated by
-- 20261012 but never removed, and the first two hold exactly the identifiers
-- the new tiers need. They are deleted when nothing points at them, and parked
-- under a legacy id when something does — a dormant catalogue row is cheap, a
-- lost order is not.

DO $$
DECLARE
  _id text;
  _refs bigint;
BEGIN
  FOREACH _id IN ARRAY ARRAY['basic', 'pro', 'enterprise']
  LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.billing_plans WHERE id = _id);

    -- Only the old model's rows are in scope. If a row with this id is already
    -- the new tier — because this migration has run before — leave it alone.
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.billing_plans
       WHERE id = _id AND is_active AND price_monthly_usd IN (5, 7, 10)
    );

    SELECT (SELECT count(*) FROM public.user_subscriptions WHERE plan_id = _id)
         + (SELECT count(*) FROM public.subscription_orders WHERE plan_id = _id)
      INTO _refs;

    IF _refs = 0 THEN
      DELETE FROM public.billing_plans WHERE id = _id;
      RAISE NOTICE 'Removed dormant plan %, nothing referenced it.', _id;
    ELSE
      INSERT INTO public.billing_plans
        (id, name, description, price_monthly_usd, vx_credits_monthly,
         is_unlimited, features, limits, is_active, sort_order)
      SELECT 'legacy_' || id, name, description, price_monthly_usd, vx_credits_monthly,
             is_unlimited, features, limits, false, 900
        FROM public.billing_plans WHERE id = _id
      ON CONFLICT (id) DO NOTHING;

      UPDATE public.user_subscriptions  SET plan_id = 'legacy_' || _id WHERE plan_id = _id;
      UPDATE public.subscription_orders SET plan_id = 'legacy_' || _id WHERE plan_id = _id;
      DELETE FROM public.billing_plans WHERE id = _id;
      RAISE NOTICE 'Parked plan % as legacy_% — % row(s) referenced it.', _id, _id, _refs;
    END IF;
  END LOOP;
END $$;

-- ── 2. Bronze → Basic, Silver → Pro, Gold → Business ───────────────────────
--
-- The feature lists are rewritten at the same time, for two reasons: they name
-- the tier below ("Everything in Bronze"), and they said "VX credits", which is
-- not what the currency is called anywhere a user can see it. It is VX.

DO $$
DECLARE
  _pair record;
BEGIN
  FOR _pair IN
    SELECT * FROM (VALUES ('bronze', 'basic'), ('silver', 'pro'), ('gold', 'business'))
      AS t(old_id, new_id)
  LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM public.billing_plans WHERE id = _pair.old_id);

    INSERT INTO public.billing_plans
      (id, name, description, price_monthly_usd, vx_credits_monthly,
       is_unlimited, features, limits, is_active, sort_order)
    SELECT _pair.new_id, name, description, price_monthly_usd, vx_credits_monthly,
           is_unlimited, features, limits, is_active, sort_order
      FROM public.billing_plans WHERE id = _pair.old_id
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.user_subscriptions  SET plan_id = _pair.new_id WHERE plan_id = _pair.old_id;
    UPDATE public.subscription_orders SET plan_id = _pair.new_id WHERE plan_id = _pair.old_id;
    DELETE FROM public.billing_plans WHERE id = _pair.old_id;
  END LOOP;
END $$;

-- ── 3. The names, descriptions and feature lists ───────────────────────────
--
-- Written unconditionally so re-running this file converges, and so the copy
-- is correct whether the rows arrived through step 2 or already existed.

UPDATE public.billing_plans SET
  name        = 'Basic',
  description = 'Learning, reading and playing — the assistant included',
  sort_order  = 2,
  features    = '["Visionex assistant on WhatsApp and on the site","Academy","Library","Arcade games","VXBazaar","News and community","5,000 VX a month","150 assistant requests a day"]'::jsonb
WHERE id = 'basic';

UPDATE public.billing_plans SET
  name        = 'Pro',
  description = 'Everything in Basic, plus the family sections',
  sort_order  = 3,
  features    = '["Everything in Basic","VisionKids","Career Hub","Visionex TV","Visionex Radio","Messages and voice rooms","Simulations","12,000 VX a month","400 assistant requests a day"]'::jsonb
WHERE id = 'pro';

UPDATE public.billing_plans SET
  name        = 'Business',
  description = 'Everything in Pro, plus the creation tools',
  sort_order  = 4,
  features    = '["Everything in Pro","AI Media Studio","Library Studio publishing","Professional tools and file studio","VX Finance Hub","30,000 VX a month","No daily limit on the assistant"]'::jsonb
WHERE id = 'business';

-- Kids keeps its id, its price and its position. Only the wording changes, for
-- the same reason: VX is not called credits where anyone can read it.
UPDATE public.billing_plans SET
  features = '["VisionKids in full","Educational games and activities","Academy for children","Age-appropriate assistant","News and community","50 assistant requests a day"]'::jsonb
WHERE id = 'kids';

-- The free week is unchanged in substance; its blurb said "credits" too.
UPDATE public.billing_plans SET
  features = '["Every section open for seven days","The assistant on WhatsApp and on the site","200 assistant requests a day","No card required"]'::jsonb
WHERE id = 'free_trial';

COMMENT ON TABLE public.billing_plans IS
  'The plan catalogue: free_trial (the seven-day week), basic, pro, business (the nested tiers) and kids (beside them). FREE is not a row — it is the section set an account keeps with no subscription, defined in src/lib/billing/plans.ts.';
