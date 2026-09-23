// Social media content, proposed to the owner on WhatsApp and decided there.

import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  beirutWallClockToIso,
  CONTENT_HELP_LINES,
  dailyBriefs,
  formatContentList,
  formatProposalMessage,
  formatPublishReport,
  formatWhichProposal,
  isBareContentReply,
  NEEDS_MEDIA_TO_PUBLISH,
  OWNER_CONTENT_TEMPLATE,
  ownerWindowOpen,
  parseBareDecision,
  parseBeirutTime,
  parseContentCommand,
} from "../../supabase/functions/_shared/ownerContent.ts";
import { formatOwnerHelp } from "../../supabase/functions/_shared/ownerControl.ts";
import { PLAN_REMINDER_TEMPLATE } from "../../supabase/functions/_shared/whatsappPlanReminder.ts";

const webhook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
const publisher = readFileSync("supabase/functions/social-publish/index.ts", "utf8");

describe("reading the owner's content commands", () => {
  it("reads every verb, in Arabic and English", () => {
    expect(parseContentCommand("content")).toEqual({ kind: "list" });
    expect(parseContentCommand("المحتوى")).toEqual({ kind: "list" });
    expect(parseContentCommand("show ab2cd")).toEqual({ kind: "show", ref: "AB2CD" });
    expect(parseContentCommand("عرض AB2CD")).toEqual({ kind: "show", ref: "AB2CD" });
    expect(parseContentCommand("again AB2CD")).toEqual({ kind: "again", ref: "AB2CD" });
    expect(parseContentCommand("غيره AB2CD")).toEqual({ kind: "again", ref: "AB2CD" });
    expect(parseContentCommand("propose instagram academy")).toEqual({ kind: "propose", section: "academy_courses", platform: "instagram" });
    expect(parseContentCommand("اقترح فيسبوك منتجات")).toEqual({ kind: "propose", section: "products", platform: "facebook" });
    expect(parseContentCommand("propose")).toEqual({ kind: "propose", section: null, platform: null });
  });

  it("reads an edit, with an optional hook line", () => {
    expect(parseContentCommand("edit AB2CD نص جديد للمنشور")).toEqual({ kind: "edit", ref: "AB2CD", hook: null, body: "نص جديد للمنشور" });
    expect(parseContentCommand("عدل AB2CD عنوان: تعلم بلا حدود\nالنص الجديد\nسطر ثانٍ")).toEqual({
      kind: "edit", ref: "AB2CD", hook: "تعلم بلا حدود", body: "النص الجديد\nسطر ثانٍ",
    });
  });

  it("asks for a reference rather than guessing one", () => {
    expect(parseContentCommand("show")).toEqual({ kind: "needs_reference", verb: "show" });
    expect(parseContentCommand("edit")).toEqual({ kind: "needs_reference", verb: "edit" });
    expect(parseContentCommand("edit AB2CD")).toEqual({ kind: "needs_reference", verb: "edit" });
    expect(parseContentCommand("schedule tomorrow")).toEqual({ kind: "needs_reference", verb: "schedule" });
  });

  it("leaves the other owner commands alone", () => {
    for (const body of ["approve AB2CD", "reject AB2CD no", "pending", "help", "1", "takeover", ""]) {
      expect(parseContentCommand(body), body).toBeNull();
    }
  });

  it("treats the word the template asks for as the list", () => {
    expect(isBareContentReply("محتوى")).toBe(true);
    expect(isBareContentReply("Content!")).toBe(true);
    expect(isBareContentReply("محتوى الموقع حلو")).toBe(false);
  });
});

