-- Fix: a paid Service Center request is charged and filed in one transaction,
-- and the admin can tell a paid request from an unpaid one.
--
-- ── The defect ──────────────────────────────────────────────────────────────
--
-- ServiceRequestPage.tsx made two browser calls: spend_vx, then an INSERT into
-- service_requests. Two failures followed from that:
--
--   * If the insert failed after the charge, the VX was gone and no request
--     existed. Nothing refunded it.
--   * The INSERT policy lets a signed-in user file their own request directly,
--     so the spend_vx call could simply be skipped. The row that arrived looked
--     identical to a paid one — service_requests recorded nothing about payment.
--
-- ── The fix ─────────────────────────────────────────────────────────────────
--
-- 1. service_requests records what was paid: vx_paid and paid_via.
-- 2. submit_paid_service_request() charges through the existing spend_vx and
--    inserts the request in the same transaction: both happen or neither does.
--    A trial account is decided here, from profiles.trial_expires_at, the same
--    rule plan_for_user() uses — not by the browser.
-- 3. The browser's own INSERT policy keeps working for the free desks (Travel,
--    which files requests without a charge) but may no longer set either
--    payment column, so an unpaid row can never pass for a paid one.
--
-- 4. The price is the server's: service_package_prices mirrors each page's
--    packages (a test pins the two together). The page's figure is only
--    compared, so nobody can buy a package for 1 VX, and nobody is charged
--    anything but the price they were shown.
-- 5. A trial files one free request per service, not an unlimited queue.

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS vx_paid  integer,
  ADD COLUMN IF NOT EXISTS paid_via text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'service_requests_payment_shape'
       AND conrelid = 'public.service_requests'::regclass
  ) THEN
    ALTER TABLE public.service_requests
      ADD CONSTRAINT service_requests_payment_shape CHECK (
        (paid_via IS NULL     AND vx_paid IS NULL)
     OR (paid_via = 'vx'      AND vx_paid > 0)
     OR (paid_via = 'trial'   AND vx_paid = 0)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.service_requests.vx_paid IS
  'VX charged for this request by submit_paid_service_request(); 0 on a trial; NULL when nothing was charged (free desks, contact form, or a direct insert).';
COMMENT ON COLUMN public.service_requests.paid_via IS
  'vx | trial | NULL. Only submit_paid_service_request() can set it; the browser INSERT policy requires NULL.';

-- The browser's direct insert: unchanged, except that it cannot claim payment.
DROP POLICY IF EXISTS "service_requests: signed-in users file their own" ON public.service_requests;
CREATE POLICY "service_requests: signed-in users file their own"
  ON public.service_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND status = 'pending'
    AND vx_paid IS NULL
    AND paid_via IS NULL
  );

-- ── Package prices, on the server ──────────────────────────────────────────
--
-- Mirrors the `packages` array of each Service Center page that renders
-- ServiceRequestPage. src/test/service-request-atomic-charge.test.ts reads both
-- sides and fails when they drift, so a price changed on a page must be
-- changed here in the same pull request.
--
-- RLS on and no policy: only submit_paid_service_request() reads it.
CREATE TABLE IF NOT EXISTS public.service_package_prices (
  service_type text    NOT NULL,
  package_name text    NOT NULL,
  vx           integer NOT NULL CHECK (vx > 0),
  PRIMARY KEY (service_type, package_name)
);
ALTER TABLE public.service_package_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.service_package_prices FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.service_package_prices TO service_role;

INSERT INTO public.service_package_prices (service_type, package_name, vx) VALUES
  ('Digital Marketing', 'Starter Campaign', 120000),
  ('Digital Marketing', 'Growth Package', 280000),
  ('Digital Marketing', 'Full Strategy', 550000),
  ('Educational Empire', 'Foundation Plan', 200000),
  ('Educational Empire', 'Growth Empire', 600000),
  ('Educational Empire', 'Global Empire', 1500000),
  ('Global Studio', 'Content Starter', 80000),
  ('Global Studio', 'Studio Growth', 220000),
  ('Global Studio', 'Full Production', 500000),
  ('Hair Care', 'Hair Consultation', 40000),
  ('Hair Care', 'Treatment Package', 150000),
  ('Hair Care', 'Hair Transformation', 350000),
  ('Import & Purchasing', 'Sourcing Consultation', 80000),
  ('Import & Purchasing', 'Import Assistance', 320000),
  ('Import & Purchasing', 'Full Supply Chain', 750000),
  ('Legal Advisor', 'Legal Consultation', 80000),
  ('Legal Advisor', 'Document Review', 220000),
  ('Legal Advisor', 'Full Legal Support', 600000),
  ('Medical Support', 'Health Assessment', 60000),
  ('Medical Support', 'Specialist Consultation', 160000),
  ('Medical Support', 'Comprehensive Health Plan', 400000),
  ('Music Conservatory', 'Beginner Course', 60000),
  ('Music Conservatory', 'Intermediate Programme', 140000),
  ('Music Conservatory', 'Pro Production & Performance', 300000),
  ('Psychology', 'First Session', 60000),
  ('Psychology', '4-Session Package', 200000),
  ('Psychology', 'Monthly Therapy Plan', 500000),
  ('Skin Care', 'Skin Analysis', 40000),
  ('Skin Care', 'Glow Treatment', 160000),
  ('Skin Care', 'Premium Skin Programme', 350000),
  ('Social Guide', 'Social Consultation', 50000),
  ('Social Guide', 'Life Navigation Package', 180000),
  ('Social Guide', 'Full Life Transformation', 450000),
  ('Sports Coach', 'Fitness Assessment', 40000),
  ('Sports Coach', 'Monthly Training Programme', 120000),
  ('Sports Coach', 'Elite Performance', 300000),
  ('Tech Consulting', 'Strategy Session', 60000),
  ('Tech Consulting', 'Technical Audit', 200000),
  ('Tech Consulting', 'Architecture Plan', 420000),
  ('Professional Training', 'Online Workshop', 100000),
  ('Professional Training', 'Corporate Training', 380000),
  ('Professional Training', 'Custom Program', 650000),
  ('Travel Agency', 'Trip Planning', 80000),
  ('Travel Agency', 'Full Travel Package', 300000),
  ('Travel Agency', 'Concierge Travel', 700000),
  ('Web Design', 'Landing Page', 150000),
  ('Web Design', 'Business Website', 500000),
  ('Web Design', 'E-Commerce Store', 900000)
