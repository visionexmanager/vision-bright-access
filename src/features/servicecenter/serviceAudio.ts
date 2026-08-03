import { SERVICE_CATALOG } from "./catalog";
import type { AudioLicenseStatus } from "../arcade/audio/types";
import type { LocalizedText } from "./types";

/**
 * Audio identity for the Service Center.
 *
 * This follows the arcade's rule: an asset is declared here with its intended
 * character and provenance, and the player refuses to fire it until real,
 * licensed audio has been produced and approved. Declaring the plan is useful;
 * shipping placeholder audio as if it were final is not.
 *
 * The production brief for each asset lives in `SERVICE_AUDIO_PRODUCTION.md`.
 */

export type AudioRole = "ambience" | "cue";

export interface ServiceAudioAsset {
  id: string;
  role: AudioRole;
  /** What the listener should feel — this is the brief given to the producer. */
  brief: LocalizedText;
  /** Target loudness so the whole section sits at one level. */
  normalizedLufs: number;
  loop: boolean;
  licenseStatus: AudioLicenseStatus;
  /** Resolved file, empty until production delivers and licensing approves. */
  src: string;
  /**
   * Cues that carry meaning must also exist as text for screen-reader users
   * and anyone with sound off. A cue without this is decoration, not
   * information.
   */
  announce?: LocalizedText;
}

const pending = (
  asset: Omit<ServiceAudioAsset, "licenseStatus" | "src">
): ServiceAudioAsset => ({
  ...asset,
  licenseStatus: "pending",
  src: "",
});

