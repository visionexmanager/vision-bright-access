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

import { existsSync, readFileSync } from "node:fs";
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

// ── The wallet migration ────────────────────────────────────────────────────
//
// `credit_wallets.balance_vx` is the balance a complete billing authority was
// built around and nothing ever spent, so whatever is in those rows was
// granted and stranded. Moving it is the one genuinely destructive step in
// Phase 1, and these pin the properties that make it safe to run.

describe("moving credit_wallets onto user_points", () => {
  const tools = readFileSync("supabase/migrations/20261024000000_vx_wallet_migration_tools.sql", "utf8");

  it("drops nothing and leaves credit_wallets standing", () => {
    const code = tools.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    expect(code).not.toMatch(/DROP\s+(TABLE|FUNCTION|COLUMN)/i);
    expect(code).not.toMatch(/DELETE FROM public\.credit_wallets/i);
    expect(code).not.toMatch(/UPDATE public\.credit_wallets/i);
  });

  it("is dry by default, on the way out and on the way back", () => {
    expect(tools).toContain("_dry_run   boolean DEFAULT true");
    expect(tools).toContain("vx_revert_wallet_migration(_dry_run boolean DEFAULT true)");
    expect(tools).toContain("CONTINUE WHEN _dry_run;");
  });

  it("credits each account at most once", () => {
    // The PRIMARY KEY is the guard: a second pass finds the row and skips.
    expect(tools).toContain("user_id       uuid PRIMARY KEY REFERENCES auth.users(id)");
    expect(tools).toContain("NOT EXISTS (SELECT 1 FROM public.vx_wallet_migrations m WHERE m.user_id = w.user_id)");
  });

  it("records enough to undo it", () => {
    for (const column of ["wallet_balance_before", "points_balance_before", "credited_vx", "points_balance_after"]) {
      expect(tools, column).toContain(column);
    }
  });

  it("refuses to claw back from somebody who has already spent it", () => {
    // user_points has no non-negative constraint, so a blind reversal would
    // push a balance below what the person has used.
    expect(tools).toContain("IF _balance - _row.credited_vx < 0 THEN");
    expect(tools).toContain("skipped_would_go_negative");
  });

  it("keeps the report read-only and the move service-role only", () => {
    expect(tools).toContain("RETURNS jsonb\nLANGUAGE plpgsql\nSTABLE");
    expect(tools).toContain("GRANT EXECUTE ON FUNCTION public.vx_wallet_migration_report() TO authenticated, service_role;");
    expect(tools).toContain("REVOKE ALL ON FUNCTION public.vx_migrate_wallet_balances(boolean, integer) FROM PUBLIC, anon, authenticated;");
    expect(tools).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.vx_migrate_wallet_balances\([^)]*\) TO authenticated/);
  });

  it("is not reachable from the admin screen", () => {
    // Running it is a reviewed operational step with a report read first, not
    // a button somebody can reach past on a Tuesday.
    const fn = readFileSync("supabase/functions/billing-engine/index.ts", "utf8");
    expect(fn).toContain("reviewed operational step");
    // In the code, not in the comment that explains why it is absent.
    const code = fn.split("\n").filter((line) => !line.trimStart().startsWith("//")).join("\n");
    expect(code).not.toContain("vx_migrate_wallet_balances");
  });
});

