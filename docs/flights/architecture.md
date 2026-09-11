# Flights — the shape

## Why the core came first

A booking platform whose ranking, expiry, state machine and confirmation rules
can only be exercised against a live supplier is a platform nobody can test
until after a signature. Those are exactly the rules that must not be wrong when
money moves, so they are pure functions over data and they are tested without a
credential.

## The layers

```
  flights.ts          what a journey is        pure, tested, done
  flightsProviders.ts what a supplier is       seam, every row pending
  20261010000000_…sql where it lives           7 tables, RLS on all
  (not built)         an Edge Function         nothing to call yet
  (not built)         web UI / WhatsApp        nothing to book yet
```

`booking.ts` sits under `flights.ts` and under `mobility.ts` both. It exists
because the second booking domain arrived: a taxi and a flight are different
products with the same skeleton — somebody asks, several suppliers answer with
prices that expire, one answer is chosen, an unambiguous yes is required, money
moves. Copying that skeleton would have been two confirmation rules, which is
one confirmation rule and one bug waiting for somebody to fix only the other.

## The state machine

Fourteen statuses with an explicit transition table. `canTransitionFlight`
answers from that table and nothing else, so an impossible move is impossible
rather than merely unlikely.

```
draft → searching → offered → awaiting_confirmation → pricing
                                                        ├→ payment_pending → ticketing → ticketed
                                                        ├→ held
                                                        └→ offered            (fare moved)
```

Three things about it:

- **`pricing` is its own state.** Between the traveller's yes and the charge: it
  is where the fare is confirmed to still exist. A fare that moved here goes
  back to `offered` and is shown again, never charged.
- **`payment_failed` and `ticketing_failed` are different states.** Paid but not
  ticketed needs a refund; failed to pay does not.
- **`ticketed` is the only state that means the traveller can fly.** `held` and
  `payment_pending` are not tickets, and the vocabulary does not let them be
  mistaken for one.
- **Terminal is terminal.** `cancelled`, `expired`, `ticketed` and the failure
  states accept no further transition, so a late or duplicated supplier webhook
  is a no-op rather than a resurrection.

## Ranking

`rankOffers` takes what the traveller asked for — `cheapest`, `fastest`,
`fewest_stops`, `best_value` — and nothing else. Three properties hold across
all four:

- **Expired offers sink to the bottom**, never disappear. A traveller who was
  shown a price is told it lapsed rather than watching it vanish.
- **No currency conversion.** Mixed currencies are grouped by the caller.
- **No commission term.** The order a traveller sees is the order their stated
  preference produces. If a commission ever influences ordering, that is a
  product decision made in the open, with a visible label — not a hidden
  addend in a comparator.

## Concurrency

`gatherOffers` asks every usable supplier at once with **a deadline each**.

Not one shared budget. This repository has already been bitten by that exactly
once, in the AI provider chain, where a single 30-second budget with no
per-target timeout let one hanging provider starve every fallback behind it and
produced a green diagnostics page beside a dead assistant. `gatherFrom` in
`booking.ts` carries the per-source deadline so neither domain can reintroduce
it.

A supplier that declares no `search` costs no network call and no timeout at
all — it contributes `SUPPLIER_REQUIRES_ACCREDITATION` immediately. Which is
why a registry of six pending suppliers costs nothing per search.

## The database

Seven tables. The two decisions worth knowing:

**`flight_passengers` is service-role only** — RLS on, no policy. A passport
number, a date of birth and a nationality on one row; there is no query a
browser should be able to run against that. `flight_bookings`, which a traveller
*can* read, deliberately carries no passenger identity.

**A traveller reads and never writes.** All four policies are `FOR SELECT`. A
status is the supplier's word; a client that could set one could mark an unpaid
booking `ticketed`.

Two unique indexes carry the idempotency: a retry with the same key cannot buy a
second ticket, and a supplier that delivers the same webhook twice changes
nothing.

## Growing it

The order the remaining work should happen in:

1. Documentation access and one supplier contract. Everything else is blocked
   behind this and no amount of code removes the block.
2. One adapter, sandbox only, against real documentation.
3. The Edge Function — *one*, action-routed, like `mobility/index.ts`. The
   deploy ceiling is 97 of 100 functions and the ceiling is real.
4. The WhatsApp flow, with all twenty locales, since the onboarding test allows
   no fallback.
5. The web UI and "My Trips".

Steps 3–5 are cheap once step 1 exists and impossible before it.
