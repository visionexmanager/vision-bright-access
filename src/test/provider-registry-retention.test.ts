// Phase 2K-2: provider registry retention.
//
// The approved policy, fixed in the migration and nowhere else:
//   ph_logs                      30 days — success, failure and shadow alike
//   ph_provider_audit, metric-only automatic changes          30 days
//   ph_provider_audit, everything else (admin edits, config,
//     status transitions such as degrade/recover, probes)     permanent
//   ph_metrics / metrics_retention_hours                      untouched
//
// The SQL itself was executed in PGlite when this was written — every row
// class above, batching, a second run, the role boundary, and each mutation
// below (see the PR). These tests pin the migration's text so a later edit
// cannot quietly loosen the policy, and they run in CI, which PGlite does not.

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FILE = "20261041000000_provider_registry_retention.sql";
const sql = readFileSync(`supabase/migrations/${FILE}`, "utf8");
const code = sql.replace(/--.*$/gm, "");
const fn = code.slice(code.indexOf("CREATE OR REPLACE FUNCTION public.ph_prune_registry_logs"), code.indexOf("$$;", code.indexOf("CREATE OR REPLACE FUNCTION public.ph_prune_registry_logs")) + 3);

describe("the policy is fixed in the function, not supplied by a caller", () => {
  it("takes no arguments at all — no table, predicate or period can be passed", () => {
    expect(fn).toMatch(/CREATE OR REPLACE FUNCTION public\.ph_prune_registry_logs\(\)\s*RETURNS jsonb/);
  });

  it("states thirty days once, as a constant, and uses the database clock", () => {
    expect(fn).toMatch(/_retention\s+CONSTANT interval := interval '30 days';/);
    expect(fn).toMatch(/_cutoff\s+CONSTANT timestamptz := now\(\) - _retention;/);
    expect(fn.match(/interval '\d+ days?'/g)).toEqual(["interval '30 days'"]);
  });

  it("names its two tables literally and builds no dynamic SQL", () => {
    expect(fn).not.toMatch(/\bEXECUTE\b|format\(|quote_ident|%I/);
    expect(fn.match(/DELETE FROM public\.\w+/g)).toEqual(["DELETE FROM public.ph_logs", "DELETE FROM public.ph_provider_audit"]);
  });

  it("never touches ph_metrics or metrics_retention_hours", () => {
    expect(code).not.toMatch(/ph_metrics|metrics_retention_hours|ph_configs/);
  });
});

describe("what is deleted", () => {
  it("ph_logs: every row older than the cutoff, whatever its status or action", () => {
    const logs = fn.slice(fn.indexOf("DELETE FROM public.ph_logs"), fn.indexOf("DELETE FROM public.ph_provider_audit"));
    expect(logs).toMatch(/WHERE created_at < _cutoff/);
    expect(logs).not.toMatch(/status|action|job_type|error_code/);
  });

  it("ph_provider_audit: only automatic, metric-only UPDATE rows older than the cutoff", () => {
    const audit = fn.slice(fn.indexOf("DELETE FROM public.ph_provider_audit"));
    expect(audit).toMatch(/operation = 'UPDATE'/);
    expect(audit).toMatch(/actor_id IS NULL/);
    expect(audit).toMatch(/cardinality\(changed\) > 0/);
    expect(audit).toMatch(/changed <@ _metric_columns/);
    expect(audit).toMatch(/created_at < _cutoff/);
  });

  it("the metric columns are exactly the five ph_record_metric writes — never status", () => {
    const list = /_metric_columns\s+CONSTANT text\[\] := ARRAY\[([^\]]*)\]/.exec(fn)?.[1] ?? "";
    const cols = [...list.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(cols).toEqual(["avg_latency_ms", "consecutive_failures", "health_score", "last_failure_at", "success_rate"]);
    expect(cols).not.toContain("status");
    expect(cols).not.toContain("last_health_check");
  });

  it("the metric columns match the UPDATE in the live ph_record_metric", () => {
    const recovery = readFileSync("supabase/migrations/20261040000000_provider_health_recovery.sql", "utf8");
    const update = recovery.slice(recovery.indexOf("UPDATE ph_providers SET"), recovery.indexOf("WHERE id = p_provider_id;"));
    const written = [...update.matchAll(/^\s{4}([a-z_]+)\s*=/gm)].map((m) => m[1]).filter((c) => c !== "updated_at").sort();
    expect(written).toEqual(["avg_latency_ms", "consecutive_failures", "health_score", "last_failure_at", "success_rate"]);
  });
});

describe("bounded work", () => {
  it("deletes in batches of a fixed size, with a fixed cap on batches per run", () => {
    expect(fn).toMatch(/_batch_size\s+CONSTANT integer := 5000;/);
    expect(fn).toMatch(/_max_batches\s+CONSTANT integer := 10;/);
    expect(fn.match(/LIMIT _batch_size/g)).toHaveLength(2);
    expect(fn.match(/FOR _i IN 1\.\._max_batches LOOP/g)).toHaveLength(2);
    expect(fn.match(/EXIT WHEN _n < _batch_size;/g)).toHaveLength(2);
  });

  it("reports only counts and the cutoff — no row content", () => {
    const ret = fn.slice(fn.indexOf("RETURN jsonb_build_object("));
    expect(ret).toMatch(/'ph_logs_deleted', _logs_deleted/);
    expect(ret).toMatch(/'ph_provider_audit_deleted', _audit_deleted/);
    expect(ret).not.toMatch(/before|after|provider_slug|error_message|request_meta/);
    expect(fn).not.toMatch(/RAISE (NOTICE|LOG|INFO)/);
  });
});

describe("who can run it", () => {
  it("runs with its caller's rights, pinned search_path", () => {
    expect(fn).toMatch(/SECURITY INVOKER/);
    expect(fn).not.toMatch(/SECURITY DEFINER/);
    expect(fn).toMatch(/SET search_path = public/);
  });

  it("is revoked from PUBLIC, anon and authenticated, and granted back to service_role only", () => {
    expect(code).toContain("REVOKE ALL ON FUNCTION public.ph_prune_registry_logs() FROM PUBLIC, anon, authenticated;");
    expect(code).toContain("GRANT EXECUTE ON FUNCTION public.ph_prune_registry_logs() TO service_role;");
    expect(code).not.toMatch(/GRANT[^;]*ph_prune_registry_logs[^;]*TO[^;]*(anon|authenticated|PUBLIC)/i);
  });

  it("no edge function or client calls it", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
        else if (/\.(ts|tsx)$/.test(e.name) && readFileSync(p, "utf8").includes("ph_prune_registry_logs")) hits.push(p);
      }
    };
    walk("supabase/functions");
    walk("src/pages");
    walk("src/lib");
    expect(hits).toEqual([]);
  });
});