describe("reading a publishing time, in Beirut", () => {
  const now = new Date("2026-09-17T09:00:00Z");

  it("reads dates, times and tomorrow", () => {
    // Beirut is UTC+3 in September.
    expect(parseBeirutTime("20/9 18:00", now)).toBe("2026-09-20T15:00:00.000Z");
    expect(parseBeirutTime("2026-09-21 09:30", now)).toBe("2026-09-21T06:30:00.000Z");
    expect(parseBeirutTime("بكرا 20:00", now)).toBe("2026-09-18T17:00:00.000Z");
    expect(parseBeirutTime("tomorrow 6:15 pm", now)).toBe("2026-09-18T15:15:00.000Z");
    expect(parseBeirutTime("٢٠/٩ ١٨:٠٠", now)).toBe("2026-09-20T15:00:00.000Z");
  });

  it("follows daylight saving", () => {
    // UTC+2 in January.
    expect(beirutWallClockToIso(2027, 1, 10, 18, 0)).toBe("2027-01-10T16:00:00.000Z");
  });

  it("refuses the past and nonsense", () => {
    expect(parseBeirutTime("1/9 10:00", now)).toBeNull();
    expect(parseBeirutTime("soon", now)).toBeNull();
    expect(parseBeirutTime("20/9 25:00", now)).toBeNull();
    expect(parseBeirutTime("40/9 10:00", now)).toBeNull();
  });

  it("parses the schedule command with its time", () => {
    const parsed = parseContentCommand("schedule AB2CD 20/9 18:00");
    expect(parsed).toMatchObject({ kind: "schedule", ref: "AB2CD" });
  });
});

describe("what the owner reads", () => {
  const proposal = {
    proposal_ref: "AB2CD", platform: "instagram", section: "academy_courses", content_type: "reel",
    topic: "Learning", hook: "تعلّم بلا حدود", body: "نص المنشور", hashtags: ["Visionex", "#تعلم"],
    rationale: "دورات جديدة", state: "PROPOSED", proposed_publish_at: null,
  };

  it("shows the whole proposal with the commands that act on it", () => {
    const text = formatProposalMessage(proposal);
    for (const part of ["[AB2CD]", "إنستغرام", "ريل", "الأكاديمية", "تعلّم بلا حدود", "نص المنشور", "#Visionex #تعلم",
      "/approve AB2CD", "/edit AB2CD", "/again AB2CD", "/reject AB2CD"]) {
      expect(text, part).toContain(part);
    }
  });

  it("offers scheduling once approved, and nothing once published", () => {
    expect(formatProposalMessage({ ...proposal, state: "APPROVED" })).toContain("/schedule AB2CD");
    const published = formatProposalMessage({ ...proposal, state: "PUBLISHED" });
    expect(published).not.toContain("/approve");
    expect(published).not.toContain("/schedule");
  });

  it("lists what is waiting, and says how to start when nothing is", () => {
    expect(formatContentList([])).toContain("/propose");
    expect(formatContentList([proposal])).toContain("[AB2CD]");
  });

  it("adds the content commands to /help", () => {
    const help = formatOwnerHelp();
    for (const command of ["/content", "/show", "/edit", "/again", "/schedule", "/propose"]) expect(help).toContain(command);
  });
});

