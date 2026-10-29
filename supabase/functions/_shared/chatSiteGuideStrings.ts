// What each part of Visionex is, and what a plan opens — in twenty languages.
//
// Free fixed text for the replies to people who are not subscribed yet (see
// chatFreeReplies.ts). Every claim here mirrors `src/lib/billing/plans.ts`,
// which is the source of truth for tiers and sections, and a test pins the
// prices and the section lists against it so this text cannot drift silently.
// Product names (Academy, Library, Arcade, VisionKids, Bazaar, Career Hub,
// Visionex TV, Visionex Radio, AI Media Studio, Library Studio, Professional
// tools, VX Finance Hub) are kept as they appear on the site.
//
// Placeholders: {basic} {pro} {business} {kids} are monthly prices in US dollars,
// filled from SITE_PRICES.
//
// Pure data. No Deno, no fetch, no database.

import type { SupportedLanguage } from "./whatsappLanguages.ts";

export type GuideKey =
  | "sections"
  | "benefits"
  | "tiers"
  | "academy"
  | "library"
  | "arcade"
  | "kids"
  | "marketplace"
  | "free"
  | "pro"
  | "business";

export type GuidePack = Record<GuideKey, string>;

export const GUIDE_STRINGS: Record<SupportedLanguage, GuidePack> = {
  en: {
    sections: "On Visionex you'll find: the AI assistant, Academy, Library, Arcade games, VisionKids, Bazaar (marketplace), Career Hub, Visionex TV and Radio, voice rooms and messages, simulations, AI Media Studio, Library Studio, Professional tools and the VX Finance Hub — plus news, community and assistive products, which are open without a plan. Ask me about any of them.",
    benefits: "A subscription gives you the assistant on the site and on WhatsApp, courses in the Academy, books in the Library, accessible games, a marketplace and, in higher plans, TV, radio, voice rooms, career tools and creative studios — all built for screen readers and the keyboard. Each plan includes monthly VX credits for the extra services.",
    tiers: "Basic ${basic}/month: assistant, Academy, Library, Arcade, Bazaar. Pro ${pro}/month: everything in Basic plus VisionKids, Career Hub, TV, Radio, voice rooms and simulations. Business ${business}/month: everything in Pro plus AI Media Studio, Library Studio, Professional tools and the VX Finance Hub. Kids ${kids}/month: VisionKids, Academy, Library and Arcade for children.",
    academy: "The Academy has accessible courses and lessons you can follow with a screen reader or the keyboard. It's included from the Basic plan, and in Kids.",
    library: "The Library is a collection of books, audiobooks and open reading resources you can search, read or listen to. It's included from the Basic plan, and in Kids.",
    arcade: "The Arcade is a set of games designed to be played by ear and by keyboard as well as by sight, with scores and rewards. It's included from the Basic plan, and in Kids.",
    kids: "VisionKids is a safe children's world with learning games and activities. It comes with the Kids plan, and with Pro and Business.",
    marketplace: "The Bazaar is Visionex's marketplace, where you can browse and buy products, including assistive ones. It's included from the Basic plan.",
    free: "These parts are open without a plan: the news, the community, and the assistive-products catalogue. Creating an account is free.",
    pro: "Pro adds: VisionKids, the Career Hub for jobs and skills, Visionex TV, Visionex Radio, voice rooms and messages, and simulations such as the business simulator.",
    business: "Business adds the creative and professional tools: AI Media Studio for generated media, Library Studio for publishing, Professional tools including the file studio, and the VX Finance Hub. It also has the largest monthly VX allowance.",
  },
  ar: {
    sections: "في Visionex تجد: المساعد الذكي، والأكاديمية، والمكتبة، وألعاب Arcade، وVisionKids، والسوق (Bazaar)، ومركز الوظائف Career Hub، وتلفزيون وراديو Visionex، وغرف الصوت والرسائل، والمحاكاة، وAI Media Studio، وLibrary Studio، والأدوات المهنية، وVX Finance Hub — إضافة إلى الأخبار والمجتمع ومنتجات المساعدة، وهي مفتوحة بلا باقة. اسألني عن أي منها.",
    benefits: "الاشتراك يمنحك المساعد على الموقع وعلى واتساب، ودورات الأكاديمية، وكتب المكتبة، وألعاباً متاحة للجميع، وسوقاً، وفي الباقات الأعلى التلفزيون والراديو وغرف الصوت وأدوات الوظائف واستوديوهات الإبداع — كلها مبنية لقارئات الشاشة ولوحة المفاتيح. وفي كل باقة رصيد VX شهري للخدمات الإضافية.",
    tiers: "Basic بـ{basic}$ شهرياً: المساعد والأكاديمية والمكتبة وArcade والسوق. Pro بـ{pro}$: كل ما في Basic مع VisionKids وCareer Hub والتلفزيون والراديو وغرف الصوت والمحاكاة. Business بـ{business}$: كل ما في Pro مع AI Media Studio وLibrary Studio والأدوات المهنية وVX Finance Hub. Kids بـ{kids}$: VisionKids والأكاديمية والمكتبة وArcade للأطفال.",
    academy: "الأكاديمية فيها دورات ودروس متاحة تتابعها بقارئ الشاشة أو لوحة المفاتيح. تشملها باقة Basic فما فوق، وباقة Kids.",
    library: "المكتبة مجموعة كتب وكتب صوتية ومصادر قراءة مفتوحة تبحث فيها وتقرأ أو تستمع. تشملها باقة Basic فما فوق، وباقة Kids.",
    arcade: "Arcade ألعاب مصممة لتُلعب بالسمع ولوحة المفاتيح كما بالنظر، مع نقاط ومكافآت. تشملها باقة Basic فما فوق، وباقة Kids.",
    kids: "VisionKids عالم آمن للأطفال فيه ألعاب وأنشطة تعليمية. يأتي مع باقة Kids ومع Pro وBusiness.",
    marketplace: "Bazaar هو سوق Visionex تتصفح فيه المنتجات وتشتريها، ومنها منتجات المساعدة. تشمله باقة Basic فما فوق.",
    free: "هذه الأجزاء مفتوحة بلا باقة: الأخبار، والمجتمع، وكتالوج منتجات المساعدة. وإنشاء الحساب مجاني.",
    pro: "تضيف Pro: VisionKids، ومركز الوظائف Career Hub للوظائف والمهارات، وتلفزيون Visionex، وراديو Visionex، وغرف الصوت والرسائل، والمحاكاة مثل محاكي الأعمال.",
    business: "تضيف Business أدوات الإبداع والمهنة: AI Media Studio لتوليد الوسائط، وLibrary Studio للنشر، والأدوات المهنية ومنها استوديو الملفات، وVX Finance Hub. ولها أكبر رصيد VX شهري.",
  },
  ur: {
    sections: "Visionex میں یہ سب ہے: اے آئی اسسٹنٹ، Academy، Library، Arcade گیمز، VisionKids، Bazaar (بازار)، Career Hub، Visionex TV اور Radio، وائس رومز اور پیغامات، سمولیشنز، AI Media Studio، Library Studio، Professional tools اور VX Finance Hub — اور خبریں، کمیونٹی اور معاون مصنوعات بغیر پلان کے کھلی ہیں۔ کسی بھی کے بارے میں پوچھیں۔",
    benefits: "سبسکرپشن سے آپ کو ویب سائٹ اور واٹس ایپ پر اسسٹنٹ، Academy کے کورسز، Library کی کتابیں، قابلِ رسائی گیمز، بازار، اور اوپر کے پلانز میں ٹی وی، ریڈیو، وائس رومز، کیریئر ٹولز اور تخلیقی اسٹوڈیوز ملتے ہیں — سب سکرین ریڈر اور کی بورڈ کے لیے بنے ہیں۔ ہر پلان میں اضافی خدمات کے لیے ماہانہ VX کریڈٹ ہے۔",
    tiers: "Basic ${basic}/ماہ: اسسٹنٹ، Academy، Library، Arcade، Bazaar۔ Pro ${pro}/ماہ: Basic کے ساتھ VisionKids، Career Hub، ٹی وی، ریڈیو، وائس رومز اور سمولیشنز۔ Business ${business}/ماہ: Pro کے ساتھ AI Media Studio، Library Studio، Professional tools اور VX Finance Hub۔ Kids ${kids}/ماہ: بچوں کے لیے VisionKids، Academy، Library اور Arcade۔",
    academy: "Academy میں قابلِ رسائی کورسز اور اسباق ہیں جو آپ سکرین ریڈر یا کی بورڈ سے کر سکتے ہیں۔ Basic پلان سے اور Kids میں شامل ہے۔",
    library: "Library میں کتابیں، آڈیو بکس اور کھلے مطالعے کے ذرائع ہیں جنہیں آپ تلاش کر کے پڑھ یا سن سکتے ہیں۔ Basic پلان سے اور Kids میں شامل ہے۔",
    arcade: "Arcade میں ایسے گیمز ہیں جو آواز اور کی بورڈ سے بھی کھیلے جا سکتے ہیں، اسکور اور انعامات کے ساتھ۔ Basic پلان سے اور Kids میں شامل ہے۔",
    kids: "VisionKids بچوں کی محفوظ دنیا ہے جس میں سیکھنے کے گیمز اور سرگرمیاں ہیں۔ Kids پلان کے ساتھ، اور Pro و Business میں بھی ہے۔",
    marketplace: "Bazaar Visionex کا بازار ہے جہاں مصنوعات، بشمول معاون مصنوعات، دیکھ کر خرید سکتے ہیں۔ Basic پلان سے شامل ہے۔",
    free: "یہ حصے بغیر پلان کے کھلے ہیں: خبریں، کمیونٹی، اور معاون مصنوعات کا کیٹلاگ۔ اکاؤنٹ بنانا مفت ہے۔",
    pro: "Pro میں اضافہ: VisionKids، ملازمتوں اور مہارتوں کے لیے Career Hub، Visionex TV، Visionex Radio، وائس رومز اور پیغامات، اور بزنس سمیولیٹر جیسی سمولیشنز۔",
    business: "Business تخلیقی اور پیشہ ورانہ ٹولز لاتا ہے: میڈیا بنانے کے لیے AI Media Studio، اشاعت کے لیے Library Studio، فائل اسٹوڈیو سمیت Professional tools، اور VX Finance Hub۔ اس میں ماہانہ VX سب سے زیادہ ہے۔",
  },
  hi: {
    sections: "Visionex में ये सब है: एआई असिस्टेंट, Academy, Library, Arcade गेम, VisionKids, Bazaar (बाज़ार), Career Hub, Visionex TV और Radio, वॉइस रूम और संदेश, सिमुलेशन, AI Media Studio, Library Studio, Professional tools और VX Finance Hub — साथ ही समाचार, समुदाय और सहायक उत्पाद, जो बिना प्लान के खुले हैं। किसी के भी बारे में पूछें।",
    benefits: "सब्सक्रिप्शन से आपको वेबसाइट और वॉट्सऐप पर असिस्टेंट, Academy के कोर्स, Library की किताबें, सुलभ गेम, बाज़ार और ऊँचे प्लान में टीवी, रेडियो, वॉइस रूम, करियर टूल और रचनात्मक स्टूडियो मिलते हैं — सब स्क्रीन रीडर और कीबोर्ड के लिए। हर प्लान में अतिरिक्त सेवाओं के लिए मासिक VX क्रेडिट है।",
    tiers: "Basic ${basic}/माह: असिस्टेंट, Academy, Library, Arcade, Bazaar। Pro ${pro}/माह: Basic के साथ VisionKids, Career Hub, टीवी, रेडियो, वॉइस रूम और सिमुलेशन। Business ${business}/माह: Pro के साथ AI Media Studio, Library Studio, Professional tools और VX Finance Hub। Kids ${kids}/माह: बच्चों के लिए VisionKids, Academy, Library और Arcade।",
    academy: "Academy में सुलभ कोर्स और पाठ हैं जिन्हें आप स्क्रीन रीडर या कीबोर्ड से कर सकते हैं। Basic प्लान से और Kids में शामिल है।",
    library: "Library में किताबें, ऑडियोबुक और खुले पठन संसाधन हैं जिन्हें खोजकर पढ़ या सुन सकते हैं। Basic प्लान से और Kids में शामिल है।",
    arcade: "Arcade में ऐसे गेम हैं जो आँख के साथ-साथ सुनकर और कीबोर्ड से भी खेले जा सकते हैं, स्कोर और इनाम के साथ। Basic प्लान से और Kids में शामिल है।",
    kids: "VisionKids बच्चों की सुरक्षित दुनिया है जिसमें सीखने वाले गेम और गतिविधियाँ हैं। Kids प्लान के साथ, और Pro व Business में भी।",
    marketplace: "Bazaar Visionex का बाज़ार है जहाँ उत्पाद, सहायक उत्पाद सहित, देखकर खरीद सकते हैं। Basic प्लान से शामिल है।",
    free: "ये हिस्से बिना प्लान के खुले हैं: समाचार, समुदाय और सहायक उत्पादों की सूची। खाता बनाना मुफ़्त है।",
    pro: "Pro में जुड़ता है: VisionKids, नौकरी और कौशल के लिए Career Hub, Visionex TV, Visionex Radio, वॉइस रूम और संदेश, और बिज़नेस सिम्युलेटर जैसे सिमुलेशन।",
    business: "Business रचनात्मक और पेशेवर टूल जोड़ता है: मीडिया बनाने के लिए AI Media Studio, प्रकाशन के लिए Library Studio, फ़ाइल स्टूडियो सहित Professional tools और VX Finance Hub। इसमें मासिक VX सबसे ज़्यादा है।",
  },
  id: {
    sections: "Di Visionex ada: asisten AI, Academy, Library, game Arcade, VisionKids, Bazaar (pasar), Career Hub, Visionex TV dan Radio, ruang suara dan pesan, simulasi, AI Media Studio, Library Studio, Professional tools, dan VX Finance Hub — plus berita, komunitas, dan produk bantu yang terbuka tanpa paket. Tanyakan yang mana saja.",
    benefits: "Langganan memberi Anda asisten di situs dan WhatsApp, kursus Academy, buku Library, game aksesibel, pasar, dan di paket lebih tinggi TV, radio, ruang suara, alat karier, dan studio kreatif — semuanya dibuat untuk pembaca layar dan keyboard. Setiap paket punya kredit VX bulanan untuk layanan tambahan.",
    tiers: "Basic ${basic}/bulan: asisten, Academy, Library, Arcade, Bazaar. Pro ${pro}/bulan: semua Basic plus VisionKids, Career Hub, TV, Radio, ruang suara, dan simulasi. Business ${business}/bulan: semua Pro plus AI Media Studio, Library Studio, Professional tools, dan VX Finance Hub. Kids ${kids}/bulan: VisionKids, Academy, Library, dan Arcade untuk anak.",
    academy: "Academy berisi kursus dan pelajaran aksesibel yang bisa diikuti dengan pembaca layar atau keyboard. Termasuk mulai paket Basic, dan di Kids.",
    library: "Library adalah koleksi buku, buku audio, dan sumber bacaan terbuka yang bisa dicari, dibaca, atau didengar. Termasuk mulai paket Basic, dan di Kids.",
    arcade: "Arcade berisi game yang bisa dimainkan lewat pendengaran dan keyboard selain penglihatan, dengan skor dan hadiah. Termasuk mulai paket Basic, dan di Kids.",
    kids: "VisionKids adalah dunia anak yang aman dengan game dan aktivitas belajar. Ada di paket Kids, serta Pro dan Business.",
    marketplace: "Bazaar adalah pasar Visionex untuk menjelajah dan membeli produk, termasuk produk bantu. Termasuk mulai paket Basic.",
    free: "Bagian ini terbuka tanpa paket: berita, komunitas, dan katalog produk bantu. Membuat akun gratis.",
    pro: "Pro menambah: VisionKids, Career Hub untuk pekerjaan dan keterampilan, Visionex TV, Visionex Radio, ruang suara dan pesan, serta simulasi seperti simulator bisnis.",
    business: "Business menambah alat kreatif dan profesional: AI Media Studio untuk media buatan, Library Studio untuk penerbitan, Professional tools termasuk studio file, dan VX Finance Hub. Kredit VX bulanannya paling besar.",
  },
  ja: {
    sections: "Visionex には、AI アシスタント、Academy、Library、Arcade ゲーム、VisionKids、Bazaar（マーケット）、Career Hub、Visionex TV と Radio、ボイスルームとメッセージ、シミュレーション、AI Media Studio、Library Studio、Professional tools、VX Finance Hub があります。ニュース、コミュニティ、支援製品はプランなしで利用できます。どれでもお尋ねください。",
    benefits: "購読すると、サイトと WhatsApp のアシスタント、Academy の講座、Library の本、アクセシブルなゲーム、マーケット、上位プランでは TV、ラジオ、ボイスルーム、キャリアツール、クリエイティブスタジオが使えます。すべてスクリーンリーダーとキーボード向けです。各プランには追加サービス用の月間 VX が付きます。",
    tiers: "Basic 月${basic}ドル：アシスタント、Academy、Library、Arcade、Bazaar。Pro 月${pro}ドル：Basic に加え VisionKids、Career Hub、TV、Radio、ボイスルーム、シミュレーション。Business 月${business}ドル：Pro に加え AI Media Studio、Library Studio、Professional tools、VX Finance Hub。Kids 月${kids}ドル：子ども向け VisionKids、Academy、Library、Arcade。",
    academy: "Academy にはスクリーンリーダーやキーボードで受けられるアクセシブルな講座とレッスンがあります。Basic プラン以上と Kids に含まれます。",
    library: "Library は本、オーディオブック、オープンな読み物を検索して読んだり聴いたりできます。Basic プラン以上と Kids に含まれます。",
    arcade: "Arcade は視覚だけでなく、音とキーボードでも遊べるゲームで、スコアと報酬があります。Basic プラン以上と Kids に含まれます。",
    kids: "VisionKids は学べるゲームと活動のある、安全な子ども向けの世界です。Kids プラン、Pro、Business に含まれます。",
    marketplace: "Bazaar は Visionex のマーケットで、支援製品を含む商品を見て購入できます。Basic プラン以上に含まれます。",
    free: "プランなしで使えるのは、ニュース、コミュニティ、支援製品カタログです。アカウント作成は無料です。",
    pro: "Pro で加わるもの：VisionKids、仕事とスキルの Career Hub、Visionex TV、Visionex Radio、ボイスルームとメッセージ、ビジネスシミュレーターなどのシミュレーション。",
    business: "Business ではクリエイティブ・業務用ツールが加わります：メディア生成の AI Media Studio、出版の Library Studio、ファイルスタジオを含む Professional tools、VX Finance Hub。月間 VX も最大です。",
  },
  it: {
    sections: "Su Visionex trovi: l'assistente AI, Academy, Library, giochi Arcade, VisionKids, Bazaar (marketplace), Career Hub, Visionex TV e Radio, stanze vocali e messaggi, simulazioni, AI Media Studio, Library Studio, Professional tools e VX Finance Hub — più notizie, comunità e prodotti assistivi, aperti senza piano. Chiedimi di uno qualsiasi.",
    benefits: "L'abbonamento ti dà l'assistente sul sito e su WhatsApp, i corsi dell'Academy, i libri della Library, giochi accessibili, un marketplace e, nei piani superiori, TV, radio, stanze vocali, strumenti di carriera e studi creativi — tutto pensato per screen reader e tastiera. Ogni piano include crediti VX mensili per i servizi extra.",
    tiers: "Basic ${basic}/mese: assistente, Academy, Library, Arcade, Bazaar. Pro ${pro}/mese: tutto Basic più VisionKids, Career Hub, TV, Radio, stanze vocali e simulazioni. Business ${business}/mese: tutto Pro più AI Media Studio, Library Studio, Professional tools e VX Finance Hub. Kids ${kids}/mese: VisionKids, Academy, Library e Arcade per bambini.",
    academy: "L'Academy offre corsi e lezioni accessibili da seguire con screen reader o tastiera. Inclusa dal piano Basic, e in Kids.",
    library: "La Library è una raccolta di libri, audiolibri e risorse di lettura aperte da cercare, leggere o ascoltare. Inclusa dal piano Basic, e in Kids.",
    arcade: "L'Arcade raccoglie giochi pensati per essere giocati a orecchio e con la tastiera oltre che con la vista, con punteggi e premi. Inclusa dal piano Basic, e in Kids.",
    kids: "VisionKids è un mondo sicuro per bambini con giochi e attività per imparare. Arriva con il piano Kids, e con Pro e Business.",
    marketplace: "Il Bazaar è il marketplace di Visionex, dove sfogliare e comprare prodotti, anche assistivi. Incluso dal piano Basic.",
    free: "Queste parti sono aperte senza piano: le notizie, la comunità e il catalogo dei prodotti assistivi. Creare un account è gratis.",
    pro: "Pro aggiunge: VisionKids, il Career Hub per lavoro e competenze, Visionex TV, Visionex Radio, stanze vocali e messaggi, e simulazioni come il simulatore d'impresa.",
    business: "Business aggiunge strumenti creativi e professionali: AI Media Studio per i media generati, Library Studio per pubblicare, Professional tools con il file studio e il VX Finance Hub. Ha anche il maggior credito VX mensile.",
  },
  ko: {
    sections: "Visionex에는 AI 어시스턴트, Academy, Library, Arcade 게임, VisionKids, Bazaar(마켓), Career Hub, Visionex TV와 Radio, 음성방과 메시지, 시뮬레이션, AI Media Studio, Library Studio, Professional tools, VX Finance Hub가 있습니다. 뉴스, 커뮤니티, 보조 제품은 요금제 없이 열려 있어요. 궁금한 것을 물어보세요.",
    benefits: "구독하면 사이트와 WhatsApp의 어시스턴트, Academy 강의, Library 도서, 접근 가능한 게임, 마켓, 상위 요금제에서는 TV, 라디오, 음성방, 커리어 도구, 창작 스튜디오를 쓸 수 있습니다. 모두 화면 낭독기와 키보드에 맞춰 만들었어요. 요금제마다 추가 서비스용 월간 VX가 포함됩니다.",
    tiers: "Basic 월 ${basic}달러: 어시스턴트, Academy, Library, Arcade, Bazaar. Pro 월 ${pro}달러: Basic에 VisionKids, Career Hub, TV, Radio, 음성방, 시뮬레이션 추가. Business 월 ${business}달러: Pro에 AI Media Studio, Library Studio, Professional tools, VX Finance Hub 추가. Kids 월 ${kids}달러: 어린이용 VisionKids, Academy, Library, Arcade.",
    academy: "Academy에는 화면 낭독기나 키보드로 들을 수 있는 접근 가능한 강의와 수업이 있습니다. Basic 요금제부터, 그리고 Kids에 포함됩니다.",
    library: "Library는 책, 오디오북, 공개 읽기 자료를 검색해 읽거나 들을 수 있는 모음입니다. Basic 요금제부터, 그리고 Kids에 포함됩니다.",
    arcade: "Arcade는 눈뿐 아니라 소리와 키보드로도 즐길 수 있게 만든 게임 모음이며 점수와 보상이 있습니다. Basic 요금제부터, 그리고 Kids에 포함됩니다.",
    kids: "VisionKids는 배우는 게임과 활동이 있는 안전한 어린이 세계입니다. Kids 요금제, 그리고 Pro와 Business에 포함됩니다.",
    marketplace: "Bazaar는 보조 제품을 포함한 상품을 둘러보고 살 수 있는 Visionex 마켓입니다. Basic 요금제부터 포함됩니다.",
    free: "요금제 없이 열려 있는 곳: 뉴스, 커뮤니티, 보조 제품 카탈로그. 계정 만들기는 무료입니다.",
    pro: "Pro에서 추가되는 것: VisionKids, 일자리와 기술을 위한 Career Hub, Visionex TV, Visionex Radio, 음성방과 메시지, 비즈니스 시뮬레이터 같은 시뮬레이션.",
    business: "Business는 창작·전문 도구를 더합니다: 미디어 생성 AI Media Studio, 출판용 Library Studio, 파일 스튜디오를 포함한 Professional tools, VX Finance Hub. 월간 VX도 가장 많습니다.",
  },
  nl: {
    sections: "Op Visionex vind je: de AI-assistent, Academy, Library, Arcade-games, VisionKids, Bazaar (marktplaats), Career Hub, Visionex TV en Radio, spraakkamers en berichten, simulaties, AI Media Studio, Library Studio, Professional tools en de VX Finance Hub — plus nieuws, community en hulpmiddelen, die zonder abonnement open zijn. Vraag me gerust naar een onderdeel.",
    benefits: "Met een abonnement krijg je de assistent op de site en op WhatsApp, cursussen in de Academy, boeken in de Library, toegankelijke games, een marktplaats en in hogere abonnementen tv, radio, spraakkamers, loopbaantools en creatieve studio's — alles gebouwd voor schermlezers en toetsenbord. Elk abonnement bevat maandelijkse VX-tegoeden voor extra diensten.",
    tiers: "Basic ${basic}/maand: assistent, Academy, Library, Arcade, Bazaar. Pro ${pro}/maand: alles van Basic plus VisionKids, Career Hub, tv, radio, spraakkamers en simulaties. Business ${business}/maand: alles van Pro plus AI Media Studio, Library Studio, Professional tools en de VX Finance Hub. Kids ${kids}/maand: VisionKids, Academy, Library en Arcade voor kinderen.",
    academy: "De Academy heeft toegankelijke cursussen en lessen die je met een schermlezer of toetsenbord volgt. Inbegrepen vanaf Basic, en in Kids.",
    library: "De Library is een collectie boeken, luisterboeken en open leesbronnen om te zoeken, te lezen of te beluisteren. Inbegrepen vanaf Basic, en in Kids.",
    arcade: "De Arcade bevat games die je met gehoor en toetsenbord kunt spelen, niet alleen met zicht, met scores en beloningen. Inbegrepen vanaf Basic, en in Kids.",
    kids: "VisionKids is een veilige kinderwereld met leerspellen en activiteiten. Zit in het Kids-abonnement, en in Pro en Business.",
    marketplace: "De Bazaar is de marktplaats van Visionex waar je producten bekijkt en koopt, ook hulpmiddelen. Inbegrepen vanaf Basic.",
    free: "Deze onderdelen zijn zonder abonnement open: het nieuws, de community en de catalogus van hulpmiddelen. Een account maken is gratis.",
    pro: "Pro voegt toe: VisionKids, de Career Hub voor banen en vaardigheden, Visionex TV, Visionex Radio, spraakkamers en berichten, en simulaties zoals de bedrijfssimulator.",
    business: "Business voegt creatieve en professionele tools toe: AI Media Studio voor gegenereerde media, Library Studio voor publiceren, Professional tools met de bestandsstudio en de VX Finance Hub. Het heeft ook het grootste maandelijkse VX-tegoed.",
  },
  pl: {
    sections: "W Visionex znajdziesz: asystenta AI, Academy, Library, gry Arcade, VisionKids, Bazaar (rynek), Career Hub, Visionex TV i Radio, pokoje głosowe i wiadomości, symulacje, AI Media Studio, Library Studio, Professional tools i VX Finance Hub — a także wiadomości, społeczność i produkty wspomagające, dostępne bez planu. Zapytaj o dowolny z nich.",
    benefits: "Subskrypcja daje asystenta na stronie i w WhatsApp, kursy w Academy, książki w Library, dostępne gry, rynek, a w wyższych planach TV, radio, pokoje głosowe, narzędzia kariery i studia twórcze — wszystko z myślą o czytnikach ekranu i klawiaturze. Każdy plan zawiera miesięczne kredyty VX na usługi dodatkowe.",
    tiers: "Basic ${basic}/mies.: asystent, Academy, Library, Arcade, Bazaar. Pro ${pro}/mies.: wszystko z Basic plus VisionKids, Career Hub, TV, Radio, pokoje głosowe i symulacje. Business ${business}/mies.: wszystko z Pro plus AI Media Studio, Library Studio, Professional tools i VX Finance Hub. Kids ${kids}/mies.: VisionKids, Academy, Library i Arcade dla dzieci.",
    academy: "Academy oferuje dostępne kursy i lekcje, które można przechodzić z czytnikiem ekranu lub klawiaturą. W planie Basic i wyższych oraz w Kids.",
    library: "Library to zbiór książek, audiobooków i otwartych materiałów do wyszukiwania, czytania i słuchania. W planie Basic i wyższych oraz w Kids.",
    arcade: "Arcade to gry, w które gra się także słuchem i klawiaturą, nie tylko wzrokiem, z wynikami i nagrodami. W planie Basic i wyższych oraz w Kids.",
    kids: "VisionKids to bezpieczny świat dla dzieci z grami i zajęciami edukacyjnymi. W planie Kids oraz w Pro i Business.",
    marketplace: "Bazaar to rynek Visionex, gdzie przeglądasz i kupujesz produkty, także wspomagające. W planie Basic i wyższych.",
    free: "Te części są otwarte bez planu: wiadomości, społeczność i katalog produktów wspomagających. Założenie konta jest bezpłatne.",
    pro: "Pro dodaje: VisionKids, Career Hub z pracą i umiejętnościami, Visionex TV, Visionex Radio, pokoje głosowe i wiadomości oraz symulacje, np. symulator biznesu.",
    business: "Business dodaje narzędzia twórcze i zawodowe: AI Media Studio do generowania mediów, Library Studio do publikowania, Professional tools z studiem plików oraz VX Finance Hub. Ma też największy miesięczny limit VX.",
  },
  vi: {
    sections: "Trên Visionex có: trợ lý AI, Academy, Library, game Arcade, VisionKids, Bazaar (chợ), Career Hub, Visionex TV và Radio, phòng thoại và tin nhắn, mô phỏng, AI Media Studio, Library Studio, Professional tools và VX Finance Hub — cùng tin tức, cộng đồng và sản phẩm hỗ trợ, mở không cần gói. Hãy hỏi tôi về bất kỳ mục nào.",
    benefits: "Đăng ký giúp bạn có trợ lý trên website và WhatsApp, khóa học ở Academy, sách ở Library, game dễ tiếp cận, chợ và ở gói cao hơn là TV, radio, phòng thoại, công cụ nghề nghiệp và studio sáng tạo — tất cả dành cho trình đọc màn hình và bàn phím. Mỗi gói có VX hằng tháng cho các dịch vụ thêm.",
    tiers: "Basic ${basic}/tháng: trợ lý, Academy, Library, Arcade, Bazaar. Pro ${pro}/tháng: mọi thứ của Basic cùng VisionKids, Career Hub, TV, Radio, phòng thoại và mô phỏng. Business ${business}/tháng: mọi thứ của Pro cùng AI Media Studio, Library Studio, Professional tools và VX Finance Hub. Kids ${kids}/tháng: VisionKids, Academy, Library và Arcade cho trẻ em.",
    academy: "Academy có các khóa học và bài học dễ tiếp cận để theo dõi bằng trình đọc màn hình hoặc bàn phím. Có từ gói Basic và trong Kids.",
    library: "Library là bộ sưu tập sách, sách nói và tài liệu đọc mở để tìm, đọc hoặc nghe. Có từ gói Basic và trong Kids.",
    arcade: "Arcade gồm các game chơi được bằng tai và bàn phím chứ không chỉ bằng mắt, có điểm và phần thưởng. Có từ gói Basic và trong Kids.",
    kids: "VisionKids là thế giới an toàn cho trẻ em với game và hoạt động học tập. Có trong gói Kids, Pro và Business.",
    marketplace: "Bazaar là chợ của Visionex để xem và mua sản phẩm, gồm cả sản phẩm hỗ trợ. Có từ gói Basic.",
    free: "Các phần này mở không cần gói: tin tức, cộng đồng và danh mục sản phẩm hỗ trợ. Tạo tài khoản là miễn phí.",
    pro: "Pro thêm: VisionKids, Career Hub cho việc làm và kỹ năng, Visionex TV, Visionex Radio, phòng thoại và tin nhắn, cùng các mô phỏng như mô phỏng kinh doanh.",
    business: "Business thêm công cụ sáng tạo và chuyên nghiệp: AI Media Studio để tạo phương tiện, Library Studio để xuất bản, Professional tools gồm file studio và VX Finance Hub. Gói này cũng có VX hằng tháng nhiều nhất.",
  },
  bn: {
    sections: "Visionex-এ আছে: এআই সহকারী, Academy, Library, Arcade গেম, VisionKids, Bazaar (বাজার), Career Hub, Visionex TV ও Radio, ভয়েস রুম ও বার্তা, সিমুলেশন, AI Media Studio, Library Studio, Professional tools এবং VX Finance Hub — সঙ্গে সংবাদ, কমিউনিটি ও সহায়ক পণ্য, যা প্ল্যান ছাড়াই খোলা। যেকোনোটি সম্পর্কে জিজ্ঞেস করুন।",
    benefits: "সাবস্ক্রিপশনে পাবেন ওয়েবসাইট ও হোয়াটসঅ্যাপে সহকারী, Academy-র কোর্স, Library-র বই, সহজগম্য গেম, বাজার এবং উঁচু প্ল্যানে টিভি, রেডিও, ভয়েস রুম, ক্যারিয়ার টুল ও সৃজনশীল স্টুডিও — সবই স্ক্রিন রিডার ও কিবোর্ডের জন্য। প্রতিটি প্ল্যানে বাড়তি সেবার জন্য মাসিক VX ক্রেডিট আছে।",
    tiers: "Basic মাসে ${basic} ডলার: সহকারী, Academy, Library, Arcade, Bazaar। Pro মাসে ${pro} ডলার: Basic-এর সব সঙ্গে VisionKids, Career Hub, টিভি, রেডিও, ভয়েস রুম ও সিমুলেশন। Business মাসে ${business} ডলার: Pro-র সব সঙ্গে AI Media Studio, Library Studio, Professional tools ও VX Finance Hub। Kids মাসে ${kids} ডলার: শিশুদের জন্য VisionKids, Academy, Library ও Arcade।",
    academy: "Academy-তে সহজগম্য কোর্স ও পাঠ আছে, স্ক্রিন রিডার বা কিবোর্ডে অনুসরণ করা যায়। Basic প্ল্যান থেকে এবং Kids-এ অন্তর্ভুক্ত।",
    library: "Library-তে বই, অডিওবুক ও উন্মুক্ত পাঠ-উৎস আছে, খুঁজে পড়া বা শোনা যায়। Basic প্ল্যান থেকে এবং Kids-এ অন্তর্ভুক্ত।",
    arcade: "Arcade-এ এমন গেম আছে যা চোখের পাশাপাশি শুনে ও কিবোর্ডে খেলা যায়, স্কোর ও পুরস্কারসহ। Basic প্ল্যান থেকে এবং Kids-এ অন্তর্ভুক্ত।",
    kids: "VisionKids শিশুদের নিরাপদ জগৎ, শেখার গেম ও কার্যক্রমসহ। Kids প্ল্যানে এবং Pro ও Business-এ আছে।",
    marketplace: "Bazaar হলো Visionex-এর বাজার, যেখানে সহায়ক পণ্যসহ জিনিস দেখে কেনা যায়। Basic প্ল্যান থেকে অন্তর্ভুক্ত।",
    free: "এই অংশগুলো প্ল্যান ছাড়াই খোলা: সংবাদ, কমিউনিটি ও সহায়ক পণ্যের তালিকা। অ্যাকাউন্ট খোলা বিনামূল্যে।",
    pro: "Pro-তে যোগ হয়: VisionKids, চাকরি ও দক্ষতার Career Hub, Visionex TV, Visionex Radio, ভয়েস রুম ও বার্তা এবং বিজনেস সিমুলেটরের মতো সিমুলেশন।",
    business: "Business যোগ করে সৃজনশীল ও পেশাদার টুল: মিডিয়া তৈরির AI Media Studio, প্রকাশনার Library Studio, ফাইল স্টুডিওসহ Professional tools এবং VX Finance Hub। এতে মাসিক VX সবচেয়ে বেশি।",
  },
  fa: {
    sections: "در Visionex این‌ها هست: دستیار هوش مصنوعی، Academy، Library، بازی‌های Arcade، VisionKids، Bazaar (بازارچه)، Career Hub، Visionex TV و Radio، اتاق‌های صوتی و پیام‌ها، شبیه‌سازی‌ها، AI Media Studio، Library Studio، Professional tools و VX Finance Hub — به‌علاوه اخبار، جامعه و محصولات کمکی که بدون طرح باز هستند. از هرکدام بپرسید.",
    benefits: "اشتراک به شما دستیار در سایت و واتس‌اپ، دوره‌های Academy، کتاب‌های Library، بازی‌های دسترس‌پذیر، بازارچه و در طرح‌های بالاتر تلویزیون، رادیو، اتاق صوتی، ابزار شغلی و استودیوهای خلاقانه می‌دهد — همه برای صفحه‌خوان و صفحه‌کلید. هر طرح اعتبار ماهانه VX برای خدمات اضافی دارد.",
    tiers: "Basic ماهی ${basic} دلار: دستیار، Academy، Library، Arcade، Bazaar. Pro ماهی ${pro} دلار: همه‌ی Basic به‌علاوه VisionKids، Career Hub، تلویزیون، رادیو، اتاق صوتی و شبیه‌سازی. Business ماهی ${business} دلار: همه‌ی Pro به‌علاوه AI Media Studio، Library Studio، Professional tools و VX Finance Hub. Kids ماهی ${kids} دلار: VisionKids، Academy، Library و Arcade برای کودکان.",
    academy: "Academy دوره‌ها و درس‌های دسترس‌پذیر دارد که با صفحه‌خوان یا صفحه‌کلید دنبال می‌شود. از طرح Basic به بالا و در Kids گنجانده شده.",
    library: "Library مجموعه‌ای از کتاب، کتاب صوتی و منابع خواندنی باز است که می‌توانید جست‌وجو کنید، بخوانید یا بشنوید. از طرح Basic به بالا و در Kids گنجانده شده.",
    arcade: "Arcade بازی‌هایی است که علاوه بر دیدن با شنیدن و صفحه‌کلید هم بازی می‌شود، با امتیاز و جایزه. از طرح Basic به بالا و در Kids گنجانده شده.",
    kids: "VisionKids دنیای امن کودکان با بازی‌ها و فعالیت‌های آموزشی است. همراه طرح Kids و در Pro و Business هست.",
    marketplace: "Bazaar بازارچه Visionex است که در آن محصولات، از جمله محصولات کمکی، را می‌بینید و می‌خرید. از طرح Basic به بالا گنجانده شده.",
    free: "این بخش‌ها بدون طرح باز هستند: اخبار، جامعه و فهرست محصولات کمکی. ساخت حساب رایگان است.",
    pro: "Pro اضافه می‌کند: VisionKids، Career Hub برای شغل و مهارت، Visionex TV، Visionex Radio، اتاق‌های صوتی و پیام‌ها و شبیه‌سازی‌هایی مثل شبیه‌ساز کسب‌وکار.",
    business: "Business ابزارهای خلاق و حرفه‌ای اضافه می‌کند: AI Media Studio برای ساخت رسانه، Library Studio برای انتشار، Professional tools از جمله استودیوی فایل، و VX Finance Hub. بیشترین اعتبار ماهانه VX هم دارد.",
  },
  es: {
    sections: "En Visionex encontrarás: el asistente de IA, Academy, Library, juegos Arcade, VisionKids, Bazaar (mercado), Career Hub, Visionex TV y Radio, salas de voz y mensajes, simulaciones, AI Media Studio, Library Studio, Professional tools y VX Finance Hub — además de noticias, comunidad y productos de apoyo, abiertos sin plan. Pregúntame por cualquiera.",
    benefits: "La suscripción te da el asistente en la web y en WhatsApp, cursos en la Academy, libros en la Library, juegos accesibles, un mercado y, en los planes superiores, TV, radio, salas de voz, herramientas de carrera y estudios creativos — todo pensado para lectores de pantalla y teclado. Cada plan incluye créditos VX mensuales para servicios extra.",
    tiers: "Basic ${basic}/mes: asistente, Academy, Library, Arcade, Bazaar. Pro ${pro}/mes: todo Basic más VisionKids, Career Hub, TV, Radio, salas de voz y simulaciones. Business ${business}/mes: todo Pro más AI Media Studio, Library Studio, Professional tools y VX Finance Hub. Kids ${kids}/mes: VisionKids, Academy, Library y Arcade para niños.",
    academy: "La Academy tiene cursos y lecciones accesibles que puedes seguir con lector de pantalla o teclado. Incluida desde el plan Basic, y en Kids.",
    library: "La Library es una colección de libros, audiolibros y recursos de lectura abiertos para buscar, leer o escuchar. Incluida desde el plan Basic, y en Kids.",
    arcade: "El Arcade reúne juegos que se pueden jugar de oído y con teclado, no solo con la vista, con puntuaciones y recompensas. Incluido desde el plan Basic, y en Kids.",
    kids: "VisionKids es un mundo seguro para niños con juegos y actividades para aprender. Viene con el plan Kids, y con Pro y Business.",
    marketplace: "El Bazaar es el mercado de Visionex, donde puedes ver y comprar productos, también de apoyo. Incluido desde el plan Basic.",
    free: "Estas partes están abiertas sin plan: las noticias, la comunidad y el catálogo de productos de apoyo. Crear una cuenta es gratis.",
    pro: "Pro añade: VisionKids, el Career Hub para empleo y habilidades, Visionex TV, Visionex Radio, salas de voz y mensajes, y simulaciones como el simulador de negocios.",
    business: "Business añade herramientas creativas y profesionales: AI Media Studio para contenido generado, Library Studio para publicar, Professional tools con el estudio de archivos y el VX Finance Hub. También tiene el mayor crédito VX mensual.",
  },
  de: {
    sections: "Bei Visionex findest du: den KI-Assistenten, Academy, Library, Arcade-Spiele, VisionKids, Bazaar (Marktplatz), Career Hub, Visionex TV und Radio, Sprachräume und Nachrichten, Simulationen, AI Media Studio, Library Studio, Professional tools und den VX Finance Hub — dazu Nachrichten, Community und Hilfsmittel, die ohne Tarif offen sind. Frag mich zu jedem Bereich.",
    benefits: "Ein Abo gibt dir den Assistenten auf der Website und in WhatsApp, Kurse in der Academy, Bücher in der Library, barrierefreie Spiele, einen Marktplatz und in höheren Tarifen TV, Radio, Sprachräume, Karrierewerkzeuge und kreative Studios — alles für Screenreader und Tastatur gebaut. Jeder Tarif enthält monatliche VX-Guthaben für Zusatzdienste.",
    tiers: "Basic ${basic}/Monat: Assistent, Academy, Library, Arcade, Bazaar. Pro ${pro}/Monat: alles aus Basic plus VisionKids, Career Hub, TV, Radio, Sprachräume und Simulationen. Business ${business}/Monat: alles aus Pro plus AI Media Studio, Library Studio, Professional tools und VX Finance Hub. Kids ${kids}/Monat: VisionKids, Academy, Library und Arcade für Kinder.",
    academy: "Die Academy bietet barrierefreie Kurse und Lektionen, die du mit Screenreader oder Tastatur durcharbeiten kannst. Enthalten ab dem Tarif Basic und in Kids.",
    library: "Die Library ist eine Sammlung von Büchern, Hörbüchern und offenen Leseressourcen zum Suchen, Lesen oder Hören. Enthalten ab dem Tarif Basic und in Kids.",
    arcade: "Das Arcade sind Spiele, die man auch nach Gehör und mit der Tastatur spielen kann, mit Punkten und Belohnungen. Enthalten ab dem Tarif Basic und in Kids.",
    kids: "VisionKids ist eine sichere Kinderwelt mit Lernspielen und Aktivitäten. Im Kids-Tarif sowie in Pro und Business enthalten.",
    marketplace: "Der Bazaar ist der Marktplatz von Visionex, auf dem du Produkte, auch Hilfsmittel, ansehen und kaufen kannst. Enthalten ab dem Tarif Basic.",
    free: "Diese Bereiche sind ohne Tarif offen: die Nachrichten, die Community und der Katalog der Hilfsmittel. Ein Konto zu erstellen ist kostenlos.",
    pro: "Pro ergänzt: VisionKids, den Career Hub für Jobs und Fähigkeiten, Visionex TV, Visionex Radio, Sprachräume und Nachrichten sowie Simulationen wie den Business-Simulator.",
    business: "Business ergänzt kreative und professionelle Werkzeuge: AI Media Studio für erzeugte Medien, Library Studio zum Veröffentlichen, Professional tools mit dem Datei-Studio und den VX Finance Hub. Es hat auch das größte monatliche VX-Guthaben.",
  },
  pt: {
    sections: "No Visionex encontras: o assistente de IA, Academy, Library, jogos Arcade, VisionKids, Bazaar (mercado), Career Hub, Visionex TV e Rádio, salas de voz e mensagens, simulações, AI Media Studio, Library Studio, Professional tools e o VX Finance Hub — além de notícias, comunidade e produtos de apoio, abertos sem plano. Pergunta-me por qualquer um.",
    benefits: "A subscrição dá-te o assistente no site e no WhatsApp, cursos na Academy, livros na Library, jogos acessíveis, um mercado e, nos planos superiores, TV, rádio, salas de voz, ferramentas de carreira e estúdios criativos — tudo feito para leitores de ecrã e teclado. Cada plano inclui créditos VX mensais para serviços extra.",
    tiers: "Basic ${basic}/mês: assistente, Academy, Library, Arcade, Bazaar. Pro ${pro}/mês: tudo do Basic mais VisionKids, Career Hub, TV, Rádio, salas de voz e simulações. Business ${business}/mês: tudo do Pro mais AI Media Studio, Library Studio, Professional tools e VX Finance Hub. Kids ${kids}/mês: VisionKids, Academy, Library e Arcade para crianças.",
    academy: "A Academy tem cursos e lições acessíveis que podes seguir com leitor de ecrã ou teclado. Incluída a partir do plano Basic, e no Kids.",
    library: "A Library é uma coleção de livros, audiolivros e recursos de leitura abertos para pesquisar, ler ou ouvir. Incluída a partir do plano Basic, e no Kids.",
    arcade: "O Arcade reúne jogos que se jogam de ouvido e com teclado, não só com a vista, com pontuações e recompensas. Incluído a partir do plano Basic, e no Kids.",
    kids: "O VisionKids é um mundo seguro para crianças com jogos e atividades para aprender. Vem com o plano Kids, e com Pro e Business.",
    marketplace: "O Bazaar é o mercado do Visionex, onde podes ver e comprar produtos, incluindo de apoio. Incluído a partir do plano Basic.",
    free: "Estas partes estão abertas sem plano: as notícias, a comunidade e o catálogo de produtos de apoio. Criar conta é grátis.",
    pro: "O Pro acrescenta: VisionKids, o Career Hub para emprego e competências, Visionex TV, Visionex Rádio, salas de voz e mensagens, e simulações como o simulador de negócios.",
    business: "O Business acrescenta ferramentas criativas e profissionais: AI Media Studio para media gerados, Library Studio para publicar, Professional tools com o estúdio de ficheiros e o VX Finance Hub. Tem também o maior crédito VX mensal.",
  },
  zh: {
    sections: "Visionex 有：AI 助手、Academy、Library、Arcade 游戏、VisionKids、Bazaar（市集）、Career Hub、Visionex TV 和 Radio、语音房与消息、模拟、AI Media Studio、Library Studio、Professional tools 和 VX Finance Hub——另外新闻、社区和辅助产品无需套餐即可使用。想了解哪个都可以问我。",
    benefits: "订阅后你可以在网站和 WhatsApp 使用助手、在 Academy 上课、在 Library 读书、玩无障碍游戏、逛市集，更高套餐还有电视、广播、语音房、职业工具和创作工作室——全部为读屏软件和键盘而做。每个套餐都含每月 VX 额度，用于附加服务。",
    tiers: "Basic 每月 ${basic} 美元：助手、Academy、Library、Arcade、Bazaar。Pro 每月 ${pro} 美元：包含 Basic，另有 VisionKids、Career Hub、电视、广播、语音房和模拟。Business 每月 ${business} 美元：包含 Pro，另有 AI Media Studio、Library Studio、Professional tools 和 VX Finance Hub。Kids 每月 ${kids} 美元：面向儿童的 VisionKids、Academy、Library 和 Arcade。",
    academy: "Academy 提供可用读屏软件或键盘学习的无障碍课程和课时。Basic 及以上套餐包含，Kids 也包含。",
    library: "Library 收录书籍、有声书和开放阅读资源，可搜索、阅读或收听。Basic 及以上套餐包含，Kids 也包含。",
    arcade: "Arcade 的游戏除了用眼睛，也能靠听觉和键盘来玩，有分数和奖励。Basic 及以上套餐包含，Kids 也包含。",
    kids: "VisionKids 是安全的儿童天地，有学习游戏和活动。Kids 套餐包含，Pro 和 Business 也包含。",
    marketplace: "Bazaar 是 Visionex 的市集，可浏览并购买商品，包括辅助产品。Basic 及以上套餐包含。",
    free: "这些无需套餐即可使用：新闻、社区和辅助产品目录。注册账户是免费的。",
    pro: "Pro 增加：VisionKids、求职与技能的 Career Hub、Visionex TV、Visionex Radio、语音房与消息，以及商业模拟器等模拟。",
    business: "Business 增加创作与专业工具：用于生成媒体的 AI Media Studio、用于出版的 Library Studio、含文件工作室的 Professional tools，以及 VX Finance Hub。每月 VX 额度也最多。",
  },
  tr: {
    sections: "Visionex'te şunlar var: yapay zekâ asistanı, Academy, Library, Arcade oyunları, VisionKids, Bazaar (pazar yeri), Career Hub, Visionex TV ve Radio, sesli odalar ve mesajlar, simülasyonlar, AI Media Studio, Library Studio, Professional tools ve VX Finance Hub — ayrıca paket olmadan açık haberler, topluluk ve yardımcı ürünler. İstediğini sor.",
    benefits: "Abonelik sana sitede ve WhatsApp'ta asistan, Academy'de kurslar, Library'de kitaplar, erişilebilir oyunlar, bir pazar yeri ve üst paketlerde TV, radyo, sesli odalar, kariyer araçları ve yaratıcı stüdyolar verir — hepsi ekran okuyucu ve klavye için yapıldı. Her pakette ek hizmetler için aylık VX kredisi var.",
    tiers: "Basic ayda ${basic} dolar: asistan, Academy, Library, Arcade, Bazaar. Pro ayda ${pro} dolar: Basic'in hepsi artı VisionKids, Career Hub, TV, Radio, sesli odalar ve simülasyonlar. Business ayda ${business} dolar: Pro'nun hepsi artı AI Media Studio, Library Studio, Professional tools ve VX Finance Hub. Kids ayda ${kids} dolar: çocuklar için VisionKids, Academy, Library ve Arcade.",
    academy: "Academy'de ekran okuyucu veya klavyeyle izlenebilen erişilebilir kurslar ve dersler var. Basic paketten itibaren ve Kids'te dahil.",
    library: "Library; aranıp okunabilen veya dinlenebilen kitaplar, sesli kitaplar ve açık okuma kaynakları koleksiyonudur. Basic paketten itibaren ve Kids'te dahil.",
    arcade: "Arcade, görmenin yanında kulakla ve klavyeyle de oynanabilen oyunlardır; puan ve ödül var. Basic paketten itibaren ve Kids'te dahil.",
    kids: "VisionKids, öğretici oyunlar ve etkinliklerle dolu güvenli bir çocuk dünyasıdır. Kids paketiyle, ayrıca Pro ve Business'ta gelir.",
    marketplace: "Bazaar, yardımcı ürünler dahil ürünlere göz atıp satın alabileceğin Visionex pazar yeridir. Basic paketten itibaren dahil.",
    free: "Bu bölümler paket olmadan açık: haberler, topluluk ve yardımcı ürün kataloğu. Hesap oluşturmak ücretsiz.",
    pro: "Pro şunları ekler: VisionKids, iş ve beceriler için Career Hub, Visionex TV, Visionex Radio, sesli odalar ve mesajlar, iş simülatörü gibi simülasyonlar.",
    business: "Business yaratıcı ve profesyonel araçlar ekler: üretilen medya için AI Media Studio, yayın için Library Studio, dosya stüdyosu dahil Professional tools ve VX Finance Hub. En yüksek aylık VX kredisi de bunda.",
  },
  fr: {
    sections: "Sur Visionex, vous trouverez : l'assistant IA, Academy, Library, les jeux Arcade, VisionKids, Bazaar (marché), Career Hub, Visionex TV et Radio, salons vocaux et messages, simulations, AI Media Studio, Library Studio, Professional tools et le VX Finance Hub — plus l'actualité, la communauté et les produits d'assistance, ouverts sans offre. Demandez-moi n'importe lequel.",
    benefits: "L'abonnement vous donne l'assistant sur le site et sur WhatsApp, des cours dans l'Academy, des livres dans la Library, des jeux accessibles, un marché et, dans les offres supérieures, TV, radio, salons vocaux, outils de carrière et studios créatifs — le tout pensé pour les lecteurs d'écran et le clavier. Chaque offre inclut des crédits VX mensuels pour les services en plus.",
    tiers: "Basic ${basic}/mois : assistant, Academy, Library, Arcade, Bazaar. Pro ${pro}/mois : tout Basic plus VisionKids, Career Hub, TV, Radio, salons vocaux et simulations. Business ${business}/mois : tout Pro plus AI Media Studio, Library Studio, Professional tools et VX Finance Hub. Kids ${kids}/mois : VisionKids, Academy, Library et Arcade pour les enfants.",
    academy: "L'Academy propose des cours et leçons accessibles à suivre avec un lecteur d'écran ou le clavier. Incluse dès l'offre Basic, et dans Kids.",
    library: "La Library est une collection de livres, livres audio et ressources de lecture ouvertes à chercher, lire ou écouter. Incluse dès l'offre Basic, et dans Kids.",
    arcade: "L'Arcade réunit des jeux qui se jouent aussi à l'oreille et au clavier, pas seulement à la vue, avec scores et récompenses. Incluse dès l'offre Basic, et dans Kids.",
    kids: "VisionKids est un monde sûr pour les enfants, avec des jeux et activités pour apprendre. Il vient avec l'offre Kids, et avec Pro et Business.",
    marketplace: "Le Bazaar est le marché de Visionex, où parcourir et acheter des produits, dont des produits d'assistance. Inclus dès l'offre Basic.",
    free: "Ces espaces sont ouverts sans offre : l'actualité, la communauté et le catalogue de produits d'assistance. Créer un compte est gratuit.",
    pro: "Pro ajoute : VisionKids, le Career Hub pour l'emploi et les compétences, Visionex TV, Visionex Radio, salons vocaux et messages, et des simulations comme le simulateur d'entreprise.",
    business: "Business ajoute des outils créatifs et professionnels : AI Media Studio pour les médias générés, Library Studio pour publier, Professional tools avec le studio de fichiers, et le VX Finance Hub. C'est aussi le plus gros crédit VX mensuel.",
  },
  ru: {
    sections: "В Visionex есть: ИИ-ассистент, Academy, Library, игры Arcade, VisionKids, Bazaar (маркет), Career Hub, Visionex TV и Radio, голосовые комнаты и сообщения, симуляции, AI Media Studio, Library Studio, Professional tools и VX Finance Hub — а также новости, сообщество и вспомогательные товары, открытые без тарифа. Спрашивайте о любом разделе.",
    benefits: "Подписка даёт ассистента на сайте и в WhatsApp, курсы в Academy, книги в Library, доступные игры, маркет, а в старших тарифах — ТВ, радио, голосовые комнаты, карьерные инструменты и творческие студии — всё рассчитано на программы экранного доступа и клавиатуру. В каждый тариф входят ежемесячные VX для дополнительных услуг.",
    tiers: "Basic ${basic}/мес.: ассистент, Academy, Library, Arcade, Bazaar. Pro ${pro}/мес.: всё из Basic плюс VisionKids, Career Hub, ТВ, Radio, голосовые комнаты и симуляции. Business ${business}/мес.: всё из Pro плюс AI Media Studio, Library Studio, Professional tools и VX Finance Hub. Kids ${kids}/мес.: VisionKids, Academy, Library и Arcade для детей.",
    academy: "В Academy доступные курсы и уроки, которые можно проходить с программой экранного доступа или клавиатурой. Входит с тарифа Basic и в Kids.",
    library: "Library — коллекция книг, аудиокниг и открытых материалов для чтения: можно искать, читать и слушать. Входит с тарифа Basic и в Kids.",
    arcade: "Arcade — игры, в которые можно играть на слух и с клавиатуры, а не только зрением, с очками и наградами. Входит с тарифа Basic и в Kids.",
    kids: "VisionKids — безопасный мир для детей с обучающими играми и занятиями. Входит в тариф Kids, а также в Pro и Business.",
    marketplace: "Bazaar — маркет Visionex, где можно смотреть и покупать товары, в том числе вспомогательные. Входит с тарифа Basic.",
    free: "Без тарифа открыты: новости, сообщество и каталог вспомогательных товаров. Создать аккаунт можно бесплатно.",
    pro: "Pro добавляет: VisionKids, Career Hub для работы и навыков, Visionex TV, Visionex Radio, голосовые комнаты и сообщения, а также симуляции, например бизнес-симулятор.",
    business: "Business добавляет творческие и профессиональные инструменты: AI Media Studio для создания медиа, Library Studio для публикации, Professional tools с файловой студией и VX Finance Hub. Здесь же самый большой ежемесячный VX.",
  },
};

/** Monthly prices in US dollars, pinned against src/lib/billing/plans.ts by a test. */
export const SITE_PRICES = { basic: 5, pro: 10, business: 20, kids: 3 } as const;

/**
 * What each plan opens, as the interest sections the chat can recognise. Pinned
 * against src/lib/billing/plans.ts by a test. Order is cheapest first; the Kids
 * plan is only ever recommended to someone who asked for the children's world.
 */
export const SITE_PLANS = [
  { id: "kids", name: "Kids", price: 3, sections: ["kids", "academy", "library", "arcade"] },
  { id: "basic", name: "Basic", price: 5, sections: ["assistant", "academy", "library", "arcade", "marketplace"] },
  {
    id: "pro", name: "Pro", price: 10,
    sections: ["assistant", "academy", "library", "arcade", "marketplace", "kids", "career", "tv", "radio", "messages", "simulations"],
  },
  {
    id: "business", name: "Business", price: 20,
    sections: [
      "assistant", "academy", "library", "arcade", "marketplace", "kids", "career", "tv", "radio", "messages", "simulations",
      "mediaStudio", "studio", "professional", "finance",
    ],
  },
] as const;
