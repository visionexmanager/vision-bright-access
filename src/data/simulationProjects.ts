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

  "vehicle-diagnostics": {
    clientName: "AutoPro Diagnostic Centers",
    clientNameAr: "مراكز أوتو برو للتشخيص",
    clientLogo: "🚗",
    projectTitle: "Ultimate Vehicle Diagnostics & Repair Simulator",
    projectTitleAr: "محاكاة تشخيص وإصلاح المركبات الاحترافية",
    scenario:
      "AutoPro Diagnostic Centers has contracted you as Senior Automotive Diagnostician to work the workshop floor. You will receive vehicles across all categories — cars, heavy trucks, buses, and motorcycles — and use professional OBD-II / SAE J1939 scan tools to read Diagnostic Trouble Codes, isolate root causes using both AI-assisted symptom parsing and guided expert question trees, then execute complete repair workflows. Every diagnosis must be accurate, every tool choice deliberate, and every repair verified with a code-clear and system recalibration before handover.",
    scenarioAr:
      "تعاقدت معك مراكز AutoPro للتشخيص كمشخص سيارات أول للعمل في أرضية الورشة. ستستقبل مركبات من جميع الفئات — سيارات وشاحنات ثقيلة وحافلات ودراجات نارية — وتستخدم أدوات مسح OBD-II / SAE J1939 الاحترافية لقراءة رموز أعطال التشخيص وعزل الأسباب الجذرية باستخدام تحليل الأعراض بالذكاء الاصطناعي وأشجار الأسئلة الموجهة ثم تنفيذ سير عمل الإصلاح الكامل.",
    budget: "Per-Vehicle Repair Authorization",
    timeline: "Open Workshop Sessions",
    objectives: [
      "Accurately diagnose active and pending DTCs across all vehicle types and systems",
      "Use Mode A (AI) or Mode B (Question Tree) to isolate the root-cause fault",
      "Select the correct diagnostic tools and execute all repair phases in sequence",
      "Clear all DTCs and verify system recalibration before vehicle handover",
    ],
    objectivesAr: [
      "تشخيص DTCs النشطة والمعلقة بدقة عبر جميع أنواع المركبات والأنظمة",
      "استخدام الوضع A (الذكاء الاصطناعي) أو الوضع B (شجرة الأسئلة) لعزل العطل الجذري",
      "اختيار أدوات التشخيص الصحيحة وتنفيذ جميع مراحل الإصلاح بالتسلسل",
      "مسح جميع DTCs والتحقق من إعادة معايرة النظام قبل تسليم المركبة",
    ],
    deliverables: [
      "Diagnostic scan report with active and pending DTCs per vehicle",
      "Repair order with parts list, tool selection, and procedure log",
      "Post-repair verification: clear codes and confirmed system recalibration",
    ],
    deliverablesAr: [
      "تقرير الفحص التشخيصي مع DTCs النشطة والمعلقة لكل مركبة",
      "أمر الإصلاح مع قائمة الأجزاء واختيار الأدوات وسجل الإجراءات",
      "التحقق بعد الإصلاح: مسح الرموز وتأكيد إعادة معايرة النظام",
    ],
    tags: ["Automotive", "Diagnostics", "Technical Services", "OBD-II"],
    tagsAr: ["سيارات", "تشخيص", "خدمات تقنية", "OBD-II"],
  },

  "marine-vessel": {
    clientName: "OceanGate Maritime Operations",
    clientNameAr: "أوشن جيت للعمليات البحرية",
    clientLogo: "🚢",
    projectTitle: "Live Marine Vessel Tracking & Maritime Logistics Simulator",
    projectTitleAr: "محاكي تتبع السفن البحرية الحية والخدمات اللوجستية البحرية",
    scenario:
      "OceanGate Maritime Operations has appointed you as Fleet Operations Commander responsible for a global fleet of 8 commercial vessels. You will monitor real-time vessel positions using AIS data, manage cargo logistics across major world ports, respond to critical operational emergencies — port congestion, tropical storms, mechanical failures, piracy threats, and canal blockages — and coordinate with port authorities, customs, and cargo owners to maintain on-time delivery performance. Every decision you make directly affects voyage costs, delivery schedules, and customer satisfaction scores.",
    scenarioAr:
      "عيّنتك OceanGate للعمليات البحرية قائداً لعمليات الأسطول المسؤول عن أسطول عالمي من 8 سفن تجارية. ستراقب مواضع السفن في الوقت الحقيقي باستخدام بيانات AIS، وتدير عمليات الشحن اللوجستية عبر الموانئ العالمية الكبرى، وتستجيب للطوارئ التشغيلية الحرجة — ازدحام الموانئ والعواصف الاستوائية والأعطال الميكانيكية وتهديدات القرصنة وانسداد القنوات — وتنسق مع سلطات الموانئ والجمارك وأصحاب البضائع للحفاظ على أداء التسليم في الوقت المحدد.",
    budget: "Fleet Operating Budget: $2.4M / Voyage",
    timeline: "Multi-Voyage Operations",
    objectives: [
      "Maintain on-time delivery rate above 90% across all active voyages",
      "Respond to every operational emergency within the allotted decision window",
      "Optimize routing decisions to minimize fuel costs and voyage delays",
      "Achieve a fleet efficiency score of 85% or higher to unlock VX rewards",
    ],
    objectivesAr: [
      "الحفاظ على معدل التسليم في الوقت المحدد فوق 90% عبر جميع الرحلات النشطة",
      "الاستجابة لكل طارئ تشغيلي ضمن نافذة القرار المخصصة",
      "تحسين قرارات التوجيه لتقليل تكاليف الوقود وتأخيرات الرحلات",
      "تحقيق درجة كفاءة الأسطول 85% أو أعلى لفتح مكافآت VX",
    ],
    deliverables: [
      "Fleet operations log with all decisions and outcomes recorded",
      "Scenario response report per maritime emergency handled",
      "Final voyage performance score and fleet efficiency rating",
    ],
    deliverablesAr: [
      "سجل عمليات الأسطول مع تسجيل جميع القرارات والنتائج",
      "تقرير الاستجابة لكل طارئ بحري تمت معالجته",
      "درجة أداء الرحلة النهائية وتقييم كفاءة الأسطول",
    ],
    tags: ["Maritime", "Logistics", "Fleet Management", "Operations"],
    tagsAr: ["بحري", "لوجستيات", "إدارة أسطول", "عمليات"],
  },

  // ── Service Consultation Simulations ──────────────────────────────────
  "svc-hair-care": {
    clientName: "VisionEx Beauty Network",
    clientNameAr: "شبكة فيجن إكس للجمال",
    clientLogo: "✂️",
    projectTitle: "Professional Hair Care Consultation",
    projectTitleAr: "استشارة العناية الاحترافية بالشعر",
    scenario: "You have been appointed as a professional hair stylist consultant at VisionEx Beauty Network. Your client has come in for a comprehensive hair consultation. You will assess their hair type, scalp condition, and lifestyle to recommend personalized care routines, treatments, and styling solutions. Your AI expertise will guide them toward healthier, more beautiful hair.",
    scenarioAr: "تم تعيينك مستشار تصفيف شعر احترافياً في شبكة فيجن إكس للجمال. عميلك حضر لاستشارة شعر شاملة. ستقيّم نوع شعره وحالة فروة الرأس وأسلوب حياته لتوصي بروتين عناية مخصص وعلاجات وحلول تصفيف. خبرتك الذكية ستوجهه نحو شعر أكثر صحة وجمالاً.",
    budget: "500 VX / Session",
    timeline: "Single Consultation",
    objectives: [
      "Assess the client's hair type, texture, and scalp health accurately",
      "Design a personalized hair care routine and treatment plan",
      "Recommend suitable products aligned with the client's budget and lifestyle",
      "Provide professional styling advice for their desired look",
    ],
    objectivesAr: [
      "تقييم نوع شعر العميل وملمسه وصحة فروة الرأس بدقة",
      "تصميم روتين عناية مخصص وخطة علاجية",
      "التوصية بمنتجات مناسبة تتوافق مع ميزانية العميل وأسلوب حياته",
      "تقديم نصائح تصفيف احترافية للمظهر المطلوب",
    ],
    deliverables: [
      "Personalized hair care routine and product recommendations",
      "Treatment plan for specific hair concerns",
      "Styling guide for daily and special occasion looks",
    ],
    deliverablesAr: [
      "روتين عناية مخصص وتوصيات المنتجات",
      "خطة علاجية لمشاكل الشعر المحددة",
      "دليل التصفيف للإطلالات اليومية والمناسبات الخاصة",
    ],
    tags: ["Beauty", "Lifestyle", "Personal Care"],
    tagsAr: ["جمال", "أسلوب حياة", "عناية شخصية"],
  },

  "svc-skin-care": {
    clientName: "VisionEx Dermatology Clinic",
    clientNameAr: "عيادة فيجن إكس للأمراض الجلدية",
    clientLogo: "✨",
    projectTitle: "Personalized Skin Care Consultation",
    projectTitleAr: "استشارة العناية المخصصة بالبشرة",
    scenario: "As a skin care specialist at VisionEx Dermatology Clinic, you will conduct a thorough analysis of the client's skin type, identify their specific concerns (acne, aging, hyperpigmentation, sensitivity), and build a science-backed skincare routine. You will guide ingredient selection, layering order, and lifestyle adjustments for optimal skin health.",
    scenarioAr: "كأخصائي عناية بالبشرة في عيادة فيجن إكس للأمراض الجلدية، ستجري تحليلاً شاملاً لنوع بشرة العميل وتحدد مشاكله المحددة (حب الشباب، الشيخوخة، تصبغ البشرة، الحساسية) وتبني روتين عناية مدعوم علمياً.",
    budget: "800 VX / Session",
    timeline: "Single Consultation",
    objectives: [
      "Identify skin type and primary concerns through detailed assessment",
      "Build a structured morning and evening skincare routine",
      "Recommend ingredients that address specific concerns without irritation",
      "Advise on lifestyle factors impacting skin health",
    ],
    objectivesAr: [
      "تحديد نوع البشرة والمشاكل الرئيسية من خلال تقييم مفصل",
      "بناء روتين عناية منظم صباحاً ومساءً",
      "التوصية بمكونات تعالج المشاكل المحددة دون تهيج",
      "تقديم المشورة حول عوامل أسلوب الحياة المؤثرة على صحة البشرة",
    ],
    deliverables: [
      "Complete skin analysis report and type classification",
      "Customized morning and evening skincare routine",
      "Ingredient guide and product recommendations by budget",
    ],
    deliverablesAr: [
      "تقرير تحليل البشرة الشامل وتصنيف النوع",
      "روتين عناية صباحي ومسائي مخصص",
      "دليل المكونات والتوصيات حسب الميزانية",
    ],
    tags: ["Beauty", "Wellness", "Dermatology"],
    tagsAr: ["جمال", "صحة", "أمراض جلدية"],
  },

  "svc-social-guide": {
    clientName: "VisionEx Social Intelligence Academy",
    clientNameAr: "أكاديمية فيجن إكس للذكاء الاجتماعي",
    clientLogo: "🤝",
    projectTitle: "Social Skills & Emotional Intelligence Coaching",
    projectTitleAr: "تدريب المهارات الاجتماعية والذكاء العاطفي",
    scenario: "As a social intelligence coach at VisionEx Social Intelligence Academy, you will work one-on-one with a client to identify their social challenges, develop their communication skills, and build emotional intelligence. Through scenario practice, active listening techniques, and personalized strategies, you will help them navigate social situations with confidence.",
    scenarioAr: "كمدرب ذكاء اجتماعي في أكاديمية فيجن إكس، ستعمل مع العميل فردياً لتحديد تحدياته الاجتماعية وتطوير مهارات التواصل وبناء الذكاء العاطفي. من خلال ممارسة السيناريوهات وتقنيات الاستماع النشط والاستراتيجيات المخصصة، ستساعده على التعامل مع المواقف الاجتماعية بثقة.",
    budget: "1,000 VX / Session",
    timeline: "Single Coaching Session",
    objectives: [
      "Identify the client's core social challenges and communication barriers",
      "Practice key social scenarios through AI-guided role play",
      "Develop active listening and empathy skills",
      "Build a personalized action plan for social confidence",
    ],
    objectivesAr: [
      "تحديد التحديات الاجتماعية الأساسية وعوائق التواصل",
      "ممارسة السيناريوهات الاجتماعية الرئيسية عبر لعب الأدوار بتوجيه الذكاء الاصطناعي",
      "تطوير مهارات الاستماع النشط والتعاطف",
      "بناء خطة عمل مخصصة للثقة الاجتماعية",
    ],
    deliverables: [
      "Social skills assessment and gap analysis",
      "Personalized communication improvement plan",
      "Practice scenarios and actionable techniques",
    ],
    deliverablesAr: [
      "تقييم المهارات الاجتماعية وتحليل الفجوات",
      "خطة تحسين التواصل المخصصة",
      "سيناريوهات التدريب والتقنيات القابلة للتطبيق",
    ],
    tags: ["Social Skills", "Personal Development", "Communication"],
    tagsAr: ["مهارات اجتماعية", "تطوير ذاتي", "تواصل"],
  },

  "svc-delivery": {
    clientName: "VisionEx Express Logistics",
    clientNameAr: "فيجن إكسبريس للخدمات اللوجستية",
    clientLogo: "🚚",
    projectTitle: "Urban Delivery & Logistics Operations",
    projectTitleAr: "عمليات التوصيل الحضري واللوجستيات",
    scenario: "As Logistics Operations Manager for VisionEx Express, you oversee urban delivery and ride coordination across a busy metropolitan area. You will optimize delivery routes, coordinate driver assignments, handle customer escalations, manage real-time fleet tracking, and improve operational efficiency while maintaining high customer satisfaction scores.",
    scenarioAr: "بصفتك مدير عمليات لوجستية في فيجن إكسبريس، تشرف على التوصيل الحضري وتنسيق الرحلات عبر منطقة حضرية مزدحمة. ستحسّن مسارات التوصيل وتنسق تعيين السائقين وتتعامل مع تصعيدات العملاء وتدير تتبع الأسطول في الوقت الفعلي.",
    budget: "1,500 VX / Session",
    timeline: "Operations Shift",
    objectives: [
      "Optimize delivery routes to reduce time and fuel consumption",
      "Coordinate driver scheduling and real-time dispatching",
      "Resolve customer complaints and maintain satisfaction above 90%",
      "Identify bottlenecks and propose operational improvements",
    ],
    objectivesAr: [
      "تحسين مسارات التوصيل لتقليل الوقت والوقود",
      "تنسيق جدولة السائقين والإرسال في الوقت الفعلي",
      "حل شكاوى العملاء والحفاظ على الرضا فوق 90%",
      "تحديد الاختناقات واقتراح تحسينات تشغيلية",
    ],
    deliverables: [
      "Route optimization analysis and recommendations",
      "Driver performance and dispatch efficiency report",
      "Customer satisfaction improvement action plan",
    ],
    deliverablesAr: [
      "تحليل وتوصيات تحسين المسار",
      "تقرير أداء السائقين وكفاءة الإرسال",
      "خطة عمل تحسين رضا العملاء",
    ],
    tags: ["Logistics", "Operations", "Urban Mobility"],
    tagsAr: ["لوجستيات", "عمليات", "تنقل حضري"],
  },

  "svc-shared-trip": {
    clientName: "VisionEx Shared Mobility",
    clientNameAr: "فيجن إكس للتنقل المشترك",
    clientLogo: "🗺️",
    projectTitle: "Group Trip Planning & Coordination",
    projectTitleAr: "تخطيط وتنسيق رحلات المجموعة",
    scenario: "As a group travel coordinator at VisionEx Shared Mobility, you will help clients plan and organize shared trips — from daily carpool routes to group excursions. You will advise on route selection, cost-sharing arrangements, pickup coordination, and ensure all participants have a smooth and enjoyable shared journey experience.",
    scenarioAr: "كمنسق رحلات مجموعة في فيجن إكس للتنقل المشترك، ستساعد العملاء على التخطيط وتنظيم الرحلات المشتركة — من مسارات السيارة المشتركة اليومية إلى الرحلات الجماعية. ستقدم المشورة حول اختيار المسار وترتيبات تقاسم التكاليف وتنسيق نقاط الالتقاء.",
    budget: "500 VX / Session",
    timeline: "Planning Session",
    objectives: [
      "Map the optimal shared route that suits all passengers",
      "Calculate fair cost-splitting arrangements",
      "Coordinate pickup points and timing for all participants",
      "Ensure safety, comfort, and satisfaction for all group members",
    ],
    objectivesAr: [
      "تحديد المسار المشترك الأمثل الذي يناسب جميع الركاب",
      "حساب ترتيبات تقاسم التكاليف العادلة",
      "تنسيق نقاط الالتقاء والتوقيت لجميع المشاركين",
      "ضمان السلامة والراحة والرضا لجميع أفراد المجموعة",
    ],
    deliverables: [
      "Optimized shared route plan with pickup schedule",
      "Cost-sharing breakdown and payment plan",
      "Trip summary with safety and comfort guidelines",
    ],
    deliverablesAr: [
      "خطة مسار مشتركة محسّنة مع جدول الالتقاء",
      "تفصيل تقاسم التكاليف وخطة الدفع",
      "ملخص الرحلة مع إرشادات السلامة والراحة",
    ],
    tags: ["Mobility", "Community", "Transportation"],
    tagsAr: ["تنقل", "مجتمع", "مواصلات"],
  },

  "svc-sports-coach": {
    clientName: "VisionEx Fitness & Performance",
    clientNameAr: "فيجن إكس للياقة والأداء",
    clientLogo: "💪",
    projectTitle: "Personal Sports & Fitness Coaching",
    projectTitleAr: "التدريب الشخصي للرياضة واللياقة",
    scenario: "As a certified personal trainer at VisionEx Fitness & Performance, you will design a comprehensive fitness program for your client. Starting with a full assessment of their current fitness level, goals, and any physical limitations, you will build a progressive training plan covering strength, cardio, flexibility, and nutrition to help them achieve peak performance.",
    scenarioAr: "كمدرب شخصي معتمد في فيجن إكس للياقة، ستصمم برنامجاً لياقياً شاملاً لعميلك. بدءاً من تقييم كامل لمستوى لياقته الحالي وأهدافه وأي قيود جسدية، ستبني خطة تدريب تدريجية تشمل القوة والكارديو والمرونة والتغذية.",
    budget: "2,000 VX / Session",
    timeline: "12-Week Program Design",
    objectives: [
      "Conduct a thorough fitness assessment and goal-setting session",
      "Design a progressive training plan tailored to the client's goals",
      "Provide nutritional guidance to support training performance",
      "Create recovery and injury prevention protocols",
    ],
    objectivesAr: [
      "إجراء تقييم لياقة شامل وجلسة تحديد أهداف",
      "تصميم خطة تدريب تدريجية مصممة لأهداف العميل",
      "تقديم إرشادات غذائية لدعم أداء التدريب",
      "إنشاء بروتوكولات التعافي والوقاية من الإصابات",
    ],
    deliverables: [
      "Personalized 12-week training program",
      "Nutrition and hydration guidelines",
      "Progress tracking and milestone checkpoints",
    ],
    deliverablesAr: [
      "برنامج تدريبي مخصص لمدة 12 أسبوع",
      "إرشادات التغذية والترطيب",
      "تتبع التقدم ونقاط التحقق من الإنجازات",
    ],
    tags: ["Fitness", "Sports", "Health & Wellness"],
    tagsAr: ["لياقة", "رياضة", "الصحة والعافية"],
  },

  "svc-empathy-oasis": {
    clientName: "VisionEx Wellbeing Center",
    clientNameAr: "مركز فيجن إكس للرفاهية",
    clientLogo: "🧘",
    projectTitle: "Emotional Wellness & Empathy Support",
    projectTitleAr: "دعم الصحة العاطفية والتعاطف",
    scenario: "As a wellbeing guide at VisionEx Wellbeing Center, you create a compassionate, non-judgmental space for individuals seeking emotional support. You will actively listen to the client's feelings and experiences, help them explore their emotions constructively, and offer mindfulness techniques, coping strategies, and empathy-centered guidance to support their emotional health journey.",
    scenarioAr: "كمرشد رفاهية في مركز فيجن إكس للرفاهية، تخلق مساحة متعاطفة وغير منحازة للأفراد الباحثين عن الدعم العاطفي. ستستمع باهتمام لمشاعر العميل وتجاربه، وتساعده على استكشاف مشاعره بشكل بنّاء، وتقدم تقنيات اليقظة الذهنية.",
    budget: "3,000 VX / Session",
    timeline: "Single Wellness Session",
    objectives: [
      "Create a safe, judgment-free space for emotional expression",
      "Practice active listening and reflective empathy",
      "Guide the client through mindfulness and grounding techniques",
      "Provide actionable coping strategies for their specific challenges",
    ],
    objectivesAr: [
      "إنشاء مساحة آمنة وخالية من الحكم للتعبير العاطفي",
      "ممارسة الاستماع النشط والتعاطف التأملي",
      "إرشاد العميل عبر تقنيات اليقظة الذهنية والتأريض",
      "تقديم استراتيجيات تأقلم قابلة للتنفيذ لتحدياته المحددة",
    ],
    deliverables: [
      "Emotional check-in summary and key insights",
      "Personalized mindfulness and coping toolkit",
      "Follow-up wellness recommendations",
    ],
    deliverablesAr: [
      "ملخص التحقق العاطفي والرؤى الرئيسية",
      "مجموعة أدوات اليقظة الذهنية والتأقلم الشخصية",
      "توصيات الرفاهية للمتابعة",
    ],
    tags: ["Mental Wellness", "Empathy", "Mindfulness"],
    tagsAr: ["الصحة النفسية", "تعاطف", "يقظة ذهنية"],
  },

  "svc-nutrition": {
    clientName: "VisionEx Nutrition Institute",
    clientNameAr: "معهد فيجن إكس للتغذية",
    clientLogo: "🥗",
    projectTitle: "Personalized Nutrition & Dietary Consultation",
    projectTitleAr: "استشارة التغذية والغذاء المخصصة",
    scenario: "As a certified nutrition expert at VisionEx Nutrition Institute, you will conduct a thorough dietary assessment and design a personalized nutrition plan for your client. Considering their health goals, food preferences, allergies, lifestyle, and budget, you will create a sustainable eating plan backed by nutritional science to optimize their health and wellbeing.",
    scenarioAr: "كخبير تغذية معتمد في معهد فيجن إكس للتغذية، ستجري تقييماً غذائياً شاملاً وتصمم خطة تغذية مخصصة لعميلك. مع مراعاة أهدافه الصحية وتفضيلات الطعام والحساسيات وأسلوب الحياة والميزانية، ستنشئ خطة أكل مستدامة.",
    budget: "4,000 VX / Session",
    timeline: "Single Consultation + Plan",
    objectives: [
      "Assess current dietary habits, nutritional deficiencies, and health goals",
      "Design a balanced meal plan tailored to the client's needs",
      "Educate on macronutrients, micronutrients, and meal timing",
      "Provide guidance on healthy food choices within their budget",
    ],
    objectivesAr: [
      "تقييم العادات الغذائية الحالية والنقص الغذائي والأهداف الصحية",
      "تصميم خطة وجبات متوازنة مصممة لاحتياجات العميل",
      "التثقيف حول المغذيات الكبرى والصغرى وتوقيت الوجبات",
      "تقديم إرشادات حول الخيارات الغذائية الصحية ضمن الميزانية",
    ],
    deliverables: [
      "Personalized weekly meal plan with recipes",
      "Nutritional analysis and supplement recommendations",
      "Grocery shopping guide and meal prep strategies",
    ],
    deliverablesAr: [
      "خطة وجبات أسبوعية مخصصة مع وصفات",
      "التحليل الغذائي وتوصيات المكملات",
      "دليل التسوق الغذائي واستراتيجيات تحضير الوجبات",
    ],
    tags: ["Nutrition", "Health", "Wellness"],
    tagsAr: ["تغذية", "صحة", "عافية"],
  },

  "svc-medical": {
    clientName: "VisionEx Virtual Health Center",
    clientNameAr: "مركز فيجن إكس للصحة الافتراضية",
    clientLogo: "🏥",
    projectTitle: "Virtual Medical Consultation",
    projectTitleAr: "الاستشارة الطبية الافتراضية",
    scenario: "As an AI General Practitioner at VisionEx Virtual Health Center, you provide accessible, informative medical consultations. Clients will share their symptoms and health concerns; you will listen carefully, ask clarifying questions, provide evidence-based health information, explain medical concepts in plain language, and advise on when to seek in-person professional care.",
    scenarioAr: "كطبيب عام ذكاء اصطناعي في مركز فيجن إكس الصحي الافتراضي، تقدم استشارات طبية يمكن الوصول إليها ومفيدة. سيشارك العملاء أعراضهم ومخاوفهم الصحية؛ ستستمع بعناية وتطرح أسئلة توضيحية وتقدم معلومات صحية مبنية على الأدلة.",
    budget: "6,000 VX / Session",
    timeline: "Single Medical Consultation",
    objectives: [
      "Gather a complete symptom history and understand the health concern",
      "Provide accurate, evidence-based health information and education",
      "Explain medical concepts in clear, accessible language",
      "Advise on appropriate next steps and when professional care is needed",
    ],
    objectivesAr: [
      "جمع تاريخ الأعراض الكامل وفهم المخاوف الصحية",
      "تقديم معلومات صحية دقيقة مبنية على الأدلة وتثقيف",
      "شرح المفاهيم الطبية بلغة واضحة وسهلة الفهم",
      "تقديم المشورة حول الخطوات المناسبة ومتى تكون الرعاية المهنية ضرورية",
    ],
    deliverables: [
      "Symptom assessment summary and health information",
      "Recommended next steps and self-care guidelines",
      "Referral guidance for specialist care if needed",
    ],
    deliverablesAr: [
      "ملخص تقييم الأعراض والمعلومات الصحية",
      "الخطوات الموصى بها وإرشادات الرعاية الذاتية",
      "إرشادات الإحالة للرعاية المتخصصة عند الحاجة",
    ],
    tags: ["Healthcare", "Medical", "Telemedicine"],
    tagsAr: ["رعاية صحية", "طبي", "طب عن بُعد"],
  },

  "svc-psychology": {
    clientName: "VisionEx Mind & Wellness Clinic",
    clientNameAr: "عيادة فيجن إكس للعقل والصحة",
    clientLogo: "🧠",
    projectTitle: "Psychology & Mental Health Support Session",
    projectTitleAr: "جلسة دعم علم النفس والصحة النفسية",
    scenario: "As a mental health practitioner at VisionEx Mind & Wellness Clinic, you will provide a structured psychological support session. You will use evidence-based approaches including cognitive-behavioral techniques, mindfulness, and solution-focused therapy to help clients understand their thought patterns, manage emotional difficulties, and develop healthier mental frameworks.",
    scenarioAr: "كأخصائي صحة نفسية في عيادة فيجن إكس للعقل والصحة، ستقدم جلسة دعم نفسي منظمة. ستستخدم نهجاً مبنياً على الأدلة يشمل تقنيات السلوك المعرفي واليقظة الذهنية والعلاج المرتكز على الحلول.",
    budget: "8,000 VX / Session",
    timeline: "Single Therapy Session",
    objectives: [
      "Establish a therapeutic rapport and safe conversation environment",
      "Explore the client's presenting concerns and emotional patterns",
      "Apply evidence-based psychological techniques and interventions",
      "Develop practical coping strategies and a wellbeing action plan",
    ],
    objectivesAr: [
      "بناء العلاقة العلاجية وبيئة محادثة آمنة",
      "استكشاف مخاوف العميل وأنماطه العاطفية",
      "تطبيق تقنيات وتدخلات نفسية مبنية على الأدلة",
      "تطوير استراتيجيات تأقلم عملية وخطة عمل للرفاهية",
    ],
    deliverables: [
      "Session insights and therapeutic reflection summary",
      "Personalized coping strategy toolkit",
      "Mental wellness goals and progress markers",
    ],
    deliverablesAr: [
      "رؤى الجلسة وملخص التأمل العلاجي",
      "مجموعة أدوات استراتيجية التأقلم الشخصية",
      "أهداف الصحة النفسية ومؤشرات التقدم",
    ],
    tags: ["Mental Health", "Psychology", "Therapy"],
    tagsAr: ["الصحة النفسية", "علم النفس", "علاج نفسي"],
  },

  "svc-travel-agency": {
    clientName: "VisionEx Global Travel",
    clientNameAr: "فيجن إكس للسفر العالمي",
    clientLogo: "✈️",
    projectTitle: "Global Travel Experience Planning",
    projectTitleAr: "تخطيط تجربة السفر العالمية",
    scenario: "As a travel experience designer at VisionEx Global Travel, you will craft a fully personalized travel itinerary for your client. From destination research and visa requirements to flight options, accommodation recommendations, local experiences, and budget planning — you will design a seamless journey that matches their dream travel vision.",
    scenarioAr: "كمصمم تجارب سفر في فيجن إكس للسفر العالمي، ستصنع مسار رحلة مخصصاً بالكامل لعميلك. من أبحاث الوجهة ومتطلبات التأشيرة إلى خيارات الطيران وتوصيات الإقامة والتجارب المحلية وتخطيط الميزانية.",
    budget: "10,000 VX / Session",
    timeline: "Full Trip Planning Session",
    objectives: [
      "Understand the client's travel vision, preferences, and budget",
      "Research and recommend the perfect destination and itinerary",
      "Advise on visa, travel insurance, and health requirements",
      "Design a day-by-day travel experience tailored to their interests",
    ],
    objectivesAr: [
      "فهم رؤية السفر والتفضيلات والميزانية للعميل",
      "البحث والتوصية بالوجهة المثالية وخط السير",
      "تقديم المشورة بشأن التأشيرة والتأمين الصحي ومتطلبات الصحة",
      "تصميم تجربة سفر يومية مصممة لاهتماماتهم",
    ],
    deliverables: [
      "Complete travel itinerary with day-by-day schedule",
      "Budget breakdown and booking recommendations",
      "Destination guide with local tips and must-see experiences",
    ],
    deliverablesAr: [
      "مسار رحلة كامل مع جدول يومي",
      "تفصيل الميزانية وتوصيات الحجز",
      "دليل الوجهة مع نصائح محلية وتجارب يجب تجربتها",
    ],
    tags: ["Travel", "Tourism", "Lifestyle"],
    tagsAr: ["سفر", "سياحة", "أسلوب حياة"],
  },

  "svc-music": {
    clientName: "VisionEx Music Conservatory",
    clientNameAr: "معهد فيجن إكس للموسيقى",
    clientLogo: "🎵",
    projectTitle: "Music Education & Conservatory Mentorship",
    projectTitleAr: "التعليم الموسيقي والإرشاد الأكاديمي",
    scenario: "As a music instructor at VisionEx Music Conservatory, you will conduct a professional music lesson and mentorship session. Covering music theory, instrument technique, ear training, sight-reading, and musical expression, you will assess the student's current level and design a structured learning path that builds their musical foundation and artistry.",
    scenarioAr: "كمدرس موسيقى في معهد فيجن إكس للموسيقى، ستجري درساً موسيقياً احترافياً وجلسة إرشاد. يشمل نظرية الموسيقى وتقنية الآلة وتدريب الأذن والقراءة بالأفق والتعبير الموسيقي، وستقيّم مستوى الطالب الحالي وتصمم مساراً تعليمياً منظماً.",
    budget: "12,000 VX / Session",
    timeline: "Music Lesson Session",
    objectives: [
      "Assess the student's current musical level and knowledge gaps",
      "Teach targeted music theory concepts and practical techniques",
      "Develop ear training and musical listening skills",
      "Design a structured practice plan for continued improvement",
    ],
    objectivesAr: [
      "تقييم المستوى الموسيقي الحالي للطالب وفجوات المعرفة",
      "تدريس مفاهيم نظرية الموسيقى والتقنيات العملية المستهدفة",
      "تطوير تدريب الأذن ومهارات الاستماع الموسيقي",
      "تصميم خطة تدريب منظمة للتحسين المستمر",
    ],
    deliverables: [
      "Musical skills assessment and learning pathway",
      "Lesson notes with theory concepts and technique exercises",
      "Structured practice schedule and repertoire recommendations",
    ],
    deliverablesAr: [
      "تقييم المهارات الموسيقية ومسار التعلم",
      "ملاحظات الدرس مع مفاهيم النظرية وتمارين التقنية",
      "جدول تدريب منظم وتوصيات الأداء الموسيقي",
    ],
    tags: ["Music", "Arts", "Education"],
    tagsAr: ["موسيقى", "فنون", "تعليم"],
  },

  "svc-studio": {
    clientName: "VisionEx Creative Production House",
    clientNameAr: "دار فيجن إكس للإنتاج الإبداعي",
    clientLogo: "🎬",
    projectTitle: "Creative Media Production Consultation",
    projectTitleAr: "استشارة الإنتاج الإعلامي الإبداعي",
    scenario: "As Creative Director at VisionEx Creative Production House, you will consult with clients on media projects, content strategy, brand storytelling, and production planning. From concept development and script writing to visual identity, direction style, and distribution strategy — you will bring creative visions to life with professional direction and media expertise.",
    scenarioAr: "كمدير إبداعي في دار فيجن إكس للإنتاج الإبداعي، ستستشير العملاء حول مشاريع الإعلام واستراتيجية المحتوى وسرد القصص العلامة التجارية والتخطيط للإنتاج. من تطوير المفهوم وكتابة السيناريو إلى الهوية البصرية وأسلوب الإخراج واستراتيجية التوزيع.",
    budget: "15,000 VX / Session",
    timeline: "Creative Strategy Session",
    objectives: [
      "Understand the client's creative vision and production goals",
      "Develop a compelling creative concept and production brief",
      "Advise on visual style, tone, and brand storytelling approach",
      "Create a production roadmap with timeline and resource plan",
    ],
    objectivesAr: [
      "فهم الرؤية الإبداعية للعميل وأهداف الإنتاج",
      "تطوير مفهوم إبداعي مقنع وملخص إنتاج",
      "تقديم المشورة حول الأسلوب البصري والنبرة ونهج سرد القصص",
      "إنشاء خارطة طريق إنتاج مع جدول زمني وخطة موارد",
    ],
    deliverables: [
      "Creative brief and concept development document",
      "Production roadmap and timeline",
      "Style guide and visual identity recommendations",
    ],
    deliverablesAr: [
      "وثيقة تطوير الملخص الإبداعي والمفهوم",
      "خارطة طريق الإنتاج والجدول الزمني",
      "دليل الأسلوب وتوصيات الهوية البصرية",
    ],
    tags: ["Media", "Creative", "Production"],
    tagsAr: ["إعلام", "إبداعي", "إنتاج"],
  },

  "svc-legal": {
    clientName: "VisionEx Legal Advisory Services",
    clientNameAr: "خدمات فيجن إكس للاستشارات القانونية",
    clientLogo: "⚖️",
    projectTitle: "Legal Advisory Consultation",
    projectTitleAr: "استشارة المستشار القانوني",
    scenario: "As a legal advisor at VisionEx Legal Advisory Services, you will provide comprehensive legal guidance on a wide range of matters including contracts, business law, personal rights, intellectual property, and dispute resolution. You will analyze the client's situation, explain the relevant legal framework in plain language, and recommend the most appropriate course of action.",
    scenarioAr: "كمستشار قانوني في خدمات فيجن إكس للاستشارات القانونية، ستقدم توجيهاً قانونياً شاملاً في مجموعة واسعة من المسائل بما في ذلك العقود وقانون الأعمال والحقوق الشخصية والملكية الفكرية وحل النزاعات.",
    budget: "20,000 VX / Session",
    timeline: "Legal Consultation Session",
    objectives: [
      "Understand the client's legal situation and the specific issue at hand",
      "Identify the relevant legal framework and applicable regulations",
      "Explain the legal position and options available in clear language",
      "Recommend the best course of action and next steps",
    ],
    objectivesAr: [
      "فهم الوضع القانوني للعميل والمسألة المحددة المطروحة",
      "تحديد الإطار القانوني ذي الصلة واللوائح المطبقة",
      "شرح المركز القانوني والخيارات المتاحة بلغة واضحة",
      "التوصية بأفضل مسار للعمل والخطوات التالية",
    ],
    deliverables: [
      "Legal situation analysis and risk assessment",
      "Options and recommended course of action",
      "Next steps guidance and document checklist",
    ],
    deliverablesAr: [
      "تحليل الوضع القانوني وتقييم المخاطر",
      "الخيارات والمسار الموصى به للعمل",
      "إرشادات الخطوات التالية وقائمة المستندات المطلوبة",
    ],
    tags: ["Legal", "Business Law", "Advisory"],
    tagsAr: ["قانوني", "قانون الأعمال", "استشارات"],
  },

  "svc-radar-ai": {
    clientName: "VisionEx Intelligence Hub",
    clientNameAr: "مركز فيجن إكس للاستخبارات",
    clientLogo: "📡",
    projectTitle: "AI Intelligence Radar Analysis",
    projectTitleAr: "تحليل رادار الذكاء الاصطناعي",
    scenario: "As an AI Analytics Specialist at VisionEx Intelligence Hub, you operate the AI Radar platform — a sophisticated intelligence scanning system. You will analyze markets, competitors, trends, and strategic environments using AI-powered pattern recognition. Your mission is to transform raw data into actionable intelligence that drives competitive advantage and informed decision-making.",
    scenarioAr: "كمتخصص تحليلات ذكاء اصطناعي في مركز فيجن إكس للاستخبارات، تشغّل منصة AI Radar — نظام مسح استخباراتي متطور. ستحلل الأسواق والمنافسين والاتجاهات والبيئات الاستراتيجية باستخدام التعرف على الأنماط المدعوم بالذكاء الاصطناعي.",
    budget: "25,000 VX / Session",
    timeline: "Intelligence Analysis Session",
    objectives: [
      "Define the intelligence requirements and scope of analysis",
      "Scan and synthesize relevant data from multiple sources",
      "Identify patterns, risks, and strategic opportunities",
      "Produce actionable intelligence recommendations",
    ],
    objectivesAr: [
      "تحديد متطلبات الاستخبارات ونطاق التحليل",
      "مسح وتوليف البيانات ذات الصلة من مصادر متعددة",
      "تحديد الأنماط والمخاطر والفرص الاستراتيجية",
      "إنتاج توصيات استخباراتية قابلة للتنفيذ",
    ],
    deliverables: [
      "Intelligence scan report with key findings",
      "Pattern analysis and risk identification matrix",
      "Strategic recommendations and action priorities",
    ],
    deliverablesAr: [
      "تقرير المسح الاستخباراتي مع النتائج الرئيسية",
      "تحليل الأنماط ومصفوفة تحديد المخاطر",
      "التوصيات الاستراتيجية وأولويات العمل",
    ],
    tags: ["AI", "Intelligence", "Analytics", "Strategy"],
    tagsAr: ["ذكاء اصطناعي", "استخبارات", "تحليلات", "استراتيجية"],
  },

  "svc-economy": {
    clientName: "VisionEx Economic Institute",
    clientNameAr: "معهد فيجن إكس الاقتصادي",
    clientLogo: "📊",
    projectTitle: "VX Economic Ecosystem Consultation",
    projectTitleAr: "استشارة النظام الاقتصادي VX",
    scenario: "As an economic analyst at VisionEx Economic Institute, you will analyze the VX economic ecosystem, market dynamics, investment opportunities, and growth strategies. You will help clients understand macroeconomic trends, evaluate business models, assess investment risks, and develop strategic plans that maximize their economic participation and returns within the VisionEx economy.",
    scenarioAr: "كمحلل اقتصادي في معهد فيجن إكس الاقتصادي، ستحلل النظام الاقتصادي لـ VX وديناميكيات السوق وفرص الاستثمار واستراتيجيات النمو. ستساعد العملاء على فهم الاتجاهات الاقتصادية الكلية وتقييم نماذج الأعمال.",
    budget: "30,000 VX / Session",
    timeline: "Economic Strategy Session",
    objectives: [
      "Analyze current VX market conditions and economic indicators",
      "Evaluate investment opportunities and risk-return profiles",
      "Develop economic strategies aligned with client's financial goals",
      "Build a roadmap for sustainable economic participation and growth",
    ],
    objectivesAr: [
      "تحليل ظروف سوق VX الحالية والمؤشرات الاقتصادية",
      "تقييم فرص الاستثمار وملامح المخاطر والعوائد",
      "تطوير استراتيجيات اقتصادية تتوافق مع الأهداف المالية للعميل",
      "بناء خارطة طريق للمشاركة الاقتصادية المستدامة والنمو",
    ],
    deliverables: [
      "VX market analysis and economic trends report",
      "Investment opportunity assessment with risk matrix",
      "Strategic economic roadmap and growth plan",
    ],
    deliverablesAr: [
      "تحليل سوق VX وتقرير الاتجاهات الاقتصادية",
      "تقييم فرصة الاستثمار مع مصفوفة المخاطر",
      "خارطة الطريق الاقتصادية الاستراتيجية وخطة النمو",
    ],
    tags: ["Economics", "Investment", "Business Strategy"],
    tagsAr: ["اقتصاد", "استثمار", "استراتيجية أعمال"],
  },

  "svc-career": {
    clientName: "VisionEx Career & Talent Institute",
    clientNameAr: "معهد فيجن إكس للمسار المهني والمواهب",
    clientLogo: "🚀",
    projectTitle: "Career Development & Professional Growth Coaching",
    projectTitleAr: "تدريب التطوير المهني والنمو الوظيفي",
    scenario: "As a career coach and talent advisor at VisionEx Career Institute, you will guide professionals through strategic career development. Covering resume optimization, personal branding, interview mastery, salary negotiation, skills gap analysis, and career pivoting strategies — you will help clients build the career trajectory they aspire to achieve.",
    scenarioAr: "كمدرب مهني ومستشار مواهب في معهد فيجن إكس للمسار المهني، ستوجه المهنيين عبر التطوير المهني الاستراتيجي. يشمل تحسين السيرة الذاتية والعلامة الشخصية وإتقان المقابلات والتفاوض على الراتب وتحليل فجوات المهارات واستراتيجيات تغيير المسار المهني.",
    budget: "40,000 VX / Session",
    timeline: "Career Strategy Session",
    objectives: [
      "Assess current career position, strengths, and development areas",
      "Define clear career goals and the strategic path to achieve them",
      "Optimize resume, LinkedIn profile, and personal brand",
      "Prepare for interviews and develop negotiation strategies",
    ],
    objectivesAr: [
      "تقييم المركز المهني الحالي ونقاط القوة ومناطق التطوير",
      "تحديد أهداف مهنية واضحة والمسار الاستراتيجي لتحقيقها",
      "تحسين السيرة الذاتية وملف LinkedIn والعلامة الشخصية",
      "التحضير للمقابلات وتطوير استراتيجيات التفاوض",
    ],
    deliverables: [
      "Career assessment and goal-setting roadmap",
      "Resume and personal brand optimization plan",
      "Interview preparation guide and negotiation playbook",
    ],
    deliverablesAr: [
      "خارطة طريق تقييم المسار المهني وتحديد الأهداف",
      "خطة تحسين السيرة الذاتية والعلامة الشخصية",
      "دليل التحضير للمقابلات وكتيب التفاوض",
    ],
    tags: ["Career Development", "Professional Growth", "HR"],
    tagsAr: ["تطوير مهني", "نمو وظيفي", "موارد بشرية"],
  },

  "svc-edu-empire": {
    clientName: "VisionEx Global Education Network",
    clientNameAr: "شبكة فيجن إكس التعليمية العالمية",
    clientLogo: "🏛️",
    projectTitle: "Global Educational Empire Strategy",
    projectTitleAr: "استراتيجية الإمبراطورية التعليمية العالمية",
    scenario: "As Education Director at VisionEx Global Education Network, you will help clients design, launch, and scale world-class educational programs and institutions. From curriculum architecture and pedagogical approach to operational systems, faculty development, technology integration, and global expansion strategy — you will guide the building of educational empires that make lasting impact.",
    scenarioAr: "كمدير تعليمي في شبكة فيجن إكس التعليمية العالمية، ستساعد العملاء على تصميم وإطلاق وتوسيع برامج ومؤسسات تعليمية عالمية المستوى. من بنية المناهج والنهج التربوي إلى الأنظمة التشغيلية وتطوير أعضاء هيئة التدريس وتكامل التكنولوجيا واستراتيجية التوسع العالمي.",
    budget: "60,000 VX / Session",
    timeline: "Educational Strategy Session",
    objectives: [
      "Define the educational vision, mission, and impact goals",
      "Design the curriculum architecture and pedagogical framework",
      "Develop operational and technology integration strategy",
      "Create a global expansion and sustainability roadmap",
    ],
    objectivesAr: [
      "تحديد الرؤية التعليمية والرسالة وأهداف التأثير",
      "تصميم بنية المناهج والإطار التربوي",
      "تطوير استراتيجية التشغيل وتكامل التكنولوجيا",
      "إنشاء خارطة طريق التوسع العالمي والاستدامة",
    ],
    deliverables: [
      "Educational vision document and strategic framework",
      "Curriculum and program design blueprint",
      "Global operations and expansion strategy report",
    ],
    deliverablesAr: [
      "وثيقة الرؤية التعليمية والإطار الاستراتيجي",
      "مخطط تصميم المنهج والبرنامج",
      "تقرير استراتيجية العمليات والتوسع العالمي",
    ],
    tags: ["Education", "Global Strategy", "Institution Building"],
    tagsAr: ["تعليم", "استراتيجية عالمية", "بناء المؤسسات"],
  },
};
