# Visionex Self-Hosted Processing & External API Reduction Audit

**Date:** 2026-08-25 · **Commit audited:** `d2690c7b` · **Status:** audit only

Nothing in this document has been installed, benchmarked or deployed. No production
behaviour was changed. Every "current" claim was read out of the repository; every
"local" proposal is exactly that.

---

## 0. Read this first — two findings that reshape the question

### 0.1 Edge Functions cannot host models. This is not a detail.

The WhatsApp webhook is a Supabase Edge Function: Deno, no persistent disk, no GPU,
no long-lived process, cold starts. **No local model can run inside it.** Every
capability marked "local" below therefore means:

> Edge Function → authenticated HTTP call → a *new* processing service on the VPS.

That service does not exist today. It is a prerequisite for essentially the whole
roadmap, and it brings its own auth, timeout, queueing and failure-mode surface. Any
plan that says "just run Whisper locally" without building that service first is
describing a step that cannot be taken.

### 0.2 Local processing is slower and less predictable than an API call

An external API returns in 1-3 s with a hard SLA. CPU inference on a shared VPS
returns in 5-60 s with variance that grows under concurrency. The webhook already has
a 30 s provider deadline and a 90 s recovery window, and **Meta redelivers a webhook
that does not answer promptly**.

So moving work local without a queue does not save money — it converts a cost problem
into a duplicate-reply problem. `ops.queue` is a prerequisite, not a nice-to-have.

---

## 1. What Visionex actually uses today

Read from `supabase/functions/`. 96 Edge Functions; 35 consume an AI provider.

| Capability | Provider chain | Where |
|---|---|---|
| Chat / answers | Mistral → Gemini → Groq → OpenAI | `assistants.ts`, `whatsappAskProvider.ts` |
| Classification | Groq `llama-3.1-8b-instant` → OpenAI `gpt-4o-mini` | `whatsapp-webhook` |
| Summaries / briefings | Groq `llama-3.3-70b-versatile` → OpenAI `gpt-4o-mini` | `whatsapp-webhook` |
| Embeddings | OpenAI `text-embedding-3-small` (1536d) | `aiProvider.ts` → 8+ functions |
| Speech to text | Groq `whisper-large-v3-turbo` → OpenAI `whisper-1` | `whatsappTranscribe.ts` |
| Text to speech | OpenAI `tts-1`; ElevenLabs elsewhere | `whatsappVoiceReply.ts`, `speech-generate` |
| Image / OCR / documents | OpenAI `gpt-4o-mini` → Gemini flash | `whatsappUnderstand.ts` |
| Video | Gemini | `whatsappUnderstand.ts` |
| **PDF text** | **none — already local** (`npm:pdf-parse`) | `whatsappPdfText.ts` |
| Geo / weather / nearby | Open-Meteo, Nominatim, BigDataCloud, Overpass | `whatsappGeo.ts` |

**Two things worth noticing immediately.**

PDF text extraction is *already* fully local. It is the existing proof that the
local-first pattern works in this codebase, and it is the model the rest should follow.

All four geo services are **keyless and free**. There are no credits to save there at
all — which means section F is not a cost question, it is a rate-limit and privacy
question, and should be treated as one.

---

## 2. Server capacity — and the blocker

### What the repository proves

- A VPS at `204.168.191.20`, deploy webhook on `:9000`, nginx, SPA **built on the box**.
- **Docker is available** — `infra/stream-proxy` is built and pushed by the Deploy workflow.
- Supabase Postgres with pgvector: `ai_embeddings.embedding vector(1536)`, ivfflat/cosine.

### RESOLVED — the machine, measured

The blocker below is closed. Provider confirmed independently from RIPE RDAP
(`CLOUD-HEL1`, Hetzner Online GmbH, FI); specifications read from the Hetzner
Console on 2026-08-25.

| | |
|---|---|
| Plan | **Hetzner Cloud CCX23** — `ubuntu-16gb-hel1-1` |
| vCPU | **4, dedicated** (CCX is the dedicated line, not shared) |
| RAM | **16 GB** |
| Disk | 160 GB local, ~35 GB used, **~125 GB free** |
| Traffic | 20 TB/month outbound included |
| Location | Helsinki, Finland (`eu-central`) |
| GPU | **none — and none available on this product line** |
| Backups | disabled |

Three consequences, and they change the roadmap.

**The RAM upgrade this audit recommended is unnecessary — it is already there.**
Section 4, answer 7 proposed going to 16 GB as the single highest-value change.
The server already has it. Nothing needs buying to begin Phase B.

