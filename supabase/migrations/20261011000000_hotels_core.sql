-- ============================================================================
-- VISIONEX HOTELS — the supplier-neutral core
-- ============================================================================
--
-- The third of the booking siblings, after `20261009000000_mobility_core.sql`
-- and `20261010000000_flights_core.sql`, and deliberately the same shape: a
-- supplier registry that starts switched off, a normalized booking, an
-- append-only event log, offers that expire, and webhook deduplication.
--
-- ── What a hotel row knows that the others do not ───────────────────────────
--
-- **A night is a date.** `check_in` and `check_out` are `date`, not
-- `timestamptz`. A stay is three nights in every timezone on earth, and giving
-- a calendar page a moment is how a spring-forward turns three nights into two
-- days and twenty-three hours. The property's zone is stored beside them,
-- because every *time* on the stay — a check-in hour, a cancellation deadline —
-- is read in it and none of them are read in the guest's.
--
-- **A price has three parts.** `base_amount`, `taxes_prepaid_amount` and
-- `taxes_at_property_amount`, in minor units, in one currency. Collapsing them
-- loses the one that surprises people: the resort fee collected at the desk.
-- `hotel_offers.all_in_amount` is generated from all three so that no query can
-- accidentally order by the room rate and put the trap first.
--
-- ── The one table that is not like the others ───────────────────────────────
--
-- `hotel_guests`. **RLS on, no policy, service-role only** — the same treatment
-- `flight_passengers` and `mobility_user_connections` get, and for a reason
-- specific to this domain.
--
-- It is not a travel document: a hotel booking needs no passport and this
-- schema has no column for one. It is worse in a different way. A guest list
-- joined to a booking says who was in a named building on a named night. That
-- is location history about identifiable people, and the only thing that ever
-- needs it is the server call that hands a name to a supplier.
--
-- `hotel_bookings` — which the guest can read — carries the stay, the money and
-- the status. Who slept there is deliberately not joined into it.
--
-- Additive and re-runnable throughout.

-- ── 1. The supplier registry ────────────────────────────────────────────────
--
-- `integration_status` starts at `not_researched`, which is the honest value
-- rather than a flattering one, and `enabled` defaults FALSE.

CREATE TABLE IF NOT EXISTS public.hotel_suppliers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text UNIQUE NOT NULL,
  name                      text NOT NULL,
  kind                      text NOT NULL DEFAULT 'aggregator'
    CHECK (kind IN ('aggregator', 'bed_bank', 'gds', 'chain_direct', 'metasearch')),

  integration_status        text NOT NULL DEFAULT 'not_researched'
    CHECK (integration_status IN (
      'not_researched', 'documented', 'sandbox', 'certification', 'live'
    )),

  search_supported          boolean NOT NULL DEFAULT FALSE,
  booking_supported         boolean NOT NULL DEFAULT FALSE,
  cancellation_supported    boolean NOT NULL DEFAULT FALSE,
  modification_supported    boolean NOT NULL DEFAULT FALSE,
  -- Confirming the rate still exists at the moment of sale. A supplier without
  -- it cannot be trusted with a card: the rate it quoted may not be the rate it
  -- charges.
  reprice_supported         boolean NOT NULL DEFAULT FALSE,
  -- Whether the supplier reports what the desk will collect separately from
  -- what it takes now. One that does not cannot produce an honest all-in.
  fee_breakdown_supported   boolean NOT NULL DEFAULT FALSE,
  sandbox_available         boolean NOT NULL DEFAULT FALSE,

  -- A bed bank sells under a contract, not a signup.
  contract_required         boolean NOT NULL DEFAULT TRUE,
  settlement_model          text,

  countries                 text[] NOT NULL DEFAULT '{}',
  currencies                text[] NOT NULL DEFAULT '{}',

  -- Operational, so it changes without a deploy.
  enabled                   boolean NOT NULL DEFAULT FALSE,
  sort_order                integer NOT NULL DEFAULT 100,

  documentation_url         text,
  -- When a person last read that documentation. NULL means never, and NULL is
  -- what every row ships with.
  last_verified_at          timestamptz,
  notes                     text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ── 2. What somebody asked for ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hotel_searches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  destination       text NOT NULL,
  -- Dates, because nights are dates. See the header.
  check_in          date NOT NULL,
  check_out         date NOT NULL,
  CONSTRAINT hotel_searches_stay_is_positive CHECK (check_out > check_in),

  -- One row per room: {"adults": 2, "childAges": [4, 9]}. Children are ages and
  -- never a count — a property prices a four-year-old and an eleven-year-old
  -- differently and will sometimes not take one of them at all.
  rooms             jsonb NOT NULL DEFAULT '[]'::jsonb,
  board             text CHECK (board IN ('room_only', 'breakfast', 'half_board', 'full_board', 'all_inclusive')),
  free_cancellation_only boolean NOT NULL DEFAULT FALSE,
  min_star_rating   smallint CHECK (min_star_rating BETWEEN 1 AND 5),
  currency          text,

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotel_searches_user_idx
  ON public.hotel_searches (user_id, created_at DESC);

