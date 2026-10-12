# WhatsApp prerecorded voice notes

Fixed phrases ("Processing your request…", "Stopped. Nothing was sent.") are said
from a recording on our own disk instead of a text-to-speech provider. Off by
default. This page is what is built, what is not, and how the missing part gets
done.

## What exists

| Piece | File |
| --- | --- |
| Registry (which strings may be said from a recording) and the manifest of clips | `supabase/functions/_shared/localAudioManifest.ts` |
| Matching, reading and verifying a clip, the resolver, the registry report | `supabase/functions/_shared/localAudio.ts` |
| The hook in the voice path (optional `local` parameter, no-op when absent) | `supabase/functions/_shared/whatsappVoiceReply.ts` (`speakReply`) |
| The wiring on the reply path | `supabase/functions/whatsapp-webhook/index.ts` |
| Serving `.ogg` from the Data Hub route | `services/media-processor/src/datahub.mjs` |
| Checking a folder of clips and printing manifest entries | `scripts/local-audio/prepare.mjs` |
| Tests | `src/test/local-audio.test.ts` |

The words are **not** copied: each registered response points at a key in
`whatsappStrings.ts` and is recognised only when the reply is, word for word, that
string in one of the twenty languages. A reworded notice stops matching rather
than being said in its old words. Messages with a variable or a link (plan limit,
allowance warning) are not registered and the subscription messages are unchanged.

## Policy

1. `WHATSAPP_LOCAL_AUDIO` is not exactly `1`, or the processing service is not
   configured: nothing changes.
2. Not a registered phrase (an AI answer, a menu): the ordinary path.
3. A registered phrase with a verified clip in the language the text is in: the
   clip is uploaded to the phone number's media store and sent as a voice note.
4. A registered phrase without a usable clip (not in the manifest, disabled,
   missing file, wrong size, wrong SHA-256, not an Ogg stream, service down): the
   **written** copy is sent. It is never synthesised and never said in another
   language.

The recording decision runs inside the delivery, after the inbound message is
claimed by its WhatsApp message id and after repeated replies are suppressed, so a
redelivered webhook neither speaks nor sends twice. It touches no entitlement,
allowance or VX path.

## Where the clips live

On the Data Hub's persistent disk, served read-only by the media processor at
`/datahub/file?dataset=voice-prompts&path=<id>.<language>.ogg` behind its token.
The dataset needs the Data Hub layout: `datasets/<group>/voice-prompts/versions/<v>/`
with a `current` pointer and a `MANIFEST.json`. No path is ever taken from a
caller and no directory is listed. Clips are Opus in Ogg, at most 512 KB each.

**Not done:** there are no clips yet, and nothing has been installed on the
server. `datahub.sh update` downloads datasets from official https addresses and
has no way to install local files; adding one is a server-side change that needs
approval.

## Making the clips (a separate, explicit step)

Nothing here spends money. A clip is a recording a person made, or a one-off
synthesis run on purpose and reviewed; either way it must be allowed to be stored
and used commercially and must not imitate a real person without written consent.

1. Record `<id>.<language>.ogg` for the ids in `LOCAL_RESPONSES` (Opus in Ogg).
2. `node scripts/local-audio/prepare.mjs <folder> --write` checks each file and
   prints the manifest lines (byte count, SHA-256, duration).
3. Paste them into `LOCAL_AUDIO_ASSETS`, open a PR.
4. Install the folder on the Data Hub as `voice-prompts`.
5. Set `WHATSAPP_LOCAL_AUDIO=1` on the Edge Function.

Unsetting the variable is the rollback.

## Checking without sending

`inspectRegistry()` reports what is registered, active, disabled and missing, and
every malformed manifest entry. It reads nothing from a disk and sends nothing;
the tests run it on every build. At runtime every clip is re-verified against the
manifest before it is sent.
