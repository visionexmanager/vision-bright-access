# Visionex AI & Omnichannel Intelligence — Phase 0 audit and implementation plan

Status: **proposal, no production code changed.** This document is the Phase 0
deliverable required by rule 26.9. Nothing in sections 1–13 below is
implemented yet.

Audited at `6d6b0ec` on 2026-08-11: 233 migrations, ~500 public tables, 100
edge functions, 2,263 source files, 20 locales.

---

## 1. What already exists (reuse — do not rebuild)

### The AI Core is largely already here

The spec asks to "create or evolve the existing AI Assistant into a central AI
Core". The evolve path is real and short, because the pieces exist:

| Piece | Where | State |
| --- | --- | --- |
| Assistant registry | `supabase/functions/_shared/assistants.ts` | 26 assistants, one entry each: provider, model, system prompt |
| Provider layer | `_shared/aiProvider.ts` | OpenAI / Anthropic / Gemini / Groq / Mistral, all normalised to OpenAI SSE; structured (tool-call) completions; embeddings |
| Chat endpoint | `supabase/functions/ai-chat/` | Per-user memory, rate limit, voice mode, page context, product matches, tool intents |
| Frontend gateway | `src/services/ai/aiService.ts` | Documented rule: **every** AI call goes through it; no component calls an edge function directly |
| Chat widget | `src/components/AIChat.tsx` | `role="log"`, `aria-live="polite"`, voice mode, memory toggle — already accessible |
| Client orchestration | `src/hooks/useAIChat.ts` | **Already navigates**: `if (toolResult.navigateTo) navigate(...)`, and advertises `companionCapabilities: ["navigate_sections", …]` |
| Long-term memory | `ai_user_memory` | Language, tone, accessibility needs, interests, frequent sections, rolling summary |
| Usage telemetry | `ai_interactions` | provider, model, tokens, latency, cache_hit, user feedback |

**Consequence for spec §1 and §2:** this is an extension, not a new system. In
particular §2's natural-language navigation is already wired — the numbered
menu and buttons must plug into the existing `navigateTo` tool result rather
than becoming a parallel mechanism.

### Retrieval over real data already works — but is indexed for only two tables

`ai_embeddings` + the `match_embeddings` RPC + `ai-search` + `embed-content`
give semantic search with `text-embedding-3-small` (1536 dims). The index
covers exactly two sources today:

```ts
// supabase/functions/embed-content/index.ts
const SOURCES = { products: {...}, content_items: {...} }
```

**This is the single highest-leverage change in the whole programme.** Spec §1
lists ~20 domains the AI must know. Most of them are already tables. Extending
this map is how "the AI must use real Visionex data instead of inventing"
becomes true, and it unblocks §3, §4 and §17 at once.

### Channels and messaging

- **WhatsApp**: `whatsapp-webhook` shipped today — signature verification,
  Arabic/English detection, 12-turn memory, escalation, `whatsapp_conversations`
  / `whatsapp_messages`, admin-read RLS. Inert until Meta credentials exist
  (see `docs/whatsapp-ai-assistant.md`). Spec §6/§7 build directly on it.
- **Email**: Resend on a verified `visionex.app` domain, with
  `hello / support / billing / news / legal / noreply` senders already
  configured. `contact-form` routes by department and auto-replies.
  **Spec Phase 5 is substantially already done.**
- **Website**: `AIChat` widget on every page.

### A ready-made pattern for pluggable channels

`ph_providers` / `ph_metrics` / `ph_logs` / `ph_failovers` plus
`_shared/providerRouter.ts` already implement a registry with health scoring,
priority, capability filtering, failover recording, and — importantly —
`resolveApiKey(provider)` which reads the secret named by `api_key_ref` from
the environment rather than storing it in the row.

**Recommendation: model `social_accounts` on this exact shape.** It satisfies
spec §26's "modular so additional channels can be added later" and §23's
credential rules with a pattern the team already maintains.

### Other reusable assets

`notifications`, `admin_logs`, `audit_logs`, `page_events`, `moderate-content`,
`analytics-insights`, `has_role()`, 20-locale i18n with an automated
generation pipeline.

---

## 2. What does not exist (and what that costs)

### 2.1 There is no order system for the main product catalog

`products` has `name, description, category, price, points, image, in_stock,
rating, store_type` — a catalogue, nothing more. No orders table, no inventory
count, no shipping, no status, no fulfilment.

