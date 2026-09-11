# Hotels — the boundaries

## Credentials

**No supplier credential reaches a browser or a WhatsApp message.** Every
supplier call happens server-side, inside an Edge Function, with the secret read
from the function environment.

**Never a `VITE_*` variable.** Anything prefixed `VITE_` is compiled into the
client bundle and is public the moment it ships. The secret names in
`hotelsProviders.ts` are deliberately not prefixed, and a supplier key must
never acquire one.

The file holds secret **names** and no values. A test asserts it contains no
`key: "…"`-shaped literal.

## The guest list is the sensitive table

`hotel_guests` has RLS on and **no policy** — service-role only.

The reason is specific to this domain and is worth stating plainly: a hotel
booking needs no travel document, so this schema has none. There is no
`passport`, no `nationality`, no `date_of_birth`, no `document_number` column
anywhere, and a test asserts that. A field that exists gets filled in, and data
nobody collected cannot leak.

What it is instead is **location history about identifiable people**. A guest
list joined to a booking says who was in a named building on a named night. The
only thing that ever needs those rows is the server call that hands a name to a
supplier.

`hotel_bookings` — which the guest *can* read — carries the stay, the money and
the status. Who slept there is deliberately not joined into it.

Where a jurisdiction genuinely requires a document at check-in, the property
takes it at the desk. That is their legal obligation and their record, not
Visionex's to hold a copy of.

## What is never logged

- API keys, client secrets, access tokens, refresh tokens
- Authorization headers
- Payment credentials of any kind
- Guest names joined to property and dates

A supplier error is logged by its code and slug. `hotel_booking_events.detail`
takes a summary, never a raw supplier payload — that is where a token ends up.

CI logs on this repository are public.

## Payment

**No raw card number is stored, anywhere, ever.** There is no payment code in
this section yet, and that is deliberate: a payment integration is a decision
about a PSP, a compliance posture and a data boundary. When it happens it goes
through a provider that keeps the card off Visionex infrastructure entirely.

Hotels add one wrinkle worth recording now: some suppliers pass a card through
to the property as a guarantee rather than charging it. Visionex will not
implement that pattern — it means holding card data to forward it, which is
exactly the thing not to do. A guarantee that cannot be given without holding a
card is a supplier Visionex does not sell through.

No payment credential ever appears in a WhatsApp message.

## An honest price is a security property here

Showing a total that excludes a mandatory fee is the most common way this
industry misleads people. It is treated as a correctness boundary, not a
presentation choice:

- `allIn` is the comparison number and `rankOffers` orders on it.
- `all_in_amount` is a generated column, so a query cannot accidentally order by
  the room rate.
- `canSellStays` refuses any supplier that cannot report desk-collected fees
  separately.

## A real booking needs a real yes

`isExplicitConfirmation` is whole-message-only against a deliberately short
list. And a rate that moved between the yes and the charge invalidates the yes:
`priceMoved` reports movement in either direction — **and also reports a fee
moved from the desk onto the card at an unchanged total**, because a guest who
budgeted for £200 now and £30 later is owed the chance to say yes again.

## Suppliers

- Never claim a supplier supports booking unless its current official
  documentation or approved partner access confirms it.
- Never scrape a supplier's website or app.
- Never bypass authentication, CAPTCHA, rate limits, geographic restrictions or
  contract requirements.
- A supplier defaults **off** until credentials and contract are verified.
  `enabled` is not in the seed's column list, so a supplier cannot arrive live
  through a typo.

## Reading the row you asked for

A request for something that is not yours answers identically to a request for
something that is not there. A 404 that differs from a 403 is an enumeration
oracle — and for hotels it would leak that a named person has a booking.
