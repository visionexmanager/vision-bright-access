import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  INSTAGRAM_GRAPH,
  MESSAGING_SCOPE,
  MESSAGING_SCOPES,
  channelForObject,
  parseMetaWebhook,
  sendMetaMessage,
  type MessagingFetch,
} from "../../supabase/functions/_shared/messaging/metaMessaging.ts";
import {
  MESSAGING_WINDOW_HOURS,
  withinMessagingWindow,
} from "../../supabase/functions/_shared/messaging/types.ts";

// Facebook Messenger and Instagram Direct.
//
// EXECUTED FOR REAL: _shared/messaging/metaMessaging.ts and types.ts. Both take
// their fetch and their clock as parameters, so every branch is driven without
// a network and without waiting.
//
// The properties defended here are the ones whose failure reaches a real
// customer: answering the inbox's own echo, replying twice to a redelivered
// webhook, and sending outside the window Meta's policy allows.

const webhook = readFileSync("supabase/functions/meta-messaging-webhook/index.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260914000000_meta_customer_messaging.sql",
  "utf8",
).replace(/\r\n/g, "\n");
const whatsappWebhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const adapter = readFileSync("supabase/functions/_shared/messaging/metaMessaging.ts", "utf8");

/** One Messenger-shaped delivery. */
function delivery(events: unknown[], object = "page") {
  return { object, entry: [{ id: "page-111", time: 1, messaging: events }] };
}

function textEvent(overrides: Record<string, unknown> = {}) {
  return {
    sender: { id: "psid-1" },
    recipient: { id: "page-111" },
    timestamp: 1_700_000_000_000,
    message: { mid: "mid-1", text: "Do you ship to Amman?" },
    ...overrides,
  };
}

describe("routing a delivery to the right inbox", () => {
  it("recognises both webhook objects and nothing else", () => {
    expect(channelForObject("page")).toBe("messenger");
    expect(channelForObject("instagram")).toBe("instagram");
    // The WhatsApp object must not be claimed by this adapter — that inbox has
    // its own function, its own secret and its own tables.
    expect(channelForObject("whatsapp_business_account")).toBeNull();
    expect(channelForObject(undefined)).toBeNull();
  });

  it("names the permission each inbox needs", () => {
    expect(MESSAGING_SCOPE.messenger).toBe("pages_messaging");
    // Visionex runs Instagram API with Instagram Login, whose permission
    // vocabulary is the instagram_business_* one.
    expect(MESSAGING_SCOPE.instagram).toBe("instagram_business_manage_messages");
    // WhatsApp is not granted through this OAuth flow at all.
    expect(MESSAGING_SCOPE.whatsapp).toBeNull();
  });

  it("accepts either Instagram permission vocabulary", () => {
    // Instagram API with Facebook Login grants instagram_manage_messages;
    // Instagram API with Instagram Login grants the business_ name. Accepting
    // only one reports a correctly approved app as unapproved, which is
    // indistinguishable from a real refusal.
    expect(MESSAGING_SCOPES.instagram).toContain("instagram_business_manage_messages");
    expect(MESSAGING_SCOPES.instagram).toContain("instagram_manage_messages");
    expect(MESSAGING_SCOPES.messenger).toEqual(["pages_messaging"]);
    expect(MESSAGING_SCOPES.whatsapp).toEqual([]);
  });
});

describe("normalising an inbound message", () => {
  it("produces one common shape regardless of channel", () => {
    const { messages } = parseMetaWebhook(delivery([textEvent()]), "messenger");

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      channel: "messenger",
      senderId: "psid-1",
      recipientId: "page-111",
      messageId: "mid-1",
      text: "Do you ship to Amman?",
    });
    expect(messages[0].sentAt).toBe(new Date(1_700_000_000_000).toISOString());
  });

  it("carries no credential and no raw payload", () => {
    const { messages } = parseMetaWebhook(delivery([textEvent()]), "instagram");
    const serialised = JSON.stringify(messages[0]);
    expect(serialised).not.toMatch(/token|secret|access/i);
  });

  it("labels an attachment rather than dropping it", () => {
    const { messages } = parseMetaWebhook(
      delivery([textEvent({ message: { mid: "mid-2", attachments: [{ type: "image" }] } })]),
      "messenger",
    );
    expect(messages[0].text).toBe("");
    expect(messages[0].unsupportedType).toBe("image");
  });
});

