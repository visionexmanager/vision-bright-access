import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  composeMessage,
  createFacebookAdapter,
  createInstagramAdapter,
  createThreadsAdapter,
  metaAdapters,
  type AdapterDeps,
  type PublishFetch,
} from "../../supabase/functions/_shared/publishing/metaAdapters.ts";
import { runPublishAttempt } from "../../supabase/functions/_shared/publishing/runner.ts";
import { defaultAdapters } from "../../supabase/functions/_shared/publishing/adapters.ts";
import type {
  ClaimResult,
  Platform,
  PublishAdapter,
  PublishRequest,
  PublishingPorts,
  RpcResult,
} from "../../supabase/functions/_shared/publishing/types.ts";

// Phase 9, step 6 — the adapters that actually post.
//
// EXECUTED FOR REAL: supabase/functions/_shared/publishing/metaAdapters.ts.
// Every call goes through an injected fetch, so the whole file is driven
// without a network, a clock or a credential.
//
// The assertions that matter most are about the interaction with the parking
// rule. A failure reported after the dispatch marker parks the slot for a
// human; that is correct for an ambiguous outcome and ruinous for a rate limit,
// which is transient and will happen. So the tests below care less about happy
// paths than about which failures reach dispatch at all.

const TOKEN = "resolved-account-token";
const ACCOUNT = "account-uuid";

function request(overrides: Partial<PublishRequest> = {}): PublishRequest {
  return {
    publicationId: "pub-1",
    calendarId: "cal-1",
    proposalRef: "A7K2M",
    platform: "facebook",
    contentType: "post",
    language: "en",
    hook: "Visionex Arcade is live",
    body: "Fifty accessible games, playable with a keyboard or a screen reader.",
    hashtags: ["accessibility", "#gaming"],
    attempt: 1,
    maxAttempts: 3,
    account: {
      id: ACCOUNT,
      handle: "visionexworld",
      externalAccountId: "page-111",
      capabilities: ["pages_manage_posts"],
      apiKeyRef: "META_APP_SECRET",
      baseUrl: null,
      config: {},
    },
    ...overrides,
  };
}

/** A fetch that answers from a script and records every request it was given. */
function scriptedFetch(steps: Array<{ ok?: boolean; status?: number; body: unknown }>) {
  const calls: Array<{ url: string; method?: string; body?: string; auth?: string }> = [];
  let index = 0;

  const impl: PublishFetch = (url, init) => {
    calls.push({ url, method: init?.method, body: init?.body, auth: init?.headers?.Authorization });
    const step = steps[Math.min(index, steps.length - 1)] ?? { body: {} };
    index += 1;
    return Promise.resolve({
      ok: step.ok !== false,
      status: step.status ?? (step.ok === false ? 400 : 200),
      json: () => Promise.resolve(step.body),
    });
  };

  return { impl, calls };
}

/**
 * `token` is nullable rather than optional on purpose: passing `undefined`
 * explicitly would select the default parameter, so "this account has no
 * decryptable token" would silently become "this account has one".
 */
function deps(net: { impl: PublishFetch }, token: string | null = TOKEN): AdapterDeps {
  return {
    tokenFor: (id) => (id === ACCOUNT && token !== null ? token : undefined),
    fetchImpl: net.impl,
  };
}