**The cores are dedicated, which matters more than their number.** CCX vCPUs are
not shared, so CPU inference carries no noisy-neighbour variance: a two-second
transcription stays roughly two seconds under load. That is what makes a latency
budget meaningful enough to promise.

**Phase D is not an upgrade — it is a migration.** Hetzner Cloud has no GPU
family at all: only Cost-Optimized (ARM), Regular Performance (shared vCPU) and
Dedicated vCPU. A GPU means a different Hetzner product (dedicated GEX) or a
different provider entirely. So everything marked RED for needing a GPU — chat,
image description, video description — is not one plan change away. It is off
the table on this infrastructure, which turns "keep it external" from a
preference into the only available answer.

What remains unmeasured is throughput under real concurrency. That needs the
processing service running, not another console reading.

---

## 3. Capability matrix

Full machine-readable version: `docs/visionex-processing-capability-matrix.json`.

| Capability | Current | Local replacement | Server need | Quality vs external | Class |
|---|---|---|---|---|---|
| PDF text extraction | already local | — | negligible | equal | 🟢 |
| File validation | already local | + magic-byte sniffing | negligible | n/a | 🟢 |
| Image resize / EXIF strip | **absent** | libvips (sharp) | ~50 MB, <100 ms | n/a | 🟢 |
| QR / barcode | **absent** | zbar / ZXing | ~20 MB, <50 ms | better | 🟢 |
| Scanned-PDF OCR | **refused today** | ocrmypdf | ~500 MB, 1-4 s/page | good | 🟢 |
| Office extraction | vision model | Apache Tika | ~0.5-1 GB | equal or better | 🟢 |
| Audio normalisation | absent | ffmpeg | ~50 MB | n/a | 🟢 |
| Video demux / key-frames | refused | ffmpeg | CPU, seconds | n/a | 🟢 |
| Language detection | script heuristic | fastText lid.176 | <10 MB | much better | 🟢 |
| Reranking | threshold only | bge-reranker-v2-m3 | ~1.2 GB | real gain | 🟢 |
| Queue / workers | **absent** | pgmq | negligible | n/a | 🟢 |
| Photo OCR | gpt-4o-mini | Tesseract 5 | ~300 MB, 0.5-3 s | good clean, poor hard | 🟡 |
| Speech to text | Groq whisper | faster-whisper small | ~1 GB, 1-2× realtime | worse on dialect | 🟡 |
| Text to speech | OpenAI tts-1 | Piper | ~200 MB, 0.05-0.3× RT | good EN, weak AR | 🟡 |
| Embeddings | OpenAI 1536d | bge-m3 / e5-small | 0.5-2.5 GB | competitive | 🟡 |
| Classification | Groq 8B | fastText classifier | ~100 MB | competitive | 🟡 |
| Chat / answers | 4-provider chain | Qwen2.5-7B Q4 | ~6 GB, 3-8 tok/s CPU | materially worse | 🔴 |
| Image description | gpt-4o-mini | Moondream2 | GPU realistically | materially worse | 🔴 |
| Video description | Gemini | key-frames → VLM | GPU | much worse | 🔴 |
| Geo / weather | keyless & free | self-host Nominatim | 64 GB+ RAM, ~1 TB | equal, absurd cost | 🔴 |

**11 GREEN · 5 YELLOW · 4 RED.**

Note what the GREEN column really contains: **most of it is capability Visionex does
not have yet**, not spend it can cut. Image preprocessing, QR, scanned-PDF OCR, video
demux, reranking and language detection are all *new function*. They are green because
they need no model and no credits — but they will not, on their own, reduce a bill.

---

## 4. The answers you asked for

**1. What can Visionex do 100 % locally today?**
PDF text extraction, and file size/MIME validation. That is the honest list.

**2. What can move locally with minimal effort?**
Everything in Phase A (§5): image preprocessing, EXIF stripping, QR, audio
normalisation, video demux, language detection, magic-byte validation, scanned-PDF
OCR, Office extraction. None needs a model. All are deterministic and testable.

**3. What requires a GPU?**
General chat, image description, video scene description. Also *comfortable* Whisper
medium/large and any 7B+ LLM at conversational speed.

**4. What should remain external?**
Chat, image description, video description — and all geo, because self-hosting
Nominatim/Overpass for this volume is disproportionate.