describe("what must never reach the assistant", () => {
  it("drops the inbox's own echo", () => {
    // The loop-breaker. An echo is the page's own outbound message reflected
    // back; answering one makes the assistant reply to itself, then to that,
    // for as long as the window stays open — with a customer watching.
    const { messages, skipped } = parseMetaWebhook(
      delivery([textEvent({ message: { mid: "mid-3", text: "Hello", is_echo: true } })]),
      "messenger",
    );
    expect(messages).toHaveLength(0);
    expect(skipped[0].reason).toBe("echo");
  });

  it("drops delivery receipts, read receipts and reactions", () => {
    const { messages, skipped } = parseMetaWebhook(
      delivery([
        { sender: { id: "a" }, recipient: { id: "b" }, delivery: { mids: ["x"] } },
        { sender: { id: "a" }, recipient: { id: "b" }, read: { watermark: 1 } },
        { sender: { id: "a" }, recipient: { id: "b" }, reaction: { emoji: "❤" } },
      ]),
      "messenger",
    );
    expect(messages).toHaveLength(0);
    expect(skipped.map((s) => s.reason)).toEqual(["delivery", "read", "reaction"]);
  });

  it("drops an event with no id to make a retry idempotent", () => {
    // Without a message id a redelivery cannot be recognised, so the message
    // would be answered twice. Refusing it is the safe direction.
    const { messages } = parseMetaWebhook(
      delivery([textEvent({ message: { text: "no mid here" } })]),
      "messenger",
    );
    expect(messages).toHaveLength(0);
  });

  it("never throws on a malformed body", () => {
    // A parser that throws turns a bad delivery into a non-200, and a non-200
    // makes Meta redeliver the same bytes — the bug would become a retry storm.
    for (const bad of [null, undefined, {}, { entry: "nope" }, { entry: [null] },
      { entry: [{ messaging: [null, 7, "x"] }] }]) {
      expect(() => parseMetaWebhook(bad, "messenger")).not.toThrow();
    }
  });
});

describe("the messaging window", () => {
  const now = Date.parse("2026-08-18T12:00:00Z");

  it("allows a reply inside 24 hours", () => {
    expect(withinMessagingWindow("2026-08-18T11:00:00Z", now)).toBe(true);
    expect(MESSAGING_WINDOW_HOURS).toBe(24);
  });

  it("refuses a reply outside it", () => {
    expect(withinMessagingWindow("2026-08-17T11:00:00Z", now)).toBe(false);
  });

  it("treats an unknown last-inbound time as closed", () => {
    // No evidence the customer wrote first means messaging them would be
    // unsolicited, so the safe direction is closed.
    expect(withinMessagingWindow(null, now)).toBe(false);
    expect(withinMessagingWindow(undefined, now)).toBe(false);
    expect(withinMessagingWindow("not a date", now)).toBe(false);
  });

  it("refuses a timestamp in the future", () => {
    expect(withinMessagingWindow("2026-08-19T00:00:00Z", now)).toBe(false);
  });
});

