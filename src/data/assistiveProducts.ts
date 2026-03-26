export interface AssistiveProduct {
  id: string;
  nameEn: string;
  nameAr: string;
  nameEs: string;
  stores: string[];
  storeCount: number;
  specs: { en: string[]; ar: string[]; es: string[] };
}

export interface AssistiveCategory {
  id: string;
  nameEn: string;
  nameAr: string;
  nameEs: string;
  icon: string;
  products: AssistiveProduct[];
}

export const assistiveCategories: AssistiveCategory[] = [
  {
    id: "braille-technology",
    nameEn: "Braille Technology",
    nameAr: "تقنيات بريل",
    nameEs: "Tecnología Braille",
    icon: "⠿",
    products: [
      {
        id: "braille-display",
        nameEn: "Braille Display",
        nameAr: "شاشة بريل",
        nameEs: "Pantalla Braille",
        stores: ["HumanWare", "HIMS International", "Help Tech", "MaxiAids", "LS&S Products"],
        storeCount: 5,
        specs: {
          en: ["Number of braille cells (20/32/40/80)", "Bluetooth or USB connectivity", "Phone and computer support", "Internal battery or direct power"],
          ar: ["عدد خلايا بريل (20/32/40/80)", "اتصال بلوتوث أو USB", "دعم الهاتف والكمبيوتر", "بطارية داخلية أو طاقة مباشرة"],
          es: ["Número de celdas braille (20/32/40/80)", "Conectividad Bluetooth o USB", "Soporte para teléfono y computadora", "Batería interna o alimentación directa"],
        },
      },
      {
        id: "braille-notetaker",
        nameEn: "Braille Notetaker",
        nameAr: "مدوّن ملاحظات بريل",
        nameEs: "Anotador Braille",
        stores: ["HumanWare", "HIMS International", "MaxiAids", "LS&S Products"],
        storeCount: 4,
        specs: {
          en: ["Android or proprietary OS", "OCR camera", "Braille screen size", "Additional apps support"],
          ar: ["نظام أندرويد أو نظام مملوك", "كاميرا OCR", "حجم شاشة بريل", "دعم تطبيقات إضافية"],
          es: ["Android o SO propietario", "Cámara OCR", "Tamaño de pantalla braille", "Soporte de aplicaciones adicionales"],
        },
      },
      {
        id: "braille-embosser",
        nameEn: "Braille Embosser (Braille Printer)",
        nameAr: "طابعة بريل",
        nameEs: "Impresora Braille",
        stores: ["Index Braille", "Help Tech", "MaxiAids", "LS&S Products"],
        storeCount: 4,
        specs: {
          en: ["Printing speed", "Single-sided or double-sided", "Paper size support"],
          ar: ["سرعة الطباعة", "طباعة من جانب واحد أو وجهين", "دعم حجم الورق"],
          es: ["Velocidad de impresión", "Impresión de una o doble cara", "Soporte de tamaño de papel"],
        },
      },
      {
        id: "braille-ereader",
        nameEn: "Braille eReader",
        nameAr: "قارئ إلكتروني بريل",
        nameEs: "Lector Electrónico Braille",
        stores: ["HumanWare", "HIMS International", "MaxiAids"],
        storeCount: 3,
        specs: {
          en: ["Braille screen size", "Digital book support", "Wi-Fi connectivity"],
          ar: ["حجم شاشة بريل", "دعم الكتب الرقمية", "اتصال Wi-Fi"],
          es: ["Tamaño de pantalla braille", "Soporte de libros digitales", "Conectividad Wi-Fi"],
        },
      },
      {
        id: "braille-smartwatch",
        nameEn: "Braille Smartwatch",
        nameAr: "ساعة بريل الذكية",
        nameEs: "Reloj Inteligente Braille",
        stores: ["Dot Inc.", "MaxiAids"],
        storeCount: 2,
        specs: {
          en: ["Braille time display", "Phone notifications", "Bluetooth connectivity"],
          ar: ["عرض الوقت بطريقة بريل", "إشعارات الهاتف", "اتصال بلوتوث"],
          es: ["Visualización de hora en braille", "Notificaciones del teléfono", "Conectividad Bluetooth"],
        },
      },
    ],
  },
  {
    id: "reading-ocr",
    nameEn: "Reading and OCR Devices",
    nameAr: "أجهزة القراءة والتعرف الضوئي",
    nameEs: "Dispositivos de Lectura y OCR",
    icon: "📖",
    products: [
      {
        id: "ocr-reading-device",
        nameEn: "OCR Reading Device",
        nameAr: "جهاز قراءة OCR",
        nameEs: "Dispositivo de Lectura OCR",
        stores: ["HumanWare", "HIMS International", "RNIB Shop", "MaxiAids", "LS&S Products"],
        storeCount: 5,
        specs: {
          en: ["Instant reading or page capture", "Multilingual support", "Portable or desktop"],
          ar: ["قراءة فورية أو التقاط الصفحة", "دعم متعدد اللغات", "محمول أو مكتبي"],
          es: ["Lectura instantánea o captura de página", "Soporte multilingüe", "Portátil o de escritorio"],
        },
      },
      {
        id: "portable-ocr-reader",
        nameEn: "Portable OCR Reader",
        nameAr: "قارئ OCR محمول",
        nameEs: "Lector OCR Portátil",
        stores: ["HumanWare", "HIMS International", "MaxiAids", "RNIB Shop"],
        storeCount: 4,
        specs: {
          en: ["Device size", "Reading speed", "Currency and color support"],
          ar: ["حجم الجهاز", "سرعة القراءة", "دعم العملات والألوان"],
          es: ["Tamaño del dispositivo", "Velocidad de lectura", "Soporte de moneda y color"],
        },
      },
      {
        id: "desktop-reading-machine",
        nameEn: "Desktop Reading Machine",
        nameAr: "جهاز قراءة مكتبي",
        nameEs: "Máquina de Lectura de Escritorio",
        stores: ["HumanWare", "HIMS International", "MaxiAids"],
        storeCount: 3,
        specs: {
          en: ["Integrated screen", "Camera quality", "Thick book support"],
          ar: ["شاشة مدمجة", "جودة الكاميرا", "دعم الكتب السميكة"],
          es: ["Pantalla integrada", "Calidad de cámara", "Soporte de libros gruesos"],
        },
      },
    ],
  },
  {
    id: "magnification",
    nameEn: "Magnification and Low Vision",
    nameAr: "التكبير وضعف البصر",
    nameEs: "Ampliación y Baja Visión",
    icon: "🔎",
    products: [
      {
        id: "video-magnifier",
        nameEn: "Video Magnifier",
        nameAr: "مكبر فيديو",
        nameEs: "Lupa de Video",
        stores: ["Reinecker Vision", "Help Tech", "RNIB Shop", "MaxiAids", "LS&S Products"],
        storeCount: 5,
        specs: {
          en: ["Screen size", "Digital zoom up to 60x", "Color modes"],
          ar: ["حجم الشاشة", "تكبير رقمي حتى 60x", "أوضاع الألوان"],
          es: ["Tamaño de pantalla", "Zoom digital hasta 60x", "Modos de color"],
        },
      },
      {
        id: "portable-magnifier",
        nameEn: "Portable Electronic Magnifier",
        nameAr: "مكبر إلكتروني محمول",
        nameEs: "Lupa Electrónica Portátil",
        stores: ["Reinecker Vision", "RNIB Shop", "MaxiAids", "LS&S Products"],
        storeCount: 4,
        specs: {
          en: ["Screen size", "Battery life", "Image capture"],
          ar: ["حجم الشاشة", "عمر البطارية", "التقاط الصور"],
          es: ["Tamaño de pantalla", "Duración de batería", "Captura de imagen"],
        },
      },
      {
        id: "optical-magnifier",
        nameEn: "Optical Magnifier",
        nameAr: "مكبر بصري",
        nameEs: "Lupa Óptica",
        stores: ["RNIB Shop", "MaxiAids", "LS&S Products", "Adaptations Store"],
        storeCount: 4,
        specs: {
          en: ["Optical zoom", "LED illumination", "Lens design"],
          ar: ["تكبير بصري", "إضاءة LED", "تصميم العدسة"],
          es: ["Zoom óptico", "Iluminación LED", "Diseño de lente"],
        },
      },
    ],
  },
  {
    id: "mobility",
    nameEn: "Mobility",
    nameAr: "التنقل",
    nameEs: "Movilidad",
    icon: "🦯",
    products: [
      {
        id: "white-cane",
        nameEn: "White Cane",
        nameAr: "العصا البيضاء",
        nameEs: "Bastón Blanco",
        stores: ["MaxiAids", "LS&S Products", "RNIB Shop", "Adaptations Store", "Al Nattiq Technologies"],
        storeCount: 5,
        specs: {
          en: ["Length", "Aluminum or carbon", "Tip type"],
          ar: ["الطول", "ألمنيوم أو كربون", "نوع الطرف"],
          es: ["Longitud", "Aluminio o carbono", "Tipo de punta"],
        },
      },
      {
        id: "smart-nav-cane",
        nameEn: "Smart Navigation Cane",
        nameAr: "عصا التنقل الذكية",
        nameEs: "Bastón de Navegación Inteligente",
        stores: ["Al Nattiq Technologies", "MaxiAids"],
        storeCount: 2,
        specs: {
          en: ["Electronic sensors", "Vibration alerts", "Phone connectivity"],
          ar: ["مستشعرات إلكترونية", "تنبيهات بالاهتزاز", "اتصال بالهاتف"],
          es: ["Sensores electrónicos", "Alertas de vibración", "Conectividad con teléfono"],
        },
      },
      {
        id: "cane-tip",
        nameEn: "Cane Tip",
        nameAr: "طرف العصا",
        nameEs: "Punta del Bastón",
        stores: ["MaxiAids", "LS&S Products", "RNIB Shop", "Adaptations Store"],
        storeCount: 4,
        specs: {
          en: ["Spherical tip", "Sliding tip", "Rotating tip"],
          ar: ["طرف كروي", "طرف منزلق", "طرف دوار"],
          es: ["Punta esférica", "Punta deslizante", "Punta giratoria"],
        },
      },
    ],
  },
  {
    id: "daily-living",
    nameEn: "Daily Living",
    nameAr: "الحياة اليومية",
    nameEs: "Vida Diaria",
    icon: "🏠",
    products: [
      {
        id: "talking-watch",
        nameEn: "Talking Watch",
        nameAr: "ساعة ناطقة",
        nameEs: "Reloj Parlante",
        stores: ["RNIB Shop", "MaxiAids", "LS&S Products", "Adaptations Store"],
        storeCount: 4,
        specs: {
          en: ["Digital or human voice", "Language support", "Water resistance"],
          ar: ["صوت رقمي أو بشري", "دعم اللغات", "مقاومة الماء"],
          es: ["Voz digital o humana", "Soporte de idiomas", "Resistencia al agua"],
        },
      },
      {
        id: "talking-clock",
        nameEn: "Talking Clock",
        nameAr: "ساعة حائط ناطقة",
        nameEs: "Reloj Parlante de Pared",
        stores: ["RNIB Shop", "MaxiAids", "LS&S Products", "Adaptations Store"],
        storeCount: 4,
        specs: {
          en: ["Time announcement on demand", "Audible alarm", "Large display"],
          ar: ["إعلان الوقت عند الطلب", "منبه مسموع", "شاشة كبيرة"],
          es: ["Anuncio de hora a demanda", "Alarma audible", "Pantalla grande"],
        },
      },
      {
        id: "talking-calculator",
        nameEn: "Talking Calculator",
        nameAr: "آلة حاسبة ناطقة",
        nameEs: "Calculadora Parlante",
        stores: ["RNIB Shop", "MaxiAids", "LS&S Products"],
        storeCount: 3,
        specs: {
          en: ["Large buttons", "Voice output", "Scientific or basic functions"],
          ar: ["أزرار كبيرة", "مخرج صوتي", "وظائف علمية أو أساسية"],
          es: ["Botones grandes", "Salida de voz", "Funciones científicas o básicas"],
        },
      },
    ],
  },
  {
    id: "kitchen-household",
    nameEn: "Kitchen and Household",
    nameAr: "المطبخ والمنزل",
    nameEs: "Cocina y Hogar",
    icon: "🍳",
    products: [
      {
        id: "liquid-level-indicator",
        nameEn: "Liquid Level Indicator",
        nameAr: "مؤشر مستوى السائل",
        nameEs: "Indicador de Nivel de Líquido",
        stores: ["RNIB Shop", "MaxiAids", "LS&S Products", "Adaptations Store"],
        storeCount: 4,
        specs: {
          en: ["Audible alert", "Vibration alert", "Sensor type"],
          ar: ["تنبيه صوتي", "تنبيه بالاهتزاز", "نوع المستشعر"],
          es: ["Alerta audible", "Alerta de vibración", "Tipo de sensor"],
        },
      },
      {
        id: "talking-kitchen-scale",
        nameEn: "Talking Kitchen Scale",
        nameAr: "ميزان مطبخ ناطق",
        nameEs: "Balanza de Cocina Parlante",
        stores: ["RNIB Shop", "MaxiAids", "LS&S Products"],
        storeCount: 3,
        specs: {
          en: ["Voice reading", "Grams or ounces", "Memory function"],
          ar: ["قراءة صوتية", "غرامات أو أوقيات", "وظيفة الذاكرة"],
          es: ["Lectura por voz", "Gramos u onzas", "Función de memoria"],
        },
      },
    ],
  },
  {
    id: "digital-accessibility",
    nameEn: "Digital Accessibility",
    nameAr: "إمكانية الوصول الرقمي",
    nameEs: "Accesibilidad Digital",
    icon: "💻",
    products: [
      {
        id: "screen-reader-software",
        nameEn: "Screen Reader Software",
        nameAr: "برنامج قارئ الشاشة",
        nameEs: "Software de Lector de Pantalla",
        stores: ["HumanWare", "HIMS International", "Al Nattiq Technologies"],
        storeCount: 3,
        specs: {
          en: ["Language support", "Operating system support", "Braille device integration"],
          ar: ["دعم اللغات", "دعم نظام التشغيل", "تكامل أجهزة بريل"],
          es: ["Soporte de idiomas", "Soporte de sistema operativo", "Integración con dispositivos braille"],
        },
      },
      {
        id: "ocr-software",
        nameEn: "OCR Software",
        nameAr: "برنامج التعرف الضوئي",
        nameEs: "Software OCR",
        stores: ["HumanWare", "HIMS International", "RNIB Shop"],
        storeCount: 3,
        specs: {
          en: ["Text recognition accuracy", "PDF support", "Multilingual support"],
          ar: ["دقة التعرف على النص", "دعم PDF", "دعم متعدد اللغات"],
          es: ["Precisión de reconocimiento de texto", "Soporte PDF", "Soporte multilingüe"],
        },
      },
    ],
  },
];

