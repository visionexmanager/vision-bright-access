// Structured Generator Registry — params → structured plan (JSON).
//
// Every generator returns the SAME universal schema (GENERATION_SCHEMA), so one
// frontend renderer handles training plans, travel itineraries, and any future
// generator. Add one by adding an entry with a `buildSystem(params, lang)`.

import type { AIProvider } from "./aiProvider.ts";

export interface Generator {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  /** Build the system prompt from user-supplied params + language. */
  buildSystem: (params: Record<string, string>, lang: string) => string;
  /** Build the short user instruction (kept generic). */
  buildUser: (params: Record<string, string>, lang: string) => string;
}

// Universal result schema returned by every generator.
export const GENERATION_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    summary: { type: "string", description: "Short overview of the plan." },
    sections: {
      type: "array",
      description: "Ordered sections — e.g. one per day or per phase.",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          items: { type: "array", items: { type: "string" } },
        },
        required: ["heading", "items"],
        additionalProperties: false,
      },
    },
    tips: { type: "array", items: { type: "string" }, description: "Practical tips / safety notes." },
  },
  required: ["title", "summary", "sections", "tips"],
  additionalProperties: false,
} as const;

const DEFAULT_PROVIDER: AIProvider = "openai";
const DEFAULT_MODEL = "gpt-4o";

const LANG_NOTE =
  "VisionEx serves blind and low-vision users — keep language clear. " +
  "Write every field value entirely in the user's language.";

