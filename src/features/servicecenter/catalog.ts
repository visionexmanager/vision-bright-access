import { simulationImages } from "@/data/simulationImages";
import consultingImg from "@/assets/service-consulting.jpg";
import trainingImg from "@/assets/service-training.jpg";
import importImg from "@/assets/service-import.jpg";
import digitalMarketingImg from "@/assets/service-digital-marketing.jpg";
import webDesignImg from "@/assets/service-web-design.jpg";
import careerImg from "@/assets/service-career.jpg";
import studioImg from "@/assets/service-studio.jpg";
import musicImg from "@/assets/service-music.jpg";
import type { Difficulty, HubId, Intent, ServiceEntry } from "./types";

/**
 * The Service Center catalog — every experience, advisor, tool and service in
 * one typed list.
 *
 * Feasibility figures are illustrative planning estimates for a small
 * owner-operated venture, not market research. They exist so the learner sees
 * the *shape* of a business (capital, burn, ramp, break-even) and can replace
 * each number with their own. Every consumer of them must label them as
 * estimates — see `feasibility.ts`.
 */

const img = (slug: string) => simulationImages[slug];

/** Identity helper so each literal is checked against ServiceEntry as written. */
const entry = (data: ServiceEntry): ServiceEntry => data;

// ── Hub 1: Business & Entrepreneurship Lab ────────────────────────────
const BUSINESS_LAB: ServiceEntry[] = [
  entry({
    slug: "egg-incubator",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/egg-incubator",
    image: img("egg-incubator"),
    title: { en: "Hatchery Operation", ar: "تشغيل مفرخة" },
    tagline: {
      en: "Run a 21-day incubation cycle and learn what a hatchery really costs.",
      ar: "أدر دورة تحضين من 21 يوماً واعرف التكلفة الحقيقية لمفرخة.",
    },
    difficulty: "starter",
    durationMinutes: 30,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "learn-a-skill"],
    keywords: {
      en: ["eggs", "hatchery", "incubator", "poultry", "agriculture", "farming"],
      ar: ["بيض", "مفرخة", "حاضنة", "دواجن", "زراعة", "تربية"],
    },
    outcomes: {
      en: [
        "Hold temperature and humidity inside a tight tolerance for a full cycle",
        "Read a hatch-rate report and explain what caused every loss",
        "Price a batch and work out the margin per hatched chick",
      ],
      ar: [
        "ضبط الحرارة والرطوبة ضمن هامش دقيق طوال الدورة",
        "قراءة تقرير نسبة الفقس وتفسير سبب كل خسارة",
        "تسعير الدفعة وحساب هامش الربح لكل كتكوت",
      ],
    },
    skills: {
      en: ["Process control", "Agricultural operations", "Unit economics"],
      ar: ["ضبط العمليات", "التشغيل الزراعي", "اقتصاديات الوحدة"],
    },
    persona: { id: "agronomist", role: { en: "AI Agronomist", ar: "مهندس زراعي ذكي" } },
    audio: { ambience: "farm-barn", cues: ["alarm-temp", "incubator-hum", "hatch-chirp"] },
    feasibility: {
      startupCostUsd: 3_200,
      monthlyCostUsd: 640,
      monthlyRevenueUsd: 1_450,
      rampUpMonths: 3,
      volatility: 3,
      revenueModel: {
        en: "Day-old chicks sold per batch to local farms and retail buyers.",
        ar: "بيع الكتاكيت عمر يوم لكل دفعة للمزارع المحلية وتجار التجزئة.",
      },
      risks: {
        en: [
          "A single power outage can destroy an entire batch",
          "Fertility of purchased eggs varies by supplier",
          "Disease outbreaks force a full sanitation shutdown",
        ],
        ar: [
          "انقطاع كهرباء واحد قد يتلف الدفعة بالكامل",
          "خصوبة البيض المشترى تتفاوت حسب المورد",
          "تفشي الأمراض يفرض إيقافاً كاملاً للتعقيم",
        ],
      },
    },
    featured: true,
  }),
  entry({
    slug: "dairy-farm",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/dairy-farm",
    image: img("dairy-farm"),
    title: { en: "Dairy Farm Operation", ar: "تشغيل مزرعة ألبان" },
    tagline: {
      en: "Feeding, milking and herd health — balanced against the milk cheque.",
      ar: "التغذية والحلب وصحة القطيع — موازنة مقابل عائد الحليب.",
    },
    difficulty: "intermediate",
    durationMinutes: 35,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "learn-a-skill"],
    keywords: {
      en: ["dairy", "milk", "cows", "herd", "farm", "livestock"],
      ar: ["ألبان", "حليب", "أبقار", "قطيع", "مزرعة", "ماشية"],
    },
    outcomes: {
      en: [
        "Build a feed plan that holds yield without wrecking the margin",
        "Spot mastitis and lameness early from the herd dashboard",
        "Calculate cost per litre and defend your milk price",
      ],
      ar: [
        "بناء خطة تغذية تحافظ على الإنتاج دون تدمير الهامش",
        "اكتشاف التهاب الضرع والعرج مبكراً من لوحة القطيع",
        "حساب تكلفة اللتر والدفاع عن سعر الحليب",
      ],
    },
    skills: {
      en: ["Herd management", "Cost control", "Production planning"],
      ar: ["إدارة القطيع", "ضبط التكاليف", "تخطيط الإنتاج"],
    },
    persona: { id: "agronomist", role: { en: "AI Livestock Advisor", ar: "مستشار ثروة حيوانية ذكي" } },
    audio: { ambience: "farm-barn", cues: ["milking-machine", "cattle-low", "alarm-temp"] },
    feasibility: {
      startupCostUsd: 24_000,
      monthlyCostUsd: 4_100,
      monthlyRevenueUsd: 6_800,
      rampUpMonths: 6,
      volatility: 3,
      revenueModel: {
        en: "Daily raw milk volume sold to processors, plus surplus calves.",
        ar: "بيع كمية الحليب الخام يومياً للمصانع، إضافة إلى فائض العجول.",
      },
      risks: {
        en: [
          "Feed price swings hit margin faster than milk price rises",
          "One sick animal can halve a day's yield",
          "Milk is perishable — a cold-chain failure is a total loss",
        ],
        ar: [
          "تقلب أسعار العلف يضرب الهامش أسرع من ارتفاع سعر الحليب",
          "حيوان مريض واحد قد يخفض إنتاج اليوم للنصف",
          "الحليب سريع التلف — أي عطل في التبريد خسارة كاملة",
        ],
      },
    },
  }),
  entry({
    slug: "poultry-farm",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/poultry-farm",
    image: img("poultry-farm"),
    title: { en: "Poultry Farm Operation", ar: "تشغيل مزرعة دواجن" },
    tagline: {
      en: "Feed conversion, flock health and the tight margin between them.",
      ar: "معامل التحويل الغذائي وصحة القطيع والهامش الضيق بينهما.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business"],
    keywords: {
      en: ["poultry", "chicken", "broiler", "farm", "feed"],
      ar: ["دواجن", "دجاج", "لاحم", "مزرعة", "علف"],
    },
    outcomes: {
      en: [
        "Run a full grow-out cycle to target weight",
        "Use feed conversion ratio as your primary control lever",
        "Model mortality into your break-even, not around it",
      ],
      ar: [
        "إدارة دورة تسمين كاملة حتى الوزن المستهدف",
        "استخدام معامل التحويل الغذائي كأداة التحكم الأساسية",
        "إدخال نسبة النفوق ضمن نقطة التعادل لا خارجها",
      ],
    },
    skills: {
      en: ["Flock management", "Biosecurity", "Yield optimisation"],
      ar: ["إدارة القطيع", "الأمن الحيوي", "تحسين الإنتاجية"],
    },
    persona: { id: "agronomist", role: { en: "AI Poultry Specialist", ar: "أخصائي دواجن ذكي" } },
    audio: { ambience: "farm-barn", cues: ["poultry-flock", "feeder-run", "alarm-temp"] },
    feasibility: {
      startupCostUsd: 9_500,
      monthlyCostUsd: 3_400,
      monthlyRevenueUsd: 5_200,
      rampUpMonths: 2,
      volatility: 4,
      revenueModel: {
        en: "Live or dressed birds sold per cycle, roughly six cycles a year.",
        ar: "بيع الطيور حية أو مذبوحة لكل دورة، بمعدل ست دورات سنوياً.",
      },
      risks: {
        en: [
          "Feed is 65–70% of cost and its price is out of your control",
          "Avian disease can force a total cull",
          "Market gluts collapse the sale price mid-cycle",
        ],
        ar: [
          "العلف يمثل 65–70% من التكلفة وسعره خارج سيطرتك",
          "أمراض الطيور قد تفرض إعداماً كاملاً",
          "تخمة السوق تُسقط سعر البيع في منتصف الدورة",
        ],
      },
    },
  }),
  entry({
    slug: "cattle-dairy",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/cattle-dairy",
    image: img("cattle-dairy"),
    title: { en: "Cattle & Pasture Business", ar: "مشروع الماشية والمراعي" },
    tagline: {
      en: "Pasture, breeding and output planned across a whole season.",
      ar: "المراعي والتربية والإنتاج مخططة عبر موسم كامل.",
    },
    difficulty: "advanced",
    durationMinutes: 40,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business"],
    keywords: {
      en: ["cattle", "beef", "pasture", "breeding", "livestock"],
      ar: ["ماشية", "لحوم", "مراعي", "تربية", "ثروة حيوانية"],
    },
    outcomes: {
      en: [
        "Match stocking rate to what your land can actually carry",
        "Plan a breeding calendar around feed availability",
        "Decide when selling early beats holding for weight",
      ],
      ar: [
        "مطابقة كثافة القطيع مع ما تتحمله أرضك فعلياً",
        "تخطيط تقويم التربية حسب توفر العلف",
        "تحديد متى يكون البيع المبكر أفضل من الانتظار للوزن",
      ],
    },
    skills: {
      en: ["Pasture planning", "Breeding strategy", "Capital cycle management"],
      ar: ["تخطيط المراعي", "استراتيجية التربية", "إدارة الدورة الرأسمالية"],
    },
    persona: { id: "agronomist", role: { en: "AI Livestock Advisor", ar: "مستشار ثروة حيوانية ذكي" } },
    audio: { ambience: "farm-field", cues: ["cattle-low", "gate-latch", "weather-wind"] },
    feasibility: {
      startupCostUsd: 42_000,
      monthlyCostUsd: 3_900,
      monthlyRevenueUsd: 6_100,
      rampUpMonths: 12,
      volatility: 4,
      revenueModel: {
        en: "Weaned and finished animals sold at seasonal market weight.",
        ar: "بيع الحيوانات بعد الفطام والتسمين بوزن السوق الموسمي.",
      },
      risks: {
        en: [
          "Capital is locked in living inventory for a year or more",
          "Drought removes your cheapest feed source overnight",
          "Livestock prices are cyclical and hard to time",
        ],
        ar: [
          "رأس المال محتجز في مخزون حي لعام أو أكثر",
          "الجفاف يزيل أرخص مصادر العلف بين ليلة وضحاها",
          "أسعار المواشي دورية ويصعب توقيتها",
        ],
      },
    },
  }),
  entry({
    slug: "sheep-farm",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/sheep-farm",
    image: img("sheep-farm"),
    title: { en: "Sheep Season Management", ar: "إدارة موسم الأغنام" },
    tagline: {
      en: "Lambing, shearing and sales across one full season.",
      ar: "الولادة والجز والبيع عبر موسم كامل.",
    },
    difficulty: "intermediate",
    durationMinutes: 35,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business"],
    keywords: {
      en: ["sheep", "lamb", "wool", "shearing", "livestock"],
      ar: ["أغنام", "حملان", "صوف", "جز", "ثروة حيوانية"],
    },
    outcomes: {
      en: [
        "Run a lambing season and protect the lambing percentage",
        "Time shearing and sales against seasonal price peaks",
        "Separate the wool income from the meat income in your plan",
      ],
      ar: [
        "إدارة موسم ولادة وحماية نسبة الولادات",
        "توقيت الجز والبيع مع ذروة الأسعار الموسمية",
        "فصل دخل الصوف عن دخل اللحم في خطتك",
      ],
    },
    skills: {
      en: ["Seasonal planning", "Animal husbandry", "Market timing"],
      ar: ["التخطيط الموسمي", "رعاية الحيوان", "توقيت السوق"],
    },
    persona: { id: "agronomist", role: { en: "AI Livestock Advisor", ar: "مستشار ثروة حيوانية ذكي" } },
    audio: { ambience: "farm-field", cues: ["sheep-flock", "shears", "weather-wind"] },
    feasibility: {
      startupCostUsd: 16_000,
      monthlyCostUsd: 1_700,
      monthlyRevenueUsd: 2_900,
      rampUpMonths: 8,
      volatility: 3,
      revenueModel: {
        en: "Lambs sold at market weight, with wool as a secondary line.",
        ar: "بيع الحملان بوزن السوق، مع الصوف كمصدر دخل ثانوي.",
      },
      risks: {
        en: [
          "Income is lumpy — most of it lands in a few weeks",
          "Predators and parasites hit the lambing percentage hard",
          "Wool prices have collapsed in some markets",
        ],
        ar: [
          "الدخل متقطع — معظمه يتحقق في أسابيع قليلة",
          "الحيوانات المفترسة والطفيليات تضرب نسبة الولادات بشدة",
          "أسعار الصوف انهارت في بعض الأسواق",
        ],
      },
    },
  }),
  entry({
    slug: "perfume-lab",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/perfume-lab",
    image: img("perfume-lab"),
    title: { en: "Perfume Formulation Lab", ar: "مختبر تركيب العطور" },
    tagline: {
      en: "Blend a signature fragrance and cost it as a product line.",
      ar: "اصنع عطراً مميزاً واحسب تكلفته كخط إنتاج.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "create-something"],
    keywords: {
      en: ["perfume", "fragrance", "formulation", "cosmetics", "notes"],
      ar: ["عطر", "عطور", "تركيب", "تجميل", "روائح"],
    },
    outcomes: {
      en: [
        "Build a top/heart/base structure that holds on skin",
        "Run stability and quality checks before you scale a batch",
        "Cost a 50ml bottle from raw material to packaging",
      ],
      ar: [
        "بناء هرم عطري (قمة/قلب/قاعدة) يثبت على البشرة",
        "إجراء اختبارات الثبات والجودة قبل توسيع الدفعة",
        "حساب تكلفة عبوة 50 مل من الخامة حتى التغليف",
      ],
    },
    skills: {
      en: ["Formulation", "Quality control", "Product costing"],
      ar: ["التركيب", "ضبط الجودة", "تسعير المنتج"],
    },
    persona: { id: "lab-chemist", role: { en: "AI Formulation Chemist", ar: "كيميائي تركيب ذكي" } },
    audio: { ambience: "lab-clean", cues: ["glass-clink", "scale-beep", "mixer-run"] },
    feasibility: {
      startupCostUsd: 6_500,
      monthlyCostUsd: 1_900,
      monthlyRevenueUsd: 4_400,
      rampUpMonths: 4,
      volatility: 3,
      revenueModel: {
        en: "Bottled fragrances sold direct and through boutique retail.",
        ar: "بيع العطور المعبأة مباشرة وعبر متاجر التجزئة المتخصصة.",
      },
      risks: {
        en: [
          "Premium raw materials are priced in hard currency",
          "Cosmetic labelling and safety rules differ per market",
          "Brand-building is the real cost, not the liquid",
        ],
        ar: [
          "الخامات الفاخرة مسعّرة بالعملة الصعبة",
          "قواعد ملصقات وسلامة مستحضرات التجميل تختلف بين الأسواق",
          "بناء العلامة التجارية هو التكلفة الحقيقية وليس السائل",
        ],
      },
    },
    featured: true,
  }),
  entry({
    slug: "detergent-lab",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/detergent-lab",
    image: img("detergent-lab"),
    title: { en: "Detergent Production Lab", ar: "مختبر إنتاج المنظفات" },
    tagline: {
      en: "Formulate cleaning products that work and still make money.",
      ar: "صمّم منتجات تنظيف فعّالة وتحقق ربحاً في الوقت نفسه.",
    },
    difficulty: "starter",
    durationMinutes: 25,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business"],
    keywords: {
      en: ["detergent", "cleaning", "chemicals", "manufacturing", "soap"],
      ar: ["منظفات", "تنظيف", "كيماويات", "تصنيع", "صابون"],
    },
    outcomes: {
      en: [
        "Balance surfactant load against cost per litre",
        "Handle and label chemicals to a safe standard",
        "Build a product ladder from economy to premium",
      ],
      ar: [
        "موازنة نسبة المواد الفعالة مقابل تكلفة اللتر",
        "التعامل مع المواد الكيميائية ووسمها بمعيار آمن",
        "بناء سلم منتجات من الاقتصادي إلى الفاخر",
      ],
    },
    skills: {
      en: ["Formulation", "Chemical safety", "Margin engineering"],
      ar: ["التركيب", "السلامة الكيميائية", "هندسة الهامش"],
    },
    persona: { id: "lab-chemist", role: { en: "AI Formulation Chemist", ar: "كيميائي تركيب ذكي" } },
    audio: { ambience: "lab-industrial", cues: ["mixer-run", "pump-flow", "scale-beep"] },
    feasibility: {
      startupCostUsd: 4_800,
      monthlyCostUsd: 2_600,
      monthlyRevenueUsd: 4_300,
      rampUpMonths: 3,
      volatility: 2,
      revenueModel: {
        en: "Bulk and bottled cleaning products sold to shops and contractors.",
        ar: "بيع منتجات التنظيف بالجملة والمعبأة للمحلات والمقاولين.",
      },
      risks: {
        en: [
          "Competing on price against industrial-scale brands",
          "Chemical storage and disposal are regulated",
          "Thin margins punish every formulation mistake",
        ],
        ar: [
          "المنافسة السعرية أمام علامات صناعية ضخمة",
          "تخزين المواد الكيميائية والتخلص منها خاضعان للتنظيم",
          "الهوامش الضيقة تعاقب كل خطأ في التركيبة",
        ],
      },
    },
  }),
  entry({
    slug: "skin-care-lab",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/skin-care-lab",
    image: img("skin-care-lab"),
    title: { en: "Skincare Product Lab", ar: "مختبر منتجات العناية بالبشرة" },
    tagline: {
      en: "Create safe formulas and test them as a real product decision.",
      ar: "طوّر تركيبات آمنة واختبرها كقرار منتج حقيقي.",
    },
    difficulty: "advanced",
    durationMinutes: 35,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "create-something"],
    keywords: {
      en: ["skincare", "cosmetics", "cream", "serum", "formulation"],
      ar: ["عناية بالبشرة", "تجميل", "كريم", "سيروم", "تركيب"],
    },
    outcomes: {
      en: [
        "Design an emulsion that stays stable on the shelf",
        "Choose actives at concentrations that are effective and safe",
        "Assemble the safety and claims file a regulator would ask for",
      ],
      ar: [
        "تصميم مستحلب يبقى ثابتاً على الرف",
        "اختيار المواد الفعالة بتراكيز فعالة وآمنة",
        "تجهيز ملف السلامة والادعاءات الذي تطلبه الجهات الرقابية",
      ],
    },
    skills: {
      en: ["Cosmetic formulation", "Regulatory awareness", "Stability testing"],
      ar: ["تركيب مستحضرات التجميل", "الوعي التنظيمي", "اختبار الثبات"],
    },
    persona: { id: "lab-chemist", role: { en: "AI Cosmetic Chemist", ar: "كيميائي تجميل ذكي" } },
    audio: { ambience: "lab-clean", cues: ["homogeniser", "scale-beep", "glass-clink"] },
    feasibility: {
      startupCostUsd: 11_000,
      monthlyCostUsd: 3_100,
      monthlyRevenueUsd: 6_200,
      rampUpMonths: 6,
      volatility: 4,
      revenueModel: {
        en: "A small SKU range sold online and through clinics and pharmacies.",
        ar: "مجموعة منتجات محدودة تُباع أونلاين وعبر العيادات والصيدليات.",
      },
      risks: {
        en: [
          "Product safety assessment is mandatory and not cheap",
          "One bad reaction can end a young brand",
          "Shelf life limits how much you can produce ahead",
        ],
        ar: [
          "تقييم سلامة المنتج إلزامي وغير رخيص",
          "رد فعل تحسسي واحد قد ينهي علامة ناشئة",
          "مدة الصلاحية تحدّ من كمية الإنتاج المسبق",
        ],
      },
    },
  }),
  entry({
    slug: "chocolate-factory",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/chocolate-factory",
    image: img("chocolate-factory"),
    title: { en: "Chocolate Factory", ar: "مصنع الشوكولاتة" },
    tagline: {
      en: "Sourcing, tempering and quality at production scale.",
      ar: "التوريد والتلطيف والجودة على نطاق إنتاجي.",
    },
    difficulty: "intermediate",
    durationMinutes: 35,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "create-something"],
    keywords: {
      en: ["chocolate", "confectionery", "factory", "cocoa", "food"],
      ar: ["شوكولاتة", "حلويات", "مصنع", "كاكاو", "أغذية"],
    },
    outcomes: {
      en: [
        "Temper chocolate reliably instead of by luck",
        "Trace a quality defect back to its process step",
        "Cost a gift box including packaging and waste",
      ],
      ar: [
        "تلطيف الشوكولاتة بشكل موثوق لا بالصدفة",
        "تتبع عيب الجودة رجوعاً إلى خطوة العملية المسببة",
        "حساب تكلفة علبة هدايا شاملة التغليف والهدر",
      ],
    },
    skills: {
      en: ["Food production", "Quality assurance", "Supply chain"],
      ar: ["إنتاج غذائي", "ضمان الجودة", "سلسلة التوريد"],
    },
    persona: { id: "production-manager", role: { en: "AI Production Manager", ar: "مدير إنتاج ذكي" } },
    audio: { ambience: "factory-line", cues: ["conveyor", "tempering-machine", "wrap-seal"] },
    feasibility: {
      startupCostUsd: 18_000,
      monthlyCostUsd: 4_800,
      monthlyRevenueUsd: 8_100,
      rampUpMonths: 5,
      volatility: 3,
      revenueModel: {
        en: "Boxed chocolates and seasonal gift lines, wholesale and direct.",
        ar: "علب الشوكولاتة وخطوط الهدايا الموسمية، بالجملة والمباشر.",
      },
      risks: {
        en: [
          "Cocoa prices have been extremely volatile",
          "Sales concentrate in a few seasonal peaks",
          "Cold-chain and shelf life constrain distribution",
        ],
        ar: [
          "أسعار الكاكاو شديدة التقلب",
          "المبيعات تتركز في ذروات موسمية قليلة",
          "سلسلة التبريد ومدة الصلاحية تقيدان التوزيع",
        ],
      },
    },
  }),
  entry({
    slug: "global-kitchen",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/global-kitchen",
    image: img("global-kitchen"),
    title: { en: "Restaurant Kitchen Command", ar: "قيادة مطبخ مطعم" },
    tagline: {
      en: "Menu, staff and food cost under a full service rush.",
      ar: "المنيو والفريق وتكلفة الطعام تحت ضغط خدمة كاملة.",
    },
    difficulty: "advanced",
    durationMinutes: 40,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "grow-my-work"],
    keywords: {
      en: ["restaurant", "kitchen", "chef", "menu", "food", "hospitality"],
      ar: ["مطعم", "مطبخ", "شيف", "منيو", "طعام", "ضيافة"],
    },
    outcomes: {
      en: [
        "Engineer a menu so the profitable dishes are the ones people order",
        "Hold food cost percentage through a busy service",
        "Staff a rota that survives a no-show",
      ],
      ar: [
        "هندسة المنيو بحيث تكون الأطباق المربحة هي الأكثر طلباً",
        "الحفاظ على نسبة تكلفة الطعام خلال خدمة مزدحمة",
        "بناء جدول عمل يصمد أمام غياب مفاجئ",
      ],
    },
    skills: {
      en: ["Menu engineering", "Kitchen operations", "Team leadership"],
      ar: ["هندسة المنيو", "تشغيل المطابخ", "قيادة الفريق"],
    },
    persona: { id: "operations-lead", role: { en: "AI Head Chef", ar: "شيف تنفيذي ذكي" } },
    audio: { ambience: "kitchen-service", cues: ["ticket-printer", "pan-sizzle", "bell-pass"] },
    feasibility: {
      startupCostUsd: 55_000,
      monthlyCostUsd: 14_500,
      monthlyRevenueUsd: 21_000,
      rampUpMonths: 6,
      volatility: 4,
      revenueModel: {
        en: "Covers per service plus delivery orders, at an average ticket price.",
        ar: "عدد الزبائن لكل خدمة إضافة إلى طلبات التوصيل بمتوسط قيمة فاتورة.",
      },
      risks: {
        en: [
          "Rent and staffing are fixed while revenue is not",
          "Delivery platform commissions eat 20–30% of that channel",
          "Food waste silently destroys the margin",
        ],
        ar: [
          "الإيجار والرواتب ثابتة بينما الإيرادات ليست كذلك",
          "عمولات منصات التوصيل تلتهم 20–30% من هذه القناة",
          "هدر الطعام يدمر الهامش بصمت",
        ],
      },
    },
  }),
  entry({
    slug: "barber-salon",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/barber-salon",
    image: img("barber-salon"),
    title: { en: "Salon Business Management", ar: "إدارة صالون احترافي" },
    tagline: {
      en: "Bookings, chairs, pricing and the loyalty that pays the rent.",
      ar: "الحجوزات والكراسي والتسعير والولاء الذي يدفع الإيجار.",
    },
    difficulty: "starter",
    durationMinutes: 25,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "grow-my-work"],
    keywords: {
      en: ["salon", "barber", "haircut", "booking", "beauty"],
      ar: ["صالون", "حلاق", "قص شعر", "حجز", "تجميل"],
    },
    outcomes: {
      en: [
        "Raise chair utilisation without adding a single hour",
        "Price a service menu that reflects your real chair cost",
        "Turn one-off walk-ins into a returning book",
      ],
      ar: [
        "رفع نسبة استغلال الكرسي دون إضافة ساعة عمل واحدة",
        "تسعير قائمة خدمات تعكس تكلفة الكرسي الحقيقية",
        "تحويل الزبون العابر إلى عميل متكرر",
      ],
    },
    skills: {
      en: ["Appointment economics", "Customer retention", "Small-team management"],
      ar: ["اقتصاديات المواعيد", "الاحتفاظ بالعملاء", "إدارة فرق صغيرة"],
    },
    persona: { id: "operations-lead", role: { en: "AI Salon Consultant", ar: "مستشار صالونات ذكي" } },
    audio: { ambience: "salon-floor", cues: ["clippers", "till-ping", "door-chime"] },
    feasibility: {
      startupCostUsd: 14_000,
      monthlyCostUsd: 3_800,
      monthlyRevenueUsd: 6_600,
      rampUpMonths: 4,
      volatility: 2,
      revenueModel: {
        en: "Services per chair per day, plus retail product sales.",
        ar: "عدد الخدمات لكل كرسي يومياً، إضافة إلى بيع المنتجات.",
      },
      risks: {
        en: [
          "Revenue is capped by chairs × hours — growth needs space or staff",
          "Skilled staff can leave and take their clients with them",
          "Location quality dominates everything else",
        ],
        ar: [
          "الإيراد محدود بعدد الكراسي × الساعات — النمو يتطلب مساحة أو موظفين",
          "الموظف الماهر قد يرحل ويأخذ عملاءه معه",
          "جودة الموقع تتفوق على كل عامل آخر",
        ],
      },
    },
  }),
  entry({
    slug: "woodworking",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/woodworking",
    image: img("woodworking"),
    title: { en: "Woodworking Workshop", ar: "ورشة النجارة" },
    tagline: {
      en: "Materials, job queue and delivery dates that hold.",
      ar: "المواد وطابور الطلبات ومواعيد تسليم قابلة للالتزام.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "learn-a-skill"],
    keywords: {
      en: ["woodworking", "carpentry", "furniture", "workshop", "joinery"],
      ar: ["نجارة", "أثاث", "ورشة", "خشب", "تصنيع"],
    },
    outcomes: {
      en: [
        "Quote a custom job so it is still profitable at delivery",
        "Sequence jobs so the machines are never the bottleneck",
        "Cut material waste out of your cost base",
      ],
      ar: [
        "تسعير طلب مخصص بحيث يبقى مربحاً عند التسليم",
        "ترتيب الطلبات بحيث لا تصبح الماكينات عنق الزجاجة",
        "إخراج هدر المواد من هيكل التكلفة",
      ],
    },
    skills: {
      en: ["Job quoting", "Workshop scheduling", "Materials planning"],
      ar: ["تسعير الطلبات", "جدولة الورشة", "تخطيط المواد"],
    },
    persona: { id: "workshop-master", role: { en: "AI Master Carpenter", ar: "معلّم نجارة ذكي" } },
    audio: { ambience: "workshop-wood", cues: ["saw-cut", "sander", "hammer-tap"] },
    feasibility: {
      startupCostUsd: 21_000,
      monthlyCostUsd: 3_600,
      monthlyRevenueUsd: 6_400,
      rampUpMonths: 5,
      volatility: 3,
      revenueModel: {
        en: "Custom furniture and fit-out jobs, priced per project.",
        ar: "أثاث مخصص وأعمال تجهيز، مسعّرة لكل مشروع.",
      },
      risks: {
        en: [
          "Underquoting a custom job is the most common way to lose money",
          "Timber prices and drying quality vary by batch",
          "Machine downtime stops the whole shop",
        ],
        ar: [
          "التسعير المنخفض للطلب المخصص هو أكثر أسباب الخسارة شيوعاً",
          "أسعار الخشب وجودة التجفيف تتفاوت بين الدفعات",
          "تعطل الماكينة يوقف الورشة بالكامل",
        ],
      },
    },
  }),
  entry({
    slug: "trade-tycoon",
    hub: "business-lab",
    kind: "experience",
    to: "/business-simulator/trade-tycoon",
    image: img("trade-tycoon"),
    title: { en: "Trading & Cash Flow", ar: "التجارة والتدفق النقدي" },
    tagline: {
      en: "Buy, sell and survive the cash-flow gap in between.",
      ar: "اشترِ وبِع وانجُ من فجوة التدفق النقدي بينهما.",
    },
    difficulty: "advanced",
    durationMinutes: 30,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "grow-my-work"],
    keywords: {
      en: ["trading", "wholesale", "inventory", "cash flow", "markets"],
      ar: ["تجارة", "جملة", "مخزون", "تدفق نقدي", "أسواق"],
    },
    outcomes: {
      en: [
        "Read a market well enough to size a position, not guess it",
        "Keep working capital ahead of your purchase commitments",
        "Know when holding stock costs more than discounting it",
      ],
      ar: [
        "قراءة السوق بما يكفي لتحديد حجم الصفقة لا تخمينها",
        "إبقاء رأس المال العامل متقدماً على التزامات الشراء",
        "معرفة متى يكلف الاحتفاظ بالمخزون أكثر من تخفيضه",
      ],
    },
    skills: {
      en: ["Working-capital management", "Market analysis", "Inventory strategy"],
      ar: ["إدارة رأس المال العامل", "تحليل السوق", "استراتيجية المخزون"],
    },
    persona: { id: "business-consultant", role: { en: "AI Business Consultant", ar: "مستشار أعمال ذكي" } },
    audio: { ambience: "trading-floor", cues: ["ticker", "deal-confirm", "alert-drop"] },
  }),
  entry({
    slug: "svc-economy",
    hub: "business-lab",
    kind: "advisor",
    to: "/services/economy",
    title: { en: "VX Economy Advisor", ar: "مستشار اقتصاد VX" },
    tagline: {
      en: "Understand the VX economy before you build a business on it.",
      ar: "افهم اقتصاد VX قبل أن تبني عليه مشروعاً.",
    },
    difficulty: "intermediate",
    durationMinutes: 20,
    vx: 200,
    intents: ["start-a-business", "grow-my-work"],
    keywords: {
      en: ["economy", "vx", "pricing", "investment", "market"],
      ar: ["اقتصاد", "في إكس", "تسعير", "استثمار", "سوق"],
    },
    outcomes: {
      en: [
        "Map how VX moves between earning, spending and rewards",
        "Model a pricing decision before you publish it",
        "Spot which levers actually move your revenue",
      ],
      ar: [
        "رسم حركة VX بين الكسب والإنفاق والمكافآت",
        "نمذجة قرار تسعير قبل إعلانه",
        "تحديد الأدوات التي تحرك إيرادك فعلاً",
      ],
    },
    skills: {
      en: ["Pricing strategy", "Economic modelling"],
      ar: ["استراتيجية التسعير", "النمذجة الاقتصادية"],
    },
    persona: { id: "business-consultant", role: { en: "AI Economist", ar: "خبير اقتصادي ذكي" } },
  }),
  entry({
    slug: "svc-radar-ai",
    hub: "business-lab",
    kind: "advisor",
    to: "/services/radar-ai",
    title: { en: "Market & Risk Radar", ar: "رادار السوق والمخاطر" },
    tagline: {
      en: "Scan data, trends and strategic risk before you commit.",
      ar: "امسح البيانات والاتجاهات والمخاطر الاستراتيجية قبل الالتزام.",
    },
    difficulty: "advanced",
    durationMinutes: 25,
    vx: 300,
    intents: ["start-a-business", "grow-my-work"],
    keywords: {
      en: ["analysis", "trends", "risk", "intelligence", "strategy", "data"],
      ar: ["تحليل", "اتجاهات", "مخاطر", "استخبارات", "استراتيجية", "بيانات"],
    },
    outcomes: {
      en: [
        "Turn a vague worry into a named, ranked risk",
        "Separate a real trend from noise",
        "Leave with a decision, not just a dashboard",
      ],
      ar: [
        "تحويل قلق غامض إلى خطر محدد ومرتب حسب الأولوية",
        "فصل الاتجاه الحقيقي عن الضجيج",
        "الخروج بقرار لا بلوحة بيانات فقط",
      ],
    },
    skills: {
      en: ["Risk assessment", "Trend analysis", "Strategic planning"],
      ar: ["تقييم المخاطر", "تحليل الاتجاهات", "التخطيط الاستراتيجي"],
    },
    persona: { id: "business-consultant", role: { en: "AI Strategy Analyst", ar: "محلل استراتيجي ذكي" } },
  }),
  entry({
    slug: "svc-edu-empire",
    hub: "business-lab",
    kind: "advisor",
    to: "/services/educational-empire",
    title: { en: "Education Business Builder", ar: "بناء مشروع تعليمي" },
    tagline: {
      en: "Design a programme people will pay to complete.",
      ar: "صمّم برنامجاً يدفع الناس لإكماله.",
    },
    difficulty: "advanced",
    durationMinutes: 30,
    vx: 300,
    intents: ["start-a-business", "grow-my-work"],
    keywords: {
      en: ["education", "curriculum", "courses", "training business", "academy"],
      ar: ["تعليم", "منهج", "دورات", "مشروع تدريبي", "أكاديمية"],
    },
    outcomes: {
      en: [
        "Structure a curriculum around outcomes, not topics",
        "Price a programme against its delivery cost",
        "Plan the intake and completion funnel",
      ],
      ar: [
        "بناء منهج حول المخرجات لا حول المواضيع",
        "تسعير البرنامج مقابل تكلفة تقديمه",
        "تخطيط مسار التسجيل والإكمال",
      ],
    },
    skills: {
      en: ["Curriculum design", "Programme economics"],
      ar: ["تصميم المناهج", "اقتصاديات البرامج"],
    },
    persona: { id: "business-consultant", role: { en: "AI Education Strategist", ar: "استراتيجي تعليم ذكي" } },
  }),
];

