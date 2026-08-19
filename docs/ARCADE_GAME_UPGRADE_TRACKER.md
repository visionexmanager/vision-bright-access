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

## Cycle 0 side fix — image priority hint

`fetchPriority` is a React 19 prop. On React 18 it is logged as an unknown-prop
error and dropped, so every Arcade game page, every game card and two hero images
asked for a priority they never received, and each game page opened with a console
error. `ArcadeVisual` now emits the lowercase HTML attribute; verified present in
the DOM in a browser. Found while playing a game in the dev lab, which is exactly
what browser verification is for.

## Dev tooling — the Arcade lab

`GameEconomyGate` requires a signed-in Supabase session, so before this a developer
could not open any game locally and every gameplay change had to be judged from
source. `arcade-lab.html` plus `src/dev/ArcadeLab.tsx` mount one game in the real
shell — real `gameManager`, real accessibility provider, real pause and restart —
reachable at `/arcade-lab.html?game=<slug>` under `npm run dev`. Vite's only build
input is `index.html`, so the page is never built or deployed; confirmed absent
from `dist`. The economy gate is the one thing it cannot reproduce, so
server-settled results stay covered by tests rather than by the lab.

## Cycle 1 — Snake (`snake`)

| Item | Detail |
| --- | --- |
| Status | **PRODUCTION READY** |
| Initial status | Playable but broken. One minified line inside `ClassicPackGames.tsx`. |
| Problems found | Pressing the opposite arrow steered into the snake's own neck and ended the round instantly — confirmed live in a browser, not just read from source. Food walked a fixed diagonal (`x+5, y+3`), so it repeated every round and could land inside the snake. Speed was a constant 350 ms with no levels and no progression. After a crash the Start button resumed the dead board with the score intact — there was no reset. A window-level key listener swallowed the arrow keys for the whole page whether or not the game was in play. All 144 grid cells carried an `aria-label`, so a screen-reader user had to traverse the entire board to learn anything, and head, body and food differed by colour alone. No sound at all. The touch pad was hidden at and above the `sm` breakpoint. The catalogue entry reused Neon Breach's cover art. |
| Changes made | New seeded engine (`src/lib/games/snakeEngine.ts`): a turn queue that refuses reversals — including reversal of a turn still queued — free-cell food placement, growth, six levels, a speed ramp with a floor, obstacle walls from level 3 that are never placed straight ahead of the head, a freshness scoring bonus, and a win at 30 bites. New component: focusable board, arrows plus WASD, swipe, an always-visible direction pad, Space to replay, B to speak the board. The board is a single `role="img"` carrying the whole state as its accessible name with the cells hidden from assistive technology, and every occupied cell also carries a glyph so no state is colour-only. An audio-guidance toggle announces bites, level ups and hazards *before* impact. Six generic arcade sound cues were added to `useGameSounds` for the rest of the expansion library to reuse. The game honours the shell pause through `useArcadeGameLoop`. An original 1920×1080 cover was authored for it, replacing the borrowed art, with provenance recorded. Catalogue copy, controls list and release notes now describe what the game actually does. |
| Tests | 25 engine tests including a 40-seed invariant run, and 19 component tests covering launch, reversal refusal, WASD, the direction pad, the spoken description, wall loss, the win path, replay, score agreement with the runtime, pause, unmount cleanup and the accessibility surface. Run four times to confirm stability. |
| Browser verification | Played in Chrome through the dev lab: reversal refused, food eaten, HUD and progress bar tracking, self-collision reported with its cause, replay resetting to a fresh seeded board, shell pause freezing the game and swallowing input, no horizontal overflow at 375 px or 1280 px, direction-pad targets 75×56 px against the 44 px minimum. |
| Not verified | The result overlay and VX settlement need a signed-in Supabase session, which the lab cannot provide; those paths are covered by `arcade-economy-settle.test.tsx` instead. No manual screen-reader session (NVDA, JAWS, VoiceOver, TalkBack) has been run — the automated checks do not replace one. |
| Result | build PASS · typecheck PASS · lint PASS · 1453 tests PASS (only the pre-existing Windows CRLF failure) · console errors 0 · broken assets 0 |
| Commit | `feat(arcade): production upgrade for snake` |

## Games

| # | Game | Slug | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Snake | `snake` | **PRODUCTION READY** | Rebuilt on a seeded engine — see Cycle 1. |
| 2 | Breakout | `breakout` | NOT STARTED | Next. Advertised as Breakout but has no ball, paddle or physics — the player clicks a column to delete a brick. |
| 3 | Block Stacker | `block-stacker` | NOT STARTED | No falling piece, no rotation, no gravity; the player clicks a column pair. |
| 4 | Bubble Shooter | `bubble-shooter` | NOT STARTED | No shooter and no aiming; it is a match-3 tap-to-pop grid. |
| — | remaining 112 games | — | NOT STARTED | Audited during their own cycle. |

Games are ordered worst-first: no-ops and crashes, then games whose implementation does
not match the game they claim to be, then placeholder-heavy ones, then polish.
