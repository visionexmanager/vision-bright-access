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
};

export function getServiceCapabilities(serviceType: string): ServiceCapabilities | null {
  const id = serviceAssistantId(serviceType);
  return SERVICE_CAPABILITIES[id] ?? null;
}
