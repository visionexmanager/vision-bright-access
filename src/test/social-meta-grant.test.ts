import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  META_GRANT_ERRORS,
  exchangeLongLivedThreads,
  exchangeLongLivedUser,
  instagramAccountForPage,
  listManagedPages,
  normaliseHandle,
  listGrantedPermissions,
  refreshThreadsToken,
  selectPage,
  upgradeMetaGrant,
  type GrantFetch,
  type ManagedPage,
} from "../../supabase/functions/_shared/metaGrant.ts";

// Phase 9, step 4 — the grant upgrade.
//
// EXECUTED FOR REAL: supabase/functions/_shared/metaGrant.ts. The module takes
// its fetch as a parameter precisely so this file can drive every branch
// without a network, a clock or a credential. What is asserted is the
// behaviour, not the shape of the source.
//
// The properties worth defending here are the ones whose failure is silent:
// storing a user token instead of a page token produces a connection that looks
// finished and cannot post, and picking the wrong page produces posts on
// someone else's wall.

/** A fetch that answers from a script, in order, and records what it was asked. */
function scriptedFetch(steps: Array<{ ok?: boolean; body: unknown }>) {
  const urls: string[] = [];
  const headers: Array<Record<string, string> | undefined> = [];
  let index = 0;

  const impl: GrantFetch = (input, init) => {
    urls.push(input);
    headers.push(init?.headers);
    const step = steps[Math.min(index, steps.length - 1)] ?? { body: {} };
    index += 1;
    return Promise.resolve({
      ok: step.ok !== false,
      json: () => Promise.resolve(step.body),
    });
  };

  return { impl, urls, headers, get calls() { return urls.length; } };
}

const PAGE_TOKEN = "page-token-value";
const USER_TOKEN = "long-user-token";

describe("the long-lived exchange", () => {
  it("asks for fb_exchange_token and returns the new token", async () => {
    const net = scriptedFetch([{ body: { access_token: USER_TOKEN, expires_in: 5184000 } }]);
    const result = await exchangeLongLivedUser("app-id", "app-secret", "short", net.impl, 0);

    expect(result.ok).toBe(true);
    expect(result.accessToken).toBe(USER_TOKEN);
    expect(net.urls[0]).toContain("grant_type=fb_exchange_token");
    // Not the OAuth `refresh_token` grant. Meta does not implement it, and the
    // flow used to send it anyway.
    expect(net.urls[0]).not.toContain("grant_type=refresh_token");
  });

  it("turns expires_in into an absolute instant", async () => {
    const net = scriptedFetch([{ body: { access_token: USER_TOKEN, expires_in: 60 } }]);
    const result = await exchangeLongLivedUser("id", "secret", "short", net.impl, 0);
    expect(result.expiresAt).toBe(new Date(60_000).toISOString());
  });

  it("refuses a body that carries an error, even with HTTP 200", async () => {
    // Meta answers some failures 200 with an `error` object. Reading only the
    // status would treat that as a successful exchange.
    const net = scriptedFetch([{ ok: true, body: { error: { message: "bad" } } }]);
    const result = await exchangeLongLivedUser("id", "secret", "short", net.impl);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("long_lived_exchange_failed");
  });

  it("never returns anything the provider said", async () => {
    const net = scriptedFetch([{ ok: false, body: { error: { message: "secret=abc123" } } }]);
    const result = await exchangeLongLivedUser("id", "secret", "short", net.impl);
    expect(JSON.stringify(result)).not.toContain("abc123");
    expect(META_GRANT_ERRORS).toContain(result.error);
  });
});

describe("listing pages", () => {
  it("sends the user token as a header, not in the query string", async () => {
    const net = scriptedFetch([{ body: { data: [{ id: "1", access_token: PAGE_TOKEN }] } }]);
    await listManagedPages(USER_TOKEN, net.impl);

    expect(net.headers[0]?.Authorization).toBe(`Bearer ${USER_TOKEN}`);
    expect(net.urls[0]).not.toContain(USER_TOKEN);
  });

  it("drops pages that carry no token", async () => {
    // A page with no token is a page this grant cannot publish to. Keeping it
    // would let selectPage() choose it and store no usable credential.
    const net = scriptedFetch([{
      body: { data: [{ id: "1", name: "No token" }, { id: "2", name: "Real", access_token: PAGE_TOKEN }] },
    }]);
    const result = await listManagedPages(USER_TOKEN, net.impl);

    expect(result.ok).toBe(true);
    expect(result.pages).toHaveLength(1);
    expect(result.pages?.[0].id).toBe("2");
  });

  it("reports an account that administers nothing", async () => {
    const net = scriptedFetch([{ body: { data: [] } }]);
    expect((await listManagedPages(USER_TOKEN, net.impl)).error).toBe("no_pages_available");
  });
});

