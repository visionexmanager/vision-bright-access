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

## Cycle 2 — Breakout (`breakout`)

| Item | Detail |
| --- | --- |
| Status | **PRODUCTION READY** |
| Initial status | Not Breakout at all. One minified line in `ClassicPackGames.tsx` with no ball, no paddle and no physics: the player clicked one of eight column buttons and the lowest brick in that column vanished. Forty clicks ended the round. The catalogue advertised paddle returns. |
| Problems found | The whole game was missing. Everything else followed from that: no lives, no levels, no aiming, no failure state other than a click counter, no sound, and the catalogue text described a game that did not exist. It also reused Neon Breach's cover art. |
| Changes made | New physics engine (`src/lib/games/breakoutEngine.ts`) in field units so the same physics run at any screen size: a ball with velocity, a paddle whose contact point sets the rebound angle, bricks with hit points, three lives, five levels that each add a row and speed, and a combo multiplier for bricks broken before the ball returns. The ball is integrated in sub-steps no longer than a third of its radius, so a slow frame cannot tunnel it through a brick or the paddle. The rebound angle is floored away from dead centre, because a perfectly vertical return locks the ball into one column and the level can never be cleared. New component driving it from `useArcadeAnimationFrame` — added alongside the interval loop for games with continuous motion — with arrows and A/D, drag-to-aim, tap-to-launch, Space to launch and replay, B to speak the board. The field is one `role="img"` carrying the state as its accessible name, brick damage is shown by pattern as well as colour, and an audio-guidance toggle calls the ball left or right as it comes down, throttled so it guides rather than chatters. Original cover authored, provenance recorded, catalogue copy, controls and release notes rewritten to match the real game. |
| Also fixed while building | The frame loop was gated on a ref, so holding an arrow key before launch moved nothing — nothing re-renders when a ref changes. Two different controls were both named "Launch"; the duplicate is gone and tapping the field launches instead. |
| Tests | 25 engine tests, including tunnelling under 250 ms frames and a bot that clears level one by aiming at the bricks still standing; 20 component tests covering launch, held-key paddle movement and release, A/D, the on-screen pad, the spoken description, brick breaking, losing a life, game over, the win, replay, score agreement with the runtime, shell pause and unmount cleanup. |
| Browser verification | Layout, cover, controls and paddle movement confirmed in Chrome at 1280 px and 375 px: field holds its 200:140 aspect, no horizontal overflow, controls 112×56 px, one Launch control, no console errors beyond the local missing-Supabase-env notice. |
| Not verified | **The ball in motion could not be watched in a browser in this environment.** The Browser pane does not composite, so `document.hidden` is true and `requestAnimationFrame` never fires — verified directly, 0 frames in 1 second. Motion, collisions, lives, levels and the win are covered by the jsdom component tests instead, which drive the same frame loop. As with Snake, the result overlay and VX settlement need a signed-in session and are covered by `arcade-economy-settle.test.tsx`. No manual screen-reader session. |
| Result | build PASS · typecheck PASS · lint PASS · 1497 tests PASS (only the pre-existing Windows CRLF failure) · console errors 0 · broken assets 0 |
| Commit | `feat(arcade): production upgrade for breakout` |

## Cycle 3 — Block Stacker (`block-stacker`)

| Item | Detail |
| --- | --- |
| Status | **PRODUCTION READY** |
| Initial status | Not a falling-block game. One minified line in `ClassicPackGames.tsx`: four buttons, each labelled with a pair of columns, dropped two cells to the bottom of that pair. No falling piece, no rotation, no gravity, no next piece, no speed, no game over other than a blocked column. |
| Problems found | The mechanic the genre is built on — a piece falling while you steer and turn it — did not exist. Nor did rotation, levels, a landing preview, a next-piece queue or a hard drop. Scoring was flat, so there was no reason to build for a multi-row clear. The catalogue reused the LogiQuest cover. |
| Changes made | New engine (`src/lib/games/blockStackerEngine.ts`): seven original shapes with rotation states de-duplicated so a symmetric piece never wastes a keypress, wall-nudging rotation, gravity, locking, row clears with a multi-row scoring table, levels every eight rows with a speed ramp and a floor, a landing preview and a hard drop that pays for the distance. New component driven by the shared interval loop so it honours the shell pause: arrows and WASD, Up or X to rotate, Space to drop, Enter to start or replay, B to speak the board, plus a five-button on-screen pad. The board is one `role="img"` carrying the state as its accessible name; every filled cell also carries a glyph. Original cover authored, provenance recorded, catalogue copy, controls and release notes rewritten. |
| Intellectual property | Falling-block puzzles are a genre, but nothing here is taken from another publisher's game: the piece set, palette, shape names, scoring table and presentation are Visionex's own, and no protected name, art or sound is used. Recorded in `ASSET_PROVENANCE.md`. |
| Found by browser testing | The board summary named the piece and its landing row but never said how far it still had to fall, so a player who cannot see it had no idea how long they had left to steer. It now says how many rows are left, and "About to lock" at the end. |
| Also fixed | On a phone the next-piece sidebar took a third of the width and squeezed the board to 16 px cells; below the `sm` breakpoint it is now a strip under the board, and cells are 28 px. |
| Tests | 25 engine tests, including a placement bot with a hole-and-height heuristic that clears rows across 200 turns while the grid invariants are checked every turn; 21 component tests covering start, gravity, movement, WASD, rotation, hard drop, the on-screen pad, the spoken description, row clears, game over, replay, frozen controls after the end, shell pause, unmount cleanup and the accessibility surface. |
| Browser verification | Played in Chrome through the dev lab: gravity closing the gap to the landing spot (16 → 14 → 13 → 12 rows), movement (columns 4–6 → 5–7 → 6–8), rotation narrowing the piece, the on-screen pad, pieces locking and the stack building, the new cover loading, no horizontal overflow at 375 px or 1280 px, no console errors beyond the local missing-Supabase-env notice. |
| Not verified | The result overlay and VX settlement need a signed-in session; covered by `arcade-economy-settle.test.tsx`. No manual screen-reader session. |
| Result | build PASS · typecheck PASS · lint PASS · 1542 tests PASS (only the pre-existing Windows CRLF failure) · console errors 0 · broken assets 0 |
| Commit | `feat(arcade): production upgrade for block stacker` |

## Games

| # | Game | Slug | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Snake | `snake` | **PRODUCTION READY** | Rebuilt on a seeded engine — see Cycle 1. |
| 2 | Breakout | `breakout` | **PRODUCTION READY** | Rebuilt with real physics — see Cycle 2. |
| 3 | Block Stacker | `block-stacker` | **PRODUCTION READY** | Rebuilt as a real falling-block game — see Cycle 3. |
| 4 | Bubble Shooter | `bubble-shooter` | NOT STARTED | Next. No shooter and no aiming; it is a match-3 tap-to-pop grid. |
| — | remaining 112 games | — | NOT STARTED | Audited during their own cycle. |

Games are ordered worst-first: no-ops and crashes, then games whose implementation does
not match the game they claim to be, then placeholder-heavy ones, then polish.