// ── Hub 2: Technology & Repair Center ─────────────────────────────────
const TECH_REPAIR: ServiceEntry[] = [
  entry({
    slug: "network-noc",
    hub: "tech-repair",
    kind: "experience",
    to: "/business-simulator/network-noc",
    image: img("network-noc"),
    title: { en: "Network Operations Centre", ar: "مركز عمليات الشبكة" },
    tagline: {
      en: "Live incidents, real triage, and a clock that does not stop.",
      ar: "أعطال حية وفرز حقيقي وساعة لا تتوقف.",
    },
    difficulty: "expert",
    durationMinutes: 40,
    vx: 250,
    usageBased: true,
    intents: ["fix-a-device", "learn-a-skill", "grow-my-work"],
    keywords: {
      en: ["network", "noc", "router", "outage", "incident", "it", "servers"],
      ar: ["شبكة", "مركز عمليات", "راوتر", "انقطاع", "حادث", "تقنية", "سيرفرات"],
    },
    outcomes: {
      en: [
        "Triage a multi-site outage by impact, not by who shouted first",
        "Isolate a fault layer by layer instead of guessing",
        "Write an incident report someone else can act on",
      ],
      ar: [
        "فرز انقطاع متعدد المواقع حسب الأثر لا حسب من صرخ أولاً",
        "عزل العطل طبقة بطبقة بدلاً من التخمين",
        "كتابة تقرير حادث يستطيع غيرك التصرف بناءً عليه",
      ],
    },
    skills: {
      en: ["Incident response", "Network troubleshooting", "Root-cause analysis"],
      ar: ["الاستجابة للحوادث", "تشخيص الشبكات", "تحليل السبب الجذري"],
    },
    persona: { id: "network-engineer", role: { en: "AI Network Engineer", ar: "مهندس شبكات ذكي" } },
    audio: { ambience: "server-room", cues: ["rack-fans", "alert-critical", "keyboard-fast"] },
    featured: true,
  }),
  entry({
    slug: "mobile-repair",
    hub: "tech-repair",
    kind: "experience",
    to: "/business-simulator/mobile-repair",
    image: img("mobile-repair"),
    title: { en: "Mobile Repair Workshop", ar: "ورشة صيانة الهواتف" },
    tagline: {
      en: "From screen to board — diagnose before you open anything.",
      ar: "من الشاشة إلى اللوحة — شخّص قبل أن تفتح أي شيء.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 250,
    usageBased: true,
    intents: ["fix-a-device", "learn-a-skill", "start-a-business"],
    keywords: {
      en: ["phone", "mobile", "repair", "screen", "battery", "charging"],
      ar: ["هاتف", "جوال", "صيانة", "شاشة", "بطارية", "شحن"],
    },
    outcomes: {
      en: [
        "Follow a fault tree from symptom to component",
        "Decide when a repair is not economic to attempt",
        "Quote a repair with parts, labour and risk included",
      ],
      ar: [
        "اتباع شجرة أعطال من العرض إلى القطعة",
        "تحديد متى يكون الإصلاح غير مجدٍ اقتصادياً",
        "تسعير إصلاح شامل القطع والأجرة والمخاطرة",
      ],
    },
    skills: {
      en: ["Fault diagnosis", "Micro-repair technique", "Repair quoting"],
      ar: ["تشخيص الأعطال", "تقنيات الإصلاح الدقيق", "تسعير الإصلاح"],
    },
    persona: { id: "repair-technician", role: { en: "AI Repair Technician", ar: "فني صيانة ذكي" } },
    audio: { ambience: "workshop-bench", cues: ["screwdriver", "heat-gun", "beep-test"] },
    feasibility: {
      startupCostUsd: 5_400,
      monthlyCostUsd: 1_600,
      monthlyRevenueUsd: 3_900,
      rampUpMonths: 3,
      volatility: 2,
      revenueModel: {
        en: "Repairs per day at an average ticket, plus accessory sales.",
        ar: "عدد الإصلاحات يومياً بمتوسط فاتورة، إضافة إلى بيع الإكسسوارات.",
      },
      risks: {
        en: [
          "Genuine parts supply is inconsistent and counterfeits are common",
          "A device damaged in your hands is your liability",
          "Manufacturers keep making devices harder to open",
        ],
        ar: [
          "توفر القطع الأصلية غير منتظم والتقليد منتشر",
          "أي جهاز يتلف بين يديك يقع على مسؤوليتك",
          "الشركات المصنعة تزيد صعوبة فتح الأجهزة باستمرار",
        ],
      },
    },
  }),
  entry({
    slug: "laptop-repair",
    hub: "tech-repair",
    kind: "experience",
    to: "/business-simulator/laptop-repair",
    image: img("laptop-repair"),
    title: { en: "Laptop Repair Workshop", ar: "ورشة صيانة اللابتوب" },
    tagline: {
      en: "Hardware or software? Prove it before you replace a part.",
      ar: "عطل عتاد أم برمجيات؟ أثبت ذلك قبل تبديل أي قطعة.",
    },
    difficulty: "intermediate",
    durationMinutes: 35,
    vx: 250,
    usageBased: true,
    intents: ["fix-a-device", "learn-a-skill", "start-a-business"],
    keywords: {
      en: ["laptop", "computer", "repair", "no power", "boot", "overheating"],
      ar: ["لابتوب", "حاسوب", "صيانة", "لا يعمل", "إقلاع", "حرارة"],
    },
    outcomes: {
      en: [
        "Separate a hardware fault from a software fault in minutes",
        "Trace a no-power fault along the power rail",
        "Recover user data before you touch the storage",
      ],
      ar: [
        "فصل عطل العتاد عن عطل البرمجيات خلال دقائق",
        "تتبع عطل انعدام الطاقة على مسار التغذية",
        "استرجاع بيانات المستخدم قبل لمس وحدة التخزين",
      ],
    },
    skills: {
      en: ["Systematic diagnosis", "Board-level awareness", "Data recovery discipline"],
      ar: ["التشخيص المنهجي", "الوعي بمستوى اللوحة", "انضباط استرجاع البيانات"],
    },
    persona: { id: "repair-technician", role: { en: "AI Repair Technician", ar: "فني صيانة ذكي" } },
    audio: { ambience: "workshop-bench", cues: ["fan-spin", "beep-post", "screwdriver"] },
  }),
  entry({
    slug: "board-surgeon",
    hub: "tech-repair",
    kind: "experience",
    to: "/business-simulator/board-surgeon",
    image: img("board-surgeon"),
    title: { en: "Board-Level Micro Surgery", ar: "الجراحة الدقيقة للوحات" },
    tagline: {
      en: "Component-level repair where a wrong move costs the board.",
      ar: "إصلاح على مستوى المكونات حيث تكلف الحركة الخاطئة اللوحة كلها.",
    },
    difficulty: "expert",
    durationMinutes: 45,
    vx: 250,
    usageBased: true,
    intents: ["fix-a-device", "learn-a-skill"],
    keywords: {
      en: ["motherboard", "soldering", "microsoldering", "components", "bga"],
      ar: ["لوحة أم", "لحام", "لحام دقيق", "مكونات", "شرائح"],
    },
    outcomes: {
      en: [
        "Read a board schematic well enough to find the failing rail",
        "Work under a microscope without lifting a pad",
        "Judge when a board is beyond economic repair",
      ],
      ar: [
        "قراءة مخطط اللوحة بما يكفي لتحديد المسار المعطل",
        "العمل تحت المجهر دون رفع أي وسادة لحام",
        "تقدير متى تصبح اللوحة غير قابلة للإصلاح اقتصادياً",
      ],
    },
    skills: {
      en: ["Schematic reading", "Micro-soldering", "Precision under pressure"],
      ar: ["قراءة المخططات", "اللحام الدقيق", "الدقة تحت الضغط"],
    },
    persona: { id: "repair-technician", role: { en: "AI Board Specialist", ar: "أخصائي لوحات ذكي" } },
    audio: { ambience: "workshop-bench", cues: ["solder-station", "microscope-focus", "beep-test"] },
  }),
  entry({
    slug: "vehicle-diagnostics",
    hub: "tech-repair",
    kind: "experience",
    to: "/business-simulator/vehicle-diagnostics",
    title: { en: "Vehicle Diagnostics & Repair", ar: "تشخيص وإصلاح المركبات" },
    tagline: {
      en: "OBD-II codes in, a defensible repair decision out.",
      ar: "من أكواد OBD-II إلى قرار إصلاح مبني على دليل.",
    },
    difficulty: "advanced",
    durationMinutes: 45,
    vx: 250,
    usageBased: true,
    intents: ["fix-a-device", "learn-a-skill", "start-a-business"],
    keywords: {
      en: ["car", "vehicle", "obd", "engine", "diagnostics", "mechanic", "fault code"],
      ar: ["سيارة", "مركبة", "أو بي دي", "محرك", "تشخيص", "ميكانيكي", "كود عطل"],
    },
    outcomes: {
      en: [
        "Interpret a fault code as a starting point, never a conclusion",
        "Trace an electrical fault with live data instead of parts-swapping",
        "Sign off a repair with a road test that actually proves it",
      ],
      ar: [
        "التعامل مع كود العطل كنقطة بداية لا كنتيجة نهائية",
        "تتبع عطل كهربائي بالبيانات الحية بدل تبديل القطع",
        "اعتماد الإصلاح باختبار طريق يثبته فعلاً",
      ],
    },
    skills: {
      en: ["Automotive diagnosis", "Electrical tracing", "Workshop workflow"],
      ar: ["تشخيص المركبات", "تتبع الأعطال الكهربائية", "سير عمل الورشة"],
    },
    persona: { id: "mechanic", role: { en: "AI Master Mechanic", ar: "ميكانيكي خبير ذكي" } },
    audio: { ambience: "garage-bay", cues: ["engine-idle", "impact-wrench", "scanner-beep"] },
    featured: true,
  }),
];

// ── Hub 3: Visionex Engineering Lab ───────────────────────────────────
const ENGINEERING: ServiceEntry[] = [
  entry({
    slug: "solar-energy",
    hub: "engineering",
    kind: "experience",
    to: "/business-simulator/solar-energy",
    image: img("solar-energy"),
    title: { en: "Solar Energy Plant", ar: "محطة الطاقة الشمسية" },
    tagline: {
      en: "Size the array, track the yield, prove the payback.",
      ar: "احسب حجم المنظومة وتتبع الإنتاج وأثبت فترة الاسترداد.",
    },
    difficulty: "advanced",
    durationMinutes: 40,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "learn-a-skill", "grow-my-work"],
    keywords: {
      en: ["solar", "pv", "energy", "inverter", "panels", "renewable", "battery"],
      ar: ["طاقة شمسية", "خلايا كهروضوئية", "ألواح", "طاقة", "إنفرتر", "متجددة", "بطاريات"],
    },
    outcomes: {
      en: [
        "Size an array against a real load profile, not a wish",
        "Read inverter output and spot underperforming strings",
        "Build a payback case a customer will believe",
      ],
      ar: [
        "تحديد حجم المنظومة وفق منحنى أحمال حقيقي لا وفق التمني",
        "قراءة إنتاج الإنفرتر واكتشاف السلاسل الضعيفة",
        "بناء دراسة استرداد يقتنع بها العميل",
      ],
    },
    skills: {
      en: ["PV system sizing", "Energy yield analysis", "Technical sales"],
      ar: ["تصميم المنظومات الشمسية", "تحليل إنتاج الطاقة", "البيع الفني"],
    },
    persona: { id: "engineer", role: { en: "AI Energy Engineer", ar: "مهندس طاقة ذكي" } },
    audio: { ambience: "plant-outdoor", cues: ["inverter-hum", "cooling-fans", "alarm-fault"] },
    feasibility: {
      startupCostUsd: 28_000,
      monthlyCostUsd: 4_200,
      monthlyRevenueUsd: 9_500,
      rampUpMonths: 6,
      volatility: 3,
      revenueModel: {
        en: "Installed kW of residential and commercial systems per month.",
        ar: "عدد الكيلوواطات المركبة شهرياً في المنشآت السكنية والتجارية.",
      },
      risks: {
        en: [
          "Import costs and currency swings move panel prices",
          "Subsidy and net-metering rules can change mid-project",
          "A bad installation becomes a 20-year warranty problem",
        ],
        ar: [
          "تكاليف الاستيراد وتقلب العملة يحركان أسعار الألواح",
          "قواعد الدعم وصافي القياس قد تتغير أثناء المشروع",
          "التركيب السيئ يتحول إلى مشكلة ضمان لعشرين عاماً",
        ],
      },
    },
    featured: true,
  }),
  entry({
    slug: "hvac-systems",
    hub: "engineering",
    kind: "experience",
    to: "/business-simulator/hvac-systems",
    image: img("hvac-systems"),
    title: { en: "HVAC Systems", ar: "أنظمة التكييف والتهوية" },
    tagline: {
      en: "Load, ducting and maintenance for buildings that behave badly.",
      ar: "الأحمال والمجاري والصيانة لمبانٍ لا تتصرف كما هو مفترض.",
    },
    difficulty: "advanced",
    durationMinutes: 40,
    vx: 250,
    usageBased: true,
    intents: ["fix-a-device", "learn-a-skill", "start-a-business"],
    keywords: {
      en: ["hvac", "air conditioning", "cooling", "ducting", "refrigeration"],
      ar: ["تكييف", "تبريد", "تهوية", "مجاري هواء", "تبريد صناعي"],
    },
    outcomes: {
      en: [
        "Calculate a cooling load instead of oversizing by habit",
        "Diagnose poor performance without immediately blaming the gas charge",
        "Plan preventive maintenance that reduces callbacks",
      ],
      ar: [
        "حساب حمل التبريد بدل المبالغة في المقاس بحكم العادة",
        "تشخيص ضعف الأداء دون اتهام شحنة الغاز فوراً",
        "تخطيط صيانة وقائية تقلل الاستدعاءات المتكررة",
      ],
    },
    skills: {
      en: ["Load calculation", "System commissioning", "Preventive maintenance"],
      ar: ["حساب الأحمال", "تشغيل الأنظمة", "الصيانة الوقائية"],
    },
    persona: { id: "engineer", role: { en: "AI HVAC Engineer", ar: "مهندس تكييف ذكي" } },
    audio: { ambience: "plant-room", cues: ["compressor", "air-handler", "alarm-fault"] },
  }),
  entry({
    slug: "aluminum-glazing",
    hub: "engineering",
    kind: "experience",
    to: "/business-simulator/aluminum-glazing",
    image: img("aluminum-glazing"),
    title: { en: "Aluminium & Glazing Works", ar: "أعمال الألمنيوم والزجاج" },
    tagline: {
      en: "From take-off and quote to a clean installation.",
      ar: "من الحصر والتسعير حتى تركيب نظيف.",
    },
    difficulty: "intermediate",
    durationMinutes: 35,
    vx: 250,
    usageBased: true,
    intents: ["start-a-business", "learn-a-skill"],
    keywords: {
      en: ["aluminium", "glass", "glazing", "windows", "facade", "curtain wall"],
      ar: ["ألمنيوم", "زجاج", "واجهات", "نوافذ", "تركيب", "جدار ستائري"],
    },
    outcomes: {
      en: [
        "Take off quantities accurately enough to quote with confidence",
        "Choose profiles and glass for the actual thermal and wind loads",
        "Sequence an installation that does not damage finished work",
      ],
      ar: [
        "حصر الكميات بدقة تكفي للتسعير بثقة",
        "اختيار القطاعات والزجاج وفق الأحمال الحرارية والرياح الفعلية",
        "ترتيب التركيب بحيث لا يتلف الأعمال المنجزة",
      ],
    },
    skills: {
      en: ["Quantity take-off", "Specification selection", "Site sequencing"],
      ar: ["حصر الكميات", "اختيار المواصفات", "ترتيب أعمال الموقع"],
    },
    persona: { id: "engineer", role: { en: "AI Façade Engineer", ar: "مهندس واجهات ذكي" } },
    audio: { ambience: "site-construction", cues: ["cutting-saw", "glass-handling", "drill"] },
  }),
  entry({
    slug: "logistics-supply",
    hub: "engineering",
    kind: "experience",
    to: "/business-simulator/logistics-supply",
    image: img("logistics-supply"),
    title: { en: "Logistics & Supply Chain", ar: "اللوجستيات وسلسلة التوريد" },
    tagline: {
      en: "Warehouse, fleet and suppliers optimised against one budget.",
      ar: "المخزن والأسطول والموردون بتحسين ضمن ميزانية واحدة.",
    },
    difficulty: "advanced",
    durationMinutes: 40,
    vx: 250,
    usageBased: true,
    intents: ["grow-my-work", "start-a-business"],
    keywords: {
      en: ["logistics", "warehouse", "supply chain", "fleet", "delivery", "inventory"],
      ar: ["لوجستيات", "مخزن", "سلسلة توريد", "أسطول", "توصيل", "مخزون"],
    },
    outcomes: {
      en: [
        "Set reorder points that survive a supplier delay",
        "Route a fleet against cost per drop, not distance alone",
        "Find the real bottleneck in a warehouse flow",
      ],
      ar: [
        "تحديد نقاط إعادة الطلب بحيث تصمد أمام تأخر المورد",
        "تخطيط مسارات الأسطول وفق تكلفة كل نقطة تسليم لا المسافة فقط",
        "اكتشاف عنق الزجاجة الحقيقي في تدفق المخزن",
      ],
    },
    skills: {
      en: ["Inventory planning", "Route optimisation", "Supplier management"],
      ar: ["تخطيط المخزون", "تحسين المسارات", "إدارة الموردين"],
    },
    persona: { id: "operations-lead", role: { en: "AI Logistics Planner", ar: "مخطط لوجستيات ذكي" } },
    audio: { ambience: "warehouse", cues: ["forklift", "scanner-beep", "roller-door"] },
  }),
  entry({
    slug: "marine-vessel",
    hub: "engineering",
    kind: "experience",
    to: "/business-simulator/marine-vessel",
    title: { en: "Maritime Operations Centre", ar: "مركز العمليات البحرية" },
    tagline: {
      en: "Track a fleet through weather, ports and canal delays.",
      ar: "تابع أسطولاً عبر الأحوال الجوية والموانئ وتأخيرات القنوات.",
    },
    difficulty: "expert",
    durationMinutes: 50,
    vx: 300,
    usageBased: true,
    intents: ["grow-my-work", "learn-a-skill"],
    keywords: {
      en: ["maritime", "shipping", "vessel", "port", "ais", "fleet", "navigation"],
      ar: ["بحري", "شحن", "سفينة", "ميناء", "تتبع السفن", "أساطيل", "ملاحة"],
    },
    outcomes: {
      en: [
        "Re-plan a voyage when a port or canal closes",
        "Weigh fuel cost against schedule reliability",
        "Read AIS data as an operational picture, not a map",
      ],
      ar: [
        "إعادة تخطيط رحلة عند إغلاق ميناء أو قناة",
        "الموازنة بين تكلفة الوقود وموثوقية الجدول",
        "قراءة بيانات AIS كصورة تشغيلية لا كخريطة",
      ],
    },
    skills: {
      en: ["Voyage planning", "Fleet operations", "Contingency management"],
      ar: ["تخطيط الرحلات", "تشغيل الأساطيل", "إدارة الطوارئ"],
    },
    persona: { id: "operations-lead", role: { en: "AI Fleet Controller", ar: "مراقب أسطول ذكي" } },
    audio: { ambience: "bridge-marine", cues: ["radar-sweep", "vhf-chatter", "alarm-fault"] },
  }),
  entry({
    slug: "svc-delivery",
    hub: "engineering",
    kind: "advisor",
    to: "/services/delivery",
    title: { en: "Express Delivery Hub", ar: "مركز التوصيل السريع" },
    tagline: {
      en: "Routes, riders and promise times that hold up.",
      ar: "مسارات وسائقون ومواعيد تسليم يمكن الوفاء بها.",
    },
    difficulty: "intermediate",
    durationMinutes: 25,
    vx: 200,
    intents: ["grow-my-work", "start-a-business"],
    keywords: {
      en: ["delivery", "courier", "routes", "riders", "last mile"],
      ar: ["توصيل", "مندوب", "مسارات", "سائقون", "الميل الأخير"],
    },
    outcomes: {
      en: [
        "Set a delivery promise you can actually meet at peak",
        "Batch orders without wrecking the delivery window",
        "Cost a drop properly, including the failed ones",
      ],
      ar: [
        "تحديد وعد تسليم يمكنك الوفاء به في الذروة",
        "تجميع الطلبات دون إفساد نافذة التسليم",
        "حساب تكلفة كل عملية تسليم بشكل صحيح، بما فيها الفاشلة",
      ],
    },
    skills: {
      en: ["Last-mile operations", "Capacity planning"],
      ar: ["عمليات الميل الأخير", "تخطيط الطاقة الاستيعابية"],
    },
    persona: { id: "operations-lead", role: { en: "AI Dispatch Manager", ar: "مدير إرسال ذكي" } },
  }),
];