export const deliveryCountries = [
  { code: "US", en: "United States", ar: "الولايات المتحدة", es: "Estados Unidos" },
  { code: "GB", en: "United Kingdom", ar: "المملكة المتحدة", es: "Reino Unido" },
  { code: "AE", en: "United Arab Emirates", ar: "الإمارات العربية المتحدة", es: "Emiratos Árabes Unidos" },
  { code: "SA", en: "Saudi Arabia", ar: "المملكة العربية السعودية", es: "Arabia Saudita" },
  { code: "LB", en: "Lebanon", ar: "لبنان", es: "Líbano" },
  { code: "EG", en: "Egypt", ar: "مصر", es: "Egipto" },
  { code: "JO", en: "Jordan", ar: "الأردن", es: "Jordania" },
  { code: "KW", en: "Kuwait", ar: "الكويت", es: "Kuwait" },
  { code: "QA", en: "Qatar", ar: "قطر", es: "Catar" },
  { code: "BH", en: "Bahrain", ar: "البحرين", es: "Baréin" },
  { code: "OM", en: "Oman", ar: "عمان", es: "Omán" },
  { code: "DE", en: "Germany", ar: "ألمانيا", es: "Alemania" },
  { code: "FR", en: "France", ar: "فرنسا", es: "Francia" },
  { code: "ES", en: "Spain", ar: "إسبانيا", es: "España" },
  { code: "CA", en: "Canada", ar: "كندا", es: "Canadá" },
  { code: "AU", en: "Australia", ar: "أستراليا", es: "Australia" },
  { code: "IN", en: "India", ar: "الهند", es: "India" },
  { code: "OTHER", en: "Other", ar: "أخرى", es: "Otro" },
];
