/**
 * Snapshot the service catalogue for the semantic indexer.
 *
 *   npx vite-node scripts/generate-services-index.ts
 *
 * `src/features/servicecenter/catalog.ts` remains the single source of truth.
 * The indexer is a Deno edge function and cannot import from `src/`, so the
 * derived records are written to JSON here.
 *
 * The output is generated, never hand-edited. `src/test/services-index.test.ts`
 * fails when it drifts, so a service added to the catalogue cannot silently
 * stay unindexed.
 */
import { writeFileSync } from "node:fs";
import { buildServicesIndex, SERVICES_INDEX_PATH } from "../src/features/servicecenter/servicesIndex";

const index = buildServicesIndex();
writeFileSync(SERVICES_INDEX_PATH, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`Wrote ${index.length} services to ${SERVICES_INDEX_PATH}`);
