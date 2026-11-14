// A failed token refresh must say why, and must never print anything secret.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("supabase/functions/social-oauth/index.ts", "utf8");
const lines = source.split(/\r?\n/).filter((line) => line.includes("[social-oauth]"));

describe("social-oauth refresh logging", () => {
  it("logs each of the three ways a refresh fails", () => {
    expect(source).toContain("not_configured missing=");
    expect(source).toContain("stage=provider");
    expect(source).toContain("stage=store");
    expect(source).toContain("token endpoint refused: host=");
  });

  it("log lines carry no token, secret, key, account id or response body", () => {
    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const line of lines) {
      expect(line).not.toMatch(/accessToken|refreshToken|clientSecret|encryptionKey|accountId|\braw\b|\$\{body/);
    }
  });
});
