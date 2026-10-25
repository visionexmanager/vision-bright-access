import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The screen shows one account per platform. With two rows for Facebook (an
// earlier attempt under another handle and the connected Page) the unconnected
// leftover was shown and the Record review / Activate buttons acted on it.

const screen = readFileSync("src/pages/admin/AdminSocialConnections.tsx", "utf8");

describe("the connections screen picks the account that was connected", () => {
  it("no longer lets the last row win", () => {
    expect(screen).not.toMatch(/for \(const account of status\?\.accounts \?\? \[\]\) map\.set\(account\.platform, account\);/);
  });

  it("prefers the row connected most recently", () => {
    expect(screen).toContain("connectedAt(account) > connectedAt(current)");
    expect(screen).toContain("account.last_connected_at");
  });
});
