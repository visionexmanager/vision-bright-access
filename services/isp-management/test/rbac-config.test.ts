import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { can } from "../src/rbac.js";
import { testEnv } from "./helpers.js";

describe("RBAC matrix", () => {
  it("READ_ONLY_ADMIN can read but never change anything", () => {
    for (const p of ["customer:read", "radius:read", "payment:read"] as const) expect(can("READ_ONLY_ADMIN", p)).toBe(true);
    for (const p of ["service:suspend", "service:resume", "service:activate", "service:terminate", "admin:manage", "killswitch:manage", "audit:read"] as const) expect(can("READ_ONLY_ADMIN", p)).toBe(false);
  });
  it("only SUPER_ADMIN manages admins, the kill switch and termination", () => {
    for (const r of ["ADMIN", "WHATSAPP_ADMIN", "READ_ONLY_ADMIN"] as const) {
      expect(can(r, "admin:manage")).toBe(false);
      expect(can(r, "killswitch:manage")).toBe(false);
      expect(can(r, "service:terminate")).toBe(false);
    }
    expect(can("SUPER_ADMIN", "killswitch:manage")).toBe(true);
  });
  it("WHATSAPP_ADMIN may operate but cannot read the audit log", () => {
    expect(can("WHATSAPP_ADMIN", "service:suspend")).toBe(true);
    expect(can("WHATSAPP_ADMIN", "audit:read")).toBe(false);
  });
  it("an unknown role has no permissions", () => expect(can("ROOT" as never, "customer:read")).toBe(false));
});

describe("configuration", () => {
  it("dangerous flags default to off", () => {
    const e = testEnv();
    for (const k of ["ENABLE_RADIUS_WRITE", "ENABLE_WHATSAPP_WRITE", "ENABLE_CUSTOMER_SUSPENSION", "ENABLE_CUSTOMER_ACTIVATION", "ENABLE_CUSTOMER_TERMINATION"]) delete e[k];
    expect(Object.values(loadConfig(e).flags).some(Boolean)).toBe(false);
  });
  it("production requires https and MFA", () => {
    expect(() => loadConfig(testEnv({ ISP_ENV: "production", ISP_PUBLIC_ORIGIN: "http://x.invalid", REQUIRE_MFA: "true" }))).toThrow();
    expect(() => loadConfig(testEnv({ ISP_ENV: "production", REQUIRE_MFA: "false" }))).toThrow();
    expect(loadConfig(testEnv({ ISP_ENV: "production", REQUIRE_MFA: "true" })).env).toBe("production");
  });
  it("an invalid secret is reported by name, never by value", () => {
    try {
      loadConfig(testEnv({ ISP_ENCRYPTION_KEY: "SUPERSECRETVALUE" }));
      throw new Error("should have thrown");
    } catch (e) {
      expect(String(e)).toContain("ISP_ENCRYPTION_KEY");
      expect(String(e)).not.toContain("SUPERSECRETVALUE");
    }
  });
});
