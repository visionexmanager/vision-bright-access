import { describe, expect, it } from "vitest";

import { inspectThreadsGrant, upgradeMetaGrant } from "../../supabase/functions/_shared/metaGrant.ts";
import { normaliseTokenResponse } from "../../supabase/functions/_shared/socialOauth.ts";

// Threads gives no permissions list and its token response carries no scope,
// so a connected account used to be stored with no scopes and could never be
// reported as able to publish. The grant is now read from what the token can do.

type Reply = { ok: boolean; body: unknown };

/** A fetch that answers by URL path fragment. */
const route = (table: Record<string, Reply>) => (url: string) => {
  const key = Object.keys(table).find((fragment) => url.includes(fragment));
  const reply = key ? table[key] : { ok: false, body: { error: { type: "x", code: 1 } } };
  return Promise.resolve({ ok: reply.ok, json: () => Promise.resolve(reply.body) });
};

describe("inspectThreadsGrant", () => {
  it("reports publishing only when the publishing edge answers", async () => {
    const seen = await inspectThreadsGrant("token", route({
      "/me": { ok: true, body: { id: "42", username: "visionexworld" } },
      "threads_publishing_limit": { ok: true, body: { data: [{ quota_usage: 0 }] } },
    }));
    expect(seen).toEqual({ id: "42", username: "visionexworld", grantedScopes: ["threads_basic", "threads_content_publish"] });
  });

  it("reports only threads_basic when the publishing edge refuses", async () => {
    const seen = await inspectThreadsGrant("token", route({
      "/me": { ok: true, body: { id: "42", username: "visionexworld" } },
      "threads_publishing_limit": { ok: false, body: { error: { type: "THApiException", code: 10 } } },
    }));
    expect(seen.grantedScopes).toEqual(["threads_basic"]);
  });

  it("grants nothing when the profile cannot be read", async () => {
    const seen = await inspectThreadsGrant("token", route({}));
    expect(seen.grantedScopes).toEqual([]);
    expect(seen.id).toBeUndefined();
  });
});

describe("the Threads upgrade", () => {
  it("returns the id, the handle and the evidence-based scopes with the long-lived token", async () => {
    const out = await upgradeMetaGrant("threads", "app", "secret", "short", "visionexworld", route({
      "access_token?": { ok: true, body: { access_token: "long", expires_in: 5184000 } },
      "/me": { ok: true, body: { id: "42", username: "visionexworld" } },
      "threads_publishing_limit": { ok: true, body: { data: [] } },
    }));
    expect(out.ok).toBe(true);
    expect(out.accessToken).toBe("long");
    expect(out.externalAccountId).toBe("42");
    expect(out.handle).toBe("visionexworld");
    expect(out.grantedScopes).toContain("threads_content_publish");
  });
});

describe("normaliseTokenResponse and a numeric user id", () => {
  it("keeps the id Threads sends as a number", () => {
    const out = normaliseTokenResponse({ access_token: "short", user_id: 17841400000000000 });
    expect(out.ok).toBe(true);
    expect(out.externalUserId).toBe(String(17841400000000000));
  });
});