**5. What should be cached?**
Geo above all: reverse geocode by rounded coordinate, geocode by normalised name,
weather by cell and hour, Overpass by tile. Also embeddings by content hash, TTS by
`hash(text+voice+language)` — canned strings like menus and the twenty language names
are synthesised repeatedly today and never change.

**6. What should be queued?**
Every local ML task, and any pipeline over ~10 s: STT, OCR, scanned-PDF OCR, video,
embedding backfills. The webhook should acknowledge, enqueue, and deliver
asynchronously when the work exceeds an interactive budget.

**7. What single upgrade gives the most benefit?**
**None — the box already has 16 GB and 4 dedicated cores.** This answer originally
read "RAM, to 16 GB"; the console shows that is already the case, so nothing needs
buying to begin Phase B. It unlocks Tesseract +
faster-whisper-small + Piper + embeddings + reranker resident simultaneously — the
entire YELLOW tier minus chat. A GPU only pays off if you intend to move image
description or chat local, and both are RED for quality reasons, not cost reasons.

**8. How much external usage can realistically be eliminated?**
By *call count*, plausibly **50-65 %** — TTS, STT, OCR, embeddings and classification
are high-frequency. By *cost*, considerably less, because the chat LLM is the cost
centre and stays external. Anyone promising "80 % savings" is counting calls and
calling them money.

The honest framing: **the biggest near-term win is TTS**, which is billed per
character on every single voice reply and has a genuinely good CPU-only replacement
for English.

**9. Risks of moving processing local?**
- **Accessibility regression.** Weaker OCR/STT/TTS lands hardest on blind users, who
  cannot see that the output is wrong. This is the dominant risk and it is not financial.
- **Latency → duplicate replies.** Meta redelivers on timeout. Mitigated only by the queue.
- **Concurrency.** Two 1 GB models × N requests will OOM an unmeasured box.
- **Operational surface.** A new VPS service is a new thing to patch, monitor and secure.
- **Silent quality drift.** An API returns an error; a local model returns confident nonsense.

**10. What to implement next?**
Phase A only, and in this order: the processing service + queue, then image
preprocessing/EXIF, then Office extraction, then geo caching. Nothing in Phase A
replaces a provider, so nothing can regress an answer — which is exactly why it is first.

---

## 5. Roadmap

Each phase is independently shippable and independently reversible.

### Phase A — zero-risk local processing *(no model, no quality risk)*

| Component | Project | Licence | Resources | Install | GPU | Complexity |
|---|---|---|---|---|---|---|
| Processing service | Node/Fastify or FastAPI | own code | ~200 MB | Docker | no | **medium** |
| Queue | pgmq | PostgreSQL | negligible | Postgres ext | no | low |
| Image preprocess | libvips / sharp | LGPL-2.1 / Apache-2.0 | ~50 MB | npm/apt | no | low |
| QR / barcode | zbar / ZXing | LGPL-2.1 / Apache-2.0 | ~20 MB | apt/npm | no | low |
| Audio / video | ffmpeg | LGPL-2.1+ | ~100 MB | apt | no | low |
| Office extraction | Apache Tika | Apache-2.0 | 0.5-1 GB | Docker | no | low |
| Language ID | fastText lid.176 | MIT | ~1 MB | download | no | low |
| Scanned-PDF OCR | ocrmypdf + Tesseract | MPL-2.0 / Apache-2.0 | ~500 MB | apt/Docker | no | low |
| Geo cache | Postgres table | — | negligible | migration | no | low |

All permit commercial use. *(ffmpeg: use an LGPL build and avoid `--enable-gpl`
components if you want to stay clear of GPL obligations.)*

### Phase B — CPU-based AI *(model-backed, quality gate required)*

| Component | Project | Licence | Resources | GPU | Complexity |
|---|---|---|---|---|---|
| TTS | Piper | MIT | ~200 MB, 0.05-0.3× RT | no | low |
| Photo OCR | Tesseract 5 | Apache-2.0 | ~300 MB | no | medium |
| STT | faster-whisper small int8 | MIT | ~1 GB, 1-2× RT | no | medium |
| Classification | fastText | MIT | ~100 MB | no | low |
| Reranking | bge-reranker-v2-m3 | MIT | ~1.2 GB | no | medium |

Ship each behind a flag, local-first with external fallback on low confidence.
**Gate every one on a measured quality check in Arabic**, not a vibe.

### Phase C — heavier local AI *(needs ≥16 GB RAM)*

Embeddings via bge-m3 or multilingual-e5. **This is a migration, not a swap** — see §6.

### Phase D — optional GPU

