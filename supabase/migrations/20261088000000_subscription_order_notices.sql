-- Who has been told about a subscription order.
--
-- owner_notified_at: the owner's WhatsApp has been sent the Approve / Reject
--   message for this order. buyer_notified_at: the buyer has been told how it
--   was decided. Both are claimed with a conditional UPDATE by the
--   subscription-order-notify function (service role), so a retry, a second tab
--   and the hourly sweep cannot tell anyone twice. NULL means "not yet", and a
--   delivery that failed everywhere is set back to NULL so the sweep retries it.
--
-- Nothing a signed-in user can reach writes these: subscription_orders has read
-- policies only, so RLS already refuses an UPDATE from the browser.

ALTER TABLE public.subscription_orders
  ADD COLUMN IF NOT EXISTS owner_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS buyer_notified_at timestamptz;

-- Orders that exist today were handled by hand. Marking them told keeps the
-- sweep from messaging people about decisions made before this existed.
UPDATE public.subscription_orders
   SET owner_notified_at = coalesce(owner_notified_at, now()),
       buyer_notified_at = CASE WHEN status = 'pending' THEN buyer_notified_at ELSE coalesce(buyer_notified_at, now()) END
 WHERE owner_notified_at IS NULL OR (status <> 'pending' AND buyer_notified_at IS NULL);

CREATE INDEX IF NOT EXISTS subscription_orders_unnotified_idx
  ON public.subscription_orders (created_at)
  WHERE owner_notified_at IS NULL OR buyer_notified_at IS NULL;
