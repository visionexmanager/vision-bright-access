# Visionex Flights

A flight-booking section built supplier-neutral, so that the rules which decide
what a traveller is shown and what they are charged exist, are tested, and are
correct **before** any supplier contract is signed.

Three files and a migration:

| Where | What it knows |
| --- | --- |
| `supabase/functions/_shared/booking.ts` | What every Visionex booking has in common — money, confirmation, expiry, concurrent gather. Shared with Mobility. |
| `supabase/functions/_shared/flights.ts` | What a journey is: time, stops, fares, statuses, passengers, ranking. Pure. |
| `supabase/functions/_shared/flightsProviders.ts` | That several companies might sell one, what each can do, and what it would take to call one. |
| `supabase/migrations/20261010000000_flights_core.sql` | Seven tables, RLS on every one of them. |

`src/test/flights-core.test.ts` drives all of it — 83 tests, no credential, no
supplier, no network.

## The state of it

**Nothing can be booked.** Every supplier is `not_researched`, every capability
is `false`, and `isSupplierCallable` returns `false` for all of them with every
key in the world set. That is the intended state, not an unfinished one — see
[providers.md](./providers.md) for why, and for what moves a row off it.

What does work today is everything that does not need a supplier: the journey
arithmetic, the state machine, the ranking, the passenger-field boundary and the
database shape.

## What was hard, and how it is handled

### Time

The section of `flights.ts` that earns its comments. Beirut 08:00 → London 11:30
looks like three and a half hours and is five and a half. A flight can take four
hours and land tomorrow, or eighteen and land the same afternoon.

Every duration in this codebase is the difference between two **instants**,
derived by applying each airport's zone offset *at that moment* — never by
subtracting wall clocks, and never using today's offset for a flight on the far
side of a daylight-saving change. `localToInstant` does that, `segmentMinutes`,
`layoverMinutes`, `sliceMinutes` and `arrivalDayOffset` are built on it, and the
tests exercise London↔Dubai across both seasons precisely because Dubai has no
DST and London does, so a wrong implementation gives two different answers where
the right one gives 420 and 360.

`arrivalDayOffset` is the `+1` a traveller reads off the screen. It is computed
per airport-local calendar day, not from the duration.

### A fare that moves between being shown and being charged

`pricing` is its own status between `awaiting_confirmation` and
`payment_pending`, and `priceChanged` reports **any** movement, in either
direction. A fare that dropped is still a fare the traveller did not agree to,
and re-asking costs a message where charging the wrong amount costs a chargeback
and a complaint.

A supplier that cannot re-price cannot sell: `canSellTickets` requires
`reprice`, `book` and `ticket` together. Booking without ticketing leaves a
reservation that quietly lapses.

### Money

Minor units and an ISO currency, never a float, never converted silently. A
mixed-currency result list is grouped rather than ranked across currencies —
ranking would need a rate, a rate has an age, and a stale rate silently
reorders a list somebody is about to spend money from.

### Passport data

`flight_passengers` has RLS on and **no policy**. Not an oversight: a row there
carries a passport number, a date of birth and a nationality, and there is no
query a browser should be able to run against it. Only the service role, inside
an Edge Function, ever reads it. `flight_bookings` deliberately carries no
passenger identity, so the table a traveller *can* read holds none of it.

## What is not built

Deliberately, and named rather than implied:

- **Supplier adapters.** Blocked on documentation access and accreditation.
- **The booking Edge Function.** Not written, because there is nothing to call.
  The Edge Function budget is also near its ceiling (see
  `src/test/content-engine.test.ts`), and a router with no supplier behind it
  would spend a slot on nothing.
- **Web UI and WhatsApp flow.** The strings would need all twenty locales; the
  flow would need something to book.
- **Payment.** No card data is stored, handled or logged anywhere in this
  section, and none will be until a PSP decision is made deliberately.

See [architecture.md](./architecture.md) for the shape it is built to grow into,
and [security.md](./security.md) for the boundaries that must hold when it does.
