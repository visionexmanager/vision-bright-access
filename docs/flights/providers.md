# Flight suppliers — what is established, and what is not

**Every row in this file is either evidence or a gap. Nothing here is an
estimate.** A supplier's row says what Visionex may actually do with it today,
and the registry in the database (`flight_suppliers`) and in code
(`flightsProviders.ts`) must agree with it.

## The rule

> Where a supplier's API has not been read from its current official
> documentation, the row says `not_researched` and the adapter has no methods at
> all.

Selling an air ticket is not like calling a weather API. A fabricated request
against a GDS is at best a 401 and at worst a malformed booking in a live
reservation system. A traveller told a seat is held when nothing was sent
anywhere arrives at an airport without a ticket, and there is no recovery from
that at 04:00 in a departures hall.

## Research status: outstanding, and why

Supplier research means reading each supplier's **current official
documentation** — not a blog post, not a GitHub repository, not a summary.

**This could not be done from the session that built this foundation.** The
network egress proxy in the build environment blocks supplier documentation
domains:

```
WebFetch https://duffel.com/docs
  → EGRESS_BLOCKED: Access to duffel.com is blocked by the
    network egress proxy.
```

The same block that stopped `developer.uber.com` during the Mobility work.

So **no endpoint, path, scope, parameter or request shape appears anywhere in
`flightsProviders.ts`**, and every supplier below is `not_researched` with every
capability `false`. Filling this table in is work for an environment that can
reach these domains, and it is listed here as outstanding rather than guessed
at.

## The registry

All six are seeded `enabled = FALSE`, `integration_status = 'not_researched'`,
`accreditation_required = TRUE`.

| Slug | Kind | Status | Why it is here |
| --- | --- | --- | --- |
| `duffel` | aggregator | `not_researched` | One contract in front of many airlines. |
| `amadeus` | gds | `not_researched` | Inventory and ticketing at GDS scale. |
| `sabre` | gds | `not_researched` | As above. |
| `travelport` | gds | `not_researched` | As above. |
| `kiwi` | aggregator | `not_researched` | Wide coverage, distinct fare construction. |
| `travelfusion` | aggregator | `not_researched` | Low-cost-carrier reach the GDSs lack. |

The `kind` column is load-bearing. A GDS and a metasearch engine both "have
flights"; only one of them can issue a ticket.

## What moves a row off `not_researched`

In order. Each step is a person's work, not a code change.

1. **Read the current official documentation.** Record what search, re-price,
   booking, ticketing and cancellation actually require.
2. **Accreditation.** Every GDS requires a travel-agency accreditation before it
   will issue a ticket. This is a legal and financial process, not a signup.
3. **Contract and credentials.** Signed agreement, then credentials issued
   against the Visionex application.
4. **Test environment.** Exercise search, re-price, book, ticket and cancel
   there. Never in production.
5. **Certification**, where the supplier requires it.
6. **Then** set the capability flags, set `lastVerified`, and only then enable
   the row.

`approvalSteps` on each capability record carries this list, at the level it is
actually known.

## What the code will not let you skip

`isSupplierCallable` refuses a supplier that is `not_researched`, and refuses
one whose `accreditationRequired` is still true **however many keys are set**.
Clearing that flag is a deliberate edit by whoever did the paperwork.

`canSellTickets` additionally refuses any supplier that cannot `reprice`,
`book` and `ticket` together.

A test asserts that today, with every named secret set to a value, not one
supplier is callable for any action.

## Secrets

The capability records name environment variables and never hold values:

| Supplier | Names |
| --- | --- |
| `duffel` | `DUFFEL_API_KEY`, `DUFFEL_ENVIRONMENT` |
| `amadeus` | `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENVIRONMENT` |
| `sabre` | `SABRE_CLIENT_ID`, `SABRE_CLIENT_SECRET`, `SABRE_ENVIRONMENT` |
| `travelport` | `TRAVELPORT_CLIENT_ID`, `TRAVELPORT_CLIENT_SECRET`, `TRAVELPORT_ENVIRONMENT` |
| `kiwi` | `KIWI_API_KEY`, `KIWI_ENVIRONMENT` |
| `travelfusion` | `TRAVELFUSION_LOGIN_ID`, `TRAVELFUSION_PASSWORD`, `TRAVELFUSION_ENVIRONMENT` |

None of these is a `VITE_*` variable and none may ever become one. See
[security.md](./security.md).
