// Prints the access-policy tables as markdown so the report is regenerated, not retyped.
//   npx vite-node scripts/finance/access-tables.ts
import { EDGE_POLICY, OPERATIONS } from "../../src/lib/access/policy";

console.log("| Operation | Section | Class | Sign-in | Trial | Paid provider | Needs plan | VX | Stored answer first | Edge functions |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
const yn = (b: boolean) => (b ? "yes" : "no");
for (const o of OPERATIONS) {
  console.log(`| ${o.id} | ${o.section ?? "-"} | ${o.cls} | ${yn(o.requiresAuth)} | ${yn(o.trialAllowed)} | ${yn(o.paidProvider)} | ${yn(o.needsPaidPlan)} | ${o.vx} | ${yn(o.localFallback)} | ${o.edge.join(", ") || "-"} |`);
}
console.log("\n| Edge function | Class | Guard | Trial | Note |\n|---|---|---|---|---|");
for (const [name, p] of Object.entries(EDGE_POLICY)) console.log(`| ${name} | ${p.cls} | ${p.guard} | ${yn(p.trial)} | ${p.note.replace(/\|/g, "/")} |`);
const counts: Record<string, number> = {};
for (const p of Object.values(EDGE_POLICY)) counts[p.cls] = (counts[p.cls] ?? 0) + 1;
console.log("\nCounts: " + JSON.stringify(counts));
