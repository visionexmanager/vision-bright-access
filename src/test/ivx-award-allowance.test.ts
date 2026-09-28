// The two IVX rewards draw from the daily self-award allowance (20261059).
//
// The rules are executed in PGlite by scripts/sql/ivx-award-allowance-scenarios.mjs
// (no CI job runs SQL): against the production bodies an account reached 2,275
// VX in a day; with this migration it stops at 2,000. These pin the lines.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = readFileSync("supabase/migrations/20261059000000_ivx_awards_through_allowance.sql", "utf8")
  .replace(/--[^\n]*/g, "");

function body(name: string): string {
  const start = SQL.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, name).toBeGreaterThan(-1);
  return SQL.slice(start, SQL.indexOf("$$;", SQL.indexOf("AS $$", start)));
}

describe("the WhatsApp practice reward", () => {
  const fn = body("ivx_wa_submit_answer");

  it("draws the answer's XP from the allowance before crediting anything", () => {
    const draw = fn.indexOf("_xp := public.vx_self_award_take(_user_id, (_result ->> 'xp')::integer);");
    expect(draw).toBeGreaterThan(-1);
    expect(draw).toBeLessThan(fn.indexOf("INSERT INTO public.user_points"));
  });

  it("writes all three ledgers with the trimmed amount, and none when it is zero", () => {
    expect(fn).toMatch(/IF _xp > 0 THEN\s+INSERT INTO public\.academy_xp_events/);
    expect(fn).toContain("VALUES (_user_id, _xp, 'ivx_practice');");
    expect(fn).toContain("SET xp_total = xp_total + _xp");
  });

  it("still grades the answer: the result is returned whatever was credited", () => {
    expect(fn).toContain("RETURN _result;");
  });
});

describe("the project reward", () => {
  const fn = body("ivx_project_grade");

  it("draws from the allowance before recording or crediting the award", () => {
    const draw = fn.indexOf("_award := public.vx_self_award_take(_user_id, _award);");
    expect(draw).toBeGreaterThan(-1);
    expect(draw).toBeLessThan(fn.indexOf("xp_awarded = xp_awarded + _award"));
    expect(draw).toBeLessThan(fn.indexOf("INSERT INTO public.user_points"));
  });
});

describe("nothing else", () => {
  it("adds no grant, no new function and no balance change", () => {
    expect(SQL).not.toMatch(/\bGRANT\b|\bREVOKE\b/);
    expect(SQL.match(/CREATE OR REPLACE FUNCTION/g)).toHaveLength(2);
    expect(SQL).not.toMatch(/UPDATE public\.user_points|DELETE FROM/);
  });

  it("every VX write in an IVX function now goes through the allowance", () => {
    // The two earlier bodies were the only inline writers (20261005020000, 20261006020000).
    const inline = SQL.match(/INSERT INTO public\.user_points/g) ?? [];
    const draws = SQL.match(/public\.vx_self_award_take\(/g) ?? [];
    expect(inline).toHaveLength(2);
    expect(draws).toHaveLength(2);
  });
});
