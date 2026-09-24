// The owner's content commands and the daily proposal run, against the
// database. The words and the parsing live in ownerContent.ts; the drafting in
// contentEngine.ts; the decisions in the existing SQL functions
// (decide_content_proposal, record_content_proposal_edit,
// schedule_content_proposal), which keep a proposal and its approval in step.
// Nothing here publishes: an approved, scheduled proposal is what the
// publisher picks up, and only for an account that has been connected.

import { proposeContent } from "./contentEngine.ts";
import { indexSources } from "./contentIndex.ts";
import {
  explainMediaFailure,
  generateProposalMedia,
  mediaApiKey,
  type MediaFetch,
  type MediaKind,
  type MediaResult,
} from "./contentMedia.ts";
import { isOwner, normalizePhone } from "./ownerControl.ts";
import { recordMediaOutcome } from "./providerRecording.ts";
import {
  type Brief,
  type ContentCommand,
  type ContentSection,
  DAILY_SECTIONS,
  dailyBriefs,
  explainProposeFailure,
  formatBeirut,
  formatContentList,
  formatProposalMessage,
  formatPublishReport,
  type PublishOutcome,
  OWNER_CONTENT_TEMPLATE,
  ownerWindowOpen,
  PLATFORM_AR,
  type ProposalView,
} from "./ownerContent.ts";
import { sendWhatsAppMediaByLink, sendWhatsAppTemplate, sendWhatsAppText } from "./whatsapp.ts";

// deno-lint-ignore no-explicit-any
type Db = any;

const PROPOSAL_COLUMNS =
  "proposal_ref, platform, section, content_type, topic, hook, body, hashtags, rationale, state, " +
  "proposed_publish_at, media_kind, media_url";

/** The bucket Meta fetches a post's artwork from. Public by design; see the migration. */
export const MEDIA_BUCKET = "social-media";

// ── Artwork ──────────────────────────────────────────────────────────────────

/**
 * Generate a picture or a clip for one proposal and attach it.
 *
 * Reported, never thrown, and never fatal to the caller: a proposal without
 * artwork is still a proposal the owner can read, edit and approve, and losing
 * the draft because an image model was busy would be the worse failure.
 *
 * The upload goes through the service client rather than a signed URL — the
 * bucket is public because Meta fetches the file itself, from its own network,
 * with no credential of ours.
 */
export async function attachProposalMedia(
  db: Db,
  ref: string,
  apiKey: string | undefined,
  kind?: MediaKind,
  fetchImpl: typeof fetch = fetch,
): Promise<MediaResult> {
  const proposal = await findProposal(db, ref);
  if (!proposal) return { ok: false, error: "not_found" };
  if (!apiKey) return { ok: false, error: "no_api_key" };

  const result = await generateProposalMedia({
    apiKey,
    fetchImpl: fetchImpl as unknown as MediaFetch,
    async upload(path, bytes, contentType) {
      const { error } = await db.storage.from(MEDIA_BUCKET).upload(path, bytes, {
        contentType,
        upsert: true,
      });
      if (error) {
        console.error("[owner-content] media upload failed:", error.message);
        return null;
      }
      const { data } = db.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      return (data as { publicUrl?: string } | null)?.publicUrl ?? null;
    },
    // What the image model did, in the provider registry (Phase 2H).
    record: (outcome) => recordMediaOutcome(db, outcome),
  }, proposal, kind);

  if (!result.ok || !result.url) return result;

  const { data, error } = await db.rpc("record_content_proposal_media", {
    _proposal_ref: proposal.proposal_ref,
    _kind: result.kind,
    _url: result.url,
    _prompt: result.prompt ?? null,
  });
  if (error || (data as { ok?: boolean } | null)?.ok !== true) {
    // The file exists but nothing points at it. Saying so is better than
    // reporting success for a post that will still be refused at readiness.
    console.error("[owner-content] media record failed:", error?.message ?? "rpc refused");
    return { ok: false, error: "record_failed" };
  }
  return result;
}

/**
 * The admin account decisions are recorded against.
 *
 * The owner decides from a phone number, and the engine's functions record a
 * user id. The owner is an admin of the site; the first admin is the account
 * the Owner Control Centre is operated from.
 */
