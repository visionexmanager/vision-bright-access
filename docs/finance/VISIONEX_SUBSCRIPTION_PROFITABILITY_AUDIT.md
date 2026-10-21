# Visionex subscription profitability and unit-economics audit

As of 2026-10-21. Branch `claude/visionex-profitability-audit-847f84`. Read-only: no price, plan, VX balance, setting or production row was changed, no paid AI request was made, nothing was purchased.

**Evidence labels** used throughout: **[M]** measured (read from production tables today) · **[C]** read from source code · **[P]** a provider's published price (some via third-party trackers: flagged) · **[E]** estimate, a guess you should replace · **[U]** unknown, no data. Every number in the model lives in [`profitability-assumptions.json`](profitability-assumptions.json) with its label. Plan prices, monthly VX and WhatsApp caps are not copied there: the calculator ([`src/lib/finance/profitability.ts`](../../src/lib/finance/profitability.ts)) reads them from `src/lib/billing/plans.ts`, which stays the single source of truth.

---

## 1. Executive summary

1. **The business has no revenue yet.** Production has 0 active subscriptions, 20 accounts, 1 account inside its trial, and exactly 1 subscription order: a pending Business order for $20 via OMT **[M]**. Measured subscription revenue is **$0**. Everything below the "measured" line is a model.
2. **The plan prices in production are not the ones you described.** Production `billing_plans` and `plans.ts` agree with each other: Kids $3 / 3,000 VX, Basic $5 / 5,000 VX, **Pro $10 / 11,000 VX, Business $20 / 24,000 VX** **[M][C]**. You described Pro $7 / 12,000 and Business $10 / 30,000. Basic is as you described. Kids carries 3,000 VX, which you did not list. All are monthly prices; multi-month orders multiply the monthly price with no discount **[C]**. Nothing was changed.
3. **Known cost is almost entirely one server.** Supabase is on the **free** plan (read from the management API) **[M]**, so the database and Edge Functions cost $0 today but have no backups. The only recurring cost I can tie to a product is the Hetzner CCX23 media server, list price EUR 86.49/month ex VAT **[P]**, roughly $94 **[E]**. That alone explains most of your ~$100 figure. I could not match the $37.59 invoice to anything, so it is **not** used as a monthly cost.
4. **Measured AI spend is tiny and is not a guide to subscriber cost.** 207 recorded provider calls since 2026-09-28 cost **$1.04** priced **[M]**: 81% of that is five gpt-image-1 images from the owner's social publishing ($0.167 each, high quality). Gemini, Mistral and gpt-4o-mini-tts calls are recorded **unpriced**, so the real figure is higher.
5. **Per subscriber the model says:** a light or typical user earns money on every plan; a **heavy-but-permitted** user loses $20 to $200 a month, because the daily caps are far above what the price pays for. The plan tolerates only a small share of heavy users (Kids 10%, Business 7%, Basic 5%, **Pro 4%**).
6. **Break-even is 13 to 28 paying subscribers if almost nobody is a heavy user (2%), about 70 to 1,700 if 5% are, and never if 40% are** (stress case). Break-even depends on the heavy-user share more than on the subscriber mix.
7. **The largest unmanaged cost is WhatsApp**, not the website. Caps are 50 / 150 / 400 operations a day and **unlimited** for Business **[C]**, every answer can call a model, and Meta began charging per delivered service message on 2026-10-01 **[P, third-party, unverified]**. None of this is metered in VX.
8. **VX is not a cost control today.** Every row of `central_pricing_registry` is disabled **[M]**, so AI usage is in shadow mode: nothing is held or charged, and VX only moves for games and rewards. The subscription's VX allowance is therefore not what limits spending; plan gates and per-user rate limits are.

---

## 2. Verified subscription plans and allowances

| Plan | Intended (your message) | Production `billing_plans` [M] | `plans.ts` [C] | WhatsApp ops/day [C] | Sections [C] |
|---|---|---|---|---|---|
| Free trial | $0 | $0, 0 VX, 7 days | `TRIAL_SECTIONS` = free set | allowance for unlinked numbers | news, community, assistive only; **no AI service** |
| Kids | $3 | **$3, 3,000 VX** | $3, 3,000 | 50 | VisionKids + free set |
| Basic | $5, 5,000 VX | $5, 5,000 VX | $5, 5,000 | 150 | assistant, academy, library, arcade, marketplace |
| Pro | $7, 12,000 VX | **$10, 11,000 VX** | $10, 11,000 (10,000 + 10%) | 400 | + kids, career, TV, radio, messages, simulations |
| Business | $10, 30,000 VX | **$20, 24,000 VX** | $20, 24,000 (20,000 + 20%) | **unlimited** | + media studio, publishing, file studio, finance |

