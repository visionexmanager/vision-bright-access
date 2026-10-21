// Prints the audit's tables from docs/finance/profitability-assumptions.json and
// src/lib/billing/plans.ts. Run: npx vite-node scripts/finance/profitability-tables.ts
// Output is markdown so the report's numbers can be regenerated, not retyped.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PAID_PLANS, PAID_PLAN_ORDER } from "../../src/lib/billing/plans";
import {
  SCENARIOS, breakEvenSubscribers, costPer1000Vx, evaluatePlan, fixedCostAt, fullAllowanceCost,
  maxHeavyShare, maxSustainableCostPer1000Vx, netRevenue, projectBusiness, type Assumptions,
} from "../../src/lib/finance/profitability";

const a = JSON.parse(readFileSync(resolve(process.cwd(), "docs/finance/profitability-assumptions.json"), "utf8")) as Assumptions;
const $ = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);
const pct = (n: number | null) => (n === null ? "n/a" : n.toFixed(0) + "%");

console.log("### Per-plan scenarios (paying base N = 100 for fixed-cost allocation)\n");
console.log("| Plan | Price | Net rev | Scenario | Variable cost | Contribution | Fixed alloc | Op. profit | Margin | Usage headroom (x) |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const p of PAID_PLAN_ORDER) {
  for (const s of SCENARIOS) {
    const r = evaluatePlan(a, p, s, 100);
    console.log(`| ${p} | ${$(r.price)} | ${$(r.netRevenue)} | ${s} | ${$(r.variableCost)} | ${$(r.contribution)} | ${$(r.allocatedFixed)} | ${$(r.operatingProfit)} | ${pct(r.marginPct)} | ${r.usageHeadroom === null ? "inf" : r.usageHeadroom.toFixed(2)} |`);
  }
}

console.log("\n### Cost lines (typical and heavy)\n");
for (const p of PAID_PLAN_ORDER) for (const s of ["typical", "heavy"] as const) {
  const r = evaluatePlan(a, p, s, 100);
  console.log(`- ${p}/${s}: ` + r.lines.map((l) => `${l.op} ${$(l.usd)} [${l.basis}]`).join("; "));
}

console.log("\n### Same, with Meta service-message cost = $0 (old free-reply case)\n");
const free = JSON.parse(JSON.stringify(a)) as Assumptions;
free.unit_costs.whatsapp_service_message = { usd: 0, basis: "estimate" };
console.log("| Plan | typical contribution | heavy contribution |\n|---|---|---|");
for (const p of PAID_PLAN_ORDER) console.log(`| ${p} | ${$(evaluatePlan(free, p, "typical", 100).contribution)} | ${$(evaluatePlan(free, p, "heavy", 100).contribution)} |`);

console.log("\n### VX\n");
console.log("| Plan | VX/month | VX at face value | Net revenue | Max sustainable cost per 1,000 VX | Full-spend cost @ image(med) | @ tts | @ video | @ voice_clone |\n|---|---|---|---|---|---|---|---|---|");
const reg = a.registry_services as Record<string, { vx_price: number; base_cost: number }>;
for (const p of PAID_PLAN_ORDER) {
  const m = maxSustainableCostPer1000Vx(a, p);
  console.log(`| ${p} | ${PAID_PLANS[p].vxMonthly} | ${$(PAID_PLANS[p].vxMonthly / 1000)} | ${$(netRevenue(a, PAID_PLANS[p].price).net)} | ${m === null ? "n/a" : $(m)} | ${["image", "tts", "video", "voice_clone"].map((k) => $(fullAllowanceCost(p, costPer1000Vx(reg[k]) as number))).join(" | ")} |`);
}
console.log("\n| Service | VX price | Registry cost | Cost per 1,000 VX |\n|---|---|---|---|");
for (const [k, v] of Object.entries(reg)) if (typeof v !== "string") console.log(`| ${k} | ${v.vx_price} | ${$(v.base_cost)} | ${$(costPer1000Vx(v) as number)} |`);

console.log("\n### Business-wide\n");
console.log(`Fixed cost: ${$(fixedCostAt(a, 1))} base.\n`);
for (const mixName of ["subscriber_mix_a_basic_heavy", "subscriber_mix_b_balanced", "subscriber_mix_c_business_led"]) {
  for (const um of ["usage_mix_base", "usage_mix_mid", "usage_mix_adverse"]) {
    console.log(`\n**${mixName} / ${um}** — break-even: ${breakEvenSubscribers(a, a.mixes[mixName], a.mixes[um]) ?? "none up to 20,000"}\n`);
    console.log("| Paying | Gross rev | Net rev | Variable | Free-user | Fixed | Op. profit | ARPU | Cost/sub | Contribution margin | Op. margin |\n|---|---|---|---|---|---|---|---|---|---|---|");
    for (const n of [10, 50, 100, 500, 1000]) {
      const r = projectBusiness(a, n, a.mixes[mixName], a.mixes[um]);
      console.log(`| ${n} | ${$(r.grossRevenue)} | ${$(r.netRevenue)} | ${$(r.variableCost)} | ${$(r.freeUserCost)} | ${$(r.fixedCost)} | ${$(r.operatingProfit)} | ${$(r.arpu)} | ${$(r.costPerSubscriber)} | ${pct(r.contributionMarginPct)} | ${pct(r.operatingMarginPct)} |`);
    }
  }
}

console.log("\n### Heavy-user tolerance\n");
console.log("| Plan | Max share of heavy users before contribution < 0 |\n|---|---|");
for (const p of PAID_PLAN_ORDER) console.log(`| ${p} | ${pct((maxHeavyShare(a, p) ?? 0) * 100)} |`);
