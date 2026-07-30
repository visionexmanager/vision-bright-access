-- ============================================================
-- Migration: VisionKids Economy (Phase 17) — RPCs.
--
-- Safety rules enforced here:
--   * subscribe_kids_plan: if the subscriber has a guardian and the plan costs
--     money, the subscription is created as 'pending_parent' — a child can
--     never self-activate a paid plan. Only a linked guardian can approve it.
--   * Redeems, gifts (coins), and donations move only VX (spend_vx); no money.
--   * All mutations are SECURITY DEFINER, re-check the actor, and are audited.
--   No real payment provider is called — `provider` stays 'none' until a gateway
--   is wired in later.
-- ============================================================

CREATE OR REPLACE FUNCTION public.kids_coin_balance(_uid UUID)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(points), 0) FROM public.user_points WHERE user_id = _uid;
$$;

-- ── Subscribe ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.subscribe_kids_plan(_plan_slug TEXT, _org_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _plan public.kids_subscription_plans%ROWTYPE;
  _has_guardian BOOLEAN;
  _status TEXT;
  _id UUID;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  SELECT * INTO _plan FROM public.kids_subscription_plans WHERE slug = _plan_slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;

  IF _org_id IS NOT NULL THEN
    IF NOT public.is_kids_org_admin(_org_id, _uid) THEN RAISE EXCEPTION 'Org admins only'; END IF;
    _status := 'active';
    INSERT INTO public.kids_subscriptions (org_id, plan_slug, status, started_at, renews_at)
    VALUES (_org_id, _plan_slug, _status, now(), now() + interval '1 year')
    RETURNING id INTO _id;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.kids_economy_guardians WHERE child_id = _uid) INTO _has_guardian;
    -- A child (has a guardian) needs parent approval for a PAID plan.
    _status := CASE WHEN _plan.price_usd > 0 AND _has_guardian THEN 'pending_parent' ELSE 'active' END;
    INSERT INTO public.kids_subscriptions (user_id, plan_slug, status, started_at, renews_at)
    VALUES (_uid, _plan_slug, _status, now(), now() + interval '1 month')
    RETURNING id INTO _id;

    IF _status = 'active' AND _plan.price_usd > 0 THEN
      INSERT INTO public.kids_invoices (subscription_id, user_id, amount_usd, status)
      VALUES (_id, _uid, _plan.price_usd, 'issued');
    END IF;
  END IF;

  INSERT INTO public.kids_economy_audit (actor_id, action, detail)
  VALUES (_uid, 'subscribe', jsonb_build_object('plan', _plan_slug, 'status', _status));
  RETURN jsonb_build_object('id', _id, 'status', _status);
END;
$$;
GRANT EXECUTE ON FUNCTION public.subscribe_kids_plan(TEXT, UUID) TO authenticated;

