import type { HubAccent, HubDefinition, HubId, Intent, LocalizedText } from "./types";

/**
 * The six hubs. Order matters — this is the order they appear on the Service
 * Center landing page, roughly "build something" → "fix something" → "grow".
 */
export const HUBS: HubDefinition[] = [
  {
    id: "business-lab",
    icon: "Rocket",
    accent: "amber",
    title: { en: "Business & Entrepreneurship Lab", ar: "مختبر المشاريع وريادة الأعمال" },
    promise: {
      en: "Try your business before you risk your money.",
      ar: "جرّب مشروعك قبل أن تخاطر بأموالك.",
    },
    description: {
      en: "Run a real operation end to end — costs, margins, staffing and risk — and leave with a feasibility study you can act on.",
      ar: "أدر مشروعاً كاملاً من البداية للنهاية — التكاليف والأرباح والفريق والمخاطر — واخرج بدراسة جدوى قابلة للتنفيذ.",
    },
  },
  {
    id: "tech-repair",
    icon: "Wrench",
    accent: "cyan",
    title: { en: "Technology & Repair Center", ar: "مركز التقنية والصيانة" },
    promise: {
      en: "Describe the fault. Diagnose it. Fix it.",
      ar: "صف العطل. شخّصه. أصلحه.",
    },
    description: {
      en: "Work the way a real technician does: symptoms in, structured diagnosis out, then a guided repair with the right tools.",
      ar: "اعمل كما يعمل الفني المحترف: تبدأ بالأعراض، وتصل إلى تشخيص منظم، ثم إصلاح موجّه بالأدوات الصحيحة.",
    },
  },
  {
    id: "engineering",
    icon: "Factory",
    accent: "sky",
    title: { en: "Visionex Engineering Lab", ar: "مختبر فيجن إكس الهندسي" },
    promise: {
      en: "Design, size and operate real systems.",
      ar: "صمّم وحدّد المقاسات وشغّل أنظمة حقيقية.",
    },
    description: {
      en: "Solar arrays, HVAC loads, façades, fleets and vessels — engineering decisions with numbers behind them.",
      ar: "أنظمة شمسية وأحمال تكييف وواجهات وأساطيل وسفن — قرارات هندسية مبنية على أرقام.",
    },
  },
  {
    id: "personal-growth",
    icon: "Sparkles",
    accent: "emerald",
    title: { en: "Personal Development", ar: "التطوير الشخصي" },
    promise: {
      en: "A coach for the skill you are building.",
      ar: "مدرب شخصي للمهارة التي تبنيها.",
    },
    description: {
      en: "Language, music, fitness, nutrition and mental wellbeing — each with an AI coach that tracks where you actually are.",
      ar: "اللغة والموسيقى واللياقة والتغذية والصحة النفسية — لكل منها مدرب ذكي يتابع مستواك الحقيقي.",
    },
  },
  {
    id: "creative-studio",
    icon: "Clapperboard",
    accent: "violet",
    title: { en: "Creative Studio", ar: "الاستوديو الإبداعي" },
    promise: {
      en: "Produce work you can publish.",
      ar: "أنتج عملاً جاهزاً للنشر.",
    },
    description: {
      en: "Images, voice, video, documents and broadcast — production tools plus the creative direction to use them well.",
      ar: "صور وصوت وفيديو ومستندات وبث — أدوات إنتاج مع التوجيه الإبداعي لاستخدامها باحتراف.",
    },
  },
  {
    id: "marketplace",
    icon: "Briefcase",
    accent: "rose",
    title: { en: "Professional Services Marketplace", ar: "سوق الخدمات الاحترافية" },
    promise: {
      en: "Request it, track it, rate it.",
      ar: "اطلبها، تابعها، قيّمها.",
    },
    description: {
      en: "Real work delivered by the Visionex team — with an order you can follow and a record you keep.",
      ar: "خدمات حقيقية ينفذها فريق فيجن إكس — بطلب يمكنك متابعته وسجل تحتفظ به.",
    },
  },
];