Real order systems exist elsewhere: `bazaar_orders` (status, Stripe Connect,
shipping address, totals in USD and VX), `kids_market_orders`,
`library_purchases`, and `vx_purchases` for VX-coin spends.

**Impact on spec §3.** Steps 1–8 (understand, search, filter, clarify, present,
compare, detail, guide) are all achievable now. Steps 9–10 — "continue with the
order flow", "track the order afterward" — are achievable **only for VXBazaar,
the kids market, and the library.** For the main catalogue the honest
behaviour is: recommend, then hand off to the existing purchase path.

Building a full order/inventory/fulfilment system for `products` is a
substantial project in its own right and is **not** included in the plan
below. It should be a separate decision.

### 2.2 Services live in code, not in the database

`src/features/servicecenter/catalog.ts` is 2,338 lines of TypeScript defining
services and their AI personas. There is no `services` table, and no
service-order lifecycle. `service_requests` is the contact form.

**Impact on spec §4.** The AI can explain services, collect requirements, and
create a `service_requests` row — that works today. "Provide status updates"
has nothing to read: `service_requests.status` is set manually by an admin and
there is no workflow behind it.

Two options, to be chosen before Phase 3:
- **(a)** Index the code catalogue into `ai_embeddings` at build time. Cheap,
  keeps the single source of truth, no migration. Recommended.
- **(b)** Move the catalogue into a table. Larger change, touches a
  catalog-driven page that `AGENTS.md` calls out specifically.

### 2.3 No social publishing of any kind

Verified: the only YouTube code is a `youtube-nocookie` **embed**;
`SocialAuthButtons` is Google **login**. There is no OAuth token storage table
anywhere in 233 migrations.

Spec Phases 6, 7, 8 and 10 are entirely net-new **and externally gated** — see
section 3.

### 2.4 Missing concepts

No unified `ai_conversations` across channels (only per-domain:
`whatsapp_*`, `academy_chat_sessions`, `library_ai_chat_sessions`,
`kids_conversations`). No approval workflow, no content calendar, no publishing
history, no unified inbox.

**No owner role.** `app_role` is `ENUM ('admin','user')`. Spec §7/§19 assume an
owner distinct from admins. Adding an enum value is a migration with a known
Postgres wrinkle: a new enum value cannot be used in the same transaction that
adds it, so it needs two migrations or a text column with a CHECK. Recommend a
`site_settings` owner record plus a `has_role(uid,'admin')` gate rather than a
new enum value — smaller blast radius.

---

## 3. External blockers — the long pole is approval, not code

None of these can be created from this repository, and several take **weeks**.

| Platform | What is required | Constraint that is easy to miss |
| --- | --- | --- |
| WhatsApp Cloud API | Meta Business verification, app, registered number, permanent System User token | The number **cannot** also be an active regular WhatsApp/Business-app number |
| Facebook Pages | App Review for `pages_manage_posts`, `pages_read_engagement` | Business verification + demo video + public privacy policy |
| Instagram | `instagram_content_publish`, `instagram_manage_messages` | Publishing requires a **Business/Creator** account linked to a Facebook Page; personal accounts cannot publish via API. Stories are not in the basic publishing tier |
| TikTok | Content Posting API, developer app **audit** | Before audit an app may only post **private / self-only** content. Public posting is gated on audit. There is no general DM inbox API |
| YouTube | Data API v3 + OAuth | `videos.insert` costs **1,600 quota units** against a default **10,000/day** — about 6 uploads a day. Unaudited projects upload as **private** until review |

**Planning consequence:** submit the Meta, TikTok and YouTube app reviews
**now**, in parallel with Phases 1–5. If code waits for approvals, the whole
programme waits. If approvals run while the internal work proceeds, Phases 6–8
start the moment they land.

**Spec §16 caveat:** a unified inbox covering TikTok is not deliverable — TikTok
exposes no general DM API. The inbox should be built channel-pluggable and ship
with the channels that actually have inbox APIs (WhatsApp, Facebook, Instagram,
email, website), and show TikTok/YouTube as comment-only where their APIs allow.

---

## 4. Conflicts and risks found in the current code

1. **`aiService.ts` is a hard architectural rule** — "No component or hook may
   call edge functions / fetch AI endpoints directly." Every new AI surface
   must route through it. Easy to violate when adding channels.