describe("choosing which page this connection is for", () => {
  const pages: ManagedPage[] = [
    { id: "111", name: "Visionex World", username: "visionexworld", accessToken: "a" },
    { id: "222", name: "Visionex Arcade", username: "visionexarcade", accessToken: "b" },
  ];

  it("matches on username, ignoring @ and case", () => {
    expect(selectPage(pages, "@VisionexWorld").page?.id).toBe("111");
  });

  it("matches on the page id and on the page name", () => {
    expect(selectPage(pages, "222").page?.id).toBe("222");
    expect(selectPage(pages, "visionex arcade").page?.id).toBe("222");
  });

  it("refuses rather than guessing when several pages and none match", () => {
    // Guessing here does not fail — it succeeds against the wrong page, and the
    // way that is discovered is a post appearing somewhere nobody meant.
    const choice = selectPage(pages, "something-else");
    expect(choice.ok).toBe(false);
    expect(choice.error).toBe("page_not_matched");
  });

  it("uses the only page when there is exactly one, matched or not", () => {
    expect(selectPage([pages[0]], "typo").page?.id).toBe("111");
  });

  it("normalises handles consistently", () => {
    expect(normaliseHandle("  @Visionex  ")).toBe("visionex");
  });
});

describe("reading what was actually granted", () => {
  it("keeps only permissions Meta reports as granted", async () => {
    // Meta lists declined and expired permissions alongside granted ones.
    // Counting a row's presence as a grant would report a permission the
    // operator explicitly refused as though they had allowed it.
    const net = scriptedFetch([{
      body: {
        data: [
          { permission: "pages_manage_posts", status: "granted" },
          { permission: "pages_read_engagement", status: "declined" },
          { permission: "business_management", status: "expired" },
        ],
      },
    }]);
    const granted = await listGrantedPermissions(USER_TOKEN, net.impl);

    expect(granted).toEqual(["pages_manage_posts"]);
  });

  it("returns nothing rather than guessing when the call fails", async () => {
    const net = scriptedFetch([{ ok: false, body: {} }]);
    expect(await listGrantedPermissions(USER_TOKEN, net.impl)).toEqual([]);
  });

  it("is what lets a Meta account ever become publishable", async () => {
    // Meta's authorisation-code response carries no `scope` at all, so without
    // this read the granted-scope list is permanently empty,
    // publishing_permission_granted can never be true, and no Facebook or
    // Instagram account can be activated however complete the app review is.
    const net = scriptedFetch([
      { body: { access_token: USER_TOKEN } },
      { body: { data: [{ permission: "pages_manage_posts", status: "granted" }] } },
      { body: { data: [{ id: "111", access_token: PAGE_TOKEN }] } },
    ]);
    const result = await upgradeMetaGrant("facebook", "id", "secret", "s", "111", net.impl);

    expect(result.grantedScopes).toContain("pages_manage_posts");
  });

  it("never substitutes the requested scopes for the granted ones", async () => {
    const net = scriptedFetch([
      { body: { access_token: USER_TOKEN } },
      { body: { data: [] } },
      { body: { data: [{ id: "111", access_token: PAGE_TOKEN }] } },
    ]);
    const result = await upgradeMetaGrant("facebook", "id", "secret", "s", "111", net.impl);

    // An incomplete app review must not look like a finished one.
    expect(result.ok).toBe(true);
    expect(result.grantedScopes).toEqual([]);
  });
});

