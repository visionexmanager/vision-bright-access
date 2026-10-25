import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// social_connection_status() answers `forbidden` unless auth.uid() is an admin.
// The service role has no uid, so calling it through the service client made
// the connections screen list no account, however many were connected.

const fn = readFileSync("supabase/functions/social-oauth/index.ts", "utf8");

describe("the status action", () => {
  it("reads the connection status as the signed-in admin, not as the service role", () => {
    expect(fn).toContain('asCaller.rpc("social_connection_status")');
    expect(fn).not.toContain('service.rpc("social_connection_status")');
  });

  it("still checks for an admin before it answers", () => {
    const status = fn.slice(fn.indexOf('action === "status"'));
    expect(fn.indexOf("Admin access required")).toBeGreaterThan(-1);
    expect(fn.indexOf("Admin access required")).toBeLessThan(fn.indexOf('action === "status"'));
    expect(status).toContain("social_connection_status");
  });
});