describe("sending a reply", () => {
  function scriptedFetch(step: { ok?: boolean; status?: number; body: unknown }) {
    const calls: Array<{ url: string; body?: string; auth?: string }> = [];
    const impl: MessagingFetch = (url, init) => {
      calls.push({ url, body: init?.body, auth: init?.headers?.Authorization });
      return Promise.resolve({
        ok: step.ok !== false,
        status: step.status ?? (step.ok === false ? 400 : 200),
        json: () => Promise.resolve(step.body),
      });
    };
    return { impl, calls };
  }

  const base = {
    channel: "messenger" as const,
    fromAccountId: "page-111",
    toUserId: "psid-1",
    text: "We ship across Jordan.",
    token: "page-token-value",
  };

  it("declares the message a RESPONSE, never an unsolicited send", async () => {
    const net = scriptedFetch({ body: { message_id: "m-1" } });
    const result = await sendMetaMessage({ ...base, fetchImpl: net.impl });

    expect(result.ok).toBe(true);
    expect(net.calls[0].body).toContain('"messaging_type":"RESPONSE"');
    expect(net.calls[0].url).toContain("/page-111/messages");
  });

  it("puts the token in a header and never in the URL or body", async () => {
    const net = scriptedFetch({ body: { message_id: "m-1" } });
    await sendMetaMessage({ ...base, fetchImpl: net.impl });

    expect(net.calls[0].auth).toBe("Bearer page-token-value");
    expect(net.calls[0].url).not.toContain("page-token-value");
    expect(net.calls[0].body).not.toContain("page-token-value");
  });

  it("never returns anything the platform said", async () => {
    const net = scriptedFetch({
      ok: false,
      body: { error: { code: 100, message: "POST /messages?access_token=LEAKED failed" } },
    });
    const result = await sendMetaMessage({ ...base, fetchImpl: net.impl });
    expect(JSON.stringify(result)).not.toContain("LEAKED");
  });

  it("names the failures that need different remedies", async () => {
    const cases: Array<[number, string]> = [
      [190, "token_invalid"],
      [10, "permission_denied"],
      [551, "recipient_unavailable"],
      [4, "platform_rate_limited"],
    ];
    for (const [code, expected] of cases) {
      const net = scriptedFetch({ ok: false, body: { error: { code } } });
      const result = await sendMetaMessage({ ...base, fetchImpl: net.impl });
      expect(result.error, `code ${code}`).toBe(expected);
    }
  });

  it("never retries internally", async () => {
    // A resend after an ambiguous failure is a duplicate message to a real
    // person. The caller records the attempt either way.
    const net = scriptedFetch({ ok: false, status: 500, body: {} });
    await sendMetaMessage({ ...base, fetchImpl: net.impl });
    expect(net.calls).toHaveLength(1);
  });
});

describe("the webhook's own guarantees", () => {
  it("verifies every delivery and fails closed", () => {
    expect(webhook).toContain("verifySignature(rawBody, req.headers.get(\"x-hub-signature-256\")");
    expect(webhook).toContain('env("META_APP_SECRET")');
    // Unset secrets must refuse, not accept. Covered in full by the
    // "two app secrets" block below.
    expect(webhook).toMatch(/if \(secrets\.length === 0\)[\s\S]{0,300}status: 503/);
    // The signature is taken over the RAW body, never a re-serialised object.
    expect(webhook).toContain("await req.text()");
    expect(webhook).not.toContain("JSON.stringify(payload)");
  });

  it("uses its own verify token, not the live WhatsApp one", () => {
    expect(webhook).toContain("INSTAGRAM_WEBHOOK_VERIFY_TOKEN");
    // Asserted against what it READS. The file names WHATSAPP_TOKEN once, in a
    // comment explaining that the Instagram token follows the same pattern —
    // forbidding the bare string would forbid explaining the design.
    for (const secret of ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET", "WHATSAPP_TOKEN",
      "WHATSAPP_PHONE_NUMBER_ID"]) {
      expect(webhook, secret).not.toContain(`env("${secret}")`);
      expect(webhook, secret).not.toContain(`Deno.env.get("${secret}")`);
    }
  });

  it("reuses the assistant and the provider chain rather than adding one", () => {
    expect(webhook).toContain('getAssistant("whatsapp-support")');
    expect(webhook).toContain("streamChatCompletionWithFallback");
    // No second model configuration, no direct provider call.
    expect(webhook).not.toMatch(/api\.openai\.com|api\.groq\.com|generativelanguage/);
  });

  it("reuses the shared conversation helpers instead of reimplementing them", () => {
    for (const helper of [
      "detectLanguage", "welcomeFor", "handoverNotice", "failureNotice",
      "unsupportedTypeNotice", "userAskedForHuman", "replySignalsHandover", "clampReply",
    ]) {
      expect(webhook, helper).toContain(helper);
    }
    expect(webhook).toContain('from "../_shared/whatsapp.ts"');
  });

  it("records the inbound message before deciding whether it may reply", () => {
    // An inbox that is switched off must still not lose what a customer wrote.
    const insertAt = webhook.indexOf('.from("meta_messages").insert');
    const gateAt = webhook.indexOf("if (!allowed)");
    expect(insertAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(insertAt);
  });

  it("treats a duplicate delivery as a no-op before calling the model", () => {
    expect(webhook).toContain('duplicate.code === "23505"');
    const dupeAt = webhook.indexOf('duplicate.code === "23505"');
    // The CALL site, not the import at the top of the file — comparing against
    // the import would compare against position 352 and always pass.
    const modelAt = webhook.indexOf(
      "streamChatCompletionWithFallback(",
      webhook.indexOf("Deno.serve("),
    );
    expect(modelAt).toBeGreaterThan(-1);
    expect(dupeAt).toBeLessThan(modelAt);
  });

  it("checks the window before sending and escalates instead of violating it", () => {
    expect(webhook).toContain("withinMessagingWindow(incoming.sentAt)");
    expect(webhook).toContain("messaging_window_closed");
  });

  it("bounds the model call so Meta does not retry mid-answer", () => {
    expect(webhook).toContain("REPLY_TIMEOUT_MS");
    expect(webhook).toContain("withTimeout(");
  });

  it("always acknowledges, so one failure cannot replay the whole batch", () => {
    expect(webhook).toContain('return new Response("OK", { status: 200 })');
    // The per-message catch is what keeps one bad message from failing the rest.
    expect(webhook).toMatch(/catch \(e\)[\s\S]{0,300}failed to handle a message/);
  });

  it("logs no credential and no message content", () => {
    // Asserted against what is INTERPOLATED, not against the words used. A log
    // line may say "no usable token" — that is prose describing a failure and
    // carries nothing; what must never appear is the value of a token, of the
    // customer's message, or of the reply.
    const logs = [...webhook.matchAll(/console\.(?:log|error)\(([^;]*)\)/g)].map((m) => m[1]);
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line, line).not.toMatch(/\$\{\s*(token|answer|body|rawBody|payload)\s*\}/);
      expect(line, line).not.toMatch(/\$\{[^}]*\.(text|access_token|body)\b/);
    }
  });
});

