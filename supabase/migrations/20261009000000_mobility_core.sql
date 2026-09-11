-- ============================================================================
-- VISIONEX MOBILITY — the provider-neutral core
-- ============================================================================
--
-- One interface, many providers. Nothing here names Uber, and nothing here may:
-- the day a provider is switched off, the trips it carried must still read, the
-- history must still belong to the person who took the ride, and the next
-- provider must need no migration of its own.
--
-- ── What is deliberately absent ─────────────────────────────────────────────
--
-- No `stream`-shaped secret, no API key, no client secret, no OAuth token in
-- any table a user can read. `mobility_user_connections` holds authorization
-- material and is service-role only by construction: RLS on, no policy. That is
-- the shape this repository already uses for a table whose contents are an
-- implementation detail, and it is the reason there is no "read your own
-- connection" policy below — a token is not the user's to read, it is the
-- server's to spend on their behalf.
--
-- ── Why the states are a CHECK and not a comment ────────────────────────────
--
-- A trip's status is what the assistant, the web page and the notification
-- layer all branch on. A typo in one writer becomes a trip nobody can render,
-- so the set is enforced where it cannot be bypassed. Provider-specific words
-- (Uber's `processing`, `accepted`) are mapped to these in code and never
-- stored raw — see `supabase/functions/_shared/mobility.ts`.
--
-- Additive and re-runnable throughout: IF NOT EXISTS, CREATE OR REPLACE,
-- guarded ALTER. A migration that cannot run twice will eventually run twice.

-- ── 1. The provider registry ────────────────────────────────────────────────
--
-- One row per provider, carrying the capability record the router reads before
-- it asks anybody for anything. `integration_status` is the honest field: it
-- says what Visionex may actually do with this provider today, and it starts at
-- `not_researched` rather than at something flattering.
--
-- `enabled` is the feature flag. It defaults to FALSE and must stay FALSE until
-- credentials and any partner approval are real — a provider that is enabled
-- without approval is a support incident, not a feature.

CREATE TABLE IF NOT EXISTS public.mobility_providers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                      text UNIQUE NOT NULL,
  name                      text NOT NULL,

  -- What Visionex is allowed to do with it, today.
  integration_status        text NOT NULL DEFAULT 'not_researched'
    CHECK (integration_status IN (
      'not_researched', 'researched', 'public_api', 'partner_api', 'oauth',
      'deeplink', 'embedded_web', 'aggregator', 'manual_partner_required',
      'unavailable', 'deprecated'
    )),

  -- What it can do, each one proved before it is set.
  quote_supported           boolean NOT NULL DEFAULT FALSE,
  booking_supported         boolean NOT NULL DEFAULT FALSE,
  tracking_supported        boolean NOT NULL DEFAULT FALSE,
  cancellation_supported    boolean NOT NULL DEFAULT FALSE,
  deep_link_supported       boolean NOT NULL DEFAULT FALSE,
  oauth_supported           boolean NOT NULL DEFAULT FALSE,
  api_key_supported         boolean NOT NULL DEFAULT FALSE,
  partner_approval_required boolean NOT NULL DEFAULT TRUE,
  sandbox_available         boolean NOT NULL DEFAULT FALSE,
  production_available      boolean NOT NULL DEFAULT FALSE,
  payment_handled_by_provider boolean NOT NULL DEFAULT TRUE,

  -- Where it works. Empty means "not established", never "everywhere".
  countries                 text[] NOT NULL DEFAULT '{}',
  cities                    text[] NOT NULL DEFAULT '{}',
  service_types             text[] NOT NULL DEFAULT '{}',
  currencies                text[] NOT NULL DEFAULT '{}',
  languages                 text[] NOT NULL DEFAULT '{}',
  accessibility_options     text[] NOT NULL DEFAULT '{}',

  -- The flag, and the paper trail behind it.
  enabled                   boolean NOT NULL DEFAULT FALSE,
  documentation_url         text,
  approval_notes            text,
  last_verified_at          timestamptz,

  sort_order                integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT NOW(),
  updated_at                timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.mobility_providers.integration_status IS
  'What Visionex may actually do with this provider today. Never set beyond what official documentation or a signed partner agreement confirms.';
COMMENT ON COLUMN public.mobility_providers.enabled IS
  'The feature flag. FALSE until credentials and any partner approval are real.';
COMMENT ON COLUMN public.mobility_providers.last_verified_at IS
  'When a person last checked this row against the provider''s current official documentation.';

CREATE INDEX IF NOT EXISTS mobility_providers_enabled_idx
  ON public.mobility_providers (enabled, sort_order)
  WHERE enabled = TRUE;

-- ── 2. Saved places ─────────────────────────────────────────────────────────
--
-- Provider-independent by design: "take me home" must keep working when the
-- provider that drove you there last time is gone.

CREATE TABLE IF NOT EXISTS public.mobility_saved_places (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label         text NOT NULL,
  kind          text NOT NULL DEFAULT 'custom'
    CHECK (kind IN ('home', 'work', 'school', 'airport', 'hotel', 'custom')),
  latitude      double precision,
  longitude     double precision,
  address       text,
  place_id      text,
  country_code  text,
  city          text,
  timezone      text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, label)
);