**Discrepancies to resolve (bold rows):** Pro and Business price and VX differ from your intended structure; Kids VX is not in your list. The bonus VX on Pro and Business means the VX allowance is worth **more than the price** at face value ($11 for $10, $24 for $20); see section 8.

**VX conversion.** $1 = 1,000 VX is `VX_PER_USD` in code **[C]**. Ad reward is 5 VX per view **[M]** (236 rows = 1,180 VX), capped at 10 ads a day by a check **in the browser only** **[C]**. Daily login pays 10 VX **[M]**, welcome bonus 100 VX **[M]**. Server-side, all self-awarded VX is capped at 2,000 VX/day per account **[C]** (`vx_self_award_take`).

**Payments.** There is no payment webhook for subscriptions: checkout is manual (OMT, Whish, or a card link), and an admin approves the order, which grants the VX **[C]**. So there is no cost incurred before payment is confirmed for a subscriber, and no automatic refund, dispute or fee data exists **[U]**.

---

## 3. Revenue per subscriber (model; measured subscription revenue is $0)

Net revenue = price − refunds − chargebacks − payment fees − FX − tax. Refunds, chargebacks, FX and tax are **[U]** and set to 0, so the figures below are an upper bound. Payment fee: only the card share (25% **[E]**) carries a fee (2.9% + $0.30 **[E]**); OMT and Whish fees are **[U]** and set to 0. Ad revenue, marketplace commission and other income are not measurable and are **not counted**.

| Plan | Price | Net revenue | Payment deduction |
|---|---|---|---|
| Kids | $3.00 | $2.90 | $0.10 |
| Basic | $5.00 | $4.89 | $0.11 |
| Pro | $10.00 | $9.85 | $0.15 |
| Business | $20.00 | $19.78 | $0.22 |

---

## 4. Fixed costs and how they are allocated (section 7 of the brief)

| Item | Monthly | Basis |
|---|---|---|
| Hetzner CCX23 VPS (SPA build, nginx, media processor, OCR) | ~$94 | **[P]+[E]**: list EUR 86.49 ex VAT, converted at ~1.09 |
| Domain | $1.50 | **[E]** |
| Unallocated remainder of your ~$100 | $4.50 | **[U]** |
| Supabase | $0 | **[M]**: free plan |
| **Total used** | **$100** | your figure, broken down, not added on top |

Step costs (**[E]**, shown only in business projections): Supabase Pro $25 from 50 paying subscribers (the free tier has no backups and pauses); a second server $94 from 500.

**Allocation.** Per-plan tables spread fixed cost equally across N paying subscribers (N = 100 unless stated), booked once: `allocated = fixed(N) / N`. Business-wide tables book `fixed(N)` once and never per plan. Free users are a separate cost line, not part of fixed cost.

**Not known:** the $37.59 invoice (could be a partial month, another vendor, or a one-off), e-mail/WhatsApp-number fees, monitoring, backups, any CDN. Confirm and replace.

---

## 5. Provider-by-provider cost (section 8)

Which providers run in production **[M]** (events since 2026-09-28): OpenAI (gpt-4.1, gpt-4o-mini, gpt-5.6-luna, gpt-4o, embeddings, gpt-image-1, gpt-4o-mini-tts), Groq (gpt-oss-20b/120b, whisper-large-v3-turbo), Mistral (ministral-14b-latest), Gemini (3.5 flash-lite). No FAL or OpenRouter calls are recorded.