describe("the live WhatsApp integration is untouched", () => {
  it("still reads its own secrets and its own tables", () => {
    for (const needle of [
      "WHATSAPP_APP_SECRET", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID",
      "whatsapp_conversations", "whatsapp_messages",
    ]) {
      expect(whatsappWebhook, needle).toContain(needle);
    }
  });

  it("knows nothing about the new tables or channels", () => {
    for (const needle of ["meta_conversations", "meta_messages", "meta_messaging_allowed"]) {
      expect(whatsappWebhook, needle).not.toContain(needle);
    }
  });

  it("is not altered by the new migration", () => {
    expect(migration).not.toMatch(/ALTER TABLE public\.whatsapp_/);
    expect(migration).not.toMatch(/DROP .*whatsapp/i);
    expect(migration).not.toMatch(/(INSERT INTO|UPDATE|DELETE FROM) public\.whatsapp_/);
    expect(migration).not.toContain("POLICY \"Admins can view whatsapp");
  });
});

describe("nothing answers until two separate things are true", () => {
  it("defaults the switch to off", () => {
    expect(migration).toContain("messaging_enabled boolean NOT NULL DEFAULT false");
  });

  it("requires the granted scope as well as the switch", () => {
    const fn = migration.slice(migration.indexOf("FUNCTION public.meta_messaging_allowed("));
    expect(fn).toContain("messaging_not_enabled");
    expect(fn).toContain("messaging_scope_not_granted");
    // Read from what the platform granted, never from what was requested.
    expect(fn).toContain("_account.capabilities");
    expect(fn).toContain("pages_messaging");
    expect(fn).toContain("instagram_manage_messages");
  });

  it("enables no account and seeds no conversation", () => {
    expect(migration).not.toMatch(/messaging_enabled\s*=\s*true/);
    expect(migration).not.toMatch(/INSERT INTO public\.meta_conversations/);
  });

  it("keeps the gate reachable only by the service role", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.meta_messaging_allowed(text, text)\n  FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.meta_messaging_allowed(text, text) TO service_role;",
    );
  });

  it("keeps customer messages unreadable to anyone but an admin", () => {
    expect(migration).toContain("ALTER TABLE public.meta_conversations ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.meta_messages      ENABLE ROW LEVEL SECURITY");
    // SELECT for admins only, and no write policy at all — the webhook writes
    // with the service role, which bypasses RLS.
    expect(migration).not.toMatch(/FOR (INSERT|UPDATE|DELETE)/);
    expect(migration).toContain("has_role(auth.uid(), 'admin')");
  });

  it("makes a webhook retry a no-op at the database level", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS meta_messages_external_id_uniq");
    expect(migration).toContain("WHERE external_message_id IS NOT NULL");
  });
});

