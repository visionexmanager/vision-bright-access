// The user-facing Usage view, and the wall it sits behind.
//
// It used to read `usage_logs` — a table that has never had a row in it,
// because `billing_consume` was never called — and price each row from a
// `VX_COSTS` map in the browser. Both are gone.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chart = readFileSync("src/pages/services/ai-media-studio/components/billing/UsageChart.tsx", "utf8");
// The header of that file explains at length what it no longer reads, so every
// "must not contain" check runs against the code rather than the prose.
const chartCode = chart.split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
const service = readFileSync("src/services/ai-media-studio/billingService.ts", "utf8");
const serviceCode = service.split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
const hook = readFileSync("src/hooks/useCredits.ts", "utf8");
const billing = readFileSync("supabase/functions/billing-engine/index.ts", "utf8");
const types = readFileSync("src/lib/types/billing.ts", "utf8");
const ledger = readFileSync("supabase/migrations/20261023000000_vx_central_pricing_and_ledger.sql", "utf8");

describe("the Usage view reads the ledger, not the empty table", () => {
  it("no longer touches usage_logs or the browser price map", () => {
    expect(chartCode).not.toContain("useUsageLogs");
    expect(chartCode).not.toContain("VX_COSTS");
    expect(chart).toContain("useMyVxUsage");
  });

  it("goes through the RPC boundary rather than the table", () => {
    // `vx_usage_ledger` carries provider and actual_cost_usd; `my_vx_usage()`
    // is the column list that does not.
    expect(service).toContain('action: "my_usage"');
    expect(billing).toContain('db.rpc("my_vx_usage"');
    expect(chartCode).not.toContain("vx_usage_ledger");
    expect(serviceCode).not.toContain("vx_usage_ledger");
  });

  it("shows the amounts a customer is owed an account of", () => {
    for (const shown of ["VX spent", "VX returned", "Currently held", "Requests"]) {
      expect(chart, shown).toContain(shown);
    }
    for (const field of ["consumed_vx", "refunded_vx", "reserved_vx", "display_name", "created_at", "status"]) {
      expect(chart, field).toContain(field);
    }
  });

  it("shows no provider, no cost, no margin", () => {
    const code = chart.split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");
    for (const hidden of ["provider", "actual_cost", "base_cost", "cost_usd", "margin", "api_key"]) {
      expect(code, hidden).not.toContain(hidden);
    }
  });

  it("names the source only when an account has used more than one", () => {
    // "Website" on every row of a website-only account is noise.
    expect(chart).toContain("showSource");
    expect(chart).toContain("new Set(rows.map((r) => r.source)).size > 1");
  });
});

describe("every state the screen can be in", () => {
  it("has a loading state that announces itself", () => {
    expect(chart).toContain('aria-busy="true"');
    expect(chart).toContain("Loading your usage");
  });

  it("has an error state that does not look like emptiness", () => {
    expect(chart).toContain("isError");
    expect(chart).toContain("could not be loaded");
  });

  it("has an empty state that explains what will appear", () => {
    expect(chart).toContain("No VX spent yet");
    expect(chart).toContain("rows.length === 0");
  });

  it("tells the five outcomes apart, including the three that return VX", () => {
    // "we could not do it", "you cancelled" and "nobody finished it" are
    // different things to read on your own statement.
    for (const status of ["settled", "reserved", "refunded", "failed", "expired"]) {
      expect(chart, status).toContain(`${status}:`);
    }
    expect(chart).toContain("VX returned");
    expect(chart).toContain("Timed out");
  });

  it("calls a zero-cost request free rather than showing 0 VX", () => {
    expect(chart).toContain(`: "Free"`);
  });
});

describe("the client type matches the RPC, not the table", () => {
  it("declares only the columns my_vx_usage returns", () => {
    const shape = types.slice(types.indexOf("export interface VxUsageRow"));
    for (const column of ["service_id", "display_name", "units", "reserved_vx",
                          "consumed_vx", "refunded_vx", "status", "source"]) {
      expect(shape, column).toContain(column);
    }
    expect(shape).not.toContain("actual_cost_usd");
    expect(shape.slice(0, shape.indexOf("}"))).not.toContain("provider");
  });

  it("matches what the SQL function actually selects", () => {
    const fn = ledger.slice(
      ledger.indexOf("FUNCTION public.my_vx_usage("),
      ledger.indexOf("COMMENT ON FUNCTION public.my_vx_usage("),
    );
    for (const column of ["service_id", "display_name", "units", "reserved_vx",
                          "consumed_vx", "refunded_vx", "status", "source"]) {
      expect(fn, column).toContain(column);
    }
  });

  it("keeps the legacy hook alongside rather than breaking the other tab", () => {
    // TransactionHistory still reads credit_transactions, which is also empty
    // but is a separate retirement.
    expect(hook).toContain("useUsageLogs");
    expect(hook).toContain("useMyVxUsage");
  });
});
