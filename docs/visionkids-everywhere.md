# VisionKids Everywhere — Multi-Platform & Offline (Phase 18)

Developer guide for the multi-platform + offline layer. The goal: **one shared
web core** runs on Web, PWA, and native wrappers, with robust offline support
and cross-device sync — no business logic duplicated per platform.

## 1. Architecture

Layers are kept separate so platforms differ only at the edges:

| Layer | Where | Notes |
|---|---|---|
| UI | `src/features/visionkids/**/pages`, `**/components` | React + Tailwind; responsive (mobile/tablet/desktop) + TV mode |
| Business logic | `**/hooks`, `**/services`, `everywhere/*` | Platform-agnostic |
| Data | `services/**` over Supabase; `everywhere/offlineDb.ts` (IndexedDB) | |
| Auth | Supabase Auth (shared) | |
| Offline | `everywhere/offlineDb.ts`, `everywhere/modes.ts` | IndexedDB + localStorage |
| Sync | `everywhere/syncEngine.ts` + `kids_sync_queue`/`kids_sync_events` | |

**Rule:** native wrappers import the same `src/` core. They only provide a
shell + set `window.__VISIONKIDS_PLATFORM__` (see `everywhere/platform.ts`).

## 2. PWA

- `public/manifest.webmanifest` — installability (linked from `index.html`).
- `public/sw.js` — **intentionally minimal**: precaches only `/offline.html`
  and serves it on failed navigations. It does **not** cache JS/CSS/hashed
  build assets, because the app has a chunk-reload recovery path
  (`src/main.tsx`) that a stale-asset SW would fight. Richer offline content is
  served from IndexedDB by the app, not the SW.
- `everywhere/registerServiceWorker.ts` — registers in **production only**;
  emits `visionkids:sw-update` when a new version is waiting (wire a toast to
  it and call `applyServiceWorkerUpdate`).
- **Proper icons:** replace the `favicon.png` references in the manifest with
  dedicated 192/512 maskable PNGs before shipping.
- **Push:** `sw.js` has a `push` handler, but real push needs VAPID keys + a
  backend sender (Supabase Edge Function). That's the integration point.

## 3. Offline strategy

- **Small flags** → `localStorage` (`everywhere/modes.ts`: low-data, TV mode).
- **Structured/large data** → IndexedDB via `everywhere/offlineDb.ts` (stores:
  `syncQueue`, `downloads`, `drafts`, `cache`).
- Offline-capable features: stories, downloaded audio/lessons/games, quizzes,
  worksheets, progress, achievements, daily tasks, creative drafts.
- **Accessibility offline:** audio stories/games, downloaded lessons, and
  screen-reader + keyboard navigation must keep working with no network. Keep
  audio assets in the downloads store; never gate a11y behind a network call.

## 4. Sync strategy

`everywhere/syncEngine.ts`:
1. `queueChange(entity, id, op, payload)` appends to IndexedDB `syncQueue`
   (works offline).
2. On reconnect (or app open), `flush()` pushes each item to the durable
   server `kids_sync_queue` and deletes the local copy only after success — so
   a change survives a mid-sync tab close.
3. Every run logs `sync_start` / `sync_complete` / `sync_failed` to
   `kids_sync_events` (append-only).

Synced entities: reading/game progress, XP, coins, achievements, lessons, quiz
results, projects, favorites, bookmarks, settings.

## 5. Conflict resolution

`resolveConflict(entity, local, remote)`:
- **Last-write-wins** by `updatedAt` timestamp.
- The losing version is **never dropped silently** — it's logged as
  `conflict_kept_both` (with full payload) so it can be recovered/merged.
- Handles: same account on two devices, multiple offline edits, stale data,
  progress conflicts.

## 6. Device management

- `register_kids_device` on load (records name/platform/app version, opens a
  session); `touch_kids_device` heartbeats `last_active`.
- `My Devices` page lists devices; `sign_out_kids_device` /
  `sign_out_all_kids_devices` revoke sessions + delete device rows. (Full token
  revocation depends on Supabase Auth session management — treat these as the
  app-level device registry; pair with Supabase session revocation for a hard
  sign-out.)

## 7. Platform strategy & adding a platform

1. Create the wrapper project (see below) that hosts the built web app.
2. In the wrapper's web view bootstrap, set
   `window.__VISIONKIDS_PLATFORM__ = "android" | "ios" | "windows" | "macos" | "tv"`.
3. That's it — the core reads platform via `everywhere/platform.ts`; no feature
   code changes.

| Target | Recommended wrapper |
|---|---|
| Android / iOS | **Capacitor** (`@capacitor/android`, `@capacitor/ios`) around the built `dist/` |
| Windows / macOS | **Tauri** or Electron |
| Android TV / Smart TV | Capacitor TV build / webOS/Tizen packaging; enable TV Mode |

TV Mode (`everywhere/modes.ts` → `data-kids-tv`) gives large text, remote/focus
navigation, and audio feedback; it never depends on touch.

## 8. Testing checklist

Online→offline, offline→online, device switching, conflict resolution,
interrupted sync, large downloads, low storage, slow network, accessibility
(NVDA/JAWS/VoiceOver/TalkBack + keyboard), and every form factor
(mobile/tablet/desktop/TV).

## 9. Deployment

- Deploy the web build as usual. The SW auto-updates (`skipWaiting` +
  `visionkids:sw-update`).
- Apply the Phase 18 migration (`supabase/migrations/20260824000000_kids_everywhere.sql`)
  and regenerate Supabase types.
- Build native wrappers from the same `dist/` per the table above.