describe("the adapter contacts only Meta", () => {
  it("names no host of its own and reuses the pinned Graph version", () => {
    // The Graph host and its version arrive from the shared module, which is
    // what keeps one pinned version in one place.
    expect(adapter).toContain('from "../meta.ts"');
    expect(adapter).toContain("GRAPH_VERSION");
    // Only Meta's own hosts, and Instagram's is one of them.
    expect(adapter).not.toMatch(/https:\/\/(?!graph\.facebook|graph\.instagram)/);
  });

  it("holds no credential literal", () => {
    expect(adapter).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
    expect(adapter).not.toMatch(/\b[A-Za-z0-9_-]{40,}\b/);
  });
});

describe("Instagram Login is a different product from Messenger", () => {
  function scriptedFetch(step: { ok?: boolean; status?: number; body: unknown }) {
    const calls: Array<{ url: string; body?: string; auth?: string }> = [];
    const impl: MessagingFetch = (url, init) => {
      calls.push({ url, body: init?.body, auth: init?.headers?.Authorization });
      return Promise.resolve({
        ok: step.ok !== false,
        status: step.status ?? 200,
        json: () => Promise.resolve(step.body),
      });
    };
    return { impl, calls };
  }

  it("sends Instagram replies to graph.instagram.com, not the Graph host", async () => {
    // An Instagram Login token is an Instagram User token. graph.facebook.com
    // refuses it, and the refusal reads like a permission problem.
    const net = scriptedFetch({ body: { message_id: "m-1" } });
    await sendMetaMessage({
      channel: "instagram",
      fromAccountId: "ig-999",
      toUserId: "igsid-1",
      text: "Yes, we deliver.",
      token: "ig-user-token",
      fetchImpl: net.impl,
    });

    expect(net.calls[0].url).toContain(INSTAGRAM_GRAPH);
    expect(net.calls[0].url).not.toContain("graph.facebook.com");
    // The account is resolved from the token, not addressed by id in the path.
    expect(net.calls[0].url).toContain("/me/messages");
  });

  it("keeps Messenger on the Graph host addressed by page id", async () => {
    const net = scriptedFetch({ body: { message_id: "m-2" } });
    await sendMetaMessage({
      channel: "messenger",
      fromAccountId: "page-111",
      toUserId: "psid-1",
      text: "Hello",
      token: "page-token",
      fetchImpl: net.impl,
    });

    expect(net.calls[0].url).toContain("graph.facebook.com");
    expect(net.calls[0].url).toContain("/page-111/messages");
    expect(net.calls[0].url).not.toContain(INSTAGRAM_GRAPH);
  });

  it("still declares every send a RESPONSE on both channels", async () => {
    for (const channel of ["instagram", "messenger"] as const) {
      const net = scriptedFetch({ body: { message_id: "m" } });
      await sendMetaMessage({
        channel, fromAccountId: "x", toUserId: "y", text: "z",
        token: "t", fetchImpl: net.impl,
      });
      expect(net.calls[0].body, channel).toContain('"messaging_type":"RESPONSE"');
    }
  });
});

