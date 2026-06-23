import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSimulationProgress } from "@/hooks/useSimulationProgress";
import { saveSimulationProgress } from "@/utils/saveSimulationProgress";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SimulationMentor } from "@/components/SimulationMentor";
import { CheckCircle, RotateCcw, MessageSquare } from "lucide-react";

interface Props { simulationId?: string }
type Phase = "idle" | "active" | "complete";

interface SvcConfig {
  emoji: string;
  en: string;
  ar: string;
  expertEn: string;
  expertAr: string;
  descEn: string;
  descAr: string;
  stepEn: string;
  stepAr: string;
}

const SVC: Record<string, SvcConfig> = {
  "svc-hair-care": {
    emoji: "✂️",
    en: "Hair Care Studio",
    ar: "صالون العناية بالشعر",
    expertEn: "Professional Hair Stylist",
    expertAr: "خبير تصفيف الشعر",
    descEn: "Consult your AI hair stylist for personalized styling advice, treatment plans, and hair care routines tailored to your hair type.",
    descAr: "استشر خبير الشعر الذكي للحصول على نصائح تصفيف مخصصة وخطط علاجية وروتين عناية مناسب لنوع شعرك.",
    stepEn: "Hair Consultation — Tell me about your hair type and what you'd like to achieve",
    stepAr: "استشارة الشعر — أخبرني عن نوع شعرك وما تريد تحقيقه",
  },
  "svc-skin-care": {
    emoji: "✨",
    en: "Skin Care Clinic",
    ar: "عيادة العناية بالبشرة",
    expertEn: "Skin Care Specialist",
    expertAr: "أخصائي العناية بالبشرة",
    descEn: "Get expert guidance on skincare routines, ingredient selection, and treatments tailored to your skin type and concerns.",
    descAr: "احصل على إرشادات خبير حول روتين العناية بالبشرة واختيار المكونات والعلاجات المناسبة لنوع بشرتك ومشاكلها.",
    stepEn: "Skin Analysis — Describe your skin concerns for a personalized care routine",
    stepAr: "تحليل البشرة — صف لي مشاكل بشرتك للحصول على روتين عناية مخصص",
  },
  "svc-social-guide": {
    emoji: "🤝",
    en: "Social Skills Advisor",
    ar: "مستشار المهارات الاجتماعية",
    expertEn: "Social Intelligence Coach",
    expertAr: "مدرب الذكاء الاجتماعي",
    descEn: "Develop your social skills and emotional intelligence through personalized coaching sessions and real-world scenario practice.",
    descAr: "طوّر مهاراتك الاجتماعية وذكاءك العاطفي من خلال جلسات تدريب شخصية وممارسة السيناريوهات الحياتية.",
    stepEn: "Social Coaching Session — Share your social challenges and the goals you want to reach",
    stepAr: "جلسة التدريب الاجتماعي — شارك تحدياتك الاجتماعية والأهداف التي تريد تحقيقها",
  },
  "svc-delivery": {
    emoji: "🚚",
    en: "VisionEx Express Hub",
    ar: "مركز فيجن إكسبريس",
    expertEn: "Logistics & Delivery Coordinator",
    expertAr: "منسق الشحن والتوصيل",
    descEn: "Simulate urban delivery operations: route planning, driver coordination, fleet management, and real-time logistics optimization.",
    descAr: "محاكاة عمليات التوصيل الحضري: تخطيط المسار وتنسيق السائقين وإدارة الأسطول وتحسين اللوجستيات في الوقت الفعلي.",
    stepEn: "Logistics Consultation — Describe your delivery challenge and let's optimize your operations",
    stepAr: "استشارة لوجستية — صف لي تحدي التوصيل الخاص بك ولنحسّن عملياتك معاً",
  },
  "svc-shared-trip": {
    emoji: "🗺️",
    en: "Shared Trip Planner",
    ar: "مخطط الرحلات المشتركة",
    expertEn: "Group Travel Coordinator",
    expertAr: "منسق رحلات المجموعة",
    descEn: "Plan and coordinate shared trips with AI assistance covering routes, cost splitting, group logistics, and travel arrangements.",
    descAr: "خطط ونسق الرحلات المشتركة بمساعدة الذكاء الاصطناعي للمسارات وتقسيم التكاليف والخدمات الجماعية.",
    stepEn: "Trip Planning — Tell me about your group size, destination, and travel preferences",
    stepAr: "تخطيط الرحلة — أخبرني عن حجم مجموعتك ووجهتك وتفضيلات السفر",
  },
  "svc-sports-coach": {
    emoji: "💪",
    en: "Sports & Fitness Studio",
    ar: "استوديو الرياضة واللياقة",
    expertEn: "Personal Fitness Coach",
    expertAr: "مدرب لياقة شخصي",
    descEn: "Train with your AI fitness coach: customized workout plans, nutrition tips, recovery strategies, and performance tracking.",
    descAr: "تدرّب مع مدرب اللياقة الذكي: خطط تمارين مخصصة ونصائح غذائية واستراتيجيات التعافي وتتبع الأداء.",
    stepEn: "Fitness Assessment — Tell me about your current fitness level, goals, and any limitations",
    stepAr: "تقييم اللياقة — أخبرني عن مستوى لياقتك الحالي وأهدافك وأي قيود لديك",
  },
  "svc-empathy-oasis": {
    emoji: "🧘",
    en: "Universal Empathy Oasis",
    ar: "واحة التعاطف الشاملة",
    expertEn: "Wellbeing & Empathy Guide",
    expertAr: "مرشد الرفاهية والتعاطف",
    descEn: "A safe, supportive space for emotional wellness. Share your feelings and receive compassionate, non-judgmental AI guidance.",
    descAr: "مساحة آمنة وداعمة للصحة العاطفية. شارك مشاعرك واحصل على إرشاد متعاطف وغير منحاز من الذكاء الاصطناعي.",
    stepEn: "Wellness Session — This is a safe space. Share what's on your mind and how you're feeling",
    stepAr: "جلسة الرفاهية — هذه مساحة آمنة. شارك ما يدور في ذهنك وكيف تشعر",
  },
  "svc-nutrition": {
    emoji: "🥗",
    en: "Nutrition Wellness Clinic",
    ar: "عيادة التغذية والصحة",
    expertEn: "Certified Nutrition Expert",
    expertAr: "خبير التغذية المعتمد",
    descEn: "Receive a personalized nutrition plan and evidence-based dietary advice aligned with your health goals and lifestyle.",
    descAr: "احصل على خطة تغذية شخصية ونصائح غذائية مبنية على الأدلة تتوافق مع أهدافك الصحية وأسلوب حياتك.",
    stepEn: "Nutrition Consultation — Tell me about your dietary goals, food preferences, and any health conditions",
    stepAr: "استشارة تغذوية — أخبرني عن أهدافك الغذائية وتفضيلاتك الطعامية وأي حالات صحية",
  },
  "svc-medical": {
    emoji: "🏥",
    en: "Virtual Medical Clinic",
    ar: "العيادة الطبية الافتراضية",
    expertEn: "AI General Practitioner",
    expertAr: "طبيب عام ذكاء اصطناعي",
    descEn: "Discuss symptoms, understand health conditions, and get general medical guidance in a private virtual clinic environment.",
    descAr: "ناقش الأعراض وافهم الحالات الصحية واحصل على إرشادات طبية عامة في بيئة عيادة افتراضية خاصة.",
    stepEn: "Medical Consultation — Describe your symptoms or the health topic you'd like to discuss",
    stepAr: "استشارة طبية — صف لي أعراضك أو الموضوع الصحي الذي تريد مناقشته",
  },
  "svc-psychology": {
    emoji: "🧠",
    en: "Psychology & Mental Wellness",
    ar: "علم النفس والصحة النفسية",
    expertEn: "Mental Health Practitioner",
    expertAr: "أخصائي الصحة النفسية",
    descEn: "Explore your thoughts and emotions with an AI practitioner providing evidence-based psychological support and strategies.",
    descAr: "استكشف أفكارك ومشاعرك مع أخصائي ذكاء اصطناعي يقدم دعماً نفسياً مبنياً على الأدلة واستراتيجيات فعّالة.",
    stepEn: "Therapy Session — I'm here to listen and support you. What's been on your mind lately?",
    stepAr: "جلسة علاجية — أنا هنا للاستماع ودعمك. ما الذي يشغل بالك مؤخراً؟",
  },
  "svc-travel-agency": {
    emoji: "✈️",
    en: "Global Travel Planner",
    ar: "وكالة السفر العالمية",
    expertEn: "Travel Experience Designer",
    expertAr: "مصمم تجارب السفر",
    descEn: "Design your perfect trip with an AI travel expert covering destinations, itineraries, budgets, visa requirements, and bookings.",
    descAr: "صمّم رحلتك المثالية مع خبير سفر ذكاء اصطناعي يغطي الوجهات والبرامج والميزانيات ومتطلبات التأشيرة والحجوزات.",
    stepEn: "Travel Consultation — Where would you like to go, and what kind of experience are you looking for?",
    stepAr: "استشارة سفر — إلى أين تريد الذهاب وما نوع التجربة التي تبحث عنها؟",
  },
  "svc-music": {
    emoji: "🎵",
    en: "Music Conservatory Studio",
    ar: "أكاديمية الموسيقى والفنون",
    expertEn: "Music Instructor & Mentor",
    expertAr: "معلم الموسيقى والإرشاد",
    descEn: "Learn music theory, instrument technique, ear training, and composition with an AI instructor tailored to your skill level.",
    descAr: "تعلّم نظرية الموسيقى وتقنية الآلة وتدريب الأذن والتأليف مع مدرس ذكاء اصطناعي مناسب لمستواك.",
    stepEn: "Music Lesson — What instrument do you play, and what would you like to work on today?",
    stepAr: "درس موسيقى — ما الآلة التي تعزف عليها وعلى ماذا تريد التدرب اليوم؟",
  },
  "svc-studio": {
    emoji: "🎬",
    en: "Global Creative Studio",
    ar: "الاستوديو الإبداعي العالمي",
    expertEn: "Creative Director & Producer",
    expertAr: "مدير إبداعي ومنتج",
    descEn: "Collaborate with an AI creative director on media projects, content strategy, brand identity, and production planning.",
    descAr: "تعاون مع مدير إبداعي ذكاء اصطناعي في مشاريع الإعلام واستراتيجية المحتوى والهوية البصرية وتخطيط الإنتاج.",
    stepEn: "Creative Briefing — Tell me about your project vision, target audience, and creative goals",
    stepAr: "الإحاطة الإبداعية — أخبرني عن رؤية مشروعك والجمهور المستهدف وأهدافك الإبداعية",
  },
  "svc-legal": {
    emoji: "⚖️",
    en: "Legal Advisory Office",
    ar: "مكتب الاستشارات القانونية",
    expertEn: "Legal Advisor",
    expertAr: "مستشار قانوني",
    descEn: "Get clear, practical legal guidance on contracts, rights, business law, and personal legal matters from an AI advisor.",
    descAr: "احصل على إرشادات قانونية واضحة وعملية حول العقود والحقوق وقانون الأعمال والمسائل الشخصية من مستشار ذكاء اصطناعي.",
    stepEn: "Legal Consultation — Describe your legal situation or the question you need guidance on",
    stepAr: "استشارة قانونية — صف وضعك القانوني أو السؤال الذي تحتاج إرشاداً بشأنه",
  },
  "svc-radar-ai": {
    emoji: "📡",
    en: "AI Intelligence Radar",
    ar: "رادار الذكاء الاصطناعي",
    expertEn: "AI Analytics Specialist",
    expertAr: "متخصص تحليلات الذكاء الاصطناعي",
    descEn: "Use AI-powered intelligence analysis to scan data, detect trends, identify risks, and make informed strategic decisions.",
    descAr: "استخدم التحليل الاستخباراتي المدعوم بالذكاء الاصطناعي لمسح البيانات واكتشاف الاتجاهات وتحديد المخاطر واتخاذ قرارات استراتيجية.",
    stepEn: "Intelligence Analysis — Describe the data, market, or situation you'd like to analyze",
    stepAr: "التحليل الاستخباراتي — صف البيانات أو السوق أو الموقف الذي تريد تحليله",
  },
  "svc-economy": {
    emoji: "📊",
    en: "VX Economic Ecosystem",
    ar: "النظام الاقتصادي VX",
    expertEn: "Economic Analyst & Strategic Advisor",
    expertAr: "محلل اقتصادي ومستشار استراتيجي",
    descEn: "Explore VX economic models, market dynamics, investment strategies, and identify business growth opportunities.",
    descAr: "استكشف النماذج الاقتصادية لـ VX وديناميكيات السوق واستراتيجيات الاستثمار وفرص نمو الأعمال.",
    stepEn: "Economic Briefing — What economic scenario, market, or investment opportunity would you like to analyze?",
    stepAr: "الإحاطة الاقتصادية — ما السيناريو الاقتصادي أو السوق أو فرصة الاستثمار التي تريد تحليلها؟",
  },
  "svc-career": {
    emoji: "🚀",
    en: "Career Development Hub",
    ar: "مركز تطوير المسيرة المهنية",
    expertEn: "Career Coach & Talent Advisor",
    expertAr: "مدرب مهني ومستشار المواهب",
    descEn: "Accelerate your career with personalized coaching, resume guidance, interview preparation, and job market insights.",
    descAr: "طوّر مسيرتك المهنية مع تدريب شخصي وإرشاد في السيرة الذاتية والتحضير للمقابلات ورؤى سوق العمل.",
    stepEn: "Career Session — Tell me about your current role, skills, and where you want your career to go",
    stepAr: "الجلسة المهنية — أخبرني عن دورك الحالي ومهاراتك وأين تريد أن تتجه مسيرتك",
  },
  "svc-edu-empire": {
    emoji: "🏛️",
    en: "Global Educational Empire",
    ar: "الإمبراطورية التعليمية العالمية",
    expertEn: "Education Director & Academic Mentor",
    expertAr: "مدير تعليمي ومرشد أكاديمي",
    descEn: "Build and manage world-class educational programs with AI guidance on curriculum design, operations, and global impact.",
    descAr: "ابنِ وأدر برامج تعليمية عالمية المستوى مع توجيه الذكاء الاصطناعي في تصميم المناهج والعمليات والتأثير العالمي.",
    stepEn: "Education Strategy — What educational institution or program are you developing?",
    stepAr: "الاستراتيجية التعليمية — ما المؤسسة التعليمية أو البرنامج الذي تطوره؟",
  },
};

