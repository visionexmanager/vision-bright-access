-- ============================================================================
-- VISIONEX FLIGHTS — the supplier-neutral core
-- ============================================================================
--
-- The sibling of `20261009000000_mobility_core.sql`, deliberately the same
-- shape: a supplier registry that starts switched off, a normalized booking, an
-- append-only event log, offers that expire, and webhook deduplication.
--
-- ── The one table that is not like the others ───────────────────────────────
--
-- `flight_passengers`. A ticket needs a name exactly as it appears in a travel
-- document, a date of birth, and for some itineraries a passport number and
-- nationality. That is the most sensitive data this repository holds.
--
-- It gets the treatment `mobility_user_connections` gets and for a stronger
-- reason: **RLS on, no policy, service-role only.** A traveller is not given a
-- "read your own passengers" policy, because a browser that can read it is a
-- browser that can leak it, and the only thing that ever needs these columns is
-- the server call that hands them to a supplier.
--
-- What a traveller may see about their own booking — where they are going, when
-- and for how much — is in `flight_bookings`, which they can read. Who is
-- flying is deliberately not joined into it.
--
-- Additive and re-runnable throughout.

-- ── 1. The supplier registry ────────────────────────────────────────────────
--
-- Air is not a taxi: nobody sells a ticket without accreditation or a
-- consolidator who holds it. `accreditation_required` defaults TRUE and
-- `integration_status` starts at `not_researched`, which is the honest value
-- rather than a flattering one.

CREATE TABLE IF NOT EXISTS public.flight_suppliers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                    text UNIQUE NOT NULL,
  name                    text NOT NULL,
  kind                    text NOT NULL DEFAULT 'aggregator'
    CHECK (kind IN ('aggregator', 'gds', 'airline_direct', 'consolidator', 'metasearch')),

  integration_status      text NOT NULL DEFAULT 'not_researched'
    CHECK (integration_status IN (
      'not_researched', 'researched', 'public_api', 'partner_api', 'oauth',
      'manual_partner_required', 'unavailable', 'deprecated'
    )),

  search_supported        boolean NOT NULL DEFAULT FALSE,
  booking_supported       boolean NOT NULL DEFAULT FALSE,
  ticketing_supported     boolean NOT NULL DEFAULT FALSE,
  cancellation_supported  boolean NOT NULL DEFAULT FALSE,
  seat_selection_supported boolean NOT NULL DEFAULT FALSE,
  hold_supported          boolean NOT NULL DEFAULT FALSE,
  sandbox_available       boolean NOT NULL DEFAULT FALSE,
  production_available    boolean NOT NULL DEFAULT FALSE,

  -- Who is allowed to issue the ticket, which is the question that decides
  -- whether any of the above may be switched on.
  accreditation_required  boolean NOT NULL DEFAULT TRUE,
  settlement_model        text,

  countries               text[] NOT NULL DEFAULT '{}',
  currencies              text[] NOT NULL DEFAULT '{}',
  cabins                  text[] NOT NULL DEFAULT '{}',

  enabled                 boolean NOT NULL DEFAULT FALSE,
  documentation_url       text,
  approval_notes          text,
  last_verified_at        timestamptz,

  sort_order              integer NOT NULL DEFAULT 0,
  created_at              timestamptz NOT NULL DEFAULT NOW(),
  updated_at              timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.flight_suppliers.accreditation_required IS
  'Whether issuing a ticket through this supplier needs IATA accreditation or a consolidator. TRUE until proven otherwise.';
COMMENT ON COLUMN public.flight_suppliers.enabled IS
  'The feature flag. FALSE until credentials, accreditation and sandbox testing are all real.';

CREATE INDEX IF NOT EXISTS flight_suppliers_enabled_idx
  ON public.flight_suppliers (enabled, sort_order)
  WHERE enabled = TRUE;

-- ── 2. Searches and the offers they produced ────────────────────────────────
--
-- An offer is a price with a deadline. `expires_at` is NOT NULL because an air
-- fare is the shortest-lived price in this system, and one without an expiry is
-- a figure nobody can be held to.

