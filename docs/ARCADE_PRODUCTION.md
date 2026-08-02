# Visionex Arcade — Production Operations Guide

## Architecture

`catalog.ts` is the public game catalogue. `gameRegistry.ts` enriches each entry with loaders, settings and assets. `GameEconomyGate` creates the secure session; `ArcadeGameExperience` owns the shared UI, lifecycle, accessibility, settings and analytics. The browser is never authoritative for XP, VX, achievements, tournament ranks or rewards. Supabase SECURITY DEFINER RPCs validate and record those operations.

## Add a game

1. Create a keyboard-operable React game under `src/pages/games`.
2. Add its lazy loader to `src/features/arcade/core/gameLoaders.ts`.
3. Add complete metadata to `src/features/arcade/catalog.ts`.
4. Register an `AuthGuard` + `GameEconomyGate` route in `src/App.tsx`.
5. Report score and outcome through the Arcade runtime. Competitive games must provide an integrity adapter and deterministic replay validator before tournament eligibility.
6. Add engine, keyboard, reduced-motion and screen-reader contract tests.

## Audio

Add files only after provenance and commercial rights are recorded in `audioLibrary.ts`. Provide Opus and MP3 sources, normalize effects near -18 LUFS, narration near -16 LUFS and music near -23 LUFS. The quality gate intentionally blocks missing, preview or unlicensed sources. Update `AUDIO_PRODUCTION.md` and run `audioQuality.test.ts`.

## Visual assets

Add an AVIF primary source plus WebP fallback, explicit intrinsic dimensions, meaningful cover alt text and an empty alt for decorative thumbnails/backgrounds. Covers target at least 1600×900; thumbnails target 800×450. Register them in `visualRegistry.ts` and run `visualQuality.test.ts`.

## Achievements, missions and rewards

Achievements are defined in `arcade_achievement_definitions`. Missions and rewards are created by administrators through protected RPCs. A reward needs a stable code, eligible server event, claim ceiling, cooldown and idempotency key. Never call `award_points` for a game reward.

## Tournaments

Create tournaments from `/admin/arcade-economy`. Use `draft → scheduled → active → verifying → completed`. Only accepted result submissions may update rankings. Keep prize settlement disabled until replay validation and fraud review finish.

## Accessibility release gate

- Complete keyboard play without pointer input.
- Visible focus, no focus trap, no color-only status, 4.5:1 normal-text contrast.
- Reduced-motion mode and independent audio channels.
- Test current NVDA/Firefox, JAWS/Chrome, VoiceOver/Safari and TalkBack/Chrome using `accessible/ACCESSIBLE_TEST_PLAN.md`.
- Record tester, browser, assistive-technology version, failures and evidence. Automated DOM tests do not replace these sessions.

## Security and operations

Apply migrations in timestamp order. Regenerate Supabase types. Verify RLS using owner, second user, anonymous and admin sessions. Run concurrent idempotency tests against reward, daily login and shop RPCs. Scores, integrity hashes and replay payloads require per-game bounds. Monitor rejected results, unusual input rates, repeated devices and reward velocity.

## Backup and restore

- Supabase database: enable daily managed backups and point-in-time recovery. Retain daily 30 days and monthly 12 months.
- Assets/audio: version the source assets, replicate the production storage bucket daily and retain immutable manifests/checksums.
- Configuration: keep migrations and environment-variable names in Git; keep secret values in the hosting secret manager.
- Record every backup in `arcade_backup_runs`.
- Quarterly restore drill: restore to an isolated project, apply integrity queries, test authentication, one game result, one reward and one inventory read, then mark the run `verified`.

## Monitoring

The client records bounded local runtime, request, asset and long-task events. Production ingestion must authenticate, rate-limit and redact messages before inserting `arcade_runtime_events`. Configure alerts for reward anomalies, rejected-result spikes, broken assets, failed requests and error-rate regressions. Do not put tokens, email addresses or replay secrets in monitoring messages.

## PWA and offline behavior

The service worker caches only the offline fallback to avoid stale hashed chunks. Offline play may store non-authoritative progress for games that explicitly support it. Scores and VX are never queued for background replay. Push notifications require explicit permission, VAPID configuration and a server sender.

## Release checklist

1. Audio and visual quality gates have zero blocked assets.
2. Full unit/integration suite, lint and production build pass.
3. Browser/device matrix and four assistive-technology sessions are signed off.
4. Migrations pass in staging; RLS and abuse tests pass.
5. Backup and restore drill passes.
6. Monitoring and alerts receive a synthetic incident.
7. Release branch is reviewed, merged, tagged and deployed; post-deploy smoke tests pass.