CREATE INDEX IF NOT EXISTS mobility_saved_places_user_idx
  ON public.mobility_saved_places (user_id, kind);

-- ── 3. Trips ────────────────────────────────────────────────────────────────
--
-- The normalized record. Every provider's trip becomes one of these, and the
-- provider's own identifiers live beside it rather than inside it.
--
-- Location is stored flat rather than as PostGIS geography: this is a pickup
-- and a destination, not a spatial query surface, and a pair of doubles with a
-- formatted address is what every consumer of this row actually reads.

CREATE TABLE IF NOT EXISTS public.mobility_trips (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_slug           text NOT NULL,
  provider_trip_id        text,
  provider_booking_id     text,

  status                  text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'searching', 'quoted', 'awaiting_confirmation', 'booking',
      'confirmed', 'driver_searching', 'driver_assigned', 'driver_arriving',
      'driver_arrived', 'in_progress', 'completed', 'cancelled',
      'provider_cancelled', 'no_driver', 'failed', 'expired'
    )),
  booking_type            text NOT NULL DEFAULT 'now'
    CHECK (booking_type IN ('now', 'scheduled')),
  source                  text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'whatsapp', 'voice', 'api')),

  pickup                  jsonb NOT NULL,
  destination             jsonb NOT NULL,
  stops                   jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- UTC, always. The pickup's own zone is carried beside it so the sender can
  -- be shown 08:00 in the city they are standing in rather than in UTC.
  scheduled_at            timestamptz,
  pickup_timezone         text,
  requested_at            timestamptz,

  passenger_count         integer NOT NULL DEFAULT 1 CHECK (passenger_count BETWEEN 1 AND 16),
  vehicle_type            text,
  accessibility           text[] NOT NULL DEFAULT '{}',

  -- Money is stored in minor units with its currency beside it. A price is
  -- never rewritten into another currency in this table: what the provider
  -- charged is what is recorded, and conversion is a display concern.
  price_amount            integer,
  price_currency          text,
  provider_price_amount   integer,
  visionex_fee_amount     integer,
  commission_amount       integer,
  commission_type         text,

  estimated_duration_s    integer,
  estimated_distance_m    integer,
  pickup_eta_s            integer,

  driver                  jsonb,
  vehicle                 jsonb,
  payment_status          text NOT NULL DEFAULT 'provider'
    CHECK (payment_status IN ('provider', 'pending', 'paid', 'refunded', 'failed')),
  cancellation_policy     jsonb,

  -- One booking per confirmed intent. The router writes this before it calls a
  -- provider and refuses a second call carrying the same key, which is what
  -- stops a timeout from becoming two rides.
  idempotency_key         text,

  created_at              timestamptz NOT NULL DEFAULT NOW(),
  updated_at              timestamptz NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.mobility_trips.idempotency_key IS
  'Set before a provider is called. A retry carrying the same key must resolve to this row rather than book again.';
COMMENT ON COLUMN public.mobility_trips.price_amount IS
  'Minor units of price_currency. Provider prices are never silently converted.';

