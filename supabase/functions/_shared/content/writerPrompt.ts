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
