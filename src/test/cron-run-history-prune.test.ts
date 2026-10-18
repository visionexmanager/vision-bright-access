import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The DELETE was executed in PGlite against rows of every age and status: a
// succeeded run of 1 day and a failed run of 8 days survive; a succeeded run of
// 8 days, a failed run of 31 days and a succeeded run of 40 days are removed.
// This pins the statement so the retention cannot drift unnoticed.

const sql = readFileSync(resolve(__dirname, "../../supabase/migrations/20261071000000_prune_cron_run_history.sql"), "utf8").replace(/\r\n/g, "\n");
const command = sql.split("$cron$")[1] ?? "";

describe("cron run history pruning", () => {
  it("schedules one named daily job and survives a database without pg_cron", () => {
    expect(sql).toContain("'cron-run-history-prune'");
    expect(sql).toContain("'40 3 * * *'");
    expect(sql).toMatch(/EXCEPTION WHEN OTHERS THEN[\s\S]*RETURN;/);
  });

  it("deletes only from cron.job_run_details, with the documented retention", () => {
    const flat = command.replace(/\s+/g, " ").trim();
    expect(flat).toBe(
      "DELETE FROM cron.job_run_details WHERE end_time < now() - interval '30 days' OR (status = 'succeeded' AND end_time < now() - interval '7 days')",
    );
  });

  it("adds no callable function and touches no other table", () => {
    expect(sql).not.toMatch(/CREATE\s+(OR REPLACE\s+)?FUNCTION/i);
    expect(sql.replace(command, "")).not.toMatch(/\b(DELETE|UPDATE|INSERT|DROP|TRUNCATE)\b[^;]*public\./i);
  });
});