-- ── 3. What suppliers answered ──────────────────────────────────────────────
--
-- Offers are kept so that a guest can be told a rate lapsed rather than
-- watching it vanish, and so a disputed price has a record.

CREATE TABLE IF NOT EXISTS public.hotel_offers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id                 uuid REFERENCES public.hotel_searches(id) ON DELETE CASCADE,
  user_id                   uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  supplier_slug             text NOT NULL,
  supplier_offer_id         text NOT NULL,

  property_id               text NOT NULL,
  property_name             text NOT NULL,
  -- IANA. Every local time on this stay is read in it.
  property_timezone         text NOT NULL,
  country_code              text,
  city                      text,
  latitude                  double precision,
  longitude                 double precision,
  star_rating               smallint CHECK (star_rating BETWEEN 1 AND 5),
  guest_rating              numeric(3, 1),
  guest_review_count        integer,

  room_name                 text,
  room_count                smallint NOT NULL DEFAULT 1 CHECK (room_count > 0),
  occupancy                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  board                     text CHECK (board IN ('room_only', 'breakfast', 'half_board', 'full_board', 'all_inclusive')),

  -- Minor units, one currency, never a float.
  base_amount               bigint NOT NULL CHECK (base_amount >= 0),
  taxes_prepaid_amount      bigint NOT NULL DEFAULT 0 CHECK (taxes_prepaid_amount >= 0),
  taxes_at_property_amount  bigint NOT NULL DEFAULT 0 CHECK (taxes_at_property_amount >= 0),
  currency                  text NOT NULL,

  -- Generated, not passed in. A query that orders by the room rate puts the
  -- property with the hidden desk fee first; this column is here so that the
  -- correct answer is also the convenient one.
  all_in_amount             bigint GENERATED ALWAYS AS
    (base_amount + taxes_prepaid_amount + taxes_at_property_amount) STORED,

  -- The policy as the supplier stated it, deadlines in property-local wall
  -- clocks. Snapshotted because a policy that changes after booking does not
  -- change what the guest agreed to.
  cancellation              jsonb NOT NULL DEFAULT '{}'::jsonb,
  non_refundable            boolean NOT NULL DEFAULT FALSE,

  rooms_remaining           integer,
  -- Never nullable. A rate with no expiry is one nobody can be held to.
  expires_at                timestamptz NOT NULL,

  raw                       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotel_offers_search_idx
  ON public.hotel_offers (search_id, all_in_amount);

