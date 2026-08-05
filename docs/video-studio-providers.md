# Video Studio — providers and the September 2026 deadline

Text-to-Video (`/services/ai-media-studio/video`) runs through the `video-studio`
edge function, which supports two providers behind one interface.

| Provider | Secret | Models | Durations | Orientations |
| --- | --- | --- | --- | --- |
| OpenAI Sora (default) | `OPENAI_API_KEY` | `sora-2`, `sora-2-pro` | 4 / 8 / 12 s | 16:9, 9:16 |
| Luma Dream Machine | `LUMA_API_KEY` | `dream-machine` | up to 10 s | all ratios |

The client sends `provider: "auto"`, and `getProvider()` picks OpenAI when
`OPENAI_API_KEY` is set, otherwise Luma. This is deliberate: Text-to-Video runs
on the same OpenAI key that Speech Studio and Image Studio already use, so it
needs no extra provider account, and switching providers is a secret change
rather than a code change.

## ⚠️ Deadline: 2026-09-24

OpenAI announced on **2026-03-24** that the Videos API and every `sora-2` model
alias (`sora-2`, `sora-2-pro`, `sora-2-2025-10-06`, `sora-2-2025-12-08`,
`sora-2-pro-2025-10-06`) are **removed from the API on 2026-09-24**. OpenAI has
not announced a successor video model.

When that lands, Sora generations start failing with a 404 and the studio must
be pointed elsewhere. Two options, in order of effort:

1. **Set `LUMA_API_KEY`** in Supabase → Project Settings → Edge Functions →
   Secrets. The Luma path is already implemented and tested; `getProvider()`
   falls through to it automatically once the OpenAI key stops working, and it
   is used immediately if you also unset `OPENAI_API_KEY`.
2. **Add a new provider class** (Runway, Kling, Veo, Pika…) in
   `supabase/functions/video-studio/index.ts`. Implement `VideoProvider` —
   `generateVideo`, `pollJob`, `cancelJob`, `fetchAsset`, and `publicAssetUrls` —
   then register it in `getProvider()` and add its capabilities to
   `VIDEO_PROVIDERS` in `src/lib/types/video-studio.ts` so the UI offers only
   the durations and aspect ratios it accepts.

`health-check` reports this: while `OPENAI_API_KEY` is set and `LUMA_API_KEY` is
not, the Luma component returns `ok` with a reminder about the shutdown date.

## Provider contract notes

- **`publicAssetUrls`** — Luma returns public CDN links; OpenAI returns
  `/v1/videos/{id}/content` URLs that need our API key and expire about an hour
  after generation. When a provider's assets are private, the job is marked
  **failed** if the upload to the `video-outputs` bucket does not succeed,
  because there is no URL we could hand the browser instead.
- **`fetchAsset`** — always use this rather than a bare `fetch` when downloading
  a provider asset; it attaches provider auth where required.
- **Sora constraints** — `seconds` must be `"4"`, `"8"` or `"12"` and `size` one
  of `720x1280`, `1280x720`, `1024x1792`, `1792x1024` (the wide pair is
  `sora-2-pro` only). The provider snaps out-of-range values rather than
  forwarding a request the API would reject, and the UI only offers valid ones.
- **Cancel** — Sora has no cancel endpoint, so an explicit user cancel deletes
  the generation. Luma has neither, so cancelling is local only.
