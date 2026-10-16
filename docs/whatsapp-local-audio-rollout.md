# WhatsApp prerecorded audio: first release and rollout plan

Companion to `whatsapp-local-audio.md` (what was built). This page is what is
needed to turn it on safely, and what is true today. Measured 2026-10-12.

## State today

| Item | State |
| --- | --- |
| Code (PR #421) | **Merged 2026-10-12** (7819b7aa); media processor redeployed same day (4 successful runs) |
| Feature flag `WHATSAPP_LOCAL_AUDIO` | Not set. With it unset, behaviour is unchanged |
| Audio clips | **None exist.** `LOCAL_AUDIO_ASSETS` is empty |
| `voice-prompts` dataset on the server | **Not installed** |
| Media processor | Redeployed 2026-10-12 after merge; `.ogg` route not yet proven with a real clip |

## Existing assets (inspected, none usable)

| Where | What | Usable as a voice prompt? |
| --- | --- | --- |
| `public/audio/arcade/` | 13 game sound effects | No: not speech |
| `public/audio/reactions/emoji/` | 112 emoji reaction sounds | No: not speech |
| CI artifact of the `WhatsApp voice probe` (kept 3 days) | One English and one Arabic sample, different sentences | No: not our phrases, and made on a paid synthesis run for a different purpose |
| `/var/lib/visionex/data/datasets/` on the server | cldr-core, unicode-ucd, tzdata, language-subtag-registry | No audio |

No file was fabricated and no placeholder created.

## Release 1: English and Arabic, five phrases (ten clips)

Both languages are in the existing locale list. The text of each clip is the
existing string, read aloud without the emoji; the Arabic is the project's own
wording (a Levantine register for the processing line), so a native speaker
should record or approve it.

| File | Says | Chars |
| --- | --- | --- |
| `processing.en.ogg` | Processing your request… | 26 |
| `processing.ar.ogg` | عم عالج طلبك… | 15 |
| `request_failed.en.ogg` | Sorry — that didn't go through. Please try again. | 49 |
| `request_failed.ar.ogg` | تعذّر إتمام هذه الخدمة الآن. جرّب مرة أخرى. | 43 |
| `empty_question.en.ogg` | I didn't get a question there. Send one and I'll answer. | 56 |
| `empty_question.ar.ogg` | لم يصلني سؤال. اكتب سؤالك وسأجيبك. | 34 |
| `unavailable.en.ogg` | That one isn't available right now. | 35 |
| `unavailable.ar.ogg` | هذه الخدمة غير متاحة الآن. | 26 |
| `ask_question.en.ogg` | Go ahead — send me your question. | 33 |
| `ask_question.ar.ogg` | تفضل، اكتب سؤالك. | 17 |

All ten are `missing`; none is `present`, `invalid` or `unverified`. Durations and
checksums are unknown until clips exist and are never written by hand.

**Greeting is not in Release 1.** On WhatsApp a greeting is answered with the menu,
which is not a fixed sentence; the long welcome text (`WELCOME_EN` / `WELCOME_AR`)
is used by the Messenger/Instagram webhook, not this one. Recording a greeting
needs a decision on what the greeting should say, then a new short string.

**Subscription messages are not recorded.** `subscriptionRequired`,
`subscriptionRequiredShort`, `planLimitReached`, `planAlmostSpent` and `planStatus`
carry a link and numbers and, for the first, an instruction to send "link account".
A recording cannot say them accurately, so they stay written and exactly as they
are. A test asserts none of them is registered.

## Format and the provider

Verified against Meta's media documentation (read 2026-10-12): audio types are
`audio/aac`, `audio/mpeg`, `audio/amr`, `audio/ogg` and `audio/mp4`; **`audio/ogg`
is "OPUS codecs only; base audio/ogg not supported; mono input only"**; 16 MB limit.

Verified by a real call: today's `WhatsApp voice probe` run (CI) produced Ogg/Opus
mono with the production synthesis code, uploaded it to Meta's media store with
`audio/ogg` (accepted), and deleted it. That proves Meta accepts that payload for
**upload**. It does not prove how WhatsApp clients present it (voice note with
waveform or an audio attachment); the documentation does not say. That needs one
real message to an authorised recipient.

So clips must be **Opus in an Ogg container, mono, at most 512 KB** (the loader's
limit; a five-second line is a few tens of kilobytes). The preparation script
refuses anything else.

## Does the media processor need a deployment? Yes.

`services/media-processor/src/datahub.mjs` serves only the extensions in `TYPES`;
PR #421 adds `ogg`. The container does not pick that up by itself: the
`deploy-media-processor` workflow is manual (`workflow_dispatch`, action `deploy`).
Until it runs, the route answers `415 type_not_served` for a clip, the loader
reports `fetch_failed`, and every registered phrase stays written. Safe, but the
feature does nothing.

## Ordered rollout

Each step needs its precondition; none is automatic. Items marked **approval** need
the owner.

1. **Review and merge PR #421** (**approval**). Merging is safe on its own: the
   flag is unset, so nothing changes.
2. **Deploy.** The Deploy workflow ships the Edge Function and the application on
   merge. Verify `Deploy → Supabase Edge Functions: success`.
3. **Redeploy the media processor** (**approval**): run `deploy-media-processor`
   with `deploy`, then `datahub` to prove the route still refuses traversal and
   unauthenticated reads.
4. **Make the ten clips** (**approval** for any paid synthesis; recording by a
   person costs nothing). Opus/Ogg, mono. No cloned or imitated voice without
   written consent; they must be allowed for commercial use.
5. **Validate offline:** `node scripts/local-audio/prepare.mjs <folder> --write`.
   Fix every `REFUSED` line. It sends nothing.
6. **Record them in the manifest:** paste the printed lines into
   `LOCAL_AUDIO_ASSETS`, open a PR, let CI (`inspectRegistry`) pass, merge
   (**approval**).
7. **Install on the server** (**approval**): the clips and a `MANIFEST.json` as the
   `voice-prompts` dataset under the Data Hub layout, with the `current` pointer,
   mode `0644`, owned by the service account, written to a temporary version
   directory and moved into place only after the checksums match. Do not touch the
   existing datasets. `datahub.sh update` cannot install local files today, so this
   needs a small, reviewed addition to that script or a one-off reviewed command.
8. **Prove the read path:** the `datahub` action of `deploy-media-processor`, plus
   one request for `voice-prompts` `processing.en.ogg`, comparing its SHA-256 with
   the manifest.
9. **Set `WHATSAPP_LOCAL_AUDIO=1`** on the Edge Function (**approval**). Not before
   steps 3, 7 and 8 pass.
10. **Controlled test** with an explicitly authorised recipient (see below).

### Rollback

Unset `WHATSAPP_LOCAL_AUDIO` (or `MEDIA_PROCESSOR_URL`/`MEDIA_PROCESSOR_TOKEN`).
Effective on the next invocation; no deploy, no revert. A single bad clip is
disabled by setting its `status` to `"disabled"` in the manifest (a PR), or simply
removed from the dataset: the phrase then goes out written. Nothing else changes.

## Manual test needing an authorised recipient

Send a voice note from a number you control to the production line, in English and
in Arabic, and trigger each phrase (processing, an empty question, an unavailable
service, the prompt, a failure). Confirm the clip is heard, that it arrives as a
voice note or as audio (record which), and that `local_audio` appears in the
function logs with `outcome: audio` and no text. Check a phrase whose clip you
deliberately removed arrives as written text. No automated test sends a message.

## What is and is not verified

| Claim | Evidence |
| --- | --- |
| Loader refuses corrupt, oversized, missing, wrong-checksum, non-Ogg clips | Automated tests (mocked) |
| Body is read with a hard 512 KB ceiling | Automated test with a 20 MB stream |
| No TTS call for a recorded or missing-clip phrase | Automated tests (mocked) |
| Meta accepts Ogg/Opus mono at upload | Real call in CI, today (probe) |
| The Data Hub route is authenticated and refuses traversal | Real CI check (`datahub` action), 2026-10-12 |
| Clips served from the server | **Not verified**: none installed, processor not redeployed |
| Voice-note presentation in WhatsApp | **Not verified** |
| Subscription behaviour unchanged | Source order tests plus the existing "Unsubscribed callers reach no provider" CI job |
