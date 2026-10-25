import { describe, expect, it } from "vitest";

import { exchangeLongLivedThreads } from "../../supabase/functions/_shared/metaGrant.ts";

// A refused Threads exchange used to come back as threads_exchange_failed and
// nothing more, because the error body was thrown away. The class and numeric
// codes are kept now (and only those: the message can quote what was sent).

const reply = (body: unknown, ok = true) => () => Promise.resolve({ ok, json: () => Promise.resolve(body) });

describe("exchangeLongLivedThreads failure detail", () => {
  it("keeps Meta's error class and codes, never its message", async () => {
    const out = await exchangeLongLivedThreads("secret", "token", reply({
      error: { type: "OAuthException", code: 190, error_subcode: 463, message: "Error validating access token: secret-looking text" },
    }, false));
    expect(out.ok).toBe(false);
    expect(out.error).toBe("threads_exchange_failed");
    expect(out.detail).toBe("OAuthException-190-463");
    expect(JSON.stringify(out)).not.toContain("secret-looking");
  });

  it("marks an answer with no token and no error body", async () => {
    const out = await exchangeLongLivedThreads("secret", "token", reply({ nothing: true }));
    expect(out.ok).toBe(false);
    expect(out.detail).toBe("no_token");
  });

  it("still returns the token when Meta answers one", async () => {
    const out = await exchangeLongLivedThreads("secret", "token", reply({ access_token: "long", expires_in: 5184000 }));
    expect(out.ok).toBe(true);
    expect(out.accessToken).toBe("long");
  });
});
