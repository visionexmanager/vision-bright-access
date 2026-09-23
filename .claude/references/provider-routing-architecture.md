# Provider routing — architecture foundation (Phase 2A)

Status: **design and verification only. No production code changed.** This
document answers, once, how Visionex decides which provider executes a
workload, how fallback works, how synchronous and asynchronous execution
differ, how the actual provider gets recorded, and how that eventually
connects to VX without exposing internal costs. Every claim below was
verified by reading the current implementation at `origin/main @ 172416a6`
(the same commit the Phase 2 provider-routing audit was performed against),
not inferred from file names or from this repository's own aspirational
comments — several of which describe an intended end state that the code does
not yet reach, and this document says so explicitly where that is true.

Later phases (2B onward, see §K) implement against this document. It does not
implement anything itself.

## A. Architecture overview

```
Service
  ↓
Capability            "what kind of work" — chat, tts, image, video, …
  ↓
Selection policy       code-defined (assistants.ts) or registry-scored (providerRouter.ts)
  ↓
Provider                a vendor: OpenAI, Groq, Mistral, Gemini, Anthropic,
                         ElevenLabs, Luma, Replicate, RunPod
  ↓
Model                   default_model (registry) or a caller-chosen/hardcoded string
  ↓
Adapter                 speaks one vendor's dialect
  ↓
Execution               sync (request → response) or async (submit → poll → result)
  ↓
Result recording        which provider actually served the request, and how it went
  ↓
VX metering             (dormant; see §I) — usage, never cost, reaches the user
```

**Sync and async are not a detail of one layer — they are a fork in the whole
pipeline from Execution onward.** A synchronous capability (chat, vision,
embedding, moderation, TTS, STT) returns its result to the same request that
asked for it; the caller records the outcome immediately. An asynchronous
capability (video generation — on every vendor Visionex uses, not only
RunPod — and any future RunPod GPU job) returns a job handle first; the
result and its recording happen later, on a poll, decoupled from the request
that created the job. §G gives this lifecycle in full.

Three routing systems already exist in production and are **not** being
merged in this phase (§F):

| System | Governs | Where |
|---|---|---|
| `assistants.ts` + `aiProvider.ts` | chat, vision, structured/tool-call completions, embeddings | code-defined registry, deployed as a commit |
| `providerRouter.ts` | `ph_providers`-backed capabilities: currently `tts`, `voice_cloning`, `text_to_video` | database-scored, adjustable without a deploy |
| `_shared/providers/compute.ts` + `runpod.ts` | the async execution *shape* for any operation run on RunPod | pure normalization layer, no selection policy of its own |

## B. Capability vocabulary

Two vocabularies already exist in the codebase, for different purposes, and
this document keeps them distinct rather than collapsing them into one:

- **`ph_providers.type`** — a database `CHECK` constraint, currently
  `'tts' | 'voice_cloning' | 'text_to_video'`
  (`supabase/migrations/20260628500000_provider_hub.sql:11`). This is the
  **registry capability**: it is what `resolveProvider(type)` filters on, and
  it is the axis a caller selects a *provider row* against.
- **`ComputeOperation`** — `"generateImage" | "generateVideo" |
  "generateSpeech" | "transcribe" | "ocr" | "convertMedia"`
  (`_shared/providers/compute.ts:171-177`). This is the **adapter operation**:
  what a `ComputeAdapter.submit()` call is actually asking a specific
  execution target (today, only RunPod) to do. It is not a registry column —
  `ph_providers.capabilities` (a free `text[]`, populated today with ad hoc
  tags like `"emotions"`, `"ssml"`, `"720p"`, `"demo"`) has never been
  validated against it.

These should stay two vocabularies, not become one. `type` answers "which
provider row can serve this request"; `ComputeOperation` answers "which
function does the RunPod worker run once selected." Collapsing them would
force every adapter operation to also become a selectable registry row, which
is not true today (RunPod's video row is typed `text_to_video`, not
`compute` — see below).

### Proposed canonical vocabulary for `ph_providers.type`

