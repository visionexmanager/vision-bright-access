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
only listings from shops that are active, not on holiday, and in stock.
`visionex-assistive-guide` reads a committed snapshot of the assistive
equipment reference. All three are `internal`, so none is marked up and all are
searched before anything external is considered.

The guide is the source that answers when nothing else can: no key, no
approval, no network call. 21 researched equipment types with the range the
market charges, snapshotted from `src/data/assistiveProducts.ts` by
`scripts/generate-assistive-index.ts` — regenerate after editing the reference,
or `src/test/assistive-index.test.ts` fails on the drift.

It reports a **range and no price**, and every result is
`requires_sourcing_confirmation`. These are equipment types, not listings:
nobody is holding one and nobody has quoted one today. Quoting the bottom of a
$500–$2,500 range as the price, and then adding a margin to it, would put a
number on the screen that nobody can honour — so the pricing engine's "no
source price" path is used deliberately, and the range is carried to the
customer instead, on the web and over WhatsApp.

Arabic asks in the plural. "شاشات بريل" is not a substring of "شاشة بريل" in
either direction, so the guide folds the interchangeable letter forms and
strips the definite article and the common plural endings before matching —
never below three characters, which is the floor this codebase learned to keep.
Zero width joiners are left alone: they carry meaning in Persian and Urdu.

A VXBazaar listing may be priced in cash, in VX, or in both. Cash is taken
literally; a VX-only listing is converted at the platform rate (1000 VX = 1
USD), because that number is not an estimate — it is what the wallet is
charged. A listing with neither is reported with no price rather than a guess.

**External, adapters written, none switched on.** Five merchants, each through
the only mechanism its owner permits. Every one is inert without its own
secrets, and every one still has to pass the terms review before its row can go
`active`.

| Source | Mechanism | Secrets | What stands in the way |
| --- | --- | --- | --- |
| `ebay` | Browse API, `EBAY_US` so prices arrive in USD | `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET` | App keys are free and immediate. The licence expects attribution and a link back — see below. |
| `amazon` | PA-API 5.0, SigV4 signed | `AMAZON_PAAPI_ACCESS_KEY`, `AMAZON_PAAPI_SECRET_KEY`, `AMAZON_PARTNER_TAG` | Access needs an Associates account that has already made qualifying sales. The slowest of the five; the code is not the obstacle. |
| `aliexpress` | Affiliate open platform | `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` | Affiliate account. The signature has never run against the live gateway — verify it in the sandbox. |
| `alibaba` | Open platform, same gateway family | `ALIBABA_APP_KEY`, `ALIBABA_APP_SECRET` | Approval, plus confirming the endpoint and signature variant. |
| `shein` | Product feed | optional bearer token via `config.auth_ref` | No public product API exists. Reached through an affiliate network's feed. |

**The resale model.** Visionex buys from the supplier and sells to the
customer, so `attribution_required` is false on all of them: the customer sees
a product, a price and a VX reference, never a merchant. The pricing engine
adds the margin — 15% on new, 18% on used, 16% on refurbished, each an editable
row in `pricing_rules`.

That is a business decision with a licence question attached, and the question
is real: eBay's API agreement expects listing data to be shown with attribution
and a link back, and Amazon's mandates attribution too. Whoever records the
terms review is the person answering it. Setting `attribution_required` back to
true on a row is all it takes — `projectForCustomer()` then names the merchant
and shows the link, with no code change.

**Switching one on**, once its secrets are set:

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

**Adding a merchant with no API.** Give it a row with
`access_method = 'product_feed'`, put the feed URL in `base_url`, and describe
the feed in `config`:

```json
{
  "fields": {
    "resultPath": "items",
    "title": "name",
    "price": "sale_price",
    "currency": "currency",
    "url": "link",
    "id": "sku",
    "image": "image_url"
  },
  "auth_ref": "PARTNER_FEED_TOKEN"
}
```

No deploy: `productFeed.ts` already serves every row shaped like that. A feed
is a snapshot, so its results are `requires_sourcing_confirmation` — somebody
checks the item is still there at that price before we promise it.

**Still unverified, no adapter.** `olx`, `assistive-800`. Classifieds and
specialist distributors, both needing a per-country or per-supplier agreement
rather than an API key.

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

- No external source is active. Five have adapters and wait on credentials and
  a terms review; `olx` and `assistive-800` have neither.
- No signature has been exercised against a live gateway. eBay's OAuth and
  Amazon's SigV4 follow published specifications and the AWS key derivation is
  cross-checked against an independent implementation in the suite, but the
  first real call is still the first real call.
- No scraping of any kind.
- No customer-facing UI yet — `ai-source-products` returns JSON; the numbered
  result view (spec §10) is Phase 1 remaining work.
