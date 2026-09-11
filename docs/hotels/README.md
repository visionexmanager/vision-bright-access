# Visionex Hotels

A hotel-booking section built supplier-neutral, so that the rules deciding what
a guest is shown and what they are charged exist, are tested, and are correct
**before** any supplier contract is signed.

| Where | What it knows |
| --- | --- |
| `supabase/functions/_shared/booking.ts` | What every Visionex booking has in common. Shared with Mobility and Flights. |
| `supabase/functions/_shared/hotels.ts` | What a stay is: nights, occupancy, price, cancellation, distance, statuses. Pure. |
| `supabase/functions/_shared/hotelsProviders.ts` | That several companies might sell one, and what it would take to call any of them. |
| `supabase/migrations/20261011000000_hotels_core.sql` | Seven tables, RLS on every one. |

`src/test/hotels-core.test.ts` drives all of it — 118 tests, no credential, no
supplier, no network.

## The state of it

**Nothing can be booked.** Every supplier is `not_researched`, every capability
`false`, and `isSupplierCallable` returns `false` for all of them with every key
in the world set. That is the intended state — see [providers.md](./providers.md)
for why, and for what moves a row off it.

What does work is everything that does not need a supplier: the night
arithmetic, the price split, the cancellation policy, the state machine, the
ranking and the database shape.

## The two things this section exists to get right

### A night is a calendar date, not a duration

3 October to 6 October is three nights in every timezone on earth and across
every daylight-saving change. Compute it from instants and a spring-forward
makes it two days and twenty-three hours — three nights that round to three
today and to two the day somebody changes a rounding mode.

`nightsBetween` counts dates. It reads them as midnight UTC, and that is the one
place in this codebase where midnight-UTC arithmetic is the *correct* answer
rather than the lazy one — precisely because a date is not an instant. "3
October" is a page in a calendar. It has no timezone, so giving it one and then
subtracting is inventing a problem.

The schema agrees: `check_in` and `check_out` are `date`, not `timestamptz`.

This is the exact mirror of the flights lesson. There, wall-clock subtraction is
wrong and instants are right. Here it reverses, and the same instinct applied
twice gives the wrong answer once.

### The price is the all-in price

A hotel quotes a nightly rate, adds tax, then asks for a resort fee at the desk.
Rank on the nightly rate, or on what leaves the card today, and the property
with the hidden fee sorts above the one without — on every search, forever, in
code that looks entirely reasonable in review. The guest finds out at checkout,
in a lobby, with luggage.

So `StayPrice` has three parts: `base`, `taxesPrepaid`, `taxesAtProperty`.
`allIn` is their sum, it is what `rankOffers` orders on, and there is a test that
a £90 rate with a £30 desk fee loses to a £110 rate with none.

The database carries the same rule as a **generated column**:
`all_in_amount` is `GENERATED ALWAYS AS (base + prepaid + at_property) STORED` on
both `hotel_offers` and `hotel_bookings`, so that a query ordering by price
cannot accidentally order by the room rate.

A supplier that cannot report the two parts separately cannot be sold through at
all: `canSellStays` requires `feeBreakdown`.

## Other decisions worth knowing

**A cancellation deadline is a wall clock in the property's timezone.** "Free
until 18:00 on the 3rd" means six in the evening where the hotel is. A guest who
reads a Tokyo deadline in their own timezone cancels nine hours late and pays
for it. `penaltyNow` reads every tier through the property's zone.

**A child's age is the age at check-in.** A twelfth birthday between booking and
arrival moves a child onto an adult rate at a great many properties. Sending the
age at booking is how a family arrives to a bill they did not agree to.

**`no_show` is not `cancelled`.** Different money — a no-show usually costs the
first night — and a vocabulary that cannot tell them apart cannot refund
correctly.

**A policy nobody stated costs nothing.** No tiers and not non-refundable means
free to cancel. A penalty nobody was told about is not a penalty.

## What is deliberately not built

- **Supplier adapters.** Blocked on documentation access and a contract.
- **The booking Edge Function.** Nothing to call, and the deploy ceiling is near
  (see `src/test/content-engine.test.ts`).
- **Web UI and WhatsApp flow.** The strings would need all twenty locales.
- **Payment.** No card data is stored, handled or logged anywhere here.

See [architecture.md](./architecture.md) and [security.md](./security.md).