describe("the whole upgrade, per platform", () => {
  it("stores a PAGE token for Facebook, not the user token", async () => {
    const net = scriptedFetch([
      { body: { access_token: USER_TOKEN, expires_in: 5184000 } },
      { body: { data: [{ permission: "pages_manage_posts", status: "granted" }] } },
      { body: { data: [{ id: "111", username: "visionexworld", access_token: PAGE_TOKEN }] } },
    ]);
    const result = await upgradeMetaGrant(
      "facebook", "id", "secret", "short-user-token", "@visionexworld", net.impl,
    );

    expect(result.ok).toBe(true);
    // The entire point of step 4: a user token cannot post to a page.
    expect(result.accessToken).toBe(PAGE_TOKEN);
    expect(result.accessToken).not.toBe(USER_TOKEN);
    expect(result.externalAccountId).toBe("111");
  });

  it("records no expiry for a page token, because it does not expire", async () => {
    const net = scriptedFetch([
      { body: { access_token: USER_TOKEN, expires_in: 5184000 } },
      { body: { data: [{ id: "111", access_token: PAGE_TOKEN }] } },
    ]);
    const result = await upgradeMetaGrant("facebook", "id", "secret", "s", "111", net.impl);

    // Inheriting the user token's 60 days would make the claim predicate treat
    // a healthy account as disconnected on a date nothing actually happens.
    expect(result.expiresAt).toBeNull();
  });

  it("addresses Instagram by its own id but authorises with the page token", async () => {
    const net = scriptedFetch([
      { body: { access_token: USER_TOKEN } },
      { body: { data: [{ permission: "instagram_content_publish", status: "granted" }] } },
      { body: { data: [{ id: "111", username: "visionexworld", access_token: PAGE_TOKEN }] } },
      { body: { instagram_business_account: { id: "ig-999", username: "visionexworld" } } },
    ]);
    const result = await upgradeMetaGrant(
      "instagram", "id", "secret", "short", "visionexworld", net.impl,
    );

    expect(result.ok).toBe(true);
    expect(result.externalAccountId).toBe("ig-999");
    expect(result.accessToken).toBe(PAGE_TOKEN);
  });

  it("names an unlinked Instagram account specifically", async () => {
    const net = scriptedFetch([
      { body: { access_token: USER_TOKEN } },
      { body: { data: [{ permission: "instagram_content_publish", status: "granted" }] } },
      { body: { data: [{ id: "111", access_token: PAGE_TOKEN }] } },
      { body: { id: "111" } },
    ]);
    const result = await upgradeMetaGrant("instagram", "id", "secret", "s", "111", net.impl);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("instagram_account_missing");
  });

  it("exchanges a Threads token without touching the Graph host", async () => {
    const net = scriptedFetch([{ body: { access_token: "threads-long", expires_in: 5184000 } }]);
    const result = await upgradeMetaGrant("threads", "id", "secret", "short", "@vx", net.impl);

    expect(result.ok).toBe(true);
    expect(result.accessToken).toBe("threads-long");
    expect(net.calls).toBe(1);
    expect(net.urls[0]).toContain("graph.threads.net");
    expect(net.urls[0]).toContain("grant_type=th_exchange_token");
    // A separate product. Reusing the Graph host fails at authorize with an
    // error that reads like a scope problem.
    expect(net.urls[0]).not.toContain("graph.facebook.com");
  });

  it("stops at the first failed step and makes no further call", async () => {
    const net = scriptedFetch([{ ok: false, body: { error: "nope" } }]);
    const result = await upgradeMetaGrant("facebook", "id", "secret", "s", "x", net.impl);

    expect(result.ok).toBe(false);
    expect(net.calls).toBe(1);
  });
});

describe("extending a Threads token", () => {
  it("presents the access token itself, with no refresh token", async () => {
    const net = scriptedFetch([{ body: { access_token: "extended", expires_in: 5184000 } }]);
    const result = await refreshThreadsToken("current-threads-token", net.impl, 0);

    expect(result.ok).toBe(true);
    expect(result.accessToken).toBe("extended");
    expect(net.urls[0]).toContain("grant_type=th_refresh_token");
    expect(net.urls[0]).toContain("refresh_access_token");
  });

  it("fails with its own code rather than a generic one", async () => {
    const net = scriptedFetch([{ ok: false, body: {} }]);
    expect((await refreshThreadsToken("t", net.impl)).error).toBe("threads_refresh_failed");
  });
});

describe("what this module must never do", () => {
  const grant = readFileSync("supabase/functions/_shared/metaGrant.ts", "utf8");

  it("holds no credential literal", () => {
    expect(grant).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(grant).not.toMatch(/\b[A-Za-z0-9_-]{40,}\b/);
  });

  it("reaches only Meta's own hosts", () => {
    const urls = [...grant.matchAll(/https:\/\/([a-z.]+)/g)].map((m) => m[1]);
    for (const host of new Set(urls)) {
      expect(["graph.threads.net"], host).toContain(host);
    }
    // The Graph host arrives through the shared version module rather than
    // being written again here, which is what keeps one version in one place.
    expect(grant).toContain('import { GRAPH_BASE } from "./meta.ts"');
  });

  it("has an Instagram path that cannot silently fall back to a user token", async () => {
    // If the page lookup fails there is no credential to store, and returning
    // the user token instead would produce a connection that cannot post.
    const net = scriptedFetch([
      { body: { access_token: USER_TOKEN } },
      { ok: false, body: {} },
    ]);
    const result = await upgradeMetaGrant("instagram", "id", "secret", "s", "x", net.impl);
    expect(result.ok).toBe(false);
    expect(result.accessToken).toBeUndefined();
  });

  it("declares every error it can return", async () => {
    const net = scriptedFetch([{ ok: false, body: {} }]);
    const failures = [
      (await exchangeLongLivedUser("i", "s", "t", net.impl)).error,
      (await listManagedPages("t", net.impl)).error,
      (await instagramAccountForPage("1", "t", net.impl)).error,
      (await exchangeLongLivedThreads("s", "t", net.impl)).error,
      (await refreshThreadsToken("t", net.impl)).error,
      selectPage([], "x").error,
    ];
    for (const code of failures) expect(META_GRANT_ERRORS).toContain(code);
  });
});