describe("the verification handshake", () => {
  it("reads all three hub parameters", () => {
    for (const param of ["hub.mode", "hub.verify_token", "hub.challenge"]) {
      expect(webhook, param).toContain(param);
    }
  });

  it("echoes the challenge only when the token matches, in constant time", () => {
    expect(webhook).toContain('mode === "subscribe"');
    expect(webhook).toContain("constantTimeEquals(provided, candidate)");
    // Not a plain === against the secret.
    expect(webhook).not.toMatch(/provided\s*===\s*(verifyToken|candidate)/);
    expect(webhook).toContain("new Response(challenge, { status: 200 })");
  });

  it("refuses a wrong token and a malformed subscribe separately", () => {
    // 403 for a bad token; 400 for a subscribe carrying no challenge, which
    // must not answer 200 with an empty body — Meta would record the
    // subscription as verified when nothing was proved.
    expect(webhook).toContain('new Response("Forbidden", { status: 403 })');
    expect(webhook).toContain('new Response("Bad Request", { status: 400 })');
  });

  it("refuses when no verify token is configured", () => {
    expect(webhook).toMatch(/verifyTokens\.length === 0[\s\S]{0,120}status: 503/);
  });
});

describe("two app secrets, because there are two apps", () => {
  it("tries the Instagram secret as well as the Meta one", () => {
    // Instagram API with Instagram Login has its own app and its own secret.
    // Verifying an Instagram delivery against META_APP_SECRET fails as a 403,
    // which looks like an attack rather than a misconfiguration.
    expect(webhook).toContain('env("INSTAGRAM_APP_SECRET")');
    expect(webhook).toContain('env("META_APP_SECRET")');
    expect(webhook).toContain("for (const secret of secrets)");
  });

  it("still fails closed when neither is configured", () => {
    expect(webhook).toMatch(/if \(secrets\.length === 0\)[\s\S]{0,300}status: 503/);
  });

  it("verifies over the raw body with the shared HMAC helper", () => {
    expect(webhook).toContain("verifySignature(rawBody,");
    expect(webhook).toContain("await req.text()");
  });
});

describe("Messenger is its own channel, sharing one endpoint", () => {
  it("accepts either channel's verify token on the shared callback URL", () => {
    // Meta configures the `page` and `instagram` webhooks as separate
    // subscriptions that happen to point at this one URL, and each console
    // screen sends its own token.
    expect(webhook).toContain('env("FACEBOOK_MESSENGER_WEBHOOK_VERIFY_TOKEN")');
    expect(webhook).toContain('env("INSTAGRAM_WEBHOOK_VERIFY_TOKEN")');
    expect(webhook).toContain("verifyTokens");
  });

  it("compares every candidate, so timing does not reveal which channel matched", () => {
    // Scoped to the comparison loop itself: the lines above it legitimately
    // return early when no token is configured at all.
    const loop = webhook.slice(
      webhook.indexOf("for (const candidate of verifyTokens)"),
      webhook.indexOf('if (mode === "subscribe"'),
    );
    expect(loop).toContain("constantTimeEquals(provided, candidate)");
    // No early exit once one matches.
    expect(loop).not.toMatch(/\bbreak\b|\breturn\b/);
  });

  it("keeps the two send credentials strictly per channel", () => {
    // A Page token cannot send as Instagram and an Instagram User token cannot
    // post to a page. Falling back to whichever exists would fail on the wrong
    // channel with a permission-shaped error.
    expect(webhook).toContain('env("FACEBOOK_PAGE_ACCESS_TOKEN")');
    expect(webhook).toContain('env("INSTAGRAM_ACCESS_TOKEN")');
    expect(webhook).toMatch(/incoming\.channel === "instagram"\s*\?\s*env\("INSTAGRAM_ACCESS_TOKEN"\)/);
  });

  it("still reads none of WhatsApp's secrets", () => {
    for (const secret of ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET",
      "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"]) {
      expect(webhook, secret).not.toContain(`env("${secret}")`);
    }
  });

  it("inventories both Messenger secrets so a missing one is visible", () => {
    const health = readFileSync("supabase/functions/health-check/index.ts", "utf8");
    expect(health).toContain('name: "FACEBOOK_MESSENGER_WEBHOOK_VERIFY_TOKEN"');
    expect(health).toContain('name: "FACEBOOK_PAGE_ACCESS_TOKEN"');
  });
});
