# Video Studio — providers

Text-to-Video (`/services/ai-media-studio/video`) runs through the `video-studio`
edge function. The owner's `/video` command on WhatsApp runs through
`_shared/contentMedia.ts`. Both use **Luma**.

| Provider | Secret | Models | Durations | Orientations |
| --- | --- | --- | --- | --- |
| Luma (default) | `LUMA_API_KEY` | `ray-2`, `ray-flash-2` | 5 / 9 s | 16:9, 9:16, 1:1, 4:3, 3:4, 21:9, 9:21 |
| RunPod (explicit only, off) | `RUNPOD_API_KEY` + `RUNPOD_ENABLED=true` | — | — | — |

The client sends `provider: "auto"`, and `getProvider()` resolves it to Luma.
RunPod is never chosen by "auto".

## OpenAI Sora — retired 2026-09-24

OpenAI removed the Videos API and every `sora-2` model on **2026-09-24** with no
successor. Video moved to Luma on 2026-09-25:

- `getProvider("openai")` now refuses with a sentence rather than calling a
  404, so templates saved against Sora fail clearly. Their `sora-*` model is
  replaced with `ray-2` when a job is created on Luma.
- The `openai-video` registry row is `inactive`; `luma-video` is `active` on
  `ray-2` (migration `20261046000000`).
- `health-check` reports a missing `LUMA_API_KEY` as `missing`: without it no
  video can be made anywhere in the product.

## Luma request contract

From `docs.lumalabs.ai/reference/creategeneration` (read 2026-09-25):

- `POST https://api.lumalabs.ai/dream-machine/v1/generations`, bearer key.
- **`model` is required**: `"ray-2"` or `"ray-flash-2"`. The adapter once sent
  no model at all, which Luma refuses — so the "already wired" fallback would
  have failed on its first request.
- `duration` is `"5s"` or `"9s"`; the adapter maps a requested length of 7 s or
  more to `"9s"`, anything shorter to `"5s"`, and the UI only offers 5 and 9.
- `resolution` is `540p`, `720p`, `1080p` or `4k`; anything else becomes `720p`.
- States are `queued → dreaming → completed | failed`; the finished clip is
  `assets.video`, a public CDN URL, so downloads send no credential.
- Luma has no cancel endpoint; cancelling is local only.

## Adding another provider

Implement `VideoProvider` — `generateVideo`, `pollJob`, `cancelJob`,
`fetchAsset`, `publicAssetUrls` — in `supabase/functions/video-studio/index.ts`,
register it in `getProvider()`, and add its capabilities to `VIDEO_PROVIDERS`
in `src/lib/types/video-studio.ts` so the UI offers only what it accepts.
Generate one real clip with it before relying on it: a model listing is not a
health check.
