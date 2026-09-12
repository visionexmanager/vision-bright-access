# Mobility audit — what Visionex already has, and what mobility must not rebuild

Phase 1. Written before any mobility code, and the reason the design below looks
the way it does.

## What exists, and what mobility reuses rather than rebuilds

| Concern | Where it lives | Mobility's decision |
| --- | --- | --- |
| Edge Functions | `supabase/functions/*` — **97 of them** | **Add at most one.** See the ceiling below. |
| Shared server modules | `supabase/functions/_shared/*.ts` | `mobility.ts`, `mobilityProviders.ts` join them |
| WhatsApp assistant | `whatsapp-webhook` + ~60 `_shared/whatsapp*.ts` | Extend. Never a second bot. |
| WhatsApp menus | `whatsappCatalog.ts`, `whatsappInteractive.ts` | A catalog node + interactive rows — no numeric menus |
| Geocoding / reverse | `_shared/whatsappGeo.ts` (`geocodePlace`, `reverseGeocode`) | **Reuse.** No second geocoder. |
| Shared location | `_shared/whatsappLocation.ts` | Reuse for shared pins |
| Web services catalog | `src/features/servicecenter/catalog.ts` | Add a mobility entry here |
| Web i18n | `src/i18n/*.ts` (22 files) | Reuse. No hard-coded strings. |
| WhatsApp i18n | `whatsappStrings.ts` + `whatsappStringsLocales.ts` (20 locales) | Reuse. Every key in all 20, no fallback. |
| AI provider chain | `_shared/aiProvider.ts`, `assistants.ts` | Reuse for intent parsing |
| Payments | Stripe / PayPal / crypto per service, `billing-engine` | **Not used yet** — most mobility providers charge the rider directly |
| Auth | Supabase auth, `AuthGuard`, `auth.uid()` in RLS | Reuse |
| Testing | Vitest, 196 files, 3768 tests | Same suite |
| Deployment | `.github/workflows/deploy.yml` → CI gate → migrations + changed functions | Same path |
| Migration conventions | Timestamped, additive, `IF NOT EXISTS`, RLS on, service-role-only where the contents are an implementation detail | Followed |

## Three constraints that shaped the design

### 1. The Edge Function ceiling — 97 of 100

`.claude/skills/supabase/SKILL.md`:

> Extend an existing function before adding one. The project is near the
> hundred-function ceiling, where a new function fails with a billing error that
> reads like a bundling error.

The master prompt's §23 proposes up to nine mobility functions
(`mobility-search`, `mobility-quotes`, `mobility-book`, `mobility-status`,
`mobility-cancel`, `mobility-webhook`, `mobility-provider-health`,
`mobility-oauth-start`, `mobility-oauth-callback`). **That would take the project
to 106 and break deployment.**

**Decision: one `mobility` Edge Function with an action router**, in the shape
the repository already uses elsewhere, leaving headroom rather than consuming it.
OAuth callback and provider webhooks are actions on the same function, routed by
path segment. This is recorded here because it is a deliberate departure from the
prompt, made to keep deployment working.

### 2. No provider credentials

Nothing in this environment has an Uber client id, secret or sandbox key. So no
integration can be exercised, and §40 (sandbox testing) cannot be done here.

**Decision:** every decision that does not need a provider — ranking, expiry, the
state machine, confirmation, currency, time zones, failover, idempotency — is a
pure function with tests. That is what makes the platform testable before a
signature, which is the only kind of testing available until one exists.

### 3. Provider documentation is unreachable from this environment

The egress proxy blocks provider documentation domains:

```
WebFetch https://developer.uber.com/docs/riders/introduction
  → EGRESS_BLOCKED
```

§42 requires reading current official documentation before implementing a
provider; §43 forbids inventing endpoints. Both cannot be satisfied at once from
here, and §43 wins.

**Decision:** every provider ships `not_researched` and `shape: "none"` except
Uber, whose single established fact (Riders API requires approval) is recorded
along with what is *not* established. A test asserts that the only URL in the
provider module is a documentation link.

## What was built

| File | What it is |
| --- | --- |
| `supabase/migrations/20261009000000_mobility_core.sql` | 8 tables, RLS on all, 4 user policies, a public provider view, 12 seeded providers all disabled |
| `supabase/functions/_shared/mobility.ts` | Normalized model, state machine, error taxonomy, ranking, money, time zones, confirmation |
| `supabase/functions/_shared/mobilityProviders.ts` | Provider interface, capability records, registry, concurrent quoting with per-provider deadlines |
| `src/test/mobility-core.test.ts` | 54 tests |
| `docs/mobility/providers.md`, `uber.md` | What is established and what is not |

The migration was executed twice under PGlite before being committed — the
repository's rule, because `db push` in the deploy is otherwise the first thing
that ever parses the file.

## What was not built

Named plainly rather than left to be discovered:

- The `mobility` Edge Function and its action router
- Provider adapters with real calls — blocked on §42/§43 above
- The web booking UI and `My Trips`
- The WhatsApp booking flow, its catalog node and its 20-locale strings
- Intent parsing (`MOBILITY_BOOK`) against the existing AI chain
- Deeplink builders — these need each provider's documented link format
- Admin dashboard, commission activation, airport/flight awareness, repeat trip

The foundation is what everything above hangs off: the schema they write to, the
states they move through, the errors they surface, and the seam they plug into.
