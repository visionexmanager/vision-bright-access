/**
 * Per-service AI capabilities beyond chat: image analysis (vision) and
 * structured generation (plans/itineraries). The backend registries
 * (visionAnalysts.ts / generators.ts) are the source of truth for prompts and
 * schemas; this file declares which service pages expose which widget and the
 * input fields for generators.
 *
 * Keep ids in sync with the backend registry keys.
 */

import { serviceAssistantId } from "./serviceAssistants";

export interface GeneratorField {
  key: string;
  labelEn: string;
  labelAr: string;
  type: "text" | "textarea" | "select";
  required?: boolean;
  placeholderEn?: string;
  placeholderAr?: string;
  options?: { value: string; labelEn: string; labelAr: string }[];
}

export interface VisionCapability {
  analystId: string;
  /** Helper line shown above the uploader. */
  hintEn: string;
  hintAr: string;
}

export interface GeneratorCapability {
  generatorId: string;
  titleEn: string;
  titleAr: string;
  fields: GeneratorField[];
}

export interface ServiceCapabilities {
  vision?: VisionCapability;
  generator?: GeneratorCapability;
}

const DAYS = ["2", "3", "4", "5", "6"].map((v) => ({ value: v, labelEn: v, labelAr: v }));
const TRIP_DAYS = ["1", "2", "3", "4", "5", "6", "7", "10", "14"].map((v) => ({ value: v, labelEn: v, labelAr: v }));

