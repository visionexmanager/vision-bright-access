# Hotels — the shape

## The layers

```
  booking.ts           what every booking shares    Money, yes, expiry, gather, zones
  hotels.ts            what a stay is               pure, tested, done
  hotelsProviders.ts   what a supplier is           seam, every row pending
  20261011000000_….sql where it lives               7 tables, RLS on all
  (not built)          an Edge Function             nothing to call yet
  (not built)          web UI / WhatsApp            nothing to book yet
```

`booking.ts` now carries five things all three booking domains need: `Money`,
the confirmation rule, `isFresh`, the concurrent gather with per-source
deadlines, and — added with this section — `localToInstant` and `foldLatin`.

The last two moved here rather than being copied. A flight's departure time and
a hotel's free-cancellation deadline are the same problem: a wall clock in
somebody else's timezone, read at the offset in force *at that moment*. Two
copies of that would drift, and the one that drifts is the one nobody tests
across a daylight-saving change.

`foldLatin` is the shared half of name handling. What each domain then *allows*
differs and both are right: an airline will not print an apostrophe on a
boarding pass, and a hotel folio is perfectly happy with O'Brien. So
`ticketName` and `guestName` diverge after the fold.

## The state machine

Fourteen statuses with an explicit transition table.

```
draft → searching → offered → awaiting_confirmation → pricing → payment_pending
                                                         ↓            ↓
                                                      offered     confirmed → checked_in → completed
                                                   (rate moved)      ↓  ↓
                                                                cancelled  no_show
```

Three things about it:

- **`pricing` is its own state**, as it is for flights: it is where the rate is
  confirmed to still exist at the price the guest said yes to. A rate that moved
  goes back to `offered` and is shown again, never charged.
- **`no_show` is not `cancelled`.** A no-show usually costs the guest the first
  night; a cancellation inside the free window costs nothing. A vocabulary that
  cannot tell them apart cannot refund correctly.
- **Terminal is terminal.** A late or duplicated supplier webhook is a no-op
  rather than a resurrection.

## Money

Three numbers, because a hotel bill has three and collapsing them loses the one
that surprises people:

| | What it is |
| --- | --- |
| `base` | The room, before tax and before anything at the desk. |
| `taxesPrepaid` | Tax and fees taken now, with the room. |
| `taxesAtProperty` | Mandatory charges collected on arrival or departure. |

`prepaid` is what leaves the card. `atProperty` is what the desk will ask for —
and a zero there is a number worth *showing*, not hiding. `allIn` is the sum,
and it is the only number two offers may be compared on.

The database generates `all_in_amount` rather than accepting it, so the correct
ordering is also the convenient one.

## Cancellation

A policy is a list of tiers, each a **property-local wall clock** and a penalty.
`penaltyNow` takes the last tier whose deadline has passed and resolves it
against the stay's own money. Four penalty shapes: none, a fixed amount, a
number of nights, a percentage.

Two rules that are easy to get wrong and are tested:

- **A policy nobody stated costs nothing.** No tiers, not non-refundable, free
  to cancel. A penalty nobody was told about is not a penalty.
- **A deadline that cannot be parsed is ignored, not charged for.** The failure
  mode of a malformed policy must be free cancellation, never a surprise bill.

`freeUntil` returns the earliest tier that costs something, as an instant, for a
countdown — which is the only form of this a guest reliably reads correctly. The
booking row stores it once so a reminder job does not redo the zone arithmetic
and get it differently.

## Ranking

`rankOffers` takes what the guest asked for — `cheapest`, `best_rated`,
`nearest`, `best_value` — and nothing else.

- **Cheapest means all-in.** See the README.
- **Expired offers sink, they do not vanish.**
- **An unrated property goes last rather than being given an average.**
- **A property with no coordinates does not sort as though it were at the centre
  of the search.**
- **No currency conversion and no commission term.** If a commission ever
  influences ordering, that is a product decision made in the open with a
  visible label — not a hidden addend in a comparator.

## Concurrency

`gatherOffers` asks every usable supplier at once with **a deadline each** —
`gatherFrom` from `booking.ts`. Not one shared budget: this repository has been
bitten by that once, in the AI provider chain, where a single 30-second budget
with no per-target timeout let one hanging provider starve every fallback behind
it. A supplier that declares no `search` costs no network call at all.

## The database

Seven tables. The decisions worth knowing:

**`hotel_guests` is service-role only** — RLS on, no policy. Not for the flights
reason: there is no passport here and no column for one. A guest list joined to
a booking says who was in a named building on a named night, which is location
history about identifiable people.

**A traveller reads and never writes.** All four policies are `FOR SELECT`.

**Dates are `date`.** Not `timestamptz`. See the README.

Two unique indexes carry idempotency: a retry cannot book a second room, and a
supplier delivering the same webhook twice changes nothing.

## Growing it

1. One supplier contract and documentation access. Everything else is blocked
   behind this.
2. One adapter, test environment only, against real documentation.
3. The Edge Function — *one*, action-routed, like `mobility/index.ts`. The
   deploy ceiling is real.
4. The WhatsApp flow, with all twenty locales.
5. The web UI and "My Stays".
