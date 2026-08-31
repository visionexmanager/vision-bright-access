// The assistive equipment reference, as a source.
//
// No key, no approval, no merchant, no network call: the records are committed
// to the repository and read from a JSON snapshot, the same way the service
// catalogue is indexed rather than duplicated into a table.
//
// Regenerate after editing `src/data/assistiveProducts.ts`:
//   npx vite-node scripts/generate-assistive-index.ts
// `src/test/assistive-index.test.ts` fails if the snapshot drifts.

import type { RawResult, SourceAdapter, SourceRecord, SourcingIntent } from "../types.ts";
import { searchAssistive, type AssistiveRecord } from "./assistiveGuideMapping.ts";
import assistiveCatalog from "../../data/assistiveCatalog.json" with { type: "json" };

const RECORDS = assistiveCatalog as AssistiveRecord[];

/** Answer in the language the question was asked in. */
function languageOf(query: string): string {
  return /[؀-ۿ]/.test(query) ? "ar" : "en";
}

export const assistiveGuideAdapter: SourceAdapter = {
  slug: "visionex-assistive-guide",

  search(intent: SourcingIntent, _source: SourceRecord, limit: number): Promise<RawResult[]> {
    return Promise.resolve(searchAssistive(RECORDS, intent, limit, languageOf(intent.query)));
  },
};
