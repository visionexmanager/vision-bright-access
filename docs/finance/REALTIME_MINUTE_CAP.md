# Monthly realtime voice minutes

A per-plan monthly allowance of realtime voice minutes. **Shipped switched off**: the migration sets no value, so merging and deploying it changes nothing for anybody.

## Why

A realtime session runs browser to OpenAI over WebRTC, so the server never sees its tokens, and the only existing limit was how many sessions may *start* (10 a day). A session had no length limit and OpenAI bills audio tokens (about $0.10 a minute at gpt-realtime-2 audio rates plus transcription). See `VISIONEX_SUBSCRIPTION_PROFITABILITY_AUDIT.md`.

## How it works

1. `realtime-session` reserves up to `realtime_session_minutes` (default 10) from the user's UTC month (`realtime_reserve`), after the subscription gate and the daily unit and before OpenAI is asked for a session. A spent month answers 429 with a fixed sentence.
2. The response carries `reservation_id`, `session_minutes` and `remaining_minutes` when a cap applies. The app disconnects at `session_minutes`.
3. On disconnect the app sends `{action:"end", reservationId}`. `realtime_end` shrinks the reservation to the **server's** elapsed time, rounded up to a minute. The client's own duration is not an input, so it cannot report less than really passed. A session never reported stays charged in full. If OpenAI refuses the session, the reservation is released at no cost.

## Settings (`billing_plans.limits`)

| Key | Meaning |
|---|---|
| `realtime_monthly_minutes` | absent = no cap (today); `0` = no realtime voice on that plan; `N` = N minutes per UTC month |
| `realtime_session_minutes` | absent = 10; longest single session |

Suggested starting values from the audit (about 20% of net subscription revenue at $0.102/minute): Kids 0, Basic 10, Pro 20, Business 40. Not applied.

```sql
-- turn on
UPDATE billing_plans SET limits = limits || '{"realtime_monthly_minutes": 20}'::jsonb WHERE id = 'pro';
-- turn off (rollback)
UPDATE billing_plans SET limits = limits - 'realtime_monthly_minutes' - 'realtime_session_minutes' WHERE id = 'pro';
```

Admins are never capped. A garbage (non-numeric) value is treated as no cap.

## Limits of this design

It bounds what the server hands out. It cannot end a session already running: a modified client can ignore the timer and keep talking until OpenAI ends the session, and the unreported reservation then stands as the charge. A hard cut-off needs a relay in the media path.

## Rollback

Remove the key (above). To remove the code path, revert the PR; `realtime_sessions` and the two functions are additive and can stay. If the function is deployed before the migration is applied, `realtime-session` fails closed (503), so keep the pipeline's migrations-then-functions order.