CREATE UNIQUE INDEX IF NOT EXISTS mobility_trips_idempotency_idx
  ON public.mobility_trips (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS mobility_trips_user_recent_idx
  ON public.mobility_trips (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS mobility_trips_live_idx
  ON public.mobility_trips (status, updated_at DESC)
  WHERE status IN ('booking', 'confirmed', 'driver_searching', 'driver_assigned',
                   'driver_arriving', 'driver_arrived', 'in_progress');

CREATE UNIQUE INDEX IF NOT EXISTS mobility_trips_provider_trip_idx
  ON public.mobility_trips (provider_slug, provider_trip_id)
  WHERE provider_trip_id IS NOT NULL;

-- ── 4. Trip events ──────────────────────────────────────────────────────────
--
-- Append-only. The trip row carries where things stand; this carries how they
-- got there, which is the difference between "cancelled" and "the driver
-- cancelled after eleven minutes".

CREATE TABLE IF NOT EXISTS public.mobility_trip_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES public.mobility_trips(id) ON DELETE CASCADE,
  status          text NOT NULL,
  provider_status text,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobility_trip_events_trip_idx
  ON public.mobility_trip_events (trip_id, created_at DESC);

-- ── 5. Quotes ───────────────────────────────────────────────────────────────
--
-- Time-limited by construction. A quote with no `expires_at` is a price nobody
-- can be held to, so the column is NOT NULL and the booking path re-reads it.

CREATE TABLE IF NOT EXISTS public.mobility_quotes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_id          uuid NOT NULL,
  provider_slug      text NOT NULL,
  product_id         text,
  product_name       text,
  vehicle_type       text,

  price_amount       integer,
  price_min_amount   integer,
  price_max_amount   integer,
  price_currency     text,
  surge_multiplier   numeric(5, 2),

  eta_s              integer,
  duration_s         integer,
  distance_m         integer,
  capacity           integer,
  accessibility      text[] NOT NULL DEFAULT '{}',
  booking_supported  boolean NOT NULL DEFAULT FALSE,
  deeplink           text,

  expires_at         timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobility_quotes_search_idx
  ON public.mobility_quotes (search_id, price_amount);

CREATE INDEX IF NOT EXISTS mobility_quotes_expiry_idx
  ON public.mobility_quotes (expires_at);

-- ── 6. Provider authorization, which is not the user's to read ──────────────
--
-- OAuth material for one user at one provider. RLS is on and there is no
-- policy: this table is reachable only by the service role. That is deliberate
-- and must stay that way — do not add a "users read their own row" policy to
-- make something work. What a user is entitled to know is *that* they are
-- connected, and the Edge Function tells them that without handing over a
-- token to do it.

CREATE TABLE IF NOT EXISTS public.mobility_user_connections (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_slug         text NOT NULL,
  status                text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'connected', 'expired', 'revoked', 'failed')),
  scopes                text[] NOT NULL DEFAULT '{}',
  access_token_enc      text,
  refresh_token_enc     text,
  token_expires_at      timestamptz,
  provider_account_ref  text,
  connected_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider_slug)
);

COMMENT ON TABLE public.mobility_user_connections IS
  'Service-role only by construction: RLS on, no policy. Holds OAuth material, which is never a user-readable value.';

-- ── 7. Webhook events ───────────────────────────────────────────────────────
--
-- Deduplication and replay protection in one table. The unique key is the
-- provider's own event id, so a redelivery is a no-op rather than a second
-- state change — the same guarantee the WhatsApp webhook gets from
-- `wa_message_id`.

CREATE TABLE IF NOT EXISTS public.mobility_webhook_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug   text NOT NULL,
  provider_event_id text NOT NULL,
  event_type      text,
  trip_id         uuid REFERENCES public.mobility_trips(id) ON DELETE SET NULL,
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (provider_slug, provider_event_id)
);

CREATE INDEX IF NOT EXISTS mobility_webhook_events_unprocessed_idx
  ON public.mobility_webhook_events (created_at)
  WHERE processed_at IS NULL;

