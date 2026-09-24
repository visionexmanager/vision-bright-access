-- Fix: a gift can be claimed once, even when the claims arrive together.
--
-- claim_kids_gift (20260823010000) read the gift without a lock and marked it
-- claimed with an UPDATE that did not re-check its status. Several claims sent
-- at the same moment all read 'pending', and each one credited the gift's
-- coins to user_points — one paid gift of VX paid out as many times as the
-- recipient could fire the request in parallel.
--
-- The body below is the original, with three changes: the row is read FOR
-- UPDATE (a second claim waits, then sees 'claimed'), a signed-out caller is
-- refused explicitly, and the final UPDATE is conditional on 'pending' as a
-- belt to the lock's braces. CREATE OR REPLACE keeps the existing grant to
-- authenticated.

CREATE OR REPLACE FUNCTION public.claim_kids_gift(_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _g public.kids_gifts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;

  SELECT * INTO _g FROM public.kids_gifts WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Gift not found'; END IF;
  IF _g.to_id <> auth.uid() THEN RAISE EXCEPTION 'This gift is not yours'; END IF;
  IF _g.status <> 'pending' THEN RAISE EXCEPTION 'Already handled'; END IF;

  UPDATE public.kids_gifts SET status = 'claimed', claimed_at = now()
   WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Already handled'; END IF;

  IF _g.kind = 'coins' THEN
    INSERT INTO public.user_points (user_id, points, reason) VALUES (_g.to_id, _g.amount, 'Gift received: coins');
  ELSIF _g.kind = 'subscription' AND _g.ref_slug IS NOT NULL THEN
    INSERT INTO public.kids_subscriptions (user_id, plan_slug, status, approved_by, started_at, renews_at)
    VALUES (_g.to_id, _g.ref_slug, 'active', _g.from_id, now(), now() + interval '1 month');
  END IF;

  INSERT INTO public.kids_economy_audit (actor_id, action, detail) VALUES (auth.uid(), 'claim_gift', jsonb_build_object('id', _id));
END;
$$;
