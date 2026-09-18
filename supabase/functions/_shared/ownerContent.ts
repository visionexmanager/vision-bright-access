// Social media content, proposed to the owner on WhatsApp and decided there.
//
// The content engine (contentEngine.ts) drafts a proposal and pairs it with an
// owner approval. Until now the only place to see and decide one was the Owner
// Control Centre. This module is the WhatsApp side: the commands the owner
// types, the message a proposal is shown as, and the daily plan of what to
// propose. Pure — no database, no network — so all of it is tested directly.
//
//   /content                 what is waiting (المحتوى)
//   /show AB2CD              the whole proposal (عرض)
//   /approve AB2CD           approve it — the existing command, routed here
//   /reject AB2CD why        reject it, with a reason the engine remembers
//   /edit AB2CD new text     replace the text; a first line "عنوان: …" sets the hook
//   /again AB2CD             another take on the same brief (غيره)
//   /schedule AB2CD 20/9 18:00   when to publish an approved one (جدول)
//   /propose instagram academy   a new proposal now (اقترح)

export const CONTENT_SECTIONS = [
  "products", "content_items", "academy_courses", "kids_games", "simulations",
  "tv_channels", "radio_stations", "communities", "events", "jobs", "services",
] as const;
export const CONTENT_PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "website", "newsletter"] as const;
export type ContentSection = (typeof CONTENT_SECTIONS)[number];
export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

/** Same alphabet and length as generate_action_reference(). */
const REFERENCE = /\b([23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5})\b/i;

export type ContentCommand =
  | { kind: "list" }
  | { kind: "show"; ref: string }
  | { kind: "edit"; ref: string; hook: string | null; body: string }
  | { kind: "again"; ref: string }
  | { kind: "schedule"; ref: string; at: string | null }
  | { kind: "propose"; section: ContentSection | null; platform: ContentPlatform | null }
  | { kind: "needs_reference"; verb: "show" | "edit" | "again" | "schedule" };

const VERBS: Array<[ContentCommand["kind"], RegExp]> = [
  ["list", /^(?:content|posts|proposals|المحتوى|محتوى|منشورات|المنشورات|اقتراحات|الاقتراحات)$/iu],
  ["show", /^(?:show|view|عرض|اعرض|شوف)$/iu],
  ["edit", /^(?:edit|عدل|عدّل|تعديل)$/iu],
  ["again", /^(?:again|redo|regenerate|غيره|غيّره|بدله|بدّله|جديد)$/iu],
  ["schedule", /^(?:schedule|جدول|جدولة|موعد)$/iu],
  ["propose", /^(?:propose|suggest|اقترح|اقتراح)$/iu],
];

const PLATFORM_WORDS: Record<ContentPlatform, RegExp> = {
  facebook: /^(?:facebook|fb|فيسبوك|فيس بوك|فيس)$/iu,
  instagram: /^(?:instagram|insta|ig|انستغرام|انستقرام|انستا|إنستغرام)$/iu,
  tiktok: /^(?:tiktok|تيك ?توك|تيكتوك)$/iu,
  youtube: /^(?:youtube|يوتيوب)$/iu,
  website: /^(?:website|site|الموقع|موقع)$/iu,
  newsletter: /^(?:newsletter|النشرة|نشرة)$/iu,
};

const SECTION_WORDS: Record<ContentSection, RegExp> = {
  products: /^(?:products|shop|منتجات|المنتجات|السوق)$/iu,
  content_items: /^(?:articles|content|مقالات|المقالات)$/iu,
  academy_courses: /^(?:academy|courses|الأكاديمية|أكاديمية|اكاديمية|دورات|الدورات)$/iu,
  kids_games: /^(?:kids|children|أطفال|الأطفال|اطفال)$/iu,
  simulations: /^(?:simulations|محاكاة|المحاكاة)$/iu,
  tv_channels: /^(?:tv|television|تلفزيون|التلفزيون)$/iu,
  radio_stations: /^(?:radio|راديو|الراديو)$/iu,
  communities: /^(?:communities|community|مجتمعات|المجتمع)$/iu,
  events: /^(?:events|فعاليات|الفعاليات)$/iu,
  jobs: /^(?:jobs|careers|وظائف|الوظائف)$/iu,
  services: /^(?:services|خدمات|الخدمات)$/iu,
};

/**
 * A content command, or null for every other owner command.
 *
 * `body` is the text after the slash. Approve and reject are not here: the
 * existing parser reads them, and the webhook routes a reference that names a
 * content proposal to the content decision.
 */
