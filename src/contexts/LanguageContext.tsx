import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";

export type Lang = "en" | "ar" | "es";

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  dir: "ltr",
});

export const useLanguage = () => useContext(LanguageContext);

const translations: Record<Lang, Record<string, string>> = {
  en: {
    // Nav
    "nav.home": "Home",
    "nav.marketplace": "Marketplace",
    "nav.services": "Services",
    "nav.content": "Content",
    "nav.dashboard": "Dashboard",
    "nav.login": "Log in",
    "nav.signup": "Sign up",
    "nav.signout": "Sign out",
    "nav.openMenu": "Open menu",
    "nav.closeMenu": "Close menu",
    "nav.skipToContent": "Skip to main content",

    // Footer
    "footer.text": "© {year} Visionex. Built for everyone.",

    // Home
    "home.badge": "Accessible by design",
    "home.title": "A platform built for ",
    "home.titleHighlight": "everyone",
    "home.subtitle": "Visionex brings together marketplace, services, and content — all with high contrast, large fonts, and keyboard-first navigation.",
    "home.getStarted": "Get started",
    "home.exploreMarketplace": "Explore Marketplace",
    "home.featuresTitle": "Everything in one place",
    "home.feature.marketplace": "Marketplace",
    "home.feature.marketplaceDesc": "Discover products and services curated for accessibility.",
    "home.feature.services": "Services",
    "home.feature.servicesDesc": "Professional services designed to be inclusive from the start.",
    "home.feature.content": "Content",
    "home.feature.contentDesc": "Articles, guides, and resources for everyone.",
    "home.pointsTitle": "Earn points as you go",
    "home.pointsDesc": "Every activity earns you points — sign up to get 100 welcome points instantly. Track your balance in your dashboard.",
    "home.claimPoints": "Claim your 100 points",

    // Auth
    "auth.loginTitle": "Log in",
    "auth.loginSubtitle": "Welcome back to Visionex",
    "auth.signupTitle": "Sign up",
    "auth.signupSubtitle": "Create your Visionex account — earn 100 welcome points!",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.displayName": "Display name",
    "auth.signingIn": "Signing in…",
    "auth.loggingIn": "Log in",
    "auth.creatingAccount": "Creating account…",
    "auth.createAccount": "Create account",
    "auth.noAccount": "Don't have an account?",
    "auth.hasAccount": "Already have an account?",
    "auth.welcomeBack": "Welcome back!",
    "auth.accountCreated": "Account created! Check your email to confirm, or log in now.",

    // Dashboard
    "dash.title": "Dashboard",
    "dash.welcome": "Welcome back, {name}",
    "dash.totalPoints": "Total Points",
    "dash.activities": "Activities",
    "dash.rank": "Rank",
    "dash.rankGold": "Gold",
    "dash.rankSilver": "Silver",
    "dash.rankBronze": "Bronze",
    "dash.history": "Points History",
    "dash.noActivity": "No activity yet. Start exploring to earn points!",
    "dash.activity": "Activity",
    "dash.points": "Points",
    "dash.date": "Date",

    // Marketplace
    "market.title": "Marketplace",
    "market.subtitle": "Browse products or request something specific",
    "market.generalStore": "General Store",
    "market.accessibilityStore": "Accessibility Store",
    "market.findItForMe": "Find It For Me",
    "market.searchProducts": "Search products…",
    "market.searchLabel": "Search products",
    "market.productsFound": "{count} product{s} found",
    "market.noProducts": "No products found. Try a different search or category.",
    "market.addToCart": "Add to cart",
    "market.addMore": "Add more",
    "market.outOfStock": "Out of stock",
    "market.pts": "+{points} pts",
    "market.all": "All",

    // Find it for me
    "find.title": "Find It For Me",
    "find.subtitle": "Can't find what you need? Tell us and we'll source it for you.",
    "find.productName": "Product Name",
    "find.productNamePlaceholder": "e.g. Talking blood pressure monitor",
    "find.description": "Description & Details",
    "find.descriptionPlaceholder": "Describe the product you're looking for, including any specific features or requirements…",
    "find.submit": "Submit Request",
    "find.received": "Request Received!",
    "find.receivedDesc": "We'll search for your product and notify you when we find it. Thank you for using Find It For Me.",
    "find.submitAnother": "Submit another request",
    "find.fillBoth": "Please fill in both fields.",
    "find.submitted": "Request submitted! We'll get back to you soon.",

    // Product detail
    "product.notFound": "Product Not Found",
    "product.notFoundDesc": "The product you're looking for doesn't exist or has been removed.",
    "product.backToMarketplace": "Back to Marketplace",
    "product.reviews": "reviews",
    "product.earn": "Earn +{points} points",
    "product.inStock": "In Stock",
    "product.outOfStock": "Out of Stock",
    "product.addToCart": "Add to Cart",
    "product.addAnother": "Add Another to Cart",
    "product.freeShipping": "Free Shipping",
    "product.securePurchase": "Secure Purchase",
    "product.qualityGuaranteed": "Quality Guaranteed",
    "product.customerReviews": "Customer Reviews",
    "product.avg": "avg",
    "product.relatedProducts": "Related Products",

    // Cart
    "cart.title": "Your Cart",
    "cart.empty": "Your cart is empty",
    "cart.emptyDesc": "Add products from the marketplace to get started.",
    "cart.subtotal": "Subtotal",
    "cart.pointsEarned": "Points earned",
    "cart.checkout": "Checkout & Earn {points} Points",
    "cart.clear": "Clear Cart",
    "cart.loginRequired": "Please log in to checkout and earn points.",
    "cart.orderPlaced": "Order placed! You earned {points} points 🎉",
    "cart.checkoutFailed": "Checkout failed. Please try again.",
    "cart.itemsLabel": "Shopping cart with {count} items",
    "cart.added": "{name} added to cart",

    // Services
    "services.title": "Services",
    "services.subtitle": "We offer a range of professional services to support your digital needs.",
    "services.webDesign": "Website Design",
    "services.webDesignDesc": "Custom, accessible websites built with modern standards. Mobile-friendly, fast, and optimized for all users.",
    "services.digitalMarketing": "Digital Marketing",
    "services.digitalMarketingDesc": "Reach your audience with inclusive marketing strategies, SEO, social media management, and ad campaigns.",
    "services.importPurchasing": "Import & Purchasing Services",
    "services.importPurchasingDesc": "We source and import assistive technology products and daily essentials from trusted global suppliers.",
    "services.techConsulting": "Technical Consulting",
    "services.techConsultingDesc": "Expert guidance on assistive technology, screen readers, accessibility tools, and adaptive solutions for visually impaired users.",
    "services.training": "Training & Device Setup",
    "services.trainingDesc": "Personalized training sessions and hands-on help setting up devices, software, and assistive tools.",
    "services.cta": "Get Started",
    "services.earn": "Earn {points} pts",

    // Content
    "content.title": "Content Hub",
    "content.subtitle": "Courses, articles, podcasts, and accessible media — all in one place.",
    "content.tab.all": "All",
    "content.tab.courses": "Courses",
    "content.tab.articles": "Articles & Blog",
    "content.tab.podcasts": "Podcasts",
    "content.tab.media": "Accessible Media",
    "content.duration": "{min} min",
    "content.lessons": "{n} lessons",
    "content.episodes": "{n} episodes",
    "content.listen": "Listen Now",
    "content.read": "Read More",
    "content.enroll": "Enroll",
    "content.watch": "Watch",
    "content.free": "Free",
    // Courses
    "content.c1": "Introduction to Accessibility",
    "content.c1d": "A comprehensive course covering WCAG guidelines, assistive technologies, and inclusive design fundamentals.",
    "content.c2": "Screen Reader Mastery",
    "content.c2d": "Learn to navigate devices confidently using NVDA, JAWS, and VoiceOver screen readers.",
    "content.c3": "Braille Literacy Basics",
    "content.c3d": "Start reading and writing Braille with structured lessons for beginners.",
    "content.c4": "Adaptive Technology Workshop",
    "content.c4d": "Hands-on training with magnifiers, voice assistants, and smart accessibility tools.",
    // Articles
    "content.a1": "Getting Started with Accessibility",
    "content.a1d": "Essential tips for making your digital life more accessible from day one.",
    "content.a2": "Color Contrast Best Practices",
    "content.a2d": "How proper color contrast improves readability for everyone.",
    "content.a3": "Keyboard Navigation Patterns",
    "content.a3d": "Master keyboard shortcuts and tab navigation for efficient browsing.",
    "content.a4": "Inclusive Design Principles",
    "content.a4d": "Design thinking strategies that put accessibility at the center.",
    "content.a5": "ARIA Labels Done Right",
    "content.a5d": "A developer guide to meaningful ARIA attributes and screen reader support.",
    // Podcasts
    "content.p1": "Accessibility Today",
    "content.p1d": "Weekly conversations with accessibility advocates, tech leaders, and users.",
    "content.p2": "Inclusive Voices",
    "content.p2d": "Stories and experiences from visually impaired individuals around the world.",
    "content.p3": "Tech Without Barriers",
    "content.p3d": "Exploring how emerging technology is removing barriers for people with disabilities.",
    // Accessible Media
    "content.m1": "Audio Described Documentaries",
    "content.m1d": "Documentaries with full audio descriptions for an immersive experience.",
    "content.m2": "Sign Language Tutorials",
    "content.m2d": "Learn sign language with captioned, high-contrast video lessons.",
    "content.m3": "Accessible Coding Tutorials",
    "content.m3d": "Step-by-step coding lessons designed for screen reader users.",

    // 404
    "notFound.title": "404",
    "notFound.message": "Oops! Page not found",
    "notFound.link": "Return to Home",

    // Categories
    "cat.All": "All",
    "cat.Electronics": "Electronics",
    "cat.Home": "Home",
    "cat.Office": "Office",
    "cat.Personal Care": "Personal Care",
    "cat.Software": "Software",
    "cat.Hardware": "Hardware",
    "cat.Design": "Design",
    "cat.Media": "Media",
    "cat.Learning": "Learning",
    "cat.Consulting": "Consulting",
    "cat.Guide": "Guide",
    "cat.Tutorial": "Tutorial",
    "cat.Reference": "Reference",
    "cat.Article": "Article",
    "cat.Course": "Course",
    "cat.Podcast": "Podcast",
    "cat.Media": "Media",
    "cat.Beginner": "Beginner",
    "cat.Intermediate": "Intermediate",
    "cat.Advanced": "Advanced",

    // Wishlist
    "wishlist.title": "Wishlist",
    "wishlist.subtitle": "Products you've saved for later",
    "wishlist.empty": "Your wishlist is empty",
    "wishlist.emptyDesc": "Browse the marketplace and tap the heart icon to save products.",
    "wishlist.added": "{name} added to wishlist",
    "wishlist.removed": "{name} removed from wishlist",
    "wishlist.loginRequired": "Please log in to save products.",
    "wishlist.browseMarketplace": "Browse Marketplace",
    "nav.wishlist": "Wishlist",

    // Redemption
    "redeem.title": "Redeem Points",
    "redeem.available": "You have {points} points",
    "redeem.apply": "Apply",
    "redeem.remove": "Remove",
    "redeem.applied": "Discount applied! Saving ${amount}",
    "redeem.removed": "Discount removed",
    "redeem.notEnough": "You need at least {points} points",
    "redeem.discount": "Points discount",
    "redeem.loginToRedeem": "Log in to redeem points",
    "redeem.tier1": "50 pts → $5 off",
    "redeem.tier2": "100 pts → $12 off",
    "redeem.tier3": "200 pts → $25 off",
    "redeem.tier4": "500 pts → $75 off",
    "cart.total": "Total",
  },
  ar: {
    // Nav
    "nav.home": "الرئيسية",
    "nav.marketplace": "المتجر",
    "nav.services": "الخدمات",
    "nav.content": "المحتوى",
    "nav.dashboard": "لوحة التحكم",
    "nav.login": "تسجيل الدخول",
    "nav.signup": "إنشاء حساب",
    "nav.signout": "تسجيل الخروج",
    "nav.openMenu": "فتح القائمة",
    "nav.closeMenu": "إغلاق القائمة",
    "nav.skipToContent": "الانتقال إلى المحتوى الرئيسي",

    // Footer
    "footer.text": "© {year} Visionex. مصمم للجميع.",

    // Home
    "home.badge": "مصمم ليكون سهل الوصول",
    "home.title": "منصة مصممة ",
    "home.titleHighlight": "للجميع",
    "home.subtitle": "Visionex يجمع بين المتجر والخدمات والمحتوى — بتباين عالٍ وخطوط كبيرة وتنقل بلوحة المفاتيح.",
    "home.getStarted": "ابدأ الآن",
    "home.exploreMarketplace": "تصفح المتجر",
    "home.featuresTitle": "كل شيء في مكان واحد",
    "home.feature.marketplace": "المتجر",
    "home.feature.marketplaceDesc": "اكتشف منتجات وخدمات مصممة لسهولة الوصول.",
    "home.feature.services": "الخدمات",
    "home.feature.servicesDesc": "خدمات احترافية مصممة لتكون شاملة من البداية.",
    "home.feature.content": "المحتوى",
    "home.feature.contentDesc": "مقالات وأدلة وموارد للجميع.",
    "home.pointsTitle": "اكسب نقاطاً أثناء تصفحك",
    "home.pointsDesc": "كل نشاط يكسبك نقاطاً — سجل للحصول على 100 نقطة ترحيبية فوراً. تتبع رصيدك في لوحة التحكم.",
    "home.claimPoints": "احصل على 100 نقطة",

    // Auth
    "auth.loginTitle": "تسجيل الدخول",
    "auth.loginSubtitle": "مرحباً بعودتك إلى Visionex",
    "auth.signupTitle": "إنشاء حساب",
    "auth.signupSubtitle": "أنشئ حسابك في Visionex — واكسب 100 نقطة ترحيبية!",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.displayName": "الاسم المعروض",
    "auth.signingIn": "جارٍ تسجيل الدخول…",
    "auth.loggingIn": "تسجيل الدخول",
    "auth.creatingAccount": "جارٍ إنشاء الحساب…",
    "auth.createAccount": "إنشاء حساب",
    "auth.noAccount": "ليس لديك حساب؟",
    "auth.hasAccount": "لديك حساب بالفعل؟",
    "auth.welcomeBack": "مرحباً بعودتك!",
    "auth.accountCreated": "تم إنشاء الحساب! تحقق من بريدك الإلكتروني للتأكيد، أو سجل الدخول الآن.",

    // Dashboard
    "dash.title": "لوحة التحكم",
    "dash.welcome": "مرحباً بعودتك، {name}",
    "dash.totalPoints": "إجمالي النقاط",
    "dash.activities": "الأنشطة",
    "dash.rank": "الرتبة",
    "dash.rankGold": "ذهبي",
    "dash.rankSilver": "فضي",
    "dash.rankBronze": "برونزي",
    "dash.history": "سجل النقاط",
    "dash.noActivity": "لا يوجد نشاط بعد. ابدأ بالتصفح لكسب النقاط!",
    "dash.activity": "النشاط",
    "dash.points": "النقاط",
    "dash.date": "التاريخ",

    // Marketplace
    "market.title": "المتجر",
    "market.subtitle": "تصفح المنتجات أو اطلب شيئاً محدداً",
    "market.generalStore": "المتجر العام",
    "market.accessibilityStore": "متجر إمكانية الوصول",
    "market.findItForMe": "ابحث لي",
    "market.searchProducts": "ابحث عن المنتجات…",
    "market.searchLabel": "البحث في المنتجات",
    "market.productsFound": "تم العثور على {count} منتج",
    "market.noProducts": "لم يتم العثور على منتجات. جرب بحثاً أو فئة مختلفة.",
    "market.addToCart": "أضف للسلة",
    "market.addMore": "أضف المزيد",
    "market.outOfStock": "نفذ المخزون",
    "market.pts": "+{points} نقطة",
    "market.all": "الكل",

    // Find it for me
    "find.title": "ابحث لي",
    "find.subtitle": "لا تجد ما تحتاجه؟ أخبرنا وسنبحث لك.",
    "find.productName": "اسم المنتج",
    "find.productNamePlaceholder": "مثال: جهاز قياس ضغط الدم الناطق",
    "find.description": "الوصف والتفاصيل",
    "find.descriptionPlaceholder": "صف المنتج الذي تبحث عنه، بما في ذلك أي ميزات أو متطلبات محددة…",
    "find.submit": "إرسال الطلب",
    "find.received": "تم استلام الطلب!",
    "find.receivedDesc": "سنبحث عن منتجك ونبلغك عندما نجده. شكراً لاستخدامك خدمة ابحث لي.",
    "find.submitAnother": "إرسال طلب آخر",
    "find.fillBoth": "يرجى ملء كلا الحقلين.",
    "find.submitted": "تم إرسال الطلب! سنتواصل معك قريباً.",

    // Product detail
    "product.notFound": "المنتج غير موجود",
    "product.notFoundDesc": "المنتج الذي تبحث عنه غير موجود أو تمت إزالته.",
    "product.backToMarketplace": "العودة إلى المتجر",
    "product.reviews": "تقييمات",
    "product.earn": "اكسب +{points} نقطة",
    "product.inStock": "متوفر",
    "product.outOfStock": "نفذ المخزون",
    "product.addToCart": "أضف للسلة",
    "product.addAnother": "أضف آخر للسلة",
    "product.freeShipping": "شحن مجاني",
    "product.securePurchase": "شراء آمن",
    "product.qualityGuaranteed": "جودة مضمونة",
    "product.customerReviews": "تقييمات العملاء",
    "product.avg": "متوسط",
    "product.relatedProducts": "منتجات ذات صلة",

    // Cart
    "cart.title": "سلة التسوق",
    "cart.empty": "سلة التسوق فارغة",
    "cart.emptyDesc": "أضف منتجات من المتجر للبدء.",
    "cart.subtotal": "المجموع الفرعي",
    "cart.pointsEarned": "النقاط المكتسبة",
    "cart.checkout": "الدفع واكسب {points} نقطة",
    "cart.clear": "إفراغ السلة",
    "cart.loginRequired": "يرجى تسجيل الدخول للدفع وكسب النقاط.",
    "cart.orderPlaced": "تم الطلب! لقد كسبت {points} نقطة 🎉",
    "cart.checkoutFailed": "فشل الدفع. يرجى المحاولة مرة أخرى.",
    "cart.itemsLabel": "سلة التسوق تحتوي على {count} عناصر",
    "cart.added": "تمت إضافة {name} للسلة",

    // Services
    "services.title": "الخدمات",
    "services.subtitle": "نقدم مجموعة من الخدمات الاحترافية لدعم احتياجاتك الرقمية.",
    "services.webDesign": "تصميم المواقع",
    "services.webDesignDesc": "مواقع مخصصة وسهلة الوصول مبنية بمعايير حديثة. متوافقة مع الجوال وسريعة ومحسّنة لجميع المستخدمين.",
    "services.digitalMarketing": "التسويق الرقمي",
    "services.digitalMarketingDesc": "اوصل لجمهورك باستراتيجيات تسويق شاملة، تحسين محركات البحث، إدارة وسائل التواصل، والحملات الإعلانية.",
    "services.importPurchasing": "خدمات الاستيراد والشراء",
    "services.importPurchasingDesc": "نوفر ونستورد منتجات التكنولوجيا المساعدة والمستلزمات اليومية من موردين عالميين موثوقين.",
    "services.techConsulting": "الاستشارات التقنية",
    "services.techConsultingDesc": "إرشاد متخصص حول التكنولوجيا المساعدة وقارئات الشاشة وأدوات إمكانية الوصول والحلول التكيفية للمكفوفين.",
    "services.training": "التدريب وإعداد الأجهزة",
    "services.trainingDesc": "جلسات تدريب شخصية ومساعدة عملية في إعداد الأجهزة والبرامج والأدوات المساعدة.",
    "services.cta": "ابدأ الآن",
    "services.earn": "اكسب {points} نقطة",

    // Content
    "content.title": "المحتوى",
    "content.subtitle": "تعلم عن إمكانية الوصول — اكسب نقاطاً للقراءة وإكمال المحتوى.",
    "content.a1": "البدء في إمكانية الوصول",
    "content.a2": "أفضل ممارسات تباين الألوان",
    "content.a3": "أنماط التنقل بلوحة المفاتيح",
    "content.a4": "التوافق مع قارئ الشاشة",
    "content.a5": "مبادئ التصميم الشامل",
    "content.a6": "تسميات ARIA بشكل صحيح",

    // 404
    "notFound.title": "404",
    "notFound.message": "عذراً! الصفحة غير موجودة",
    "notFound.link": "العودة للرئيسية",

    // Categories
    "cat.All": "الكل",
    "cat.Electronics": "الإلكترونيات",
    "cat.Home": "المنزل",
    "cat.Office": "المكتب",
    "cat.Personal Care": "العناية الشخصية",
    "cat.Software": "البرمجيات",
    "cat.Hardware": "الأجهزة",
    "cat.Design": "التصميم",
    "cat.Media": "الوسائط",
    "cat.Learning": "التعلم",
    "cat.Consulting": "الاستشارات",
    "cat.Guide": "دليل",
    "cat.Tutorial": "درس",
    "cat.Reference": "مرجع",
    "cat.Article": "مقال",

    // Wishlist
    "wishlist.title": "قائمة الأمنيات",
    "wishlist.subtitle": "المنتجات التي حفظتها لوقت لاحق",
    "wishlist.empty": "قائمة أمنياتك فارغة",
    "wishlist.emptyDesc": "تصفح المتجر واضغط على أيقونة القلب لحفظ المنتجات.",
    "wishlist.added": "تمت إضافة {name} إلى قائمة الأمنيات",
    "wishlist.removed": "تمت إزالة {name} من قائمة الأمنيات",
    "wishlist.loginRequired": "يرجى تسجيل الدخول لحفظ المنتجات.",
    "wishlist.browseMarketplace": "تصفح المتجر",
    "nav.wishlist": "قائمة الأمنيات",

    // Redemption
    "redeem.title": "استبدال النقاط",
    "redeem.available": "لديك {points} نقطة",
    "redeem.apply": "تطبيق",
    "redeem.remove": "إزالة",
    "redeem.applied": "تم تطبيق الخصم! توفير ${amount}",
    "redeem.removed": "تمت إزالة الخصم",
    "redeem.notEnough": "تحتاج إلى {points} نقطة على الأقل",
    "redeem.discount": "خصم النقاط",
    "redeem.loginToRedeem": "سجل الدخول لاستبدال النقاط",
    "redeem.tier1": "50 نقطة → خصم $5",
    "redeem.tier2": "100 نقطة → خصم $12",
    "redeem.tier3": "200 نقطة → خصم $25",
    "redeem.tier4": "500 نقطة → خصم $75",
    "cart.total": "الإجمالي",
  },
  es: {
    // Nav
    "nav.home": "Inicio",
    "nav.marketplace": "Tienda",
    "nav.services": "Servicios",
    "nav.content": "Contenido",
    "nav.dashboard": "Panel",
    "nav.login": "Iniciar sesión",
    "nav.signup": "Registrarse",
    "nav.signout": "Cerrar sesión",
    "nav.openMenu": "Abrir menú",
    "nav.closeMenu": "Cerrar menú",
    "nav.skipToContent": "Saltar al contenido principal",

    // Footer
    "footer.text": "© {year} Visionex. Construido para todos.",

    // Home
    "home.badge": "Accesible por diseño",
    "home.title": "Una plataforma para ",
    "home.titleHighlight": "todos",
    "home.subtitle": "Visionex reúne tienda, servicios y contenido — todo con alto contraste, fuentes grandes y navegación por teclado.",
    "home.getStarted": "Comenzar",
    "home.exploreMarketplace": "Explorar Tienda",
    "home.featuresTitle": "Todo en un solo lugar",
    "home.feature.marketplace": "Tienda",
    "home.feature.marketplaceDesc": "Descubre productos y servicios para la accesibilidad.",
    "home.feature.services": "Servicios",
    "home.feature.servicesDesc": "Servicios profesionales diseñados para ser inclusivos.",
    "home.feature.content": "Contenido",
    "home.feature.contentDesc": "Artículos, guías y recursos para todos.",
    "home.pointsTitle": "Gana puntos mientras navegas",
    "home.pointsDesc": "Cada actividad te da puntos — regístrate para obtener 100 puntos de bienvenida al instante. Revisa tu saldo en el panel.",
    "home.claimPoints": "Reclama tus 100 puntos",

    // Auth
    "auth.loginTitle": "Iniciar sesión",
    "auth.loginSubtitle": "Bienvenido de vuelta a Visionex",
    "auth.signupTitle": "Registrarse",
    "auth.signupSubtitle": "Crea tu cuenta en Visionex — ¡gana 100 puntos de bienvenida!",
    "auth.email": "Correo electrónico",
    "auth.password": "Contraseña",
    "auth.displayName": "Nombre visible",
    "auth.signingIn": "Iniciando sesión…",
    "auth.loggingIn": "Iniciar sesión",
    "auth.creatingAccount": "Creando cuenta…",
    "auth.createAccount": "Crear cuenta",
    "auth.noAccount": "¿No tienes cuenta?",
    "auth.hasAccount": "¿Ya tienes cuenta?",
    "auth.welcomeBack": "¡Bienvenido de vuelta!",
    "auth.accountCreated": "¡Cuenta creada! Revisa tu correo para confirmar, o inicia sesión ahora.",

    // Dashboard
    "dash.title": "Panel",
    "dash.welcome": "Bienvenido de vuelta, {name}",
    "dash.totalPoints": "Puntos Totales",
    "dash.activities": "Actividades",
    "dash.rank": "Rango",
    "dash.rankGold": "Oro",
    "dash.rankSilver": "Plata",
    "dash.rankBronze": "Bronce",
    "dash.history": "Historial de Puntos",
    "dash.noActivity": "Sin actividad aún. ¡Empieza a explorar para ganar puntos!",
    "dash.activity": "Actividad",
    "dash.points": "Puntos",
    "dash.date": "Fecha",

    // Marketplace
    "market.title": "Tienda",
    "market.subtitle": "Explora productos o solicita algo específico",
    "market.generalStore": "Tienda General",
    "market.accessibilityStore": "Tienda de Accesibilidad",
    "market.findItForMe": "Búscalo por mí",
    "market.searchProducts": "Buscar productos…",
    "market.searchLabel": "Buscar productos",
    "market.productsFound": "{count} producto{s} encontrado{s}",
    "market.noProducts": "No se encontraron productos. Intenta otra búsqueda o categoría.",
    "market.addToCart": "Agregar al carrito",
    "market.addMore": "Agregar más",
    "market.outOfStock": "Agotado",
    "market.pts": "+{points} pts",
    "market.all": "Todos",

    // Find it for me
    "find.title": "Búscalo por mí",
    "find.subtitle": "¿No encuentras lo que necesitas? Cuéntanos y lo buscaremos.",
    "find.productName": "Nombre del producto",
    "find.productNamePlaceholder": "Ej. Monitor de presión arterial parlante",
    "find.description": "Descripción y detalles",
    "find.descriptionPlaceholder": "Describe el producto que buscas, incluyendo características o requisitos específicos…",
    "find.submit": "Enviar solicitud",
    "find.received": "¡Solicitud recibida!",
    "find.receivedDesc": "Buscaremos tu producto y te notificaremos cuando lo encontremos. Gracias por usar Búscalo por mí.",
    "find.submitAnother": "Enviar otra solicitud",
    "find.fillBoth": "Por favor completa ambos campos.",
    "find.submitted": "¡Solicitud enviada! Te contactaremos pronto.",

    // Product detail
    "product.notFound": "Producto no encontrado",
    "product.notFoundDesc": "El producto que buscas no existe o fue eliminado.",
    "product.backToMarketplace": "Volver a la Tienda",
    "product.reviews": "reseñas",
    "product.earn": "Gana +{points} puntos",
    "product.inStock": "En Stock",
    "product.outOfStock": "Agotado",
    "product.addToCart": "Agregar al carrito",
    "product.addAnother": "Agregar otro al carrito",
    "product.freeShipping": "Envío gratis",
    "product.securePurchase": "Compra segura",
    "product.qualityGuaranteed": "Calidad garantizada",
    "product.customerReviews": "Reseñas de clientes",
    "product.avg": "promedio",
    "product.relatedProducts": "Productos relacionados",

    // Cart
    "cart.title": "Tu carrito",
    "cart.empty": "Tu carrito está vacío",
    "cart.emptyDesc": "Agrega productos de la tienda para comenzar.",
    "cart.subtotal": "Subtotal",
    "cart.pointsEarned": "Puntos ganados",
    "cart.checkout": "Pagar y ganar {points} puntos",
    "cart.clear": "Vaciar carrito",
    "cart.loginRequired": "Inicia sesión para pagar y ganar puntos.",
    "cart.orderPlaced": "¡Pedido realizado! Ganaste {points} puntos 🎉",
    "cart.checkoutFailed": "Error en el pago. Intenta de nuevo.",
    "cart.itemsLabel": "Carrito de compras con {count} artículos",
    "cart.added": "{name} agregado al carrito",

    // Services
    "services.title": "Servicios",
    "services.subtitle": "Ofrecemos servicios profesionales para apoyar tus necesidades digitales.",
    "services.webDesign": "Diseño Web",
    "services.webDesignDesc": "Sitios web personalizados y accesibles con estándares modernos. Compatibles con móviles, rápidos y optimizados.",
    "services.digitalMarketing": "Marketing Digital",
    "services.digitalMarketingDesc": "Llega a tu audiencia con estrategias inclusivas, SEO, redes sociales y campañas publicitarias.",
    "services.importPurchasing": "Servicios de Importación y Compras",
    "services.importPurchasingDesc": "Buscamos e importamos productos de tecnología asistiva y artículos esenciales de proveedores globales confiables.",
    "services.techConsulting": "Consultoría Técnica",
    "services.techConsultingDesc": "Orientación experta en tecnología asistiva, lectores de pantalla, herramientas de accesibilidad y soluciones adaptativas.",
    "services.training": "Capacitación y Configuración",
    "services.trainingDesc": "Sesiones de capacitación personalizadas y ayuda práctica para configurar dispositivos, software y herramientas asistivas.",
    "services.cta": "Comenzar",
    "services.earn": "Gana {points} pts",

    // Content
    "content.title": "Contenido",
    "content.subtitle": "Aprende sobre accesibilidad — gana puntos por leer y completar contenido.",
    "content.a1": "Primeros pasos en Accesibilidad",
    "content.a2": "Mejores prácticas de contraste de color",
    "content.a3": "Patrones de navegación por teclado",
    "content.a4": "Compatibilidad con lectores de pantalla",
    "content.a5": "Principios de diseño inclusivo",
    "content.a6": "Etiquetas ARIA correctamente",

    // 404
    "notFound.title": "404",
    "notFound.message": "¡Ups! Página no encontrada",
    "notFound.link": "Volver al inicio",

    // Categories
    "cat.All": "Todos",
    "cat.Electronics": "Electrónica",
    "cat.Home": "Hogar",
    "cat.Office": "Oficina",
    "cat.Personal Care": "Cuidado Personal",
    "cat.Software": "Software",
    "cat.Hardware": "Hardware",
    "cat.Design": "Diseño",
    "cat.Media": "Medios",
    "cat.Learning": "Aprendizaje",
    "cat.Consulting": "Consultoría",
    "cat.Guide": "Guía",
    "cat.Tutorial": "Tutorial",
    "cat.Reference": "Referencia",
    "cat.Article": "Artículo",

    // Wishlist
    "wishlist.title": "Lista de deseos",
    "wishlist.subtitle": "Productos que guardaste para después",
    "wishlist.empty": "Tu lista de deseos está vacía",
    "wishlist.emptyDesc": "Explora la tienda y toca el ícono de corazón para guardar productos.",
    "wishlist.added": "{name} agregado a la lista de deseos",
    "wishlist.removed": "{name} eliminado de la lista de deseos",
    "wishlist.loginRequired": "Inicia sesión para guardar productos.",
    "wishlist.browseMarketplace": "Explorar Tienda",
    "nav.wishlist": "Lista de deseos",

    // Redemption
    "redeem.title": "Canjear puntos",
    "redeem.available": "Tienes {points} puntos",
    "redeem.apply": "Aplicar",
    "redeem.remove": "Quitar",
    "redeem.applied": "¡Descuento aplicado! Ahorrando ${amount}",
    "redeem.removed": "Descuento eliminado",
    "redeem.notEnough": "Necesitas al menos {points} puntos",
    "redeem.discount": "Descuento por puntos",
    "redeem.loginToRedeem": "Inicia sesión para canjear puntos",
    "redeem.tier1": "50 pts → $5 de descuento",
    "redeem.tier2": "100 pts → $12 de descuento",
    "redeem.tier3": "200 pts → $25 de descuento",
    "redeem.tier4": "500 pts → $75 de descuento",
    "cart.total": "Total",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("visionex-lang") as Lang | null;
    return saved && ["en", "ar", "es"].includes(saved) ? saved : "en";
  });

  const dir = lang === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    localStorage.setItem("visionex-lang", lang);
  }, [lang, dir]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[lang]?.[key] || translations.en[key] || key;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}