| Provider / model | Used by | Price | Measured | Gap |
|---|---|---|---|---|
| OpenAI gpt-4.1 | WhatsApp, ai-chat | $2 / $8 per 1M **[M price book, P]** | 30 calls = $0.16, ~$0.0053 each | primary on the most common path |
| OpenAI gpt-5.6-luna | WhatsApp fallback | $0.20 / $1.20 per 1M | 4 calls, 3 unpriced | alias rows missing |
| OpenAI gpt-image-1 | social-publish, image-generate | ~$0.042 medium **[P]**, $0.167 high **[M]** | 5 calls = $0.83 | default quality is medium; `hd` gives high |
| OpenAI gpt-4o-mini-tts | WhatsApp voice replies, TTS | not priced (no usage returned) | 12 calls, **$0 recorded** | true cost unknown **[U]** |
| Groq whisper / gpt-oss | WhatsApp STT, fallback | $0.04/hour; $0.075-0.15 per 1M in | $0.003 total | immaterial |
| Mistral ministral-14b | social-guide, writing assistants | ~$0.20 / $0.20 per 1M **[P, third-party]** | 10 calls, **all unpriced** | primary for several assistants |
| Gemini 3.5 flash-lite | education/research assistants | ~$0.30 / $2.50 per 1M **[P, third-party]** | 6 calls, **all unpriced** | `gemini-flash-latest` alias unpriced |
| OpenAI realtime (gpt-realtime-2) | voice sessions | ~$0.096/min **[E]** | none recorded, server never sees usage | **no VX meter, no minute cap** |
| Luma video | video studio | registry cost $0.50/clip | none | key unset, feature dead |
| Voxtral voice cloning | voice studio | registry cost $1.00 | none | true cost unknown |
| Meta WhatsApp | WhatsApp channel | ~$0.0034-0.055 per delivered service message by country, 1,000 free/month per number **[P, unverified]** | n/a | previously treated as free; verify in Meta billing |

**Fallback and retry cost.** A fallback attempt that used tokens before failing is a real provider charge but shares one VX reservation **[C]**. The model adds 5% **[E]** for this. Failed or abandoned requests that return no usage are recorded `missing`/`estimated`, so under-recording is possible; failed-insert logging was added in #462.

**Local audio.** Prerecorded audio avoids TTS cost where used; WhatsApp voice replies and the TTS tool still call gpt-4o-mini-tts, whose cost is not measured.

---

## 6. Scenarios and profitability

Usage per subscriber per month is in the JSON. **Typical and light are estimates** because there is no per-subscriber telemetry (0 paying users, 0 linked WhatsApp identities in the last read). **Heavy** means a user who saturates the daily caps all month: for WhatsApp, cap × 30 (Business is uncapped; 330 a day assumed). Half of WhatsApp messages are assumed to call a model **[E]**; Meta's per-message charge applies to all of them.

**Definitions** are in section 11. "Usage headroom" is how many times the scenario's usage fits before contribution reaches zero; below 1 means a loss.

### Per-plan scenarios (paying base N = 100 for fixed-cost allocation)

| Plan | Price | Net rev | Scenario | Variable cost | Contribution | Fixed alloc | Op. profit | Margin | Usage headroom (x) |
|---|---|---|---|---|---|---|---|---|---|
| kids | $3.00 | $2.90 | light | $0.19 | $2.71 | $1.25 | $1.46 | 50% | 15.01 |
| kids | $3.00 | $2.90 | typical | $0.93 | $1.97 | $1.25 | $0.72 | 25% | 3.12 |
| kids | $3.00 | $2.90 | heavy | $24.08 | -$21.17 | $1.25 | -$22.42 | -772% | 0.12 |
| basic | $5.00 | $4.89 | light | $0.26 | $4.63 | $1.25 | $3.38 | 69% | 19.13 |
| basic | $5.00 | $4.89 | typical | $1.98 | $2.91 | $1.25 | $1.66 | 34% | 2.47 |
| basic | $5.00 | $4.89 | heavy | $74.65 | -$69.76 | $1.25 | -$71.01 | -1453% | 0.07 |
| pro | $10.00 | $9.85 | light | $0.49 | $9.36 | $1.25 | $8.11 | 82% | 20.05 |
| pro | $10.00 | $9.85 | typical | $3.41 | $6.44 | $1.25 | $5.19 | 53% | 2.89 |
| pro | $10.00 | $9.85 | heavy | $183.98 | -$174.12 | $1.25 | -$175.37 | -1780% | 0.05 |
| business | $20.00 | $19.78 | light | $0.93 | $18.85 | $1.25 | $17.60 | 89% | 21.36 |
| business | $20.00 | $19.78 | typical | $7.57 | $12.21 | $1.25 | $10.96 | 55% | 2.61 |
| business | $20.00 | $19.78 | heavy | $214.80 | -$195.02 | $1.25 | -$196.27 | -992% | 0.09 |

### Cost lines (typical and heavy)

