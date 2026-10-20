import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translations as en } from "@/i18n/en";

// The admin user list used to log, to the console only, that its profile list or its
// balances were incomplete. The admin must be told on screen, in an announced alert.
const source = readFileSync("src/pages/admin/AdminUsers.tsx", "utf8");

describe("AdminUsers incomplete-data notice", () => {
  it("announces an incomplete list or unavailable balances in an alert", () => {
    expect(source).toMatch(/role="alert"[\s\S]*admin\.users\.listIncomplete[\s\S]*admin\.users\.balancesUnavailable/);
  });
  it("derives both flags from the read results, not from constants", () => {
    expect(source).toContain("setListIncomplete(!profilesRead.complete)");
    expect(source).toContain('setBalancesUnavailable(source.kind !== "full")');
  });
  it("has English text for both keys", () => {
    expect(en["admin.users.listIncomplete"]).toBeTruthy();
    expect(en["admin.users.balancesUnavailable"]).toBeTruthy();
  });
});