describe("the daily plan", () => {
  it("rotates sections and platforms, never repeating a section in one day", () => {
    const seen = new Set<string>();
    for (let day = 0; day < 14; day++) {
      const briefs = dailyBriefs(new Date(Date.UTC(2026, 8, 1 + day)), 2);
      expect(briefs).toHaveLength(2);
      expect(briefs[0].section).not.toBe(briefs[1].section);
      for (const brief of briefs) {
        expect(["facebook", "instagram"]).toContain(brief.platform);
        seen.add(brief.section);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it("drafts only from sections that have indexed material", () => {
    const day = new Date(Date.UTC(2026, 8, 17));
    const briefs = dailyBriefs(day, 2, ["tv_channels", "services"]);
    expect(briefs.map((b) => b.section).sort()).toEqual(["services", "tv_channels"]);
    expect(dailyBriefs(day, 3, ["services"])).toHaveLength(1);
    // Nothing known is the same as no filter, never an empty plan.
    expect(dailyBriefs(day, 2, [])).toHaveLength(2);
  });

  it("knows when free text may reach the owner", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    expect(ownerWindowOpen("2026-09-17T08:00:00Z", now)).toBe(true);
    expect(ownerWindowOpen("2026-09-16T11:00:00Z", now)).toBe(false);
    expect(ownerWindowOpen(null, now)).toBe(false);
  });

  it("has a template shaped like the one Meta already approved", () => {
    expect(OWNER_CONTENT_TEMPLATE.name).toMatch(/^[a-z0-9_]{1,512}$/);
    expect(OWNER_CONTENT_TEMPLATE.category).toBe(PLAN_REMINDER_TEMPLATE.category);
    for (const language of ["ar", "en"] as const) {
      const { body, example } = OWNER_CONTENT_TEMPLATE.translations[language];
      expect(body).toContain("{{1}}");
      expect(body).not.toContain("{{2}}");
      expect(example).toHaveLength(1);
      expect(body.length).toBeLessThan(1024);
    }
    expect(readFileSync("scripts/whatsapp-templates.mjs", "utf8")).toContain("[PLAN_REMINDER_TEMPLATE, OWNER_CONTENT_TEMPLATE]");
  });
});

describe("wiring", () => {
  it("reads content commands before the help fallback, and decides through the content engine", () => {
    const handler = webhook.slice(webhook.indexOf("async function handleOwnerCommand("));
    const content = handler.indexOf("parseContentCommand(ownerCommandBody(text)");
    const help = handler.indexOf("return formatOwnerHelp();");
    expect(content).toBeGreaterThan(0);
    expect(content).toBeLessThan(help);
    expect(handler).toContain("isBareContentReply(rawText)");
    expect(handler).toContain("decideProposal(db, contentProposal.proposal_ref");
    // The generic approval list still leaves content approvals out.
    expect(handler).toContain('.neq("action_type", "content_publish")');
    // Rate limit and audit apply to content commands too.
    expect(handler.indexOf("OWNER_COMMAND_LIMIT_PER_HOUR")).toBeLessThan(handler.indexOf("runContentCommand(db, contentCommand,"));
  });

  it("only runs the daily job behind the cron secret", () => {
    const secret = publisher.indexOf("req.headers.get(\"Authorization\") !== `Bearer ${cronSecret}`");
    const daily = publisher.indexOf('body.action === "propose_daily"');
    expect(secret).toBeGreaterThan(0);
    expect(daily).toBeGreaterThan(secret);
    const workflow = readFileSync(".github/workflows/content-proposals-cron.yml", "utf8");
    expect(workflow).toMatch(/cron: "0 6 \* \* \*"/);
    expect(workflow).toContain("jq '{ok, proposed, failed, indexed, media, notified, reason}'");
  });
});

describe("the daily run against a fake database", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("refuses to notify when no owner number is set, and says why", async () => {
    vi.doMock("../../supabase/functions/_shared/contentIndex.ts", () => ({ indexSources: vi.fn(async () => ({})) }));
    vi.doMock("../../supabase/functions/_shared/contentEngine.ts", () => ({
      proposeContent: vi.fn(async () => ({ ok: true, proposal_ref: "AB2CD" })),
    }));
    // Loaded by a variable path so the app's type check does not follow it into
    // the content engine, whose provider modules use Deno globals.
    const actionsPath = "../../supabase/functions/_shared/ownerContentActions.ts";
    const { runDailyProposals } = await import(/* @vite-ignore */ actionsPath) as {
      runDailyProposals: (db: unknown, wa: unknown, now: Date, count: number) => Promise<unknown>;
    };
    const chain = (data: unknown) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit", "like"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: [], count: 5 });
      return q;
    };
    const db = {
      from: (table: string) => chain(
        table === "user_roles" ? { user_id: "u-1" } : table === "site_settings" ? { value: { whatsapp_number: null } } : null,
      ),
    };
    const report = await runDailyProposals(db, { token: "t", phoneNumberId: "p" }, new Date("2026-09-17T06:00:00Z"), 2);
    expect(report).toEqual({
      proposed: ["AB2CD", "AB2CD"], failed: [], indexed: {},
      // No proposal row in this fake, so artwork is reported per reference
      // rather than silently skipped — and the run still reaches the owner check.
      media: { AB2CD: "not_found" },
      notified: "none", reason: "no_owner_number",
    });
  });
});

// ── Answering a proposal the way anybody answers a message ──────────────────
//
// The proposal message ends with `/approve AB2CD`, and the owner replied
// «وافقت عليه». Without the slash that was not a command at all, so it reached
// the customer assistant, which discussed the idea and moved nothing. These
// pin the two halves of the fix: what counts as a decision, and that one
// decision is never guessed from two candidates.

describe("a decision with no slash", () => {
  it("reads a whole message that says only yes or no, in both languages", () => {
    for (const yes of ["موافق", "وافقت عليه", "أوافق", "انشره", "نفذ", "تمام", "نعم",
                       "ok", "yes", "approve", "publish it", "go ahead"]) {
      expect(parseBareDecision(yes), yes).toEqual({ approve: true, note: null });
    }
    for (const no of ["لا", "ارفض", "مرفوض", "احذفه", "no", "reject", "cancel"]) {
      expect(parseBareDecision(no), no).toEqual({ approve: false, note: null });
    }
  });

  it("is not a sentence that merely contains one of those words", () => {
    // Known-bad input for the guard itself: each of these would decide a post
    // if the patterns were matched anywhere in the message rather than whole.
    for (const sentence of [
      "نعم بس غيّر الصورة", "موافق على الفكرة بس مش هلق", "لا تنسى تبعتلي التقرير",
      "yes but change the hook", "ok what is the weather today", "no news today?",
      "وافقت على طلب العميل امبارح",
    ]) {
      expect(parseBareDecision(sentence), sentence).toBeNull();
    }
    expect(parseBareDecision("")).toBeNull();
    // A slash is still a command, read by the command parser, not by this.
    expect(parseBareDecision("/approve")).toBeNull();
  });

  it("asks which one rather than deciding the newer of two", () => {
    const asked = formatWhichProposal([
      { proposal_ref: "AB2CD", platform: "instagram", hook: "درس جديد" },
      { proposal_ref: "XY9MN", platform: "facebook", hook: "لعبة جديدة" },
    ], true);
    expect(asked).toContain("AB2CD");
    expect(asked).toContain("XY9MN");
    expect(asked).toContain("/approve AB2CD");
  });

  it("the webhook resolves it before deciding the message is not a command", () => {
    const handler = webhook.slice(webhook.indexOf("async function handleOwnerCommand("));
    const bare = handler.indexOf("parseBareDecision(rawText)");
    const fallThrough = handler.indexOf("if (ownerCommandBody(text) === null) return null;");
    expect(bare).toBeGreaterThan(0);
    expect(bare).toBeLessThan(fallThrough);
    // Only content proposals: a customer escalation still needs its reference,
    // because there the wrong guess reaches a stranger.
    const resolver = webhook.slice(webhook.indexOf("async function decideWaitingProposal("));
    expect(resolver).toContain("decidableProposals(db)");
    expect(resolver).toContain("if (waiting.length === 0) return null;");
    expect(resolver).toContain("if (waiting.length > 1) return formatWhichProposal");
    // And `/approve` with no reference resolves the same way.
    expect(handler).toContain("decideWaitingProposal(db, from, command.kind === \"approve\", command.note)");
  });

  it("the proposal and the help both say the short answer works", () => {
    expect(formatProposalMessage({
      proposal_ref: "AB2CD", platform: "instagram", section: "academy_courses", content_type: "reel",
      topic: "t", hook: "h", body: "b", hashtags: [], rationale: "", state: "PROPOSED", proposed_publish_at: null,
    })).toContain("«موافق»");
    expect(CONTENT_HELP_LINES.join("\n")).toContain("«موافق»");
  });
});

describe("what an approval actually does", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const loadActions = async () => {
    vi.doMock("../../supabase/functions/_shared/contentIndex.ts", () => ({ indexSources: vi.fn(async () => ({})) }));
    vi.doMock("../../supabase/functions/_shared/contentEngine.ts", () => ({ proposeContent: vi.fn(async () => ({ ok: false })) }));
    const actionsPath = "../../supabase/functions/_shared/ownerContentActions.ts";
    return await import(/* @vite-ignore */ actionsPath) as {
      decideProposal: (db: unknown, ref: string, approve: boolean, note: string | null) => Promise<string>;
    };
  };

  /** A database that answers the four reads an approval makes. */
  const fakeDb = (opts: { publishAt: string | null; connected: boolean; calls: string[] }) => {
    const proposal = {
      proposal_ref: "AB2CD", platform: "instagram", section: "academy_courses", content_type: "reel",
      topic: "t", hook: "h", body: "b", hashtags: [], rationale: "", state: "PROPOSED",
      proposed_publish_at: opts.publishAt,
    };
    const chain = (single: unknown, rows: unknown[]) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = () => q;
      q.maybeSingle = async () => ({ data: single });
      q.then = (resolve: (v: unknown) => void) => resolve({ data: rows });
      return q;
    };
    return {
      from: (table: string) =>
        table === "user_roles"
          ? chain({ user_id: "admin-1" }, [])
          : table === "content_proposals"
            ? chain(proposal, [proposal])
            : chain(null, opts.connected ? [{ status: "active" }] : []),
      rpc: async (name: string) => {
        opts.calls.push(name);
        return { data: { ok: true }, error: null };
      },
    };
  };

  it("schedules the proposal's own time instead of asking for one command more", async () => {
    const calls: string[] = [];
    const { decideProposal } = await loadActions();
    const reply = await decideProposal(
      fakeDb({ publishAt: "2099-01-01T15:00:00Z", connected: true, calls }), "AB2CD", true, null,
    );
    expect(calls).toEqual(["decide_content_proposal", "schedule_content_proposal"]);
    expect(reply).toContain("تمت الموافقة");
    expect(reply).toContain("جُدول للنشر");
    expect(reply).not.toContain("غير مربوط");
  });

  it("names the disconnected account as the reason nothing will go out", async () => {
    const calls: string[] = [];
    const { decideProposal } = await loadActions();
    const reply = await decideProposal(
      fakeDb({ publishAt: null, connected: false, calls }), "AB2CD", true, null,
    );
    expect(calls).toEqual(["decide_content_proposal"]);
    expect(reply).toContain("/schedule AB2CD");
    expect(reply).toContain("إنستغرام");
    expect(reply).toContain("/admin/social-connections");
  });

  it("says nothing about scheduling when the answer was no", async () => {
    const calls: string[] = [];
    const { decideProposal } = await loadActions();
    const reply = await decideProposal(
      fakeDb({ publishAt: "2099-01-01T15:00:00Z", connected: true, calls }), "AB2CD", false, null,
    );
    expect(calls).toEqual(["decide_content_proposal"]);
    expect(reply).toContain("رُفض AB2CD");
  });
});

