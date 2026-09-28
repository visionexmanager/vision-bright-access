// A customer sees what a request cost, never what was held for it (20261058).
//
// The money rules themselves are executed in PGlite by
// scripts/sql/vx-hide-reservations-scenarios.mjs — no CI job runs SQL. These
// pin the lines that carry them, so an edit that brings the refund row back,
// or re-exposes the hold, fails here first.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const RAW = readFileSync("supabase/migrations/20261058000000_vx_hide_reservations.sql", "utf8");
const SQL = RAW.replace(/--[^\n]*/g, "");

function body(name: string): string {
  const start = SQL.indexOf(`FUNCTION public.${name}(`, SQL.search(new RegExp(`CREATE (OR REPLACE )?FUNCTION public\\.${name}\\(`)));
  expect(start, name).toBeGreaterThan(-1);
  return SQL.slice(start, SQL.indexOf("$$;", SQL.indexOf("AS $$", start)));
}

describe("settlement folds the hold into the charge", () => {
  it("finds the hold by what the reserve wrote in the same transaction", () => {
    const find = body("vx_hold_points_row");
    expect(find).toContain("p.reason = 'VX reserve: ' || l.service_id");
    expect(find).toContain("p.points = -l.reserved_vx");
    expect(find).toContain("p.created_at = l.created_at");
  });

  it("vx_settle rewrites the hold to the charge, or removes it, and adds no refund row", () => {
    const settle = body("vx_settle");
    expect(settle).toContain("SET points = -_consumed, reason = 'VX: ' || _row.service_id");
    expect(settle).toContain("DELETE FROM public.user_points WHERE id = _hold;");
    // The refund row survives only as the fallback for a hold it cannot find.
    expect(settle).toMatch(/ELSIF _refund > 0 THEN\s+INSERT INTO public\.user_points/);
    // The clamp is unchanged: never more than was held.
    expect(settle).toContain("_consumed := LEAST(GREATEST(COALESCE(_consumed_vx, _row.reserved_vx), 0), _row.reserved_vx);");
    expect(settle).toContain("IF _row.status <> 'reserved' THEN");
  });

  it("vx_release removes the hold, with the same fallback", () => {
    const release = body("vx_release");
    expect(release).toContain("DELETE FROM public.user_points WHERE id = _hold;");
    expect(release).toMatch(/ELSIF _row\.reserved_vx > 0 THEN\s+INSERT INTO public\.user_points/);
  });

  it("the admin ledger keeps the hold and the refund", () => {
    expect(body("vx_settle")).toContain("refunded_vx = _refund,");
    expect(body("vx_release")).toContain("refunded_vx = _row.reserved_vx,");
  });

  it("no reserve function is touched", () => {
    expect(SQL).not.toMatch(/FUNCTION public\.vx_reserve/);
  });
});

describe("a customer's statement", () => {
  it("my_vx_usage returns no hold, refund, provider or cost", () => {
    const usage = body("my_vx_usage");
    for (const hidden of ["reserved_vx", "refunded_vx", "provider", "actual_cost_usd"]) {
      expect(usage, hidden).not.toContain(hidden);
    }
    expect(usage).toContain("WHERE l.user_id = auth.uid()");
  });

  it("my_vx_summary returns no refund", () => {
    const summary = body("my_vx_summary");
    expect(summary).not.toContain("refunded_vx");
    expect(summary).toContain("_user_id  uuid := auth.uid();");
  });
});

describe("grants", () => {
  it("the money functions stay service_role only", () => {
    for (const sig of ["vx_hold_points_row(uuid)", "vx_settle(uuid, integer, integer, text, numeric)", "vx_release(uuid, text, text)"]) {
      expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${sig} FROM PUBLIC, anon, authenticated;`);
      expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${sig} TO service_role;`);
    }
  });

  it("the statement functions are for a signed-in caller, never anon", () => {
    for (const sig of ["my_vx_usage(integer, integer)", "my_vx_summary()"]) {
      expect(SQL).toContain(`REVOKE ALL ON FUNCTION public.${sig} FROM PUBLIC, anon;`);
      expect(SQL).toContain(`GRANT EXECUTE ON FUNCTION public.${sig} TO authenticated, service_role;`);
    }
  });
});
