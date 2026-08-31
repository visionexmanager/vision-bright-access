/**
 * Snapshot the assistive equipment reference for the Commerce Agent.
 *
 *   npx vite-node scripts/generate-assistive-index.ts
 *
 * `src/data/assistiveProducts.ts` remains the single source of truth. The
 * agent is a Deno edge function and cannot import from `src/`, so the derived
 * records are written to JSON here.
 *
 * The output is generated, never hand-edited.
 * `src/test/assistive-index.test.ts` fails when it drifts, so equipment added
 * to the reference cannot silently stay unfindable.
 */
import { writeFileSync } from "node:fs";
import { ASSISTIVE_INDEX_PATH, buildAssistiveIndex } from "../src/features/commerce/assistiveIndex";

const index = buildAssistiveIndex();
writeFileSync(ASSISTIVE_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`Wrote ${index.length} assistive products to ${ASSISTIVE_INDEX_PATH}`);