describe("the operator's door", () => {
  const fn = readFileSync("supabase/functions/billing-engine/index.ts", "utf8");
  const api = readFileSync("supabase/migrations/20261025000000_vx_pricing_admin_api.sql", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");

  it("gates every operator action on the role, and records a refusal", () => {
    // These live inside the billing authority rather than a function of their
    // own: a second endpoint that reads and writes prices would be the second
    // billing system Phase 1 exists to remove — and content-engine's suite
    // holds the project two functions below the Supabase ceiling.
    expect(existsSync("supabase/functions/vx-admin")).toBe(false);
    for (const action of ["pricing_list", "set_pricing", "usage_analytics", "migration_report"]) {
      expect(fn, action).toContain(`case "${action}":`);
    }
    expect(fn).toContain("if (!(await requireAdmin(user.id))) return err(\"Forbidden\", 403);");
    expect(fn).toContain('_kind: "vx_pricing_forbidden"');
  });

  it("refuses a price that would mint VX", () => {
    expect(api).toContain("negative_price");
    expect(api).toContain("negative_free_limit");
    expect(api).toContain("plan_limits_must_be_an_object");
    // And the check is in SQL, where a second caller cannot skip it.
    expect(api).toContain("IF NOT public.has_role(auth.uid(), 'admin') THEN");
  });

  it("is behind an admin route", () => {
    const route = app.slice(app.indexOf('path="/admin/vx-pricing"'));
    expect(route.slice(0, 120)).toContain("<AdminRoute>");
  });

  it("reaches the new objects through the function, not around the generated types", () => {
    // kidsSupabase.ts records why: casting around a stale types.ts is how every
    // `.returns<T>()` in a service collapses. The types are regenerated after a
    // migration deploys, so the screen goes through an Edge Function instead.
    const page = readFileSync("src/pages/admin/AdminVXPricing.tsx", "utf8");
    expect(page).toContain('callEdge({ fn: "billing-engine"');
    expect(page).not.toContain("as any");
    expect(page).not.toContain("from(\"central_pricing_registry\")");
  });
});

// ── The parity report ───────────────────────────────────────────────────────
//
// Read-only, and the input to a decision rather than a step in it. Its
// classifier was driven against seeded fixtures containing all seven failure
// shapes before this landed; these pin the properties.

describe("the credit_wallets parity report", () => {
  const parity = readFileSync("supabase/migrations/20261026000000_vx_wallet_parity_report.sql", "utf8");
  const code = parity.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");

  it("writes nothing, in any statement", () => {
    expect(code).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER TABLE)\b/i);
    expect((code.match(/\nSTABLE\n/g) ?? []).length).toBe(2);
  });

  it("classifies all seven buckets the migration can go wrong in", () => {
    for (const bucket of ["a_exact_match", "b_mismatch", "c_wallet_without_points",
                          "d_points_without_wallet", "e_negative_balance",
                          "f_duplicate_grants", "g_ambiguous"]) {
      expect(parity, bucket).toContain(bucket);
    }
  });

  it("tests provenance, not just equality", () => {
    // A wallet whose own transaction history cannot explain its balance was
    // written by something other than the billing functions, and migrating it
    // 1:1 would be inventing VX.
    expect(parity).toContain("credit_wallets.balance_vx = SUM(credit_transactions.amount_vx)");
    expect(parity).toContain("ledger_disagrees");
    expect(parity).toContain("no_provenance");
  });

  it("refuses 1:1 unless everything is explained, signed and unduplicated", () => {
    const verdict = parity.slice(parity.indexOf("'safe_1to1'"), parity.indexOf("-- Bounded samples"));
    expect(verdict).toContain("ledger_disagrees) = 0");
    expect(verdict).toContain("WHERE negative) = 0");
    expect(verdict).toContain("FROM dupes) = 0");
  });

  it("reports whether profiles.vx_balance exists at all", () => {
    // admin_give_vx writes that column. If it is absent, every grant made
    // through that function raised an error rather than landing anywhere.
    expect(parity).toContain("table_name = 'profiles' AND column_name = 'vx_balance'");
  });

  it("keeps samples bounded and free of personal detail", () => {
    expect(parity).toContain("LEAST(GREATEST(COALESCE(_sample, 25), 1), 200)");
    const samples = parity.slice(parity.indexOf("'samples'"), parity.indexOf("COMMENT ON FUNCTION public.vx_wallet_parity_report"));
    expect(samples).not.toMatch(/\bemail\b/);
    expect(samples).not.toMatch(/display_name/);
  });

  it("is admin-only, like everything else that can see a balance", () => {
    expect(parity).toContain("REVOKE ALL ON FUNCTION public.vx_wallet_parity_report(integer) FROM PUBLIC, anon;");
    expect(parity).toContain("REVOKE ALL ON FUNCTION public.vx_account_parity_detail(uuid) FROM PUBLIC, anon;");
    expect((parity.match(/NOT public\.has_role\(auth\.uid\(\), 'admin'\)/g) ?? []).length).toBe(2);
  });
});

describe("the WhatsApp decision is written down where it is implemented", () => {
  const doc = readFileSync(".claude/references/vx-architecture.md", "utf8");

  it("says a linked number shares the website's balance", () => {
    expect(doc).toContain("source = 'whatsapp'");
    expect(doc).toContain("`user_points`, via `vx_balance()`");
  });

  it("says an unlinked number keeps its count-based quota and gets no wallet", () => {
    expect(doc).toContain("whatsapp_entitlements");
    expect(doc).toMatch(/not.*given a VX wallet, an anonymous balance, a placeholder/);
    expect(doc).toContain("a stranger's phone number is not an account");
  });

  it("records that nothing is enabled or migrated", () => {
    expect(doc).toContain("built, disabled, unmigrated");
  });
});
