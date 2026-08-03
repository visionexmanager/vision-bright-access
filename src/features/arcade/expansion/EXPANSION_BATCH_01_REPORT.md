# Visionex Arcade expansion — batch 01

Release date: 2026-08-03

## Result

- Existing published games retained: 22
- New tested games published in batches 01–13: 59
- Total published Arcade games: 81
- Maintained future-game roadmap: 251 unique games
- Supported catalog categories: 32

The roadmap is not rendered in the public catalog. Every roadmap entry starts with all five release gates set to `planned`; `releaseGate.ts` blocks it until gameplay, graphics, audio, performance, and accessibility are individually approved.

## Published games

| Game | Route | Engine | Input and accessibility | Visual asset |
|---|---|---|---|---|
| 2048 | `/games/2048` | Tested move, merge, score and game-over logic | Arrow keys, touch controls, semantic grid, spoken move status | Original 1920×1080 SVG |
| Minesweeper | `/games/minesweeper` | Tested mine placement and safe flood reveal | Keyboard cell navigation, Enter/Space, F to flag, touch/pointer, per-cell labels | Original 1920×1080 SVG |
| Connect Four | `/games/connect-four` | Tested drop and four-direction win detection, tactical local opponent | Keyboard-operable semantic grid, touch/pointer, live turn status | Original 1920×1080 SVG |
| Reaction Test | `/games/reaction-test` | Randomized wait and high-resolution response timing | Space/Enter, touch/pointer, visual and assistive-audio signal | Original 1920×1080 SVG |

All four routes are lazy imports and share a split expansion runtime chunk. None of the game code is loaded when `/games` first opens. Covers are scalable local vectors; there are no remote URLs, placeholders, temporary graphics, or raster-resolution limits.

## Existing systems preserved

Each new game is wrapped in `GameEconomyGate` and `ArcadeGameExperience`. This retains authenticated secure sessions, server-verified result submission, anti-repeat settlement, Game Manager lifecycle, local score/save data, achievements, leaderboard integration, XP/VX eligibility, global settings, audio accessibility announcements, graphics profiles, favorites, ratings, and analytics.

## Quality verification

- TypeScript: passed (`tsc --noEmit`)
- Targeted ESLint: passed
- Full Vitest suite: 24 files, 87 tests passed
- Production Vite build: passed; 6,586 modules transformed
- New engine tests: 4 passed
- Visual registry test: every published game has approved cover/thumbnail/background entries
- Route integrity test: every published card destination maps to an application route

## Requires future improvement or human verification

- Manual NVDA, JAWS, VoiceOver, and TalkBack certification is explicitly deferred to the project owner and is not an automated release gate. Semantic structure, keyboard operation, live status, and audio-event implementation remain required in code.
- Produce dedicated licensed sound packs and music for each new title. Until then they use the existing approved shared Arcade UI/accessibility audio layer; no placeholder or cartoon audio was added.
- Validate VX reward thresholds and leaderboard policies with production telemetry before enabling game-specific reward campaigns.
- Profile low-memory Android and older iOS devices in the production CDN environment.
- The remaining roadmap candidates must stay unpublished until gameplay, graphics, audio, and performance gates pass, plus an automated accessibility implementation review. Manual assistive-technology certification is deferred.

## Batch 02

Nine additional playable routes were added: Tic Tac Toe, Typing Speed, Math Challenge, Simon Says, Trivia, Geography Quiz, Science Quiz, History Quiz, and Blind Maze. The batch adds tactical board AI, deterministic math generation, timed typing measurement, progressive memory sequences, four maintained question banks, and audio-guided maze navigation. The full suite now passes 90 tests across 25 test files.

## Batch 03

Six additional playable routes were added: Sudoku, Nonogram, Mastermind, Word Search, Color Match, and Audio Direction. Rule engines cover Sudoku solution validation, Nonogram completion, duplicate-safe Mastermind scoring, and maintained word-grid lookup. The full suite now passes 94 tests across 26 test files. These games reuse approved production visual packs from the matching Logic, Word, Reaction, and Audio families; dedicated covers remain a visual differentiation improvement, not placeholder remediation.

## Batch 04

Four additional playable board routes were added: Reversi, Checkers, Peg Solitaire, and Battleship. The tested engine pack implements eight-direction Reversi capture, checker movement and jumping, orthogonal peg jumps, and immutable fleet-hit state. The full suite now passes 98 tests across 27 test files.

## Batch 05

Four sports and skill routes were added: Mini Golf, Bowling, Archery, and Darts. A tested scoring engine handles calibrated power/aim distance, golf strokes, bowling pins, archery rings, and dartboard sectors including bullseye, double, and triple rings. The full suite now passes 103 tests across 28 test files.

## Batch 06

Four dispatch simulations were added: Airport Manager, Traffic Control, Train Dispatcher, and Harbor Manager. They share a tested event engine for deadlines, priorities, safe resource assignments, emergency ordering, scoring, and safety degradation while retaining distinct operational scenarios and resources. The full suite now passes 107 tests across 29 test files. The production build completes successfully; existing large language/editor chunks still emit Vite size advisories, while each new simulation remains lazy-loaded.

## Batch 07

Four bilingual children's learning routes were added: Letters Learning, Numbers Learning, Shapes Learning, and Matching Studio. A tested learning engine handles answer scoring, skill attribution, stable choice sets, and mastery stars. Arabic/English prompts are explicitly language-tagged, keyboard and touch input are equivalent, and progress is submitted through the existing secure game session. The full suite now passes 111 tests across 30 test files.

## Batch 08

Four language routes were added: Crossword, Anagram Arena, Word Ladder, and Spelling Master. The tested word engine normalizes safe letter input, checks maintained clues, validates non-identical anagrams without losing letters, and enforces one-letter ladder transitions. Spelling prompts use the approved shared accessibility voice layer until a dedicated human narration pack is produced. The full suite now passes 115 tests across 31 test files.

