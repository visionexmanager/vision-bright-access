import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("ph_get_provider_stats exposes provider cost only to the service role", () => {
  const migration = readFileSync("supabase/migrations/20261069000000_ph_provider_stats_service_only.sql", "utf8");
  const hub = readFileSync("supabase/functions/provider-hub/index.ts", "utf8");

  it("revokes anon, authenticated and PUBLIC, and grants service_role", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION %s TO service_role/);
    expect(migration).toContain("'ph_get_provider_stats'");
  });

  it("provider-hub calls it with the service-role client, never the caller's", () => {
    const calls = hub.match(/\((\w+) as any\)\s*\.rpc\("ph_get_provider_stats"/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c).toContain("roleDb");
  });
});