Only if you decide to move image description or chat local. Both are RED on quality
today, so this is speculative. A 12 GB card would make Whisper-large, a 7-8B LLM and a
VLM all viable — revisit once Phases A-C are measured.

### Phase E — external fallback optimisation

Cache aggressively; route by difficulty rather than by provider order; keep the
existing chain untouched as the escalation path.

---

## 6. The embeddings blocker

`ai_embeddings.embedding` is `vector(1536)` with an ivfflat cosine index. **No common
open model emits 1536 dimensions.** bge-m3 is 1024; multilingual-e5-small is 384.

So moving embeddings local requires a new column or table, a new index, re-embedding
the entire corpus, and both indexes live during cut-over — with `match_embeddings`
(used by the WhatsApp knowledge layer, `ai-search`, the library stack and the sourcing
adapter) reading the right one throughout.

This is the largest single migration in the audit. It is worth doing for cost and
privacy, but it should be planned as its own project.

---

## 7. Security requirements for any local pipeline

Today's controls are real but narrow: per-kind size ceilings (`MEDIA_LIMITS`), a MIME
allowlist, a 300 s audio cap, a 6 MB video cap, host-checked media downloads, and
budgets on every text field reaching a provider.

What a local pipeline must add:

- **Magic-byte verification** — the declared MIME is currently trusted.
- **Decompression-bomb limits** — PDF page count, image pixel count *before* decode
  (`sharp` `limitInputPixels`), archive ratio caps. A 100 MP PNG inside an 8 MB file
  will OOM a worker that only checked bytes.
- **EXIF/GPS stripping before anything leaves the server.** Today a photo goes to the
  vision provider with its metadata intact. This is the clearest privacy gap found.
- **Sandboxing** — Tika and LibreOffice parse hostile formats for a living. Run them in
  a container with no network, a read-only root, a tmpfs scratch, dropped capabilities,
  and CPU/memory limits.
- **Deterministic temp-file cleanup**, including on crash.
- **No user file on disk longer than the job**, and never in a bucket by default.
- **Malware scanning** — ClamAV is cheap (~1 GB RAM with signatures) and worth it once
  files touch disk at all.
- **Per-user concurrency caps** — the existing rate limits bound *messages*, not CPU.
  One user sending ten PDFs can starve everyone else.

---

## 8. Proposed architecture

```
WhatsApp (Meta)
     │  signed webhook
     ▼
Supabase Edge Function ── unchanged: signature, dedup, claim, routing, session
     │
     │  authenticated call + enqueue
     ▼
VPS processing service (Docker)          ← NEW, the prerequisite
     │
     ├─ validate: magic bytes, size, pixels, pages, bombs
     ├─ strip: EXIF/GPS
     ├─ normalise: ffmpeg / sharp
     │
     ├─ deterministic (no model, no credits)
     │    pdf-parse · Tika · zbar · fastText · ffmpeg
     │
     ├─ local models (Phase B+, flagged, confidence-gated)
     │    Tesseract · faster-whisper · Piper · reranker · embeddings
     │
     └─ escalate when local is unavailable or low-confidence
              │
              ▼
       existing provider chain — UNCHANGED ORDER
       Mistral → Gemini → Groq → OpenAI
              │
              ▼
       Edge Function delivers the reply
```

The existing router, medium policy, telemetry and reliability layers stay exactly as
they are. This adds a stage *before* the providers; it replaces none of the contracts
built in Phases 3-9.

---

## 9. Blockers

1. ~~Server specification unknown.~~ **RESOLVED** — Hetzner Cloud CCX23: 4 dedicated
   vCPU, 16 GB RAM, ~125 GB free, no GPU and no GPU option on the product line.
   See section 2.
2. **No processing service exists.** Edge Functions cannot host models; this must be
   built before any Phase B item.
3. **No queue exists.** Without it, local latency becomes Meta redelivery.
4. **Embedding dimension mismatch.** Section 6.
5. **No Arabic quality baseline.** There is no measured WER/CER for the current STT or
   OCR, so "as good as today" cannot currently be *proved* for any replacement. For a
   product whose users cannot see the output, that baseline should exist before the
   first model is swapped.

---

## 10. Recommendation

Do Phase A. It adds capability Visionex does not have, closes a real privacy gap
(EXIF), builds the service and queue everything else depends on, and cannot regress an
answer because it replaces no provider.

Then measure — an Arabic OCR/STT baseline — and only then decide Phase B, per
capability, on evidence.

Do not move chat or image description local. The saving is real and the cost is
accessibility, which is the wrong trade for this product.