export function parseContentCommand(body: string): ContentCommand | null {
  const text = (body ?? "").trim();
  if (!text) return null;
  const [first, ...restWords] = text.split(/\s+/u);
  const verb = VERBS.find(([, pattern]) => pattern.test(first))?.[0];
  if (!verb) return null;
  const rest = text.slice(first.length).trim();

  if (verb === "list") return { kind: "list" };

  if (verb === "propose") {
    let section: ContentSection | null = null;
    let platform: ContentPlatform | null = null;
    for (const word of restWords) {
      platform ??= (CONTENT_PLATFORMS.find((p) => PLATFORM_WORDS[p].test(word)) ?? null);
      section ??= (CONTENT_SECTIONS.find((s) => SECTION_WORDS[s].test(word)) ?? null);
    }
    return { kind: "propose", section, platform };
  }

  const match = REFERENCE.exec(rest);
  if (!match || rest.indexOf(match[1]) !== 0) {
    return { kind: "needs_reference", verb: verb as "show" | "edit" | "again" | "schedule" };
  }
  const ref = match[1].toUpperCase();
  const after = rest.slice(match[1].length).trim();

  if (verb === "show") return { kind: "show", ref };
  if (verb === "again") return { kind: "again", ref };
  if (verb === "schedule") return { kind: "schedule", ref, at: parseBeirutTime(after) };

  // edit: an optional first line naming the hook, then the new text.
  const lines = after.split(/\r?\n/u);
  const hookLine = /^(?:عنوان|العنوان|hook|title)\s*[:：]\s*(.+)$/iu.exec(lines[0] ?? "");
  const hook = hookLine ? hookLine[1].trim().slice(0, 300) : null;
  const newBody = (hookLine ? lines.slice(1) : lines).join("\n").trim().slice(0, 8000);
  if (!newBody && !hook) return { kind: "needs_reference", verb: "edit" };
  return { kind: "edit", ref, hook, body: newBody };
}

// ── Time, in Beirut ──────────────────────────────────────────────────────────

/** Beirut's offset from UTC, in minutes, at a moment (it has daylight saving). */
function beirutOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Beirut",
    hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** A wall-clock time in Beirut, as an ISO instant. */
export function beirutWallClockToIso(year: number, month: number, day: number, hour: number, minute: number): string {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset = beirutOffsetMinutes(new Date(guess));
  return new Date(guess - offset * 60_000).toISOString();
}

/**
 * "2026-09-20 18:00", "20/9 18:00", "بكرا 18:00", "tomorrow 9:30", "اليوم 20:00".
 * Read as Beirut time. Null when it cannot be read, or when it is in the past.
 */
