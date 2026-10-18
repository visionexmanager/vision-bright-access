-- Library Stripe webhook: make a redelivered checkout.session.completed event harmless.
--
-- Stripe delivers events at least once. library-stripe-webhook inserted a donation,
-- a rental and a licence on every delivery, so a redelivery (or a retry after a
-- partial failure) counted a donation twice and granted a second rental/licence.
-- Each insert now carries the identity of the checkout it came from, and a unique
-- index lets the function skip the duplicate. Purely additive: new nullable columns
-- and indexes; existing rows keep NULL and are unaffected (NULLs never collide).
--
-- The licence index is created only if no purchase already has two licences, so a
-- pre-existing duplicate cannot make this migration fail the deploy; in that case
-- it is skipped with a notice and needs a manual clean-up first.

ALTER TABLE public.library_donations
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS library_donations_checkout_session_uniq
  ON public.library_donations (stripe_checkout_session_id);

ALTER TABLE public.library_borrowed_books
  ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES public.library_purchases(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS library_borrowed_books_purchase_uniq
  ON public.library_borrowed_books (purchase_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.library_licenses
    WHERE purchase_id IS NOT NULL
    GROUP BY purchase_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'library_licenses has duplicate purchase_id rows; unique index skipped, clean up and re-run';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS library_licenses_purchase_uniq
      ON public.library_licenses (purchase_id);
  END IF;
END $$;