describe("schedule and migration shape", () => {
  it("schedules one named job at 03:30 daily, loudly if pg_cron is absent", () => {
    expect(code).toMatch(/PERFORM cron\.schedule\(\s*'provider-registry-prune',\s*'30 3 \* \* \*',\s*\$cron\$SELECT public\.ph_prune_registry_logs\(\)\$cron\$\s*\);/);
    expect(sql).toMatch(/RAISE WARNING 'pg_cron could not be installed/);
  });

  it("adds the ph_logs(created_at) index the cutoff scan needs, idempotently", () => {
    expect(code).toContain("CREATE INDEX IF NOT EXISTS ph_logs_created_idx ON public.ph_logs (created_at);");
  });

  it("changes no policy, grant or table other than its own function", () => {
    expect(code).not.toMatch(/CREATE POLICY|DROP POLICY|ALTER TABLE|DROP TABLE|GRANT (SELECT|INSERT|UPDATE|DELETE|ALL) ON TABLE/i);
  });

  it("comes after the health-recovery migration it depends on, with a unique version", () => {
    // Its metric-column list mirrors ph_record_metric as 20261040 defines it.
    const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
    expect(files.indexOf(FILE)).toBeGreaterThan(files.indexOf("20261040000000_provider_health_recovery.sql"));
    expect(files.filter((f) => f.startsWith("20261041000000_"))).toHaveLength(1);
  });
});
