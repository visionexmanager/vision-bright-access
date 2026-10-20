import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261075000000_whatsapp_gate_renotice.sql", "utf8");

describe("WhatsApp subscription gate never goes silent for good", () => {
  it("re-sends the static notice to an unentitled sender after a bounded interval", () => {
    expect(sql).toMatch(/_verdict = 'blocked_silent'/);
    expect(sql).toMatch(/notified_at < now\(\) - interval '10 minutes'/);
    expect(sql).toMatch(/RETURN 'blocked_first_notice'/);
  });

  it("keeps the owner exempt and the grant scoped to service_role", () => {
    expect(sql).toMatch(/whatsapp_is_owner_number/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.ai_subscription_gate_whatsapp\(text\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.ai_subscription_gate_whatsapp\(text\) TO service_role/);
  });
});
