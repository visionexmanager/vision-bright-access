# Uber

**Integration status: `manual_partner_required`. Not callable. Not enabled.**

## What is established

Search of Uber's developer material in September 2026 is consistent on one
point, and it is the point that decides the architecture:

> Access to Uber's Riders API requires approval from Uber. As part of Uber's
> privacy changes to the Developer API program, third-party applications must
> contact an Uber business-development representative to obtain access.

Uber's developer portal is at <https://developer.uber.com/docs/>.

That is a negative claim — *this is not open access* — and it is the only Uber
fact this repository acts on. It is why `UBER.shape` is `"none"`, why the
adapter implements no `getQuotes` and no `book`, and why the seeded row is
`manual_partner_required` and disabled.

## What is NOT established

The official documentation pages could not be opened from the environment that
built this (the network egress proxy blocks `developer.uber.com`). So **none of
the following is written anywhere in this codebase**, and none of it may be
written until somebody has read the current documentation:

- endpoint paths
- OAuth scope names
- request or response shapes
- sandbox behaviour and its differences from production
- rate limits
- webhook event names or signature scheme
- which of Uber's integration paths (Riders API, deeplinks, embedded, or an
  agentic/MCP pathway) is the right one for Visionex

Anything in the list above that appears in a future commit must arrive with the
URL it was read from and the date it was read.

## What Mohammad must do

These are the steps that cannot be done from a repository. They are recorded in
the capability record as `approvalSteps` so they travel with the code:

1. **Request Riders API access** through an Uber business-development
   representative. Uber's developer program does not grant this on self-signup.
2. **Register the redirect URI** for the Visionex application against whatever
   Uber approves.
3. **Obtain sandbox credentials** and exercise quote, booking, status and
   cancellation there — no production request before that passes.

Until step 1 completes, there is nothing for this repository to do about Uber
beyond what is already here: the adapter shape, the registry row, and the
refusal that carries `PROVIDER_REQUIRES_APPROVAL`.

## Secrets

Named in the capability record, read only server-side, and **never** as `VITE_`
variables — those are compiled into the browser bundle:

| Variable | Purpose |
| --- | --- |
| `UBER_CLIENT_ID` | OAuth client identifier |
| `UBER_CLIENT_SECRET` | OAuth client secret — server only |
| `UBER_REDIRECT_URI` | Must match what Uber has registered |
| `UBER_ENVIRONMENT` | `sandbox` or `production` |

A test asserts that no required secret name starts with `VITE_`.

## What happens today if a rider asks for an Uber

`gatherQuotes` sees an adapter with no `getQuotes`, contributes no quotes, and
reports `{ slug: "uber", code: "PROVIDER_REQUIRES_APPROVAL" }`. No network call
is made, no timeout is spent, and the rider is told Visionex cannot book that
provider rather than being shown a price that does not exist.

That behaviour has a test.
