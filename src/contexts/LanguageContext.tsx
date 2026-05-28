import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";

export const supportedLangs = ["en", "ar", "es", "de", "pt", "zh", "tr", "fr", "ru", "ur", "hi"] as const;
export type Lang = (typeof supportedLangs)[number];

interface LanguageContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  translateText: (text: string) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => key,
  translateText: (text) => text,
  dir: "ltr",
});

export const useLanguage = () => useContext(LanguageContext);

// All language files are loaded on demand — ~200-340 KB each.
// English is also lazily loaded now so it's not in the main bundle (~242 KB saved).
const loadedTranslations: Partial<Record<Lang, Record<string, string>>> = {};

async function loadLang(lang: Lang): Promise<Record<string, string>> {
  if (loadedTranslations[lang]) return loadedTranslations[lang]!;
  const mod = await import(`../i18n/${lang}.ts`);
  loadedTranslations[lang] = mod.default;
  return mod.default;
}

const rtlLangs: Lang[] = ["ar", "ur"];
const originalTextNodes = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function safeGetStoredLang(): Lang | null {
  try {
    const saved = localStorage.getItem("visionex-lang") as Lang | null;
    return saved && supportedLangs.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}

function safeSetStoredLang(lang: Lang) {
  try {
    localStorage.setItem("visionex-lang", lang);
  } catch {
    // Storage can be unavailable in hardened browser/privacy modes.
  }
}

const commonDomText: Record<string, Partial<Record<Lang, string>>> = {
  "Revenue": { ar: "الإيرادات", es: "Ingresos", de: "Umsatz", pt: "Receita", zh: "收入", tr: "Gelir", fr: "Revenus", ru: "Доход", ur: "آمدنی", hi: "राजस्व" },
  "Costs": { ar: "التكاليف", es: "Costes", de: "Kosten", pt: "Custos", zh: "成本", tr: "Maliyetler", fr: "Coûts", ru: "Затраты", ur: "اخراجات", hi: "लागत" },
  "Cost": { ar: "التكلفة", es: "Coste", de: "Kosten", pt: "Custo", zh: "成本", tr: "Maliyet", fr: "Coût", ru: "Стоимость", ur: "لاگت", hi: "लागत" },
  "Profit": { ar: "الربح", es: "Beneficio", de: "Gewinn", pt: "Lucro", zh: "利润", tr: "Kar", fr: "Profit", ru: "Прибыль", ur: "منافع", hi: "लाभ" },
  "Net Profit": { ar: "صافي الربح", es: "Beneficio neto", de: "Nettogewinn", pt: "Lucro líquido", zh: "净利润", tr: "Net kar", fr: "Bénéfice net", ru: "Чистая прибыль", ur: "خالص منافع", hi: "शुद्ध लाभ" },
  "Score": { ar: "النقاط", es: "Puntuación", de: "Punktzahl", pt: "Pontuação", zh: "得分", tr: "Puan", fr: "Score", ru: "Счёт", ur: "اسکور", hi: "स्कोर" },
  "Quality": { ar: "الجودة", es: "Calidad", de: "Qualität", pt: "Qualidade", zh: "质量", tr: "Kalite", fr: "Qualité", ru: "Качество", ur: "معیار", hi: "गुणवत्ता" },
  "Satisfaction": { ar: "الرضا", es: "Satisfacción", de: "Zufriedenheit", pt: "Satisfação", zh: "满意度", tr: "Memnuniyet", fr: "Satisfaction", ru: "Удовлетворенность", ur: "اطمینان", hi: "संतुष्टि" },
  "Play Again": { ar: "العب مرة أخرى", es: "Jugar de nuevo", de: "Erneut spielen", pt: "Jogar novamente", zh: "再玩一次", tr: "Tekrar oyna", fr: "Rejouer", ru: "Играть снова", ur: "دوبارہ کھیلیں", hi: "फिर खेलें" },
  "Restart": { ar: "إعادة البدء", es: "Reiniciar", de: "Neu starten", pt: "Reiniciar", zh: "重新开始", tr: "Yeniden başlat", fr: "Redémarrer", ru: "Перезапустить", ur: "دوبارہ شروع کریں", hi: "पुनः शुरू करें" },
  "Select": { ar: "اختيار", es: "Seleccionar", de: "Auswählen", pt: "Selecionar", zh: "选择", tr: "Seç", fr: "Sélectionner", ru: "Выбрать", ur: "منتخب کریں", hi: "चुनें" },
  "Take": { ar: "استلام", es: "Tomar", de: "Annehmen", pt: "Pegar", zh: "接取", tr: "Al", fr: "Prendre", ru: "Взять", ur: "لیں", hi: "लें" },
  "You": { ar: "أنت", es: "Tú", de: "Du", pt: "Você", zh: "你", tr: "Sen", fr: "Vous", ru: "Вы", ur: "آپ", hi: "आप" },
  "Board": { ar: "اللوحة", es: "Tablero", de: "Brett", pt: "Tabuleiro", zh: "棋盘", tr: "Tahta", fr: "Plateau", ru: "Доска", ur: "بورڈ", hi: "बोर्ड" },
  "Pass turn": { ar: "تمرير الدور", es: "Pasar turno", de: "Zug aussetzen", pt: "Passar turno", zh: "跳过回合", tr: "Turu geç", fr: "Passer le tour", ru: "Пропустить ход", ur: "باری چھوڑیں", hi: "चाल छोड़ें" },
  "Roll": { ar: "ارمِ", es: "Lanzar", de: "Würfeln", pt: "Rolar", zh: "掷骰", tr: "Zar at", fr: "Lancer", ru: "Бросить", ur: "پھینکیں", hi: "फेंकें" },
  "Draw card": { ar: "اسحب بطاقة", es: "Robar carta", de: "Karte ziehen", pt: "Comprar carta", zh: "抽牌", tr: "Kart çek", fr: "Piocher", ru: "Взять карту", ur: "کارڈ کھینچیں", hi: "कार्ड लें" },
  "Current card": { ar: "البطاقة الحالية", es: "Carta actual", de: "Aktuelle Karte", pt: "Carta atual", zh: "当前牌", tr: "Mevcut kart", fr: "Carte actuelle", ru: "Текущая карта", ur: "موجودہ کارڈ", hi: "मौजूदा कार्ड" },
  "Out": { ar: "خارج", es: "Fuera", de: "Ausgeschieden", pt: "Fora", zh: "出局", tr: "Çıktı", fr: "Éliminé", ru: "Выбыл", ur: "باہر", hi: "बाहर" },
  "Budget": { ar: "الميزانية", es: "Presupuesto", de: "Budget", pt: "Orçamento", zh: "预算", tr: "Bütçe", fr: "Budget", ru: "Бюджет", ur: "بجٹ", hi: "बजट" },
  "Timeline": { ar: "الجدول الزمني", es: "Cronograma", de: "Zeitplan", pt: "Cronograma", zh: "时间线", tr: "Zaman çizelgesi", fr: "Calendrier", ru: "Сроки", ur: "ٹائم لائن", hi: "समयरेखा" },
  "Est. Duration": { ar: "المدة المتوقعة", es: "Duración est.", de: "Geschätzte Dauer", pt: "Duração estimada", zh: "预计时长", tr: "Tahmini süre", fr: "Durée estimée", ru: "Оценочная длительность", ur: "متوقع مدت", hi: "अनुमानित अवधि" },
  "Project Brief": { ar: "ملخص المشروع", es: "Resumen del proyecto", de: "Projektbrief", pt: "Resumo do projeto", zh: "项目简报", tr: "Proje özeti", fr: "Brief du projet", ru: "Описание проекта", ur: "منصوبے کا خلاصہ", hi: "परियोजना विवरण" },
  "Your Objectives": { ar: "أهدافك", es: "Tus objetivos", de: "Deine Ziele", pt: "Seus objetivos", zh: "你的目标", tr: "Hedeflerin", fr: "Vos objectifs", ru: "Ваши цели", ur: "آپ کے مقاصد", hi: "आपके उद्देश्य" },
  "Project Deliverables": { ar: "مخرجات المشروع", es: "Entregables del proyecto", de: "Projektleistungen", pt: "Entregáveis do projeto", zh: "项目交付物", tr: "Proje çıktıları", fr: "Livrables du projet", ru: "Результаты проекта", ur: "منصوبے کی فراہمی", hi: "परियोजना डिलीवरबल्स" },
  "Begin Project": { ar: "ابدأ المشروع", es: "Iniciar proyecto", de: "Projekt starten", pt: "Iniciar projeto", zh: "开始项目", tr: "Projeyi başlat", fr: "Commencer le projet", ru: "Начать проект", ur: "منصوبہ شروع کریں", hi: "परियोजना शुरू करें" },
  "Project Complete!": { ar: "اكتمل المشروع!", es: "¡Proyecto completado!", de: "Projekt abgeschlossen!", pt: "Projeto concluído!", zh: "项目完成！", tr: "Proje tamamlandı!", fr: "Projet terminé !", ru: "Проект завершён!", ur: "منصوبہ مکمل!", hi: "परियोजना पूरी!" },
  "Performance Score": { ar: "درجة الأداء", es: "Puntuación de rendimiento", de: "Leistungsbewertung", pt: "Pontuação de desempenho", zh: "表现得分", tr: "Performans puanı", fr: "Score de performance", ru: "Оценка эффективности", ur: "کارکردگی اسکور", hi: "प्रदर्शन स्कोर" },
  "VX Points Earned": { ar: "نقاط VX المكتسبة", es: "Puntos VX ganados", de: "Verdiente VX-Punkte", pt: "Pontos VX ganhos", zh: "获得的 VX 积分", tr: "Kazanılan VX puanları", fr: "Points VX gagnés", ru: "Заработанные VX-очки", ur: "حاصل شدہ VX پوائنٹس", hi: "कमाए गए VX अंक" },
  "Project Score": { ar: "درجة المشروع", es: "Puntuación del proyecto", de: "Projektbewertung", pt: "Pontuação do projeto", zh: "项目得分", tr: "Proje puanı", fr: "Score du projet", ru: "Оценка проекта", ur: "منصوبے کا اسکور", hi: "परियोजना स्कोर" },
  "Objectives Review": { ar: "مراجعة الأهداف", es: "Revisión de objetivos", de: "Zielüberprüfung", pt: "Revisão dos objetivos", zh: "目标回顾", tr: "Hedef incelemesi", fr: "Revue des objectifs", ru: "Обзор целей", ur: "مقاصد کا جائزہ", hi: "उद्देश्य समीक्षा" },
  "Deliverables Submitted": { ar: "المخرجات المقدمة", es: "Entregables enviados", de: "Eingereichte Ergebnisse", pt: "Entregáveis enviados", zh: "已提交交付物", tr: "Teslim edilen çıktılar", fr: "Livrables soumis", ru: "Отправленные результаты", ur: "جمع شدہ فراہمی", hi: "जमा किए गए डिलीवरबल्स" },
  "Back to Simulations": { ar: "العودة إلى المحاكيات", es: "Volver a simulaciones", de: "Zurück zu Simulationen", pt: "Voltar às simulações", zh: "返回模拟", tr: "Simülasyonlara dön", fr: "Retour aux simulations", ru: "Назад к симуляциям", ur: "سمولیشنز پر واپس", hi: "सिमुलेशन पर वापस" },
  "Redo Project": { ar: "إعادة المشروع", es: "Rehacer proyecto", de: "Projekt wiederholen", pt: "Refazer projeto", zh: "重做项目", tr: "Projeyi yenile", fr: "Refaire le projet", ru: "Повторить проект", ur: "منصوبہ دوبارہ کریں", hi: "परियोजना फिर करें" },
  "Delivery Time": { ar: "وقت التسليم", es: "Tiempo de entrega", de: "Lieferzeit", pt: "Prazo de entrega", zh: "交付时间", tr: "Teslim süresi", fr: "Délai de livraison", ru: "Срок доставки", ur: "ترسیل کا وقت", hi: "डिलीवरी समय" },
  "Guarantee": { ar: "الضمان", es: "Garantía", de: "Garantie", pt: "Garantia", zh: "保证", tr: "Garanti", fr: "Garantie", ru: "Гарантия", ur: "ضمانت", hi: "गारंटी" },
  "Technology": { ar: "التقنية", es: "Tecnología", de: "Technologie", pt: "Tecnologia", zh: "技术", tr: "Teknoloji", fr: "Technologie", ru: "Технология", ur: "ٹیکنالوجی", hi: "तकनीक" },
  "Most Popular": { ar: "الأكثر شيوعًا", es: "Más popular", de: "Am beliebtesten", pt: "Mais popular", zh: "最受欢迎", tr: "En popüler", fr: "Le plus populaire", ru: "Самое популярное", ur: "سب سے مقبول", hi: "सबसे लोकप्रिय" },
  "Delivery": { ar: "التسليم", es: "Entrega", de: "Lieferung", pt: "Entrega", zh: "交付", tr: "Teslimat", fr: "Livraison", ru: "Доставка", ur: "ترسیل", hi: "डिलीवरी" },
  "Features": { ar: "المميزات", es: "Funciones", de: "Funktionen", pt: "Recursos", zh: "功能", tr: "Özellikler", fr: "Fonctionnalités", ru: "Возможности", ur: "خصوصیات", hi: "विशेषताएँ" },
  "Total Cost": { ar: "التكلفة الإجمالية", es: "Coste total", de: "Gesamtkosten", pt: "Custo total", zh: "总成本", tr: "Toplam maliyet", fr: "Coût total", ru: "Общая стоимость", ur: "کل لاگت", hi: "कुल लागत" },
  "Total Energy": { ar: "إجمالي الطاقة", es: "Energía total", de: "Gesamtenergie", pt: "Energia total", zh: "总能量", tr: "Toplam enerji", fr: "Énergie totale", ru: "Общая энергия", ur: "کل توانائی", hi: "कुल ऊर्जा" },
  "Payback": { ar: "فترة الاسترداد", es: "Retorno", de: "Amortisation", pt: "Retorno", zh: "回本期", tr: "Geri ödeme", fr: "Retour sur investissement", ru: "Окупаемость", ur: "واپسی", hi: "वापसी" },
  "Breed": { ar: "السلالة", es: "Raza", de: "Rasse", pt: "Raça", zh: "品种", tr: "Irk", fr: "Race", ru: "Порода", ur: "نسل", hi: "नस्ल" },
  "Housing": { ar: "السكن", es: "Alojamiento", de: "Unterbringung", pt: "Alojamento", zh: "住房", tr: "Barınak", fr: "Logement", ru: "Размещение", ur: "رہائش", hi: "आवास" },
  "Building": { ar: "المبنى", es: "Edificio", de: "Gebäude", pt: "Edifício", zh: "建筑", tr: "Bina", fr: "Bâtiment", ru: "Здание", ur: "عمارت", hi: "भवन" },
  "System Type": { ar: "نوع النظام", es: "Tipo de sistema", de: "Systemtyp", pt: "Tipo de sistema", zh: "系统类型", tr: "Sistem türü", fr: "Type de système", ru: "Тип системы", ur: "نظام کی قسم", hi: "सिस्टम प्रकार" },
  "Setup Cost": { ar: "تكلفة الإعداد", es: "Coste inicial", de: "Einrichtungskosten", pt: "Custo de configuração", zh: "设置成本", tr: "Kurulum maliyeti", fr: "Coût de mise en place", ru: "Стоимость настройки", ur: "سیٹ اپ لاگت", hi: "सेटअप लागत" },
  "Customer Budget": { ar: "ميزانية العميل", es: "Presupuesto del cliente", de: "Kundenbudget", pt: "Orçamento do cliente", zh: "客户预算", tr: "Müşteri bütçesi", fr: "Budget client", ru: "Бюджет клиента", ur: "کسٹمر بجٹ", hi: "ग्राहक बजट" },
  "Symptoms": { ar: "الأعراض", es: "Síntomas", de: "Symptome", pt: "Sintomas", zh: "症状", tr: "Belirtiler", fr: "Symptômes", ru: "Симптомы", ur: "علامات", hi: "लक्षण" },
  "DIAGNOSTIC RESULTS": { ar: "نتائج التشخيص", es: "Resultados del diagnóstico", de: "Diagnoseergebnisse", pt: "Resultados do diagnóstico", zh: "诊断结果", tr: "Tanı sonuçları", fr: "Résultats du diagnostic", ru: "Результаты диагностики", ur: "تشخیص کے نتائج", hi: "निदान परिणाम" },
  "Run Diagnostics": { ar: "تشغيل التشخيص", es: "Ejecutar diagnóstico", de: "Diagnose starten", pt: "Executar diagnóstico", zh: "运行诊断", tr: "Tanı çalıştır", fr: "Lancer le diagnostic", ru: "Запустить диагностику", ur: "تشخیص چلائیں", hi: "निदान चलाएँ" },
  "Select Repairs": { ar: "اختر الإصلاحات", es: "Seleccionar reparaciones", de: "Reparaturen auswählen", pt: "Selecionar reparos", zh: "选择维修", tr: "Onarımları seç", fr: "Sélectionner les réparations", ru: "Выбрать ремонт", ur: "مرمت منتخب کریں", hi: "मरम्मत चुनें" },
  "Submit Repair": { ar: "إرسال الإصلاح", es: "Enviar reparación", de: "Reparatur einreichen", pt: "Enviar reparo", zh: "提交维修", tr: "Onarımı gönder", fr: "Soumettre la réparation", ru: "Отправить ремонт", ur: "مرمت جمع کریں", hi: "मरम्मत जमा करें" },
  "Charge Customer": { ar: "تحصيل من العميل", es: "Cobrar al cliente", de: "Kunden belasten", pt: "Cobrar cliente", zh: "向客户收费", tr: "Müşteriden ücret al", fr: "Facturer le client", ru: "Выставить счёт клиенту", ur: "کسٹمر سے وصول کریں", hi: "ग्राहक से शुल्क लें" },
  "Parts cost": { ar: "تكلفة القطع", es: "Coste de piezas", de: "Teilekosten", pt: "Custo das peças", zh: "零件成本", tr: "Parça maliyeti", fr: "Coût des pièces", ru: "Стоимость деталей", ur: "پرزوں کی لاگت", hi: "पुर्जों की लागत" },
  "All Cases Complete": { ar: "اكتملت كل الحالات", es: "Todos los casos completados", de: "Alle Fälle abgeschlossen", pt: "Todos os casos concluídos", zh: "所有案例完成", tr: "Tüm vakalar tamamlandı", fr: "Tous les cas terminés", ru: "Все случаи завершены", ur: "تمام کیس مکمل", hi: "सभी मामले पूरे" },
  "Devices Fixed": { ar: "الأجهزة التي تم إصلاحها", es: "Dispositivos reparados", de: "Reparierte Geräte", pt: "Dispositivos reparados", zh: "已修设备", tr: "Onarılan cihazlar", fr: "Appareils réparés", ru: "Исправленные устройства", ur: "درست کیے گئے آلات", hi: "ठीक किए गए उपकरण" },
  "Waiting": { ar: "بانتظار", es: "Esperando", de: "Warten", pt: "Aguardando", zh: "等待中", tr: "Bekliyor", fr: "En attente", ru: "Ожидание", ur: "انتظار", hi: "प्रतीक्षा" },
  "No customers waiting": { ar: "لا يوجد عملاء بانتظار", es: "No hay clientes esperando", de: "Keine Kunden warten", pt: "Nenhum cliente aguardando", zh: "没有客户等待", tr: "Bekleyen müşteri yok", fr: "Aucun client en attente", ru: "Нет ожидающих клиентов", ur: "کوئی کسٹمر منتظر نہیں", hi: "कोई ग्राहक प्रतीक्षा में नहीं" },
  "Market Results": { ar: "نتائج السوق", es: "Resultados del mercado", de: "Marktergebnisse", pt: "Resultados do mercado", zh: "市场结果", tr: "Pazar sonuçları", fr: "Résultats du marché", ru: "Рыночные результаты", ur: "بازار کے نتائج", hi: "बाज़ार परिणाम" },
  "Create Again": { ar: "أنشئ مرة أخرى", es: "Crear de nuevo", de: "Erneut erstellen", pt: "Criar novamente", zh: "再次创建", tr: "Tekrar oluştur", fr: "Créer à nouveau", ru: "Создать снова", ur: "دوبارہ بنائیں", hi: "फिर बनाएँ" },
  "Try Again": { ar: "حاول مرة أخرى", es: "Intentar de nuevo", de: "Erneut versuchen", pt: "Tentar novamente", zh: "重试", tr: "Tekrar dene", fr: "Réessayer", ru: "Попробовать снова", ur: "دوبارہ کوشش کریں", hi: "फिर कोशिश करें" },
  "Wireless Earbuds Pro": { ar: "سماعات أذن لاسلكية احترافية", es: "Auriculares inalámbricos Pro", de: "Kabellose Pro-Ohrhörer", pt: "Fones sem fio Pro", zh: "专业无线耳机", tr: "Kablosuz Kulaklık Pro", fr: "Écouteurs sans fil Pro", ru: "Беспроводные наушники Pro", ur: "وائرلیس ایئربڈز پرو", hi: "वायरलेस ईयरबड्स प्रो" },
  "Smart LED Desk Lamp": { ar: "مصباح مكتب LED ذكي", es: "Lámpara de escritorio LED inteligente", de: "Smarte LED-Schreibtischlampe", pt: "Luminária LED inteligente de mesa", zh: "智能 LED 台灯", tr: "Akıllı LED Masa Lambası", fr: "Lampe de bureau LED intelligente", ru: "Умная LED-настольная лампа", ur: "اسمارٹ LED ڈیسک لیمپ", hi: "स्मार्ट LED डेस्क लैम्प" },
  "Ergonomic Office Chair": { ar: "كرسي مكتب مريح", es: "Silla de oficina ergonómica", de: "Ergonomischer Bürostuhl", pt: "Cadeira de escritório ergonômica", zh: "人体工学办公椅", tr: "Ergonomik Ofis Koltuğu", fr: "Chaise de bureau ergonomique", ru: "Эргономичное офисное кресло", ur: "ایرگونومک آفس چیئر", hi: "एर्गोनॉमिक ऑफिस चेयर" },
  "Portable Power Bank": { ar: "بطارية شحن محمولة", es: "Batería externa portátil", de: "Tragbare Powerbank", pt: "Carregador portátil", zh: "便携式充电宝", tr: "Taşınabilir Güç Bankası", fr: "Batterie externe portable", ru: "Портативный пауэрбанк", ur: "پورٹیبل پاور بینک", hi: "पोर्टेबल पावर बैंक" },
  "Electric Kettle": { ar: "غلاية كهربائية", es: "Hervidor eléctrico", de: "Elektrischer Wasserkocher", pt: "Chaleira elétrica", zh: "电热水壶", tr: "Elektrikli Su Isıtıcı", fr: "Bouilloire électrique", ru: "Электрический чайник", ur: "الیکٹرک کیتلی", hi: "इलेक्ट्रिक केतली" },
  "Standing Desk Converter": { ar: "محول مكتب للوقوف", es: "Convertidor de escritorio de pie", de: "Stehschreibtisch-Aufsatz", pt: "Conversor de mesa para trabalho em pé", zh: "站立办公桌转换器", tr: "Ayakta Çalışma Masası Dönüştürücü", fr: "Convertisseur de bureau assis-debout", ru: "Настольная стойка для работы стоя", ur: "اسٹینڈنگ ڈیسک کنورٹر", hi: "स्टैंडिंग डेस्क कन्वर्टर" },
  "Digital Kitchen Scale": { ar: "ميزان مطبخ رقمي", es: "Báscula digital de cocina", de: "Digitale Küchenwaage", pt: "Balança digital de cozinha", zh: "数字厨房秤", tr: "Dijital Mutfak Tartısı", fr: "Balance de cuisine numérique", ru: "Цифровые кухонные весы", ur: "ڈیجیٹل کچن اسکیل", hi: "डिजिटल किचन स्केल" },
  "Wireless Mouse & Keyboard": { ar: "فأرة ولوحة مفاتيح لاسلكيتان", es: "Ratón y teclado inalámbricos", de: "Kabellose Maus und Tastatur", pt: "Mouse e teclado sem fio", zh: "无线鼠标和键盘", tr: "Kablosuz Fare ve Klavye", fr: "Souris et clavier sans fil", ru: "Беспроводная мышь и клавиатура", ur: "وائرلیس ماؤس اور کی بورڈ", hi: "वायरलेस माउस और कीबोर्ड" },
  "Electric Toothbrush": { ar: "فرشاة أسنان كهربائية", es: "Cepillo de dientes eléctrico", de: "Elektrische Zahnbürste", pt: "Escova de dentes elétrica", zh: "电动牙刷", tr: "Elektrikli Diş Fırçası", fr: "Brosse à dents électrique", ru: "Электрическая зубная щетка", ur: "الیکٹرک ٹوتھ برش", hi: "इलेक्ट्रिक टूथब्रश" },
  "Air Purifier": { ar: "منقّي هواء", es: "Purificador de aire", de: "Luftreiniger", pt: "Purificador de ar", zh: "空气净化器", tr: "Hava Temizleyici", fr: "Purificateur d’air", ru: "Очиститель воздуха", ur: "ایئر پیوریفائر", hi: "एयर प्यूरीफायर" },
  "Screen Reader Pro": { ar: "قارئ شاشة احترافي", es: "Lector de pantalla Pro", de: "Screenreader Pro", pt: "Leitor de tela Pro", zh: "专业屏幕阅读器", tr: "Ekran Okuyucu Pro", fr: "Lecteur d’écran Pro", ru: "Профессиональный экранный диктор", ur: "اسکرین ریڈر پرو", hi: "स्क्रीन रीडर प्रो" },
  "Voice Control Suite": { ar: "حزمة التحكم الصوتي", es: "Suite de control por voz", de: "Sprachsteuerungs-Suite", pt: "Suíte de controle por voz", zh: "语音控制套件", tr: "Ses Kontrol Paketi", fr: "Suite de commande vocale", ru: "Пакет голосового управления", ur: "وائس کنٹرول سوٹ", hi: "वॉइस कंट्रोल सूट" },
  "Braille Display 40-Cell": { ar: "شاشة برايل 40 خلية", es: "Pantalla Braille de 40 celdas", de: "40-Zellen-Braillezeile", pt: "Linha Braille de 40 células", zh: "40 单元盲文显示器", tr: "40 Hücreli Braille Ekran", fr: "Afficheur braille 40 cellules", ru: "Брайлевский дисплей на 40 ячеек", ur: "40 سیل بریل ڈسپلے", hi: "40-सेल ब्रेल डिस्प्ले" },
  "Adaptive Keyboard": { ar: "لوحة مفاتيح تكيفية", es: "Teclado adaptativo", de: "Adaptive Tastatur", pt: "Teclado adaptativo", zh: "自适应键盘", tr: "Uyarlanabilir Klavye", fr: "Clavier adaptatif", ru: "Адаптивная клавиатура", ur: "ایڈاپٹو کی بورڈ", hi: "अनुकूलित कीबोर्ड" },
  "Switch Access Kit": { ar: "مجموعة الوصول بالمفاتيح", es: "Kit de acceso por interruptor", de: "Schalter-Zugangsset", pt: "Kit de acesso por acionador", zh: "开关访问套件", tr: "Anahtar Erişim Kiti", fr: "Kit d’accès par contacteur", ru: "Комплект доступа через переключатель", ur: "سوئچ ایکسیس کٹ", hi: "स्विच एक्सेस किट" },
  "High Contrast Theme Pack": { ar: "حزمة سمات عالية التباين", es: "Paquete de temas de alto contraste", de: "Paket mit kontrastreichen Designs", pt: "Pacote de temas de alto contraste", zh: "高对比度主题包", tr: "Yüksek Kontrast Tema Paketi", fr: "Pack de thèmes à fort contraste", ru: "Пакет высококонтрастных тем", ur: "ہائی کنٹراسٹ تھیم پیک", hi: "हाई कॉन्ट्रास्ट थीम पैक" },
  "Audio Description Toolkit": { ar: "مجموعة أدوات الوصف الصوتي", es: "Kit de descripción de audio", de: "Toolkit für Audiodeskription", pt: "Kit de descrição de áudio", zh: "音频描述工具包", tr: "Sesli Betimleme Araç Seti", fr: "Boîte à outils d’audiodescription", ru: "Набор инструментов аудиоописания", ur: "آڈیو ڈسکرپشن ٹول کٹ", hi: "ऑडियो विवरण टूलकिट" },
  "Caption Studio": { ar: "استوديو التسميات التوضيحية", es: "Estudio de subtítulos", de: "Untertitel-Studio", pt: "Estúdio de legendas", zh: "字幕工作室", tr: "Altyazı Stüdyosu", fr: "Studio de sous-titrage", ru: "Студия субтитров", ur: "کیپشن اسٹوڈیو", hi: "कैप्शन स्टूडियो" },
  "Accessibility Masterclass": { ar: "دورة احترافية في إمكانية الوصول", es: "Clase magistral de accesibilidad", de: "Masterclass Barrierefreiheit", pt: "Masterclass de acessibilidade", zh: "无障碍大师课", tr: "Erişilebilirlik Ustalık Sınıfı", fr: "Masterclass accessibilité", ru: "Мастер-класс по доступности", ur: "ایکسیسبلٹی ماسٹرکلاس", hi: "एक्सेसिबिलिटी मास्टरक्लास" },
  "Magnification Software": { ar: "برنامج التكبير", es: "Software de ampliación", de: "Vergrößerungssoftware", pt: "Software de ampliação", zh: "放大软件", tr: "Büyütme Yazılımı", fr: "Logiciel de grossissement", ru: "Программа увеличения экрана", ur: "میگنیفیکیشن سافٹ ویئر", hi: "मैग्निफिकेशन सॉफ्टवेयर" },
  "A11y Audit Package": { ar: "حزمة تدقيق إمكانية الوصول", es: "Paquete de auditoría A11y", de: "A11y-Auditpaket", pt: "Pacote de auditoria A11y", zh: "无障碍审计套餐", tr: "A11y Denetim Paketi", fr: "Forfait audit A11y", ru: "Пакет аудита доступности", ur: "A11y آڈٹ پیکج", hi: "A11y ऑडिट पैकेज" },
  "VPAT Report Service": { ar: "خدمة تقرير VPAT", es: "Servicio de informe VPAT", de: "VPAT-Berichtsservice", pt: "Serviço de relatório VPAT", zh: "VPAT 报告服务", tr: "VPAT Rapor Hizmeti", fr: "Service de rapport VPAT", ru: "Сервис отчетов VPAT", ur: "VPAT رپورٹ سروس", hi: "VPAT रिपोर्ट सेवा" },
  "Noise-cancelling earbuds with 30-hour battery, touch controls, and crystal-clear audio.": { ar: "سماعات أذن عازلة للضوضاء ببطارية تدوم 30 ساعة وتحكم باللمس وصوت فائق الوضوح.", es: "Auriculares con cancelación de ruido, batería de 30 horas, controles táctiles y audio nítido.", de: "Ohrhörer mit Geräuschunterdrückung, 30-Stunden-Akku, Touch-Steuerung und kristallklarem Klang.", pt: "Fones com cancelamento de ruído, bateria de 30 horas, controles por toque e áudio cristalino.", zh: "降噪耳机，30 小时电池续航，触控操作，音质清晰。", tr: "Gürültü engelleme, 30 saat pil, dokunmatik kontroller ve berrak ses sunan kulaklıklar.", fr: "Écouteurs antibruit avec batterie de 30 heures, commandes tactiles et son cristallin.", ru: "Наушники с шумоподавлением, батареей на 30 часов, сенсорным управлением и чистым звуком.", ur: "شور کم کرنے والے ایئربڈز، 30 گھنٹے بیٹری، ٹچ کنٹرولز اور صاف شفاف آواز کے ساتھ۔", hi: "नॉइज़-कैंसलिंग ईयरबड्स, 30 घंटे की बैटरी, टच कंट्रोल और साफ़ ऑडियो के साथ।" },
  "Adjustable color temperature and brightness with USB charging port and timer.": { ar: "درجة لون وسطوع قابلان للتعديل مع منفذ شحن USB ومؤقت.", es: "Temperatura de color y brillo ajustables con puerto de carga USB y temporizador.", de: "Einstellbare Farbtemperatur und Helligkeit mit USB-Ladeanschluss und Timer.", pt: "Temperatura de cor e brilho ajustáveis com porta USB e temporizador.", zh: "可调色温和亮度，带 USB 充电口和定时器。", tr: "USB şarj bağlantısı ve zamanlayıcı ile ayarlanabilir renk sıcaklığı ve parlaklık.", fr: "Température de couleur et luminosité réglables avec port USB et minuterie.", ru: "Регулируемая цветовая температура и яркость, USB-порт для зарядки и таймер.", ur: "USB چارجنگ پورٹ اور ٹائمر کے ساتھ رنگ درجہ حرارت اور روشنی کی شدت قابلِ تنظیم۔", hi: "USB चार्जिंग पोर्ट और टाइमर के साथ रंग तापमान और चमक समायोज्य।" },
  "Lumbar support, adjustable armrests, breathable mesh back for all-day comfort.": { ar: "دعم قطني ومساند ذراعين قابلة للتعديل وظهر شبكي مهوّى لراحة طوال اليوم.", es: "Soporte lumbar, reposabrazos ajustables y respaldo de malla transpirable para comodidad todo el día.", de: "Lendenstütze, verstellbare Armlehnen und atmungsaktiver Netzrücken für ganztägigen Komfort.", pt: "Suporte lombar, braços ajustáveis e encosto em tela respirável para conforto o dia todo.", zh: "腰部支撑、可调扶手、透气网背，全天舒适。", tr: "Bel desteği, ayarlanabilir kolçaklar ve gün boyu konfor için nefes alan file sırt.", fr: "Soutien lombaire, accoudoirs réglables et dossier en maille respirante pour un confort durable.", ru: "Поясничная поддержка, регулируемые подлокотники и дышащая сетчатая спинка для комфорта на весь день.", ur: "کمر کی سپورٹ، قابلِ تنظیم آرم ریسٹ اور پورے دن آرام کے لیے ہوادار میش بیک۔", hi: "लंबर सपोर्ट, समायोज्य आर्मरेस्ट और पूरे दिन आराम के लिए सांस लेने वाली मेश बैक।" },
  "Enterprise-grade screen reader with AI-powered page summarization and multi-language support.": { ar: "قارئ شاشة بمستوى مؤسسي مع تلخيص صفحات بالذكاء الاصطناعي ودعم متعدد اللغات.", es: "Lector de pantalla empresarial con resumen de páginas por IA y soporte multilingüe.", de: "Screenreader für Unternehmen mit KI-Seitenzusammenfassung und Mehrsprachigkeit.", pt: "Leitor de tela empresarial com resumo de páginas por IA e suporte multilíngue.", zh: "企业级屏幕阅读器，支持 AI 页面摘要和多语言。", tr: "Yapay zeka destekli sayfa özetleme ve çoklu dil desteği sunan kurumsal ekran okuyucu.", fr: "Lecteur d’écran professionnel avec résumé de page par IA et prise en charge multilingue.", ru: "Экранный диктор корпоративного уровня с AI-сводками страниц и поддержкой нескольких языков.", ur: "AI سے چلنے والی صفحہ سمری اور کثیر لسانی سپورٹ کے ساتھ انٹرپرائز گریڈ اسکرین ریڈر۔", hi: "AI पेज सारांश और बहुभाषी समर्थन वाला एंटरप्राइज़-ग्रेड स्क्रीन रीडर।" },
  "Complete hands-free computer control with custom voice commands and macro support.": { ar: "تحكم كامل بالكمبيوتر دون استخدام اليدين مع أوامر صوتية مخصصة ودعم للماكرو.", es: "Control completo del ordenador sin manos con comandos de voz personalizados y macros.", de: "Vollständige freihändige Computersteuerung mit eigenen Sprachbefehlen und Makro-Unterstützung.", pt: "Controle completo do computador sem usar as mãos com comandos de voz personalizados e macros.", zh: "完整免手动电脑控制，支持自定义语音命令和宏。", tr: "Özel ses komutları ve makro desteğiyle tam eller serbest bilgisayar kontrolü.", fr: "Contrôle complet de l’ordinateur sans les mains avec commandes vocales personnalisées et macros.", ru: "Полное управление компьютером без рук с пользовательскими голосовыми командами и макросами.", ur: "کسٹم وائس کمانڈز اور میکرو سپورٹ کے ساتھ مکمل ہینڈز فری کمپیوٹر کنٹرول۔", hi: "कस्टम वॉइस कमांड और मैक्रो सपोर्ट के साथ पूरा हैंड्स-फ्री कंप्यूटर नियंत्रण।" },
  "Absolutely love this product. It exceeded all my expectations and the quality is outstanding.": { ar: "أحببت هذا المنتج جدًا. تجاوز كل توقعاتي وجودته ممتازة.", es: "Me encanta este producto. Superó todas mis expectativas y la calidad es excelente.", de: "Ich liebe dieses Produkt. Es hat alle Erwartungen übertroffen und die Qualität ist hervorragend.", pt: "Adorei este produto. Superou minhas expectativas e a qualidade é excelente.", zh: "我非常喜欢这个产品。它超出了我的预期，质量非常出色。", tr: "Bu ürünü gerçekten sevdim. Tüm beklentilerimi aştı ve kalitesi harika.", fr: "J’adore ce produit. Il a dépassé toutes mes attentes et la qualité est excellente.", ru: "Очень люблю этот продукт. Он превзошел мои ожидания, качество отличное.", ur: "مجھے یہ پروڈکٹ بہت پسند آئی۔ یہ میری توقعات سے بڑھ کر ہے اور معیار شاندار ہے۔", hi: "मुझे यह उत्पाद बहुत पसंद है। यह मेरी उम्मीदों से बेहतर निकला और गुणवत्ता शानदार है।" },
  "Great value for money. Works exactly as described. Would recommend to others.": { ar: "قيمة ممتازة مقابل السعر. يعمل تمامًا كما هو موصوف. أوصي به للآخرين.", es: "Gran relación calidad-precio. Funciona exactamente como se describe. Lo recomendaría.", de: "Sehr gutes Preis-Leistungs-Verhältnis. Funktioniert genau wie beschrieben. Empfehlenswert.", pt: "Ótimo custo-benefício. Funciona exatamente como descrito. Recomendo.", zh: "性价比很高。完全符合描述。会推荐给其他人。", tr: "Parasına göre çok iyi. Tam anlatıldığı gibi çalışıyor. Tavsiye ederim.", fr: "Excellent rapport qualité-prix. Fonctionne exactement comme décrit. Je le recommande.", ru: "Отличное соотношение цены и качества. Работает как описано. Рекомендую.", ur: "قیمت کے لحاظ سے بہترین۔ بالکل بیان کے مطابق کام کرتا ہے۔ دوسروں کو تجویز کروں گا۔", hi: "पैसे के हिसाब से बढ़िया। जैसा बताया गया वैसा ही काम करता है। सिफारिश करूँगा।" },
  "This has made such a difference in my daily workflow. Couldn't be happier with my purchase.": { ar: "أحدث فرقًا كبيرًا في سير عملي اليومي. أنا راضٍ جدًا عن الشراء.", es: "Ha marcado una gran diferencia en mi flujo de trabajo diario. Estoy muy satisfecho con la compra.", de: "Es macht in meinem täglichen Arbeitsablauf einen großen Unterschied. Ich bin sehr zufrieden.", pt: "Fez muita diferença no meu fluxo diário. Estou muito satisfeito com a compra.", zh: "它极大改善了我的日常工作流程。我对这次购买非常满意。", tr: "Günlük iş akışımda büyük fark yarattı. Satın aldığıma çok memnunum.", fr: "Cela a beaucoup amélioré mon travail quotidien. Je suis ravi de mon achat.", ru: "Это сильно улучшило мой ежедневный рабочий процесс. Очень доволен покупкой.", ur: "اس نے میرے روزمرہ کام کے بہاؤ میں بڑا فرق ڈالا۔ خریداری سے بہت خوش ہوں۔", hi: "इसने मेरे दैनिक काम में बड़ा फर्क किया है। खरीद से बहुत खुश हूँ।" },
  "Solid build quality and easy to set up. Minor learning curve but well worth it.": { ar: "جودة تصنيع قوية وسهل الإعداد. يحتاج قليلًا للتعلم لكنه يستحق.", es: "Construcción sólida y configuración sencilla. Requiere aprender un poco, pero vale la pena.", de: "Solide Verarbeitung und einfache Einrichtung. Kleine Lernkurve, aber lohnenswert.", pt: "Construção sólida e fácil de configurar. Pequena curva de aprendizado, mas vale a pena.", zh: "做工扎实，设置简单。需要一点学习，但很值得。", tr: "Sağlam yapı kalitesi ve kolay kurulum. Küçük bir öğrenme süreci var ama değer.", fr: "Bonne qualité de fabrication et installation facile. Petite prise en main, mais cela vaut la peine.", ru: "Хорошая сборка и простая настройка. Нужно немного привыкнуть, но оно того стоит.", ur: "مضبوط معیار اور آسان سیٹ اپ۔ تھوڑا سیکھنا پڑتا ہے مگر فائدہ مند ہے۔", hi: "मजबूत निर्माण और सेटअप आसान। थोड़ा सीखना पड़ता है, लेकिन पूरी तरह योग्य है।" },
  "Exceptional product! The attention to detail and accessibility features are truly impressive.": { ar: "منتج استثنائي! الاهتمام بالتفاصيل وميزات إمكانية الوصول مبهرة حقًا.", es: "¡Producto excepcional! La atención al detalle y las funciones de accesibilidad impresionan.", de: "Außergewöhnliches Produkt! Details und Barrierefreiheitsfunktionen sind beeindruckend.", pt: "Produto excepcional! A atenção aos detalhes e os recursos de acessibilidade impressionam.", zh: "出色的产品！对细节的关注和无障碍功能令人印象深刻。", tr: "Olağanüstü ürün! Ayrıntılar ve erişilebilirlik özellikleri gerçekten etkileyici.", fr: "Produit exceptionnel ! Le souci du détail et les fonctions d’accessibilité sont impressionnants.", ru: "Исключительный продукт! Внимание к деталям и функции доступности впечатляют.", ur: "غیر معمولی پروڈکٹ! تفصیل پر توجہ اور ایکسیسبلٹی خصوصیات واقعی متاثر کن ہیں۔", hi: "असाधारण उत्पाद! विवरण और एक्सेसिबिलिटी सुविधाएँ सच में प्रभावशाली हैं।" },
};

// Sorted entries array type — pre-computed once per language change
type SortedEntries = [string, string][];

function buildDomTranslationMap(lang: Lang): { map: Map<string, string>; sorted: SortedEntries } {
  const map = new Map<string, string>();
  if (lang === "en") return { map, sorted: [] };

  // Only commonDomText (≈60 entries) for DOM walking — React handles the rest via t().
  for (const [englishValue, localized] of Object.entries(commonDomText)) {
    const translatedValue = localized[lang];
    if (translatedValue) map.set(englishValue, translatedValue);
  }

  // Sort ONCE here — longest match first, skip short keys.
  // Previously this was done on every translateDomValue() call (O(N log N) per text node).
  const sorted: SortedEntries = [...map.entries()]
    .filter(([k]) => k.length >= 3)
    .sort((a, b) => b[0].length - a[0].length);

  return { map, sorted };
}

function translateDomValue(value: string, map: Map<string, string>, sorted: SortedEntries) {
  const exact = map.get(value.trim());
  if (exact) return value.replace(value.trim(), exact);

  if (sorted.length === 0) return null;

  let translated = value;
  for (const [englishValue, translatedValue] of sorted) {
    translated = translated.replaceAll(englishValue, translatedValue);
  }

  return translated === value ? null : translated;
}

function translateStaticDomText(lang: Lang) {
  if (typeof document === "undefined" || !document.body) return () => {};

  const { map: translationMap, sorted: sortedEntries } = buildDomTranslationMap(lang);
  const attributes = ["aria-label", "title", "placeholder", "alt"];
  const ignoredTags = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);

  const translateTextNode = (node: Text) => {
    const parent = node.parentElement;
    if (!parent || ignoredTags.has(parent.tagName)) return;

    const original = originalTextNodes.get(node) ?? node.nodeValue ?? "";
    if (!originalTextNodes.has(node)) originalTextNodes.set(node, original);

    if (lang === "en") {
      node.nodeValue = original;
      return;
    }

    const trimmed = original.trim();
    const translated = translateDomValue(trimmed, translationMap, sortedEntries);
    if (!translated) return;

    const prefix = original.match(/^\s*/)?.[0] ?? "";
    const suffix = original.match(/\s*$/)?.[0] ?? "";
    node.nodeValue = `${prefix}${translated}${suffix}`;
  };

  const translateElementAttributes = (element: Element) => {
    if (ignoredTags.has(element.tagName)) return;

    for (const attr of attributes) {
      const current = element.getAttribute(attr);
      if (!current) continue;

      let originals = originalAttributes.get(element);
      if (!originals) {
        originals = new Map();
        originalAttributes.set(element, originals);
      }
      if (!originals.has(attr)) originals.set(attr, current);

      const original = originals.get(attr) ?? current;
      if (lang === "en") {
        if (current !== original) element.setAttribute(attr, original);
        continue;
      }

      const translated = translateDomValue(original, translationMap, sortedEntries);
      if (translated && current !== translated) element.setAttribute(attr, translated);
    }
  };

  const translateNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    translateElementAttributes(element);

    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      translateTextNode(textNode as Text);
      textNode = walker.nextNode();
    }

    element.querySelectorAll("*").forEach(translateElementAttributes);
  };

  // Defer initial DOM walk so it doesn't block the first paint.
  const idle = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : setTimeout;
  const handle = idle(() => translateNode(document.body));

  // English needs no ongoing observer — the initial walk above already restores
  // any previously-translated nodes. Skipping the observer eliminates the biggest
  // source of unnecessary DOM work for the majority of English-language users.
  if (lang === "en") {
    return () => {
      if (typeof requestIdleCallback !== "undefined") cancelIdleCallback(handle as number);
      else clearTimeout(handle as number);
    };
  }

  let rafPending = false;
  const pendingNodes = new Set<Node>();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((n) => pendingNodes.add(n));
      if (mutation.type === "attributes" && mutation.target instanceof Element) {
        pendingNodes.add(mutation.target);
      }
    }
    // Batch all mutations into a single rAF to avoid cascading work.
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(() => {
        const nodes = [...pendingNodes];
        pendingNodes.clear();
        for (const n of nodes) translateNode(n);
        rafPending = false;
      });
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: attributes,
  });

  return () => {
    if (typeof requestIdleCallback !== "undefined") cancelIdleCallback(handle as number);
    else clearTimeout(handle as number);
    observer.disconnect();
  };
}

