import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  asksAboutPlan,
  isUnlimited,
  planLimitNotice,
  planStatusNotice,
  planWarningNotice,
  PLANS_URL,
  readEntitlement,
  shouldWarn,
  UNKNOWN_ENTITLEMENT,
  type Entitlement,
} from "../../supabase/functions/_shared/whatsappEntitlements.ts";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages.ts";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const transport = readFileSync("supabase/functions/_shared/whatsapp.ts", "utf8");
const ownerControl = readFileSync("supabase/functions/owner-control/index.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261004000000_whatsapp_entitlements.sql",
  "utf8",
);

function entitlement(overrides: Partial<Entitlement> = {}): Entitlement {
  return {
    linked: true,
    plan: "basic",
    planName: "Basic",
    dailyLimit: 300,
    usedToday: 10,
    remaining: 290,
    allowed: true,
    ...overrides,
  };
}

describe("reading what the database allowed", () => {
  it("takes only a literal true as permission", () => {
    expect(readEntitlement({ allowed: true }).allowed).toBe(true);
    // Each of these is a shape a broken row or a driver quirk can produce, and
    // every one of them would open the gate under a `Boolean(...)` cast.
    for (const value of ["true", "false", 1, 0, null, undefined, {}]) {
      expect(readEntitlement({ allowed: value }).allowed, String(value)).toBe(false);
    }
  });

  it("survives a malformed answer without inventing an allowance", () => {
    expect(readEntitlement(null)).toEqual(UNKNOWN_ENTITLEMENT);
    expect(readEntitlement("nonsense")).toEqual(UNKNOWN_ENTITLEMENT);
    const partial = readEntitlement({ allowed: true, daily_limit: "not a number" });
    expect(partial.dailyLimit).toBe(0);
    expect(partial.usedToday).toBe(0);
  });

  it("keeps answering when the lookup itself fails", () => {
    // A billing table that is briefly unreachable must not read, to somebody
    // who cannot see a status page, as the assistant having gone away.
    expect(UNKNOWN_ENTITLEMENT.allowed).toBe(true);
    expect(webhook).toContain("UNKNOWN_ENTITLEMENT");
  });

  it("reads a plan, an allowance and what is left", () => {
    const read = readEntitlement({
      linked: true, plan: "pro", plan_name: "Pro",
      daily_limit: 1000, used_today: 4, remaining: 996, allowed: true,
    });
    expect(read).toEqual({
      linked: true, plan: "pro", planName: "Pro",
      dailyLimit: 1000, usedToday: 4, remaining: 996, allowed: true,
    });
  });
});

describe("what a sender is told", () => {
  it("never refuses without saying where to go next", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const notice = planLimitNotice(language, entitlement({ allowed: false, remaining: 0 }));
      expect(notice, language).toContain(PLANS_URL);
      expect(notice, language).not.toMatch(/\{[a-z]+\}/i);
      expect(notice.length, language).toBeGreaterThan(20);
    }
  });

  it("says the plan, the usage and the link, in every language", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const status = planStatusNotice(language, entitlement());
      expect(status, language).toContain("Basic");
      expect(status, language).toContain(PLANS_URL);
      expect(status, language).not.toMatch(/\{[a-z]+\}/i);

      const warning = planWarningNotice(language, entitlement({ remaining: 75 }));
      expect(warning, language).toContain("75");
      expect(warning, language).not.toMatch(/\{[a-z]+\}/i);
    }
  });

  it("does not quote a limit at somebody who has none", () => {
    for (const language of SUPPORTED_LANGUAGES) {
      const status = planStatusNotice(
        language,
        entitlement({ plan: "enterprise", planName: "Enterprise", dailyLimit: 0, remaining: -1 }),
      );
      expect(status, language).toContain("Enterprise");
      expect(status, language).not.toMatch(/\{[a-z]+\}/i);
      // No "0 of 0" and no upgrade link: there is nothing to upgrade to.
      expect(status, language).not.toContain(PLANS_URL);
    }
  });
});

describe("when the warning fires", () => {
  it("once, at a quarter left — not on every message", () => {
    const near = entitlement({ dailyLimit: 300, remaining: 75 });
    expect(shouldWarn(near)).toBe(true);
    expect(shouldWarn({ ...near, remaining: 76 })).toBe(false);
    expect(shouldWarn({ ...near, remaining: 74 })).toBe(false);
  });

  it("never on an unlimited plan, and never after the limit is reached", () => {
    expect(shouldWarn(entitlement({ dailyLimit: 0, remaining: -1 }))).toBe(false);
    expect(shouldWarn(entitlement({ allowed: false, remaining: 0 }))).toBe(false);
    expect(isUnlimited(entitlement({ dailyLimit: 0 }))).toBe(true);
    expect(isUnlimited(entitlement())).toBe(false);
  });
});

