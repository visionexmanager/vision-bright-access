-- The owner confirms or declines a subscription order from WhatsApp.
--
-- The admin page calls approve_subscription_order / reject_subscription_order,
-- which check has_role(auth.uid(), 'admin') and write auth.uid() as the
-- reviewer. The WhatsApp webhook runs as service_role, which has no auth.uid(),
-- so it cannot call them. This wrapper does not copy their rules (plan price,
-- credit grant, renewal arithmetic, notification): it names the admin the owner
-- acts as, makes auth.uid() answer with that admin for this one transaction, and
-- calls the very same two functions. There is still exactly one place that
-- decides what an approval does.
--
-- Callable by service_role only. The webhook has already established that the
-- sender is the configured owner number; nothing a signed-in user can reach
-- gets near this.

CREATE OR REPLACE FUNCTION public.owner_review_subscription_order(
  _reference text,
  _approve boolean,
  _actor_id uuid,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order public.subscription_orders;
  _plan_name text;
  _note_text text := left(coalesce(nullif(btrim(_note), ''), 'via WhatsApp'), 900);
BEGIN
  IF _actor_id IS NULL OR NOT public.has_role(_actor_id, 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_admin');
  END IF;

  SELECT * INTO _order FROM public.subscription_orders
   WHERE reference_code = upper(btrim(_reference));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF _order.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed', 'status', _order.status);
  END IF;

  -- auth.uid() reads these two settings. Transaction-local (true), so the
  -- identity ends with this call and never leaks to the next statement or pool user.
  PERFORM set_config('request.jwt.claim.sub', _actor_id::text, true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', _actor_id::text, 'role', 'authenticated')::text, true);

  IF _approve THEN
    PERFORM public.approve_subscription_order(_order.id, _note_text);
  ELSE
    PERFORM public.reject_subscription_order(_order.id, _note_text);
  END IF;

  SELECT name INTO _plan_name FROM public.billing_plans WHERE id = _order.plan_id;
  RETURN jsonb_build_object(
    'ok', true,
    'reference', _order.reference_code,
    'status', CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    'plan', coalesce(_plan_name, _order.plan_id),
    'months', _order.months
  );
END;
$$;

-- FROM PUBLIC also takes service_role's implicit access away, so it is granted back by name.
REVOKE ALL ON FUNCTION public.owner_review_subscription_order(text, boolean, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_review_subscription_order(text, boolean, uuid, text) TO service_role;

COMMENT ON FUNCTION public.owner_review_subscription_order(text, boolean, uuid, text) IS
  'Approve or reject a pending subscription order on behalf of the named admin (the owner, via WhatsApp). service_role only; delegates to approve_/reject_subscription_order.';