const AMBIENCE: ServiceAudioAsset[] = [
  pending({
    id: "server-room",
    role: "ambience",
    loop: true,
    normalizedLufs: -30,
    brief: {
      en: "Cold, steady rack noise — layered fan hum with a faint air-handling wash. No music, no melody.",
      ar: "ضجيج خزائن سيرفرات بارد وثابت — طبقات من أزيز المراوح مع همس تكييف خفيف. بلا موسيقى أو لحن.",
    },
  }),
  pending({
    id: "farm-barn",
    role: "ambience",
    loop: true,
    normalizedLufs: -28,
    brief: {
      en: "Sheltered barn interior: distant animals, straw movement, an occasional metal gate.",
      ar: "داخل حظيرة مسقوفة: حيوانات بعيدة وحركة قش وبوابة معدنية أحياناً.",
    },
  }),
  pending({
    id: "farm-field",
    role: "ambience",
    loop: true,
    normalizedLufs: -30,
    brief: {
      en: "Open pasture: wind across grass, sparse birds, very wide and quiet.",
      ar: "مرعى مفتوح: رياح على العشب وطيور متفرقة، مساحة واسعة وهادئة جداً.",
    },
  }),
  pending({
    id: "lab-clean",
    role: "ambience",
    loop: true,
    normalizedLufs: -32,
    brief: {
      en: "Clean lab: extraction fan, soft room tone, occasional glass contact. Almost silent.",
      ar: "مختبر نظيف: مروحة شفط ونبرة غرفة ناعمة وتلامس زجاج أحياناً. شبه صامت.",
    },
  }),
  pending({
    id: "lab-industrial",
    role: "ambience",
    loop: true,
    normalizedLufs: -28,
    brief: {
      en: "Small production room: mixer motor, pump rhythm, hard surfaces.",
      ar: "غرفة إنتاج صغيرة: محرك خلاط وإيقاع مضخة وأسطح صلبة.",
    },
  }),
  pending({
    id: "workshop-bench",
    role: "ambience",
    loop: true,
    normalizedLufs: -30,
    brief: {
      en: "Repair bench: quiet room, faint fan, small tools set down on a mat.",
      ar: "طاولة صيانة: غرفة هادئة ومروحة خافتة وأدوات صغيرة توضع على حصيرة.",
    },
  }),
  pending({
    id: "workshop-wood",
    role: "ambience",
    loop: true,
    normalizedLufs: -26,
    brief: {
      en: "Carpentry shop between cuts: dust extractor idling, wood being shifted.",
      ar: "ورشة نجارة بين القطعات: شافط غبار يعمل بهدوء وخشب يُحرَّك.",
    },
  }),
  pending({
    id: "garage-bay",
    role: "ambience",
    loop: true,
    normalizedLufs: -26,
    brief: {
      en: "Vehicle workshop: compressor cycling, distant engine, concrete reverberation.",
      ar: "ورشة مركبات: كمبريسر يعمل بشكل دوري ومحرك بعيد وصدى خرسانة.",
    },
  }),
  pending({
    id: "plant-outdoor",
    role: "ambience",
    loop: true,
    normalizedLufs: -30,
    brief: {
      en: "Solar field: inverter hum, cooling fans, open-air wind. Bright and electrical.",
      ar: "حقل شمسي: أزيز إنفرتر ومراوح تبريد ورياح في الهواء الطلق. حاد وكهربائي.",
    },
  }),
  pending({
    id: "plant-room",
    role: "ambience",
    loop: true,
    normalizedLufs: -26,
    brief: {
      en: "Mechanical plant room: compressor load, air handler rush, enclosed and loud.",
      ar: "غرفة معدات ميكانيكية: حمل الكمبريسر واندفاع مناولة الهواء، مغلقة وعالية.",
    },
  }),
  pending({
    id: "factory-line",
    role: "ambience",
    loop: true,
    normalizedLufs: -26,
    brief: {
      en: "Food production line: conveyor rhythm, wrapping machinery, steady and mechanical.",
      ar: "خط إنتاج غذائي: إيقاع سير ناقل وماكينات تغليف، ثابت وميكانيكي.",
    },
  }),
  pending({
    id: "kitchen-service",
    role: "ambience",
    loop: true,
    normalizedLufs: -24,
    brief: {
      en: "Restaurant kitchen mid-service: extraction, pans, controlled urgency, no shouting.",
      ar: "مطبخ مطعم أثناء الخدمة: شفط ومقالي وإيقاع سريع منضبط دون صراخ.",
    },
  }),
  pending({
    id: "salon-floor",
    role: "ambience",
    loop: true,
    normalizedLufs: -30,
    brief: {
      en: "Salon: low conversation, hairdryer in another chair, relaxed.",
      ar: "صالون: حديث خافت ومجفف شعر على كرسي آخر، أجواء مسترخية.",
    },
  }),
  pending({
    id: "warehouse",
    role: "ambience",
    loop: true,
    normalizedLufs: -28,
    brief: {
      en: "Distribution warehouse: forklift in the distance, roller doors, large empty space.",
      ar: "مستودع توزيع: رافعة شوكية بعيدة وأبواب متحركة ومساحة كبيرة فارغة.",
    },
  }),
  pending({
    id: "bridge-marine",
    role: "ambience",
    loop: true,
    normalizedLufs: -30,
    brief: {
      en: "Ship's bridge: hull rumble, radar sweep, occasional radio squelch.",
      ar: "غرفة قيادة سفينة: هدير بدن السفينة ومسح الرادار وصفير لاسلكي أحياناً.",
    },
  }),
  pending({
    id: "site-construction",
    role: "ambience",
    loop: true,
    normalizedLufs: -26,
    brief: {
      en: "Fit-out site: distant drilling, material handling, outdoor openness.",
      ar: "موقع تجهيز: حفر بعيد ومناولة مواد وأجواء خارجية مفتوحة.",
    },
  }),
  pending({
    id: "trading-floor",
    role: "ambience",
    loop: true,
    normalizedLufs: -30,
    brief: {
      en: "Modern trading desk: keyboard activity, muted alerts, focused not chaotic.",
      ar: "مكتب تداول حديث: نشاط لوحات مفاتيح وتنبيهات خافتة، مركّز لا فوضوي.",
    },
  }),
  pending({
    id: "study-quiet",
    role: "ambience",
    loop: true,
    normalizedLufs: -34,
    brief: {
      en: "Quiet study room. Near-silent room tone only — nothing that competes with speech.",
      ar: "غرفة دراسة هادئة. نبرة غرفة شبه صامتة فقط — لا شيء ينافس الكلام.",
    },
  }),
  pending({
    id: "studio-practice",
    role: "ambience",
    loop: true,
    normalizedLufs: -34,
    brief: {
      en: "Treated practice room: dry, close, no reverb tail.",
      ar: "غرفة تدريب معالجة صوتياً: جافة وقريبة وبلا صدى.",
    },
  }),
];

