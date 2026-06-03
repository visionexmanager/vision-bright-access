export interface SimProject {
  clientName: string;
  clientNameAr: string;
  clientLogo: string;
  projectTitle: string;
  projectTitleAr: string;
  scenario: string;
  scenarioAr: string;
  budget: string;
  timeline: string;
  objectives: string[];
  objectivesAr: string[];
  deliverables: string[];
  deliverablesAr: string[];
  tags: string[];
  tagsAr: string[];
}

export const SIM_PROJECTS: Record<string, SimProject> = {
  "egg-incubator": {
    clientName: "Al-Rashid Poultry Farms",
    clientNameAr: "مزارع الراشد للدواجن",
    clientLogo: "🐔",
    projectTitle: "Egg Incubation Management Project",
    projectTitleAr: "مشروع إدارة تحضين البيض",
    scenario:
      "Al-Rashid Poultry Farms has brought you on as Agricultural Consultant to supervise a critical incubation batch. Starting from Day 1, you will manage 5 fertilized eggs through the full 21-day cycle using a digital incubator. Any deviation from the optimal temperature (37.5°C) and humidity (55%) can result in egg loss. The farm expects a professional operation and a full performance report at the end.",
    scenarioAr:
      "استعانت مزارع الراشد للدواجن بك مستشاراً زراعياً للإشراف على دفعة تحضين حرجة. ابتداءً من اليوم الأول ستدير 5 بيضات مخصبة عبر دورة كاملة من 21 يوماً باستخدام حاضنة رقمية. أي انحراف عن درجة الحرارة المثلى (37.5°م) والرطوبة (55%) قد يؤدي إلى خسارة البيض. تتوقع المزرعة تشغيلاً احترافياً وتقرير أداء كاملاً في النهاية.",
    budget: "$480",
    timeline: "21 Days",
    objectives: [
      "Maintain temperature within ±1°C of the 37.5°C target at all times",
      "Keep relative humidity consistently between 50% and 60%",
      "Respond immediately to every equipment malfunction",
      "Achieve a minimum hatch rate of 80% (at least 4 out of 5 eggs)",
    ],
    objectivesAr: [
      "الحفاظ على درجة الحرارة ضمن ±1°م من الهدف 37.5°م في جميع الأوقات",
      "الحفاظ على الرطوبة النسبية بين 50% و60% باستمرار",
      "الاستجابة الفورية لكل عطل في المعدات",
      "تحقيق معدل فقس لا يقل عن 80% (4 بيضات من أصل 5)",
    ],
    deliverables: [
      "Daily incubator monitoring log",
      "Malfunction incident and repair records",
      "Final hatch rate and overall performance score",
    ],
    deliverablesAr: [
      "سجل مراقبة الحاضنة اليومي",
      "سجلات حوادث الأعطال والإصلاحات",
      "معدل الفقس النهائي ودرجة الأداء الإجمالية",
    ],
    tags: ["Agriculture", "Operations", "Quality Control"],
    tagsAr: ["زراعة", "عمليات", "ضبط الجودة"],
  },

  "network-noc": {
    clientName: "TechCore Data Centers",
    clientNameAr: "مراكز بيانات تك كور",
    clientLogo: "🖥️",
    projectTitle: "Network Operations Center Management",
    projectTitleAr: "إدارة مركز عمليات الشبكة",
    scenario:
      "TechCore Data Centers has assigned you as Network Operations Engineer for a critical infrastructure shift. You will monitor the company's enterprise network in real time, respond to alerts, isolate faults, and maintain service-level agreements across hundreds of business clients. Network downtime has direct financial and reputational consequences — your decisions must be fast and precise.",
    scenarioAr:
      "كلّفتك TechCore Data Centers بمهمة مهندس عمليات شبكة في وردية بنية تحتية حرجة. ستراقب شبكة الشركة في الوقت الفعلي وتستجيب للتنبيهات وتعزل الأعطال وتحافظ على اتفاقيات مستوى الخدمة لمئات من عملاء الأعمال. توقف الشبكة له عواقب مالية وسمعة مباشرة — قراراتك يجب أن تكون سريعة ودقيقة.",
    budget: "SLA: 99.9% uptime target",
    timeline: "8-Hour Shift",
    objectives: [
      "Maintain network uptime above 99% throughout the shift",
      "Acknowledge and resolve critical incidents within 5 minutes",
      "Accurately document every alert and the corrective action taken",
      "Escalate unresolvable issues to Tier 3 support with full context",
    ],
    objectivesAr: [
      "الحفاظ على وقت تشغيل الشبكة فوق 99% طوال الوردية",
      "الاعتراف بالحوادث الحرجة وحلها خلال 5 دقائق",
      "توثيق كل تنبيه والإجراء التصحيحي المتخذ بدقة",
      "تصعيد المشكلات التي لا يمكن حلها إلى دعم المستوى الثالث مع السياق الكامل",
    ],
    deliverables: [
      "Incident response and resolution log",
      "Network performance summary",
      "End-of-shift operations report",
    ],
    deliverablesAr: [
      "سجل الاستجابة للحوادث وحلها",
      "ملخص أداء الشبكة",
      "تقرير العمليات في نهاية الوردية",
    ],
    tags: ["Technology", "IT Operations", "Network Engineering"],
    tagsAr: ["تكنولوجيا", "عمليات تقنية", "هندسة شبكات"],
  },

  "perfume-lab": {
    clientName: "Lumière Fragrances",
    clientNameAr: "لوميير للعطور",
    clientLogo: "🌸",
    projectTitle: "Custom Fragrance Development Project",
    projectTitleAr: "مشروع تطوير عطر مخصص",
    scenario:
      "Lumière Fragrances, a luxury perfume house, has commissioned you as Lead Perfumer and Formulation Chemist. You will develop a new signature fragrance from scratch — selecting base notes, heart notes, and top notes, managing raw material costs, and balancing olfactory complexity with commercial viability. The formula must meet the house's quality standards and come in under the allocated R&D budget.",
    scenarioAr:
      "كلّفتك Lumière Fragrances، دار عطور فاخرة، بمهمة كبير العطّارين وكيميائي التركيبات. ستطور عطراً مميزاً جديداً من الصفر — اختيار النوتات الأساسية والقلبية والعليا، وإدارة تكاليف المواد الخام، وتحقيق التوازن بين التعقيد العطري والجدوى التجارية. يجب أن تستوفي التركيبة معايير جودة الدار وتبقى ضمن ميزانية البحث والتطوير.",
    budget: "$2,000",
    timeline: "5 Lab Sessions",
    objectives: [
      "Create a harmonious fragrance with well-defined top, heart, and base notes",
      "Keep total raw material costs within the $2,000 budget",
      "Achieve a consumer acceptance score above 80% in simulated testing",
      "Document the complete formula ready for production scale-up",
    ],
    objectivesAr: [
      "ابتكار عطر متناسق بنوتات عليا وقلبية وأساسية محددة بوضوح",
      "الإبقاء على إجمالي تكاليف المواد الخام ضمن ميزانية 2,000$",
      "تحقيق درجة قبول المستهلك فوق 80% في الاختبار المحاكى",
      "توثيق التركيبة الكاملة جاهزة لتوسيع الإنتاج",
    ],
    deliverables: [
      "Fragrance formula specification sheet",
      "Cost of materials analysis",
      "Quality and stability test results",
    ],
    deliverablesAr: [
      "ورقة مواصفات تركيبة العطر",
      "تحليل تكلفة المواد",
      "نتائج اختبارات الجودة والاستقرار",
    ],
    tags: ["Manufacturing", "Chemistry", "Product Development"],
    tagsAr: ["تصنيع", "كيمياء", "تطوير منتجات"],
  },

  "english-journey": {
    clientName: "BrightPath Learning Center",
    clientNameAr: "مركز برايت باث للتعلم",
    clientLogo: "📚",
    projectTitle: "English Language Proficiency Program",
    projectTitleAr: "برنامج إتقان اللغة الإنجليزية",
    scenario:
      "BrightPath Learning Center has hired you as Curriculum Coach to guide a learner through a structured English language program. You will assess their starting level, design and deliver activities across vocabulary, grammar, and conversation, and track measurable progress. Your curriculum decisions directly shape the learner's outcomes and the center's program completion rates.",
    scenarioAr:
      "وظّفك مركز BrightPath للتعلم مدرّباً للمناهج لإرشاد متعلم عبر برنامج لغة إنجليزية منظم. ستقيّم مستواه الابتدائي وتصمم وتقدّم أنشطة في المفردات والقواعد والمحادثة وتتتبع التقدم القابل للقياس. قراراتك في المنهج تشكّل نتائج المتعلم ومعدلات إتمام البرنامج في المركز.",
    budget: "$1,200",
    timeline: "8-Week Course",
    objectives: [
      "Accurately assess and document the learner's entry level",
      "Progress through all curriculum modules: vocabulary, grammar, and conversation",
      "Achieve a final assessment score above 75%",
      "Complete all modules within the 8-week timeline",
    ],
    objectivesAr: [
      "تقييم مستوى دخول المتعلم وتوثيقه بدقة",
      "إكمال جميع وحدات المنهج: المفردات والقواعد والمحادثة",
      "تحقيق درجة تقييم نهائية فوق 75%",
      "إكمال جميع الوحدات ضمن الجدول الزمني 8 أسابيع",
    ],
    deliverables: [
      "Learner progress tracking report",
      "Module completion records",
      "Final assessment score and level certification",
    ],
    deliverablesAr: [
      "تقرير تتبع تقدم المتعلم",
      "سجلات إتمام الوحدات",
      "درجة التقييم النهائي وشهادة المستوى",
    ],
    tags: ["Education", "Curriculum Design", "Training"],
    tagsAr: ["تعليم", "تصميم المناهج", "تدريب"],
  },

  "board-surgeon": {
    clientName: "MedCity General Hospital",
    clientNameAr: "مستشفى ميدسيتي العام",
    clientLogo: "🏥",
    projectTitle: "Surgical Operations Management",
    projectTitleAr: "إدارة العمليات الجراحية",
    scenario:
      "MedCity General Hospital has brought you in as Operating Room Manager for an intensive day of surgical procedures. You will coordinate surgical teams, manage OR scheduling, prioritize emergency cases, allocate medical resources, and ensure all procedures comply with safety and quality protocols. Every operational decision directly affects patient outcomes.",
    scenarioAr:
      "استقدمك مستشفى MedCity العام مديراً لغرفة العمليات ليوم مكثف من الإجراءات الجراحية. ستنسق الفرق الجراحية وتدير جدول غرف العمليات وتحدد أولويات حالات الطوارئ وتخصص الموارد الطبية وتضمن امتثال جميع الإجراءات لبروتوكولات السلامة والجودة. كل قرار تشغيلي يؤثر مباشرة على نتائج المرضى.",
    budget: "$50,000 daily facility budget",
    timeline: "Full Operating Day",
    objectives: [
      "Complete all scheduled procedures on time and in the correct sequence",
      "Triage and handle emergency cases with appropriate clinical priority",
      "Enforce sterile protocols across all operating rooms at all times",
      "Achieve zero preventable complications during the shift",
    ],
    objectivesAr: [
      "إكمال جميع الإجراءات المجدولة في الوقت المحدد وبالتسلسل الصحيح",
      "فرز حالات الطوارئ والتعامل معها بالأولوية السريرية المناسبة",
      "تطبيق بروتوكولات التعقيم في جميع غرف العمليات طوال الوقت",
      "تحقيق صفر مضاعفات يمكن تفاديها خلال الوردية",
    ],
    deliverables: [
      "OR scheduling and completion report",
      "Resource utilization and allocation summary",
      "Patient outcome and incident log",
    ],
    deliverablesAr: [
      "تقرير جدولة غرفة العمليات وإتمامها",
      "ملخص استخدام الموارد وتخصيصها",
      "سجل نتائج المرضى والحوادث",
    ],
    tags: ["Healthcare", "Operations Management", "Critical Decision Making"],
    tagsAr: ["رعاية صحية", "إدارة عمليات", "اتخاذ قرارات حرجة"],
  },

  "dairy-farm": {
    clientName: "Green Valley Dairy",
    clientNameAr: "ألبان الوادي الأخضر",
    clientLogo: "🐄",
    projectTitle: "Dairy Farm Operations Launch",
    projectTitleAr: "إطلاق عمليات مزرعة الألبان",
    scenario:
      "Green Valley Dairy has tasked you as Farm Manager to launch and operate a new dairy production unit from zero. You will build the herd, establish milking routines, manage animal health, optimize feed programs, and scale output to hit monthly milk yield targets. Every decision you make affects animal welfare, production volume, and farm profitability.",
    scenarioAr:
      "أوكلت إليك Green Valley Dairy مهمة مدير المزرعة لإطلاق وحدة إنتاج ألبان جديدة من الصفر. ستبني القطيع وتنشئ روتين الحلب وتدير صحة الحيوانات وتحسّن برامج العلف وتوسّع الإنتاج لتحقيق أهداف إنتاج الحليب الشهرية.",
    budget: "$8,500",
    timeline: "30-Day Launch Period",
    objectives: [
      "Establish a productive herd of healthy dairy cows",
      "Hit the target daily milk yield consistently",
      "Keep feed and veterinary costs within the allocated budget",
      "Maintain an animal health index above 90%",
    ],
    objectivesAr: [
      "تكوين قطيع منتج من أبقار الحليب الصحية",
      "تحقيق هدف إنتاج الحليب اليومي بشكل منتظم",
      "الإبقاء على تكاليف العلف والبيطرة ضمن الميزانية",
      "الحفاظ على مؤشر صحة الحيوانات فوق 90%",
    ],
    deliverables: [
      "Daily milk production log",
      "Herd health and treatment records",
      "Month-end financial and production analysis",
    ],
    deliverablesAr: [
      "سجل إنتاج الحليب اليومي",
      "سجلات صحة القطيع والعلاجات",
      "التحليل المالي والإنتاجي في نهاية الشهر",
    ],
    tags: ["Agriculture", "Farm Management", "Operations"],
    tagsAr: ["زراعة", "إدارة مزرعة", "عمليات"],
  },

  "detergent-lab": {
    clientName: "CleanTech Industries",
    clientNameAr: "صناعات كلين تك",
    clientLogo: "🧪",
    projectTitle: "Industrial Detergent Formulation Project",
    projectTitleAr: "مشروع صياغة المنظفات الصناعية",
    scenario:
      "CleanTech Industries has contracted you as Lead Chemical Engineer to develop a new line of industrial detergent products. You will formulate different variants — heavy-duty, eco-friendly, concentrated — by selecting surfactants, builders, and performance additives. Each formula must pass performance benchmarks, meet safety and environmental regulations, and fall within the production cost target.",
    scenarioAr:
      "تعاقدت معك CleanTech Industries كمهندس كيميائي رئيسي لتطوير خط جديد من منتجات المنظفات الصناعية. ستصوغ متغيرات مختلفة — ثقيلة الاستخدام وصديقة للبيئة ومركّزة — باختيار المواد الخافضة للتوتر السطحي والمحسّنات وإضافات الأداء.",
    budget: "$3,000",
    timeline: "6 Lab Phases",
    objectives: [
      "Develop at least 2 distinct detergent variants with different applications",
      "Pass all performance and stability benchmark tests",
      "Meet applicable environmental and safety regulatory requirements",
      "Deliver complete formulation sheets ready for manufacturing",
    ],
    objectivesAr: [
      "تطوير ما لا يقل عن متغيرين مختلفين من المنظفات",
      "اجتياز جميع اختبارات الأداء والاستقرار المعيارية",
      "استيفاء متطلبات اللوائح البيئية والسلامة المعمول بها",
      "تسليم أوراق التركيبات الكاملة جاهزة للتصنيع",
    ],
    deliverables: [
      "Product formulation specification sheets",
      "Performance test results and quality certificates",
      "Cost-per-unit production analysis",
    ],
    deliverablesAr: [
      "أوراق مواصفات صياغة المنتج",
      "نتائج اختبارات الأداء وشهادات الجودة",
      "تحليل تكلفة الإنتاج لكل وحدة",
    ],
    tags: ["Manufacturing", "Chemistry", "Product Development"],
    tagsAr: ["تصنيع", "كيمياء", "تطوير منتجات"],
  },

  "barber-salon": {
    clientName: "The Classic Blade Studio",
    clientNameAr: "استوديو الشفرة الكلاسيكية",
    clientLogo: "✂️",
    projectTitle: "Barbershop Business Launch",
    projectTitleAr: "إطلاق مشروع صالون الحلاقة",
    scenario:
      "You have been appointed Business Manager for The Classic Blade Studio, a premium barbershop launching in the city. This is a full startup — you will set up the shop layout, hire and schedule barbers, build the service menu and pricing, manage daily client bookings, and establish operations. Your job is to get the business off the ground and profitable within the first month.",
    scenarioAr:
      "تم تعيينك مديراً تجارياً لـ The Classic Blade Studio، صالون حلاقة فاخر يُطلق في المدينة. هذا مشروع بدء كامل — ستضع تخطيط المتجر وتوظّف الحلاقين وتحدد جداولهم وتبني قائمة الخدمات والأسعار وتدير الحجوزات اليومية. مهمتك تشغيل المشروع وتحقيق الربحية خلال الشهر الأول.",
    budget: "$15,000 startup capital",
    timeline: "First 30 Days",
    objectives: [
      "Complete shop setup, staffing, and service menu design",
      "Build an initial loyal client base of 50+ customers",
      "Maintain average client satisfaction above 90%",
      "Achieve break-even by the end of the first month",
    ],
    objectivesAr: [
      "إكمال إعداد المحل والتوظيف وتصميم قائمة الخدمات",
      "بناء قاعدة عملاء أولية وفية من 50+ عميل",
      "الحفاظ على رضا العملاء بمعدل يتجاوز 90%",
      "تحقيق نقطة التعادل بنهاية الشهر الأول",
    ],
    deliverables: [
      "Business setup and operations checklist",
      "Client booking and revenue log",
      "Month-end financial performance summary",
    ],
    deliverablesAr: [
      "قائمة مراجعة الإعداد والعمليات التجارية",
      "سجل حجوزات العملاء والإيرادات",
      "ملخص الأداء المالي في نهاية الشهر",
    ],
    tags: ["Business", "Service Industry", "Entrepreneurship"],
    tagsAr: ["أعمال", "قطاع الخدمات", "ريادة الأعمال"],
  },

  "global-kitchen": {
    clientName: "World Flavors Catering Co.",
    clientNameAr: "شركة نكهات العالم للتموين",
    clientLogo: "👨‍🍳",
    projectTitle: "International Cuisine Restaurant Launch",
    projectTitleAr: "إطلاق مطعم المطبخ العالمي",
    scenario:
      "World Flavors Catering Co. has appointed you Executive Chef and Operations Manager to open a new international cuisine kitchen. You will plan multi-course menus spanning different national cuisines, source ingredients, manage kitchen brigade, control food costs, and deliver exceptional dining experiences from opening day. Both culinary creativity and operational discipline are required.",
    scenarioAr:
      "عيّنتك World Flavors Catering Co. رئيساً للطهاة ومديراً للعمليات لافتتاح مطبخ مطبخ عالمي جديد. ستخطط قوائم متعددة الأطباق تمتد عبر مأكولات وطنية مختلفة وتوفر المكونات وتدير فريق المطبخ وتراقب تكاليف الطعام وتقدم تجارب طعام استثنائية من يوم الافتتاح.",
    budget: "$12,000",
    timeline: "Restaurant Opening Week",
    objectives: [
      "Design a balanced international menu with appetizers, mains, and desserts",
      "Control food cost below 32% of projected revenue",
      "Achieve a customer satisfaction score above 85%",
      "Complete the opening week with positive performance metrics",
    ],
    objectivesAr: [
      "تصميم قائمة طعام عالمية متوازنة مع المقبلات والأطباق الرئيسية والحلوى",
      "السيطرة على تكلفة الطعام دون 32% من الإيرادات المتوقعة",
      "تحقيق درجة رضا العملاء فوق 85%",
      "إكمال أسبوع الافتتاح بمؤشرات أداء إيجابية",
    ],
    deliverables: [
      "Finalized menu with costing breakdown",
      "Food cost and waste analysis",
      "Opening week customer feedback summary",
    ],
    deliverablesAr: [
      "القائمة النهائية مع تفصيل التكاليف",
      "تحليل تكلفة الطعام والهدر",
      "ملخص تغذية راجعة العملاء خلال أسبوع الافتتاح",
    ],
    tags: ["Food & Beverage", "Operations", "Culinary Arts"],
    tagsAr: ["أغذية ومشروبات", "عمليات", "فنون الطهي"],
  },

  "skin-care-lab": {
    clientName: "GlowSci Cosmetics",
    clientNameAr: "مستحضرات جلوساي التجميلية",
    clientLogo: "💄",
    projectTitle: "Skincare Product Line Development",
    projectTitleAr: "تطوير خط منتجات العناية بالبشرة",
    scenario:
      "GlowSci Cosmetics has brought you in as Cosmetic Formulation Specialist to develop a new science-backed skincare line. You will research active ingredients, create formulas tailored to different skin types, run stability and compatibility tests, and prepare full documentation for regulatory submission. The products must be both clinically effective and commercially viable.",
    scenarioAr:
      "استعانت GlowSci Cosmetics بك متخصصاً في صياغة التجميل لتطوير خط عناية بالبشرة مدعوم علمياً. ستبحث في المكونات الفعالة وتنشئ تركيبات مُصمّمة لأنواع بشرة مختلفة وتجري اختبارات الاستقرار والتوافق وتُعدّ الوثائق الكاملة للتقديم التنظيمي.",
    budget: "$4,500",
    timeline: "8 Development Phases",
    objectives: [
      "Formulate at least 3 distinct skincare products for different skin types",
      "All products must pass stability and dermatological safety tests",
      "Achieve an efficacy rating above 80% across all formulas",
      "Complete the full regulatory documentation package",
    ],
    objectivesAr: [
      "صياغة 3 منتجات عناية بالبشرة مختلفة على الأقل لأنواع بشرة متعددة",
      "يجب أن تجتاز جميع المنتجات اختبارات الاستقرار والسلامة الجلدية",
      "تحقيق تقييم فعالية يتجاوز 80% في جميع التركيبات",
      "إكمال حزمة التوثيق التنظيمي الكاملة",
    ],
    deliverables: [
      "Product formulation dossiers",
      "Safety, stability, and efficacy test reports",
      "Ingredient specification and INCI listing sheets",
    ],
    deliverablesAr: [
      "ملفات صياغة المنتج",
      "تقارير اختبارات السلامة والاستقرار والفعالية",
      "أوراق مواصفات المكونات وقوائم INCI",
    ],
    tags: ["Manufacturing", "Cosmetics", "R&D"],
    tagsAr: ["تصنيع", "مستحضرات تجميل", "بحث وتطوير"],
  },

  "poultry-farm": {
    clientName: "SunRise Poultry Group",
    clientNameAr: "مجموعة صن رايز للدواجن",
    clientLogo: "🐓",
    projectTitle: "Commercial Poultry Farm Operations",
    projectTitleAr: "عمليات مزرعة الدواجن التجارية",
    scenario:
      "SunRise Poultry Group has assigned you as Farm Operations Manager for a commercial broiler production cycle. You will manage a flock from day-old chick arrival through to market weight, making daily decisions on feeding programs, health interventions, lighting schedules, ventilation, and harvest timing. Profitability depends on your ability to minimize mortality and optimize feed conversion.",
    scenarioAr:
      "كلّفتك SunRise Poultry Group مديراً لعمليات المزرعة في دورة إنتاج دجاج اللحم التجارية. ستدير القطيع من وصول الكتاكيت حديثة الفقس حتى الوزن السوقي مع اتخاذ قرارات يومية بشأن برامج التغذية والتدخلات الصحية وجداول الإضاءة والتهوية وتوقيت الحصاد.",
    budget: "$6,000",
    timeline: "42-Day Grow Cycle",
    objectives: [
      "Bring the flock to target market weight within the grow period",
      "Keep mortality rate below 5% across the entire cycle",
      "Optimize the feed conversion ratio (FCR) to industry benchmark",
      "Deliver a full harvest batch to market on schedule",
    ],
    objectivesAr: [
      "الوصول بالقطيع إلى الوزن السوقي المستهدف ضمن فترة التربية",
      "الإبقاء على معدل النفوق دون 5% طوال الدورة",
      "تحسين معدل تحويل العلف (FCR) وفق المعيار الصناعي",
      "تسليم دفعة الحصاد الكاملة للسوق في الموعد المحدد",
    ],
    deliverables: [
      "Daily flock performance and mortality log",
      "Feed consumption and FCR report",
      "Final batch profitability and performance analysis",
    ],
    deliverablesAr: [
      "سجل أداء القطيع اليومي والنفوق",
      "تقرير استهلاك العلف ومعدل التحويل FCR",
      "تحليل ربحية وأداء الدفعة النهائية",
    ],
    tags: ["Agriculture", "Livestock", "Operations"],
    tagsAr: ["زراعة", "ثروة حيوانية", "عمليات"],
  },

  "chocolate-factory": {
    clientName: "Artisan Cacao Works",
    clientNameAr: "أرتيزان للكاكاو",
    clientLogo: "🍫",
    projectTitle: "Artisan Chocolate Production Line",
    projectTitleAr: "خط إنتاج الشوكولاتة الحرفية",
    scenario:
      "Artisan Cacao Works has hired you as Production Manager to establish and run a premium chocolate manufacturing line from raw cacao through to finished product. You will oversee roasting, winnowing, grinding, conching, tempering, and molding, maintaining strict quality standards at every stage. Weekly output targets must be met while controlling production costs and maintaining the house's premium quality standard.",
    scenarioAr:
      "وظّفتك Artisan Cacao Works مديراً للإنتاج لإنشاء وتشغيل خط تصنيع شوكولاتة فاخر من الكاكاو الخام إلى المنتج النهائي. ستشرف على التحميص والتهوية والطحن والتكتيف والتطبيع والصب مع الحفاظ على معايير جودة صارمة في كل مرحلة.",
    budget: "$7,000",
    timeline: "Weekly Production Cycles",
    objectives: [
      "Successfully execute the complete bean-to-bar production process",
      "Maintain batch quality scores above 90% at every stage",
      "Meet or exceed weekly output targets",
      "Keep production cost per unit within the budget allocation",
    ],
    objectivesAr: [
      "تنفيذ عملية الإنتاج الكاملة من الحبة إلى القالب بنجاح",
      "الحفاظ على درجات جودة الدفعة فوق 90% في كل مرحلة",
      "تحقيق أهداف الإنتاج الأسبوعية أو تجاوزها",
      "الإبقاء على تكلفة الإنتاج لكل وحدة ضمن تخصيص الميزانية",
    ],
    deliverables: [
      "Batch production and process control records",
      "Quality control inspection certificates",
      "Weekly output, cost, and margin report",
    ],
    deliverablesAr: [
      "سجلات إنتاج الدفعات ومراقبة العمليات",
      "شهادات فحص ضبط الجودة",
      "تقرير الإنتاج الأسبوعي والتكلفة والهامش",
    ],
    tags: ["Food Manufacturing", "Quality Control", "Production Management"],
    tagsAr: ["تصنيع غذائي", "ضبط الجودة", "إدارة الإنتاج"],
  },

  "cattle-dairy": {
    clientName: "Horizon Ranch & Dairy",
    clientNameAr: "مزرعة هورايزون للماشية والألبان",
    clientLogo: "🐂",
    projectTitle: "Integrated Cattle & Dairy Ranch Operations",
    projectTitleAr: "عمليات مزرعة الماشية والألبان المتكاملة",
    scenario:
      "Horizon Ranch & Dairy has appointed you Ranch Operations Director to manage a dual-purpose cattle operation producing both beef and dairy. You will oversee herd health, breeding programs, milking schedules, pasture rotation, and feed optimization across a complex, interconnected operation. Balancing two production streams demands careful resource planning and animal welfare prioritization.",
    scenarioAr:
      "عيّنتك Horizon Ranch & Dairy مديراً لعمليات المزرعة لإدارة عملية ماشية مزدوجة الأغراض تنتج اللحوم والألبان. ستشرف على صحة القطيع وبرامج التكاثر وجداول الحلب وتدوير المراعي وتحسين العلف عبر عملية معقدة ومترابطة.",
    budget: "$20,000",
    timeline: "Quarterly Operation",
    objectives: [
      "Maintain overall herd health index above 85%",
      "Hit monthly milk production targets consistently",
      "Execute the breeding program and achieve herd expansion targets",
      "Optimize pasture usage and feed costs within budget",
    ],
    objectivesAr: [
      "الحفاظ على مؤشر الصحة الإجمالية للقطيع فوق 85%",
      "تحقيق أهداف إنتاج الحليب الشهرية بشكل منتظم",
      "تنفيذ برنامج التكاثر وتحقيق أهداف توسيع القطيع",
      "تحسين استخدام المراعي وتكاليف العلف ضمن الميزانية",
    ],
    deliverables: [
      "Herd health and production performance report",
      "Breeding, calving, and growth records",
      "Quarterly financial and operational summary",
    ],
    deliverablesAr: [
      "تقرير صحة القطيع وأداء الإنتاج",
      "سجلات التكاثر والولادة والنمو",
      "الملخص المالي والتشغيلي الربع سنوي",
    ],
    tags: ["Agriculture", "Livestock Management", "Operations"],
    tagsAr: ["زراعة", "إدارة الثروة الحيوانية", "عمليات"],
  },

  "mobile-repair": {
    clientName: "FastFix Mobile Solutions",
    clientNameAr: "فاست فيكس لحلول الجوالات",
    clientLogo: "📱",
    projectTitle: "Mobile Device Repair Workshop Launch",
    projectTitleAr: "إطلاق ورشة إصلاح الجوالات",
    scenario:
      "FastFix Mobile Solutions has contracted you as Lead Technician and Workshop Manager to launch a professional mobile device repair center. You will diagnose and repair a range of device faults — cracked screens, batteries, charging ports, motherboards — while managing parts inventory, repair turnaround times, and customer communications. Your reputation for quality and speed is the business's most valuable asset.",
    scenarioAr:
      "تعاقدت معك FastFix Mobile Solutions كبير فنيين ومديراً للورشة لإطلاح مركز احترافي لإصلاح الأجهزة المحمولة. ستشخّص وتصلح مجموعة من أعطال الأجهزة — الشاشات المتشققة والبطاريات ومنافذ الشحن واللوحات الأم — مع إدارة مخزون الأجزاء ومدد إصلاح الأجهزة.",
    budget: "$5,000 initial parts inventory",
    timeline: "First Month Operations",
    objectives: [
      "Accurately diagnose all incoming device faults",
      "Maintain average repair turnaround time under 48 hours",
      "Achieve a customer satisfaction score above 90%",
      "Keep parts sourcing costs within the inventory budget",
    ],
    objectivesAr: [
      "تشخيص جميع أعطال الأجهزة الواردة بدقة",
      "الحفاظ على متوسط وقت الإصلاح دون 48 ساعة",
      "تحقيق درجة رضا العملاء فوق 90%",
      "الإبقاء على تكاليف توريد الأجزاء ضمن ميزانية المخزون",
    ],
    deliverables: [
      "Repair job log with diagnosis, parts, and resolution details",
      "Parts inventory usage and reorder report",
      "Monthly customer satisfaction and revenue summary",
    ],
    deliverablesAr: [
      "سجل أعمال الإصلاح مع تفاصيل التشخيص والأجزاء والحل",
      "تقرير استخدام مخزون الأجزاء وإعادة الطلب",
      "ملخص رضا العملاء والإيرادات الشهرية",
    ],
    tags: ["Technology", "Technical Services", "Workshop Management"],
    tagsAr: ["تكنولوجيا", "خدمات تقنية", "إدارة ورشة"],
  },

  "sheep-farm": {
    clientName: "Highlands Wool & Meat Co.",
    clientNameAr: "شركة هايلاندز للصوف واللحوم",
    clientLogo: "🐑",
    projectTitle: "Sheep Farm Management Project",
    projectTitleAr: "مشروع إدارة مزرعة الأغنام",
    scenario:
      "Highlands Wool & Meat Co. has assigned you as Farm Manager for a dual-production sheep operation generating both wool and meat. You will manage flock nutrition, health monitoring, shearing cycles, lambing season, and market timing across the seasonal production cycle. The right decisions at each stage determine both animal welfare outcomes and farm profitability.",
    scenarioAr:
      "كلّفتك Highlands Wool & Meat Co. مديراً للمزرعة لعملية أغنام مزدوجة الإنتاج تولّد الصوف واللحوم معاً. ستدير تغذية القطيع ومراقبة الصحة ودورات الجز وموسم الولادة وتوقيت السوق عبر دورة الإنتاج الموسمية.",
    budget: "$9,000",
    timeline: "Full Seasonal Cycle",
    objectives: [
      "Maintain flock health and body condition above 85%",
      "Complete the shearing season and reach wool yield targets",
      "Manage lambing with a lamb survival rate above 90%",
      "Achieve profitability targets across both wool and meat revenue streams",
    ],
    objectivesAr: [
      "الحفاظ على صحة القطيع وحالته البدنية فوق 85%",
      "إكمال موسم الجز والوصول لأهداف إنتاج الصوف",
      "إدارة موسم الولادة بمعدل نجاة الحملان فوق 90%",
      "تحقيق أهداف الربحية عبر تدفقات إيرادات الصوف واللحوم",
    ],
    deliverables: [
      "Flock management and health monitoring report",
      "Shearing production records and wool yield",
      "Seasonal profit and loss summary",
    ],
    deliverablesAr: [
      "تقرير إدارة القطيع ومراقبة الصحة",
      "سجلات إنتاج الجز وإنتاجية الصوف",
      "ملخص الربح والخسارة الموسمي",
    ],
    tags: ["Agriculture", "Livestock", "Agribusiness"],
    tagsAr: ["زراعة", "ثروة حيوانية", "أعمال زراعية"],
  },

  "logistics-supply": {
    clientName: "SwiftRoute Logistics Corp",
    clientNameAr: "سويفت روت للخدمات اللوجستية",
    clientLogo: "🚛",
    projectTitle: "Supply Chain & Distribution Management",
    projectTitleAr: "إدارة سلسلة التوريد والتوزيع",
    scenario:
      "SwiftRoute Logistics Corp has brought you on as Supply Chain Manager to optimize their regional distribution network. You will manage warehouse operations, plan delivery routes, allocate fleet resources, set inventory replenishment levels, and process corporate client orders — all against tight SLA timelines. Minimizing cost while maximizing on-time delivery is the core challenge.",
    scenarioAr:
      "استعانت SwiftRoute Logistics Corp بك مديراً لسلسلة التوريد لتحسين شبكة التوزيع الإقليمية. ستدير عمليات المستودعات وتخطط مسارات التسليم وتخصص موارد الأسطول وتحدد مستويات تجديد المخزون وتعالج طلبات العملاء المؤسسيين.",
    budget: "$30,000 operational budget",
    timeline: "Monthly Operations",
    objectives: [
      "Achieve 95%+ on-time delivery rate across all client orders",
      "Optimize route planning to reduce fuel and vehicle costs by 15%",
      "Maintain warehouse inventory accuracy above 98%",
      "Process every client order within the contracted SLA window",
    ],
    objectivesAr: [
      "تحقيق معدل تسليم في الوقت المحدد بنسبة 95%+ لجميع طلبات العملاء",
      "تحسين تخطيط المسار لخفض تكاليف الوقود والمركبات بنسبة 15%",
      "الحفاظ على دقة مخزون المستودعات فوق 98%",
      "معالجة كل طلب عميل ضمن نافذة SLA المتعاقد عليها",
    ],
    deliverables: [
      "Route optimization analysis and implementation report",
      "Delivery performance and on-time rate dashboard",
      "Monthly cost savings and operational efficiency analysis",
    ],
    deliverablesAr: [
      "تقرير تحليل تحسين المسار وتنفيذه",
      "لوحة أداء التسليم ومعدل الالتزام بالوقت",
      "تحليل توفير التكاليف والكفاءة التشغيلية الشهرية",
    ],
    tags: ["Logistics", "Supply Chain", "Operations Management"],
    tagsAr: ["لوجستيات", "سلسلة توريد", "إدارة عمليات"],
  },

  "hvac-systems": {
    clientName: "ComfortZone Engineering",
    clientNameAr: "كومفورت زون للهندسة",
    clientLogo: "❄️",
    projectTitle: "HVAC System Installation & Commissioning",
    projectTitleAr: "تركيب وتشغيل نظام التكييف والتهوية",
    scenario:
      "ComfortZone Engineering has assigned you as HVAC Project Engineer to design, install, and commission a complete heating, ventilation, and air conditioning system for a commercial building. Starting from the load calculation and equipment selection, you will plan ductwork layouts, coordinate installation crews, manage subcontractors, and perform full commissioning tests before client handover.",
    scenarioAr:
      "كلّفتك ComfortZone Engineering مهندس مشاريع HVAC لتصميم وتركيب وتشغيل نظام تدفئة وتهوية وتكييف هواء كامل لمبنى تجاري. بدءاً من حساب الأحمال واختيار المعدات ستخطط تصميمات قنوات الهواء وتنسق فرق التركيب.",
    budget: "$45,000",
    timeline: "4-Week Installation",
    objectives: [
      "Complete system design within engineering specifications and load calculations",
      "Install all components in compliance with local building code",
      "Commission the system and verify it meets design performance targets",
      "Deliver full as-built drawings and documentation to the client",
    ],
    objectivesAr: [
      "إكمال تصميم النظام ضمن المواصفات الهندسية وحسابات الأحمال",
      "تركيب جميع المكونات وفق كود البناء المحلي",
      "تشغيل النظام والتحقق من استيفائه لأهداف الأداء التصميمية",
      "تسليم الرسومات كما بُني والوثائق الكاملة للعميل",
    ],
    deliverables: [
      "System design drawings and equipment schedule",
      "Installation completion and inspection report",
      "Commissioning and performance test results",
      "Client handover package with O&M manual",
    ],
    deliverablesAr: [
      "رسومات تصميم النظام وجدول المعدات",
      "تقرير إتمام التركيب والتفتيش",
      "نتائج اختبارات التشغيل والأداء",
      "حزمة تسليم العميل مع دليل التشغيل والصيانة",
    ],
    tags: ["Engineering", "Construction", "HVAC"],
    tagsAr: ["هندسة", "إنشاءات", "تكييف وتهوية"],
  },

  "aluminum-glazing": {
    clientName: "Premier Glass & Aluminum Ltd",
    clientNameAr: "بريمير للزجاج والألومنيوم",
    clientLogo: "🪟",
    projectTitle: "Aluminum Glazing Project Execution",
    projectTitleAr: "تنفيذ مشروع الألومنيوم والزجاج",
    scenario:
      "Premier Glass & Aluminum Ltd has assigned you as Project Foreman for a commercial aluminum glazing package on a new office building. You will manage fabrication of aluminum profiles and curtain wall panels, coordinate installation crews on site, quality-check every unit before installation, and ensure the completed work achieves water and air tightness certification. The project must finish on schedule and within budget with zero safety incidents.",
    scenarioAr:
      "كلّفتك Premier Glass & Aluminum Ltd رئيس عمال مشروع لباقة تزجيج ألومنيوم تجارية في مبنى مكاتب جديد. ستدير تصنيع بروفيلات الألومنيوم وألواح الجدار الستائري وتنسق طواقم التركيب في الموقع وتفحص كل وحدة قبل التركيب.",
    budget: "$55,000",
    timeline: "6-Week Project",
    objectives: [
      "Fabricate all aluminum and glass units to exact shop drawing specifications",
      "Complete installation on programme with zero recordable safety incidents",
      "Pass water tightness and air infiltration tests to the specified standard",
      "Hand over the completed works with full as-built documentation",
    ],
    objectivesAr: [
      "تصنيع جميع وحدات الألومنيوم والزجاج وفق مواصفات رسومات الورشة",
      "إكمال التركيب وفق البرنامج بصفر حوادث سلامة مسجلة",
      "اجتياز اختبارات ضيق الماء والهواء وفق المعيار المحدد",
      "تسليم الأعمال المكتملة بوثائق كما بُني الكاملة",
    ],
    deliverables: [
      "Shop drawings and fabrication quality records",
      "Site installation progress and inspection log",
      "Water and air tightness test certificates",
      "Project handover and close-out report",
    ],
    deliverablesAr: [
      "رسومات الورشة وسجلات جودة التصنيع",
      "سجل تقدم التركيب في الموقع والتفتيش",
      "شهادات اختبارات ضيق الماء والهواء",
      "تقرير تسليم المشروع وإغلاقه",
    ],
    tags: ["Construction", "Manufacturing", "Project Management"],
    tagsAr: ["إنشاءات", "تصنيع", "إدارة مشاريع"],
  },

  "solar-energy": {
    clientName: "SolarMax Renewables",
    clientNameAr: "سولار ماكس للطاقة المتجددة",
    clientLogo: "☀️",
    projectTitle: "Solar Energy System Design & Installation",
    projectTitleAr: "تصميم وتركيب نظام الطاقة الشمسية",
    scenario:
      "SolarMax Renewables has commissioned you as Solar Energy Project Engineer to design, install, and commission a grid-tied photovoltaic system for a commercial facility. You will conduct a site energy audit, size the solar array and inverter capacity, specify mounting structures, manage the installation team, and commission the system — verifying that energy production meets the projections used in the client's investment model.",
    scenarioAr:
      "كلّفتك SolarMax Renewables مهندس مشاريع طاقة شمسية لتصميم وتركيب وتشغيل نظام كهروضوئي مربوط بالشبكة لمنشأة تجارية. ستجري تدقيقاً للطاقة في الموقع وتحدد حجم المصفوفة الشمسية وسعة العاكس وتدير فريق التركيب.",
    budget: "$75,000",
    timeline: "8-Week Project",
    objectives: [
      "Design a solar array that offsets at least 80% of the facility's energy consumption",
      "Complete installation fully compliant with electrical and building codes",
      "Commission the system and verify actual vs. projected energy output",
      "Deliver a detailed ROI and payback period report to the client",
    ],
    objectivesAr: [
      "تصميم مصفوفة شمسية تعوّض 80% على الأقل من استهلاك الطاقة في المنشأة",
      "إكمال التركيب بالامتثال الكامل للكودات الكهربائية والإنشائية",
      "تشغيل النظام والتحقق من الإنتاج الفعلي مقابل المتوقع",
      "تسليم تقرير تفصيلي للعائد على الاستثمار وفترة الاسترداد",
    ],
    deliverables: [
      "Solar system design and single-line diagram",
      "Installation completion and electrical inspection certificate",
      "System performance monitoring dashboard setup",
      "Client ROI and energy savings projection report",
    ],
    deliverablesAr: [
      "تصميم النظام الشمسي ومخطط الخط الواحد",
      "شهادة إتمام التركيب والتفتيش الكهربائي",
      "إعداد لوحة مراقبة أداء النظام",
      "تقرير العائد على الاستثمار وتوقعات توفير الطاقة",
    ],
    tags: ["Renewable Energy", "Engineering", "Installation"],
    tagsAr: ["طاقة متجددة", "هندسة", "تركيب"],
  },

  "woodworking": {
    clientName: "Craftsmen Workshop Studio",
    clientNameAr: "استوديو ورشة الحرفيين",
    clientLogo: "🪵",
    projectTitle: "Custom Furniture Production Workshop",
    projectTitleAr: "ورشة إنتاج الأثاث المخصص",
    scenario:
      "Craftsmen Workshop Studio has hired you as Workshop Production Manager to operate a custom furniture fabrication business. You will receive client orders, select appropriate timber species and hardware, plan production sequences, manage CNC and hand tool operations, apply finishes, and deliver completed pieces that meet the studio's quality standards. Every job demands balancing craftsmanship, material efficiency, and schedule.",
    scenarioAr:
      "وظّفك Craftsmen Workshop Studio مديراً لإنتاج الورشة لتشغيل مشروع تصنيع أثاث مخصص. ستستلم طلبات العملاء وتختار أنواع الأخشاب والأدوات وتخطط تسلسلات الإنتاج وتدير عمليات CNC والأدوات اليدوية وتسلّم القطع المكتملة.",
    budget: "$12,000",
    timeline: "Monthly Production Cycle",
    objectives: [
      "Deliver all client orders to full specification and on schedule",
      "Maintain a quality defect and rework rate below 5%",
      "Optimize material yield and minimize off-cut waste",
      "Hit the monthly revenue target and keep costs within budget",
    ],
    objectivesAr: [
      "تسليم جميع طلبات العملاء بالمواصفات الكاملة وفي الوقت المحدد",
      "الحفاظ على معدل العيوب وإعادة العمل دون 5%",
      "تحسين إنتاجية المواد وتقليل نفايات القطع",
      "تحقيق هدف الإيرادات الشهرية والإبقاء على التكاليف ضمن الميزانية",
    ],
    deliverables: [
      "Production order and job card log",
      "Timber and materials usage efficiency report",
      "Quality inspection and customer sign-off records",
      "Monthly production revenue and profit summary",
    ],
    deliverablesAr: [
      "سجل أوامر الإنتاج وبطاقات العمل",
      "تقرير كفاءة استخدام الأخشاب والمواد",
      "سجلات التفتيش على الجودة وموافقة العملاء",
      "ملخص إيرادات وأرباح الإنتاج الشهرية",
    ],
    tags: ["Manufacturing", "Craftsmanship", "Workshop Management"],
    tagsAr: ["تصنيع", "حرفية", "إدارة ورشة"],
  },

  "trade-tycoon": {
    clientName: "Meridian Trading House",
    clientNameAr: "بيت ميريديان للتجارة",
    clientLogo: "📈",
    projectTitle: "International Trade Portfolio Management",
    projectTitleAr: "إدارة محفظة التجارة الدولية",
    scenario:
      "Meridian Trading House has appointed you Trade Manager to build and manage an international commodity trading portfolio from scratch. You will analyze market trends, source profitable commodities, negotiate purchase and sale contracts, manage import/export logistics, and grow your trading capital across 12 trading cycles. Every transaction involves risk assessment, market timing, and financial calculation.",
    scenarioAr:
      "عيّنك Meridian Trading House مديراً للتجارة لبناء وإدارة محفظة تداول السلع الدولية من الصفر. ستحلل اتجاهات السوق وتوفر السلع المربحة وتتفاوض على عقود الشراء والبيع وتدير لوجستيات الاستيراد والتصدير وتنمّي رأس مال التداول عبر 12 دورة.",
    budget: "$10,000 seed capital",
    timeline: "12 Trading Cycles",
    objectives: [
      "Grow the trading capital by a minimum of 50% across all cycles",
      "Execute successful trades across at least 3 different commodity categories",
      "Maintain a trade win rate above 60%",
      "Develop and document at least 2 reliable supplier/buyer relationships",
    ],
    objectivesAr: [
      "تنمية رأس مال التداول بحد أدنى 50% عبر جميع الدورات",
      "تنفيذ صفقات ناجحة في 3 فئات سلع مختلفة على الأقل",
      "الحفاظ على معدل الفوز في الصفقات فوق 60%",
      "تطوير وتوثيق علاقتين موثوقتين على الأقل مع موردين/مشترين",
    ],
    deliverables: [
      "Trade execution journal with buy/sell rationale",
      "Portfolio performance and return analysis",
      "Risk assessment log for each commodity traded",
      "Final profit and loss statement",
    ],
    deliverablesAr: [
      "دفتر يومية تنفيذ الصفقات مع مبررات الشراء والبيع",
      "تحليل أداء المحفظة والعوائد",
      "سجل تقييم المخاطر لكل سلعة متداولة",
      "بيان الربح والخسارة النهائي",
    ],
    tags: ["Business", "Trading", "Finance"],
    tagsAr: ["أعمال", "تجارة", "مالية"],
  },

  "laptop-repair": {
    clientName: "TechRevive Repair Centers",
    clientNameAr: "مراكز تك ريفايف للإصلاح",
    clientLogo: "💻",
    projectTitle: "Laptop Repair & Refurbishment Workshop",
    projectTitleAr: "ورشة إصلاح وتجديد اللابتوبات",
    scenario:
      "TechRevive Repair Centers has appointed you Lead Technician and Workshop Manager to run a professional laptop repair and refurbishment service. You will diagnose hardware and software faults across various brands and models, perform component-level repairs, manage spare parts sourcing, and maintain strict quality control before returning devices to customers. Diagnostic accuracy and first-time fix rate are the metrics that define your workshop's reputation.",
    scenarioAr:
      "عيّنك TechRevive Repair Centers كبير فنيين ومديراً للورشة لإدارة خدمة احترافية لإصلاح وتجديد اللابتوبات. ستشخّص أعطال الأجهزة والبرمجيات عبر ماركات وطرازات متعددة وتجري إصلاحات على مستوى المكونات وتدير توريد قطع الغيار.",
    budget: "$8,000 parts budget",
    timeline: "Monthly Operations",
    objectives: [
      "Accurately diagnose all incoming laptop faults on first assessment",
      "Achieve a first-time fix rate above 85%",
      "Return all repaired devices to customers within 72 hours",
      "Keep parts sourcing costs within the monthly budget allocation",
    ],
    objectivesAr: [
      "تشخيص جميع أعطال اللابتوبات الواردة بدقة في أول تقييم",
      "تحقيق معدل إصلاح من المرة الأولى يتجاوز 85%",
      "إعادة جميع الأجهزة المُصلحة للعملاء خلال 72 ساعة",
      "الإبقاء على تكاليف توريد الأجزاء ضمن تخصيص الميزانية الشهرية",
    ],
    deliverables: [
      "Diagnostic and repair job sheets for every device",
      "Parts usage and procurement report",
      "Quality control pre-delivery checklist",
      "Monthly workshop performance and revenue summary",
    ],
    deliverablesAr: [
      "أوراق عمل التشخيص والإصلاح لكل جهاز",
      "تقرير استخدام الأجزاء والشراء",
      "قائمة مراجعة ضبط الجودة قبل التسليم",
      "ملخص أداء الورشة والإيرادات الشهرية",
    ],
    tags: ["Technology", "Technical Services", "IT Hardware"],
    tagsAr: ["تكنولوجيا", "خدمات تقنية", "أجهزة تقنية"],
  },

  "music-training": {
    clientName: "Harmony Academy of Music",
    clientNameAr: "أكاديمية هارموني للموسيقى",
    clientLogo: "🎵",
    projectTitle: "Music Training Program Development",
    projectTitleAr: "تطوير برنامج التدريب الموسيقي",
    scenario:
      "Harmony Academy of Music has engaged you as Program Director to design and deliver a structured music training program for a new student cohort. You will assess student entry levels, develop a progressive curriculum covering theory, instrument technique, ear training, and performance practice, manage weekly lesson schedules, monitor individual progress, and lead students through to a final recital.",
    scenarioAr:
      "استعانت Harmony Academy of Music بك مديراً للبرامج لتصميم وتقديم برنامج تدريب موسيقي منظم لفوج طلاب جديد. ستقيّم مستويات الطلاب الدخولية وتطور منهجاً تدريجياً يشمل النظرية وتقنية الآلة وتدريب الأذن والأداء.",
    budget: "$6,000",
    timeline: "10-Week Program",
    objectives: [
      "Design and deliver a complete, progressive music curriculum",
      "Guide each student through all skill development modules",
      "Achieve an average student performance score above 80% by end of program",
      "Successfully stage the end-of-program recital",
    ],
    objectivesAr: [
      "تصميم وتقديم منهج موسيقي كامل ومتدرج",
      "إرشاد كل طالب عبر جميع وحدات تطوير المهارات",
      "تحقيق متوسط درجة أداء الطلاب فوق 80% بنهاية البرنامج",
      "إقامة الحفلة الموسيقية النهائية للبرنامج بنجاح",
    ],
    deliverables: [
      "Full curriculum plan and lesson schedule",
      "Individual student progress tracking reports",
      "Final recital performance evaluation and outcomes summary",
    ],
    deliverablesAr: [
      "خطة المنهج الكاملة وجدول الدروس",
      "تقارير تتبع تقدم الطلاب الفردية",
      "تقييم أداء الحفلة الختامية وملخص النتائج",
    ],
    tags: ["Education", "Arts", "Training Program Management"],
    tagsAr: ["تعليم", "فنون", "إدارة برامج تدريبية"],
  },
};