CREATE TABLE IF NOT EXISTS public.flight_searches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin          text NOT NULL,
  destination     text NOT NULL,
  depart_date     date NOT NULL,
  return_date     date,
  adults          integer NOT NULL DEFAULT 1 CHECK (adults BETWEEN 1 AND 9),
  children        integer NOT NULL DEFAULT 0 CHECK (children BETWEEN 0 AND 9),
  infants         integer NOT NULL DEFAULT 0 CHECK (infants BETWEEN 0 AND 9),
  cabin           text NOT NULL DEFAULT 'economy'
    CHECK (cabin IN ('economy', 'premium_economy', 'business', 'first')),
  source          text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp', 'voice', 'api')),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flight_searches_user_idx
  ON public.flight_searches (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.flight_offers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id         uuid NOT NULL REFERENCES public.flight_searches(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_slug     text NOT NULL,
  supplier_offer_id text NOT NULL,

  -- The itinerary as the supplier described it: slices, segments, local times
  -- and their zones. Stored whole because a duration recomputed from a
  -- flattened copy is a duration that can disagree with the ticket.
  slices            jsonb NOT NULL,

  total_amount      integer NOT NULL,
  total_currency    text NOT NULL,
  cabin             text NOT NULL,
  fare_brand        text,
  checked_bags      integer,
  refundable        boolean,
  changeable        boolean,
  seats_remaining   integer,

  expires_at        timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS flight_offers_search_idx
  ON public.flight_offers (search_id, total_amount);

CREATE INDEX IF NOT EXISTS flight_offers_expiry_idx
  ON public.flight_offers (expires_at);

-- ── 3. Bookings ─────────────────────────────────────────────────────────────
--
-- What a traveller may read about their own trip. Deliberately carries no
-- passenger identity beyond a count: who is flying lives in the table below,
-- which no browser can reach.

CREATE TABLE IF NOT EXISTS public.flight_bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_slug       text NOT NULL,
  supplier_order_id   text,
  /** The airline's own reference — what a traveller quotes at a desk. */
  record_locator      text,

  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'searching', 'offered', 'awaiting_confirmation', 'pricing',
      'held', 'payment_pending', 'ticketing', 'ticketed', 'cancelled',
      'supplier_cancelled', 'payment_failed', 'ticketing_failed', 'expired'
    )),

  slices              jsonb NOT NULL,
  cabin               text NOT NULL,
  passenger_count     integer NOT NULL DEFAULT 1 CHECK (passenger_count BETWEEN 1 AND 9),

  -- What was agreed, and what was charged. Both, because the gap between them
  -- is the thing a traveller would dispute — and a re-price that moved must be
  -- visible rather than absorbed.
  agreed_amount       integer,
  agreed_currency     text,
  charged_amount      integer,
  charged_currency    text,

  payment_status      text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'authorized', 'paid', 'refunded', 'failed')),
  /** When the supplier will release an unpaid hold. */
  ticketing_deadline  timestamptz,
  refundable          boolean,
  changeable          boolean,

  source              text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp', 'voice', 'api')),
  idempotency_key     text,

  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.flight_bookings IS
  'Readable by the traveller. Carries no passenger identity — who is flying is in flight_passengers, which is service-role only.';
COMMENT ON COLUMN public.flight_bookings.idempotency_key IS
  'Set before a supplier is called. A retry carrying the same key must resolve to this row rather than issue a second ticket.';

