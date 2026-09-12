/**
 * Snapshot the Arcade catalogue for the WhatsApp channel.
 *
 *   npx vite-node scripts/generate-games-index.ts
 *
 * `src/features/arcade/catalog.ts` remains the single source of truth. The
 * WhatsApp webhook is a Deno edge function and cannot import from `src/`, so
 * the derived records are written to JSON here.
 *
 * The output is generated, never hand-edited. `src/test/games-index.test.ts`
 * fails when it drifts, so a game added to the catalogue cannot silently stay
 * unreachable from the chat window.
 */
import { writeFileSync } from "node:fs";
import { buildGamesIndex, GAMES_INDEX_PATH } from "../src/features/arcade/gamesIndex";

const index = buildGamesIndex();
writeFileSync(GAMES_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`Wrote ${index.games.length} games and ${index.categories.length} categories to ${GAMES_INDEX_PATH}`);
