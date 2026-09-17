// The content-writer's vocabularies, result schema and prompt builders.
//
// Deliberately import-free. The generator registry pulls these in and wires
// them to a provider and model; keeping them here means the unit suite can
// exercise the real prompt and the real schema without dragging Deno-only
// modules into the app's TypeScript program.

/**
 * Discoverable sections — the exact `source_table` values embed-content indexes.
 *
 * Not a marketing taxonomy. A section absent from ai_embeddings cannot be
 * discovered, so offering one here would only invite the model to invent a
 * topic with no record behind it. Library, news, arcade games and "features"
 * are deliberately absent: they are not indexed.
 */
export const CONTENT_SECTIONS = [
  "products", "content_items", "academy_courses", "kids_games", "simulations",
  "tv_channels", "radio_stations", "communities", "events", "jobs", "services",
] as const;

export const CONTENT_TYPES = [
  "post", "short_video", "reel", "story", "article", "carousel",
] as const;

/** Proposal data only. Nothing in this phase dispatches to any of these. */
export const CONTENT_PLATFORMS = [
  "facebook", "instagram", "tiktok", "youtube", "website", "newsletter",
] as const;

/**
 * The content proposal shape. Every field the owner needs to decide is a typed
 * property, so nothing has to be recovered from prose later.
 *
 * All properties are listed in `required` because OpenAI structured outputs
 * reject a partial required list under strict mode.
 */
export const CONTENT_PROPOSAL_SCHEMA = {
  type: "object",
  properties: {
    content_type: { type: "string", enum: CONTENT_TYPES },
    section: { type: "string", enum: CONTENT_SECTIONS },
    platform: { type: "string", enum: CONTENT_PLATFORMS },
    topic: { type: "string", description: "Short topic label, used for duplicate detection." },
    hook: { type: "string", description: "Title or opening line." },
    body: { type: "string", description: "The post text or the video script." },
    hashtags: { type: "array", items: { type: "string" } },
    rationale: { type: "string", description: "Why this is worth posting, citing the retrieved records." },
    target_audience: { type: "string" },
    proposed_publish_at: { type: "string", description: "Suggested ISO 8601 timestamp." },
    source_refs: {
      type: "array",
      description: "source_id values of the retrieved records actually used.",
      items: { type: "string" },
    },
  },
  required: [
    "content_type", "section", "platform", "topic", "hook", "body",
    "hashtags", "rationale", "target_audience", "proposed_publish_at", "source_refs",
  ],
  additionalProperties: false,
} as const;

// ── Timeliness ──────────────────────────────────────────────────────────────
//
// The model does not know what day it is. A proposal drafted without being
// told wrote as if it were 2023. So every draft is given today's date, the
// occasions coming up that suit Visionex's audience, an angle to take, and the
// shape the target platform rewards.

/** The nth weekday (0 = Sunday) of a month, as a UTC date. */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

