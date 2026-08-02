# Visionex Arcade core

The Arcade core is the stable contract around every game. Legacy games keep their existing routes and components; `ArcadeGameExperience` adapts them to the shared lifecycle, settings, player data, rating, analytics, audio, visual assets, and accessibility layers.

## Add a game

1. Create the game component in `src/pages/games/NewGame.tsx` (or a self-contained folder for a larger engine).
2. Add one lazy `import()` in `core/gameLoaders.ts`.
3. Add its metadata and cover import to `catalog.ts`. `gameRegistry.ts` automatically produces the complete `GameDefinition`.
4. Add its route in `App.tsx`, wrapped in `GameEconomyGate` so the verified Arcade session contract applies.
5. Report finished scores through `useHighScore` or call `gameManager.recordScore`. Use `useGameEconomy().settleGameResult()` to submit the result for server verification. Opening or repeatedly playing a game never grants VX, and losses do not deduct VX.
6. Add game-engine unit tests and keyboard/screen-reader interaction tests.

No manager, catalog UI, analytics, settings, audio, or asset-manager code needs to change when adding the next game.

## Persistence

`PlayerGameDataRepository` is the offline/non-authoritative persistence boundary. XP, VX, achievements, tournament results and global scores are authoritative only after the Supabase RPC accepts them.

## Asset rules

Declare game assets in the registry. Use WebP/AVIF for raster covers, SVG for icons, explicit dimensions, `loading="lazy"`, and `decoding="async"`. Final audio belongs in licensed, high-quality Opus/MP3 assets and is loaded through `AdvancedAudioManager`; prototype tones are not part of this manager.