describe("composing the post", () => {
  it("joins hook, body and hashtags and normalises the tags", () => {
    // The column holds tags with and without a leading #, and posting "##tag"
    // is the kind of thing nobody notices until it is on the company page.
    const message = composeMessage(request());
    expect(message).toContain("#accessibility");
    expect(message).toContain("#gaming");
    expect(message).not.toContain("##");
  });

  it("drops duplicate tags case-insensitively", () => {
    const message = composeMessage(request({ hashtags: ["VX", "#vx", "vx"] }));
    expect(message.match(/#vx/gi)).toHaveLength(1);
  });

  it("omits empty parts rather than leaving blank gaps", () => {
    const message = composeMessage(request({ body: "", hashtags: [] }));
    expect(message).toBe("Visionex Arcade is live");
  });
});

describe("Facebook", () => {
  it("posts to the page feed with the token in the header", async () => {
    const net = scriptedFetch([{ body: { id: "page-111_9" } }]);
    const outcome = await createFacebookAdapter(deps(net)).publish(request());

    expect(outcome.status).toBe("published");
    expect(net.calls[0].url).toContain("/page-111/feed");
    expect(net.calls[0].method).toBe("POST");
    expect(net.calls[0].auth).toBe(`Bearer ${TOKEN}`);
    // A credential in a URL ends up in logs and proxies.
    expect(net.calls[0].url).not.toContain(TOKEN);
    expect(net.calls[0].body).not.toContain(TOKEN);
  });

  it("returns the platform's own id and a link to it", async () => {
    const net = scriptedFetch([{ body: { id: "page-111_9" } }]);
    const outcome = await createFacebookAdapter(deps(net)).publish(request());

    if (outcome.status !== "published") throw new Error("expected a published outcome");
    expect(outcome.externalPostId).toBe("page-111_9");
    expect(outcome.externalUrl).toContain("page-111_9");
  });

  it("treats a 200 with no id as unknown, not as success", async () => {
    // Something may have been created. Calling it a failure risks a duplicate
    // on the next attempt, so the database parks it instead.
    const net = scriptedFetch([{ body: {} }]);
    const outcome = await createFacebookAdapter(deps(net)).publish(request());
    expect(outcome.status).toBe("unknown");
  });

  it("names an expired token specifically", async () => {
    const net = scriptedFetch([{ ok: false, body: { error: { code: 190, message: "expired" } } }]);
    const outcome = await createFacebookAdapter(deps(net)).publish(request());

    if (outcome.status === "published") throw new Error("expected a failure");
    // The fix is to reconnect the account, not to retry or edit the post.
    expect(outcome.errorCode).toBe("token_invalid");
  });

  it("never returns anything the platform said", async () => {
    const net = scriptedFetch([{
      ok: false,
      body: { error: { code: 100, message: "POST /feed?access_token=SECRETVALUE failed" } },
    }]);
    const outcome = await createFacebookAdapter(deps(net)).publish(request());
    expect(JSON.stringify(outcome)).not.toContain("SECRETVALUE");
  });

  it("emits error codes the database will accept", async () => {
    // social_publications constrains error_code to ^[a-z0-9_]{1,40}$ and
    // refuses any unbroken 32-character run, which is token-shaped.
    for (const body of [
      { error: { code: 190 } }, { error: { code: 200 } },
      { error: { code: 100 } }, { error: { code: 999 } },
    ]) {
      const net = scriptedFetch([{ ok: false, body }]);
      const outcome = await createFacebookAdapter(deps(net)).publish(request());
      if (outcome.status === "published") throw new Error("expected a failure");
      expect(outcome.errorCode).toMatch(/^[a-z0-9_]{1,40}$/);
      expect(outcome.errorCode).not.toMatch(/[a-z0-9]{32,}/);
    }
  });
});

describe("readiness refuses before anything is dispatched", () => {
  const net = scriptedFetch([{ body: { id: "x" } }]);

  it("refuses when no token could be decrypted", () => {
    const adapter = createFacebookAdapter(deps(net, null));
    expect(adapter.readiness(request()).ready).toBe(false);
    expect(adapter.readiness(request()).errorCode).toBe("no_access_token");
  });

  it("refuses when the account has no page or Instagram id", () => {
    const adapter = createFacebookAdapter(deps(net));
    const withoutId = request({ account: { ...request().account, externalAccountId: null } });
    expect(adapter.readiness(withoutId).errorCode).toBe("no_external_account_id");
  });

  it("refuses text longer than the platform allows", () => {
    // The platform would reject it, and a rejection after dispatch parks the
    // slot for a human when the actual fix is to shorten the text.
    const adapter = createThreadsAdapter(deps(net));
    const long = request({ platform: "threads", body: "x".repeat(600) });
    expect(adapter.readiness(long).errorCode).toBe("content_too_long");
  });

  it("refuses empty content", () => {
    const adapter = createFacebookAdapter(deps(net));
    expect(adapter.readiness(request({ hook: "", body: "", hashtags: [] })).errorCode)
      .toBe("empty_content");
  });
});

describe("a rate limit must not cost every queued slot", () => {
  it("refuses the next attempt at readiness once throttled", async () => {
    const net = scriptedFetch([{ ok: false, status: 429, body: {} }]);
    const adapter = createFacebookAdapter(deps(net));

    expect(adapter.readiness(request()).ready).toBe(true);
    const first = await adapter.publish(request());
    if (first.status === "published") throw new Error("expected a throttle");
    expect(first.errorCode).toBe("platform_rate_limited");

    // The second attempt never reaches the platform, so it is never dispatched
    // and the slot keeps its retry budget instead of being parked.
    const after = adapter.readiness(request());
    expect(after.ready).toBe(false);
    expect(after.errorCode).toBe("platform_rate_limited");
  });

  it("recognises Meta's throttle codes as well as HTTP 429", async () => {
    for (const code of [4, 17, 32, 613]) {
      const net = scriptedFetch([{ ok: false, body: { error: { code } } }]);
      const adapter = createFacebookAdapter(deps(net));
      await adapter.publish(request());
      expect(adapter.readiness(request()).errorCode, `code ${code}`).toBe("platform_rate_limited");
    }
  });

  it("costs at most one slot per run, proved through the runner", async () => {
    // The end-to-end version of the property: the first attempt dispatches and
    // is parked, the second is refused before the marker is written.
    const net = scriptedFetch([{ ok: false, status: 429, body: {} }]);
    const adapters = new Map<Platform, PublishAdapter>(defaultAdapters());
    adapters.set("facebook", createFacebookAdapter(deps(net)));

    const dispatched: string[] = [];
    const ports: PublishingPorts = {
      claimSlot: (): Promise<ClaimResult> => Promise.resolve({ ok: true, request: request() }),
      markDispatched: (id): Promise<RpcResult> => {
        dispatched.push(id);
        return Promise.resolve({ ok: true });
      },
      recordResult: (): Promise<RpcResult> => Promise.resolve({ ok: true }),
    };

    const first = await runPublishAttempt(ports, adapters);
    const second = await runPublishAttempt(ports, adapters);

    expect(first.dispatched).toBe(true);
    expect(second.dispatched).toBe(false);
    expect(second.status).toBe("not_configured");
    expect(dispatched).toHaveLength(1);
  });
});

describe("Threads", () => {
  const threads = () => request({
    platform: "threads",
    account: { ...request().account, externalAccountId: "threads-user-7" },
  });

  it("creates a container and then publishes it", async () => {
    const net = scriptedFetch([
      { body: { id: "container-1" } },
      { body: { id: "thread-9" } },
    ]);
    const outcome = await createThreadsAdapter(deps(net)).publish(threads());

    expect(outcome.status).toBe("published");
    expect(net.calls).toHaveLength(2);
    expect(net.calls[0].url).toContain("/threads-user-7/threads");
    expect(net.calls[0].body).toContain("media_type=TEXT");
    expect(net.calls[1].url).toContain("threads_publish");
    expect(net.calls[1].body).toContain("creation_id=container-1");
  });

  it("uses the Threads host and never the Graph host", async () => {
    const net = scriptedFetch([{ body: { id: "c" } }, { body: { id: "t" } }]);
    await createThreadsAdapter(deps(net)).publish(threads());
    for (const call of net.calls) {
      expect(call.url).toContain("graph.threads.net");
      expect(call.url).not.toContain("graph.facebook.com");
    }
  });

  it("does not publish when the container was refused", async () => {
    const net = scriptedFetch([{ ok: false, body: { error: { code: 100 } } }]);
    const outcome = await createThreadsAdapter(deps(net)).publish(threads());

    expect(outcome.status).toBe("rejected");
    // The second call must not happen: there is no container to publish.
    expect(net.calls).toHaveLength(1);
  });

  it("reports a rejected publish as rejected, since a container is not a post", async () => {
    const net = scriptedFetch([
      { body: { id: "container-1" } },
      { ok: false, body: { error: { code: 100 } } },
    ]);
    const outcome = await createThreadsAdapter(deps(net)).publish(threads());
    expect(outcome.status).toBe("rejected");
  });
});

describe("Instagram", () => {
  const insta = (overrides: Partial<PublishRequest> = {}) => request({
    platform: "instagram",
    account: { ...request().account, externalAccountId: "ig-999" },
    ...overrides,
  });

  it("refuses at readiness because no proposal carries media", () => {
    // Instagram has no text-only post, and content_proposals has no media
    // column. Refusing here costs no dispatch and parks no slot.
    const net = scriptedFetch([{ body: {} }]);
    const readiness = createInstagramAdapter(deps(net)).readiness(insta());

    expect(readiness.ready).toBe(false);
    expect(readiness.errorCode).toBe("media_required");
  });

  it("runs the container workflow in order once media exists", async () => {
    const net = scriptedFetch([
      { body: { id: "container-1" } },
      { body: { status_code: "FINISHED" } },
      { body: { id: "ig-post-3" } },
    ]);
    const withMedia = insta({ mediaUrl: "https://cdn.visionex.app/a.jpg" });
    const adapter = createInstagramAdapter(deps(net));

    expect(adapter.readiness(withMedia).ready).toBe(true);
    const outcome = await adapter.publish(withMedia);

    expect(outcome.status).toBe("published");
    expect(net.calls[0].url).toContain("/ig-999/media");
    expect(net.calls[1].url).toContain("status_code");
    expect(net.calls[2].url).toContain("/ig-999/media_publish");
  });

  it("does not publish a container that failed to process", async () => {
    const net = scriptedFetch([
      { body: { id: "container-1" } },
      { body: { status_code: "ERROR" } },
    ]);
    const outcome = await createInstagramAdapter(deps(net))
      .publish(insta({ mediaUrl: "https://cdn.visionex.app/a.jpg" }));

    expect(outcome.status).toBe("rejected");
    expect(outcome).toMatchObject({ errorCode: "media_processing_failed" });
    // No publish call was made — nothing is public.
    expect(net.calls).toHaveLength(2);
  });
});

describe("what the adapter registry guarantees", () => {
  it("covers exactly the three platforms Visionex can publish to", () => {
    const net = scriptedFetch([{ body: {} }]);
    expect(metaAdapters(deps(net)).map(([name]) => name).sort())
      .toEqual(["facebook", "instagram", "threads"]);
  });

  it("leaves every other platform refusing", () => {
    // TikTok, YouTube, X and LinkedIn have no adapter and must stay inert.
    const net = scriptedFetch([{ body: {} }]);
    const adapters = new Map<Platform, PublishAdapter>(defaultAdapters());
    for (const [name, adapter] of metaAdapters(deps(net))) {
      adapters.set(name as Platform, adapter);
    }
    for (const platform of ["tiktok", "youtube", "x", "linkedin"] as Platform[]) {
      const readiness = adapters.get(platform)!.readiness(request({ platform }));
      expect(readiness.ready, platform).toBe(false);
    }
  });

  it("keeps the runner and its contract free of any platform", () => {
    // The real adapters live in their own file precisely so this stays true.
    for (const file of ["types.ts", "adapters.ts", "runner.ts"]) {
      const src = readFileSync(`supabase/functions/_shared/publishing/${file}`, "utf8");
      expect(src, file).not.toMatch(/https?:\/\//);
      expect(src, file).not.toMatch(/\bfetch\s*\(/);
    }
  });

  it("never retries inside an adapter", async () => {
    // A retry inside publish() is a second external call the database holds no
    // marker for, which is the duplicate this whole design prevents.
    const net = scriptedFetch([{ ok: false, status: 500, body: {} }]);
    await createFacebookAdapter(deps(net)).publish(request());
    expect(net.calls).toHaveLength(1);
  });
});