-- ── 4. A booking ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hotel_bookings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_id                 uuid REFERENCES public.hotel_searches(id) ON DELETE SET NULL,
  offer_id                  uuid REFERENCES public.hotel_offers(id) ON DELETE SET NULL,

  supplier_slug             text NOT NULL,
  supplier_booking_id       text,
  -- What the property itself calls the reservation, where the supplier passes
  -- one through. It is what a guest reads out at a front desk.
  property_confirmation_code text,

  status                    text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'searching', 'offered', 'awaiting_confirmation', 'pricing',
      'payment_pending', 'confirmed', 'checked_in', 'completed',
      'cancelled', 'no_show', 'payment_failed', 'booking_failed', 'expired'
    )),

  property_id               text NOT NULL,
  property_name             text NOT NULL,
  property_timezone         text NOT NULL,
  property_address          text,
  country_code              text,
  city                      text,

  check_in                  date NOT NULL,
  check_out                 date NOT NULL,
  CONSTRAINT hotel_bookings_stay_is_positive CHECK (check_out > check_in),
  -- Property-local wall clocks, "15:00" / "11:00". Text, not time-with-zone:
  -- they are what the property prints, not instants.
  check_in_from             text,
  check_out_by              text,

  room_name                 text,
  room_count                smallint NOT NULL DEFAULT 1 CHECK (room_count > 0),
  occupancy                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  board                     text,

  base_amount               bigint NOT NULL CHECK (base_amount >= 0),
  taxes_prepaid_amount      bigint NOT NULL DEFAULT 0 CHECK (taxes_prepaid_amount >= 0),
  taxes_at_property_amount  bigint NOT NULL DEFAULT 0 CHECK (taxes_at_property_amount >= 0),
  currency                  text NOT NULL,
  all_in_amount             bigint GENERATED ALWAYS AS
    (base_amount + taxes_prepaid_amount + taxes_at_property_amount) STORED,

  cancellation              jsonb NOT NULL DEFAULT '{}'::jsonb,
  non_refundable            boolean NOT NULL DEFAULT FALSE,
  -- When free cancellation runs out, as an instant derived once from the
  -- property-local deadline. Stored so a reminder job does not have to redo
  -- the zone arithmetic and get it differently.
  free_cancellation_until   timestamptz,
  cancelled_at              timestamptz,
  cancellation_penalty_amount bigint CHECK (cancellation_penalty_amount >= 0),

  -- The same key on a retry must never produce a second reservation.
  idempotency_key           text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotel_bookings_user_idx
  ON public.hotel_bookings (user_id, created_at DESC);

-- Partial, so that a row without a key does not collide with every other one.
CREATE UNIQUE INDEX IF NOT EXISTS hotel_bookings_idempotency_idx
  ON public.hotel_bookings (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS hotel_bookings_supplier_ref_idx
  ON public.hotel_bookings (supplier_slug, supplier_booking_id)
  WHERE supplier_booking_id IS NOT NULL;

-- ── 5. Who is staying ───────────────────────────────────────────────────────
--
-- Names, and a way to reach the lead guest. **No passport, no date of birth,
-- no nationality, no document number** — a hotel booking does not need them and
-- a column that exists gets filled in.
--
-- RLS on and no policy: see the header. A guest list joined to a booking is
-- location history about identifiable people.

CREATE TABLE IF NOT EXISTS public.hotel_guests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES public.hotel_bookings(id) ON DELETE CASCADE,

  -- Which room of the booking this person is in.
  room_index    smallint NOT NULL DEFAULT 0 CHECK (room_index >= 0),
  is_lead       boolean NOT NULL DEFAULT FALSE,

  given_name    text NOT NULL,
  family_name   text NOT NULL,

  -- Lead guest only, so the property can reach somebody.
  email         text,
  phone         text,
  special_requests text,

  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotel_guests_booking_idx
  ON public.hotel_guests (booking_id);

-- ── 6. What happened, in order ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hotel_booking_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES public.hotel_bookings(id) ON DELETE CASCADE,

  kind          text NOT NULL,
  from_status   text,
  to_status     text,
  supplier_slug text,
  -- Never a raw supplier payload: that is where a credential ends up.
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hotel_booking_events_booking_idx
  ON public.hotel_booking_events (booking_id, created_at);

-- ── 7. Webhooks, delivered more than once ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.hotel_webhook_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_slug      text NOT NULL,
  supplier_event_id  text NOT NULL,
  event_type         text,
  booking_id         uuid REFERENCES public.hotel_bookings(id) ON DELETE SET NULL,
  payload            jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- A supplier that delivers the same event twice changes nothing the second
  -- time.
  UNIQUE (supplier_slug, supplier_event_id)
);