| Capability | Status today | Recommendation |
|---|---|---|
| `tts` | exists, 1 active provider (OpenAI), 1 inactive (ElevenLabs) | keep |
| `voice_cloning` | exists, 1 active provider (ElevenLabs, via `mock-vc` demo row) | keep |
| `text_to_video` | exists, 1 inactive provider (Luma) — RunPod's video row is also typed `text_to_video`, not a separate `compute` type | keep; this already shows one capability with two provider rows |
| `stt` | **does not exist in the registry.** Fully code-routed today via `_shared/voice/stt.ts`'s Groq→OpenAI Whisper chain — no `ph_providers` row, no `resolveProvider` call anywhere in that path | candidate addition — but see §K, not done this phase |
| `image` | **does not exist in the registry.** Every image-generating function (`image-generate`, `_shared/contentMedia.ts`, and — before PR #322 — the two `kids-*` functions) calls OpenAI directly; none call `providerRouter.ts` | candidate addition — see §K |
| `moderation` | **does not exist anywhere as a routed capability.** `moderate-content` calls `POST /v1/moderations` directly; `aiProvider.ts` has no moderation wrapper at all | **do not add yet** — a single provider with no fallback logic gains nothing from a registry row; revisit only once a second moderation provider is genuinely integrated |
| `embedding` | **intentionally not routed, and should stay that way.** `aiProvider.ts:401-407` documents why: every stored vector column is `vector(1536)`, so swapping the embedding provider is a migration-plus-re-embed, not a runtime choice | **do not add** — a registry row implies a live choice that does not exist here |
| `chat` / `vision` | owned entirely by `assistants.ts`/`aiProvider.ts`, already production-proven at far higher volume than anything in `ph_providers` | **do not add in Phase 2A** — see §F; this is the one explicit instruction this phase must not cross |
| `compute` | does not, and should not, exist as a `type` value. "Compute" is an execution *mechanism* (the async submit/poll shape), not a content capability — see the two-vocabulary point above | not a capability; keep `ComputeOperation` where it is |

Answering the six specific questions this phase was asked to resolve:

1. **Which capabilities already exist**: `tts`, `voice_cloning`, `text_to_video`.
2. **Which are represented in `ph_providers`**: the same three, exactly.
3. **Which are represented only in application code**: chat, vision,
   embedding, moderation, stt, image — all six are real, production-reachable
   workloads with no `ph_providers` row today.
4. **Which are actually needed by current production services**: all six of
   the above are called in production right now (confirmed by the Phase 2
   audit's full inventory).
5. **Which are distinct enough to deserve their own capability**: `stt` and
   `image` — genuinely different dialects, genuinely have (or will have)
   more than one candidate provider. `moderation` is distinct in dialect but
   not yet in provider count.
6. **Which should remain implementation-specific**: `embedding` (fixed by
   design), `chat`/`vision` (owned by `assistants.ts`, out of scope this
   phase), `moderation` (single provider, no fallback exists to route).

## C. Provider matrix — current, verified state only

"Implemented" below means: a real request path exists and reaches this
provider in production today. It does not mean an API key is merely present.

| Capability | Provider | Status | Sync/async | Notes |
|---|---|---|---|---|
| chat | OpenAI, Groq, Mistral, Gemini, Anthropic | **implemented**, fallback-chained | sync (streamed) | `assistants.ts` + `aiProvider.ts`; production, highest volume |
| vision | OpenAI, Gemini, Anthropic | **implemented** | sync | same call path as chat, `image` is an optional param — not a separate provider set |
| embedding | OpenAI | **implemented, single-provider by design** | sync | `aiProvider.ts:409-421`; no fallback exists, none is planned |
| moderation | OpenAI | **implemented, direct call, no shared layer** | sync | `moderate-content/index.ts:42`; fails open on a provider error |
| tts | OpenAI (active), ElevenLabs (inactive row) | **implemented via `providerRouter.ts`** | sync | `speech-generate`, `voice-studio`'s underlying `voice/tts.ts`; the only two callers of `resolveProvider()`/`providerBySlug()` today |
| stt | Groq (primary), OpenAI Whisper (fallback) | **implemented, code-routed, not registry-routed** | sync | `_shared/voice/stt.ts`; used by `speech-transcribe`, WhatsApp voice notes |
| image | OpenAI (`gpt-image-1`→`gpt-image-1-mini`) | **implemented, direct call** | sync | `_shared/contentMedia.ts`'s `generateImage()` is the one place this fallback is done correctly; `image-generate`'s own inline call duplicates it |
| image | Replicate | **implemented, direct call, no fallback** | sync | `image-tools-generate/index.ts` |
| video | OpenAI (Sora), Luma | **implemented, direct calls, no cross-vendor fallback** | **async even for these two** — `_shared/contentMedia.ts`'s `generateVideo()` and `video-studio`'s own job table both submit-then-poll | `video-studio/index.ts` |
| video | RunPod | **implemented as one of three `VideoProvider` classes; provider row `inactive`; kill-switch off** | async (native, via `ComputeAdapter`) | selectable only with explicit `provider: "runpod"` — never the `"auto"` default (§J) |
| voice cloning | ElevenLabs | **implemented via `providerRouter.ts`**, single eligible row | sync | `voice-studio`; records via `providerBySlug`, never calls `resolveProvider` (nothing to select among) |
| compute (generic GPU jobs beyond video) | RunPod | **adapter exists (`compute.ts`/`runpod.ts`), fully tested; zero production callers besides `video-studio`** | async | no other Edge Function submits a `ComputeRequest` today |

Nothing here is "planned" or "diagnostic only" in the current inventory
except the inactive rows already named (ElevenLabs TTS, Luma, RunPod video) —
those are configured but switched off, not aspirational.

## D. Fallback architecture

Three levels exist as concepts; only two are actually implemented anywhere
today, and neither one is implemented inside `providerRouter.ts` itself.

- **Provider fallback** (same capability, different vendor) — implemented
  **only** in `aiProvider.ts`'s `streamChatCompletionWithFallback` /
  `structuredCompletionWithFallback`, iterating `assistants.ts`'s ordered
  `targets: ProviderTarget[]` (`aiProvider.ts:122-140,294-312`). **Not**
  implemented for `tts`/`voice_cloning`/`text_to_video`:
  `resolveProvider()` picks one provider once; if the caller's request to it
  fails, nothing in `providerRouter.ts` tries a second provider. That is the
  caller's responsibility, and no current caller (`speech-generate`,
  `voice-studio`) does it.
- **Model fallback** (same vendor, different model) — implemented **only**
  in `_shared/contentMedia.ts`'s `generateImage()`
  (`gpt-image-1`→`gpt-image-1-mini`, `contentMedia.ts:216-251`), and only for
  the specific failure `model_unavailable`. Nowhere else in the codebase.
- **Capability fallback** (this capability is unavailable, do something
  else entirely) — no implementation found, and no evidence any current
  workload needs one. Not designed here for that reason: inventing a rule
  for a pattern with zero real callers would be exactly the "giant universal
  abstraction" this phase is told not to build.

### Retryable vs. non-retryable

`_shared/providers/compute.ts:122-125` already states a principled,
narrow rule for the async path: only `PROVIDER_UNAVAILABLE` and
`PROVIDER_TIMEOUT` are retryable; everything else — auth, plan, insufficient
VX, rate limiting, payload size, invalid input — is not. This is the pattern
Phase 2A adopts as the general rule going forward, generalized across sync
and async:

| Failure | Retryable? | As what |
|---|---|---|
| Auth failure (bad/missing key) | Not against the same provider. May be provider-fallback-eligible if a genuinely separate vendor and key exist. | provider fallback only |
| Rate limited (429) | Not in-process (no busy-loop/backoff inside one request — `compute.ts` treats this as non-retryable for exactly this reason). May be provider-fallback-eligible. | provider fallback only |
| Timeout | Yes | same provider, or provider fallback |
| Transient 5xx | Yes | same provider, or provider fallback |
| Invalid input (malformed request, bad schema) | No, anywhere | fails identically on every vendor |
| Unsupported/retired model | Yes, but **only** as model fallback on the same vendor — a different vendor would not recognize the model name at all, so provider fallback does not apply here | model fallback |
| Full provider outage | Yes | provider fallback |
| Content/policy rejection | Not for the same input on the same vendor. Vendors' policies genuinely differ, so provider fallback is defensible (this is current, accepted `aiProvider.ts` behavior, not a bug) | provider fallback, cautiously |
| Malformed provider response | Yes — treated as a provider-side fault, not the caller's | provider fallback |

**`aiProvider.ts`'s current fallback loop does not actually make this
distinction** — it catches any error and advances to the next target
unconditionally (`aiProvider.ts:127-136,299-308`). This works in practice
because the target list is short (≤4) and cheap to exhaust, but it does not
distinguish "this will fail everywhere" from "try the next vendor" the way
`contentMedia.ts`'s `model_unavailable`-only `continue` does
(`contentMedia.ts:230-235`). Noted as a real but low-urgency inconsistency —
a Phase 2B/2C polish item, not a Phase 2A fix (§K).

### Loop prevention

Every fallback loop found is bounded by iterating a **finite, predetermined
array** — `targets: ProviderTarget[]` (≤4 entries, fixed at deploy time by
`assistants.ts`) or `IMAGE_MODELS` (2 entries) — never recomputed mid-loop,
never recursive. This is the rule Phase 2A carries forward: any future
fallback loop must iterate a fixed list decided before the loop starts, and
should only advance for failure types where doing so is a plausible fix
(matching `contentMedia.ts`'s discipline, not `aiProvider.ts`'s looser one).

## E. `default_model` semantics — the decision

**Option C (hybrid), narrowly scoped:**

- `provider.default_model` is the capability row's authoritative baseline
  model — the model a caller should use when it has no more specific reason
  to choose another.
- A caller **may** override it — a user-selected model in a UI, a
  request-specific requirement. This mirrors `resolveProvider()`'s own
  `preferredSlug` pattern for providers (`providerRouter.ts:109-114`): an
  explicit caller choice always wins; the registry default applies only when
  nothing more specific was asked for.
- **The two existing callers are not retrofitted this phase.**
  `speech-generate` hardcodes its own default (`model = "tts-1"`,
  `speech-generate/index.ts:203`) and `voice-studio` does the same elsewhere;
  neither reads `provider.default_model` today. Changing that touches a
  production call site and is explicitly out of scope for an
  architecture-only phase (§18/§19 of the task).
- **Going forward**, any *new* integration against `providerRouter.ts`
  should read `provider.default_model` rather than hardcode a literal string.
  This is precisely the failure class PR #317 (`llama-3.1-8b-instant`) and
  PR #322 (`dall-e-3`) both fixed: a model name hardcoded in application code
  goes stale silently, while a value in a database row can be corrected in
  one place.
- **Multiple models per provider row**: not supported today, and not
  designed here. The schema is one `default_model: string` per row. If
  Visionex later wants a provider to expose several user-selectable models
  (not just an internal primary/fallback pair), that is a genuinely new shape
  (an array column or a child table) — flagged as future schema work, not
  decided in this phase.

## F. `providerRouter` vs. `aiProvider`/`assistants` vs. adapters — responsibilities

| System | Answers | Deployment model | Why it stays separate |
|---|---|---|---|
| `assistants.ts` | Which persona/prompt, and in what provider order, for a *conversation* | Code, deployed by commit | Production-proven at the highest call volume in the repo (every chat surface, WhatsApp). `providerRouter.ts`'s own header says this explicitly: merging them "would put a chat outage and a media outage on the same switch" (`providerRouter.ts:22-29`). Nothing found in this audit contradicts that reasoning. |
| `aiProvider.ts` | How to speak to OpenAI/Groq/Mistral/Gemini/Anthropic's chat dialect, with or without fallback | Code | The dialect-translation layer chat needs (e.g. Anthropic SSE → OpenAI SSE, `aiProvider.ts:209-255`) has nothing in common with a TTS/video provider's dialect. |
| `providerRouter.ts` | Which `ph_providers` row should serve a `tts`/`voice_cloning`/`text_to_video` request, scored by health/latency/cost/priority | Database rows, adjustable without a deploy | The one system that can change provider preference operationally (flip a row's `status`, adjust `priority`) without shipping code. |
| Provider adapters (`voice/tts.ts` providers, `LumaProvider`, `OpenAISoraProvider`, `runpodAdapter`) | How to speak one vendor's actual API | Code | Genuinely different per vendor; centralizing selection does not mean faking a uniform request/response shape across OpenAI, Groq, Mistral, Gemini, ElevenLabs, Luma, Replicate and RunPod — they are not the same shape and forcing them to look identical would hide real dialect differences the adapter has to handle (streaming vs. polling, JSON vs. multipart, base64 vs. hosted URL). |

**Should `providerRouter` eventually coordinate chat policy without
replacing `assistants`?** Possible in principle — `assistants.ts`'s targets
are already the same `{provider, model}` shape `providerRouter.ts` deals in —
but doing so safely would mean `providerRouter` reading health/priority
signals that `assistants.ts` currently encodes as static, reviewed,
per-assistant sets (`OPENAI_FIRST`/`GEMINI_FIRST`/`MISTRAL_FIRST`,
`assistants.ts:54-79`), several of which carry deliberate, documented
reasoning (e.g. `whatsapp-support`'s temporary lead-with-OpenAI override,
`assistants.ts:57-64`) that a generic health score would not know to
preserve. **Not designed further here** — this is real future-phase
scoping work, not a Phase 2A decision, and is listed in §K rather than
answered now.

## G. RunPod / async lifecycle

The lifecycle already exists as working, tested code
(`_shared/providers/compute.ts`, `_shared/providers/runpod.ts`,
`video-studio/index.ts`'s RunPod path, and `src/test/runpod-provider-layer.test.ts`).
This section states it explicitly rather than redesigning it:

```
1. request arrives, entitlement checked
2. job row created in Visionex's own table (e.g. vx_video_jobs), BEFORE
   the provider is ever called — this row's id becomes the idempotency key
3. provider selected (today: the client's explicit "runpod" request,
   validated server-side against a closed allowlist — not providerRouter;
   see the note below)
4. ComputeAdapter.submit() called with { operation, input, idempotencyKey,
   timeoutMs }
5. RunPod's POST /run answers immediately: either a refusal (no
   providerJobId was ever issued — see "submission-time" below) or a job
   with providerJobId + status "queued"/"running"
6. providerJobId persisted onto the job row
7. caller polls ComputeAdapter.poll(providerJobId) — GET /status/{id} —
   until a terminal status (completed | failed | cancelled | timed_out)
8. on "completed": output validated and stored in Visionex's own storage,
   never a vendor URL handed to the user (compute.ts:24-30's whole reason
   for existing)
9. VX settled only for "completed" (isBillable(), compute.ts:55-57);
   every other terminal status releases the hold
10. result recorded — see below
```

**Provider selection for RunPod today does not go through
`providerRouter.ts`.** `video-studio`'s `getProvider()` does its own closed
`if (requested === "runpod"/"openai"/"luma")` dispatch
(`video-studio/index.ts:461-520`) and never calls `resolveProvider()`. The
existing reference doc `.claude/references/runpod-architecture.md:12-13`
draws `request → … → provider router (ph_providers) → adapter` as the
intended flow — that is the target shape, not the current wiring, and this
document records the gap rather than silently repeating the diagram as fact.

**When does result recording happen for an async job?**
`recordResult()` as written (`providerRouter.ts:122-175`) expects
`latency_ms`/`success`/`cost_usd` to be known at call time — a synchronous
shape. Nothing in the RunPod path calls it today (confirmed: RunPod is not
wired to `providerRouter.ts` at all, per above). For a future async
integration, `recordResult()` would need to be called from the
**poll-completion** step (step 7/8 above), once a terminal status is known —
decoupled from the `submit()` call that started the job, not adjacent to it.
This is a real, currently-unbuilt seam, not a trivial wiring change, and is
listed as its own future-phase item in §K rather than built here.

**Is provider fallback safe after an async submission?** Only conditionally,
and this document draws the line explicitly because the task asked for it:

- **Before `submit()` returns a `providerJobId`** (a refusal — timeout,
  401/403, 429, 5xx, or a rejected 4xx, `runpod.ts:209-217`) — safe. Nothing
  was started on the vendor's side; a different provider (or a retried
  submission) can be tried with the same idempotency key, since nothing
  is bound to the failed attempt.
- **After a `providerJobId` exists** — not safe to fall back to a different
  provider without first calling `cancel(providerJobId)` on the original, and
  even then the VX accounting for "did any work actually happen on the
  cancelled job" is unresolved by anything in the current code. **No
  cross-provider fallback after submission is implemented anywhere, and none
  should be added without designing that cancellation-and-accounting question
  explicitly** — this is exactly the kind of async-specific hazard that does
  not exist in the synchronous chat-fallback case (a failed synchronous call
  genuinely produced nothing).

**Duplicate completion prevention**: relies on the VX reservation, not on
anything in the compute layer itself. `_shared/vx/meter.ts:118-120` already
refuses to re-run a reservation that has already settled
(`held.replayed && held.status !== "reserved"` → `already_completed`), and
`runpod.ts:204` notes the real dedupe authority is "the unique index on the
reservation before this is ever called" — i.e. at the database level, not in
adapter code. This mechanism exists and is tested in principle, but is
**currently unexercised in production**: `meter()`/`databasePorts()` have
zero callers anywhere in the repo (§I) — so this protection is designed and
ready, not yet proven under real traffic.

## H. Result recording — worked semantics

Confirmed by reading every current caller (`speech-generate`, `voice-studio`
— the only two):

```
resolveProvider("tts")                    → pick a default when the caller named none
        ↓ (independent of the pick above)
actual synthesize() call, to whichever provider was actually used
        ↓
providerBySlug(<the slug actually used>)  → look up that row, unfiltered by
                                             health/status — a provider that
                                             just served a request must stay
                                             recordable even if unhealthy now
        ↓
recordResult({ provider_id, provider_slug, success, latency_ms, … })
```

`resolveProvider()`'s pick and `recordResult()`'s subject are **never the
same variable in the current code** — they are computed independently, on
purpose (`providerRouter.ts:179-189`'s own docstring states why: a
`preferredSlug` that is not eligible falls through to a different scored
choice inside `resolveProvider()`, and recording must target whichever
provider the request *actually* reached, not whichever `resolveProvider()`
would pick if asked again right now). This is verified, not just documented —
`src/test/provider-router-architecture.test.ts` (new, this phase) asserts it
directly against the source.

**What does not exist today**: the audit's own example diagram (`resolveProvider("tts")` →
provider A fails → provider B fallback → `providerBySlug(B)` →
`recordResult(B)`) describes a *provider-fallback-then-record* sequence.
`speech-generate` and `voice-studio` do not implement the fallback half —
each makes exactly one attempt and records exactly once, success or failure.
The selection/recording separation is real and tested; the fallback-then-record
composition is not yet built anywhere.

## I. VX boundary

```
Provider routing (selection)
        ↓
Actual execution (sync call, or async submit→poll)
        ↓
Outcome { value, consumedVx?, provider?, actualCostUsd? }   ← Outcome<T> shape,
        ↓                                                      meter.ts:41-56
VX metering (meter() / databasePorts())
        ↓
vx_usage_ledger (admin-read: actualCostUsd; user-read: consumedVx only)
```

`_shared/vx/meter.ts` is already designed for exactly this boundary and
requires no change to support it: `meter()`'s `run: () => Promise<Outcome<T>>`
is agnostic to whatever selected the provider inside that closure
(`resolveProvider()`/`providerBySlug()` could sit inside it unmodified), and
`Outcome<T>.provider`/`.actualCostUsd` are already typed and already
documented as "never shown to the user" (`meter.ts:52-55`). Extending
provider routing to more workloads and wiring VX billing into those same call
sites are two separate, compatible efforts — neither blocks the other.

**Current reality, unchanged by this phase**: `meter()`/`databasePorts()`
have zero callers anywhere in the repository (confirmed by grep, this phase
and the prior audit both). Billing today is fragmented across
`vx_reserve_for_whatsapp` (WhatsApp's own path, `_shared/vx/whatsapp.ts`) and
`billing-engine`'s deprecated (HTTP 410) endpoints, which point callers at
`meter.ts` without anything having migrated. **No VX billing integration is
built in this phase** (§18/§19) — the boundary above is a description of
where a future integration attaches, not new code.

## J. Security findings — re-verified against `origin/main @ 172416a6`

Same commit the Phase 2 audit covered; nothing has changed on `main` since
(PR #322 has not merged as of this phase). Findings restated, not
re-discovered:

- **Still current — Medium**: `/services/ai-media-studio/diagnostics` is
  gated by `AuthGuard` (any signed-in user), not `AdminRoute`
  (`src/App.tsx:1111` vs. `:1114`), and `health-check` itself runs with
  `verify_jwt = false` — so provider key presence/validity is readable by any
  authenticated user, and by an unauthenticated caller who calls the function
  directly.
- **Still current — Medium**: `vx_video_jobs.provider`/`.provider_model`/
  `.provider_job_id`, `ams_speech_jobs.provider`, and `ams_assets.metadata.provider`
  are queried directly from the browser via `select("*")`
  (`src/services/ai-media-studio/videoStudioService.ts:18,53-59`, etc.) — RLS
  correctly scopes this to the owning user only (no cross-user leak), but it
  still puts a raw vendor name and vendor job id in a response body a user's
  own browser receives, which the product's VX-only-currency rule prohibits.
- **Still current — Low**: vendor/env-var names leak in error text on a
  missing key, for the OpenAI/Luma/Replicate/Gemini paths specifically —
  `video-studio`'s own RunPod branch already avoids this (a generic message,
  by design, `video-studio/index.ts:478-482`); the other three branches were
  never brought up to that standard.
- **Architectural rule for this phase, stated once**: provider identity
  (vendor name, model name, vendor job id) and cost/margin data
  (`cost_usd`, `cost_per_request`, anything in `ph_metrics`/`ph_logs`) are
  **admin-only or internal**; VX usage counts are **user-visible**; nothing
  in between. `ph_providers`/`ph_metrics`/`ph_logs`/`ph_configs`/`ph_failovers`
  already enforce this correctly at the RLS layer
  (`20261022000000_provider_hub_admin_only.sql`); the two Medium findings
  above are both places application code (not RLS) leaks provider *identity*
  — never cost — past that boundary. No broad rewrite is done this phase;
  both are recorded as Phase 2B/2C follow-up (§K).

## K. Future implementation phases

Small, independently shippable, in no forced order except where noted:

- **2B** — Fix the two Medium security findings from §J: gate Diagnostics
  behind `AdminRoute`; stop returning raw `provider`/`provider_model`/
  `provider_job_id` from client-reachable `select("*")` queries.
- **2C** — Widen `ph_providers.type`'s `CHECK` to add `stt` and `image`
  (migration only — no caller changes). Seed provider rows for existing,
  already-integrated vendors (Groq/OpenAI for `stt`; OpenAI/Replicate for
  `image`).
- **2D** — Migrate `speech-transcribe` and the image-generating functions
  (`image-generate`, `_shared/contentMedia.ts`'s callers) onto the widened
  registry — after 2C, not before.
- **2E** — Design (not build) the poll-completion → `recordResult()` seam
  for async jobs (§G), independent of activating RunPod itself.
- **2F** — Design (not build) safe cross-provider fallback for async jobs —
  specifically the cancel-before-fallback question raised in §G. Depends on
  2E.
- **2G** — Bring `aiProvider.ts`'s fallback loop's error handling in line
  with `contentMedia.ts`'s discipline (§D) — distinguish retryable from
  non-retryable inside the loop, rather than catching everything. Small,
  independent of everything else here.
- **2H** — VX billing adoption: wire `meter()` into one real call site (a
  natural pilot: `speech-generate`, since it already computes `success`/
  `latency_ms` in the right shape) — independent of 2C–2G, blocked only on a
  product decision to turn VX billing on at all.
- **2I** — Investigate the four remaining stale `llama-3.1-8b-instant`
  references found during the Phase 2 audit (`ai-voice-chat/index.ts:115`,
  `ai-chat/index.ts:434,541`, `_shared/generators.ts:79`,
  `_shared/careerAiOrchestrator.ts:58`) for actual reachability before
  deciding whether each is worth fixing. Independent of everything else.

None of the above is started in this phase.