-- ── Guardian approves a child's pending subscription ─────────────────────────
CREATE OR REPLACE FUNCTION public.approve_kids_subscription(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _sub public.kids_subscriptions%ROWTYPE; _plan public.kids_subscription_plans%ROWTYPE;
BEGIN
  SELECT * INTO _sub FROM public.kids_subscriptions WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  IF NOT public.is_kids_guardian_of(auth.uid(), _sub.user_id) THEN RAISE EXCEPTION 'Only a guardian can approve'; END IF;
  IF _sub.status <> 'pending_parent' THEN RAISE EXCEPTION 'Not pending approval'; END IF;

  UPDATE public.kids_subscriptions SET status = 'active', approved_by = auth.uid() WHERE id = _id;
  SELECT * INTO _plan FROM public.kids_subscription_plans WHERE slug = _sub.plan_slug;
  IF _plan.price_usd > 0 THEN
    INSERT INTO public.kids_invoices (subscription_id, user_id, amount_usd, status)
    VALUES (_id, _sub.user_id, _plan.price_usd, 'issued');
  END IF;
  INSERT INTO public.kids_economy_audit (actor_id, action, detail)
  VALUES (auth.uid(), 'approve_subscription', jsonb_build_object('id', _id, 'child', _sub.user_id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_kids_subscription(UUID) TO authenticated;

-- ── Cancel ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_kids_subscription(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _sub public.kids_subscriptions%ROWTYPE;
BEGIN
  SELECT * INTO _sub FROM public.kids_subscriptions WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  IF NOT (auth.uid() = _sub.user_id OR public.is_kids_guardian_of(auth.uid(), _sub.user_id)
          OR (_sub.org_id IS NOT NULL AND public.is_kids_org_admin(_sub.org_id, auth.uid()))) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.kids_subscriptions SET status = 'cancelled', cancelled_at = now() WHERE id = _id;
  INSERT INTO public.kids_economy_audit (actor_id, action, detail) VALUES (auth.uid(), 'cancel_subscription', jsonb_build_object('id', _id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.cancel_kids_subscription(UUID) TO authenticated;

-- ── Redeem a reward (spend VX) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.redeem_kids_reward(_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid UUID := auth.uid(); _r public.kids_redeemables%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  SELECT * INTO _r FROM public.kids_redeemables WHERE slug = _slug AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.kids_redemptions WHERE user_id = _uid AND redeemable_slug = _slug) THEN
    RAISE EXCEPTION 'Already redeemed';
  END IF;

  PERFORM public.spend_vx(_r.cost_coins, 'kids_redeem', _r.slug, _r.name);
  INSERT INTO public.kids_redemptions (user_id, redeemable_slug) VALUES (_uid, _slug);
  INSERT INTO public.kids_economy_audit (actor_id, action, detail) VALUES (_uid, 'redeem', jsonb_build_object('reward', _slug, 'cost', _r.cost_coins));
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_kids_reward(TEXT) TO authenticated;

-- ── Gifts ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_kids_gift(_to_id UUID, _kind TEXT, _ref_slug TEXT, _amount INTEGER, _message TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id UUID; _amt INTEGER := GREATEST(0, COALESCE(_amount, 0));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _kind NOT IN ('subscription','coins','book','course','certificate','bundle') THEN RAISE EXCEPTION 'Invalid gift kind'; END IF;
  IF _to_id = auth.uid() THEN RAISE EXCEPTION 'Cannot gift yourself'; END IF;

  -- Coin gifts are pre-paid by the giver (escrow) and credited on claim.
  IF _kind = 'coins' THEN
    IF _amt <= 0 THEN RAISE EXCEPTION 'Amount required'; END IF;
    PERFORM public.spend_vx(_amt, 'kids_gift', _to_id::text, 'Gift of coins');
  END IF;

  INSERT INTO public.kids_gifts (from_id, to_id, kind, ref_slug, amount, message)
  VALUES (auth.uid(), _to_id, _kind, _ref_slug, _amt, _message)
  RETURNING id INTO _id;
  INSERT INTO public.kids_economy_audit (actor_id, action, detail) VALUES (auth.uid(), 'create_gift', jsonb_build_object('id', _id, 'kind', _kind));
  RETURN _id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_kids_gift(UUID, TEXT, TEXT, INTEGER, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_kids_gift(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _g public.kids_gifts%ROWTYPE;
BEGIN
  SELECT * INTO _g FROM public.kids_gifts WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;
  IF _g.to_id <> auth.uid() THEN RAISE EXCEPTION 'This gift is not yours'; END IF;
  IF _g.status <> 'pending' THEN RAISE EXCEPTION 'Already handled'; END IF;

  IF _g.kind = 'coins' THEN
    INSERT INTO public.user_points (user_id, points, reason) VALUES (_g.to_id, _g.amount, 'Gift received: coins');
  ELSIF _g.kind = 'subscription' AND _g.ref_slug IS NOT NULL THEN
    INSERT INTO public.kids_subscriptions (user_id, plan_slug, status, approved_by, started_at, renews_at)
    VALUES (_g.to_id, _g.ref_slug, 'active', _g.from_id, now(), now() + interval '1 month');
  END IF;

  UPDATE public.kids_gifts SET status = 'claimed', claimed_at = now() WHERE id = _id;
  INSERT INTO public.kids_economy_audit (actor_id, action, detail) VALUES (auth.uid(), 'claim_gift', jsonb_build_object('id', _id));
END;
$$;
GRANT EXECUTE ON FUNCTION public.claim_kids_gift(UUID) TO authenticated;

-- ── Donate (spend VX to a cause) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.donate_kids(_cause TEXT, _amount INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _amt INTEGER := GREATEST(0, COALESCE(_amount, 0));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF _cause NOT IN ('free_content','support_schools','children_in_need') THEN RAISE EXCEPTION 'Invalid cause'; END IF;
  IF _amt <= 0 THEN RAISE EXCEPTION 'Amount required'; END IF;

  PERFORM public.spend_vx(_amt, 'kids_donation', _cause, 'Donation');
  INSERT INTO public.kids_donations (donor_id, cause, amount_coins) VALUES (auth.uid(), _cause, _amt);
  INSERT INTO public.kids_economy_audit (actor_id, action, detail) VALUES (auth.uid(), 'donate', jsonb_build_object('cause', _cause, 'amount', _amt));
END;
$$;
GRANT EXECUTE ON FUNCTION public.donate_kids(TEXT, INTEGER) TO authenticated;

-- ── Summary for the wallet / economy home ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_kids_economy_summary()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _coins BIGINT := 0; _active_subs INTEGER := 0; _redemptions INTEGER := 0;
  _pending_gifts INTEGER := 0; _badges INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('coins',0,'active_subscriptions',0,'redemptions',0,'pending_gifts',0,'badges',0);
  END IF;
  SELECT public.kids_coin_balance(_uid) INTO _coins;
  SELECT count(*) INTO _active_subs FROM public.kids_subscriptions WHERE user_id = _uid AND status = 'active';
  SELECT count(*) INTO _redemptions FROM public.kids_redemptions WHERE user_id = _uid;
  SELECT count(*) INTO _pending_gifts FROM public.kids_gifts WHERE to_id = _uid AND status = 'pending';
  SELECT count(*) INTO _badges FROM public.kids_user_achievements WHERE user_id = _uid;
  RETURN jsonb_build_object('coins', _coins, 'active_subscriptions', _active_subs, 'redemptions', _redemptions, 'pending_gifts', _pending_gifts, 'badges', _badges);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_kids_economy_summary() TO authenticated, anon;

-- ── Financial reports (admin) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_kids_financial_reports()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _active INTEGER := 0; _pending INTEGER := 0; _cancelled INTEGER := 0;
  _revenue NUMERIC := 0; _donations BIGINT := 0; _creator_payouts BIGINT := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT count(*) FILTER (WHERE status = 'active'), count(*) FILTER (WHERE status = 'pending_parent'), count(*) FILTER (WHERE status = 'cancelled')
    INTO _active, _pending, _cancelled FROM public.kids_subscriptions;
  SELECT COALESCE(sum(amount_usd), 0) INTO _revenue FROM public.kids_invoices WHERE status IN ('issued','paid');
  SELECT COALESCE(sum(amount_coins), 0) INTO _donations FROM public.kids_donations;
  SELECT COALESCE(sum(amount_coins), 0) INTO _creator_payouts FROM public.kids_market_creator_earnings;
  RETURN jsonb_build_object(
    'active_subscriptions', _active,
    'pending_subscriptions', _pending,
    'cancelled_subscriptions', _cancelled,
    'revenue_usd', _revenue,
    'donations_coins', _donations,
    'creator_payouts_coins', _creator_payouts
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_kids_financial_reports() TO authenticated;
