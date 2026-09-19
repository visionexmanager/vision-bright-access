// A provider the connection page offers must have its credentials in the
// deploy sync, or connecting it fails in production on a missing client id.
//
// YouTube was exactly that: socialOauth.ts has read GOOGLE_OAUTH_CLIENT_ID
// since the provider was added, and deploy.yml never sent it to Supabase, so
// the button existed and the connection could not work. TikTok and X had the
// same gap. Nothing failed at build time, and no check noticed.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const oauth = readFileSync("supabase/functions/_shared/socialOauth.ts", "utf8");
const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");

/** Every provider block, with its env var names and whether it is blocked. */
function providers(): Array<{ platform: string; envs: string[]; blocked: boolean }> {
  const out: Array<{ platform: string; envs: string[]; blocked: boolean }> = [];
  for (const match of oauth.matchAll(/^ {2}([a-z]+): \{$/gm)) {
    const start = match.index ?? 0;
    const end = oauth.indexOf("\n  },", start);
    const block = oauth.slice(start, end < 0 ? undefined : end);
    const envs = [...block.matchAll(/client(?:Id|Secret)Env: "([A-Z0-9_]+)"/g)].map((m) => m[1]);
    if (envs.length === 0) continue;
    out.push({
      platform: match[1],
      envs,
      blocked: !/blockedReason: null/.test(block),
    });
  }
  return out;
}

describe("OAuth credentials reach production", () => {
  const all = providers();

  it("reads a provider table with the platforms we know about", () => {
    expect(all.map((p) => p.platform)).toEqual(
      expect.arrayContaining(["facebook", "instagram", "threads", "youtube", "tiktok", "x"]),
    );
  });

  for (const provider of all.filter((p) => !p.blocked)) {
    it(`${provider.platform}: ${provider.envs.join(", ")} are synced by deploy.yml`, () => {
      for (const name of provider.envs) {
        // In the loop that sets them on Supabase …
        expect(deploy, `${name} is missing from the secret-sync loop`)
          .toMatch(new RegExp(`for name in [^\\n]*\\b${name}\\b`));
        // … and bound to a repository secret, or the loop reads an empty value.
        expect(deploy, `${name} is not bound to a repository secret`)
          .toContain(`secrets.${name} }}`);
      }
    });
  }
});