// ── After the publisher has run ─────────────────────────────────────────────
//
// Approving a post and then hearing nothing is, from a phone, the same event
// as approving one and having nothing happen. The queue drains on a schedule
// nobody watches and the only record of a run was a workflow log.

describe("what the owner hears after a publish run", () => {
  it("says nothing at all when the queue was empty", () => {
    expect(formatPublishReport([], 0, [])).toBeNull();
  });

  it("names what went out, by reference and platform", () => {
    const report = formatPublishReport([
      { published: true, platform: "facebook", proposalRef: "AB2CD" },
    ], 0, [])!;
    expect(report).toContain("AB2CD");
    expect(report).toContain("فيسبوك");
    expect(report).not.toContain("⚠️");
  });

  it("turns each failure code into the next move, not a provider string", () => {
    const report = formatPublishReport([
      { published: false, platform: "facebook", proposalRef: "AB2CD", errorCode: "permission_denied" },
      { published: false, platform: "instagram", proposalRef: "XY9MN", errorCode: "media_required" },
      { published: false, platform: "facebook", proposalRef: "QQ8RT", errorCode: "token_invalid", needsManualReview: true },
    ], 0, [])!;
    expect(report).toContain("صلاحية النشر");
    expect(report).toContain("بلا صورة");
    expect(report).toContain("أعد ربطه");
    expect(report).toContain("يحتاج تدخلك");
  });

  it("says when posts are ready but the account is not connected", () => {
    const report = formatPublishReport([], 2, ["facebook"])!;
    expect(report).toContain("2 منشور");
    expect(report).toContain("فيسبوك");
    expect(report).toContain("/admin/social-connections");
  });

  it("carries no post text and no provider error string", () => {
    // Known-bad input: an adapter that leaked a provider message would put it
    // on errorCode, and this must not print it back.
    const report = formatPublishReport([
      { published: false, platform: "facebook", proposalRef: "AB2CD", errorCode: "(#200) The user hasn't authorized" },
    ], 0, [])!;
    expect(report).not.toContain("authorized");
    expect(report).toContain("سبب غير متوقع");
  });

  it("the publisher reports the run, and a report never fails the run", () => {
    const publish = readFileSync("supabase/functions/social-publish/index.ts", "utf8");
    expect(publish).toContain("reportPublishRun(");
    expect(publish).toContain("owner_notified: notified");
    // Idle rows carry no publication and must not be reported as attempts.
    expect(publish).toContain('report.status !== "idle" && report.publicationId');
    const actions = readFileSync("supabase/functions/_shared/ownerContentActions.ts", "utf8");
    const from = actions.indexOf("export async function reportPublishRun(");
    const fn = actions.slice(from, actions.indexOf("\n// ──", from));
    expect(fn).toContain("try {");
    expect(fn).toContain("catch");
    // Inside the 24-hour window only: a run is not worth opening a paid
    // conversation the owner did not ask for.
    expect(fn).toContain("ownerWindowOpen(target.lastInboundAt, now)");
    expect(fn).not.toContain("sendWhatsAppTemplate");
  });

  it("the report can name the post, because the runner carries its reference", () => {
    const runner = readFileSync("supabase/functions/_shared/publishing/runner.ts", "utf8");
    expect(runner).toContain("proposalRef: request.proposalRef");
  });

  it("both jobs reach the owner through one lookup, not two copies", () => {
    const actions = readFileSync("supabase/functions/_shared/ownerContentActions.ts", "utf8");
    expect(actions).toContain("export async function ownerTarget(");
    // The daily run no longer has its own copy of the phone resolution.
    expect(actions.match(/\.like\("wa_phone"/g) ?? []).toHaveLength(1);
    expect(actions).toContain("const target = await ownerTarget(db);");
  });
});

describe("a proposal says what will happen to it", () => {
  const base = {
    proposal_ref: "AB2CD", section: "academy_courses", content_type: "post",
    topic: "t", hook: "h", body: "b", hashtags: [], rationale: "",
    state: "PROPOSED", proposed_publish_at: null,
  };

  it("warns on a platform that refuses a text-only post", () => {
    // Discovered today only by approving, scheduling, and reading a run that
    // reports media_required — which is three steps and a day later.
    expect(formatProposalMessage({ ...base, platform: "instagram" })).toContain("لا ينشر نصاً بلا صورة");
    expect(formatProposalMessage({ ...base, platform: "facebook" })).not.toContain("بلا صورة");
  });

  it("names the platform the adapter actually refuses, not a guessed list", () => {
    const adapters = readFileSync("supabase/functions/_shared/publishing/metaAdapters.ts", "utf8");
    for (const platform of NEEDS_MEDIA_TO_PUBLISH) {
      const from = adapters.indexOf(`platform: "${platform}"`);
      expect(from, platform).toBeGreaterThan(0);
      expect(adapters.slice(from, from + 900), platform).toContain("media_required");
    }
    // And the one that does publish text is not on the list.
    expect(NEEDS_MEDIA_TO_PUBLISH.has("facebook")).toBe(false);
  });
});