export const SERVICE_CAPABILITIES: Record<string, ServiceCapabilities> = {
  "skin-care": {
    vision: {
      analystId: "skin-care",
      hintEn: "Upload a clear, well-lit photo of your face/skin for a personalized assessment.",
      hintAr: "ارفع صورة واضحة وجيدة الإضاءة لبشرتك للحصول على تقييم مخصص.",
    },
  },

  "hair-care": {
    vision: {
      analystId: "hair-care",
      hintEn: "Upload a clear photo of your hair and scalp for a personalized assessment.",
      hintAr: "ارفع صورة واضحة لشعرك وفروة رأسك للحصول على تقييم مخصص.",
    },
  },

  "sports-coach": {
    generator: {
      generatorId: "training-plan",
      titleEn: "Generate a Weekly Training Plan",
      titleAr: "أنشئ خطة تدريب أسبوعية",
      fields: [
        {
          key: "goal", type: "select", required: true,
          labelEn: "Goal", labelAr: "الهدف",
          options: [
            { value: "weight loss", labelEn: "Weight loss", labelAr: "إنقاص الوزن" },
            { value: "muscle gain", labelEn: "Muscle gain", labelAr: "بناء العضلات" },
            { value: "endurance", labelEn: "Endurance", labelAr: "التحمّل" },
            { value: "general fitness", labelEn: "General fitness", labelAr: "لياقة عامة" },
          ],
        },
        {
          key: "level", type: "select", required: true,
          labelEn: "Level", labelAr: "المستوى",
          options: [
            { value: "beginner", labelEn: "Beginner", labelAr: "مبتدئ" },
            { value: "intermediate", labelEn: "Intermediate", labelAr: "متوسط" },
            { value: "advanced", labelEn: "Advanced", labelAr: "متقدم" },
          ],
        },
        {
          key: "daysPerWeek", type: "select", required: true,
          labelEn: "Days per week", labelAr: "أيام في الأسبوع",
          options: DAYS,
        },
        {
          key: "equipment", type: "select", required: true,
          labelEn: "Equipment", labelAr: "المعدات",
          options: [
            { value: "bodyweight only", labelEn: "Bodyweight only", labelAr: "وزن الجسم فقط" },
            { value: "dumbbells", labelEn: "Dumbbells", labelAr: "دمبل" },
            { value: "resistance bands", labelEn: "Resistance bands", labelAr: "أحزمة مقاومة" },
            { value: "full gym", labelEn: "Full gym", labelAr: "صالة كاملة" },
          ],
        },
        {
          key: "notes", type: "textarea",
          labelEn: "Notes (optional)", labelAr: "ملاحظات (اختياري)",
          placeholderEn: "Injuries, preferences, time per session…",
          placeholderAr: "إصابات، تفضيلات، مدة كل جلسة…",
        },
      ],
    },
  },

  "travel-agency": {
    generator: {
      generatorId: "travel-itinerary",
      titleEn: "Generate a Travel Itinerary",
      titleAr: "أنشئ برنامج رحلة",
      fields: [
        {
          key: "destination", type: "text", required: true,
          labelEn: "Destination", labelAr: "الوجهة",
          placeholderEn: "e.g. Istanbul, Turkey", placeholderAr: "مثال: إسطنبول، تركيا",
        },
        {
          key: "days", type: "select", required: true,
          labelEn: "Days", labelAr: "عدد الأيام",
          options: TRIP_DAYS,
        },
        {
          key: "budget", type: "select", required: true,
          labelEn: "Budget", labelAr: "الميزانية",
          options: [
            { value: "budget", labelEn: "Budget", labelAr: "اقتصادية" },
            { value: "moderate", labelEn: "Moderate", labelAr: "متوسطة" },
            { value: "luxury", labelEn: "Luxury", labelAr: "فاخرة" },
          ],
        },
        {
          key: "interests", type: "text",
          labelEn: "Interests", labelAr: "الاهتمامات",
          placeholderEn: "e.g. history, food, nature", placeholderAr: "مثال: تاريخ، طعام، طبيعة",
        },
        {
          key: "accessibility", type: "textarea",
          labelEn: "Accessibility needs (optional)", labelAr: "احتياجات الوصول (اختياري)",
          placeholderEn: "e.g. guided services, accessible venues…",
          placeholderAr: "مثال: خدمات مرافقة، أماكن مهيّأة…",
        },
      ],
    },
  },
  "career-hub": {
    generator: {
      generatorId: "career-roadmap",
      titleEn: "Generate a Career Roadmap",
      titleAr: "Generate a Career Roadmap",
      fields: [
        { key: "targetRole", type: "text", required: true, labelEn: "Target role", labelAr: "Target role", placeholderEn: "e.g. Accessibility tester, support specialist", placeholderAr: "e.g. Accessibility tester, support specialist" },
        { key: "experience", type: "select", required: true, labelEn: "Experience", labelAr: "Experience", options: [
          { value: "beginner", labelEn: "Beginner", labelAr: "Beginner" },
          { value: "intermediate", labelEn: "Intermediate", labelAr: "Intermediate" },
          { value: "advanced", labelEn: "Advanced", labelAr: "Advanced" },
        ] },
        { key: "skills", type: "textarea", labelEn: "Current skills", labelAr: "Current skills", placeholderEn: "Tools, languages, certificates...", placeholderAr: "Tools, languages, certificates..." },
        { key: "accessibility", type: "textarea", labelEn: "Accessibility or accommodation needs (optional)", labelAr: "Accessibility or accommodation needs (optional)", placeholderEn: "Screen reader, flexible schedule, mobility needs...", placeholderAr: "Screen reader, flexible schedule, mobility needs..." },
      ],
    },
  },

  "web-design": {
    generator: {
      generatorId: "web-project-brief",
      titleEn: "Generate a Web Project Brief",
      titleAr: "Generate a Web Project Brief",
      fields: [
        { key: "businessType", type: "text", required: true, labelEn: "Business type", labelAr: "Business type", placeholderEn: "e.g. clinic, store, education platform", placeholderAr: "e.g. clinic, store, education platform" },
        { key: "goal", type: "text", required: true, labelEn: "Project goal", labelAr: "Project goal", placeholderEn: "e.g. collect bookings, sell products, teach lessons", placeholderAr: "e.g. collect bookings, sell products, teach lessons" },
        { key: "features", type: "textarea", labelEn: "Pages and features", labelAr: "Pages and features", placeholderEn: "Home, services, checkout, chat, dashboard...", placeholderAr: "Home, services, checkout, chat, dashboard..." },
        { key: "accessibility", type: "textarea", labelEn: "Accessibility priorities", labelAr: "Accessibility priorities", placeholderEn: "Screen reader support, keyboard navigation, captions...", placeholderAr: "Screen reader support, keyboard navigation, captions..." },
      ],
    },
  },

  "digital-marketing": {
    generator: {
      generatorId: "marketing-campaign",
      titleEn: "Generate a Marketing Campaign",
      titleAr: "Generate a Marketing Campaign",
      fields: [
        { key: "offer", type: "text", required: true, labelEn: "Product or service", labelAr: "Product or service", placeholderEn: "What are you promoting?", placeholderAr: "What are you promoting?" },
        { key: "audience", type: "text", required: true, labelEn: "Audience", labelAr: "Audience", placeholderEn: "Who should see this campaign?", placeholderAr: "Who should see this campaign?" },
        { key: "channel", type: "select", required: true, labelEn: "Channel", labelAr: "Channel", options: [
          { value: "social media", labelEn: "Social media", labelAr: "Social media" },
          { value: "email", labelEn: "Email", labelAr: "Email" },
          { value: "search", labelEn: "Search", labelAr: "Search" },
          { value: "multi-channel", labelEn: "Multi-channel", labelAr: "Multi-channel" },
        ] },
        { key: "goal", type: "text", labelEn: "Campaign goal", labelAr: "Campaign goal", placeholderEn: "Awareness, leads, sales, event signups...", placeholderAr: "Awareness, leads, sales, event signups..." },
      ],
    },
  },

  "tech-consulting": {
    generator: {
      generatorId: "tech-troubleshooting-plan",
      titleEn: "Generate a Tech Troubleshooting Plan",
      titleAr: "Generate a Tech Troubleshooting Plan",
      fields: [
        { key: "system", type: "text", required: true, labelEn: "Device or system", labelAr: "Device or system", placeholderEn: "Phone, laptop, app, screen reader...", placeholderAr: "Phone, laptop, app, screen reader..." },
        { key: "problem", type: "textarea", required: true, labelEn: "Problem", labelAr: "Problem", placeholderEn: "Describe what happens and any error message", placeholderAr: "Describe what happens and any error message" },
        { key: "level", type: "select", labelEn: "Technical level", labelAr: "Technical level", options: [
          { value: "beginner", labelEn: "Beginner", labelAr: "Beginner" },
          { value: "intermediate", labelEn: "Intermediate", labelAr: "Intermediate" },
          { value: "advanced", labelEn: "Advanced", labelAr: "Advanced" },
        ] },
        { key: "assistiveTech", type: "text", labelEn: "Assistive technology involved", labelAr: "Assistive technology involved", placeholderEn: "NVDA, JAWS, VoiceOver, Braille display...", placeholderAr: "NVDA, JAWS, VoiceOver, Braille display..." },
      ],
    },
  },

  "professional-training": {
    generator: {
      generatorId: "training-curriculum",
      titleEn: "Generate a Training Curriculum",
      titleAr: "Generate a Training Curriculum",
      fields: [
        { key: "topic", type: "text", required: true, labelEn: "Topic", labelAr: "Topic", placeholderEn: "e.g. Customer support basics", placeholderAr: "e.g. Customer support basics" },
        { key: "audience", type: "text", required: true, labelEn: "Audience", labelAr: "Audience", placeholderEn: "Learners, staff, volunteers...", placeholderAr: "Learners, staff, volunteers..." },
        { key: "duration", type: "text", required: true, labelEn: "Duration", labelAr: "Duration", placeholderEn: "2 hours, 3 days, 6 weeks...", placeholderAr: "2 hours, 3 days, 6 weeks..." },
        { key: "format", type: "select", labelEn: "Delivery format", labelAr: "Delivery format", options: [
          { value: "online", labelEn: "Online", labelAr: "Online" },
          { value: "in person", labelEn: "In person", labelAr: "In person" },
          { value: "blended", labelEn: "Blended", labelAr: "Blended" },
        ] },
        { key: "accessibility", type: "textarea", labelEn: "Accessibility support", labelAr: "Accessibility support", placeholderEn: "Audio materials, captions, tactile examples...", placeholderAr: "Audio materials, captions, tactile examples..." },
      ],
    },
  },

  "import-purchasing": {
    generator: {
      generatorId: "import-sourcing-checklist",
      titleEn: "Generate an Import Sourcing Checklist",
      titleAr: "Generate an Import Sourcing Checklist",
      fields: [
        { key: "product", type: "text", required: true, labelEn: "Product", labelAr: "Product", placeholderEn: "What do you want to source?", placeholderAr: "What do you want to source?" },
        { key: "market", type: "text", required: true, labelEn: "Origin or market", labelAr: "Origin or market", placeholderEn: "China, Turkey, local supplier...", placeholderAr: "China, Turkey, local supplier..." },
        { key: "quantity", type: "text", labelEn: "Quantity", labelAr: "Quantity", placeholderEn: "Sample, 100 units, container...", placeholderAr: "Sample, 100 units, container..." },
        { key: "budget", type: "text", labelEn: "Estimated budget", labelAr: "Estimated budget", placeholderEn: "Approximate budget or price target", placeholderAr: "Approximate budget or price target" },
      ],
    },
  },
};

export function getServiceCapabilities(serviceType: string): ServiceCapabilities | null {
  const id = serviceAssistantId(serviceType);
  return SERVICE_CAPABILITIES[id] ?? null;
}