// ── Hub 4: Personal Development ───────────────────────────────────────
const PERSONAL_GROWTH: ServiceEntry[] = [
  entry({
    slug: "english-journey",
    hub: "personal-growth",
    kind: "experience",
    to: "/business-simulator/english-journey",
    image: img("english-journey"),
    title: { en: "English Journey", ar: "رحلة الإنجليزية" },
    tagline: {
      en: "Structured practice with feedback you can measure.",
      ar: "تدريب منظم مع تقييم يمكن قياسه.",
    },
    difficulty: "starter",
    durationMinutes: 25,
    vx: 250,
    usageBased: true,
    intents: ["learn-a-skill"],
    keywords: {
      en: ["english", "language", "speaking", "grammar", "vocabulary"],
      ar: ["إنجليزي", "لغة", "محادثة", "قواعد", "مفردات"],
    },
    outcomes: {
      en: [
        "Move up one practical level with evidence, not guesswork",
        "Build the vocabulary your actual work needs",
        "Speak through a real scenario without freezing",
      ],
      ar: [
        "الارتقاء مستوى عملياً واحداً بدليل لا بتخمين",
        "بناء المفردات التي يحتاجها عملك فعلاً",
        "التحدث خلال موقف حقيقي دون تجمد",
      ],
    },
    skills: {
      en: ["Spoken fluency", "Practical vocabulary", "Listening accuracy"],
      ar: ["الطلاقة في التحدث", "المفردات العملية", "دقة الاستماع"],
    },
    persona: { id: "coach", role: { en: "AI Language Coach", ar: "مدرب لغة ذكي" } },
    audio: { ambience: "study-quiet", cues: ["correct-chime", "retry-tone", "level-up"] },
    featured: true,
  }),
  entry({
    slug: "music-training",
    hub: "personal-growth",
    kind: "experience",
    to: "/business-simulator/music-training",
    image: img("music-training"),
    title: { en: "Music Training Studio", ar: "استوديو التدريب الموسيقي" },
    tagline: {
      en: "Lessons, practice and progress toward a confident performance.",
      ar: "دروس وتدريب وتقدم نحو أداء واثق.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 250,
    usageBased: true,
    intents: ["learn-a-skill", "create-something"],
    keywords: {
      en: ["music", "practice", "instrument", "lessons", "performance"],
      ar: ["موسيقى", "تدريب", "آلة", "دروس", "أداء"],
    },
    outcomes: {
      en: [
        "Structure practice so it compounds instead of repeating",
        "Track a student from first lesson to performance",
        "Diagnose why a passage is not improving",
      ],
      ar: [
        "بناء تدريب يتراكم أثره بدل التكرار",
        "متابعة الطالب من الدرس الأول حتى الأداء",
        "تشخيص سبب عدم تحسن مقطع معين",
      ],
    },
    skills: {
      en: ["Practice design", "Musical ear", "Teaching progression"],
      ar: ["تصميم التدريب", "الأذن الموسيقية", "التدرج التعليمي"],
    },
    persona: { id: "coach", role: { en: "AI Music Instructor", ar: "مدرب موسيقى ذكي" } },
    audio: { ambience: "studio-practice", cues: ["metronome", "note-correct", "applause"] },
  }),
  entry({
    slug: "svc-sports-coach",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/sports-coach",
    title: { en: "Sports & Fitness Coach", ar: "مدرب الرياضة واللياقة" },
    tagline: {
      en: "A programme built around your body and your week.",
      ar: "برنامج مبني على جسدك وجدول أسبوعك.",
    },
    difficulty: "starter",
    durationMinutes: 20,
    vx: 200,
    intents: ["care-for-myself", "learn-a-skill"],
    keywords: {
      en: ["fitness", "workout", "training", "gym", "sports", "exercise"],
      ar: ["لياقة", "تمارين", "تدريب", "نادي", "رياضة", "تمرين"],
    },
    outcomes: {
      en: [
        "Get a plan matched to your level, not a generic template",
        "Progress load safely week over week",
        "Know which measurements actually mean progress",
      ],
      ar: [
        "الحصول على خطة تناسب مستواك لا قالباً عاماً",
        "زيادة الحمل بأمان أسبوعاً بعد أسبوع",
        "معرفة القياسات التي تعني تقدماً فعلياً",
      ],
    },
    skills: {
      en: ["Training programming", "Progressive overload", "Self-monitoring"],
      ar: ["برمجة التدريب", "التحميل التدريجي", "المتابعة الذاتية"],
    },
    persona: { id: "coach", role: { en: "AI Fitness Coach", ar: "مدرب لياقة ذكي" } },
  }),
  entry({
    slug: "svc-nutrition",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/nutrition",
    title: { en: "Nutrition Clinic", ar: "عيادة التغذية" },
    tagline: {
      en: "A food plan you can hold for more than a week.",
      ar: "خطة غذائية يمكنك الالتزام بها أكثر من أسبوع.",
    },
    difficulty: "starter",
    durationMinutes: 20,
    vx: 200,
    intents: ["care-for-myself"],
    keywords: {
      en: ["nutrition", "diet", "food", "calories", "meal plan", "health"],
      ar: ["تغذية", "حمية", "طعام", "سعرات", "خطة وجبات", "صحة"],
    },
    outcomes: {
      en: [
        "Build a plan around food you actually eat",
        "Understand portions without weighing everything forever",
        "Adjust intake as your activity changes",
      ],
      ar: [
        "بناء خطة حول طعام تتناوله فعلاً",
        "فهم الحصص دون وزن كل شيء إلى الأبد",
        "تعديل المدخول مع تغير نشاطك",
      ],
    },
    skills: {
      en: ["Nutritional literacy", "Meal planning"],
      ar: ["الوعي الغذائي", "تخطيط الوجبات"],
    },
    persona: { id: "clinician", role: { en: "AI Nutritionist", ar: "أخصائي تغذية ذكي" } },
  }),
  entry({
    slug: "svc-psychology",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/psychology",
    title: { en: "Psychology & Mental Wellness", ar: "الصحة النفسية والعافية" },
    tagline: {
      en: "A private space to think something through.",
      ar: "مساحة خاصة لتفكر في أمر ما حتى نهايته.",
    },
    difficulty: "starter",
    durationMinutes: 25,
    vx: 200,
    intents: ["care-for-myself"],
    keywords: {
      en: ["psychology", "mental health", "stress", "anxiety", "wellbeing", "therapy"],
      ar: ["نفسية", "صحة نفسية", "توتر", "قلق", "عافية", "علاج"],
    },
    outcomes: {
      en: [
        "Name what you are actually feeling more precisely",
        "Learn a technique you can use the same day",
        "Recognise when to seek a human professional",
      ],
      ar: [
        "تسمية ما تشعر به فعلاً بدقة أكبر",
        "تعلم تقنية يمكنك استخدامها في اليوم نفسه",
        "معرفة متى يجب اللجوء إلى مختص بشري",
      ],
    },
    skills: {
      en: ["Emotional awareness", "Coping strategies"],
      ar: ["الوعي العاطفي", "استراتيجيات التكيف"],
    },
    persona: { id: "clinician", role: { en: "AI Wellbeing Practitioner", ar: "مختص عافية ذكي" } },
  }),
  entry({
    slug: "svc-empathy-oasis",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/empathy-oasis",
    title: { en: "Empathy Oasis", ar: "واحة التعاطف" },
    tagline: {
      en: "Somewhere calm when the day has been too much.",
      ar: "مكان هادئ حين يكون اليوم ثقيلاً أكثر من اللازم.",
    },
    difficulty: "starter",
    durationMinutes: 15,
    vx: 100,
    intents: ["care-for-myself"],
    keywords: {
      en: ["support", "empathy", "calm", "mindfulness", "listening"],
      ar: ["دعم", "تعاطف", "هدوء", "يقظة ذهنية", "إصغاء"],
    },
    outcomes: {
      en: [
        "Slow down with a guided breathing or grounding exercise",
        "Be heard without being assessed",
      ],
      ar: [
        "التهدئة عبر تمرين تنفس أو تثبيت موجّه",
        "أن تُسمع دون أن تُقيَّم",
      ],
    },
    skills: {
      en: ["Self-regulation", "Mindfulness"],
      ar: ["التنظيم الذاتي", "اليقظة الذهنية"],
    },
    persona: { id: "clinician", role: { en: "AI Companion", ar: "رفيق ذكي" } },
  }),
  entry({
    slug: "svc-medical",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/medical-support",
    title: { en: "Virtual Medical Clinic", ar: "العيادة الطبية الافتراضية" },
    tagline: {
      en: "Understand your symptoms well enough to ask the right questions.",
      ar: "افهم أعراضك بما يكفي لطرح الأسئلة الصحيحة.",
    },
    difficulty: "starter",
    durationMinutes: 20,
    vx: 200,
    intents: ["care-for-myself"],
    keywords: {
      en: ["health", "symptoms", "medical", "doctor", "clinic"],
      ar: ["صحة", "أعراض", "طبي", "طبيب", "عيادة"],
    },
    outcomes: {
      en: [
        "Describe symptoms in the terms a clinician needs",
        "Understand what a test result is measuring",
        "Know which symptoms mean go now, not later",
      ],
      ar: [
        "وصف الأعراض بالمصطلحات التي يحتاجها الطبيب",
        "فهم ما يقيسه تحليل معين",
        "معرفة الأعراض التي تعني الذهاب الآن لا لاحقاً",
      ],
    },
    skills: {
      en: ["Health literacy", "Symptom description"],
      ar: ["الثقافة الصحية", "وصف الأعراض"],
    },
    persona: { id: "clinician", role: { en: "AI Health Guide", ar: "مرشد صحي ذكي" } },
  }),
  entry({
    slug: "svc-skin-care",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/skin-care",
    title: { en: "Skin Care Clinic", ar: "عيادة العناية بالبشرة" },
    tagline: {
      en: "A routine matched to your skin, not to an advert.",
      ar: "روتين يناسب بشرتك لا إعلاناً تجارياً.",
    },
    difficulty: "starter",
    durationMinutes: 15,
    vx: 150,
    intents: ["care-for-myself"],
    keywords: {
      en: ["skin", "skincare", "acne", "routine", "dermatology"],
      ar: ["بشرة", "عناية بالبشرة", "حب الشباب", "روتين", "جلدية"],
    },
    outcomes: {
      en: [
        "Identify your skin type honestly",
        "Build a routine in the right order",
        "Stop stacking actives that fight each other",
      ],
      ar: [
        "تحديد نوع بشرتك بصدق",
        "بناء روتين بالترتيب الصحيح",
        "التوقف عن دمج مواد فعالة تتعارض مع بعضها",
      ],
    },
    skills: {
      en: ["Skincare literacy", "Routine building"],
      ar: ["الوعي بالعناية بالبشرة", "بناء الروتين"],
    },
    persona: { id: "clinician", role: { en: "AI Skin Advisor", ar: "مستشار بشرة ذكي" } },
  }),
  entry({
    slug: "svc-hair-care",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/hair-care",
    title: { en: "Hair Care Studio", ar: "استوديو العناية بالشعر" },
    tagline: {
      en: "Treatments and routines for the hair you actually have.",
      ar: "علاجات وروتين للشعر الذي لديك فعلاً.",
    },
    difficulty: "starter",
    durationMinutes: 15,
    vx: 150,
    intents: ["care-for-myself"],
    keywords: {
      en: ["hair", "scalp", "treatment", "routine", "damage"],
      ar: ["شعر", "فروة", "علاج", "روتين", "تلف"],
    },
    outcomes: {
      en: [
        "Diagnose whether the problem is the hair or the scalp",
        "Pick treatments that suit your hair's porosity and texture",
      ],
      ar: [
        "تحديد ما إذا كانت المشكلة في الشعر أم في فروة الرأس",
        "اختيار علاجات تناسب مسامية شعرك وملمسه",
      ],
    },
    skills: {
      en: ["Hair care literacy", "Routine building"],
      ar: ["الوعي بالعناية بالشعر", "بناء الروتين"],
    },
    persona: { id: "clinician", role: { en: "AI Hair Advisor", ar: "مستشار شعر ذكي" } },
  }),
  entry({
    slug: "svc-social-guide",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/social-guide",
    title: { en: "Social Skills Advisor", ar: "مستشار المهارات الاجتماعية" },
    tagline: {
      en: "Rehearse the conversation before you have it.",
      ar: "تدرّب على المحادثة قبل أن تخوضها.",
    },
    difficulty: "starter",
    durationMinutes: 20,
    vx: 200,
    intents: ["care-for-myself", "grow-my-work"],
    keywords: {
      en: ["social", "communication", "confidence", "conversation", "emotional intelligence"],
      ar: ["اجتماعي", "تواصل", "ثقة", "محادثة", "ذكاء عاطفي"],
    },
    outcomes: {
      en: [
        "Practise a hard conversation with feedback",
        "Read a room without over-thinking it",
        "Set a boundary clearly and kindly",
      ],
      ar: [
        "التدرب على محادثة صعبة مع تقييم",
        "قراءة الموقف دون إفراط في التفكير",
        "وضع حد بوضوح ولطف",
      ],
    },
    skills: {
      en: ["Communication", "Emotional intelligence", "Assertiveness"],
      ar: ["التواصل", "الذكاء العاطفي", "الحزم"],
    },
    persona: { id: "coach", role: { en: "AI Social Coach", ar: "مدرب اجتماعي ذكي" } },
  }),
  entry({
    slug: "svc-career",
    hub: "personal-growth",
    kind: "advisor",
    to: "/services/career-hub",
    image: careerImg,
    title: { en: "Career Development Hub", ar: "مركز تطوير المسار المهني" },
    tagline: {
      en: "CV, interview and the next real step in your career.",
      ar: "السيرة الذاتية والمقابلة والخطوة الحقيقية التالية في مسارك.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 250,
    intents: ["grow-my-work", "learn-a-skill"],
    keywords: {
      en: ["career", "cv", "resume", "interview", "job", "promotion"],
      ar: ["مهنة", "سيرة ذاتية", "سي في", "مقابلة", "وظيفة", "ترقية"],
    },
    outcomes: {
      en: [
        "Rewrite a CV around outcomes instead of duties",
        "Handle the interview questions you keep failing",
        "Choose a next role that actually compounds",
      ],
      ar: [
        "إعادة كتابة السيرة الذاتية حول الإنجازات لا المهام",
        "التعامل مع أسئلة المقابلة التي تفشل فيها دائماً",
        "اختيار دور تالٍ يبني على ما سبق فعلاً",
      ],
    },
    skills: {
      en: ["Career planning", "Interview technique", "Professional positioning"],
      ar: ["التخطيط المهني", "تقنيات المقابلة", "التموضع المهني"],
    },
    persona: { id: "coach", role: { en: "AI Career Coach", ar: "مدرب مسار مهني ذكي" } },
  }),
  entry({
    slug: "academy",
    hub: "personal-growth",
    kind: "program",
    to: "/academy",
    title: { en: "Visionex Academy", ar: "أكاديمية فيجن إكس" },
    tagline: {
      en: "Full courses, learning paths and verifiable certificates.",
      ar: "دورات كاملة ومسارات تعلم وشهادات قابلة للتحقق.",
    },
    difficulty: "intermediate",
    durationMinutes: 0,
    vx: 0,
    intents: ["learn-a-skill", "grow-my-work"],
    keywords: {
      en: ["academy", "courses", "certificate", "learning", "study", "university"],
      ar: ["أكاديمية", "دورات", "شهادة", "تعلم", "دراسة", "جامعة"],
    },
    outcomes: {
      en: [
        "Follow a structured path instead of scattered lessons",
        "Earn a certificate an employer can verify",
      ],
      ar: [
        "اتباع مسار منظم بدل دروس متفرقة",
        "الحصول على شهادة يستطيع صاحب العمل التحقق منها",
      ],
    },
    skills: {
      en: ["Structured learning", "Credentialing"],
      ar: ["التعلم المنظم", "التأهيل المعتمد"],
    },
  }),
];

// ── Hub 5: Creative Studio ────────────────────────────────────────────
const CREATIVE_STUDIO: ServiceEntry[] = [
  entry({
    slug: "ai-media-studio",
    hub: "creative-studio",
    kind: "studio",
    to: "/services/ai-media-studio",
    title: { en: "AI Media Studio", ar: "استوديو الإعلام الذكي" },
    tagline: {
      en: "Image, voice, video and document production in one place.",
      ar: "إنتاج الصور والصوت والفيديو والمستندات في مكان واحد.",
    },
    difficulty: "intermediate",
    durationMinutes: 0,
    vx: 500,
    intents: ["create-something", "grow-my-work"],
    keywords: {
      en: ["ai", "media", "image", "video", "voice", "generation", "content"],
      ar: ["ذكاء اصطناعي", "إعلام", "صورة", "فيديو", "صوت", "توليد", "محتوى"],
    },
    outcomes: {
      en: [
        "Produce publish-ready assets from a single brief",
        "Keep projects, assets and templates organised",
        "Control cost per generation before you run it",
      ],
      ar: [
        "إنتاج مواد جاهزة للنشر من موجز واحد",
        "تنظيم المشاريع والأصول والقوالب",
        "التحكم في تكلفة كل عملية توليد قبل تشغيلها",
      ],
    },
    skills: {
      en: ["Creative direction", "Asset production", "Prompt craft"],
      ar: ["التوجيه الإبداعي", "إنتاج المواد", "صياغة الأوامر"],
    },
    featured: true,
  }),
  entry({
    slug: "voice-studio",
    hub: "creative-studio",
    kind: "studio",
    to: "/services/ai-media-studio/voice",
    title: { en: "Voice Studio", ar: "استوديو الصوت" },
    tagline: {
      en: "Narration and voice-over in the language your audience speaks.",
      ar: "تعليق صوتي وسرد باللغة التي يتحدثها جمهورك.",
    },
    difficulty: "starter",
    durationMinutes: 0,
    vx: 300,
    intents: ["create-something"],
    keywords: {
      en: ["voice", "tts", "narration", "voiceover", "audio", "speech"],
      ar: ["صوت", "تحويل نص لصوت", "سرد", "تعليق صوتي", "صوتيات", "كلام"],
    },
    outcomes: {
      en: [
        "Generate clean narration for a video or lesson",
        "Match tone and pace to the content",
      ],
      ar: [
        "إنتاج سرد نظيف لفيديو أو درس",
        "مطابقة النبرة والإيقاع مع المحتوى",
      ],
    },
    skills: {
      en: ["Voice direction", "Audio production"],
      ar: ["توجيه الصوت", "إنتاج صوتي"],
    },
    recentlyAdded: true,
  }),
  entry({
    slug: "svc-studio",
    hub: "creative-studio",
    kind: "advisor",
    to: "/services/global-studio",
    image: studioImg,
    title: { en: "Creative Direction Studio", ar: "استوديو التوجيه الإبداعي" },
    tagline: {
      en: "Work with a creative director on the idea, not just the file.",
      ar: "اعمل مع مدير إبداعي على الفكرة لا على الملف فقط.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 300,
    intents: ["create-something", "grow-my-work"],
    keywords: {
      en: ["creative", "content strategy", "campaign", "brand", "storytelling"],
      ar: ["إبداع", "استراتيجية محتوى", "حملة", "علامة تجارية", "سرد"],
    },
    outcomes: {
      en: [
        "Turn a vague idea into a production brief",
        "Build a content plan you can actually sustain",
      ],
      ar: [
        "تحويل فكرة غامضة إلى موجز إنتاجي",
        "بناء خطة محتوى يمكنك الاستمرار عليها فعلاً",
      ],
    },
    skills: {
      en: ["Creative strategy", "Content planning"],
      ar: ["الاستراتيجية الإبداعية", "تخطيط المحتوى"],
    },
    persona: { id: "creative-director", role: { en: "AI Creative Director", ar: "مدير إبداعي ذكي" } },
  }),
  entry({
    slug: "svc-music",
    hub: "creative-studio",
    kind: "advisor",
    to: "/services/music-conservatory",
    image: musicImg,
    title: { en: "Music Conservatory", ar: "معهد الموسيقى" },
    tagline: {
      en: "Theory and technique taught at the level you are at.",
      ar: "نظرية وتقنية تُدرَّس عند مستواك الحالي.",
    },
    difficulty: "intermediate",
    durationMinutes: 30,
    vx: 250,
    intents: ["learn-a-skill", "create-something"],
    keywords: {
      en: ["music theory", "conservatory", "composition", "instrument", "harmony"],
      ar: ["نظرية موسيقية", "معهد", "تأليف", "آلة", "هارموني"],
    },
    outcomes: {
      en: [
        "Understand the theory behind what you already play",
        "Analyse a piece rather than only imitate it",
      ],
      ar: [
        "فهم النظرية خلف ما تعزفه بالفعل",
        "تحليل المقطوعة بدل تقليدها فقط",
      ],
    },
    skills: {
      en: ["Music theory", "Composition", "Analysis"],
      ar: ["النظرية الموسيقية", "التأليف", "التحليل"],
    },
    persona: { id: "creative-director", role: { en: "AI Conservatory Instructor", ar: "مدرس معهد ذكي" } },
  }),
  entry({
    slug: "ocr-scan",
    hub: "creative-studio",
    kind: "tool",
    to: "/services/ocr-scan",
    title: { en: "OCR & Document Reader", ar: "قارئ المستندات والنصوص" },
    tagline: {
      en: "Turn any printed page into text you can read, search and hear.",
      ar: "حوّل أي صفحة مطبوعة إلى نص يمكن قراءته والبحث فيه وسماعه.",
    },
    difficulty: "starter",
    durationMinutes: 0,
    vx: 10,
    intents: ["create-something", "learn-a-skill"],
    keywords: {
      en: ["ocr", "scan", "text", "document", "read aloud", "accessibility"],
      ar: ["تعرف ضوئي", "مسح", "نص", "مستند", "قراءة صوتية", "إتاحة"],
    },
    outcomes: {
      en: [
        "Extract accurate text from a photo or scan",
        "Have a document read aloud in your language",
      ],
      ar: [
        "استخراج نص دقيق من صورة أو مسح ضوئي",
        "الاستماع إلى المستند مقروءاً بلغتك",
      ],
    },
    skills: { en: ["Document digitisation"], ar: ["رقمنة المستندات"] },
  }),
  entry({
    slug: "file-studio",
    hub: "creative-studio",
    kind: "tool",
    to: "/services/file-studio",
    title: { en: "File Studio", ar: "استوديو الملفات" },
    tagline: {
      en: "Convert, compress and repair files without installing anything.",
      ar: "حوّل واضغط وأصلح الملفات دون تثبيت أي برنامج.",
    },
    difficulty: "starter",
    durationMinutes: 0,
    vx: 20,
    intents: ["create-something", "grow-my-work"],
    keywords: {
      en: ["convert", "compress", "pdf", "image", "audio", "files"],
      ar: ["تحويل", "ضغط", "بي دي إف", "صورة", "صوت", "ملفات"],
    },
    outcomes: {
      en: ["Get a file into the format the other side needs", "Reduce size without ruining quality"],
      ar: ["تحويل الملف للصيغة التي يحتاجها الطرف الآخر", "تقليل الحجم دون إفساد الجودة"],
    },
    skills: { en: ["File handling"], ar: ["التعامل مع الملفات"] },
  }),
  entry({
    slug: "live-tv",
    hub: "creative-studio",
    kind: "studio",
    to: "/services/live-tv",
    title: { en: "VisionTV", ar: "فيجن تي في" },
    tagline: {
      en: "Live channels, sports and news in HD and 4K.",
      ar: "قنوات مباشرة ورياضة وأخبار بجودة HD و4K.",
    },
    difficulty: "starter",
    durationMinutes: 0,
    vx: 0,
    intents: ["create-something"],
    keywords: {
      en: ["tv", "live", "channels", "streaming", "sports", "news"],
      ar: ["تلفزيون", "مباشر", "قنوات", "بث", "رياضة", "أخبار"],
    },
    outcomes: { en: ["Watch live channels with a saved favourites list"], ar: ["مشاهدة القنوات المباشرة مع قائمة مفضلة محفوظة"] },
    skills: { en: [], ar: [] },
  }),
  entry({
    slug: "live-radio",
    hub: "creative-studio",
    kind: "studio",
    to: "/services/live-radio",
    title: { en: "VisionRadio", ar: "فيجن راديو" },
    tagline: {
      en: "Music, news and Quran stations, always on.",
      ar: "محطات موسيقى وأخبار وقرآن، متاحة دائماً.",
    },
    difficulty: "starter",
    durationMinutes: 0,
    vx: 0,
    intents: ["create-something"],
    keywords: {
      en: ["radio", "stations", "music", "quran", "audio", "live"],
      ar: ["راديو", "محطات", "موسيقى", "قرآن", "صوت", "مباشر"],
    },
    outcomes: { en: ["Listen to live stations with low data use"], ar: ["الاستماع للمحطات المباشرة باستهلاك بيانات منخفض"] },
    skills: { en: [], ar: [] },
  }),
];

// ── Hub 6: Professional Services Marketplace ──────────────────────────
const MARKETPLACE: ServiceEntry[] = [
  entry({
    slug: "tech-consulting",
    hub: "marketplace",
    kind: "service",
    to: "/services/tech-consulting",
    image: consultingImg,
    title: { en: "Technical Consulting", ar: "الاستشارات التقنية" },
    tagline: {
      en: "Expert guidance on assistive technology and accessible setups.",
      ar: "إرشاد متخصص في التقنيات المساعدة والإعدادات الميسّرة.",
    },
    difficulty: "intermediate",
    durationMinutes: 60,
    vx: 20_000,
    intents: ["grow-my-work", "fix-a-device"],
    keywords: {
      en: ["consulting", "accessibility", "screen reader", "assistive", "advice"],
      ar: ["استشارات", "إتاحة", "قارئ شاشة", "تقنيات مساعدة", "نصيحة"],
    },
    outcomes: {
      en: ["A written recommendation you can act on", "A setup plan matched to your devices"],
      ar: ["توصية مكتوبة قابلة للتنفيذ", "خطة إعداد تناسب أجهزتك"],
    },
    skills: { en: [], ar: [] },
    featured: true,
  }),
  entry({
    slug: "training",
    hub: "marketplace",
    kind: "service",
    to: "/services/training",
    image: trainingImg,
    title: { en: "Training & Device Setup", ar: "التدريب وإعداد الأجهزة" },
    tagline: {
      en: "Hands-on sessions until the tool actually works for you.",
      ar: "جلسات عملية حتى تعمل الأداة فعلاً من أجلك.",
    },
    difficulty: "starter",
    durationMinutes: 90,
    vx: 40_000,
    intents: ["learn-a-skill", "fix-a-device"],
    keywords: {
      en: ["training", "setup", "onboarding", "device", "lessons"],
      ar: ["تدريب", "إعداد", "تهيئة", "جهاز", "دروس"],
    },
    outcomes: {
      en: ["A configured device you can use unaided", "A short guide written for you"],
      ar: ["جهاز مهيأ يمكنك استخدامه بمفردك", "دليل مختصر مكتوب خصيصاً لك"],
    },
    skills: { en: [], ar: [] },
  }),
  entry({
    slug: "import-purchasing",
    hub: "marketplace",
    kind: "service",
    to: "/services/import-purchasing",
    image: importImg,
    title: { en: "Import & Purchasing", ar: "الاستيراد والشراء" },
    tagline: {
      en: "We source and import from vetted global suppliers.",
      ar: "نوفر ونستورد من موردين عالميين موثوقين.",
    },
    difficulty: "intermediate",
    durationMinutes: 0,
    vx: 60_000,
    intents: ["grow-my-work", "start-a-business"],
    keywords: {
      en: ["import", "sourcing", "purchasing", "suppliers", "shipping"],
      ar: ["استيراد", "توريد", "شراء", "موردون", "شحن"],
    },
    outcomes: {
      en: ["A landed-cost quote before you commit", "Order tracking to delivery"],
      ar: ["عرض سعر شامل التكلفة النهائية قبل الالتزام", "تتبع الطلب حتى التسليم"],
    },
    skills: { en: [], ar: [] },
  }),
  entry({
    slug: "digital-marketing",
    hub: "marketplace",
    kind: "service",
    to: "/services/digital-marketing",
    image: digitalMarketingImg,
    title: { en: "Digital Marketing", ar: "التسويق الرقمي" },
    tagline: {
      en: "Reach your audience with inclusive campaigns that convert.",
      ar: "اصل إلى جمهورك بحملات شاملة تحقق نتائج.",
    },
    difficulty: "intermediate",
    durationMinutes: 0,
    vx: 90_000,
    intents: ["grow-my-work"],
    keywords: {
      en: ["marketing", "seo", "ads", "social media", "campaign", "growth"],
      ar: ["تسويق", "تحسين محركات البحث", "إعلانات", "سوشيال ميديا", "حملة", "نمو"],
    },
    outcomes: {
      en: ["A campaign plan with measurable targets", "Monthly reporting you can read"],
      ar: ["خطة حملة بأهداف قابلة للقياس", "تقارير شهرية مفهومة"],
    },
    skills: { en: [], ar: [] },
  }),
  entry({
    slug: "web-design",
    hub: "marketplace",
    kind: "service",
    to: "/services/web-design",
    image: webDesignImg,
    title: { en: "Website Design", ar: "تصميم المواقع" },
    tagline: {
      en: "Accessible, fast websites built to modern standards.",
      ar: "مواقع ميسّرة وسريعة مبنية وفق المعايير الحديثة.",
    },
    difficulty: "advanced",
    durationMinutes: 0,
    vx: 130_000,
    intents: ["grow-my-work", "create-something"],
    keywords: {
      en: ["website", "web design", "accessibility", "responsive", "wcag"],
      ar: ["موقع", "تصميم ويب", "إتاحة", "متجاوب", "معايير"],
    },
    outcomes: {
      en: ["A launched, accessible site", "Handover documentation and training"],
      ar: ["موقع منشور وميسّر", "توثيق التسليم والتدريب"],
    },
    skills: { en: [], ar: [] },
    featured: true,
  }),
  entry({
    slug: "svc-legal",
    hub: "marketplace",
    kind: "advisor",
    to: "/services/legal-advisor",
    title: { en: "Legal Advisory", ar: "الاستشارات القانونية" },
    tagline: {
      en: "Contracts, rights and business law explained plainly.",
      ar: "العقود والحقوق وقانون الأعمال بشرح واضح.",
    },
    difficulty: "advanced",
    durationMinutes: 30,
    vx: 400,
    intents: ["grow-my-work", "start-a-business"],
    keywords: {
      en: ["legal", "contract", "rights", "law", "agreement", "compliance"],
      ar: ["قانوني", "عقد", "حقوق", "قانون", "اتفاقية", "امتثال"],
    },
    outcomes: {
      en: [
        "Understand what a clause actually commits you to",
        "Know which questions to take to a licensed lawyer",
      ],
      ar: [
        "فهم ما يلزمك به بند معين فعلاً",
        "معرفة الأسئلة التي يجب طرحها على محامٍ مرخص",
      ],
    },
    skills: { en: ["Contract literacy"], ar: ["فهم العقود"] },
    persona: { id: "business-consultant", role: { en: "AI Legal Advisor", ar: "مستشار قانوني ذكي" } },
  }),
  entry({
    slug: "svc-travel-agency",
    hub: "marketplace",
    kind: "advisor",
    to: "/services/travel-agency",
    title: { en: "Travel Planning", ar: "تخطيط السفر" },
    tagline: {
      en: "Itineraries, budgets and bookings that fit together.",
      ar: "برامج وميزانيات وحجوزات متناسقة.",
    },
    difficulty: "starter",
    durationMinutes: 25,
    vx: 200,
    intents: ["care-for-myself", "grow-my-work"],
    keywords: {
      en: ["travel", "trip", "itinerary", "booking", "flights", "hotels"],
      ar: ["سفر", "رحلة", "برنامج", "حجز", "طيران", "فنادق"],
    },
    outcomes: {
      en: ["A day-by-day itinerary within a real budget", "A booking checklist in order"],
      ar: ["برنامج يومي ضمن ميزانية واقعية", "قائمة حجوزات مرتبة"],
    },
    skills: { en: ["Trip planning", "Budgeting"], ar: ["تخطيط الرحلات", "إعداد الميزانية"] },
    persona: { id: "operations-lead", role: { en: "AI Travel Planner", ar: "مخطط سفر ذكي" } },
  }),
  entry({
    slug: "svc-shared-trip",
    hub: "marketplace",
    kind: "advisor",
    to: "/services/shared-trip",
    title: { en: "Shared Trip Planner", ar: "مخطط الرحلات المشتركة" },
    tagline: {
      en: "Coordinate a group trip without the group chat chaos.",
      ar: "نسّق رحلة جماعية دون فوضى مجموعة المحادثة.",
    },
    difficulty: "starter",
    durationMinutes: 20,
    vx: 150,
    intents: ["care-for-myself"],
    keywords: {
      en: ["group trip", "carpool", "shared", "split cost", "coordination"],
      ar: ["رحلة جماعية", "مشاركة سيارة", "مشترك", "تقسيم التكلفة", "تنسيق"],
    },
    outcomes: {
      en: ["A route and schedule everyone agreed to", "A fair cost split"],
      ar: ["مسار وجدول اتفق عليه الجميع", "تقسيم عادل للتكلفة"],
    },
    skills: { en: ["Coordination"], ar: ["التنسيق"] },
    persona: { id: "operations-lead", role: { en: "AI Trip Coordinator", ar: "منسق رحلات ذكي" } },
  }),
];

export const SERVICE_CATALOG: ServiceEntry[] = [
  ...BUSINESS_LAB,
  ...TECH_REPAIR,
  ...ENGINEERING,
  ...PERSONAL_GROWTH,
  ...CREATIVE_STUDIO,
  ...MARKETPLACE,
];

const BY_SLUG = new Map<string, ServiceEntry>(SERVICE_CATALOG.map((e) => [e.slug, e]));

export function getServiceEntry(slug: string | undefined | null): ServiceEntry | undefined {
  return slug ? BY_SLUG.get(slug) : undefined;
}

export function entriesForHub(hub: HubId): ServiceEntry[] {
  return SERVICE_CATALOG.filter((e) => e.hub === hub);
}

export function entriesForIntent(intent: Intent): ServiceEntry[] {
  return SERVICE_CATALOG.filter((e) => e.intents.includes(intent));
}

export function featuredEntries(): ServiceEntry[] {
  return SERVICE_CATALOG.filter((e) => e.featured);
}

export function hubCounts(): Record<HubId, number> {
  return SERVICE_CATALOG.reduce(
    (acc, e) => {
      acc[e.hub] = (acc[e.hub] ?? 0) + 1;
      return acc;
    },
    {} as Record<HubId, number>
  );
}

/** Ascending order used for sorting and for the difficulty meter. */
export const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  starter: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};
