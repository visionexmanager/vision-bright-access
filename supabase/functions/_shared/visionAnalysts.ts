// Vision Analyst Registry — image → structured assessment.
//
// Each analyst returns the SAME universal schema (VISION_SCHEMA) so a single
// frontend renderer handles all of them. Add an analyst by adding an entry.

import type { AIProvider } from "./aiProvider.ts";

export interface VisionAnalyst {
  id: string;
  name: string;
  provider: AIProvider;
  model: string;
  systemPrompt: string;
}

// Universal result schema returned by every analyst.
export const VISION_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One or two sentences summarizing the assessment." },
    findings: {
      type: "array",
      description: "Specific observations from the image.",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          detail: { type: "string" },
        },
        required: ["label", "detail"],
        additionalProperties: false,
      },
    },
    recommendations: {
      type: "array",
      description: "Practical, prioritized recommendations.",
      items: { type: "string" },
    },
    caution: { type: "string", description: "A short safety / when-to-see-a-professional note." },
  },
  required: ["summary", "findings", "recommendations", "caution"],
  additionalProperties: false,
} as const;

const DEFAULT_PROVIDER: AIProvider = "openai";
const DEFAULT_MODEL = "gpt-4o"; // vision-capable

const LANG_NOTE =
  "VisionEx serves blind and low-vision users — keep language clear and descriptive. " +
  "Write every field value entirely in the user's language.";

function analyst(id: string, name: string, role: string, focus: string, caution: string): VisionAnalyst {
  return {
    id,
    name,
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    systemPrompt: [
      `You are ${role}.`,
      `Analyze the uploaded photo and return a structured, practical assessment. ${focus}`,
      "Be specific and constructive. Populate `findings` with concrete observations, `recommendations` with prioritized next steps, and `caution` with a brief safety note.",
      caution,
      LANG_NOTE,
    ].join("\n\n"),
  };
}

export const VISION_ANALYSTS: Record<string, VisionAnalyst> = {
  "skin-care": analyst(
    "skin-care",
    "Skin Care Photo Analysis",
    "the VisionEx Skin Care Expert AI analyzing a photo of a person's face or skin",
    "Identify the apparent skin type and visible concerns (dryness, oiliness, redness, acne, texture, pores, signs of sun damage), and recommend a suitable routine and helpful ingredients.",
    "Note that this is general cosmetic guidance, not medical dermatology, and persistent or severe conditions should be seen by a dermatologist.",
  ),

  "hair-care": analyst(
    "hair-care",
    "Hair Care Photo Analysis",
    "the VisionEx Hair Care Expert AI analyzing a photo of a person's hair and scalp",
    "Identify the apparent hair type, texture, and visible concerns (dryness, frizz, breakage, scalp condition, density), and recommend a suitable routine, products, and styling care.",
    "Note that this is general cosmetic guidance; hair loss, scalp disease, or medical concerns should be seen by a dermatologist or trichologist.",
  ),
};

export function getVisionAnalyst(id: string | undefined | null): VisionAnalyst | null {
  if (!id) return null;
  return VISION_ANALYSTS[id] ?? null;
}