export function parseBeirutTime(text: string, now: Date = new Date()): string | null {
  const input = (text ?? "").trim()
    // Arabic-Indic digits, so "١٨:٠٠" reads the same as "18:00".
    .replace(/[٠-٩]/gu, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase();
  const time = /(\d{1,2})[:.](\d{2})\s*(am|pm|ص|م)?/u.exec(input);
  if (!time) return null;
  let hour = Number(time[1]);
  const minute = Number(time[2]);
  const meridiem = time[3];
  if (meridiem === "pm" || meridiem === "م") hour = hour % 12 + 12;
  if ((meridiem === "am" || meridiem === "ص") && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  const todayParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(now).split("-").map(Number);
  let [year, month, day] = todayParts;

  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(input);
  const short = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(input);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (short) {
    day = Number(short[1]);
    month = Number(short[2]);
    if (short[3]) year = Number(short[3].length === 2 ? `20${short[3]}` : short[3]);
  } else if (/(?:tomorrow|بكرا|بكرة|غدا|غداً|بكره)/u.test(input)) {
    const next = new Date(Date.UTC(year, month - 1, day) + 86_400_000);
    [year, month, day] = [next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()];
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const at = beirutWallClockToIso(year, month, day, hour, minute);
  if (Date.parse(at) <= now.getTime()) return null;
  return at;
}

export function formatBeirut(iso: string): string {
  return new Intl.DateTimeFormat("ar-LB", {
    timeZone: "Asia/Beirut",
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
    numberingSystem: "latn",
  }).format(new Date(iso));
}

// ── What the owner reads ─────────────────────────────────────────────────────

export interface ProposalView {
  proposal_ref: string;
  platform: string;
  section: string;
  content_type: string;
  topic: string;
  hook: string;
  body: string;
  hashtags: string[];
  rationale: string;
  state: string;
  proposed_publish_at: string | null;
}

export const PLATFORM_AR: Record<string, string> = {
  facebook: "فيسبوك", instagram: "إنستغرام", tiktok: "تيك توك", youtube: "يوتيوب", website: "الموقع", newsletter: "النشرة البريدية",
};
const TYPE_AR: Record<string, string> = {
  post: "منشور", short_video: "فيديو قصير", reel: "ريل", story: "ستوري", article: "مقال", carousel: "منشور صور متعددة",
};
const SECTION_AR: Record<string, string> = {
  products: "المنتجات", content_items: "المقالات", academy_courses: "الأكاديمية", kids_games: "الأطفال",
  simulations: "المحاكاة", tv_channels: "التلفزيون", radio_stations: "الراديو", communities: "المجتمعات",
  events: "الفعاليات", jobs: "الوظائف", services: "الخدمات",
};
const STATE_AR: Record<string, string> = {
  PROPOSED: "بانتظار قرارك", EDITED: "معدّل وبانتظار قرارك", APPROVED: "موافَق عليه", SCHEDULED: "مجدول",
  REJECTED: "مرفوض", SUPERSEDED: "استُبدل بنسخة أحدث", PUBLISHED: "منشور",
};

/** One proposal, whole, with the commands that act on it. */
export function formatProposalMessage(p: ProposalView): string {
  const tags = (p.hashtags ?? []).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  const lines = [
    `📝 *اقتراح محتوى* [${p.proposal_ref}]`,
    `${PLATFORM_AR[p.platform] ?? p.platform} · ${TYPE_AR[p.content_type] ?? p.content_type} · ${SECTION_AR[p.section] ?? p.section}`,
    `الحالة: ${STATE_AR[p.state] ?? p.state}`,
    "",
    `*${p.hook}*`,
    "",
    p.body,
  ];
  if (tags) lines.push("", tags);
  if (p.rationale) lines.push("", `💡 لماذا: ${p.rationale}`);
  if (p.proposed_publish_at) lines.push(`🕒 وقت مقترح: ${formatBeirut(p.proposed_publish_at)}`);
  if (p.state === "PROPOSED" || p.state === "EDITED") {
    lines.push(
      "",
      `✅ /approve ${p.proposal_ref} — موافقة`,
      `✏️ /edit ${p.proposal_ref} النص الجديد — تعديل (سطر أول «عنوان: …» يغيّر العنوان)`,
      `🔄 /again ${p.proposal_ref} — نسخة أخرى`,
      `❌ /reject ${p.proposal_ref} السبب — رفض`,
      "أو ردّ «موافق» أو «لا» وحدها إن كان هذا الاقتراح الوحيد بانتظارك.",
    );
  } else if (p.state === "APPROVED") {
    lines.push("", `🗓️ /schedule ${p.proposal_ref} 20/9 18:00 — حدّد موعد النشر (بتوقيت بيروت)`);
  }
  return lines.join("\n");
}

/** What is waiting, one line each. */
export function formatContentList(rows: Array<Pick<ProposalView, "proposal_ref" | "platform" | "hook" | "state">>): string {
  if (rows.length === 0) {
    return "لا توجد اقتراحات محتوى بانتظارك الآن.\nاكتب /propose لاقتراح جديد، مثلاً: /propose instagram academy";
  }
  return [
    `*${rows.length} اقتراح محتوى*`,
    "",
    ...rows.slice(0, 10).map((row) => `• [${row.proposal_ref}] ${PLATFORM_AR[row.platform] ?? row.platform} — ${row.hook} (${STATE_AR[row.state] ?? row.state})`),
    "",
    "اكتب /show مع الرمز لرؤية الاقتراح كاملاً.",
  ].join("\n");
}

/** The lines added to /help. */
export const CONTENT_HELP_LINES = [
  "",
  "*محتوى التواصل الاجتماعي*",
  "/content — الاقتراحات بانتظارك",
  "/show AB2CD — الاقتراح كاملاً",
  "/approve AB2CD — موافقة · /reject AB2CD السبب — رفض",
  "/edit AB2CD النص — تعديل · /again AB2CD — نسخة أخرى",
  "/schedule AB2CD 20/9 18:00 — موعد النشر",
  "/propose instagram academy — اقتراح جديد الآن",
  "وإن كان اقتراح واحد فقط بانتظارك، «موافق» أو «لا» وحدها تكفي.",
];

/** Why the engine refused, in words the owner can act on. */
export function explainProposeFailure(reason: string | undefined): string {
  switch (reason) {
    case "near_duplicate":
      return "الموضوع قريب جداً من اقتراح سابق. جرّب قسماً أو منصة أخرى.";
    case "all_sources_on_cooldown":
      return "هذا القسم استُخدم مؤخراً. جرّب قسماً آخر، مثلاً: /propose facebook services";
    case "stale_date":
      return "المسودة ذكرت سنة قديمة مرتين فرُفضت. جرّب /propose مرة أخرى.";
    case "rate_limited":
      return "وصلت لحد الاقتراحات اليومي. جرّب لاحقاً.";
    case "confidentiality_violation":
      return "المسودة ذكرت معلومة داخلية فرُفضت تلقائياً. جرّب مرة أخرى.";
    case "no_indexed_content":
    case "no_valid_sources":
      return "لا يوجد محتوى منشور كافٍ في هذا القسم لبناء اقتراح منه. جرّب قسماً آخر.";
    case "unknown_section":
    case "unknown_platform":
    case "unknown_content_type":
      return "لم أتعرف على القسم أو المنصة. مثال: /propose instagram academy";
    default:
      return "تعذّر إنشاء الاقتراح الآن. جرّب بعد قليل.";
  }
}

// ── The daily plan ───────────────────────────────────────────────────────────

export interface Brief {
  section: ContentSection;
  platform: ContentPlatform;
  contentType: "post" | "reel" | "carousel" | "story";
}

/** Sections with published material to draw on, in rotation order. */
export const DAILY_SECTIONS: ContentSection[] = [
  "academy_courses", "products", "services", "kids_games", "content_items",
  "simulations", "tv_channels", "radio_stations", "communities", "events", "jobs",
];
const DAILY_SLOTS: Array<Pick<Brief, "platform" | "contentType">> = [
  { platform: "instagram", contentType: "reel" },
  { platform: "facebook", contentType: "post" },
  { platform: "instagram", contentType: "carousel" },
  { platform: "facebook", contentType: "post" },
];

/**
 * What to propose on a given day: `count` briefs, rotating through the
 * sections and the two platforms Visionex has accounts on, so no two days
 * look the same and no section is drafted twice in a row.
 *
 * `available` narrows the rotation to sections that actually have indexed
 * material; drafting from an empty section can only be refused.
 */
export function dailyBriefs(date: Date, count = 2, available?: readonly ContentSection[]): Brief[] {
  const sections = available && available.length > 0
    ? DAILY_SECTIONS.filter((section) => available.includes(section))
    : DAILY_SECTIONS;
  const pool = sections.length > 0 ? sections : DAILY_SECTIONS;
  const day = Math.floor(date.getTime() / 86_400_000);
  const briefs: Brief[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) {
    const section = pool[(day * 2 + i) % pool.length];
    const slot = DAILY_SLOTS[(day + i) % DAILY_SLOTS.length];
    briefs.push({ section, platform: slot.platform, contentType: slot.contentType });
  }
  return briefs;
}

// ── The note that reaches the owner outside the 24-hour window ──────────────

/**
 * A business may only start a WhatsApp conversation with an approved
 * template. This one says that proposals are waiting and invites a reply; the
 * reply opens the window, and the proposals follow as ordinary messages.
 */
export const OWNER_CONTENT_TEMPLATE = {
  name: "visionex_owner_content",
  category: "UTILITY" as const,
  translations: {
    ar: {
      body: "مرحبًا من Visionex 👋\nلديك {{1}} اقتراح محتوى جديد للتواصل الاجتماعي بانتظار موافقتك.\nردّ بكلمة «محتوى» لعرضها والموافقة عليها أو تعديلها.",
      example: ["2"] as [string],
    },
    en: {
      body: "Hello from Visionex 👋\nYou have {{1}} new social media content proposal(s) waiting for your approval.\nReply \"content\" to see them and approve or edit them.",
      example: ["2"] as [string],
    },
  },
};

/** Meta's customer-service window. */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Whether free text may still be sent to the owner, given their last message. */
export function ownerWindowOpen(lastInboundAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!lastInboundAt) return false;
  const at = Date.parse(lastInboundAt);
  return Number.isFinite(at) && now.getTime() - at < SERVICE_WINDOW_MS - 5 * 60_000;
}

/**
 * A reply of just "محتوى" / "content" (the word the template asks for) is
 * treated as /content, so the owner does not have to know about the slash.
 */
export function isBareContentReply(text: string): boolean {
  return /^(?:content|المحتوى|محتوى|منشورات|اقتراحات)[\s.!؟?]*$/iu.test((text ?? "").trim());
}

// ── Answering a proposal the way anybody answers a message ───────────────────
//
// The proposal message ends with `/approve AB2CD`, and the owner answered
// «وافقت عليه» — which is what a person does when a message asks them to
// decide something. Nothing happened: without the slash it was not a command
// at all, so it went to the customer assistant, which had a pleasant
// conversation about it and moved nothing.
//
// A slash still separates a command from a sentence everywhere else; this is
// the one place it does not have to, because the decision is unambiguous: a
// short message that says only "yes" or "no" while exactly one proposal is
// waiting is an answer to that proposal. The caller resolves the "exactly
// one", and refuses to guess when two are waiting — which is the same rule
// the customer escalations already follow.

/** A whole message that decides, with nothing else in it. */
export interface BareDecision {
  approve: boolean;
  /** Anything the owner added, e.g. a reason for a rejection. */
  note: string | null;
}

/** Longest a message can be and still be read as nothing but a decision. */
const BARE_DECISION_MAX_CHARS = 40;

// Whole-message patterns only. "نعم" decides; "نعم بس غيّر العنوان" does not,
// and falls through to the assistant, where it belongs.
const BARE_APPROVE = [
  /^(?:yes|yeah|yep|ok|okay|sure|approve[d]?|accept(?:ed)?|publish(?:\s+it)?|post\s+it|go\s+ahead|do\s+it|send\s+it)$/iu,
  /^(?:نعم|أجل|اجل|اي|أي|ايه|أيوه|ايوه|اوك|أوك|تمام|ماشي|أكيد|اكيد|طيب|حلو|زين)$/u,
  /^(?:موافق|موافقة|أوافق|اوافق|وافق|وافقت(?:\s+عليه)?|تمت\s+الموافقة|قبلت|اقبل|أقبل)$/u,
  /^(?:انشر(?:ه|ها|هم)?|أنشر(?:ه|ها)?|انشره\s+الآن|نشر|نفذ(?:ه|ها)?|نفّذ(?:ه|ها)?|يلا|يالله)$/u,
];
const BARE_REJECT = [
  /^(?:no|nope|reject(?:ed)?|decline[d]?|cancel|skip|drop\s+it|not\s+this\s+one)$/iu,
  /^(?:لا|لأ|كلا|مرفوض|ارفض|أرفض|رفضت|رفض|احذفه|إحذفه|ألغه|الغه|ألغي|الغي|إلغاء|الغاء|مش\s+عاجبني|ما\s+بدي)$/u,
];

/**
 * "موافق" / "yes" / "انشره" / "لا" — a decision and nothing else.
 *
 * Returns null for every longer message, including one that starts with an
 * approving word: "نعم، بس خلّينا نغيّر الصورة" is a conversation, not a
 * decision, and the assistant is the right place for it.
 */
export function parseBareDecision(text: string): BareDecision | null {
  const trimmed = (text ?? "").trim().replace(/[\s.!؟?،,]+$/u, "");
  if (!trimmed || trimmed.length > BARE_DECISION_MAX_CHARS) return null;
  if (BARE_APPROVE.some((pattern) => pattern.test(trimmed))) return { approve: true, note: null };
  if (BARE_REJECT.some((pattern) => pattern.test(trimmed))) return { approve: false, note: null };
  return null;
}

/** Two or more are waiting: name them rather than decide the wrong one. */
export function formatWhichProposal(
  rows: Array<Pick<ProposalView, "proposal_ref" | "platform" | "hook">>,
  approve: boolean,
): string {
  const verb = approve ? "/approve" : "/reject";
  return [
    `أي اقتراح تقصد؟ ${rows.length} بانتظار قرارك:`,
    ...rows.slice(0, 10).map((row) => `• [${row.proposal_ref}] ${PLATFORM_AR[row.platform] ?? row.platform} — ${row.hook}`),
    "",
    `اكتب ${verb} مع الرمز، مثلاً: ${verb} ${rows[0]?.proposal_ref ?? "AB2CD"}`,
  ].join("\n");
}
