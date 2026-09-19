// Phase 0 — the provider inventory is an operator's view.
//
// `ph_providers` carries `api_key_ref` (the NAME of every secret the platform
// holds) and `cost_per_request`; `ph_logs` and `ph_metrics` carry the cost of
// each job. All of it was readable by any signed-in account, and the Edge
// Function that manages it asked only for a session, never for a role.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261022000000_provider_hub_admin_only.sql", "utf8");
const hub = readFileSync("supabase/functions/provider-hub/index.ts", "utf8");
const billing = readFileSync("supabase/functions/billing-engine/index.ts", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const types = readFileSync("src/lib/types/billing.ts", "utf8");

const PH_TABLES = ["ph_providers", "ph_metrics", "ph_logs", "ph_configs", "ph_failovers"];

describe("who may read the provider inventory", () => {
  it("drops the authenticated-read policy on every provider table", () => {
    for (const table of PH_TABLES) {
      expect(migration, table).toContain(`DROP POLICY IF EXISTS "${table}_read_auth"`);
    }
    // The replacement is admin-only, and the role check is wrapped so it is
    // evaluated once rather than per row — ph_logs grows a row per generation.
    expect(migration).toContain("(select public.has_role(auth.uid(), ''admin''))");
    expect(migration).toContain("_read_admin");
  });

  it("leaves no authenticated-read policy behind anywhere in the file", () => {
    // Known-bad input for this guard: a policy that grants on role alone.
    expect(migration).not.toMatch(/USING \(auth\.role\(\) = 'authenticated'\)/);
  });

  it("takes the tables away from anon entirely", () => {
    expect(migration).toMatch(/REVOKE ALL ON TABLE[\s\S]{0,300}FROM anon;/);
    expect(migration).toMatch(/GRANT ALL ON TABLE[\s\S]{0,300}TO service_role;/);
  });
});

describe("the provider hub asks for a role, not just a session", () => {
  it("refuses a non-admin before it reads the body", () => {
    const gate = hub.indexOf('_role: "admin"');
    const body = hub.indexOf("await req.json()");
    expect(gate).toBeGreaterThan(0);
    expect(gate).toBeLessThan(body);
    expect(hub).toContain('if (isAdmin !== true)');
    expect(hub).toContain('return err("Forbidden", 403);');
  });

  it("records the refusal rather than only returning it", () => {
    expect(hub).toContain('_kind: "provider_hub_forbidden"');
    expect(hub).toContain("record_security_event");
  });

  it("is reached from an admin route, not a signed-in one", () => {
    const route = app.slice(app.indexOf("/services/ai-media-studio/provider-hub"));
    const line = route.slice(0, route.indexOf("/>"));
    expect(line).toContain("<AdminRoute>");
    expect(line).not.toContain("<AuthGuard>");
  });
});

describe("a customer's receipt carries no vendor and no control field", () => {
  it("sends named columns rather than the whole row", () => {
    expect(billing).not.toMatch(/from\("credit_transactions"\)\s*\.select\("\*"\)/);
    expect(billing).not.toMatch(/from\("usage_logs"\)\s*\.select\("\*"\)/);
    for (const leaked of ["provider_slug", "idempotency_key"]) {
      const history = billing.slice(billing.indexOf('from("credit_transactions")'));
      expect(history.slice(0, 400), leaked).not.toContain(leaked);
    }
  });

  it("and the client type no longer claims to have them", () => {
    const shape = types.slice(types.indexOf("export interface CreditTransaction"), types.indexOf("// ── Subscription"));
    expect(shape).not.toMatch(/^\s+provider_slug:/m);
    expect(shape).not.toMatch(/^\s+idempotency_key:/m);
    expect(shape).not.toMatch(/^\s+meta:/m);
  });
});

describe("every provider change is recorded, from any path", () => {
  it("audits by trigger, so the service role and a migration are covered too", () => {
    expect(migration).toContain("CREATE TRIGGER ph_providers_audit");
    expect(migration).toContain("AFTER INSERT OR UPDATE OR DELETE ON public.ph_providers");
    expect(migration).toContain("FOR EACH ROW EXECUTE FUNCTION public.ph_audit_provider_change()");
  });

  it("keeps the audit admin-read and holds names, never values", () => {
    expect(migration).toContain('CREATE POLICY "ph_provider_audit_read_admin"');
    expect(migration).toContain("Holds secret NAMES (api_key_ref), never values");
    expect(migration).toMatch(/REVOKE ALL ON TABLE public\.ph_provider_audit FROM anon;/);
  });
});