/** Occasions worth a post, for a platform built around accessibility and learning. */
function occasionsOf(year: number): Array<{ date: Date; en: string; ar: string }> {
  const on = (month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
  return [
    { date: on(1, 4), en: "World Braille Day", ar: "اليوم العالمي للغة برايل" },
    { date: on(1, 24), en: "International Day of Education", ar: "اليوم الدولي للتعليم" },
    { date: on(3, 8), en: "International Women's Day", ar: "يوم المرأة العالمي" },
    { date: on(3, 21), en: "Mother's Day (Arab world)", ar: "عيد الأم" },
    { date: on(4, 23), en: "World Book Day", ar: "اليوم العالمي للكتاب" },
    { date: nthWeekday(year, 4, 4, 3), en: "Global Accessibility Awareness Day", ar: "اليوم العالمي للتوعية بإمكانية الوصول" },
    { date: on(6, 1), en: "Global Day of Parents", ar: "اليوم العالمي للوالدين" },
    { date: on(7, 15), en: "World Youth Skills Day", ar: "اليوم العالمي لمهارات الشباب" },
    { date: on(8, 12), en: "International Youth Day", ar: "اليوم الدولي للشباب" },
    { date: on(9, 1), en: "Back to school", ar: "العودة إلى المدارس" },
    { date: on(9, 8), en: "International Literacy Day", ar: "اليوم الدولي لمحو الأمية" },
    { date: nthWeekday(year, 9, 4, 2), en: "World Sight Day", ar: "اليوم العالمي للبصر" },
    { date: on(10, 15), en: "White Cane Safety Day", ar: "اليوم العالمي للعصا البيضاء" },
    { date: on(11, 20), en: "World Children's Day", ar: "اليوم العالمي للطفل" },
    { date: on(12, 3), en: "International Day of Persons with Disabilities", ar: "اليوم الدولي للأشخاص ذوي الإعاقة" },
    { date: on(12, 18), en: "Arabic Language Day", ar: "اليوم العالمي للغة العربية" },
    { date: on(12, 31), en: "New Year", ar: "رأس السنة" },
  ];
}

/** The occasions in the next `days` days. */
export function upcomingOccasions(now: Date, lang: string, days = 30): string[] {
  const horizon = now.getTime() + days * 86_400_000;
  const start = now.getTime() - 86_400_000;
  const year = now.getUTCFullYear();
  return [...occasionsOf(year), ...occasionsOf(year + 1)]
    .filter((o) => o.date.getTime() >= start && o.date.getTime() <= horizon)
    .map((o) => `${lang === "ar" ? o.ar : o.en} (${o.date.toISOString().slice(0, 10)})`);
}

/** Ways into a post; rotated so the queue does not read like one template. */
export const CONTENT_ANGLES = [
  "a practical tip the reader can use today",
  "a short, concrete story of one person using this",
  "a feature spotlight: what it does and who it helps",
  "a question to the audience that invites comments",
  "a step-by-step how-to in three steps",
  "a myth versus fact about accessibility or learning",
  "a behind-the-scenes look at why Visionex built this",
];

const PLATFORM_FORMAT: Record<string, string> = {
  instagram: "Instagram: a hook in the first line (under 10 words), short lines, 3–5 relevant hashtags, one clear call to action. For a reel, write a 20–30 second script with numbered scenes and on-screen text; for a carousel, 5–7 slides, one idea each.",
  facebook: "Facebook: a conversational post of 60–150 words, a question near the end to invite comments, 1–3 hashtags, and a call to action pointing to visionex.app.",
  tiktok: "TikTok: a 15–30 second script with a hook in the first two seconds, numbered scenes and on-screen text.",
  youtube: "YouTube: a title under 60 characters, a description with the key points, and a short script outline.",
  website: "Website: an article-style post with a clear headline and short paragraphs.",
  newsletter: "Newsletter: a subject line, a short intro and one clear link.",
};

/** Everything a draft needs to be current, as prompt text. */
export function timelinessContext(now: Date, lang: string, angleSeed: number): { today: string; angle: string } {
  const dateText = new Intl.DateTimeFormat(lang === "ar" ? "ar-LB" : "en-GB", {
    timeZone: "Asia/Beirut", weekday: "long", day: "numeric", month: "long", year: "numeric", numberingSystem: "latn",
  }).format(now);
  const year = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric" }).format(now));
  const occasions = upcomingOccasions(now, lang);
  const lines = [
    `Today is ${dateText}. The current year is ${year}.`,
    `Write as of today. Never present an earlier year as current or recent, never mention a year before ${year} unless the retrieved records themselves state it, and do not reference events that have already passed as upcoming.`,
    occasions.length > 0
      ? `Upcoming occasions in the next 30 days — tie the post to one of them only if it fits naturally: ${occasions.join("; ")}.`
      : "",
  ].filter(Boolean);
  return {
    today: lines.join(" "),
    angle: CONTENT_ANGLES[Math.abs(angleSeed) % CONTENT_ANGLES.length],
  };
}

/**
 * Build the content-writer system prompt.
 *
 * Grounding and confidentiality are both stated here. The prompt is the polite
 * request; `detectConfidentialLeak` and `validateSourceRefs` are the guarantee,
 * and they run on whatever comes back.
 */
export function buildContentWriterSystem(p: Record<string, string>, lang: string): string {
  return [
    "You are the Visionex Content Strategist. You draft ONE content proposal about Visionex — its products, services, sections and features — for a human owner to review. You never publish, and nothing you write is sent anywhere automatically.",

    `Section: ${p.section || "products"}. Content type: ${p.contentType || "post"}. Target platform: ${p.platform || "website"}.`,

    // Grounding is the whole point: a proposal with no evidence behind it is
    // the failure mode this engine exists to avoid.
    `Write ONLY about what these retrieved Visionex records actually contain. Do not invent products, courses, games, channels, features, prices, statistics, dates, or claims that are not present below.\n\nRETRIEVED VISIONEX RECORDS:\n${p.sources || "(none)"}`,

    "Set source_refs to the source_id values of the records you actually used. Use only ids from the list above.",

    p.today ? `TIMING — ${p.today}` : "",
    p.angle ? `Angle for this post: ${p.angle}. Make it specific to the records above, not generic.` : "",
    PLATFORM_FORMAT[p.platform || ""] ?? "",
    p.correction ? `CORRECTION — ${p.correction}` : "",

    "CONFIDENTIALITY — absolute: never name a supplier, a sourcing partner, a source marketplace, or an original product URL. Never mention purchase cost, source price, shipping cost, margin, markup, or any pricing breakdown. Visionex is the storefront the customer sees. Only the customer-facing selling price may ever appear, and only if it is present in the records above.",

    p.memory
      ? `What the owner has taught you so far. Treat this as guidance about tone and topic selection:\n${p.memory}`
      : "",
    p.avoid
      ? `Topics the owner has already rejected. Do NOT propose these again, and do not reword them into a near-identical idea:\n${p.avoid}`
      : "",

    "Visionex serves blind and low-vision users. Write plainly, describe visuals in words, and never rely on an image to carry meaning. `rationale` must explain in one or two sentences why this is worth posting now, referring to the retrieved records.",
    "proposed_publish_at must be a future ISO 8601 timestamp and is a suggestion for the owner, not a commitment.",
    `User's language: ${lang}. Write topic, hook, body, rationale and target_audience entirely in that language.`,
  ].filter(Boolean).join("\n\n");
}

export function buildContentWriterUser(_p: Record<string, string>, lang: string): string {
  return lang === "ar" ? "اقترح محتوى واحداً الآن." : "Draft one content proposal now.";
}