function detectBrowserLang(): Lang {
  try {
    const browserLangs = navigator.languages || [navigator.language];
    for (const bl of browserLangs) {
      const code = bl.split("-")[0].toLowerCase();
      if (supportedLangs.includes(code as Lang)) {
        return code as Lang;
      }
    }
  } catch {
    // SSR or no navigator
  }
  return "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const initialLang: Lang = (() => {
    const saved = safeGetStoredLang();
    if (saved) return saved;
    return detectBrowserLang();
  })();

  const [lang, setLangState] = useState<Lang>(initialLang);
  // Tracks whether the current language's file has been loaded.
  const [langReady, setLangReady] = useState(false);

  const dir = rtlLangs.includes(lang) ? "rtl" : "ltr";

  // Load the language file on demand when lang changes.
  // English is now also lazily loaded (saves ~242 KB from the main bundle).
  // On failure (e.g. network error or corrupt bundle) we silently fall back so
  // the page still renders instead of hanging on a spinner forever.
  useEffect(() => {
    setLangReady(false);
    loadLang(lang)
      .then(() => setLangReady(true))
      .catch((err) => {
        console.error(`[i18n] Failed to load language "${lang}":`, err);
        setLangReady(true); // surface whatever is loaded rather than hanging
      });
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    safeSetStoredLang(lang);
  }, [lang, dir]);

  useEffect(() => {
    if (!langReady) return;
    return translateStaticDomText(lang);
  }, [lang, langReady]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      // Try current language first, fall back to English, then the key itself
      const dict = loadedTranslations[lang];
      if (dict?.[key]) return dict[key];
      const enDict = loadedTranslations["en"];
      return enDict?.[key] ?? key;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, langReady]
  );

  const translateText = useCallback(
    (text: string): string => {
      if (!text || lang === "en") return text;
      const { map, sorted } = buildDomTranslationMap(lang);
      return translateDomValue(text, map, sorted) ?? text;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, translateText, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}
