// Linking a WhatsApp number to a Visionex account, and the orders it unlocks.
//
// Phase 14 was blocked for one reason and this suite exists to keep it
// unblocked for the same one: `bazaar_orders.shipping_phone` is free text the
// buyer typed at checkout and is frequently somebody else's number. Every test
// below that looks like a formatting detail is really guarding that: the
// lookup joins on a *verified* link, the sentences never reveal whether an
// address has an account, and nothing about a code or a mailbox reaches a log.
//
// The SQL side is asserted against the migration's own text. That is not a
// substitute for running it — it was run, against PGlite, before this landed —
// but it is what keeps a later edit from quietly dropping a GRANT or a REVOKE.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const identity = await import("../../supabase/functions/_shared/whatsappIdentity.ts");
const catalog = await import("../../supabase/functions/_shared/whatsappCatalog.ts");
const router = await import("../../supabase/functions/_shared/whatsappRouter.ts");
const languages = await import("../../supabase/functions/_shared/whatsappLanguages.ts");
const strings = await import("../../supabase/functions/_shared/whatsappStrings.ts");

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const identityMigration = readFileSync(
  "supabase/migrations/20260928000000_whatsapp_identities.sql",
  "utf8",
);
const retentionMigration = readFileSync(
  "supabase/migrations/20260927000000_whatsapp_retention_schedule.sql",
  "utf8",
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what a message is asking for", () => {
  it("reads unlink before link, because one contains the other", () => {
    // "unlink my account" contains "link my account". A link-first check
    // disconnects nobody and re-links everybody.
    expect(identity.parseAccountIntent("unlink my account")).toBe("unlink");
    expect(identity.parseAccountIntent("link my account")).toBe("link");
    expect(identity.parseAccountIntent("الغاء الربط")).toBe("unlink");
    expect(identity.parseAccountIntent("اربط حسابي")).toBe("link");
  });

  it("hears the possessive, in both languages", () => {
    for (const asked of ["where is my order", "my orders", "order status", "track my order"]) {
      expect(identity.parseAccountIntent(asked), asked).toBe("orders");
    }
    for (const asked of ["وين طلبي", "طلباتي", "حالة الطلب", "تتبع طلبي", "وين شحنتي"]) {
      expect(identity.parseAccountIntent(asked), asked).toBe("orders");
    }
  });

  it("leaves shopping to the bazaar parser", () => {
    // The difference between "where is my order" and "I want to order olive
    // oil" is the possessive, and that is exactly what the words match on. If
    // this ever regresses, somebody trying to buy something is shown their
    // order history instead.
    for (const asked of [
      "أبي أطلب زيت زيتون",
      "بدي اطلب موبايل",
      "I want to order olive oil",
      "can I order a phone",
      "do you have olive oil",
    ]) {
      expect(identity.parseAccountIntent(asked), asked).toBeNull();
    }
  });

  it("ignores a complaint that merely mentions an order", () => {
    const rant = "my order never arrived and I have been waiting for three weeks now, "
      + "which is not what I was told when I paid for it";
    expect(rant.length).toBeGreaterThan(60);
    expect(identity.parseAccountIntent(rant)).toBeNull();
  });

  it("treats nothing as nothing", () => {
    for (const asked of ["", "   ", "hello", "شكرا", null, undefined]) {
      expect(identity.parseAccountIntent(asked)).toBeNull();
    }
  });
});