export const HUB_IDS: HubId[] = HUBS.map((hub) => hub.id);

const HUB_BY_ID = new Map<HubId, HubDefinition>(HUBS.map((hub) => [hub.id, hub]));

export function getHub(id: HubId): HubDefinition | undefined {
  return HUB_BY_ID.get(id);
}

/**
 * Tailwind class fragments per accent. Written out in full because Tailwind's
 * scanner cannot see dynamically built class names.
 */
export const HUB_ACCENT_CLASSES: Record<
  HubAccent,
  { chip: string; text: string; border: string; ring: string; gradient: string; solid: string }
> = {
  amber: {
    chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/25",
    ring: "focus-visible:ring-amber-500",
    gradient: "from-amber-600 via-amber-500 to-orange-400",
    solid: "bg-amber-600 hover:bg-amber-500",
  },
  cyan: {
    chip: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    text: "text-cyan-600 dark:text-cyan-400",
    border: "border-cyan-500/25",
    ring: "focus-visible:ring-cyan-500",
    gradient: "from-cyan-700 via-cyan-500 to-teal-400",
    solid: "bg-cyan-600 hover:bg-cyan-500",
  },
  sky: {
    chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    text: "text-sky-600 dark:text-sky-400",
    border: "border-sky-500/25",
    ring: "focus-visible:ring-sky-500",
    gradient: "from-sky-700 via-sky-500 to-blue-400",
    solid: "bg-sky-600 hover:bg-sky-500",
  },
  emerald: {
    chip: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25",
    ring: "focus-visible:ring-emerald-500",
    gradient: "from-emerald-700 via-emerald-500 to-green-400",
    solid: "bg-emerald-600 hover:bg-emerald-500",
  },
  violet: {
    chip: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
    border: "border-violet-500/25",
    ring: "focus-visible:ring-violet-500",
    gradient: "from-violet-700 via-violet-500 to-purple-400",
    solid: "bg-violet-600 hover:bg-violet-500",
  },
  rose: {
    chip: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/25",
    ring: "focus-visible:ring-rose-500",
    gradient: "from-rose-700 via-rose-500 to-pink-400",
    solid: "bg-rose-600 hover:bg-rose-500",
  },
};

/** The six questions the Navigator opens with, in intent order. */
export const INTENTS: { id: Intent; label: LocalizedText; icon: string; hint: LocalizedText }[] = [
  {
    id: "start-a-business",
    icon: "Rocket",
    label: { en: "I want to start a business", ar: "أريد أن أبدأ مشروعاً" },
    hint: { en: "Test the numbers before you commit", ar: "اختبر الأرقام قبل أن تلتزم" },
  },
  {
    id: "learn-a-skill",
    icon: "GraduationCap",
    label: { en: "I want to learn a skill", ar: "أريد تعلّم مهارة" },
    hint: { en: "Guided practice with real feedback", ar: "تدريب موجّه مع تقييم حقيقي" },
  },
  {
    id: "fix-a-device",
    icon: "Wrench",
    label: { en: "I need to fix something", ar: "أحتاج إصلاح شيء ما" },
    hint: { en: "Diagnose the fault step by step", ar: "شخّص العطل خطوة بخطوة" },
  },
  {
    id: "grow-my-work",
    icon: "TrendingUp",
    label: { en: "I want to grow my work", ar: "أريد تطوير عملي" },
    hint: { en: "Marketing, systems and delivery", ar: "التسويق والأنظمة والتنفيذ" },
  },
  {
    id: "care-for-myself",
    icon: "HeartPulse",
    label: { en: "I want to look after myself", ar: "أريد الاهتمام بنفسي" },
    hint: { en: "Health, fitness and wellbeing", ar: "الصحة واللياقة والعافية" },
  },
  {
    id: "create-something",
    icon: "Palette",
    label: { en: "I want to create something", ar: "أريد إنتاج شيء ما" },
    hint: { en: "Images, audio, video and copy", ar: "صور وصوت وفيديو ومحتوى" },
  },
];