- kids/typical: chat_messages $0.17 [measured]; whatsapp_messages $0.48 [unknown]; image_medium $0.13 [published]; tts_clip $0.15 [estimate]; stt_voice_note $0.00 [measured]
- kids/heavy: chat_messages $1.27 [measured]; whatsapp_messages $18.17 [unknown]; image_medium $0.84 [published]; tts_clip $0.90 [estimate]; stt_voice_note $0.02 [measured]; realtime_minutes $2.88 [estimate]
- basic/typical: chat_messages $0.34 [measured]; whatsapp_messages $0.97 [unknown]; tts_clip $0.15 [estimate]; stt_voice_note $0.00 [measured]; ocr $0.04 [estimate]; realtime_minutes $0.48 [estimate]
- basic/heavy: chat_messages $3.81 [measured]; whatsapp_messages $54.52 [unknown]; tts_clip $1.50 [estimate]; stt_voice_note $0.02 [measured]; ocr $0.40 [estimate]; realtime_minutes $14.40 [estimate]
- pro/typical: chat_messages $0.63 [measured]; whatsapp_messages $1.45 [unknown]; tts_clip $0.30 [estimate]; stt_voice_note $0.00 [measured]; ocr $0.06 [estimate]; realtime_minutes $0.96 [estimate]
- pro/heavy: chat_messages $6.35 [measured]; whatsapp_messages $145.39 [unknown]; tts_clip $3.00 [estimate]; stt_voice_note $0.04 [measured]; ocr $0.40 [estimate]; realtime_minutes $28.80 [estimate]
- business/typical: chat_messages $1.06 [measured]; whatsapp_messages $2.42 [unknown]; image_medium $1.05 [published]; tts_clip $0.45 [estimate]; stt_voice_note $0.00 [measured]; ocr $0.06 [estimate]; realtime_minutes $1.44 [estimate]; document_ai $0.08 [estimate]; voice_clone $1.00 [estimate]
- business/heavy: chat_messages $10.58 [measured]; whatsapp_messages $121.16 [unknown]; image_medium $12.60 [published]; tts_clip $6.00 [estimate]; stt_voice_note $0.06 [measured]; ocr $0.40 [estimate]; realtime_minutes $43.20 [estimate]; document_ai $0.80 [estimate]; voice_clone $20.00 [estimate]

### Same, with Meta service-message cost = $0 (old free-reply case)

| Plan | typical contribution | heavy contribution |
|---|---|---|
| kids | $2.37 | -$6.17 |
| basic | $3.71 | -$24.76 |
| pro | $7.64 | -$54.12 |
| business | $14.21 | -$95.02 |

### VX

| Plan | VX/month | VX at face value | Net revenue | Max sustainable cost per 1,000 VX | Full-spend cost @ image(med) | @ tts | @ video | @ voice_clone |
|---|---|---|---|---|---|---|---|---|
| kids | 3000 | $3.00 | $2.90 | $0.97 | $2.00 | $0.45 | $5.00 | $6.00 |
| basic | 5000 | $5.00 | $4.89 | $0.98 | $3.33 | $0.75 | $8.33 | $10.00 |
| pro | 11000 | $11.00 | $9.85 | $0.90 | $7.33 | $1.65 | $18.33 | $22.00 |
| business | 24000 | $24.00 | $19.78 | $0.82 | $16.00 | $3.60 | $40.00 | $48.00 |

| Service | VX price | Registry cost | Cost per 1,000 VX |
|---|---|---|---|
| ocr | 10 | $0.00 | $0.20 |
| document_ai | 15 | $0.00 | $0.27 |
| translation | 5 | $0.00 | $0.20 |
| image | 60 | $0.04 | $0.67 |
| tts | 100 | $0.01 | $0.15 |
| video | 300 | $0.50 | $1.67 |
| voice_clone | 500 | $1.00 | $2.00 |
| whatsapp_ai | 2 | $0.00 | $0.25 |

### Business-wide

Fixed cost: $100.00 base.


**subscriber_mix_a_basic_heavy / usage_mix_base** — break-even: 28

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $71.00 | $69.74 | $24.42 | $2.50 | $100.00 | -$57.18 | $7.10 | $12.69 | 61% | -82% |
| 50 | $355.00 | $348.68 | $162.10 | $12.50 | $125.00 | $49.08 | $7.10 | $5.99 | 50% | 14% |
| 100 | $710.00 | $697.35 | $334.19 | $25.00 | $125.00 | $213.16 | $7.10 | $4.84 | 48% | 31% |
| 500 | $3550.00 | $3486.76 | $1710.97 | $125.00 | $219.00 | $1431.79 | $7.10 | $4.11 | 47% | 41% |
| 1000 | $7100.00 | $6973.52 | $3431.94 | $250.00 | $219.00 | $3072.58 | $7.10 | $3.90 | 47% | 44% |