describe("the code itself", () => {
  it("reads six digits however they were typed", () => {
    expect(identity.readLinkCode("123456")).toBe("123456");
    expect(identity.readLinkCode(" 123 456 ")).toBe("123456");
    expect(identity.readLinkCode("123-456")).toBe("123456");
    // Arabic-Indic and Persian digits are the same key to the person pressing
    // them. A code that only works on a Latin keypad works for half this
    // audience.
    expect(identity.readLinkCode("١٢٣٤٥٦")).toBe("123456");
    expect(identity.readLinkCode("۱۲۳۴۵۶")).toBe("123456");
  });

  it("refuses anything that is not exactly six digits", () => {
    for (const typed of ["12345", "1234567", "12345a", "hello", "", null]) {
      expect(identity.readLinkCode(typed), String(typed)).toBeNull();
    }
  });

  it("generates six digits, zero-padded, without modulo bias", () => {
    for (let i = 0; i < 200; i++) {
      expect(identity.generateLinkCode()).toMatch(/^\d{6}$/);
    }
    // A draw at or above the largest multiple of 1e6 under 2^32 is discarded
    // rather than folded, which is the whole point of rejection sampling.
    const draws = [4_294_000_001, 42];
    let next = 0;
    expect(identity.generateLinkCode(() => draws[next++])).toBe("000042");
    expect(next).toBe(2);
  });

  it("stores a keyed hash, never the code", async () => {
    const hash = await identity.hashLinkCode("123456", "app-secret");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("123456");
    // Same code, same secret, same hash — the confirm step compares hashes.
    expect(await identity.hashLinkCode("123456", "app-secret")).toBe(hash);
    // A different secret is a different hash, which is what makes a stolen
    // table useless: a six-digit space is a million-row rainbow table to
    // anybody who knows the digest is a bare SHA-256.
    expect(await identity.hashLinkCode("123456", "other-secret")).not.toBe(hash);
    expect(await identity.hashLinkCode("654321", "app-secret")).not.toBe(hash);
  });

  it("refuses to hash without a secret rather than hashing with an empty one", async () => {
    await expect(identity.hashLinkCode("123456", "")).rejects.toThrow(/secret/i);
  });
});

describe("the email that carries the code", () => {
  it("presents the code and warns the mailbox owner", () => {
    const { subject, html, text } = identity.linkCodeEmail({ code: "424242", language: "en" });
    expect(subject).toBe(strings.say("linkEmailSubject", "en"));
    expect(html).toContain("424242");
    expect(text).toContain("424242");
    // The only notice the *owner* of the mailbox gets if somebody else typed
    // their address into WhatsApp.
    expect(html).toContain(strings.say("linkEmailWarning", "en"));
  });

  it("writes right-to-left languages right to left", () => {
    expect(identity.linkCodeEmail({ code: "424242", language: "ar" }).html).toContain('dir="rtl"');
    expect(identity.linkCodeEmail({ code: "424242", language: "fa" }).html).toContain('dir="rtl"');
    expect(identity.linkCodeEmail({ code: "424242", language: "tr" }).html).toContain('dir="ltr"');
  });

  it("escapes what it interpolates", () => {
    const html = identity.linkCodeEmail({ code: "<script>", language: "en" }).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sends through the provider already configured, and says so honestly when there is none", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sent = await identity.sendLinkCodeEmail({
      to: "someone@example.com",
      code: "424242",
      language: "en",
      read: () => undefined,
      fetcher: () => {
        throw new Error("must not be called without a provider");
      },
    });
    expect(sent).toBe(false);
    // Not even in the line that says it could not send.
    for (const call of warn.mock.calls.flat()) {
      expect(String(call)).not.toContain("424242");
      expect(String(call)).not.toContain("someone@example.com");
    }
  });

  it("posts the code to the provider and nowhere else", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const sent = await identity.sendLinkCodeEmail({
      to: "someone@example.com",
      code: "424242",
      language: "tr",
      read: (name) => (name === "RESEND_API_KEY" ? "key" : undefined),
      fetcher: ((url: string, init: { body: string }) => {
        calls.push({ url: String(url), body: JSON.parse(init.body) });
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }) as unknown as typeof fetch,
    });
    expect(sent).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].body.to).toEqual(["someone@example.com"]);
    expect(String(calls[0].body.subject)).toBe(strings.say("linkEmailSubject", "tr"));
    expect(String(calls[0].body.html)).toContain("424242");
  });

  it("reports a rejection instead of pretending the code was sent", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const sent = await identity.sendLinkCodeEmail({
      to: "someone@example.com",
      code: "424242",
      language: "en",
      read: (name) => (name === "RESEND_API_KEY" ? "key" : undefined),
      fetcher: (() => Promise.resolve({ ok: false, status: 422 } as Response)) as unknown as typeof fetch,
    });
    expect(sent).toBe(false);
    for (const call of error.mock.calls.flat()) {
      expect(String(call)).not.toContain("424242");
      expect(String(call)).not.toContain("someone@example.com");
    }
  });
});

