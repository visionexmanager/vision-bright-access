# What replaced what, in VX

One balance, one price list, one ledger. This is the map from the old shapes to
the new ones, and what has actually been removed versus what is merely no
longer used.

## The replacement

| Old | New |
| --- | --- |
| `credit_wallets.balance_vx` | `user_points` — balance is `SUM(points)`, read through `vx_balance()` |
| `billing_consume()` | `vx_reserve()` then `vx_settle()` |
| `billing_refund()` | `vx_settle()` with a smaller `consumed_vx`, or `vx_release()` |
| `usage_logs` | `vx_usage_ledger` |
| `billing_rules` (3 rows) | `central_pricing_registry` (every price, allowance, plan limit and ceiling) |
| `charge_file_conversion()`'s inline prices | `central_pricing_registry` |
| `admin_give_vx()` | `admin_adjust_vx()` — **removed**, see below |
| `credit_transactions` | `user_points` rows (`VX reserve: …` / `VX refund: …`) + `vx_usage_ledger` |

## Why there was nothing to migrate

Read from production on 2026-09-19 through `vx-parity-inspect.yml`, read-only:

```
credit_wallets:       6 rows, all 0 VX,  total 0
credit_transactions:  0 rows
usage_logs:           0 rows
user_points:         17 accounts, 6,123 VX
profiles.vx_balance:  column does not exist
```

The wallet system was initialised — `billing_initialize_user()` created the six
rows — and then never used, because nothing ever called `billing_consume()`.
There is no value on that side to move, no accounting relationship to prove and
no reconciliation to do. `vx_migrate_wallet_balances()` selects
`WHERE balance_vx > 0`, so it would credit zero accounts and zero VX.

`usage_logs` being empty is the same fact from the other end: it is why the
Usage page has shown every user a blank history since it was built.

## What has been removed

- **`admin_give_vx()`** — dropped in `20261027000000`. It wrote
  `profiles.vx_balance`, a column that does not exist, so it raised on every
  call after passing its admin check. Repairing it would have meant creating a
  second VX balance.
- **`useCreditConsume()`** (`src/hooks/useCredits.ts`) and
  **`consumeCredits` / `refundCredits`** (`billingService.ts`) — no screen ever
  imported them. Client-side code that charges VX is the shape this phase
  exists to prevent, so they are gone rather than left for somebody to find.
- **`billing-engine` actions `consume`, `check_and_consume`, `refund`,
  `grant_credits`** — answered with a 410 naming the replacement, in the same
  style the already-closed `upgrade` action uses. An action that returns
  "unknown" invites a retry; one that names its replacement does not.

## What has NOT been removed, and why

**No table has been dropped and no SQL function that touches data has been
dropped**, apart from `admin_give_vx`, which could not touch data.

Still in place: `credit_wallets`, `credit_transactions`, `usage_logs`,
`billing_consume()`, `billing_refund()`, `billing_grant_credits()`,
`billing_get_status()`, `billing_initialize_user()`, `billing_rules`.

They stay until the new system has run in production long enough to be trusted.
Dropping them is cheap later and irreversible now, and the six zero-balance
wallet rows cost nothing to keep. The rollback for all of Phase 1 is "stop
calling the new functions", which only works while the old ones still exist.

`billing-engine`'s `get_status`, `get_balance`, `get_history`,
`get_usage_logs`, `get_plans` and `cancel` also stay: the AI Media Studio
Billing screen reads them, and they answer honestly — with zeroes, because the
tables are empty.

## The one rule

There is one VX balance and it is `SUM(user_points.points)`.

Not `credit_wallets.balance_vx`, not `profiles.vx_balance` (which does not
exist), not a per-channel wallet, not an anonymous balance for an unlinked
WhatsApp number. A reservation is a real debit in `user_points`, so every
existing reader — `usePoints`, `spend_vx`, the Arcade — sees the truth without
knowing reservations exist.

If a centralized grant path is ever needed, it writes `user_points` **and** a
`vx_usage_ledger` row with `source='system'`. It does not introduce a column.