export function ServiceConsultationSimulation({ simulationId }: Props) {
  const { lang } = useLanguage();
  const { user } = useAuth();
  const { savedProgress } = useSimulationProgress(simulationId);
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (savedProgress?.completed) setPhase("complete");
  }, [savedProgress]);

  const cfg = simulationId ? SVC[simulationId] : null;
  if (!cfg) return null;

  const title  = lang === "ar" ? cfg.ar      : cfg.en;
  const expert = lang === "ar" ? cfg.expertAr : cfg.expertEn;
  const desc   = lang === "ar" ? cfg.descAr   : cfg.descEn;
  const step   = lang === "ar" ? cfg.stepAr   : cfg.stepEn;

  const endSession = useCallback(async () => {
    setPhase("complete");
    if (user && simulationId) {
      await saveSimulationProgress(user.id, simulationId, {
        current_step: 1,
        decisions: {} as Record<string, unknown>,
        score: 100,
        completed: true,
      });
    }
  }, [user, simulationId]);

  const ui = {
    start:   lang === "ar" ? "ابدأ الاستشارة"           : "Start Consultation",
    end:     lang === "ar" ? "إنهاء الجلسة"              : "End Session",
    active:  lang === "ar" ? "جلسة نشطة"                : "Active Session",
    hint:    lang === "ar" ? "انقر على زر المرشد أسفل الشاشة للمحادثة مع الخبير" : "Tap the Mentor button to chat with your expert",
    done:    lang === "ar" ? "انتهت الجلسة بنجاح"       : "Session Complete",
    doneMsg: lang === "ar" ? "شكراً لاستخدامك خدماتنا الاستشارية" : "Thank you for using our AI consultation service",
    again:   lang === "ar" ? "جلسة جديدة"               : "New Session",
    about:   lang === "ar" ? "عن هذه الاستشارة"         : "About This Consultation",
  };

  if (phase === "complete") {
    return (
      <Card className="max-w-md mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-4">
          <div className="text-5xl">{cfg.emoji}</div>
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold">{ui.done}</h2>
          <p className="text-sm text-muted-foreground">{ui.doneMsg}</p>
          <Button onClick={() => setPhase("idle")} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            {ui.again}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (phase === "idle") {
    return (
      <Card className="max-w-md mx-auto animate-in fade-in">
        <CardContent className="p-8 text-center space-y-5">
          <div className="text-6xl">{cfg.emoji}</div>
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{expert}</p>
          </div>
          <div className="text-start p-4 rounded-xl bg-muted/50 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{ui.about}</p>
            <p className="text-sm leading-relaxed">{desc}</p>
          </div>
          <Button onClick={() => setPhase("active")} className="w-full" size="lg">
            {ui.start}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Session header */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden="true">{cfg.emoji}</span>
            <div>
              <p className="font-semibold text-sm">{title}</p>
              <p className="text-xs text-muted-foreground">{expert}</p>
            </div>
          </div>
          <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 shrink-0">
            {ui.active}
          </Badge>
        </CardContent>
      </Card>

      {/* Chat prompt card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6 text-center space-y-4">
          <MessageSquare className="mx-auto h-10 w-10 text-primary/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{ui.hint}</p>
          <Button onClick={endSession} variant="outline" className="w-full">
            {ui.end}
          </Button>
        </CardContent>
      </Card>

      <SimulationMentor simulationTitle={title} currentStepTitle={step} />
    </div>
  );
}