ON CONFLICT (service_type, package_name) DO UPDATE SET vx = EXCLUDED.vx;

CREATE OR REPLACE FUNCTION public.submit_paid_service_request(
  _service_type text,
  _package_name text,
  _vx           integer,
  _full_name    text,
  _email        text,
  _phone        text,
  _message      text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id  uuid := auth.uid();
  _price    integer;
  _expires  timestamptz;
  _on_trial boolean;
  _label    text;
  _id       uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF coalesce(btrim(_full_name), '') = '' OR coalesce(btrim(_email), '') = ''
     OR coalesce(btrim(_message), '') = '' THEN
    RAISE EXCEPTION 'Missing required fields';
  END IF;
  IF length(_full_name) > 200 OR length(_email) > 320
     OR length(coalesce(_phone, '')) > 50 OR length(_message) > 5000 THEN
    RAISE EXCEPTION 'Field too long';
  END IF;

  -- The price is the server's, never the browser's. The page's figure is only
  -- compared, so a user is never charged anything but what they were shown.
  SELECT p.vx INTO _price
    FROM public.service_package_prices p
   WHERE p.service_type = _service_type AND p.package_name = _package_name;
  IF _price IS NULL THEN
    RAISE EXCEPTION 'Unknown package';
  END IF;
  IF _vx IS DISTINCT FROM _price THEN
    RAISE EXCEPTION 'Package price has changed; reload the page';
  END IF;

  _label := _service_type || ' — ' || _package_name;

  -- The same per-account lock every other wallet function takes, so this
  -- spend is serialised with vx_reserve, bazaar and file-studio spends.
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));

  SELECT p.trial_expires_at INTO _expires
    FROM public.profiles p WHERE p.user_id = _user_id;
  _on_trial := _expires IS NOT NULL AND _expires > now();

  IF _on_trial THEN
    -- A free week covers one request per service, not an unlimited queue of
    -- free human work.
    IF EXISTS (
      SELECT 1 FROM public.service_requests r
       WHERE r.user_id = _user_id AND r.paid_via = 'trial'
         AND left(r.service_type, length(_service_type) + 3) = _service_type || ' — '
    ) THEN
      RAISE EXCEPTION 'Your free week already includes a request for this service';
    END IF;
  ELSE
    -- Raises on an insufficient balance, which rolls back everything below.
    PERFORM public.spend_vx(_price, 'service', NULL, _label);
  END IF;

  INSERT INTO public.service_requests
    (user_id, full_name, email, phone, service_type, message, status, vx_paid, paid_via)
  VALUES
    (_user_id, btrim(_full_name), btrim(_email), nullif(btrim(coalesce(_phone, '')), ''),
     _label, _message, 'pending',
     CASE WHEN _on_trial THEN 0 ELSE _price END,
     CASE WHEN _on_trial THEN 'trial' ELSE 'vx' END)
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

COMMENT ON FUNCTION public.submit_paid_service_request(text, text, integer, text, text, text, text) IS
  'Charges a Service Center package at its server-side price through spend_vx and files its request in one transaction. Trial accounts (profiles.trial_expires_at in the future) file one request per service at 0 VX.';

-- The browser calls this on purpose; anon never needs it. Named per role,
-- because Supabase grants EXECUTE to anon directly and REVOKE FROM PUBLIC alone
-- would leave that grant standing.
REVOKE ALL ON FUNCTION public.submit_paid_service_request(text, text, integer, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_paid_service_request(text, text, integer, text, text, text, text) TO authenticated, service_role;