2. **The AI rate limit is 60 messages/user/day** (`check_ai_rate_limit`,
   enforced in `ai-chat`). An omnichannel assistant answering WhatsApp,
   Instagram and website traffic will hit this. A per-channel policy is needed
   before Phase 6, or customers will be cut off mid-conversation.
3. **Cost has no ceiling.** Content generation, per-entity embeddings, and
   multi-channel chat all draw on one `OPENAI_API_KEY` with no budget guard.
   Re-embedding every domain in §1 is a one-off cost worth estimating first,
   and the content engine is a recurring one. Add a spend guard in Phase 1.
4. **`_shared/` changes redeploy all 100 functions** (`deploy-changed-supabase-functions.sh`
   lists everything when `_shared/` is touched). Expect long deploys and plan
   `_shared` edits deliberately.
5. **`verify_jwt` must be set in two places** for any new webhook —
   `supabase/config.toml` *and* the deploy script's `NO_VERIFY_JWT` list. Only
   the second reaches production. This already caused a silent failure today.
6. **New user-facing text needs keys in all 20 locales**, and the locale bot
   reacts to changes in generated dictionaries.
7. **Accessibility is not optional here.** The primary user is blind. A numbered
   menu is genuinely good for screen readers, but it must be real focusable
   controls with announced state, not text listing numbers.

---

## 5. Proposed phasing

Re-ordered from the spec where the audit shows a different sequence is better.
Each phase ends with: `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`,
an accessibility pass, and a production probe — then a PR.

### Phase 1 — AI Core foundations (no new channels)
- Extend `embed-content` `SOURCES` to the domains in §1 that are already
  tables: services (from the code catalogue), library, academy, kids, games,
  simulations, news, TV/radio, community. Add a re-index trigger.
- Add a **grounding contract** to the assistant prompts: never state a price,
  stock, order status or link that did not come from retrieval.
- Add the spend guard and a per-channel rate-limit policy.
- New: `ai_conversations` / `ai_messages` as the channel-agnostic spine;
  migrate `whatsapp_*` onto it rather than duplicating.

### Phase 2 — Navigation (§2)
- Contextual menu served from a registry, rendered as accessible buttons, each
  with a number that is also a valid typed/spoken input.
- Reuse the existing `navigateTo` tool result. Back / Main menu / Search / Help
  at every level.

### Phase 3 — Product & Service AI (§3, §4)
- Retrieval-backed recommendation and comparison.
- Purchase: drive VXBazaar's real order flow; for the main catalogue, hand off.
  **Do not fake order tracking.**
- Services: create `service_requests` with structured requirements.

### Phase 4 — Escalation & owner control (§6, §7, §8, §20)
- `support_escalations` with the structured case fields from §6.
- Owner WhatsApp notifications and reply commands, building on
  `whatsapp-webhook`.
- Owner number in `site_settings`, never in code.
- `owner_approvals` with the §20 status machine.

### Phase 5 — Email & continuity (§5, §18)
- Mostly done. Remaining: link identities across channels where an account can
  be reliably matched, and nowhere else.

### Phases 6–8 — Social channels (§10, §11) — *gated on section 3*
- `social_accounts` modelled on `ph_providers`; tokens in Supabase secrets, row
  holds only a reference.
- Facebook + Instagram first (one API family), then TikTok, then YouTube.
- Per-platform capability flags so the publisher degrades honestly.

### Phases 9–10 — Content engine & planner (§12, §13, §14, §15)
- Proposals from real indexed entities, per-platform variants, `content_memory`
  for angle rotation, calendar, approval before publish.

### Phases 11–12 — Unified inbox & analytics (§16, §21)
- Inbox over `ai_conversations`, channel-pluggable.
- Analytics from `page_events` + `ai_interactions` + per-platform insight APIs.

### Phase 13 — Accessibility, security, regression

---

## 6. Decisions needed before Phase 1 starts

1. ~~**WhatsApp number**~~ — settled: a separate number, `+44 7732 729713`, was
   taken for the Cloud API rather than migrating `+961 70 750 609`, which would
   have stopped working as a normal WhatsApp account.
2. **Main-catalogue orders** — accept "recommend and hand off", or fund a real
   order system for `products` as a separate project.
3. **Services catalogue** — index the code catalogue (recommended) or migrate
   it to a table.
4. **Owner identity** — `site_settings` record (recommended) or a new
   `app_role` enum value.
5. **Budget ceiling** for embeddings and the content engine.
6. **Start the platform app reviews now** — they are the critical path.