describe("asking about the plan costs nothing", () => {
  it("recognises the question in both languages", () => {
    for (const text of ["باقتي", "شو باقتي", "كم باقي لي", "رصيدي", "my plan", "what's my plan", "usage"]) {
      expect(asksAboutPlan(text), text).toBe(true);
    }
  });

  it("does not mistake an ordinary sentence for it", () => {
    for (const text of ["كيف أفتح متجر", "how much is a subscription?", "شكراً", ""]) {
      expect(asksAboutPlan(text), text).toBe(false);
    }
  });

  it("is answered before the model is ever called", () => {
    // The branch has to sit above the assistant call, or asking how much
    // allowance is left would spend some of it.
    expect(webhook).toContain("asksAboutPlan(questionText)");
    expect(webhook.indexOf("asksAboutPlan(questionText)"))
      .toBeLessThan(webhook.indexOf("const asked = await askAssistant("));
  });
});

describe("the gate is where the money is", () => {
  it("guards the model call and the media branch, and nothing cheap", () => {
    expect(webhook).toContain("if (!(await maySpend())) continue;");
    expect(webhook).toContain("if (!humanOwnsThis && !(await maySpend())) continue;");
    // Exactly two call sites: one before the provider call, one before a media
    // download. A third would mean something cheap had started charging.
    expect(webhook.match(/await maySpend\(\)/g)?.length).toBe(2);
  });

  it("charges only for work that succeeded", () => {
    // Metering sits after each answer exists, never before the attempt.
    for (const kind of ['spent("ai")', 'spent("image")', 'spent("document")', 'spent("video")', 'spent("voice_in")']) {
      expect(webhook, kind).toContain(kind);
    }
    expect(webhook.indexOf('await spent("ai")'))
      .toBeGreaterThan(webhook.indexOf("const asked = await askAssistant("));
  });

  it("asks the database for an allowance, never for an identity", () => {
    expect(webhook).toContain('db.rpc("whatsapp_entitlements"');
    expect(migration).toContain("Carries no user id, email or name by design");
    // The function must not select anything that identifies the person.
    expect(migration).not.toMatch(/RETURN jsonb_build_object\([^)]*'user_id'/);
    expect(migration).not.toMatch(/'email'/);
  });

  it("keeps the allowances in the database, so a price change is not a deploy", () => {
    expect(migration).toContain("whatsapp_daily_messages");
    expect(migration).toContain("public.whatsapp_free_daily_allowance()");
    expect(webhook).not.toMatch(/daily_limit\s*[:=]\s*\d+/);
  });

  it("forgets a per-person tally rather than keeping it forever", () => {
    expect(migration).toContain("whatsapp_forget_usage");
    expect(migration).toMatch(/GREATEST\(7,/);
    expect(migration).toContain("cron.schedule");
  });

  it("locks the counter and both functions to the service role", () => {
    for (const line of [
      "REVOKE ALL ON TABLE public.whatsapp_usage FROM anon;",
      "REVOKE ALL ON TABLE public.whatsapp_usage FROM authenticated;",
      "GRANT ALL ON TABLE public.whatsapp_usage TO service_role;",
      "GRANT EXECUTE ON FUNCTION public.whatsapp_entitlements(text) TO service_role;",
      "GRANT EXECUTE ON FUNCTION public.whatsapp_meter(text, text) TO service_role;",
    ]) {
      expect(migration, line).toContain(line);
    }
  });
});

describe("handing a conversation back actually hands it back", () => {
  it("clears the automatic flag, not only the manual one", () => {
    // The webhook silences the assistant on either, so setting control back to
    // 'ai' while `escalated` stayed true left a number permanently ignored.
    expect(ownerControl).toContain('...(control === "ai" ? { escalated: false, escalated_at: null } : {})');
    expect(webhook).toContain('existing?.control === "human" || existing?.escalated === true');
  });

  it("does not clear it when a person is taking over", () => {
    // Only the 'ai' direction resets anything: handing a conversation *to* a
    // human must not quietly un-escalate it.
    expect(ownerControl).not.toMatch(/escalated:\s*false[^}]*}\s*\)\s*;?\s*\/\/\s*always/);
    expect(ownerControl).toContain('control === "ai" ?');
  });
});

describe("messaging somebody outside the 24-hour window", () => {
  it("has a template sender, because nothing else may leave that window", () => {
    expect(transport).toContain("export async function sendWhatsAppTemplate");
    expect(transport).toContain('type: "template"');
    // The template's own language tag, not the sender's preference: Meta
    // matches the approved translation by that code.
    expect(transport).toContain("language: { code: params.language }");
  });

  it("passes body variables in the order the approved template declares them", () => {
    expect(transport).toContain('{ type: "body", parameters: variables }');
    expect(transport).toContain("slice(0, 1024)");
  });
});
