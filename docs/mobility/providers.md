# Mobility providers — what is established, and what is not

**Every row in this file is either evidence or a gap. Nothing here is an
estimate.** A provider's row says what Visionex may actually do with it today,
and the registry in the database (`mobility_providers`) and in code
(`mobilityProviders.ts`) must agree with it.

## The rule

> If a provider's booking API requires partner approval, the adapter says so and
> returns `PROVIDER_REQUIRES_APPROVAL`. It does not POST to a URL that looks
> plausible.

A fabricated integration is worse than a missing one. A missing one is a gap
somebody can plan around. A fabricated one is a rider standing on a pavement
waiting for a car that was never requested.

## Research status: mostly outstanding, and why

Provider research requires reading each provider's **current official
documentation** — not a blog post, not a GitHub repository, not a summary.

**This could not be completed from the session that built this foundation.** The
network egress proxy in the build environment blocks provider documentation
domains:

```
WebFetch https://developer.uber.com/docs/riders/introduction
  → EGRESS_BLOCKED: Access to developer.uber.com is blocked by the
    network egress proxy.
```

Web *search* was available and returned consistent summaries; opening the
official pages was not. So one fact about Uber is recorded below because search
results agreed on it and it is a negative claim (access is restricted), and
nothing else is asserted for any provider.

**What this means in practice:** every provider below is `not_researched` except
Uber, every adapter ships with `shape: "none"`, and no adapter can be called.
Filling this table in is a task for an environment that can reach these domains,
or for a person with the documentation open.

## The table

| Provider | Status | Quote | Book | Track | Cancel | Verified |
| --- | --- | --- | --- | --- | --- | --- |
| Uber | `manual_partner_required` | — | — | — | — | see below |
| Bolt | `not_researched` | — | — | — | — | never |
| Lyft | `not_researched` | — | — | — | — | never |
| Grab | `not_researched` | — | — | — | — | never |
| DiDi | `not_researched` | — | — | — | — | never |
| Cabify | `not_researched` | — | — | — | — | never |
| FREE NOW | `not_researched` | — | — | — | — | never |
| Gett | `not_researched` | — | — | — | — | never |
| Yango | `not_researched` | — | — | — | — | never |
| inDrive | `not_researched` | — | — | — | — | never |
| Careem | `not_researched` | — | — | — | — | never |
| Splyt (aggregator) | `not_researched` | — | — | — | — | never |

`—` means *not established*, never *no*.

### Uber

Search of Uber's developer material in September 2026 is consistent on one
point: **the Riders API is not open access.** Uber's documentation states that
access requires approval and that an applicant must go through an Uber
business-development contact.

That makes Uber `manual_partner_required`. It is recorded that way in the
registry, the seed and the capability record.

Nothing further is asserted — no endpoint paths, no OAuth scope names, no
request or response shapes, no sandbox behaviour. See `uber.md` for what
Visionex must submit and what must be verified once the documentation can be
read.

## The questions each row must answer

Before a provider's status moves off `not_researched`, answer all thirteen and
record the answers here with the date and the URL you read:

1. Does an official API exist?
2. Is it public?
3. Can third-party apps request rides?
4. Does it require partner approval?
5. Is OAuth required?
6. Is there a sandbox?
7. Can Visionex obtain quotes?
8. Can Visionex book?
9. Can Visionex track?
10. Can Visionex cancel?
11. Does the provider support deeplinks?
12. What countries and cities are covered?
13. What commercial agreement is required?

## Turning a provider on

Four things, in order. Skipping any of them is how a provider goes live without
approval.

1. Research it — the thirteen questions, recorded here with `last_verified_at`.
2. Write the adapter against the documentation you read, and set `shape` and the
   capability booleans to exactly what it supports.
3. Put its secrets in Supabase (never in a `VITE_` variable — those reach the
   browser).
4. Set `enabled = TRUE` on its row in `mobility_providers`. This is the only
   step that makes a provider reachable, it needs no deploy, and it is
   reversible on a Sunday by somebody who is not shipping a release.
