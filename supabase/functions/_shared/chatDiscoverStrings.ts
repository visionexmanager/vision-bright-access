// The two sentences that make the free reply lead the conversation: a question
// about what the person enjoys, and a plan recommendation built from the answer.
//
// `discover` asks. `recommend` answers, with {plan} and {price} filled from the
// plan table (pinned to src/lib/billing/plans.ts by a test). Pure data.

import type { SupportedLanguage } from "./whatsappLanguages.ts";

export type DiscoverKey = "discover" | "recommend";

export const DISCOVER_STRINGS: Record<SupportedLanguage, Record<DiscoverKey, string>> = {
  en: {
    discover: "So I can suggest the right plan: what do you enjoy most — learning, reading, games, kids' activities, shopping, TV and radio, jobs, or creating and publishing? Just write a few words.",
    recommend: "From what you've told me, {plan} (${price}/month) fits you best — it includes everything you mentioned.",
  },
  ar: {
    discover: "لأقترح عليك الباقة المناسبة: ما الذي تفضّله أكثر — التعلّم، القراءة، الألعاب، أنشطة الأطفال، التسوّق، التلفزيون والراديو، الوظائف، أم الإبداع والنشر؟ اكتب لي كلمات قليلة.",
    recommend: "بحسب ما ذكرته، الباقة الأنسب لك هي {plan} ({price}$ شهرياً) — فهي تشمل كل ما ذكرت.",
  },
  ur: {
    discover: "آپ کے لیے صحیح پلان تجویز کرنے کو بتائیں: آپ کو سب سے زیادہ کیا پسند ہے — سیکھنا، پڑھنا، گیمز، بچوں کی سرگرمیاں، خریداری، ٹی وی اور ریڈیو، ملازمتیں، یا تخلیق اور اشاعت؟ بس چند الفاظ لکھیں۔",
    recommend: "آپ کی بتائی باتوں کے مطابق {plan} (${price}/ماہ) آپ کے لیے سب سے مناسب ہے — اس میں آپ کی بتائی ہر چیز شامل ہے۔",
  },
  hi: {
    discover: "सही प्लान सुझाने के लिए बताइए: आपको सबसे ज़्यादा क्या पसंद है — सीखना, पढ़ना, गेम, बच्चों की गतिविधियाँ, खरीदारी, टीवी और रेडियो, नौकरी, या बनाना और प्रकाशित करना? बस कुछ शब्द लिखें।",
    recommend: "आपकी बातों के आधार पर {plan} (${price}/माह) आपके लिए सबसे उपयुक्त है — इसमें आपकी बताई हर चीज़ शामिल है।",
  },
  id: {
    discover: "Agar saya bisa sarankan paket yang tepat: apa yang paling Anda sukai — belajar, membaca, game, aktivitas anak, belanja, TV dan radio, pekerjaan, atau berkarya dan menerbitkan? Tulis beberapa kata saja.",
    recommend: "Dari yang Anda sampaikan, {plan} (${price}/bulan) paling cocok — mencakup semua yang Anda sebut.",
  },
  ja: {
    discover: "ぴったりのプランをご提案するために教えてください。いちばん好きなのは、学ぶこと、読書、ゲーム、子ども向けの活動、買い物、テレビとラジオ、仕事探し、創作と出版のどれですか？ひとことで大丈夫です。",
    recommend: "お話から考えると、{plan}（月${price}ドル）が最適です。挙げていただいたものがすべて含まれています。",
  },
  it: {
    discover: "Per consigliarti il piano giusto: cosa ti piace di più — imparare, leggere, giocare, attività per bambini, fare acquisti, TV e radio, lavoro, o creare e pubblicare? Bastano poche parole.",
    recommend: "Da quello che mi hai detto, {plan} (${price}/mese) è il più adatto: include tutto ciò che hai citato.",
  },
  ko: {
    discover: "알맞은 요금제를 추천해 드리려고 합니다. 무엇을 가장 좋아하세요 — 배우기, 읽기, 게임, 어린이 활동, 쇼핑, TV와 라디오, 일자리, 창작과 출판? 몇 단어만 적어 주세요.",
    recommend: "말씀하신 내용으로는 {plan}(월 ${price}달러)이 가장 잘 맞습니다. 언급하신 것이 모두 포함돼요.",
  },
  nl: {
    discover: "Zodat ik het juiste abonnement kan voorstellen: waar houd je het meest van — leren, lezen, games, activiteiten voor kinderen, winkelen, tv en radio, banen, of creëren en publiceren? Schrijf maar een paar woorden.",
    recommend: "Op basis van wat je vertelde past {plan} (${price}/maand) het best — het bevat alles wat je noemde.",
  },
  pl: {
    discover: "Żebym mógł zaproponować odpowiedni plan: co lubisz najbardziej — naukę, czytanie, gry, zajęcia dla dzieci, zakupy, TV i radio, pracę, czy tworzenie i publikowanie? Napisz kilka słów.",
    recommend: "Po tym, co powiedziałeś, najlepiej pasuje {plan} (${price}/mies.) — zawiera wszystko, co wymieniłeś.",
  },
  vi: {
    discover: "Để gợi ý gói phù hợp: bạn thích gì nhất — học tập, đọc sách, game, hoạt động cho trẻ em, mua sắm, TV và radio, việc làm, hay sáng tạo và xuất bản? Chỉ cần viết vài từ.",
    recommend: "Dựa trên những gì bạn nói, {plan} (${price}/tháng) phù hợp nhất — gói này gồm mọi thứ bạn đã nhắc.",
  },
  bn: {
    discover: "সঠিক প্ল্যান সুপারিশ করতে বলুন: আপনি সবচেয়ে কী পছন্দ করেন — শেখা, পড়া, গেম, শিশুদের কার্যক্রম, কেনাকাটা, টিভি ও রেডিও, চাকরি, নাকি সৃষ্টি ও প্রকাশনা? কয়েকটি শব্দ লিখুন।",
    recommend: "আপনার কথা অনুযায়ী {plan} (মাসে ${price} ডলার) আপনার জন্য সবচেয়ে মানানসই — আপনার বলা সবকিছুই এতে আছে।",
  },
  fa: {
    discover: "برای پیشنهاد طرح مناسب بگویید: بیشتر به چه چیزی علاقه دارید — یادگیری، خواندن، بازی، فعالیت‌های کودکان، خرید، تلویزیون و رادیو، شغل، یا آفرینش و انتشار؟ فقط چند کلمه بنویسید.",
    recommend: "با توجه به گفته‌های شما، {plan} (ماهی ${price} دلار) مناسب‌ترین است — هر چه گفتید در آن هست.",
  },
  es: {
    discover: "Para sugerirte el plan adecuado: ¿qué te gusta más — aprender, leer, juegos, actividades para niños, compras, TV y radio, empleo, o crear y publicar? Escribe unas pocas palabras.",
    recommend: "Por lo que me cuentas, {plan} (${price}/mes) es el que mejor te va: incluye todo lo que mencionaste.",
  },
  de: {
    discover: "Damit ich den passenden Tarif vorschlagen kann: Was gefällt dir am meisten — Lernen, Lesen, Spiele, Aktivitäten für Kinder, Einkaufen, TV und Radio, Jobs oder Gestalten und Veröffentlichen? Schreib einfach ein paar Worte.",
    recommend: "Nach dem, was du erzählt hast, passt {plan} (${price}/Monat) am besten — er enthält alles, was du genannt hast.",
  },
  pt: {
    discover: "Para te sugerir o plano certo: do que gostas mais — aprender, ler, jogos, atividades para crianças, compras, TV e rádio, emprego, ou criar e publicar? Escreve só algumas palavras.",
    recommend: "Pelo que me disseste, o {plan} (${price}/mês) é o que melhor te serve: inclui tudo o que mencionaste.",
  },
  zh: {
    discover: "为了给你推荐合适的套餐，请告诉我你最喜欢什么：学习、阅读、游戏、儿童活动、购物、电视和广播、找工作，还是创作与出版？写几个词就行。",
    recommend: "根据你说的，{plan}（每月 ${price} 美元）最适合你——你提到的内容它都包含。",
  },
  tr: {
    discover: "Sana uygun paketi önerebilmem için: en çok neyi seviyorsun — öğrenmeyi, okumayı, oyunları, çocuk etkinliklerini, alışverişi, TV ve radyoyu, iş bulmayı, yoksa üretmeyi ve yayımlamayı? Birkaç kelime yaz yeter.",
    recommend: "Anlattıklarına göre en uygun paket {plan} (ayda ${price} dolar) — saydığın her şeyi içeriyor.",
  },
  fr: {
    discover: "Pour vous proposer la bonne offre : qu'est-ce que vous aimez le plus — apprendre, lire, les jeux, les activités pour enfants, les achats, la TV et la radio, l'emploi, ou créer et publier ? Quelques mots suffisent.",
    recommend: "D'après ce que vous m'avez dit, {plan} (${price}/mois) vous convient le mieux : elle inclut tout ce que vous avez cité.",
  },
  ru: {
    discover: "Чтобы подсказать подходящий тариф: что вам нравится больше всего — учиться, читать, игры, занятия для детей, покупки, ТВ и радио, работа или творчество и публикации? Напишите несколько слов.",
    recommend: "По вашим словам лучше всего подходит {plan} (${price}/мес.) — в нём есть всё, что вы назвали.",
  },
};
