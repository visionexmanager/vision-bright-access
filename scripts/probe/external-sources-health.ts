// Live probe of every external content provider in the registry, from wherever
// this runs. Prints one line per provider: state, latency, result count, and how
// many results carry a downloadable file. No key is read, so a keyed provider
// reports not_configured. Never prints a URL, a key or an item title.
//
//   deno run --no-lock --node-modules-dir=none -A scripts/probe/external-sources-health.ts
import { CONTENT_PROVIDERS } from "../../supabase/functions/_shared/externalContent/registry.ts";
import { checkAllProviders, normalizeSearchInput, searchExternalContent } from "../../supabase/functions/_shared/externalContent/aggregate.ts";

const env = (n: string) => Deno.env.get(n);
const health = await checkAllProviders({ fetch: (u, i) => fetch(u, i), env });
for (const h of health) console.log(`${h.state.padEnd(15)} ${h.provider.padEnd(26)} ${String(h.latencyMs ?? "-").padStart(6)}ms results=${h.resultCount}${h.errorCode ? ` error=${h.errorCode}` : ""}`);
console.log(`providers: ${CONTENT_PROVIDERS.length}`);

// Downloadable-file coverage: what a WhatsApp attachment could actually use.
for (const q of ["history", "mathematics"]) {
  const r = await searchExternalContent(normalizeSearchInput({ query: q, limit: 6 })!, { fetch: (u, i) => fetch(u, i), env }, { cache: null });
  const dl = r.items.filter((i) => i.downloadUrl);
  const by: Record<string, number> = {};
  for (const i of dl) by[`${i.provider}:${i.mimeType ?? "?"}`] = (by[`${i.provider}:${i.mimeType ?? "?"}`] ?? 0) + 1;
  console.log(`query "${q}": ${r.items.length} items, ${dl.length} with downloadUrl`, JSON.stringify(by));
}