export const GENERATORS: Record<string, Generator> = {
  "training-plan": {
    id: "training-plan",
    name: "Training Plan Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Sports Coach AI, a certified personal trainer.",
        `Create a safe, effective weekly training plan for this person — goal: ${p.goal || "general fitness"}, level: ${p.level || "beginner"}, days per week: ${p.daysPerWeek || "3"}, available equipment: ${p.equipment || "bodyweight only"}.${p.notes ? ` Extra notes: ${p.notes}.` : ""}`,
        "Each `sections` entry is ONE training day: `heading` like 'Day 1 — Full Body' and `items` listing exercises with sets x reps (include a warm-up and cool-down). Use `tips` for progression, recovery, and safety. Offer accessible options suitable for visually impaired users where relevant.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: (_p, lang) => (lang === "ar" ? "أنشئ خطة التدريب الأسبوعية." : "Generate my weekly training plan."),
  },

  "content-summary": {
    id: "content-summary",
    name: "Summarizer",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (_p, lang) =>
      [
        "You are a precise summarization assistant for the VisionEx platform (news, articles, lessons).",
        "Summarize the provided text. `title` = a short headline; `summary` = a 2–3 sentence abstract; each `sections` entry groups related key points (`heading` + bulleted `items`); `tips` = the most important takeaways or action items.",
        "Be faithful to the source — do not invent facts.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: (p, lang) =>
      `${lang === "ar" ? "لخّص النص التالي:" : "Summarize the following text:"}\n\n${(p.text || "").slice(0, 12000)}`,
  },

  "travel-itinerary": {
    id: "travel-itinerary",
    name: "Travel Itinerary Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Travel Agency AI, an expert travel planner.",
        `Create a day-by-day itinerary — destination: ${p.destination || "(unspecified)"}, duration: ${p.days || "3"} days, budget level: ${p.budget || "moderate"}, interests: ${p.interests || "general sightseeing"}.${p.accessibility ? ` Accessibility needs: ${p.accessibility}.` : ""}`,
        "Each `sections` entry is ONE day: `heading` like 'Day 1 — Old Town' and `items` listing timed activities (morning/afternoon/evening) with brief notes. Use `tips` for budgeting, transport, and especially accessibility for blind / low-vision travelers (guided services, accessible venues, airport assistance).",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: (_p, lang) => (lang === "ar" ? "أنشئ برنامج الرحلة." : "Generate my travel itinerary."),
  },
  "career-roadmap": {
    id: "career-roadmap",
    name: "Career Roadmap Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Career Hub AI, a practical career coach for blind and low-vision professionals.",
        `Create a career roadmap for target role: ${p.targetRole || "(unspecified)"}, experience: ${p.experience || "beginner"}.${p.skills ? ` Current skills: ${p.skills}.` : ""}${p.accessibility ? ` Accessibility/accommodation needs: ${p.accessibility}.` : ""}`,
        "Use `sections` for phases such as foundation, portfolio, applications, interviews, and first 90 days. Include concrete actions, accessible tools, and realistic milestones. Use `tips` for confidence, safety, accommodations, and follow-through.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: () => "Create my career roadmap.",
  },

  "web-project-brief": {
    id: "web-project-brief",
    name: "Web Project Brief Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Web Design Consultant AI, an accessible product strategist.",
        `Create a website or app project brief. Business/type: ${p.businessType || "(unspecified)"}, goal: ${p.goal || "(unspecified)"}, requested pages/features: ${p.features || "(unspecified)"}.${p.accessibility ? ` Accessibility priorities: ${p.accessibility}.` : ""}`,
        "Use `sections` for audience, core pages/features, accessibility requirements, content needs, launch checklist, and risks. Keep recommendations practical for a small team.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: () => "Generate the accessible web project brief.",
  },

  "marketing-campaign": {
    id: "marketing-campaign",
    name: "Marketing Campaign Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Digital Marketing Consultant AI, focused on ethical and accessible campaigns.",
        `Create a campaign plan for offer: ${p.offer || "(unspecified)"}, audience: ${p.audience || "(unspecified)"}, channel: ${p.channel || "multi-channel"}, goal: ${p.goal || "(unspecified)"}.`,
        "Use `sections` for positioning, audience message, channel plan, accessible creative, schedule, and measurement. Avoid manipulative claims. Include inclusive copy ideas and alt-text guidance where relevant.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: () => "Generate the marketing campaign plan.",
  },

  "tech-troubleshooting-plan": {
    id: "tech-troubleshooting-plan",
    name: "Tech Troubleshooting Plan Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Tech Consulting AI, a careful troubleshooting assistant.",
        `Create a troubleshooting plan. System/device: ${p.system || "(unspecified)"}, problem: ${p.problem || "(unspecified)"}, user level: ${p.level || "beginner"}.${p.assistiveTech ? ` Assistive technology involved: ${p.assistiveTech}.` : ""}`,
        "Use `sections` for quick checks, diagnosis steps, fixes to try, escalation info, and prevention. Keep steps safe, reversible, and accessible for screen reader users.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: () => "Generate the troubleshooting plan.",
  },

  "training-curriculum": {
    id: "training-curriculum",
    name: "Professional Training Curriculum Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Professional Training AI, an instructional designer.",
        `Create a training curriculum. Topic: ${p.topic || "(unspecified)"}, audience: ${p.audience || "(unspecified)"}, duration: ${p.duration || "(unspecified)"}, delivery format: ${p.format || "online"}.${p.accessibility ? ` Accessibility needs: ${p.accessibility}.` : ""}`,
        "Use `sections` for modules or sessions, learning objectives, activities, assessment, materials, and accessibility support. Make it usable for trainers and learners.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: () => "Generate the training curriculum.",
  },

  "import-sourcing-checklist": {
    id: "import-sourcing-checklist",
    name: "Import Sourcing Checklist Generator",
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    buildSystem: (p, lang) =>
      [
        "You are the VisionEx Import & Purchasing AI, a cautious sourcing advisor.",
        `Create a sourcing checklist. Product: ${p.product || "(unspecified)"}, origin/market: ${p.market || "(unspecified)"}, quantity: ${p.quantity || "(unspecified)"}, budget: ${p.budget || "(unspecified)"}.`,
        "Use `sections` for requirements, supplier vetting, samples, pricing, logistics, compliance, payment safety, and red flags. Do not give legal advice; encourage checking local rules and trusted professionals.",
        `User's language: ${lang}.`,
        LANG_NOTE,
      ].join("\n\n"),
    buildUser: () => "Generate the import and sourcing checklist.",
  },
};

export function getGenerator(id: string | undefined | null): Generator | null {
  if (!id) return null;
  return GENERATORS[id] ?? null;
}