**subscriber_mix_a_basic_heavy / usage_mix_mid** — break-even: 1716

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $71.00 | $69.74 | $56.02 | $2.50 | $100.00 | -$88.78 | $7.10 | $15.85 | 16% | -127% |
| 50 | $355.00 | $348.68 | $320.08 | $12.50 | $125.00 | -$108.91 | $7.10 | $9.15 | 5% | -31% |
| 100 | $710.00 | $697.35 | $650.17 | $25.00 | $125.00 | -$102.82 | $7.10 | $8.00 | 3% | -15% |
| 500 | $3550.00 | $3486.76 | $3290.84 | $125.00 | $219.00 | -$148.08 | $7.10 | $7.27 | 2% | -4% |
| 1000 | $7100.00 | $6973.52 | $6591.68 | $250.00 | $219.00 | -$87.16 | $7.10 | $7.06 | 2% | -1% |

**subscriber_mix_a_basic_heavy / usage_mix_adverse** — break-even: none up to 20,000

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $71.00 | $69.74 | $402.83 | $2.50 | $100.00 | -$435.60 | $7.10 | $50.53 | -481% | -625% |
| 50 | $355.00 | $348.68 | $2054.17 | $12.50 | $125.00 | -$1842.99 | $7.10 | $43.83 | -493% | -529% |
| 100 | $710.00 | $697.35 | $4118.33 | $25.00 | $125.00 | -$3570.98 | $7.10 | $42.68 | -494% | -512% |
| 500 | $3550.00 | $3486.76 | $20631.66 | $125.00 | $219.00 | -$17488.90 | $7.10 | $41.95 | -495% | -502% |
| 1000 | $7100.00 | $6973.52 | $41273.32 | $250.00 | $219.00 | -$34768.80 | $7.10 | $41.74 | -495% | -499% |

**subscriber_mix_b_balanced / usage_mix_base** — break-even: 17

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $108.00 | $106.47 | $40.60 | $2.50 | $100.00 | -$36.63 | $10.80 | $14.31 | 60% | -34% |
| 50 | $540.00 | $532.34 | $242.98 | $12.50 | $125.00 | $151.86 | $10.80 | $7.61 | 52% | 29% |
| 100 | $1080.00 | $1064.67 | $495.96 | $25.00 | $125.00 | $418.71 | $10.80 | $6.46 | 51% | 39% |
| 500 | $5400.00 | $5323.35 | $2519.78 | $125.00 | $219.00 | $2459.57 | $10.80 | $5.73 | 50% | 46% |
| 1000 | $10800.00 | $10646.70 | $5049.55 | $250.00 | $219.00 | $5128.15 | $10.80 | $5.52 | 50% | 48% |

**subscriber_mix_b_balanced / usage_mix_mid** — break-even: 148

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $108.00 | $106.47 | $86.19 | $2.50 | $100.00 | -$82.22 | $10.80 | $18.87 | 17% | -77% |
| 50 | $540.00 | $532.34 | $470.95 | $12.50 | $125.00 | -$76.12 | $10.80 | $12.17 | 9% | -14% |
| 100 | $1080.00 | $1064.67 | $951.90 | $25.00 | $125.00 | -$37.23 | $10.80 | $11.02 | 8% | -3% |
| 500 | $5400.00 | $5323.35 | $4799.52 | $125.00 | $219.00 | $179.83 | $10.80 | $10.29 | 7% | 3% |
| 1000 | $10800.00 | $10646.70 | $9609.04 | $250.00 | $219.00 | $568.66 | $10.80 | $10.08 | 7% | 5% |

**subscriber_mix_b_balanced / usage_mix_adverse** — break-even: none up to 20,000

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $108.00 | $106.47 | $584.70 | $2.50 | $100.00 | -$580.73 | $10.80 | $68.72 | -452% | -545% |
| 50 | $540.00 | $532.34 | $2963.49 | $12.50 | $125.00 | -$2568.66 | $10.80 | $62.02 | -459% | -483% |
| 100 | $1080.00 | $1064.67 | $5936.99 | $25.00 | $125.00 | -$5022.32 | $10.80 | $60.87 | -460% | -472% |
| 500 | $5400.00 | $5323.35 | $29724.93 | $125.00 | $219.00 | -$24745.58 | $10.80 | $60.14 | -461% | -465% |
| 1000 | $10800.00 | $10646.70 | $59459.86 | $250.00 | $219.00 | -$49282.16 | $10.80 | $59.93 | -461% | -463% |

