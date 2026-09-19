// Phase 1 — one price list, one ledger, one reservation flow.
//
// Visionex had three VX-shaped systems that did not agree: `user_points` (the
// live balance), `credit_wallets` + `billing_consume` (a complete authority
// wired to nothing), and `whatsapp_usage` (a count with no VX in it) — plus a
// fourth shape inside `charge_file_conversion`, which prices four converters in
// its own function body.
//
// The SQL in this migration was executed against real PostgreSQL before it
// landed; this file pins the decisions that a future edit could quietly undo.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  SERVICE_IDS,
  USAGE_SOURCES,
  isServiceId,
  isUsageSource,
} from "../../supabase/functions/_shared/vx/types.ts";

const migration = readFileSync("supabase/migrations/20261023000000_vx_central_pricing_and_ledger.sql", "utf8");

describe("the migration changes nothing until somebody turns a service on", () => {
  it("ships every service disabled", () => {
    // The registry seed must not carry `enabled` at all: the column defaults to
    // false, and an INSERT that named it would be the one line that made this
    // migration a behaviour change.
    const seed = migration.slice(
      migration.indexOf("INSERT INTO public.central_pricing_registry"),
      migration.indexOf("ON CONFLICT (service_id) DO NOTHING"),
    );
    expect(seed).not.toMatch(/\benabled\b/);
    expect(migration).toContain("enabled         boolean NOT NULL DEFAULT false");
  });

  it("touches none of the systems it is meant to replace", () => {
    // Known-bad input for this guard: any DROP, or any write to the legacy
    // tables. Comments are stripped first, because this file discusses all of
    // them at length.
    const code = migration.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    for (const legacy of ["credit_wallets", "billing_consume", "billing_refund",
                          "charge_file_conversion", "whatsapp_usage", "spend_vx"]) {
      expect(code, legacy).not.toContain(legacy);
    }
    expect(code).not.toMatch(/DROP\s+(TABLE|FUNCTION)/i);
  });
});

describe("no price, allowance or ceiling is written anywhere but the registry", () => {
  it("keeps all five in columns an admin can update", () => {
    for (const column of ["vx_price", "free_limit", "plan_limits", "max_daily_usage", "base_cost"]) {
      expect(migration, column).toContain(column);
    }
  });

  it("reads every one of them from the row, never from the caller", () => {
    const reserve = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION public.vx_reserve"),
      migration.indexOf("COMMENT ON FUNCTION public.vx_reserve"),
    );
    // The caller supplies who, what and how many. Never how much.
    expect(reserve).toContain("_price.vx_price");
    expect(reserve).toContain("_price.free_limit");
    expect(reserve).toContain("_price.max_daily_usage");
    expect(reserve).toContain("_price.plan_limits ? _plan");
    expect(reserve).not.toMatch(/_cost\s*:?=\s*\d+/);
  });

  it("prices the services the two old systems already had numbers for", () => {
    // billing_rules said tts=100, voice_cloning=500, text_to_video=300.
    expect(migration).toMatch(/'tts',\s+'Text to speech',\s+NULL,\s+[\d.]+,\s*100,/);
    expect(migration).toMatch(/'voice_clone',[^\n]*\s500,/);
    expect(migration).toMatch(/'video',[^\n]*\s300,/);
  });

  it("names a service for every surface the platform bills", () => {
    for (const service of SERVICE_IDS) {
      expect(migration, service).toContain(`('${service}',`);
    }
  });
});

describe("the balance stays honest to every existing reader", () => {
  it("is SUM(user_points), which is what usePoints and spend_vx already read", () => {
    expect(migration).toContain("SELECT COALESCE(SUM(points), 0)::integer FROM public.user_points");
  });

  it("debits the reservation into user_points rather than holding it elsewhere", () => {
    // A hold kept outside user_points would be invisible to SUM(points) — and
    // therefore spendable twice, once by this system and once by spend_vx.
    const reserve = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION public.vx_reserve"));
    expect(reserve.slice(0, 5000)).toContain("INSERT INTO public.user_points (user_id, points, reason)");
    expect(reserve.slice(0, 5000)).toContain("VALUES (_user_id, -_cost, 'VX reserve: '");
  });

  it("takes one lock per user around the whole decision", () => {
    // Two concurrent reserves must not both read the same balance and both pass.
    for (const fn of ["vx_reserve", "vx_settle", "vx_release"]) {
      const body = migration.slice(migration.indexOf(`FUNCTION public.${fn}(`));
      expect(body.slice(0, 5000), fn).toContain("pg_advisory_xact_lock(hashtextextended(");
    }
  });
});

