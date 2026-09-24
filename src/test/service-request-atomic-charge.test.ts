import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guards the fix for a Service Center package that could be charged without a
// request being filed, or filed without being charged. The migration was
// executed against PGlite before it shipped; this pins the page to the single
// atomic call and the policy to its payment-column check.

const sql = readFileSync("supabase/migrations/20261044000000_service_request_atomic_charge.sql", "utf8")
  .replace(/--[^\n]*/g, "");
const page = readFileSync("src/pages/services/ServiceRequestPage.tsx", "utf8");

describe("a paid service request is one transaction", () => {
  it("the page charges and files through one RPC, not spend_vx and an insert", () => {
    expect(page).toContain('supabase.rpc("submit_paid_service_request"');
    expect(page).not.toContain('rpc("spend_vx"');
    expect(page).not.toContain('from("service_requests")');
  });

  it("charges through the existing spend_vx before the insert, in the same function", () => {
    const body = sql.slice(sql.indexOf("FUNCTION public.submit_paid_service_request"));
    const spend = body.indexOf("PERFORM public.spend_vx(_price, 'service'");
    const insert = body.indexOf("INSERT INTO public.service_requests");
    expect(spend).toBeGreaterThan(-1);
    expect(spend).toBeLessThan(insert);
  });

  it("decides a trial on the server, from the same column plan_for_user reads", () => {
    expect(sql).toMatch(/_on_trial := _expires IS NOT NULL AND _expires > now\(\);/);
  });

  it("takes the same per-account lock as every other wallet spend", () => {
    expect(sql).toContain("PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text, 0));");
  });

  it("charges the server's price and only compares the page's", () => {
    const body = sql.slice(sql.indexOf("FUNCTION public.submit_paid_service_request"));
    expect(body).toContain("PERFORM public.spend_vx(_price, 'service', NULL, _label);");
    expect(body).toMatch(/IF _vx IS DISTINCT FROM _price THEN/);
    expect(body).not.toContain("spend_vx(_vx");
  });
});

describe("the server's price list is the pages' price list", () => {
  /** Every (serviceType, package, vx) a ServiceRequestPage page offers. */
  function pagePrices(): string[] {
    const dir = "src/pages/services/";
    const rows: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".tsx"))) {
      const source = readFileSync(dir + file, "utf8");
      if (!source.includes("<ServiceRequestPage")) continue;
      const service = /serviceType="([^"]+)"/.exec(source)?.[1];
      expect(service, `${file} names no serviceType`).toBeTruthy();
      for (const m of source.matchAll(/name: "([^"]+)",\s*vx: ([0-9_]+)/g)) {
        rows.push(`${service}|${m[1]}|${Number(m[2].replace(/_/g, ""))}`);
      }
    }
    return rows.sort();
  }

  function sqlPrices(): string[] {
    const seed = sql.slice(sql.indexOf("INSERT INTO public.service_package_prices"), sql.indexOf("ON CONFLICT (service_type, package_name)"));
    return [...seed.matchAll(/\('((?:[^']|'')+)', '((?:[^']|'')+)', (\d+)\)/g)]
      .map((m) => `${m[1].replace(/''/g, "'")}|${m[2].replace(/''/g, "'")}|${m[3]}`)
      .sort();
  }

  it("has a row for every package every page sells, at the same price", () => {
    const pages = pagePrices();
    expect(pages.length).toBeGreaterThan(40);
    expect(sqlPrices()).toEqual(pages);
  });
});

describe("an unpaid row cannot pass for a paid one", () => {
  it("the browser insert policy requires both payment columns to be empty", () => {
    const policy = sql.slice(sql.indexOf('CREATE POLICY "service_requests: signed-in users file their own"'));
    expect(policy).toMatch(/user_id = \(SELECT auth\.uid\(\)\)/);
    expect(policy).toMatch(/AND vx_paid IS NULL\s+AND paid_via IS NULL/);
  });

  it("is callable by signed-in users only", () => {
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.submit_paid_service_request(text, text, integer, text, text, text, text) FROM PUBLIC, anon;");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.submit_paid_service_request(text, text, integer, text, text, text, text) TO authenticated, service_role;");
  });

  it("shows the admin what was paid", () => {
    const admin = readFileSync("src/pages/admin/AdminRequests.tsx", "utf8");
    expect(admin).toContain('t("admin.requests.payment")');
    expect(admin).toContain('t("admin.requests.unpaid")');
  });
});
