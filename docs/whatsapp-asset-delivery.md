# WhatsApp asset delivery

Every file Visionex puts in front of a WhatsApp sender goes through one function:
`deliverAsset()` in `supabase/functions/_shared/whatsappAssetDelivery.ts`
(Phase 2A, 2026-09-27).

```text
producer (bytes, or a URL on an allowed host)
  → preflight   type Meta takes · size Meta takes · bytes really are that type
  → upload      POST /{phone}/media            retried on 429 / 5xx / network (3 tries)
  → send        image | audio | video | document, retried the same way
  → fallback    a link, only if the producer gave one and the file could not go
  → result      delivered_image|audio|video|document · fallback_url · failed + reason
```

## What WhatsApp carries

Meta's published list (developers.facebook.com/docs/whatsapp/cloud-api/reference/media),
checked against Meta itself by `.github/workflows/whatsapp-media-acceptance.yml`
(one sample of every format the media processor makes, uploaded and deleted; nothing sent):

| Kind | Types | Limit |
|---|---|---|
| image | JPEG, PNG | 5 MB |
| audio | MP3, AAC, M4A, AMR, Ogg **Opus** | 16 MB |
| video | MP4, 3GP | 16 MB |
| document | PDF, TXT (also SRT/VTT subtitles, sent as text/plain), DOC/DOCX, XLS/XLSX, PPT/PPTX | 100 MB |

Refused at upload even as a generic file: WAV, FLAC, MOV, MKV, WebM, GIF, BMP, TIFF.
WebP is taken only as a sticker. Vorbis Ogg is refused by the signature check (Meta plays Ogg with Opus only).

## Rules a producer follows

- Hand over bytes when you have them. Give a URL only on a host you name in
  `allowedHosts`; nothing else is fetched (HTTPS only, no IP literal, no
  localhost, every redirect re-checked, 20 s deadline, byte cap while reading).
- Pass a caption in the sender's language (`deliveryCaption()`), and a
  `fallbackUrl` + `fallbackText` (`deliveryFallbackText()`) only for a link that
  is safe to show and outlives the conversation.
- A delivery failure is not a generation failure. Do not regenerate because
  delivery failed unless nothing was stored (the conversion queue keeps nothing
  by design, so it retries the whole job — rare now that delivery retries first).
- Delivery charges nothing. Metering stays where the producer already does it.
- Log `deliveryLogFields(result, source, mime)` under `asset_delivery`: no URL,
  number, token or media id.

## Flows on it today

| Flow | Producer | Notes |
|---|---|---|
| File conversion | VPS media processor | menu offers only deliverable formats; too large → sender told |
| Translated subtitles | translation job | .srt/.vtt sent as text/plain, name kept |
| Songs | iTunes preview / Commons | `fetchAudio` keeps the song hosts' allowlist |

Not on it (by design): spoken replies (`whatsappVoiceReply.ts`, a voice-note path
with its own cache and recording), and owner social previews, which send public
bucket images by link because the same URL is what Meta's publishing fetches.

## For the next phases

Library files and generated documents are producers: store the file, then call
`deliverAsset()` with its bytes (service-role download from private storage —
never a signed link to the sender) and, if a durable public link exists, a
`fallbackUrl`. Check entitlement and `license_type` before delivery, not after.

## Known residual risk

A send retried after a 5xx may, rarely, duplicate a message Meta had in fact
accepted. It is the same policy the text sender has always used; a retry is
only ever of a transient status.
