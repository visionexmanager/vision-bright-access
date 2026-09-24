import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the fix for a live minting path: five browser-callable award_* RPCs
// credited `user_points` (the only VX balance) with no limit on how often they
// ran, and award_academy_xp had no amount ceiling at all. The migration below
// was executed against PGlite before it shipped; this pins its shape so a
// later CREATE OR REPLACE cannot quietly drop the allowance again.

const MIGRATIONS = "supabase/migrations";
const FILE = "20261043000000_vx_self_award_daily_allowance.sql";
const sql = readFileSync(`${MIGRATIONS}/${FILE}`, "utf8");
const code = sql.replace(/--[^\n]*/g, "");

const AWARDS = ["award_academy_xp", "award_library_xp", "award_kids_xp", "award_kids_coins", "award_points"];

/** The body of the LAST definition of a function across every migration. */
function latestBody(name: string): { file: string; body: string } {
  let found: { file: string; body: string } | null = null;
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const text = readFileSync(`${MIGRATIONS}/${file}`, "utf8").replace(/--[^\n]*/g, "");
    const re = new RegExp(`create or replace function public\\.${name}\\s*\\(([\\s\\S]*?)\\$(\\w*)\\$([\\s\\S]*?)\\$\\2\\$`, "gi");
    for (const m of text.matchAll(re)) found = { file, body: m[3] };
  }
  if (!found) throw new Error(`${name} is never defined`);
  return found;
}

describe("every self-award RPC draws from the daily allowance", () => {
  for (const name of AWARDS) {
    it(`${name} is last defined here, and draws before its first write`, () => {
      const { file, body } = latestBody(name);
      expect(file).toBe(FILE);
      const take = body.search(/vx_self_award_take\(/);
      const firstInsert = body.search(/insert into /i);
      expect(take).toBeGreaterThan(-1);
      expect(take).toBeLessThan(firstInsert);
    });
  }

  it("trims instead of raising, so an IVX answer is never rolled back by its reward", () => {
    const { body } = latestBody("award_academy_xp");
    expect(body).toMatch(/_amount := public\.vx_self_award_take\(_user_id, _amount\);\s*IF _amount <= 0 THEN RETURN; END IF;/);
  });

  it("never charges a debit to the allowance", () => {
    const { body } = latestBody("award_points");
    expect(body).toMatch(/if _points > 0 then\s*_points := public\.vx_self_award_take\(auth\.uid\(\), _points\);/);
  });

  it("caps the day at 2,000 VX", () => {
    expect(code).toMatch(/_cap\s+constant integer := 2000;/);
  });
});

describe("award_academy_xp has a whitelist that matches the app", () => {
  it("allows exactly ACADEMY_XP_RATES, at those amounts, plus IVX practice", () => {
    const service = readFileSync("src/services/academy/academyService.ts", "utf8");
    const table = service.slice(service.indexOf("ACADEMY_XP_RATES"), service.indexOf("};", service.indexOf("ACADEMY_XP_RATES")));
    const rates = Object.fromEntries([...table.matchAll(/(academy_\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(Object.keys(rates).length).toBeGreaterThan(15);

    const { body } = latestBody("award_academy_xp");
    const allowed = Object.fromEntries([...body.matchAll(/WHEN '(\w+)'\s+THEN (\d+)/g)].map((m) => [m[1], Number(m[2])]));
    expect(allowed).toEqual({ ...rates, ivx_practice: 25 });
    expect(body).toMatch(/RAISE EXCEPTION 'Invalid reason/);
    expect(body).toMatch(/_amount IS NULL OR _amount <= 0/);
  });
});

describe("the allowance cannot be reached from a browser key", () => {
  it("revokes the draw from anon and authenticated by name, and grants it back to service_role", () => {
    expect(code).toContain("REVOKE ALL ON FUNCTION public.vx_self_award_take(uuid, integer) FROM PUBLIC, anon, authenticated;");
    expect(code).toContain("GRANT EXECUTE ON FUNCTION public.vx_self_award_take(uuid, integer) TO service_role;");
  });

  it("keeps the ledger service-only: RLS on and no policy", () => {
    expect(code).toContain("ALTER TABLE public.vx_self_award_daily ENABLE ROW LEVEL SECURITY;");
    expect(code).toContain("REVOKE ALL ON TABLE public.vx_self_award_daily FROM PUBLIC, anon, authenticated;");
    expect(code).not.toMatch(/CREATE POLICY/i);
  });

  it("widens no grant on the award functions themselves", () => {
    expect(code).not.toMatch(/GRANT [^;]*award_(academy_xp|library_xp|kids_xp|kids_coins|points)/i);
  });
});

describe("a kids gift of VX pays out once", () => {
  it("claim_kids_gift is last defined with a row lock and a conditional update", () => {
    const { file, body } = latestBody("claim_kids_gift");
    expect(file).toBe("20261045000000_kids_gift_claim_once.sql");
    expect(body).toMatch(/FROM public\.kids_gifts WHERE id = _id FOR UPDATE;/);
    expect(body).toMatch(/WHERE id = _id AND status = 'pending';\s*IF NOT FOUND THEN RAISE EXCEPTION 'Already handled'; END IF;/);
    // The status flips before any credit is written.
    expect(body.indexOf("SET status = 'claimed'")).toBeLessThan(body.indexOf("INSERT INTO public.user_points"));
  });
});
