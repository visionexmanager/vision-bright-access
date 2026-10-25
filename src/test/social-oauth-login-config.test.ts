import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { authorizeUrl, PROVIDERS } from "../../supabase/functions/_shared/socialOauth.ts";

// The Meta app is a Facebook Login for Business app. That type ignores `scope`
// and grants only what its configuration lists, so a connect link built from
// scopes alone asks for nothing but a name and a picture. When a configuration
// id is set it replaces the scope list.

const REDIRECT = "https://example.supabase.co/functions/v1/social-oauth";

describe("authorizeUrl and the Facebook Login for Business configuration", () => {
  it("asks for the configuration instead of the scopes when one is set", () => {
    const url = new URL(authorizeUrl(PROVIDERS.facebook, "123", REDIRECT, "state", undefined, "999"));
    expect(url.searchParams.get("config_id")).toBe("999");
    expect(url.searchParams.get("override_default_response_type")).toBe("true");
    expect(url.searchParams.has("scope")).toBe(false);
  });

  it("keeps asking for the scopes when no configuration is set", () => {
    const url = new URL(authorizeUrl(PROVIDERS.facebook, "123", REDIRECT, "state"));
    expect(url.searchParams.get("scope")).toContain("pages_manage_posts");
    expect(url.searchParams.has("config_id")).toBe(false);
  });

  it("is passed only for the two providers that sign in through the Meta app", () => {
    const fn = readFileSync("supabase/functions/social-oauth/index.ts", "utf8");
    expect(fn).toContain('platform === "facebook" || platform === "instagram" ? env("META_LOGIN_CONFIG_ID") : undefined');
  });

  it("is carried to Supabase by the deploy sync", () => {
    const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");
    expect(deploy).toMatch(/META_LOGIN_CONFIG_ID:\s+\$\{\{ secrets\.META_LOGIN_CONFIG_ID \}\}/);
    expect(deploy).toMatch(/for name in [^\n]*META_LOGIN_CONFIG_ID/);
  });
});
