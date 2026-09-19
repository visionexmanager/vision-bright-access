# The VX system

One balance, one price list, one ledger, one reservation flow — used by the
website, WhatsApp and any future API client.

Status: **built, disabled, unmigrated.** Every service in
`central_pricing_registry` ships `enabled = false`, no legacy system has been
touched, and no wallet has been moved. Turning any of it on is a separate,
approved step.

## The one balance

`user_points` is the source of truth. The balance is `SUM(points)` — there is
no balance column, and `admin_adjust_vx` says so in its own header. It is
append-only: the client INSERT policy was dropped in `20260826000000`, so every
movement goes through a `SECURITY DEFINER` function.

`vx_balance(user_id)` is the one reader. A reservation is a **real debit** in
`user_points`, not a hold kept elsewhere — the same decision
`charge_file_conversion()` already took. A hold outside `user_points` would be
invisible to `SUM(points)` and therefore spendable twice: once by this system
and once by `spend_vx()`.

## The flow

```
request → central_pricing_registry → entitlement → vx_reserve → run → vx_settle → vx_usage_ledger
            price / free / limits     plan+ceiling   debit now   work  keep+refund     one row
```

`_shared/vx/meter.ts` is the single path all surfaces call. The work arrives as
an argument, so the module knows nothing about OpenAI, Hetzner or any GPU
provider. `vx_reap_stale_reservations()` runs every ten minutes and returns
holds nobody settled.

## WhatsApp

**Decided. Two populations, and only one of them has VX.**

### A linked number — same everything as the website

A WhatsApp number linked to an `auth.users` account through
`whatsapp_identities` (identity proved by a code emailed to the account, never
by matching a phone number) is the *same customer* as the website session. It
therefore uses:

- the same balance — `user_points`, via `vx_balance()`
- the same price list — `central_pricing_registry`
- the same reserve / settle / refund — `vx_reserve`, `vx_settle`, `vx_release`
- the same ledger — `vx_usage_ledger`, with `source = 'whatsapp'`

`source` is the whole reason there is no second wallet: one ledger answers
"what did WhatsApp cost this month" without a second table to keep in step.

The natural idempotency key is Meta's `wa_message_id`, which the webhook
already dedupes on — a redelivered message must not reserve twice.

### An unlinked number — no VX, and no invented identity

A number with no `auth.users` row **keeps the existing count-based quota** and
nothing changes for it:

- `whatsapp_entitlements()` — free floor of 20 metered operations a day
- `whatsapp_meter()` → `whatsapp_usage`
- the existing abuse limiter, repeat-message guard and daily ceilings

It is **not** given a VX wallet, an anonymous balance, a placeholder
`auth.users` row or a synthetic identity. There is nowhere honest to put one:
VX belongs to an account, `user_points.user_id` references `auth.users`, and
inventing a subject to hang a balance on would be the second VX system this
work exists to remove — and a stranger's phone number is not an account.

The route from one population to the other already exists: link the account,
and the next message is billed centrally.

### What this means in practice

| | Linked | Unlinked |
| --- | --- | --- |
| Balance | `user_points` (shared with web) | none |
| Gate | `central_pricing_registry` | `whatsapp_entitlements` |
| Record | `vx_usage_ledger` (`source='whatsapp'`) | `whatsapp_usage` |
| Abuse controls | unchanged | unchanged |

`whatsapp_usage` stays either way: it is the anti-abuse counter, not a wallet,
and it is what protects a number that cannot be billed.

## What a user may see, and what they may not

Both `central_pricing_registry` and `vx_usage_ledger` are **admin-read**. A
user reaches them through column lists, not policies:

- `vx_price_list()` — service, price, free allowance. No `base_cost`, no `provider`.
- `my_vx_usage()` — their own rows. No `provider`, no `actual_cost_usd`.

`provider` and `base_cost` are commercial detail. A customer who can read the
cost of a generation can work backwards to the margin on their own plan.

## Where a future provider fits

`meter()` takes the work as a promise. A GPU provider is a different `run`, and
nothing in the billing path changes to accommodate one. Provider *selection* is
a separate concern and belongs in `_shared/providerRouter.ts` over
`ph_providers` — see `.claude/references/` and the audit in PR discussion; it
is not wired to anything today.

## What has NOT been done

- No service is enabled.
- No wallet has been migrated. `vx_wallet_parity_report()` is the read-only
  decision input; `vx_migrate_wallet_balances()` exists, defaults to a dry run,
  and is called by nothing.
- No consumer calls `meter()` yet.
- The legacy systems — `credit_wallets` + `billing_consume`, `spend_vx` +
  `charge_file_conversion`, `whatsapp_usage` — are all still in place and
  untouched.