-- ── 8. Provider health ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mobility_provider_health (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_slug       text NOT NULL,
  ok                  boolean NOT NULL,
  latency_ms          integer,
  error_kind          text,
  checked_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mobility_provider_health_recent_idx
  ON public.mobility_provider_health (provider_slug, checked_at DESC);

-- ── 9. Row-level security ───────────────────────────────────────────────────
--
-- Every table on. The three a user owns get exactly one policy each, wrapping
-- `auth.uid()` in a sub-select so it is evaluated once rather than per row. The
-- rest are service-role only: no policy is not an oversight, it is the rule.

ALTER TABLE public.mobility_providers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_saved_places       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_trips              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_trip_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_quotes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_user_connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_webhook_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobility_provider_health    ENABLE ROW LEVEL SECURITY;

-- A rider reads and writes their own saved places, and nobody else's.
DROP POLICY IF EXISTS mobility_saved_places_own ON public.mobility_saved_places;
CREATE POLICY mobility_saved_places_own
  ON public.mobility_saved_places FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- A rider reads their own trips. Writing is the server's: a trip's status is
-- the provider's word, not the rider's, and a client that could set it could
-- mark an unpaid ride completed.
DROP POLICY IF EXISTS mobility_trips_own_read ON public.mobility_trips;
CREATE POLICY mobility_trips_own_read
  ON public.mobility_trips FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- The history of a trip is readable by whoever the trip belongs to.
DROP POLICY IF EXISTS mobility_trip_events_own_read ON public.mobility_trip_events;
CREATE POLICY mobility_trip_events_own_read
  ON public.mobility_trip_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.mobility_trips t
    WHERE t.id = mobility_trip_events.trip_id
      AND t.user_id = (SELECT auth.uid())
  ));

-- A rider reads the quotes gathered for them. They expire on their own.
DROP POLICY IF EXISTS mobility_quotes_own_read ON public.mobility_quotes;
CREATE POLICY mobility_quotes_own_read
  ON public.mobility_quotes FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ── 10. What a client may know about providers ──────────────────────────────
--
-- The registry carries approval notes and commercial detail, so it is not read
-- directly by a browser. This view is the public face of it: which providers
-- are switched on, and what they can do. No notes, no documentation URL, no
-- verification date — those are operations' business.

CREATE OR REPLACE VIEW public.mobility_providers_public AS
  SELECT
    slug, name, integration_status,
    quote_supported, booking_supported, tracking_supported,
    cancellation_supported, deep_link_supported,
    countries, cities, service_types, currencies, accessibility_options,
    sort_order
  FROM public.mobility_providers
  WHERE enabled = TRUE;

GRANT SELECT ON public.mobility_providers_public TO anon, authenticated;

-- ── 11. Keeping `updated_at` honest ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mobility_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mobility_providers_touch ON public.mobility_providers;
CREATE TRIGGER mobility_providers_touch
  BEFORE UPDATE ON public.mobility_providers
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

DROP TRIGGER IF EXISTS mobility_trips_touch ON public.mobility_trips;
CREATE TRIGGER mobility_trips_touch
  BEFORE UPDATE ON public.mobility_trips
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

DROP TRIGGER IF EXISTS mobility_saved_places_touch ON public.mobility_saved_places;
CREATE TRIGGER mobility_saved_places_touch
  BEFORE UPDATE ON public.mobility_saved_places
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

DROP TRIGGER IF EXISTS mobility_user_connections_touch ON public.mobility_user_connections;
CREATE TRIGGER mobility_user_connections_touch
  BEFORE UPDATE ON public.mobility_user_connections
  FOR EACH ROW EXECUTE FUNCTION public.mobility_touch_updated_at();

-- ── 12. The registry's first rows ───────────────────────────────────────────
--
-- Every one of them disabled, and every one of them `not_researched` unless a
-- person has actually read that provider's current official documentation and
-- written down what they found. The seed exists so the registry is a real list
-- rather than an empty table, not so the list can be mistaken for progress.
--
-- Uber is the only row that says more than "not researched", and what it says
-- is that its Riders API requires approval — see docs/mobility/uber.md for the
-- evidence and for exactly what Visionex must submit.

INSERT INTO public.mobility_providers (slug, name, integration_status, partner_approval_required, sort_order)
VALUES
  ('uber',    'Uber',     'manual_partner_required', TRUE,  10),
  ('bolt',    'Bolt',     'not_researched',          TRUE,  20),
  ('lyft',    'Lyft',     'not_researched',          TRUE,  30),
  ('grab',    'Grab',     'not_researched',          TRUE,  40),
  ('didi',    'DiDi',     'not_researched',          TRUE,  50),
  ('cabify',  'Cabify',   'not_researched',          TRUE,  60),
  ('freenow', 'FREE NOW', 'not_researched',          TRUE,  70),
  ('gett',    'Gett',     'not_researched',          TRUE,  80),
  ('yango',   'Yango',    'not_researched',          TRUE,  90),
  ('indrive', 'inDrive',  'not_researched',          TRUE, 100),
  ('careem',  'Careem',   'not_researched',          TRUE, 110),
  ('splyt',   'Splyt',    'not_researched',          TRUE, 120)
ON CONFLICT (slug) DO NOTHING;