**subscriber_mix_c_business_led / usage_mix_base** — break-even: 13

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $139.00 | $137.24 | $53.01 | $2.50 | $100.00 | -$18.26 | $13.90 | $15.55 | 60% | -13% |
| 50 | $695.00 | $686.21 | $305.04 | $12.50 | $125.00 | $243.68 | $13.90 | $8.85 | 54% | 36% |
| 100 | $1390.00 | $1372.42 | $620.07 | $25.00 | $125.00 | $602.35 | $13.90 | $7.70 | 53% | 44% |
| 500 | $6950.00 | $6862.11 | $3140.35 | $125.00 | $219.00 | $3377.76 | $13.90 | $6.97 | 52% | 49% |
| 1000 | $13900.00 | $13724.22 | $6290.70 | $250.00 | $219.00 | $6964.52 | $13.90 | $6.76 | 52% | 51% |

**subscriber_mix_c_business_led / usage_mix_mid** — break-even: 71

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $139.00 | $137.24 | $108.45 | $2.50 | $100.00 | -$73.71 | $13.90 | $21.10 | 19% | -54% |
| 50 | $695.00 | $686.21 | $582.25 | $12.50 | $125.00 | -$33.54 | $13.90 | $14.40 | 13% | -5% |
| 100 | $1390.00 | $1372.42 | $1174.51 | $25.00 | $125.00 | $47.91 | $13.90 | $13.25 | 13% | 3% |
| 500 | $6950.00 | $6862.11 | $5912.54 | $125.00 | $219.00 | $605.57 | $13.90 | $12.51 | 12% | 9% |
| 1000 | $13900.00 | $13724.22 | $11835.08 | $250.00 | $219.00 | $1420.14 | $13.90 | $12.30 | 12% | 10% |

**subscriber_mix_c_business_led / usage_mix_adverse** — break-even: none up to 20,000

| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |
|---|---|---|---|---|---|---|---|---|---|---|
| 10 | $139.00 | $137.24 | $711.88 | $2.50 | $100.00 | -$677.14 | $13.90 | $81.44 | -421% | -493% |
| 50 | $695.00 | $686.21 | $3599.42 | $12.50 | $125.00 | -$3050.70 | $13.90 | $74.74 | -426% | -445% |
| 100 | $1390.00 | $1372.42 | $7208.83 | $25.00 | $125.00 | -$5986.41 | $13.90 | $73.59 | -427% | -436% |
| 500 | $6950.00 | $6862.11 | $36084.15 | $125.00 | $219.00 | -$29566.04 | $13.90 | $72.86 | -428% | -431% |
| 1000 | $13900.00 | $13724.22 | $72178.31 | $250.00 | $219.00 | -$58923.08 | $13.90 | $72.65 | -428% | -429% |

### Heavy-user tolerance

| Plan | Max share of heavy users before contribution < 0 |
|---|---|
| kids | 10% |
| basic | 5% |
| pro | 4% |
| business | 7% |

---

## 7. Free trial and free users

- **The trial opens no AI service.** `TRIAL_SECTIONS` is the free set (news, community, assistive products); the server never waives payment on the trial's say-so **[C]**. A trial account therefore costs about nothing in AI. One account was in trial at the last read **[M]**.
- **Free VX is the exposure, not trial usage.** A free account can claim about 1,800 VX a month (login 10/day plus 10 ads × 5 VX/day) **[C]**, up to 2,000 VX/day through all self-award routes **[C]**. Today that VX only buys games (`VX Purchase: <game>` rows) **[M]**, so its cash cost is **$0 while every service is disabled**. If services are enabled at the registry's own ratios, 1,000 free VX would cost $0.15 to $2.00 of provider spend (section 8).
- **Free WhatsApp:** an unlinked number keeps a small daily allowance **[C]**. At 5 free users per paying subscriber and $0.05 a user **[E]** this is a small line (about $25 a month at 100 paying subscribers).
- **Realtime voice, image and TTS** are behind a paid-plan gate **[C]**; the free tier cannot reach them directly.

---

## 8. VX economics

| Plan | VX/month | VX at face value | Net revenue | Max sustainable cost per 1,000 VX spent |
|---|---|---|---|---|
| Kids | 3,000 | $3.00 | $2.90 | $0.97 |
| Basic | 5,000 | $5.00 | $4.89 | $0.98 |
| Pro | 11,000 | $11.00 | $9.85 | $0.90 |
| Business | 24,000 | $24.00 | $19.78 | $0.82 |

