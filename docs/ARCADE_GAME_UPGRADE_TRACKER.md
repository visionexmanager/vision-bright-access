# Visionex Arcade — game-by-game production upgrade tracker

One game per cycle: **Inspect → Run → Test → Analyze → Improve → Test again → Fix →
Validate → Commit → Next**. A game is only marked `PRODUCTION READY` when every gate
below has real evidence. If a gate cannot be met, the reason is recorded — never a
claimed pass.

Per-game quality gate: build · typecheck · lint · tests · launch · core gameplay ·
restart · win/loss · pause · keyboard · mobile · accessibility · zero console errors ·
zero broken assets.

Status vocabulary: `NOT STARTED` · `IN PROGRESS` · `BLOCKED` · `PRODUCTION READY`.

## Library snapshot (2026-08-19)

- 117 catalogue entries in `src/features/arcade/catalog.ts`; 116 distinct loaders in
  `src/features/arcade/core/gameLoaders.ts` (the four quiz variants share `KnowledgeQuiz`).
- 23 games have their own page under `src/pages/games/`; the remaining ~93 are one-line
  re-exports pointing into bundled "pack" files under `src/pages/games/expansion/`, where
  several games share one minified source file and one engine module.
- Verified at baseline: `npm run typecheck` passes, `npx vitest run` passes (1289 tests,
  plus one Windows-only CRLF failure in `whatsapp-business-profile.test.ts` that predates
  this work), and all 116 loaders render without throwing (`arcade-game-smoke.test.tsx`).
- Therefore no game *crashes*. The real defects are the shared runtime (fixed below) and
  gameplay that is a placeholder rather than the game its catalogue entry advertises.

## Cycle 0 — shared runtime (blocks every game)

| Item | Detail |
| --- | --- |
| Status | **PRODUCTION READY** |
| Problems found | 1. `GameEconomyGate` closed its settle lock permanently: after one win or loss, every later round in the same visit reported nothing — no result overlay, no session record, no VX — because `settledRef` was only reset when the route changed, and Restart does not change the route. 2. Pause only dimmed the game window to 40% opacity. Timers and key handlers kept running, so a real-time game carried on playing (and losing) behind the overlay, and the paused state had no accessible name. |
| Changes made | Reset the settle lock, session id, start time and input counter on the runtime restart revision. Added `useArcadeRuntime` / `useArcadePaused` / `useArcadeGameLoop` so games can honour the shell's pause. Replaced the silent dim with a labelled pause dialog carrying a Resume control, made the paused subtree inert, and swallowed keyboard input while paused (Escape, Tab and shell chrome excluded). |
| Tests | `arcade-economy-settle.test.tsx` (settles round 2 after a restart; verified failing before the fix), `arcade-runtime-lifecycle.test.tsx` (pause state, loop pauses/resumes, loop cleared on unmount, restart revision, score reset), `arcade-game-smoke.test.tsx` (all 116 loaders render). Test setup gained ResizeObserver / IntersectionObserver / canvas-2D stubs so component tests fail on the component, not on jsdom. |
| Result | typecheck PASS · lint PASS · 1411 tests PASS (only the pre-existing CRLF failure) |
| Commit | `fix(arcade): restore round settlement and make pause actually pause` |

## Games

| # | Game | Slug | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Snake | `snake` | NOT STARTED | Next. Deterministic food placement can land on the snake or repeat; speed never scales; no in-game restart or pause handling; on-screen controls hidden above the `sm` breakpoint only. |
| 2 | Breakout | `breakout` | NOT STARTED | Advertised as Breakout but has no ball, paddle or physics — the player clicks a column to delete a brick. |
| 3 | Block Stacker | `block-stacker` | NOT STARTED | No falling piece, no rotation, no gravity; the player clicks a column pair. |
| 4 | Bubble Shooter | `bubble-shooter` | NOT STARTED | No shooter and no aiming; it is a match-3 tap-to-pop grid. |
| — | remaining 112 games | — | NOT STARTED | Audited during their own cycle. |

Games are ordered worst-first: no-ops and crashes, then games whose implementation does
not match the game they claim to be, then placeholder-heavy ones, then polish.