const CUES: ServiceAudioAsset[] = [
  pending({
    id: "alarm-temp",
    role: "cue",
    loop: false,
    normalizedLufs: -16,
    brief: {
      en: "Temperature out of range. Urgent but not panic-inducing — two rising tones.",
      ar: "خروج الحرارة عن النطاق. عاجل دون إثارة ذعر — نغمتان صاعدتان.",
    },
    announce: {
      en: "Temperature outside the safe range",
      ar: "درجة الحرارة خارج النطاق الآمن",
    },
  }),
  pending({
    id: "alert-critical",
    role: "cue",
    loop: false,
    normalizedLufs: -14,
    brief: {
      en: "Critical incident opened. Sharp, unmistakable, one hit.",
      ar: "فتح حادث حرج. حاد وواضح، نغمة واحدة.",
    },
    announce: { en: "Critical incident raised", ar: "تم رفع حادث حرج" },
  }),
  pending({
    id: "alarm-fault",
    role: "cue",
    loop: false,
    normalizedLufs: -16,
    brief: { en: "Equipment fault detected — descending two-tone.", ar: "اكتشاف عطل في المعدات — نغمتان هابطتان." },
    announce: { en: "Equipment fault detected", ar: "تم اكتشاف عطل في المعدات" },
  }),
  pending({
    id: "alert-drop",
    role: "cue",
    loop: false,
    normalizedLufs: -18,
    brief: { en: "Market or metric fell sharply — short descending tone.", ar: "هبوط حاد في السوق أو المؤشر — نغمة هابطة قصيرة." },
    announce: { en: "Sharp drop", ar: "هبوط حاد" },
  }),
  pending({
    id: "correct-chime",
    role: "cue",
    loop: false,
    normalizedLufs: -18,
    brief: { en: "Correct answer. Warm, short, never triumphant.", ar: "إجابة صحيحة. دافئة وقصيرة وغير مبالغة." },
    announce: { en: "Correct", ar: "إجابة صحيحة" },
  }),
  pending({
    id: "retry-tone",
    role: "cue",
    loop: false,
    normalizedLufs: -20,
    brief: { en: "Try again. Neutral, never punishing.", ar: "حاول مرة أخرى. محايدة وغير معاقِبة." },
    announce: { en: "Try again", ar: "حاول مرة أخرى" },
  }),
  pending({
    id: "level-up",
    role: "cue",
    loop: false,
    normalizedLufs: -16,
    brief: { en: "Skill level gained. Bright three-note rise.", ar: "ارتفاع مستوى المهارة. ثلاث نغمات صاعدة مشرقة." },
    announce: { en: "Level up", ar: "ارتقاء مستوى" },
  }),
  pending({ id: "incubator-hum", role: "cue", loop: true, normalizedLufs: -30, brief: { en: "Incubator running normally.", ar: "الحاضنة تعمل بشكل طبيعي." } }),
  pending({ id: "hatch-chirp", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "A chick hatches — single natural chirp.", ar: "فقس كتكوت — زقزقة طبيعية واحدة." }, announce: { en: "A chick hatched", ar: "فقس كتكوت" } }),
  pending({ id: "milking-machine", role: "cue", loop: true, normalizedLufs: -28, brief: { en: "Milking machine pulse.", ar: "نبض ماكينة الحلب." } }),
  pending({ id: "cattle-low", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Single distant cow.", ar: "بقرة واحدة بعيدة." } }),
  pending({ id: "sheep-flock", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Small flock, sparse not comedic.", ar: "قطيع صغير، متفرق وغير كوميدي." } }),
  pending({ id: "poultry-flock", role: "cue", loop: true, normalizedLufs: -26, brief: { en: "Broiler house at low density.", ar: "عنبر دواجن بكثافة منخفضة." } }),
  pending({ id: "feeder-run", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Automatic feeder cycle.", ar: "دورة تغذية آلية." } }),
  pending({ id: "shears", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Electric shears passing through wool.", ar: "مقص كهربائي يمر عبر الصوف." } }),
  pending({ id: "gate-latch", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Metal field gate latching.", ar: "إغلاق بوابة حقل معدنية." } }),
  pending({ id: "weather-wind", role: "cue", loop: true, normalizedLufs: -30, brief: { en: "Wind rising over open ground.", ar: "رياح تشتد فوق أرض مفتوحة." } }),
  pending({ id: "glass-clink", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Laboratory glassware contact.", ar: "تلامس زجاجيات مختبر." } }),
  pending({ id: "scale-beep", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Precision scale confirms a weight.", ar: "ميزان دقيق يؤكد الوزن." }, announce: { en: "Weight recorded", ar: "تم تسجيل الوزن" } }),
  pending({ id: "mixer-run", role: "cue", loop: true, normalizedLufs: -26, brief: { en: "Industrial mixer under load.", ar: "خلاط صناعي تحت الحمل." } }),
  pending({ id: "homogeniser", role: "cue", loop: true, normalizedLufs: -26, brief: { en: "High-shear homogeniser.", ar: "مجانس عالي القص." } }),
  pending({ id: "pump-flow", role: "cue", loop: true, normalizedLufs: -28, brief: { en: "Liquid moving through a transfer pump.", ar: "سائل يتحرك عبر مضخة نقل." } }),
  pending({ id: "conveyor", role: "cue", loop: true, normalizedLufs: -28, brief: { en: "Production conveyor running.", ar: "سير ناقل يعمل." } }),
  pending({ id: "tempering-machine", role: "cue", loop: true, normalizedLufs: -28, brief: { en: "Chocolate tempering machine.", ar: "ماكينة تلطيف شوكولاتة." } }),
  pending({ id: "wrap-seal", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Wrapper heat-seals a pack.", ar: "ماكينة تغليف تلحم العبوة حرارياً." } }),
  pending({ id: "ticket-printer", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Kitchen order printer.", ar: "طابعة طلبات المطبخ." }, announce: { en: "New order", ar: "طلب جديد" } }),
  pending({ id: "pan-sizzle", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Ingredients hitting a hot pan.", ar: "مكونات تلامس مقلاة ساخنة." } }),
  pending({ id: "bell-pass", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Pass bell — a dish is ready.", ar: "جرس التمرير — الطبق جاهز." }, announce: { en: "Dish ready", ar: "الطبق جاهز" } }),
  pending({ id: "clippers", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Salon clippers.", ar: "ماكينة حلاقة." } }),
  pending({ id: "till-ping", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Payment accepted.", ar: "تم قبول الدفع." }, announce: { en: "Payment received", ar: "تم استلام الدفع" } }),
  pending({ id: "door-chime", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "A customer enters.", ar: "دخول عميل." }, announce: { en: "Customer arrived", ar: "وصل عميل" } }),
  pending({ id: "rack-fans", role: "cue", loop: true, normalizedLufs: -30, brief: { en: "Server rack fans spinning up under load.", ar: "مراوح خزانة سيرفرات تتسارع تحت الحمل." } }),
  pending({ id: "keyboard-fast", role: "cue", loop: false, normalizedLufs: -26, brief: { en: "Rapid keyboard entry during an incident.", ar: "كتابة سريعة أثناء حادث." } }),
  pending({ id: "screwdriver", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Precision screwdriver turning a small screw.", ar: "مفك دقيق يدير برغياً صغيراً." } }),
  pending({ id: "heat-gun", role: "cue", loop: true, normalizedLufs: -26, brief: { en: "Hot-air rework station.", ar: "محطة هواء ساخن للإصلاح." } }),
  pending({ id: "solder-station", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Solder melting on a joint.", ar: "ذوبان اللحام على نقطة اتصال." } }),
  pending({ id: "microscope-focus", role: "cue", loop: false, normalizedLufs: -26, brief: { en: "Microscope focus adjustment.", ar: "ضبط تركيز المجهر." } }),
  pending({ id: "beep-test", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Multimeter continuity beep.", ar: "صفير اختبار الاستمرارية بالملتيميتر." }, announce: { en: "Continuity confirmed", ar: "تم تأكيد الاستمرارية" } }),
  pending({ id: "beep-post", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "System POST beep.", ar: "صفير فحص الإقلاع." }, announce: { en: "System posted", ar: "اجتاز النظام الفحص" } }),
  pending({ id: "fan-spin", role: "cue", loop: false, normalizedLufs: -26, brief: { en: "Cooling fan spinning up.", ar: "مروحة تبريد تبدأ الدوران." } }),
  pending({ id: "engine-idle", role: "cue", loop: true, normalizedLufs: -24, brief: { en: "Engine idling in a workshop bay.", ar: "محرك يعمل بالحد الأدنى داخل الورشة." } }),
  pending({ id: "impact-wrench", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Impact wrench burst.", ar: "دفعة مفتاح صدمي." } }),
  pending({ id: "scanner-beep", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Diagnostic scanner reads a code.", ar: "جهاز الفحص يقرأ كوداً." }, announce: { en: "Fault code read", ar: "تمت قراءة كود العطل" } }),
  pending({ id: "inverter-hum", role: "cue", loop: true, normalizedLufs: -28, brief: { en: "Solar inverter under load.", ar: "إنفرتر شمسي تحت الحمل." } }),
  pending({ id: "cooling-fans", role: "cue", loop: true, normalizedLufs: -30, brief: { en: "Equipment cooling fans.", ar: "مراوح تبريد المعدات." } }),
  pending({ id: "compressor", role: "cue", loop: true, normalizedLufs: -26, brief: { en: "HVAC compressor starting.", ar: "بدء تشغيل كمبريسر التكييف." } }),
  pending({ id: "air-handler", role: "cue", loop: true, normalizedLufs: -28, brief: { en: "Air handling unit airflow.", ar: "تدفق هواء وحدة المناولة." } }),
  pending({ id: "cutting-saw", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Aluminium profile being cut.", ar: "قص قطاع ألمنيوم." } }),
  pending({ id: "glass-handling", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Glass panel being moved with suction cups.", ar: "تحريك لوح زجاج بأكواب شفط." } }),
  pending({ id: "drill", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Drilling into a fixing point.", ar: "حفر في نقطة تثبيت." } }),
  pending({ id: "saw-cut", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Timber cut on a bench saw.", ar: "قص خشب على منشار طاولة." } }),
  pending({ id: "sander", role: "cue", loop: true, normalizedLufs: -26, brief: { en: "Orbital sander on a surface.", ar: "صنفرة دوارة على سطح." } }),
  pending({ id: "hammer-tap", role: "cue", loop: false, normalizedLufs: -22, brief: { en: "Light mallet tap seating a joint.", ar: "طرقة مطرقة خفيفة لتثبيت وصلة." } }),
  pending({ id: "forklift", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Forklift reversing in a warehouse.", ar: "رافعة شوكية ترجع للخلف في مستودع." } }),
  pending({ id: "roller-door", role: "cue", loop: false, normalizedLufs: -24, brief: { en: "Warehouse roller door opening.", ar: "فتح باب مستودع متحرك." } }),
  pending({ id: "radar-sweep", role: "cue", loop: true, normalizedLufs: -30, brief: { en: "Marine radar sweep.", ar: "مسح رادار بحري." } }),
  pending({ id: "vhf-chatter", role: "cue", loop: false, normalizedLufs: -28, brief: { en: "Distant VHF radio traffic, words not intelligible.", ar: "حركة لاسلكي بعيدة، الكلمات غير مفهومة." } }),
  pending({ id: "ticker", role: "cue", loop: false, normalizedLufs: -26, brief: { en: "Price update tick.", ar: "نبضة تحديث سعر." } }),
  pending({ id: "deal-confirm", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "Trade executed.", ar: "تم تنفيذ الصفقة." }, announce: { en: "Trade executed", ar: "تم تنفيذ الصفقة" } }),
  pending({ id: "metronome", role: "cue", loop: true, normalizedLufs: -24, brief: { en: "Metronome click at practice tempo.", ar: "نقرة مترونوم بإيقاع التدريب." } }),
  pending({ id: "note-correct", role: "cue", loop: false, normalizedLufs: -20, brief: { en: "The played note matches the target.", ar: "النغمة المعزوفة تطابق المستهدفة." }, announce: { en: "Correct note", ar: "نغمة صحيحة" } }),
  pending({ id: "applause", role: "cue", loop: false, normalizedLufs: -18, brief: { en: "Small, warm audience applause. Not a stadium.", ar: "تصفيق جمهور صغير ودافئ. ليس ملعباً." } }),
];

export const SERVICE_AUDIO_ASSETS: ServiceAudioAsset[] = [...AMBIENCE, ...CUES];

const BY_ID = new Map<string, ServiceAudioAsset>(SERVICE_AUDIO_ASSETS.map((a) => [a.id, a]));

export function getAudioAsset(id: string): ServiceAudioAsset | undefined {
  return BY_ID.get(id);
}

/** True only when the file exists and licensing has cleared it for release. */
export function isPlayable(asset: ServiceAudioAsset | undefined): boolean {
  return !!asset && asset.licenseStatus === "approved" && asset.src.trim() !== "";
}

export interface AudioCoverageReport {
  totalReferenced: number;
  declared: number;
  playable: number;
  /** Referenced by the catalog but never declared here — a genuine gap. */
  missing: string[];
  /** Declared but not yet produced or licensed. */
  awaitingProduction: string[];
}

/**
 * Reports the gap between what the catalog promises and what can actually
 * play. The Service Center uses this to stay quiet rather than fake it.
 */
export function auditAudioCoverage(): AudioCoverageReport {
  const referenced = new Set<string>();
  for (const entry of SERVICE_CATALOG) {
    if (!entry.audio) continue;
    referenced.add(entry.audio.ambience);
    entry.audio.cues.forEach((cue) => referenced.add(cue));
  }

  const missing: string[] = [];
  const awaitingProduction: string[] = [];
  let playable = 0;

  for (const id of referenced) {
    const asset = BY_ID.get(id);
    if (!asset) {
      missing.push(id);
      continue;
    }
    if (isPlayable(asset)) playable += 1;
    else awaitingProduction.push(id);
  }

  return {
    totalReferenced: referenced.size,
    declared: referenced.size - missing.length,
    playable,
    missing: missing.sort(),
    awaitingProduction: awaitingProduction.sort(),
  };
}