describe("settlement can be retried without costing anybody anything", () => {
  it("replays instead of refunding twice", () => {
    const settle = migration.slice(migration.indexOf("FUNCTION public.vx_settle("));
    expect(settle.slice(0, 3000)).toContain("IF _row.status <> 'reserved' THEN");
    expect(settle.slice(0, 3000)).toContain("'replayed', true");
  });

  it("never charges more than was held", () => {
    expect(migration).toContain("LEAST(GREATEST(COALESCE(_consumed_vx, _row.reserved_vx), 0), _row.reserved_vx)");
    // And the table refuses it even if the function ever stopped clamping.
    expect(migration).toContain("CONSTRAINT vx_ledger_settled_within_reserved CHECK (consumed_vx + refunded_vx <= reserved_vx)");
  });

  it("returns the first reservation for a repeated idempotency key", () => {
    expect(migration).toContain("idempotency_key text UNIQUE");
    const reserve = migration.slice(migration.indexOf("FUNCTION public.vx_reserve("));
    const guard = reserve.indexOf("WHERE idempotency_key = _idempotency_key");
    const charge = reserve.indexOf("INSERT INTO public.user_points");
    expect(guard).toBeGreaterThan(0);
    expect(guard).toBeLessThan(charge);
  });

  it("sweeps abandoned holds on a schedule, unlike the File Studio reaper", () => {
    // refund_stale_file_conversions() is auth.uid()-scoped, so it only runs
    // when the user happens to come back.
    expect(migration).toContain("FUNCTION public.vx_reap_stale_reservations");
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("cron.schedule(");
    expect(migration).toContain("'vx-reap-stale-reservations'");
    // A floor, so a bad argument cannot sweep a job that is still running.
    expect(migration).toContain("GREATEST(COALESCE(_older_than, interval '1 hour'), interval '10 minutes')");
  });
});

describe("a user sees their own spending and none of the commercial detail", () => {
  it("keeps both tables admin-read", () => {
    for (const policy of ["pricing_read_admin", "vx_ledger_read_admin", "pricing_audit_read_admin"]) {
      expect(migration, policy).toContain(policy);
    }
    expect(migration).not.toMatch(/USING \(auth\.uid\(\) = user_id\)/);
  });

  it("hands users a column list instead", () => {
    const priceList = migration.slice(
      migration.indexOf("FUNCTION public.vx_price_list()"),
      migration.indexOf("COMMENT ON FUNCTION public.vx_price_list()"),
    );
    expect(priceList).not.toContain("base_cost");
    expect(priceList).not.toContain("p.provider");

    const mine = migration.slice(
      migration.indexOf("FUNCTION public.my_vx_usage("),
      migration.indexOf("COMMENT ON FUNCTION public.my_vx_usage("),
    );
    expect(mine).not.toContain("l.provider");
    expect(mine).not.toContain("actual_cost_usd");
    expect(mine).toContain("WHERE l.user_id = auth.uid()");
  });

  it("locks every spending function to the service role", () => {
    for (const sig of [
      "public.vx_balance(uuid)",
      "public.vx_reserve(uuid, text, text, text, integer, jsonb)",
      "public.vx_settle(uuid, integer, integer, text, numeric)",
      "public.vx_release(uuid, text, text)",
      "public.vx_reap_stale_reservations(interval)",
    ]) {
      expect(migration, sig).toContain(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated;`);
      expect(migration, sig).toContain(`GRANT EXECUTE ON FUNCTION ${sig} TO service_role;`);
    }
  });

  it("records a price change like the operator action it is", () => {
    expect(migration).toContain("CREATE TRIGGER central_pricing_audit_trigger");
    expect(migration).toContain("AFTER INSERT OR UPDATE OR DELETE ON public.central_pricing_registry");
  });
});

describe("the shared vocabulary the three surfaces agree on", () => {
  it("names the sources the ledger accepts, and nothing else", () => {
    expect([...USAGE_SOURCES].sort()).toEqual(["api", "system", "website", "whatsapp"]);
    for (const source of USAGE_SOURCES) {
      expect(migration, source).toContain(`'${source}'`);
    }
    expect(isUsageSource("whatsapp")).toBe(true);
    expect(isUsageSource("carrier-pigeon")).toBe(false);
  });

  it("guards a service id rather than trusting a string", () => {
    expect(isServiceId("whatsapp_ai")).toBe(true);
    expect(isServiceId("whatsapp-ai")).toBe(false);
    expect(isServiceId("")).toBe(false);
  });
});
