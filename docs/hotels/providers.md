# Hotel suppliers — what is established, and what is not

**Every row in this file is either evidence or a gap. Nothing here is an
estimate.** A supplier's row says what Visionex may actually do with it today,
and the registry in the database (`hotel_suppliers`) and in code
(`hotelsProviders.ts`) must agree with it.

## The rule

> Where a supplier's API has not been read from its current official
> documentation, the row says `not_researched` and the adapter has no methods at
> all.

A fabricated integration is worse than a missing one. A guest told a room is
held when nothing was sent anywhere arrives at a front desk at midnight, in a
city they do not live in, and is told there is no reservation in that name.

## Research status: outstanding, and why

Supplier research means reading each supplier's **current official
documentation** — not a blog post, not a GitHub repository, not a summary.

**This could not be done from the session that built this foundation.** The
network egress proxy blocks supplier documentation domains, exactly as it
blocked `duffel.com` during the flights work and `developer.uber.com` during
mobility. So **no endpoint, path, scope, parameter or request shape appears
anywhere in `hotelsProviders.ts`**, and every supplier below is
`not_researched` with every capability `false`.

Filling this table in is work for an environment that can reach these domains.
It is listed here as outstanding rather than guessed at.

## The registry

All six seeded `enabled = FALSE`, `integration_status = 'not_researched'`,
`contract_required = TRUE`.

| Slug | Kind | Status | Why it is here |
| --- | --- | --- | --- |
| `hotelbeds` | bed_bank | `not_researched` | Contracted wholesale inventory at scale. |
| `amadeus` | gds | `not_researched` | Hotel content beside the air business already registered for flights. |
| `sabre` | gds | `not_researched` | As above. |
| `expedia` | aggregator | `not_researched` | Wide retail inventory behind one contract. |
| `booking` | aggregator | `not_researched` | Coverage in markets the bed banks reach thinly. |
| `travelgate` | aggregator | `not_researched` | One connection in front of many suppliers. |

`amadeus` and `sabre` appear here *and* in `flight_suppliers`. Separate rows on
purpose: one contract does not imply the other, and a row that is live for air
must not read as live for hotels.

The `kind` column is load-bearing. A bed bank and a metasearch engine both "have
hotels"; only one of them can confirm a reservation.

## What moves a row off `not_researched`

In order. Each step is a person's work, not a code change.

1. **Open an account and agree commercial terms.** Wholesale hotel inventory is
   sold under contract, not by signup.
2. **Read the current official documentation.** Record what search, re-price,
   booking and cancellation actually require.
3. **Confirm the supplier reports desk-collected fees separately.** Without this
   there is no honest all-in price, and `canSellStays` will refuse the supplier
   regardless of everything else.
4. **Test environment.** Exercise search, re-price, book and cancel there. Never
   in production.
5. **Confirm what the contract permits** — display terms, rate parity,
   cancellation terms — before any production sale.
6. **Then** set the capability flags, set `lastVerified`, and only then enable
   the row.

## What the code will not let you skip

`isSupplierCallable` refuses a supplier that is `not_researched`, and refuses
one whose `contractRequired` is still true **however many keys are set**.
Clearing that flag is a deliberate edit by whoever did the paperwork.

`canSellStays` additionally refuses any supplier that cannot `reprice` and
report a `feeBreakdown`.

A test asserts that today, with every named secret set to a value, not one
supplier is callable for any action.

## Secrets

The capability records name environment variables and never hold values:

| Supplier | Names |
| --- | --- |
| `hotelbeds` | `HOTELBEDS_API_KEY`, `HOTELBEDS_SECRET`, `HOTELBEDS_ENVIRONMENT` |
| `amadeus` | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENVIRONMENT` |
| `sabre` | `SABRE_CLIENT_ID`, `SABRE_CLIENT_SECRET`, `SABRE_ENVIRONMENT` |
| `expedia` | `EXPEDIA_API_KEY`, `EXPEDIA_SHARED_SECRET`, `EXPEDIA_ENVIRONMENT` |
| `booking` | `BOOKING_AFFILIATE_ID`, `BOOKING_API_KEY`, `BOOKING_ENVIRONMENT` |
| `travelgate` | `TRAVELGATE_API_KEY`, `TRAVELGATE_ENVIRONMENT` |

None is a `VITE_*` variable and none may ever become one. See
[security.md](./security.md).