describe("the answer a sender reads", () => {
  const order = {
    reference: "44444444",
    status: "shipped",
    createdAt: "2026-08-20T09:00:00Z",
    itemCount: 2,
    firstItem: "Olive oil 1L",
    totalVx: 250,
    totalUsd: null,
    shopName: "Olive Press",
  };

  it("says there are none rather than sending an empty heading", () => {
    expect(identity.formatOrders({ language: "en", orders: [] }))
      .toBe(strings.say("ordersNone", "en"));
  });

  it("puts the status on its own line, which is the line they are listening for", () => {
    const reply = identity.formatOrders({ language: "en", orders: [order] });
    const lines = reply.split("\n").map((line) => line.trim());
    expect(lines).toContain(strings.say("orderShipped", "en"));
    expect(reply).toContain("Olive oil 1L (+1)");
    expect(reply).toContain("250 VX");
    expect(reply).toContain("44444444");
  });

  it("answers in the sender's own language, all twenty of them", () => {
    for (const language of languages.SUPPORTED_LANGUAGES) {
      const reply = identity.formatOrders({ language, orders: [order] });
      expect(reply, language).toContain(strings.say("orderShipped", language));
      expect(reply, language).toContain(strings.say("ordersHeading", language));
      // A month name from the runtime rather than a table somebody has to
      // maintain in twenty languages.
      expect(reply, language).toContain(identity.formatOrderDate(order.createdAt, language));
    }
  });

  it("names one currency, never a converted figure", () => {
    expect(identity.formatOrderTotal({ ...order, totalVx: 250, totalUsd: null })).toBe("250 VX");
    expect(identity.formatOrderTotal({ ...order, totalVx: null, totalUsd: 12.5 })).toBe("$12.50");
    expect(identity.formatOrderTotal({ ...order, totalVx: null, totalUsd: null })).toBeNull();
  });

  it("reads a status it has never seen rather than going silent", () => {
    expect(identity.orderStatusLabel("some_new_state", "en")).toBe("some_new_state");
    expect(identity.orderStatusLabel("payment_failed", "en"))
      .toBe(strings.say("orderPaymentFailed", "en"));
  });

  it("survives a row that is not the shape it expected", () => {
    expect(identity.readOrders(null)).toEqual([]);
    expect(identity.readOrders("nonsense")).toEqual([]);
    expect(identity.readOrders([null, 7, {}, { reference: "AB" }])).toEqual([]);
    const [parsed] = identity.readOrders([{
      reference: "AB123456", status: "paid", created_at: "2026-08-20T09:00:00Z",
      item_count: "3", first_item: null, total_vx: null, total_usd: "9.90", shop_name: null,
    }]);
    expect(parsed.itemCount).toBe(3);
    expect(parsed.totalUsd).toBe(9.9);
    expect(parsed.firstItem).toBeNull();
  });
});

describe("the menu row", () => {
  it("exists, needs the bazaar, and stands in for words a parser understands", () => {
    const node = catalog.nodeById("services.orders");
    expect(node).not.toBeNull();
    expect(node?.parent).toBe("bazaar");
    expect(node?.requires).toContain("bazaar");
    for (const language of ["ar", "en"] as const) {
      const phrase = catalog.localized(node!.phrase!, language);
      expect(identity.parseAccountIntent(phrase), `${language}: ${phrase}`).toBe("orders");
    }
  });

  it("is named in all twenty languages", () => {
    const node = catalog.nodeById("services.orders")!;
    for (const language of languages.SUPPORTED_LANGUAGES) {
      expect(node.title[language], `title.${language}`).toBeTruthy();
      expect(node.description[language], `description.${language}`).toBeTruthy();
    }
  });
});

// ── The crash this work found on the way past ───────────────────────────────

