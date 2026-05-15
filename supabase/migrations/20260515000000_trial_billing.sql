-- ──────────────────────────────────────────────────────────────────────────
-- Trial billing: track warning & processing state
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_billing_warned_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_billing_processed_at TIMESTAMPTZ;

-- ──────────────────────────────────────────────────────────────────────────
-- system_deduct_vx: service-role-level deduction (used by edge function)
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.system_deduct_vx(
  _user_id  UUID,
  _amount   INTEGER,
  _reason   TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance BIGINT;
BEGIN
  IF _amount <= 0 THEN RETURN FALSE; END IF;

  SELECT COALESCE(SUM(points), 0) INTO _balance
  FROM public.user_points
  WHERE user_id = _user_id;

  IF _balance < _amount THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.user_points (user_id, points, reason)
  VALUES (_user_id, -_amount, _reason);

  INSERT INTO public.vx_purchases (user_id, amount, item_type, item_name)
  VALUES (_user_id, _amount, 'trial_billing', _reason);

  RETURN TRUE;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- system_insert_notification: service-role notification insert
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.system_insert_notification(
  _user_id UUID,
  _title   TEXT,
  _body    TEXT,
  _type    TEXT DEFAULT 'info'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (_user_id, _title, _body, _type);
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Add 'billing' to allowed send-email senders (handled in edge function)
-- Nothing to migrate for that — it's code-side only
-- ──────────────────────────────────────────────────────────────────────────
