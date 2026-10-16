# Local audio library audit, 2026-10-16

Evidence: repository at `7819b7aa`, `gh` run history, the coverage tool
(`scripts/local-audio/coverage.mjs`). No server, Supabase-secret or live WhatsApp
access was used, so production state below is "not verified" where stated.

## Findings

| # | Question | Class | Evidence |
| --- | --- | --- | --- |
| 1 | PR #421 | Verified working (merged) | Merged 2026-10-12 19:57Z. `whatsapp-local-audio-rollout.md` still said "open" until this change |
| 2 | Code exists and is wired | Implemented, off | `localAudio.ts`, `localAudioManifest.ts`, `whatsappVoiceReply.ts`, `prepare.mjs`, both docs exist. Wired in `whatsapp-webhook/index.ts` (`speak` callback). There is **no `keys.ts`**; the registry maps to `UI_STRINGS` keys |
| 3 | Playable audio files exist | **Missing** | `LOCAL_AUDIO_ASSETS` is `{}`. No `.ogg` in the repo. Existing `public/audio` is effects, not speech |
| 4 | Checksums/durations verified | Not applicable | Nothing registered. `prepare.mjs` computes them from real files only |
| 5 | Persistent, secure storage | Missing | `voice-prompts` dataset not installed (rollout doc, 2026-10-12); not re-checked, no server access |
| 6 | Data Hub / processor handle Ogg | Working with limitations | `ogg` added to `TYPES`; processor redeployed 4x on 2026-10-12. Never served a real clip |
| 7 | Provider accepts the format | Working with limitations | Meta upload of Ogg/Opus mono accepted (CI probe). Voice-note vs attachment presentation **not verified** |
| 8 | `WHATSAPP_LOCAL_AUDIO` | Not verified | Not a GitHub secret/variable; the Supabase function secret cannot be read from here. Off unless exactly `1` |
| 9 | Bypasses external TTS | Verified in tests only | Mocked tests assert no provider call for a recorded or missing-clip phrase. No production measurement |
| 10 | Text vs voice origin | Working with limitations | Only the **voice-reply path** (`speak`) consults the library, and only when the reply text *equals* a registered string. Text-origin requests answered as text never reach it. 12 phrases registered |
| 11 | Language, fallback, idempotency, errors | Working with limitations | Tests cover wrong language, corrupt, missing, oversize, ties between ids, resolver throw. Idempotency is the webhook's existing path, untouched |
| 12 | Gate / VX / privacy intact | Working with limitations | Subscription strings are asserted unregistered; call site sits after the existing gates. Not re-run live |

## Real coverage (measured)

12 phrases registered; text exists in all 20 locales for each. **0 clips in any
language.** Every locale: 12 approved, 0 with audio, 12 text-only. Release 1 target
is 5 phrases x en/ar = 10 clips, all missing.

## What this change adds

`scripts/local-audio/coverage.mjs` (read-only): per-locale coverage, and a candidate
list of fixed replies fit to record. It excludes plan/price/limit/order/link keys,
text with numbers, links, lists or placeholders, long text and one-word labels.
Without a usage file the list is **unranked and labelled so** (192 eligible today);
with `--usage counts.json` (aggregate `{uiKey: count}`, no text, no ids) it ranks by
real count. Tests: `src/test/local-audio-coverage.test.ts`.

## Deliberately not built

- **Word-level concatenation**: unnatural prosody; no language has been validated.
- **Alias/intent matching and templates**: the library only plays a recording for a
  reply the system already decided to send, so there is no user-text matching to
  make unsafe. Adding one needs its own review.
- **New telemetry table**: the existing `local_audio` log line already carries
  response id, language and outcome with no text. A table needs a migration and
  retention decision; the owner should approve it first.
- **Anything that sends, deploys, enables or spends**.

## Savings methodology

Measured: count `local_audio` lines with `outcome: audio` per id/language (TTS
calls avoided = those lines). Estimated: that count x average provider cost per
reply; label as estimate until billing agrees. Today both are zero.

## Approval needed next

1. Decide who records or approves the Arabic wording; approve any paid synthesis.
2. Provide clips; run `prepare.mjs`, then PR the manifest block.
3. Approve server install of `voice-prompts` and `WHATSAPP_LOCAL_AUDIO=1`.
4. Authorise one live test to a named recipient.
