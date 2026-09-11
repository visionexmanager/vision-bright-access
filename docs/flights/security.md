# Flights — the boundaries

Written down because this section will grow, and because every one of these is
easier to preserve than to restore.

## Credentials

**No supplier credential reaches a browser or a WhatsApp message.** Every
supplier call happens server-side, inside an Edge Function, with the secret read
from the function environment.

**Never a `VITE_*` variable.** Anything prefixed `VITE_` is compiled into the
client bundle and is public the moment it ships. The secret names in
`flightsProviders.ts` are deliberately not prefixed, and a supplier key must
never acquire one.

`flightsProviders.ts` holds secret **names** and no values. A test asserts the
file contains no `key: "…"`-shaped literal.

## What is never logged

- API keys, client secrets, access tokens, refresh tokens
- Authorization headers
- Payment credentials of any kind
- Passport numbers, dates of birth, full passenger records

A supplier error is logged by its code and slug. The supplier's raw response is
not logged wholesale, because that is where a token ends up.

CI logs on this repository are public.

## Payment

**No raw card number is stored, anywhere, ever.** Not in a table, not in a
column, not in a JSON blob, not in a log line.

There is no payment code in this section yet, and that is deliberate: a payment
integration is a decision about a PSP, a compliance posture and a data boundary,
and writing one speculatively is how card data ends up somewhere it should not
be. When it happens it goes through a provider that keeps the card off Visionex
infrastructure entirely.

No payment credential ever appears in a WhatsApp message.

## Travel documents

`flight_passengers` is service-role only — RLS enabled, no policy. This is the
single most sensitive table in the section.

`flight_bookings`, the table a traveller can read, carries no passenger
identity. So the readable surface holds none of it, and the sensitive surface
has no reader.

A passenger record is collected only at the point a ticket actually requires it
— `PASSENGER_FIELDS` is that boundary, and it is a short list on purpose.

## A real booking needs a real yes

`isExplicitConfirmation` is whole-message-only against a deliberately short
list. "Maybe", "I think so" and "how much again?" are all not-a-yes. The cost of
reading one of them as consent is a charge somebody did not agree to; the cost
of asking again is a message.

And a fare that moved between the yes and the charge invalidates the yes.
`priceChanged` reports movement in either direction, and the flow returns to
`offered`.

## Suppliers

- Never claim a supplier supports booking unless its current official
  documentation or approved partner access confirms it.
- Never scrape a supplier's website or app.
- Never automate unofficial consumer-app behaviour.
- Never bypass authentication, CAPTCHA, rate limits, geographic restrictions or
  accreditation requirements.
- A supplier defaults **off** until credentials and accreditation are verified.
  `enabled` is not in the seed's column list, so a supplier cannot arrive live
  through a typo.

## Reading the row you asked for

The pattern `mobility/index.ts` established and the flights router must follow:
a request for something that is not yours answers identically to a request for
something that is not there. A 404 that differs from a 403 is an enumeration
oracle.