CREATE UNIQUE INDEX IF NOT EXISTS flight_bookings_idempotency_idx
  ON public.flight_bookings (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS flight_bookings_user_recent_idx
  ON public.flight_bookings (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS flight_bookings_supplier_order_idx
  ON public.flight_bookings (supplier_slug, supplier_order_id)
  WHERE supplier_order_id IS NOT NULL;

-- ── 4. Who is flying, which nobody may read ─────────────────────────────────
--
-- RLS on, **no policy**. Service-role only, by construction.
--
-- Do not add a "travellers read their own passengers" policy to make something
-- work. A passport number is not a value a browser needs; the one thing that
-- needs these columns is the server call that hands them to a supplier, and
-- that call holds the service role already.
--
-- The columns are the whole list a ticket needs and nothing beyond it. The
-- cheapest way to keep passport data safe is not to hold it.

CREATE TABLE IF NOT EXISTS public.flight_passengers (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             uuid NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
  passenger_type         text NOT NULL DEFAULT 'adult'
    CHECK (passenger_type IN ('adult', 'child', 'infant')),
  given_name             text NOT NULL,
  family_name            text NOT NULL,
  date_of_birth          date NOT NULL,
  gender                 text,
  document_number        text,
  document_expiry        date,
  document_nationality   text,
  created_at             timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.flight_passengers IS
  'Service-role only by construction: RLS on, no policy. Travel-document data is never a user-readable value.';

CREATE INDEX IF NOT EXISTS flight_passengers_booking_idx
  ON public.flight_passengers (booking_id);

-- ── 5. What happened to a booking ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flight_booking_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id       uuid NOT NULL REFERENCES public.flight_bookings(id) ON DELETE CASCADE,
  status           text NOT NULL,
  supplier_status  text,
  detail           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.flight_booking_events.detail IS
  'Never a passenger name, a document number or a supplier error body. Outcomes and identifiers only.';

CREATE INDEX IF NOT EXISTS flight_booking_events_booking_idx
  ON public.flight_booking_events (booking_id, created_at DESC);

-- ── 6. Supplier webhooks ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flight_webhook_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_slug      text NOT NULL,
  supplier_event_id  text NOT NULL,
  event_type         text,
  booking_id         uuid REFERENCES public.flight_bookings(id) ON DELETE SET NULL,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_slug, supplier_event_id)
);

CREATE INDEX IF NOT EXISTS flight_webhook_events_unprocessed_idx
  ON public.flight_webhook_events (created_at)
  WHERE processed_at IS NULL;

-- ── 7. Row-level security ───────────────────────────────────────────────────
--
-- On for every table. A traveller reads their own searches, offers and
-- bookings, and writes none of them: a status is the supplier's word, and a
-- client that could set it could mark an unpaid booking ticketed.

ALTER TABLE public.flight_suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_searches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_offers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_passengers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_booking_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flight_webhook_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flight_searches_own_read ON public.flight_searches;
CREATE POLICY flight_searches_own_read
  ON public.flight_searches FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS flight_offers_own_read ON public.flight_offers;
CREATE POLICY flight_offers_own_read
  ON public.flight_offers FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS flight_bookings_own_read ON public.flight_bookings;
CREATE POLICY flight_bookings_own_read
  ON public.flight_bookings FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS flight_booking_events_own_read ON public.flight_booking_events;
CREATE POLICY flight_booking_events_own_read
  ON public.flight_booking_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.flight_bookings b
    WHERE b.id = flight_booking_events.booking_id
      AND b.user_id = (SELECT auth.uid())
  ));

-- `flight_passengers`, `flight_suppliers` and `flight_webhook_events` get no
-- policy. That is the design, not an omission.

-- ── 8. What a client may know about suppliers ───────────────────────────────

CREATE OR REPLACE VIEW public.flight_suppliers_public AS
  SELECT
    slug, name, kind, integration_status,
    search_supported, booking_supported, ticketing_supported,
    cancellation_supported, seat_selection_supported, hold_supported,
    countries, currencies, cabins, sort_order
  FROM public.flight_suppliers
  WHERE enabled = TRUE;

GRANT SELECT ON public.flight_suppliers_public TO anon, authenticated;

-- ── 9. Keeping `updated_at` honest ──────────────────────────────────────────
--
-- `mobility_touch_updated_at` already does exactly this and is already
-- deployed. Reused rather than copied: two triggers that set the same column
-- the same way is one of them going stale.

DROP TRIGGER IF EXISTS flight_suppliers_touch ON public.flight_suppliers;
CREATE TRIGGER flight_suppliers_touch
  BEFORE UPDATE ON public.flight_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

DROP TRIGGER IF EXISTS flight_bookings_touch ON public.flight_bookings;
CREATE TRIGGER flight_bookings_touch
  BEFORE UPDATE ON public.flight_bookings
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

-- ── 10. The registry's first rows ───────────────────────────────────────────
--
-- Every one disabled, every one `not_researched`. `enabled` is not named in the
-- column list, so a thirteenth supplier added here cannot arrive switched on by
-- a typo.
--
-- None of these rows claims an API. Reading each supplier's current official
-- documentation is the work that moves a row off `not_researched`, and it could
-- not be done from the environment that wrote this file — the egress proxy
-- blocks their documentation domains. docs/flights/providers.md records that.

INSERT INTO public.flight_suppliers (slug, name, kind, integration_status, accreditation_required, sort_order)
VALUES
  ('duffel',     'Duffel',     'aggregator',     'not_researched', TRUE, 10),
  ('amadeus',    'Amadeus',    'gds',            'not_researched', TRUE, 20),
  ('sabre',      'Sabre',      'gds',            'not_researched', TRUE, 30),
  ('travelport', 'Travelport', 'gds',            'not_researched', TRUE, 40),
  ('kiwi',       'Kiwi.com',   'aggregator',     'not_researched', TRUE, 50),
  ('travelfusion','Travelfusion','aggregator',   'not_researched', TRUE, 60)
ON CONFLICT (slug) DO NOTHING;