describe("aliases in a language that is not Arabic or English", () => {
  it("resolves instead of throwing", () => {
    // `aliasesOf` used to spread `node.aliases[language]`, and the table has
    // only `ar` and `en` in it. For the other eighteen that spread `undefined`
    // and threw `TypeError: node.aliases[language] is not iterable` — on every
    // typed message, because every typed message reaches the router. This is
    // the guard, and it fails against the code as it was.
    for (const language of languages.SUPPORTED_LANGUAGES) {
      for (const node of catalog.CATALOG) {
        expect(() => catalog.aliasesOf(node, language), `${node.id}/${language}`).not.toThrow();
      }
    }
  });

  it("still routes a typed word for a sender in any of the twenty", () => {
    for (const language of languages.SUPPORTED_LANGUAGES) {
      const routed = router.resolveSelection({
        menuId: "services",
        text: "weather",
        language,
        disabled: [],
        available: ["location", "bazaar", "ai"],
        configVerified: true,
      });
      expect(routed.kind, language).not.toBe("invalid");
    }
  });
});

// ── What the webhook does with all of it ────────────────────────────────────

describe("the webhook's part", () => {
  it("runs the account block after the engine, so # and the timeout still cancel", () => {
    const engineAt = webhook.indexOf("const outcome = runEngine(");
    const accountAt = webhook.indexOf("const accountIntent = aiFocused ? null : parseAccountIntent(");
    const locationAt = webhook.indexOf("Where am I, what's around me");
    expect(engineAt).toBeGreaterThan(0);
    expect(accountAt).toBeGreaterThan(engineAt);
    // And before the location and weather parsers, so a six-digit code is a
    // code rather than something else's input.
    expect(accountAt).toBeLessThan(locationAt);
  });

  it("hashes the code with the secret the function already refuses to start without", () => {
    expect(webhook).toContain("hashLinkCode(typed, appSecret ?? \"\")");
    expect(webhook).toContain("hashLinkCode(code, appSecret ?? \"\")");
  });

  it("never lets a failed lookup read as an empty order history", () => {
    // No rows formats as "there are no orders on your account yet", which is a
    // confident wrong answer to somebody who has just proved the account is
    // theirs. Both lookups check their error.
    const block = webhook.slice(
      webhook.indexOf("const accountIntent = aiFocused"),
      webhook.indexOf("Where am I, what's around me"),
    );
    const lookups = block.split('db.rpc("whatsapp_recent_orders"').length - 1;
    expect(lookups).toBe(2);
    expect(block.split("if (lookupError) throw lookupError;").length - 1).toBe(2);
  });

  it("replies before sending the email, so the timing tells nobody anything", () => {
    const block = webhook.slice(webhook.indexOf("const status = String("));
    const replyAt = block.indexOf("await reply(");
    const sendAt = block.indexOf("await sendLinkCodeEmail(");
    expect(replyAt).toBeGreaterThan(0);
    expect(sendAt).toBeGreaterThan(replyAt);
  });

  it("refuses to speak an address or a code out of a voice note", () => {
    const block = webhook.slice(
      webhook.indexOf("const accountIntent = aiFocused"),
      webhook.indexOf("Where am I, what's around me"),
    );
    expect(block).toContain("spokenInput && accountStep");
    expect(block).toContain('say("onboardingNeedsText"');
  });

  it("logs an outcome and never an address, a code or an order", () => {
    const block = webhook.slice(
      webhook.indexOf("const accountIntent = aiFocused"),
      webhook.indexOf("Where am I, what's around me"),
    );
    expect(block).toContain('log("account_link"');
    for (const line of block.split("\n")) {
      if (!/console\.(log|error|warn)|^\s*log\(/.test(line)) continue;
      // The fixed words of a log line are fine — "no email provider is
      // configured" names no mailbox. What must never appear is a *variable*
      // holding one, so the string literals come out before looking.
      const withoutText = line.replace(/"[^"]*"/g, '""').replace(/'[^']*'/g, "''");
      expect(withoutText, line.trim()).not.toMatch(/\b(address|code|typed|questionText|orders)\b/);
    }
  });
});

// ── The database's half of the contract ────────────────────────────────────

describe("the identity migration", () => {
  it("joins on the verified link and never on a phone number found on an order", () => {
    expect(identityMigration).toContain("JOIN public.whatsapp_identities w");
    expect(identityMigration).toContain("w.user_id = o.buyer_id");
    expect(identityMigration).toContain("w.verified_at IS NOT NULL");
    // The column that made this phase unsafe to build for months. Measured
    // from the function body, not from the comment above it — the comment says
    // the word on purpose, because the reason is the point.
    const body = identityMigration.slice(
      identityMigration.indexOf("CREATE OR REPLACE FUNCTION public.whatsapp_recent_orders"),
      identityMigration.indexOf("COMMENT ON FUNCTION public.whatsapp_recent_orders"),
    );
    expect(body).not.toContain("shipping_phone");
    expect(body).not.toContain("shipping_address");
    expect(body).not.toContain("shipping_email");
  });

  it("revokes from everybody and grants back to exactly one role", () => {
    for (const signature of [
      "public.whatsapp_link_request(text, text, text, integer)",
      "public.whatsapp_link_confirm(text, text)",
      "public.whatsapp_identity_state(text)",
      "public.whatsapp_unlink_identity(text)",
      "public.whatsapp_recent_orders(text, integer)",
    ]) {
      expect(identityMigration, signature)
        .toContain(`REVOKE ALL ON FUNCTION ${signature} FROM PUBLIC, anon, authenticated;`);
      // Without this the webhook's every call fails with "permission denied for
      // function": REVOKE FROM PUBLIC takes the default away from service role
      // too.
      expect(identityMigration, signature)
        .toContain(`GRANT EXECUTE ON FUNCTION ${signature} TO service_role;`);
    }
  });

  it("locks the table itself the way every other whatsapp table is locked", () => {
    expect(identityMigration).toContain("ALTER TABLE public.whatsapp_identities ENABLE ROW LEVEL SECURITY;");
    expect(identityMigration).not.toMatch(/CREATE POLICY[\s\S]*whatsapp_identities/);
  });

  it("keeps the attempt counter and the throttles in the database", () => {
    expect(identityMigration).toContain("IF _row.attempts >= 5 THEN");
    expect(identityMigration).toContain("interval '60 seconds'");
    expect(identityMigration).toContain("FOR UPDATE");
    // Confirmed addresses only: an address nobody proved they own is not an
    // account to link a real mailbox to.
    expect(identityMigration).toContain("email_confirmed_at IS NOT NULL");
  });

  it("answers the same way whether or not an account exists", () => {
    // The status the sender's sentence is chosen from is 'sent' in both cases;
    // only the internal `deliver` flag differs.
    expect(identityMigration).toContain("jsonb_build_object('status', 'sent', 'deliver', _target IS NOT NULL)");
    expect(identityMigration).toContain("RETURN 'invalid';");
  });
});

describe("the retention schedule", () => {
  it("registers all four jobs that had only ever been written down", () => {
    for (const job of [
      "whatsapp-prune-transcripts",
      "whatsapp-forget-locations",
      "whatsapp-sweep-geo-cache",
      "whatsapp-sweep-speech-cache",
    ]) {
      expect(retentionMigration, job).toContain(`'${job}'`);
    }
  });

  it("erases a location on the clock the read path already enforces", async () => {
    const { LOCATION_TTL_MS } = await import("../../supabase/functions/_shared/whatsappLocation.ts");
    const hours = LOCATION_TTL_MS / 3_600_000;
    expect(retentionMigration).toContain(`whatsapp_forget_locations(${hours})`);
  });

  it("says so in the deploy log rather than failing silently", () => {
    // The Library migration's own header records what the alternative cost:
    // three jobs wrapped in `EXCEPTION WHEN OTHERS THEN NULL` silently no-op'd
    // for months and nobody found out.
    expect(retentionMigration).toContain("RAISE WARNING");
    expect(retentionMigration).not.toMatch(/EXCEPTION WHEN OTHERS THEN\s*\n\s*NULL;/);
  });
});