export async function ownerActorId(db: Db): Promise<string | null> {
  const { data } = await db.from("user_roles").select("user_id").eq("role", "admin").limit(1).maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

export async function findProposal(db: Db, ref: string): Promise<ProposalView | null> {
  const { data } = await db.from("content_proposals").select(PROPOSAL_COLUMNS).eq("proposal_ref", ref.toUpperCase()).maybeSingle();
  return (data as ProposalView | null) ?? null;
}

async function waitingProposals(db: Db): Promise<ProposalView[]> {
  const { data } = await db
    .from("content_proposals")
    .select(PROPOSAL_COLUMNS)
    .in("state", ["PROPOSED", "EDITED", "APPROVED"])
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as ProposalView[];
}

/**
 * The proposals a bare "موافق" could be about: undecided ones, newest first.
 *
 * Deliberately not the same list as `/content`, which also shows what has been
 * approved and scheduled. A decision may only land on something undecided, so
 * resolving one against a scheduled post would answer the wrong question.
 */
export async function decidableProposals(db: Db): Promise<ProposalView[]> {
  const { data } = await db
    .from("content_proposals")
    .select(PROPOSAL_COLUMNS)
    .in("state", ["PROPOSED", "EDITED"])
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as ProposalView[];
}

/**
 * Approve or reject a content proposal. Returns the owner's reply.
 *
 * An approval used to end at "approved — now schedule it", which left the
 * owner one command short of anything happening and said nothing about the
 * account it would be published from. Both are answered here: a proposal that
 * already carries a publishing time is scheduled on the spot, and a platform
 * with no connected account is named as the reason nothing will go out, at the
 * moment the decision is made rather than one command later.
 */
export async function decideProposal(db: Db, ref: string, approve: boolean, note: string | null): Promise<string> {
  const actor = await ownerActorId(db);
  if (!actor) return "لا يوجد حساب مدير لتسجيل القرار باسمه.";
  const { data, error } = await db.rpc("decide_content_proposal", {
    _proposal_ref: ref,
    _approve: approve,
    _actor_id: actor,
    _note: note ? `${note.slice(0, 900)} (via WhatsApp)` : "via WhatsApp",
  });
  if (error) {
    console.error("[owner-content] decision failed:", error.message);
    return "تعذّر تسجيل القرار. جرّب مرة أخرى.";
  }
  const result = data as { ok?: boolean; error?: string; state?: string };
  if (!result?.ok) return `الاقتراح ${ref} لم يعد بانتظار قرار (${result?.state ?? result?.error ?? "?"}).`;
  if (!approve) return `❌ رُفض ${ref}. سأتجنب هذا النوع في الاقتراحات القادمة.`;

  return (await carryApprovalForward(db, ref, actor)).join("\n");
}

/**
 * What happens after "approved", said in one message.
 *
 * Three facts, in the order they matter: it is approved, when it goes out, and
 * whether anything can actually send it. The third one was previously only
 * discoverable by running `/schedule` and reading the warning at the end of
 * its reply.
 */
async function carryApprovalForward(db: Db, ref: string, actor: string, now: Date = new Date()): Promise<string[]> {
  const lines = [`✅ تمت الموافقة على ${ref}.`];
  const proposal = await findProposal(db, ref);
  const at = proposal?.proposed_publish_at ?? null;
  const future = at && Date.parse(at) > now.getTime() ? at : null;

  if (future) {
    const { data, error } = await db.rpc("schedule_content_proposal", {
      _proposal_ref: ref,
      _scheduled_for: future,
      _actor_id: actor,
      _note: "auto-scheduled on approval via WhatsApp",
    });
    const scheduled = !error && (data as { ok?: boolean } | null)?.ok === true;
    if (error) console.error("[owner-content] auto-schedule failed:", error.message);
    lines.push(scheduled
      ? `🗓️ وجُدول للنشر ${formatBeirut(future)} (بتوقيت بيروت).`
      : `حدّد موعد النشر: /schedule ${ref} 20/9 18:00`);
  } else {
    lines.push(`حدّد موعد النشر: /schedule ${ref} 20/9 18:00`);
  }

  if (proposal && !(await connectedPlatform(db, ref))) {
    lines.push(
      `⚠️ حساب ${PLATFORM_AR[proposal.platform] ?? proposal.platform} غير مربوط بعد، فلن يُنشر شيء حتى تربطه من لوحة التحكم:`,
      "https://visionex.app/admin/social-connections",
    );
  }
  return lines;
}

async function propose(db: Db, brief: Brief, supersedesRef?: string): Promise<{ ok: boolean; ref?: string; reason?: string }> {
  const actor = await ownerActorId(db);
  if (!actor) return { ok: false, reason: "no_admin" };
  const result = await proposeContent(db, {
    section: brief.section,
    contentType: brief.contentType,
    platform: brief.platform,
    language: "ar",
    actorId: actor,
    supersedesRef,
  });
  return result.ok ? { ok: true, ref: result.proposal_ref } : { ok: false, reason: result.error };
}

/**
 * What a content command may hand off, and how it reaches the owner afterwards.
 *
 * Artwork takes fifteen seconds for a picture and a couple of minutes for a
 * clip. Awaiting that inside the webhook would leave the owner looking at a
 * delivered message with no reply while Meta retried the same delivery, so
 * `background` takes the work and the answer goes out first — the same shape
 * the media jobs already use. Omitted, the generation simply does not start,
 * and the command says so rather than pretending.
 */
export interface ContentCommandContext {
  openAiKey?: string;
  whatsapp?: { token?: string; phoneNumberId?: string; to: string };
  background?: (work: Promise<unknown>) => void;
  fetchImpl?: typeof fetch;
}

/** Everything a content command does. Returns the reply to send. */
export async function runContentCommand(
  db: Db,
  command: ContentCommand,
  now: Date = new Date(),
  context: ContentCommandContext = {},
): Promise<string> {
  switch (command.kind) {
    case "needs_reference":
      return `اكتب الرمز بعد الأمر، مثلاً: /${command.verb} AB2CD\nاكتب /content لرؤية الرموز.`;

    case "media": {
      const proposal = await findProposal(db, command.ref);
      if (!proposal) return `لا يوجد اقتراح بالرمز ${command.ref}.`;
      if (proposal.state === "PUBLISHED") return `الاقتراح ${command.ref} منشور بالفعل.`;
      const key = context.openAiKey ?? mediaApiKey();
      if (!key) return explainMediaFailure("no_api_key");
      if (!context.background) return "تعذّر بدء التوليد الآن. جرّب بعد قليل.";

      const noun = command.media === "video" ? "فيديو" : "صورة";
      context.background(
        finishMedia(db, command.ref, command.media, noun, context),
      );
      return command.media === "video"
        ? `🎬 جاري توليد فيديو لـ ${command.ref}. يستغرق دقيقة أو دقيقتين، وسأرسله هنا حين يجهز.`
        : `🖼️ جاري توليد صورة لـ ${command.ref}. سأرسلها هنا بعد قليل.`;
    }

    case "list":
      return formatContentList(await waitingProposals(db));

    case "show": {
      const proposal = await findProposal(db, command.ref);
      return proposal ? formatProposalMessage(proposal) : `لا يوجد اقتراح بالرمز ${command.ref}.`;
    }

    case "edit": {
      const actor = await ownerActorId(db);
      if (!actor) return "لا يوجد حساب مدير لتسجيل التعديل باسمه.";
      const { data, error } = await db.rpc("record_content_proposal_edit", {
        _proposal_ref: command.ref,
        _actor_id: actor,
        _hook: command.hook,
        _body: command.body || null,
        _hashtags: null,
        _proposed_publish_at: null,
        _note: "edited via WhatsApp",
      });
      if (error) {
        console.error("[owner-content] edit failed:", error.message);
        return "تعذّر حفظ التعديل. جرّب مرة أخرى.";
      }
      const result = data as { ok?: boolean; error?: string };
      if (!result?.ok) return `لا يمكن تعديل ${command.ref} الآن (${result?.error ?? "?"}).`;
      const updated = await findProposal(db, command.ref);
      return `✏️ حُفظ التعديل.\n\n${updated ? formatProposalMessage(updated) : ""}`.trim();
    }

    case "again": {
      const previous = await findProposal(db, command.ref);
      if (!previous) return `لا يوجد اقتراح بالرمز ${command.ref}.`;
      if (!["PROPOSED", "EDITED"].includes(previous.state)) return `الاقتراح ${command.ref} لم يعد بانتظار قرار.`;
      const outcome = await propose(db, {
        section: previous.section as Brief["section"],
        platform: previous.platform as Brief["platform"],
        contentType: previous.content_type as Brief["contentType"],
      }, command.ref);
      if (!outcome.ok || !outcome.ref) return explainProposeFailure(outcome.reason);
      const fresh = await findProposal(db, outcome.ref);
      return fresh ? `🔄 نسخة جديدة بدل ${command.ref}:\n\n${formatProposalMessage(fresh)}` : `🔄 أُنشئ ${outcome.ref}.`;
    }

    case "schedule": {
      if (!command.at) return "لم أفهم الموعد، أو أنه في الماضي. مثال: /schedule AB2CD 20/9 18:00 (بتوقيت بيروت)";
      const actor = await ownerActorId(db);
      if (!actor) return "لا يوجد حساب مدير لتسجيل الموعد باسمه.";
      const { data, error } = await db.rpc("schedule_content_proposal", {
        _proposal_ref: command.ref,
        _scheduled_for: command.at,
        _actor_id: actor,
        _note: "scheduled via WhatsApp",
      });
      if (error) {
        console.error("[owner-content] schedule failed:", error.message);
        return "تعذّر حفظ الموعد. جرّب مرة أخرى.";
      }
      const result = data as { ok?: boolean; error?: string };
      if (!result?.ok) {
        return result?.error === "not_approved"
          ? `وافق على ${command.ref} أولاً: /approve ${command.ref}`
          : `لا يمكن جدولة ${command.ref} (${result?.error ?? "?"}).`;
      }
      const connected = await connectedPlatform(db, command.ref);
      return [
        `🗓️ جُدول ${command.ref} في ${formatBeirut(command.at)}.`,
        connected
          ? "سيُنشر تلقائياً في موعده."
          : "⚠️ حساب هذه المنصة غير مربوط بعد، فلن يُنشر حتى تربطه من لوحة التحكم (Owner Control Centre).",
      ].join("\n");
    }

    case "propose": {
      // A named section is drafted as asked; otherwise one with indexed material.
      const ready = command.section ? undefined : (await readySections(db)).ready;
      const [fallback] = dailyBriefs(now, 1, ready);
      if (!fallback) return explainProposeFailure("no_indexed_content");
      const brief: Brief = {
        section: command.section ?? fallback.section,
        platform: command.platform ?? fallback.platform,
        contentType: command.platform === "facebook" ? "post" : fallback.contentType,
      };
      const outcome = await propose(db, brief);
      if (!outcome.ok || !outcome.ref) return explainProposeFailure(outcome.reason);
      const fresh = await findProposal(db, outcome.ref);
      return fresh ? formatProposalMessage(fresh) : `📝 أُنشئ ${outcome.ref}.`;
    }
  }
}

/**
 * The half of `/image` and `/video` that runs after the answer has gone out.
 *
 * Sends the finished artwork as the media message it is, so the owner sees the
 * picture rather than a link — and falls back to the link when Meta refuses
 * the media send, because a URL they can open is better than silence.
 */
async function finishMedia(
  db: Db,
  ref: string,
  kind: MediaKind,
  noun: string,
  context: ContentCommandContext,
): Promise<void> {
  const tell = async (body: string) => {
    const wa = context.whatsapp;
    if (!wa?.token || !wa.phoneNumberId) return;
    await sendWhatsAppText({ phoneNumberId: wa.phoneNumberId, token: wa.token, to: wa.to, body });
  };

  try {
    const result = await attachProposalMedia(db, ref, context.openAiKey ?? mediaApiKey(), kind, context.fetchImpl);
    if (!result.ok || !result.url) {
      await tell(`⚠️ تعذّر توليد ${noun} لـ ${ref}: ${explainMediaFailure(result.error)}`);
      return;
    }

    const wa = context.whatsapp;
    const sent = wa?.token && wa.phoneNumberId
      ? await sendWhatsAppMediaByLink({
        phoneNumberId: wa.phoneNumberId,
        token: wa.token,
        to: wa.to,
        link: result.url,
        kind: kind === "video" ? "video" : "image",
        caption: `${noun} ${ref} — جاهزة ومرفقة بالمنشور.`,
      })
      : false;

    if (!sent) await tell(`✅ جهزت ${noun} لـ ${ref} وأُرفقت بالمنشور:\n${result.url}`);
  } catch (e) {
    console.error("[owner-content] media job failed:", (e as Error)?.message ?? "unknown");
    await tell(`⚠️ تعذّر توليد ${noun} لـ ${ref}.`);
  }
}

/** Whether the proposal's platform has an active, connected account. */
async function connectedPlatform(db: Db, ref: string): Promise<boolean> {
  const proposal = await findProposal(db, ref);
  if (!proposal) return false;
  const { data } = await db
    .from("social_accounts")
    .select("status")
    .eq("platform", proposal.platform)
    .eq("status", "active")
    .limit(1);
  return (data ?? []).length > 0;
}

// ── Reaching the owner ───────────────────────────────────────────────────────

type OwnerTarget =
  | { ok: true; to: string; lastInboundAt: string | null }
  | { ok: false; reason: "no_owner_number" | "notifications_off" };

/**
 * The number to message, and when they last spoke.
 *
 * The configured number may be written without its country code; the
 * conversation row holds the number WhatsApp itself reported, which is the one
 * a message can actually be sent to. `last_message_at` is what decides whether
 * free text may leave the 24-hour window.
 *
 * Shared by the two jobs that message the owner — the daily proposals and the
 * publish report — because the alternative is two copies of a lookup that has
 * to agree with `isOwner()` and with itself.
 */
export async function ownerTarget(db: Db): Promise<OwnerTarget> {
  const { data: setting } = await db.from("site_settings").select("value").eq("key", "owner_contact").maybeSingle();
  const value = (setting?.value ?? {}) as { whatsapp_number?: string | null; notify_content_proposals?: boolean };
  const owner = normalizePhone(value.whatsapp_number);
  if (!owner || owner.length < 8) return { ok: false, reason: "no_owner_number" };
  if (value.notify_content_proposals === false) return { ok: false, reason: "notifications_off" };

  const { data: candidates } = await db
    .from("whatsapp_conversations")
    .select("wa_phone, last_message_at")
    .like("wa_phone", `%${owner.slice(-8)}`)
    .limit(5);
  const conversation = ((candidates ?? []) as Array<{ wa_phone: string; last_message_at: string | null }>)
    .find((row) => isOwner(row.wa_phone, owner)) ?? null;

  return { ok: true, to: conversation?.wa_phone ?? owner, lastInboundAt: conversation?.last_message_at ?? null };
}

/**
 * Tell the owner what the publisher just did.
 *
 * Only inside the 24-hour window, and deliberately without a template fallback
 * outside it: a run that published nothing and failed nothing says nothing at
 * all, and a run that did something is worth a message but not worth opening a
 * paid conversation the owner did not ask for. The next thing they send opens
 * the window anyway, and the outcome is on the proposal either way.
 *
 * Reported, never thrown: a publish that succeeded must not be recorded as a
 * failure because a notification did not go out.
 */
export async function reportPublishRun(
  db: Db,
  whatsapp: { token: string | undefined; phoneNumberId: string | undefined },
  outcomes: readonly PublishOutcome[],
  withheldForConnection = 0,
  awaitingConnection: readonly string[] = [],
  now: Date = new Date(),
): Promise<"text" | "none"> {
  try {
    const message = formatPublishReport(outcomes, withheldForConnection, awaitingConnection);
    if (!message) return "none";
    if (!whatsapp.token || !whatsapp.phoneNumberId) return "none";

    const target = await ownerTarget(db);
    if (!target.ok || !ownerWindowOpen(target.lastInboundAt, now)) return "none";

    const sent = await sendWhatsAppText({
      phoneNumberId: whatsapp.phoneNumberId,
      token: whatsapp.token,
      to: target.to,
      body: message,
    });
    return sent ? "text" : "none";
  } catch (e) {
    console.error("[owner-content] publish report failed:", (e as Error)?.message ?? "unknown");
    return "none";
  }
}

// ── The daily run ────────────────────────────────────────────────────────────

/** How many never-indexed sections one run may fill, so a run stays short. */
const MAX_SECTIONS_INDEXED_PER_RUN = 3;
const INDEX_ROWS_PER_SECTION = 300;

/**
 * The sections the engine can draft from: those with rows in ai_embeddings.
 *
 * A section that has never been indexed is filled here, with the same rules
 * as the admin "rebuild index" action — published, active rows only. The
 * index had never been built in production, which is why the first run
 * drafted nothing.
 */
export async function readySections(db: Db): Promise<{ ready: ContentSection[]; indexed: Record<string, number> }> {
  const ready: ContentSection[] = [];
  const empty: ContentSection[] = [];
  for (const section of DAILY_SECTIONS) {
    const { count } = await db
      .from("ai_embeddings")
      .select("source_id", { count: "exact", head: true })
      .eq("source_table", section);
    if ((count ?? 0) > 0) ready.push(section);
    else empty.push(section);
  }
  const indexed: Record<string, number> = {};
  for (const section of empty.slice(0, MAX_SECTIONS_INDEXED_PER_RUN)) {
    try {
      const summary = await indexSources(db, [section], { limit: INDEX_ROWS_PER_SECTION });
      indexed[section] = summary[section] ?? 0;
      if ((summary[section] ?? 0) > 0) ready.push(section);
    } catch {
      indexed[section] = -1;
    }
  }
  return { ready, indexed };
}

export interface DailyRunReport {
  proposed: string[];
  failed: string[];
  /** Rows added to the index this run, by section; -1 when a section could not be read. */
  indexed?: Record<string, number>;
  notified: "text" | "template" | "none";
  reason?: string;
  /** Per reference: the media kind generated, or the reason code it failed with. */
  media?: Record<string, string>;
}

/**
 * Propose today's briefs and tell the owner.
 *
 * Inside the 24-hour window each proposal is sent whole; outside it, the
 * approved template says how many are waiting and a reply of "محتوى" shows
 * them. The report carries references and reason codes only.
 */
export async function runDailyProposals(
  db: Db,
  whatsapp: { token: string | undefined; phoneNumberId: string | undefined },
  now: Date = new Date(),
  count = 2,
  openAiKey?: string,
): Promise<DailyRunReport> {
  const proposed: string[] = [];
  const failed: string[] = [];
  const { ready, indexed } = await readySections(db);
  if (ready.length === 0) return { proposed, failed, indexed, notified: "none", reason: "index_empty" };
  for (const brief of dailyBriefs(now, count, ready)) {
    const outcome = await propose(db, brief);
    if (outcome.ok && outcome.ref) proposed.push(outcome.ref);
    else failed.push(`${brief.section}:${outcome.reason ?? "unknown"}`);
  }
  if (proposed.length === 0) return { proposed, failed, indexed, notified: "none", reason: "nothing_proposed" };

  // ── The artwork, before the owner ever sees the draft ─────────────────
  //
  // Instagram publishes nothing without it, so a proposal that arrives
  // without a picture is one the owner can approve and then watch fail. Each
  // one is reported and none is fatal: a draft with no artwork is still a
  // draft worth reading, and `/image AB2CD` makes one on demand.
  const media: Record<string, string> = {};
  for (const ref of proposed) {
    const result = await attachProposalMedia(db, ref, openAiKey);
    if (result.error === "no_media_needed") continue;
    media[ref] = result.ok ? (result.kind ?? "ok") : (result.error ?? "failed");
  }

  const target = await ownerTarget(db);
  if (!target.ok) return { proposed, failed, indexed, media, notified: "none", reason: target.reason };
  if (!whatsapp.token || !whatsapp.phoneNumberId) return { proposed, failed, indexed, media, notified: "none", reason: "whatsapp_not_configured" };
  const to = target.to;

  if (ownerWindowOpen(target.lastInboundAt, now)) {
    let sent = 0;
    for (const ref of proposed) {
      const proposal = await findProposal(db, ref);
      if (!proposal) continue;
      const ok = await sendWhatsAppText({
        phoneNumberId: whatsapp.phoneNumberId,
        token: whatsapp.token,
        to,
        body: formatProposalMessage(proposal),
      });
      if (ok) sent++;
    }
    if (sent > 0) return { proposed, failed, indexed, media, notified: "text" };
  }

  const ok = await sendWhatsAppTemplate({
    phoneNumberId: whatsapp.phoneNumberId,
    token: whatsapp.token,
    to,
    template: OWNER_CONTENT_TEMPLATE.name,
    language: "ar",
    variables: [String(proposed.length)],
  });
  return ok
    ? { proposed, failed, indexed, media, notified: "template" }
    : { proposed, failed, indexed, media, notified: "none", reason: "template_send_failed" };
}
