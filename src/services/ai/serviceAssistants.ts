/**
 * Frontend list of which service pages expose an AI assistant, plus the
 * display name shown in the widget header. The actual system prompts and
 * provider/model config live server-side in
 * `supabase/functions/_shared/assistants.ts` (the source of truth).
 *
 * Keep the keys here in sync with the registry keys there.
 */

export interface ServiceAssistantMeta {
  /** Display name shown in the assistant header (mirrored from the registry). */
  name: string;
}

export const SERVICE_ASSISTANTS: Record<string, ServiceAssistantMeta> = {
  "legal-advisor": { name: "Legal Advisor AI" },
  "medical-support": { name: "Medical Support AI" },
  "psychology": { name: "Psychology Support AI" },
  "empathy-oasis": { name: "Empathy Oasis AI" },
  "sports-coach": { name: "Sports Coach AI" },
  "skin-care": { name: "Skin Care Expert AI" },
  "hair-care": { name: "Hair Care Expert AI" },
  "travel-agency": { name: "Travel Agency AI" },
  "social-guide": { name: "Social Guide AI" },
  "career-hub": { name: "Career Hub AI" },
  "educational-empire": { name: "Educational Empire AI" },
  "music-conservatory": { name: "Music Conservatory AI" },
  "web-design": { name: "Web Design Consultant AI" },
  "digital-marketing": { name: "Digital Marketing Consultant AI" },
  "tech-consulting": { name: "Tech Consulting AI" },
  "import-purchasing": { name: "Import & Purchasing AI" },
  "professional-training": { name: "Professional Training AI" },
  "global-studio": { name: "Global Studio AI" },
  "bazaar-copilot": { name: "VXBazaar Copilot" },
  "delivery-planner": { name: "Accessible Route Planner AI" },
  "shared-trip-planner": { name: "Shared Trip Planner AI" },
  "business-analyst": { name: "Business Analyst AI" },
  "content-guide": { name: "Content Accessibility AI" },
  "message-assistant": { name: "Message Assistant AI" },
  "media-companion": { name: "Live Media Companion AI" },
  "voice-room-assistant": { name: "Voice Room Assistant AI" },
  "simulation-mentor": { name: "Simulation Mentor AI" },
};

/**
 * Derive an assistant id from a service's `serviceType` label.
 * "Legal Advisor" → "legal-advisor", "Import & Purchasing" → "import-purchasing".
 */
export function serviceAssistantId(serviceType: string): string {
  return serviceType
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Returns the assistant meta for a service type, or null if none is registered. */
export function getServiceAssistant(serviceType: string): { id: string; name: string } | null {
  const id = serviceAssistantId(serviceType);
  const meta = SERVICE_ASSISTANTS[id];
  return meta ? { id, name: meta.name } : null;
}