## Batch 09

Four management routes were added: Restaurant Manager, Farm Manager, City Builder, and Delivery Simulator. The tested management engine enforces affordability, advances operational turns, caps bounded resource ratios, applies recurring income, and evaluates safety and performance outcomes. A pre-existing VisionKids component also used the `CityBuilder` symbol; the Arcade route reference was explicitly renamed `ArcadeCityBuilder` to prevent a production-build collision. The full suite now passes 119 tests across 32 test files.

## Batch 10

Four classic Arcade routes were added: Snake, Block Stacker, Breakout, and Bubble Shooter. The tested engine pack covers snake movement, food growth and collision; block placement and full-row clearing; nearest live brick selection; and connected bubble-group removal with a minimum group size. Each game exposes semantic grid state and keyboard/touch controls. The full suite now passes 124 tests across 33 test files.

## Batch 11

Four maintained quiz routes were added: Technology Quiz, Nature Quiz, Space Quiz, and Sports Quiz. Their independent topic banks contain four-answer questions with validated answer indices, unique choices, and no duplicated questions across topics. They reuse the lazy Knowledge Quiz runtime and approved Quiz visual pack. The full suite now passes 127 tests across 34 test files.

## Batch 12

Four audio-first routes were added: Audio Memory, Sound Hunt, Echo Locator, and Rhythm Navigation. The tested engine pack covers immutable cue sequences, partial and complete sequence input, physical echo-distance estimation, rhythm tolerance, and attempt-based hunt scoring. These routes currently use the approved shared speech/accessibility layer. Dedicated binaural cues, environmental recordings, and mastered rhythm samples remain explicitly scheduled production assets. The full suite now passes 132 tests across 35 test files.

## Batch 13

Four interactive physics labs were added: Balance Lab, Pendulum Puzzle, Trajectory Master, and Magnet Lab. The tested engine covers torque equilibrium, pendulum period, ideal projectile range, attraction/repulsion magnitude, and error-based scoring. Each lab exposes numeric control values and result status without relying solely on animation. The full suite now passes 137 tests across 36 test files.

## Additional candidates discovered

## Batch 14

Four arena sports routes were added: Penalty Shootout, Basketball Challenge, Table Tennis, and Air Hockey. Their tested shared engine evaluates goalkeeper separation, distance-calibrated basketball power, open-court table-tennis placement, and air-hockey shooting lanes. Each eight-round session reports opponent state and shot quality as text, supports keyboard-operable sliders and touch, and settles score, XP, VX, achievements, and saved session state through the existing Arcade systems. The approved shared visual and audio systems are used pending dedicated sport-specific production packs. The complete suite now passes 141 tests across 37 test files, and the production build succeeds with all four routes emitted through dynamic imports.

## Batch 15

Four music-training routes were added: Rhythm Keys, Melody Memory, Beat Matcher, and Piano Trainer. A tested shared engine maintains concert-pitch note frequencies, melody-prefix validation, timing accuracy, deterministic lessons, and note-by-note lesson scoring. The runtime generates clean Web Audio oscillator tones with controlled gain envelopes and falls back to the existing accessibility announcement layer when Web Audio is unavailable. Each route is keyboard/touch operable and uses the existing score, XP, VX, achievement, and saved-session systems. The complete suite now passes 145 tests across 38 test files, and the production build succeeds after transforming 6,674 modules with every new route code-split.

## Batch 16

Four drawing and design routes were added: Symmetry Sketch, Pixel Canvas, Shape Designer, and Pattern Artist. A tested immutable grid engine handles painting, mirrored coordinates, symmetry scoring, bounding-box measurement, and maintained pattern comparison. The six-by-six canvases expose every cell as a named keyboard-focusable grid cell, making creation possible without pointer dragging. Each game reports its result textually and uses the existing score, XP, VX, achievement, settings, and saved-session systems. The complete suite now passes 149 tests across 39 test files, and the production build succeeds after transforming 6,680 modules with every new route code-split.

## Batch 17 — 100-game milestone

Seven resource-management games were added: Lemonade Stand, Space Miner Idle, Factory Idle, Aquarium Keeper, Garden Planner, Museum Curator, and Wildlife Rescue. A tested shared loop engine enforces affordability, bounded quality and reputation, capacity-limited operations, inventory consumption, daily income, scoring, and win/loss resolution. Each game has independent content and route while reusing the maintainable engine and existing score, XP, VX, achievement, settings, and saved-session systems. These additions bring the playable catalog to exactly 100 games. The complete suite now passes 153 tests across 40 test files, and the production build succeeds after transforming 6,689 modules with all seven routes code-split.

## Batch 18

Four classic tile and card routes were added: Solitaire, Spider Solitaire, FreeCell, and Mahjong. The tested shared engine applies alternating-color descending stacks, same-suit Spider stacks, immutable column moves, deterministic deals, free-edge Mahjong detection, and matching-pair removal. Every exposed card and tile has a complete text label and is selectable through standard keyboard buttons. These additions bring the playable catalog to 104 games. The complete suite passes 268 tests across 48 test files, and the production build succeeds after transforming 6,712 modules with all four routes code-split.

Recommended additions beyond the original list: Go, Shogi, Xiangqi, Cribbage, Euchre, Canasta, billiards, volleyball, cricket batting, cycling time trial, sailing tactics, accessible audio tennis, braille learning challenges, sign-language matching, cybersecurity puzzles, sustainable-city planning, emergency-dispatch simulation, cooperative escape challenges, marine conservation, public-transport planning, and renewable-grid control. These remain candidates and are not presented as released games.