-- ── 8. Row-level security ───────────────────────────────────────────────────
--
-- On for every table. A guest reads their own searches, offers and bookings,
-- and writes none of them: a status is the supplier's word, and a client that
-- could set one could mark an unpaid booking confirmed.

ALTER TABLE public.hotel_suppliers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_searches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_offers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_guests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_booking_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotel_webhook_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_searches_own_read ON public.hotel_searches;
CREATE POLICY hotel_searches_own_read
  ON public.hotel_searches FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS hotel_offers_own_read ON public.hotel_offers;
CREATE POLICY hotel_offers_own_read
  ON public.hotel_offers FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS hotel_bookings_own_read ON public.hotel_bookings;
CREATE POLICY hotel_bookings_own_read
  ON public.hotel_bookings FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS hotel_booking_events_own_read ON public.hotel_booking_events;
CREATE POLICY hotel_booking_events_own_read
  ON public.hotel_booking_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.hotel_bookings b
    WHERE b.id = hotel_booking_events.booking_id
      AND b.user_id = (SELECT auth.uid())
  ));

-- `hotel_guests`, `hotel_suppliers` and `hotel_webhook_events` get no policy.
-- That is the design, not an omission.

-- ── 9. What a client may know about suppliers ───────────────────────────────

CREATE OR REPLACE VIEW public.hotel_suppliers_public AS
  SELECT
    slug, name, kind, integration_status,
    search_supported, booking_supported, cancellation_supported,
    modification_supported, reprice_supported, fee_breakdown_supported,
    countries, currencies, sort_order
  FROM public.hotel_suppliers
  WHERE enabled = TRUE;

GRANT SELECT ON public.hotel_suppliers_public TO anon, authenticated;

-- ── 10. Keeping `updated_at` honest ─────────────────────────────────────────
--
-- `mobility_touch_updated_at` already does exactly this and is already
-- deployed. Reused rather than copied, as the flights migration reuses it: two
-- triggers that set the same column the same way is one of them going stale.

DROP TRIGGER IF EXISTS hotel_suppliers_touch ON public.hotel_suppliers;
CREATE TRIGGER hotel_suppliers_touch
  BEFORE UPDATE ON public.hotel_suppliers
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

DROP TRIGGER IF EXISTS hotel_bookings_touch ON public.hotel_bookings;
CREATE TRIGGER hotel_bookings_touch
  BEFORE UPDATE ON public.hotel_bookings
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

-- ── 11. The registry's first rows ───────────────────────────────────────────
--
-- Every one disabled, every one `not_researched`. `enabled` is not named in the
-- column list, so a seventh supplier added here cannot arrive switched on by a
-- typo.
--
-- None of these rows claims an API. Reading each supplier's current official
-- documentation is the work that moves a row off `not_researched`, and it could
-- not be done from the environment that wrote this file — the egress proxy
-- blocks their documentation domains, as it blocked the flight suppliers' and
-- Uber's before them. docs/hotels/providers.md records that.

INSERT INTO public.hotel_suppliers (slug, name, kind, integration_status, contract_required, sort_order)
VALUES
  ('hotelbeds',   'Hotelbeds',   'bed_bank',     'not_researched', TRUE, 10),
  ('amadeus',     'Amadeus',     'gds',          'not_researched', TRUE, 20),
  ('sabre',       'Sabre',       'gds',          'not_researched', TRUE, 30),
  ('expedia',     'Expedia',     'aggregator',   'not_researched', TRUE, 40),
  ('booking',     'Booking.com', 'aggregator',   'not_researched', TRUE, 50),
  ('travelgate',  'TravelgateX', 'aggregator',   'not_researched', TRUE, 60)
ON CONFLICT (slug) DO NOTHING;