A subscriber who spends the **whole** allowance is profitable only if the average cost of what they buy stays below the last column. The registry's own cost guesses (`base_cost`, **[E]**) give, per 1,000 VX: OCR $0.20, translation $0.20, WhatsApp AI $0.25, document AI $0.27, TTS $0.15, image $0.67, **video $1.67, voice cloning $2.00**. Video and voice cloning are **priced below their own estimated cost**: spending Business's whole allowance on them costs $40 to $48 against $19.78 of net revenue. Image at high quality ($0.167 measured, not the registry's $0.04) is $2.78 per 1,000 VX at the current 60 VX price, also a loss.

**Consistency.** VX is an internal unit; unused VX is not a cash cost and is not counted as profit here. Reservation, settlement and refund logic is covered by existing executed SQL scenarios (23 accounting checks, 27 metered checks) per earlier audits **[C]**; I did not re-run them. `vx_usage_ledger` has **0 rows** in production **[M]**, so no reservation has ever been used on real traffic: the metered path is untested against live use. Whether users can consume more than their balance: not through metered paths (refused before the provider call), but **yes** through anything not metered (WhatsApp counts, realtime, shadow-mode services).

---

## 9. Financial risks, ranked

| # | Risk | Evidence | Impact | Urgency |
|---|---|---|---|---|
| 1 | **WhatsApp volume is capped by operations, not cost.** Cap × (AI + Meta) exceeds the price: Basic at 150/day, Pro at 400/day, Business unlimited. Even at $0 Meta cost a heavy user loses $25 (Basic) to $95 (Business) a month. | caps **[C]**; AI cost per message **[M]**; Meta rate **[U]** | very high | before the first Business customer |
| 2 | **Realtime voice has no minute cap and no VX meter**; the server never sees its tokens; any paid plan, including $3 Kids, can open sessions up to a daily session count. ~$0.096/min **[E]** means one hour a day costs about $170 a month. | gate and daily session limit **[C]**; rate **[E]** | very high, unbounded | high |
| 3 | **Every metered service is disabled**, so all AI cost is unbilled shadow traffic and `check_ai_budget` cannot see `ai-chat` (it reads the wrong table). There is no global dollar ceiling. | registry **[M]**; prior audit **[C][E]** | high | high |
| 4 | **Business unlimited WhatsApp + 24,000 VX** at $20: nothing bounds the combined spend. | **[C]** | high | with #1 |
| 5 | **VX allowance exceeds price** on Pro (+10%) and Business (+20%); video and voice cloning are priced below cost. Enabling billing as configured would lose money on those paths. | **[M][C]** | medium, latent (services off) | before enabling any service |
| 6 | **Image quality exposure:** `hd` requests cost about 4× the default and exceed the 60 VX price. | **[C][M]** | medium | when images are enabled |
| 7 | **Under-recorded cost:** Gemini, Mistral, gpt-4o-mini-tts and alias rows are unpriced, so dashboards understate spend. | **[M]** | medium (visibility) | soon |
| 8 | **Free-VX farming:** the 10-ads/day limit is checked in the browser; the server cap is 2,000 VX/day per account, so many accounts mint VX at no cost to you today, and real cost if services are enabled. | **[C]** | low today, medium later | before enabling |
| 9 | **Supabase on the free plan:** no backups, project pausing, function quotas. A single incident is larger than a year of margin. | **[M]** plan | high if it fails | soon |
| 10 | **Plan price mismatch** with your intended structure (Pro, Business). Not a cost, a decision. | **[M][C]** | n/a | now |

Not found as a risk: costs incurred before payment (checkout is manual and nothing is granted until an admin approves), and unbounded retry loops (no automatic retry in the client; fallback attempts share one reservation).

---

## 10. Missing data and confidence

| Item | Status | Confidence in the model |
|---|---|---|
| Subscription revenue | $0, nothing to measure | **verified** |
| Plan prices and VX | read from DB and code | **verified** |
| Fixed cost split | no invoices available to me; $37.59 unmatched | low-medium |
| Hetzner price | provider page, EUR ex VAT, FX guessed | medium |
| Supabase plan | management API | **verified** |
| AI unit costs for OpenAI/Groq text and STT | from 207 recorded calls | medium (small sample) |
| Gemini, Mistral prices | third-party trackers only | low |
| Image cost | 5 calls, high quality | medium |
| TTS, realtime, voice cloning, video | estimates | low |
| Meta per-message charge | third-party sources and one fetched page | **low; verify first** |
| Per-subscriber usage | none exists | **low: every scenario is an assumption** |
| Payment fees on OMT and Whish | unknown | low |
| Refunds, chargebacks, tax | unknown | low |

I had no access to provider invoices, Hetzner or Meta billing, a payment processor, or any telemetry beyond the tables above.

---

## 11. Formulas (as implemented)

```
net revenue      = price/(1+tax) − refunds − chargebacks − Σ_method share×(pct×collected + fixed) − fx + measured extra
contribution     = net revenue − Σ_op units × unit cost            (unknown unit costs are listed, never treated as zero)
allocated fixed  = fixed(N) / N       fixed(N) = base items + step items whose threshold N has reached
operating profit = contribution − allocated fixed
margin           = operating profit / net revenue × 100           (null if net revenue ≤ 0)
usage headroom   = net revenue / variable cost                    (<1 means a loss)
chat unit cost   = (share_expensive × gpt-4.1 + (1−share) × cheap) × fallback multiplier
WhatsApp unit    = chat unit × AI share + Meta service-message rate
business-wide    = Σ_plan N×mix × net − Σ variable − free users × cost − fixed(N) − Meta free pool credit (once)
max heavy share  = typical-mix contribution / (typical-mix contribution − heavy contribution)
cost per 1,000 VX = registry base_cost / vx_price × 1000
```

Costs are subtracted once: variable lines are summed once per operation, fixed cost is booked once per business, and Meta's free service pool is credited once at business level. Tests in `src/test/profitability.test.ts` pin this.

---

## 12. Recommendations (nothing applied)

**Pricing and plans**
1. Decide the real structure: production carries Pro $10 / 11,000 VX and Business $20 / 24,000 VX, not your intended $7 / 12,000 and $10 / 30,000. Whichever you choose, the VX allowance is worth more than the price on both tiers (the bonus), so either drop the bonus or price VX-spending services so their average cost stays under 82 to 90 cents per 1,000 VX.
2. Reprice video and voice cloning so cost is at most 80% of their VX value: at today cost guesses that is at least 700 VX per video clip and 1,250 VX per clone, or keep them off.

**Limits**
3. Put a **monthly** cost-based cap on WhatsApp: a message budget per plan that includes Meta's charge, and replace "unlimited" on Business with a number (for example 600 a month of AI replies, then menus only).
4. Cap realtime voice minutes per month per plan and meter them (a server-issued session length limit, then bill VX or refuse).
5. Keep `hd` images Business-only and price them at least 210 VX (cost $0.167 at 80%).

**Routing and cost**
6. Move cheap, frequent paths (WhatsApp text, summaries) to the cheap models first; keep gpt-4.1 for safety-critical assistants. Each point of gpt-4.1 share moves a typical WhatsApp message cost by about 0.5 cent.
7. Add price-book rows for Gemini, Mistral and gpt-4o-mini-tts so recorded cost stops understating spend (needs your approval, data only).
8. Cache repeated answers (common assistant questions, menu translations) before paying for them again.

**Infrastructure**
9. Move Supabase to Pro before the first paying customer for backups. It is the one cost I recommend adding now.

---

## 13. Reproducibility

- Assumptions: [`profitability-assumptions.json`](profitability-assumptions.json). Change a value, rerun, and the tables change.
- Calculator: `src/lib/finance/profitability.ts` (pure; reads plans from `plans.ts`).
- Tables: `npx vite-node scripts/finance/profitability-tables.ts` prints every table in section 6.
- Tests: `npx vitest run src/test/profitability.test.ts` (33 tests: zero revenue, missing cost, refunds, free plans, unprofitable heavy usage, no double counting, break-even, heavy-share tolerance, assumptions hygiene).
- I did **not** build an admin dashboard module. There is no measured data to show and the brief forbids displaying modelled numbers as production figures; the calculator is the reusable piece.

---

## 14. Action plan

1. **This week, no code:** confirm Meta's service-message rate for your numbers in Meta billing; confirm what the $37.59 invoice is; confirm the intended Pro and Business price and VX.
2. **Before the first Business customer:** replace "unlimited" WhatsApp with a monthly cost cap; cap and meter realtime minutes; move Supabase to Pro.
3. **Before enabling any VX service:** reprice video and voice cloning, decide on the VX bonus, add price rows for Gemini, Mistral and TTS, and add the dollar leg to `check_ai_budget` (already proposed in the 2026-10-20 audit).
4. **After the first 10 paying subscribers:** replace every usage assumption with measured per-plan averages and rerun this report.
