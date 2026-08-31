# AI Commerce Agent — sourcing architecture

Phase 1 foundation. **One source is live: the Visionex catalogue.** Every
external vendor is registered as a checklist row, disabled, until someone
verifies its terms.

## How a request flows

```
customer text
  → parseIntent()        category, condition, budget, keywords  (router.ts)
  → routeSources()       Visionex first, then permitted sources by fit
  → collectFromSources() adapters in parallel, failures degrade not fail
  → calculatePrice()     pricing_rules, never a prompt          (pricing.ts)
  → deduplicate()        same product across suppliers collapses
  → rank()               Visionex stock and in-budget results rise
  → groupByCondition()   new / used / refurbished kept apart
  → projectForCustomer() supplier identity removed              (confidentiality.ts)
```

Visionex is always searched first, and external sources are only consulted
when the catalogue does not already answer the question
(`internalIsSufficient`). Results are capped at ten and **never padded** — if
four honest matches exist, four are returned.

## Adding a source

A source has two halves and both are required:

1. **A row in `sourcing_sources`** — decides *whether* and *when* it is asked.
   An admin manages this; no deploy needed.
2. **An adapter in `_shared/sourcing/registry.ts`** — decides *how*. A row with
   no adapter is skipped with a log line, never guessed at.

Before setting a row to `active`, record the terms review. The database
enforces this: `sourcing_sources_active_requires_review` rejects an active
non-internal source unless `terms_reviewed_at` is set and
`commercial_reuse_allowed` is true.

Checklist per the spec, in order of preference:

| Question | Column |
| --- | --- |
| Is there an official API? | `access_method = 'official_api'` |
| Failing that, a product feed or approved affiliate API? | `'product_feed'` / `'affiliate_api'` |
| Does the licence permit commercial reuse of listing data? | `commercial_reuse_allowed` |
| Must the merchant be named? | `attribution_required` |
| Rate limit? | `rate_limit_per_hour` |
| Where are the terms? | `terms_url`, `terms_notes` |

**Uncontrolled scraping is not an option.** `access_method` has no value for
it. `permitted_search` exists only for sources whose terms explicitly allow
programmatic search.

## Sources

**Active, internal.** `visionex-catalog` reads `products`, the curated
catalogue, through the semantic index. `visionex-bazaar` reads
`bazaar_products` — what shops on VXBazaar have actually listed — and returns
only listings from shops that are active, not on holiday, and in stock. Both
are `internal`, so neither is marked up and both are searched before anything
external is considered.

A VXBazaar listing may be priced in cash, in VX, or in both. Cash is taken
literally; a VX-only listing is converted at the platform rate (1000 VX = 1
USD), because that number is not an estimate — it is what the wallet is
charged. A listing with neither is reported with no price rather than a guess.

**Prepared, not switched on.** `ebay` has an adapter — Browse API, application
token, the `EBAY_US` marketplace so prices arrive in USD — and is inert without
its credentials. To switch it on:

1. Create eBay production app keys. Doing so is the acceptance of the API
   licence, which is what the terms review records.
2. Set `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET` as Edge Function secrets.
3. Record the review and activate:

```sql
UPDATE public.sourcing_sources
   SET terms_reviewed_at = now(),
       terms_reviewed_by = '<admin user id>',
       commercial_reuse_allowed = true,
       status = 'active'
 WHERE slug = 'ebay';
```

The database refuses that update without the review columns beside it, so an
external source cannot go active on a migration's say-so.

eBay results carry `attribution_required`, so the customer sees eBay's name and
eBay's link, and a pricing rule scoped to the source passes the listing price
through with no margin. These are recommendations, not resale.

**Still unverified.** `amazon`, `alibaba`, `shein`, `olx`, `assistive-800`. The
spec's examples captured as a to-do list with the known obstacle written into
`terms_notes` — Amazon's PA-API requires qualifying sales and mandates
attribution, and SHEIN has no confirmed public product API.

## Confidentiality and its limit

`projectForCustomer()` returns an **allow-list**: ref, title, brand, model,
category, specifications, condition, availability, price, currency. A field
added to the internal type later is invisible to customers until someone adds
it here deliberately.

The exception is encoded, not left to judgement: when
`attribution_required` is true the merchant **is** named. Confidentiality is a
business preference; a vendor's terms are a contract, and the contract wins.

## Pricing

`source price + shipping + fees + margin`, rounded, from the most specific
active rule in `pricing_rules`.

Three rules that are enforced in code and covered by tests:

- **No margin on used listings** unless `apply_to_used` is set. Visionex does
  not own that item, so marking it up by default invents a transaction.
- **No source price means no price.** Reported as null so the caller says
  "price on request" rather than guessing.
- **Internal catalogue results are already Visionex prices** and skip the
  margin engine entirely — otherwise we would mark up our own stock twice.

Margins never appear in a prompt. A test asserts `assistants.ts` contains no
margin at all, so the model cannot see or change pricing.

## Availability wording

Never blurred, because the promises differ:

| Value | Means |
| --- | --- |
| `in_visionex` | Visionex has it |
| `available_for_sourcing` | a verified supplier route exists |
| `external_recommendation` | we can point at it; we are not selling it |
| `requires_sourcing_confirmation` | plausible, a human must confirm |
| `unavailable` | no |

A marketplace listing is never described as Visionex stock.

## What is deliberately absent

- No external source is active. `ebay` has an adapter and waits on its
  credentials and its terms review; the rest have neither.
- No scraping of any kind.
- No customer-facing UI yet — `ai-source-products` returns JSON; the numbered
  result view (spec §10) is Phase 1 remaining work.
