/**
 * news-generate — Daily AI news generation + newsletter dispatch
 *
 * Auth: Bearer CRON_SECRET
 *
 * Flow:
 *  1. Call 1 — Generate 18 articles in English + Arabic (full: title, description, content)
 *  2. Call 2 — Translate title + description to 9 more languages (es,de,pt,zh,tr,fr,ru,ur,hi)
 *  3. Merge into translations JSONB and insert into news_articles
 *  4. Send personalised digest to newsletter_subscribers in their language via Resend
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  { key: "technology",    nameEn: "Technology & Innovation",    nameAr: "التكنولوجيا والابتكار",    icon: "Cpu" },
  { key: "ai",            nameEn: "Artificial Intelligence",    nameAr: "الذكاء الاصطناعي",         icon: "Brain" },
  { key: "marketplace",   nameEn: "E-Commerce & Marketplace",   nameAr: "التجارة الإلكترونية",       icon: "ShoppingBag" },
  { key: "games",         nameEn: "Games & Entertainment",      nameAr: "الألعاب والترفيه",         icon: "Gamepad2" },
  { key: "academy",       nameEn: "Education & Training",       nameAr: "التعليم والتدريب",         icon: "GraduationCap" },
  { key: "health",        nameEn: "Health & Medicine",          nameAr: "الصحة والطب",              icon: "Heart" },
  { key: "legal",         nameEn: "Law & Rights",               nameAr: "القانون والحقوق",          icon: "Scale" },
  { key: "business",      nameEn: "Business & Economy",         nameAr: "الأعمال والاقتصاد",        icon: "TrendingUp" },
  { key: "travel",        nameEn: "Travel & Tourism",           nameAr: "السفر والسياحة",           icon: "Plane" },
  { key: "beauty",        nameEn: "Beauty & Lifestyle",         nameAr: "الجمال وأسلوب الحياة",     icon: "Sparkles" },
  { key: "sports",        nameEn: "Sports & Fitness",           nameAr: "الرياضة واللياقة",         icon: "Trophy" },
  { key: "music",         nameEn: "Music & Arts",               nameAr: "الموسيقى والفنون",         icon: "Music" },
  { key: "psychology",    nameEn: "Psychology & Mental Health", nameAr: "الصحة النفسية",            icon: "SmilePlus" },
  { key: "community",     nameEn: "Community & Social",         nameAr: "المجتمع والتواصل",         icon: "Globe" },
  { key: "accessibility", nameEn: "Accessibility",              nameAr: "إمكانية الوصول",           icon: "Accessibility" },
  { key: "platform",      nameEn: "Platform Updates",           nameAr: "تحديثات المنصة",           icon: "Rocket" },
  { key: "entertainment", nameEn: "Live TV & Radio",            nameAr: "البث المباشر والترفيه",     icon: "Tv" },
  { key: "nutrition",     nameEn: "Nutrition & Wellness",       nameAr: "التغذية والعافية",          icon: "Apple" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];
type SupportedLang = "en" | "ar" | "es" | "de" | "pt" | "zh" | "tr" | "fr" | "ru" | "ur" | "hi";

const RTL_LANGS: SupportedLang[] = ["ar", "ur"];

interface ArticleFull  { title: string; description: string; content: string }
interface ArticleShort { title: string; description: string }

type TranslationMap = {
  en: ArticleFull;
  ar: ArticleFull;
} & Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>;

interface GeneratedArticle {
  category: CategoryKey;
  translations: TranslationMap;
}

// ── Email static strings per language ────────────────────────────────────────

const EMAIL_STRINGS: Record<SupportedLang, { title: string; intro: string; cta: string }> = {
  en: { title: "Daily News Digest",          intro: "Here are today's top stories selected for you:",         cta: "Read all news" },
  ar: { title: "النشرة الإخبارية اليومية",  intro: "إليك أبرز أخبار اليوم المختارة لك:",                    cta: "قراءة كل الأخبار" },
  es: { title: "Resumen diario de noticias", intro: "Aquí están las principales noticias de hoy para ti:",    cta: "Leer todas las noticias" },
  de: { title: "Tägliche Nachrichtenübersicht", intro: "Hier sind die Top-Nachrichten des Tages für dich:",   cta: "Alle Nachrichten lesen" },
  pt: { title: "Resumo diário de notícias",  intro: "Aqui estão as principais notícias de hoje para você:",  cta: "Ler todas as notícias" },
  zh: { title: "每日新闻摘要",                intro: "以下是今天为您精选的热点新闻：",                          cta: "阅读所有新闻" },
  tr: { title: "Günlük Haber Özeti",         intro: "İşte bugün sizin için seçilen önemli haberler:",         cta: "Tüm haberleri oku" },
  fr: { title: "Résumé quotidien des actualités", intro: "Voici les principales actualités du jour pour vous:", cta: "Lire toutes les actualités" },
  ru: { title: "Ежедневный дайджест новостей", intro: "Вот главные новости дня, выбранные для вас:",          cta: "Читать все новости" },
  ur: { title: "روزانہ خبروں کا خلاصہ",     intro: "آج کی اہم خبریں جو آپ کے لیے منتخب کی گئی ہیں:",      cta: "تمام خبریں پڑھیں" },
  hi: { title: "दैनिक समाचार सारांश",        intro: "आज की शीर्ष खबरें जो आपके लिए चुनी गई हैं:",          cta: "सभी समाचार पढ़ें" },
};

// ── AI Call 1: Generate en + ar (full articles) ───────────────────────────────

async function generateEnAr(dateEn: string): Promise<Array<{ category: CategoryKey; en: ArticleFull; ar: ArticleFull }>> {
  const categoryList = CATEGORIES.map((c) => `"${c.key}": ${c.nameEn} / ${c.nameAr}`).join("\n");

  const prompt = `You are a professional news editor for Visionex, a multilingual tech platform. Today is ${dateEn}.

Write one informative news article per category in BOTH English and Arabic.

Categories:
${categoryList}

Return ONLY this JSON (no extra text):
{
  "articles": [
    {
      "category": "technology",
      "en": { "title": "5-10 word title", "description": "15-30 word summary", "content": "2-3 paragraph article body, 120-200 words" },
      "ar": { "title": "عنوان 5-10 كلمات", "description": "ملخص 15-30 كلمة", "content": "نص المقال فقرتان أو ثلاث، 120-200 كلمة" }
    }
  ]
}

Write one article for each of the 18 categories. Journalistic, neutral, informative tone.`;

  return await aiCall(prompt, 16000);
}

// ── AI Call 2: Translate title + description to 9 languages ──────────────────

async function translateToOtherLangs(
  articles: Array<{ category: CategoryKey; en: ArticleFull }>,
): Promise<Record<CategoryKey, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>>> {
  const input = articles.map((a) => ({
    category: a.category,
    title: a.en.title,
    description: a.en.description,
  }));

  const prompt = `Translate the following 18 news article titles and descriptions from English into these 9 languages:
- es (Spanish), de (German), pt (Portuguese), zh (Chinese Simplified),
  tr (Turkish), fr (French), ru (Russian), ur (Urdu), hi (Hindi)

Articles:
${JSON.stringify(input)}

Return ONLY this JSON (no extra text):
{
  "translations": [
    {
      "category": "technology",
      "es": { "title": "...", "description": "..." },
      "de": { "title": "...", "description": "..." },
      "pt": { "title": "...", "description": "..." },
      "zh": { "title": "...", "description": "..." },
      "tr": { "title": "...", "description": "..." },
      "fr": { "title": "...", "description": "..." },
      "ru": { "title": "...", "description": "..." },
      "ur": { "title": "...", "description": "..." },
      "hi": { "title": "...", "description": "..." }
    }
  ]
}`;

  const result = await aiCall(prompt, 12000);
  // Build a map: category → { es: {...}, de: {...}, ... }
  const map: Record<string, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>> = {};
  for (const row of result) {
    map[row.category] = row;
    delete (map[row.category] as Record<string, unknown>)["category"];
  }
  return map as Record<CategoryKey, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>>;
}

// ── Generic AI caller ─────────────────────────────────────────────────────────

async function aiCall(prompt: string, maxTokens: number): Promise<// deno-lint-ignore no-explicit-any
any[]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: maxTokens,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    // Return whichever top-level array exists
    return parsed.articles ?? parsed.translations ?? [];
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string = data.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON in Anthropic response");
    const parsed = JSON.parse(match[0]);
    return parsed.articles ?? parsed.translations ?? [];
  }

  throw new Error("No AI API key — set OPENAI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets");
}

// ── Email Builder ─────────────────────────────────────────────────────────────

function buildDigestEmail(
  articles: GeneratedArticle[],
  lang: SupportedLang,
  dateStr: string,
): string {
  const isRtl = RTL_LANGS.includes(lang);
  const dir = isRtl ? "rtl" : "ltr";
  const str = EMAIL_STRINGS[lang] ?? EMAIL_STRINGS.en;

  const articlesHtml = articles.map((a) => {
    const tr = a.translations[lang] ?? a.translations.en;
    const cat = CATEGORIES.find((c) => c.key === a.category);
    const catName = lang === "ar" ? (cat?.nameAr ?? a.category) : (cat?.nameEn ?? a.category);
    const accent = isRtl ? "border-right:4px solid #6d28d9" : "border-left:4px solid #6d28d9";
    return `
      <div style="margin-bottom:24px;padding:20px;border:1px solid #e5e7eb;border-radius:10px;${accent}">
        <p style="margin:0 0 4px;font-size:11px;color:#6d28d9;font-weight:700;text-transform:uppercase">${catName}</p>
        <h2 style="margin:0 0 8px;font-size:17px;color:#111827;font-weight:700;line-height:1.4">${tr.title}</h2>
        <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.65">${tr.description}</p>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:620px;margin:auto">
    <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0">
      <div style="font-size:44px">📰</div>
      <h1 style="color:#fff;margin:12px 0 4px;font-size:22px;font-weight:800">${str.title}</h1>
      <p style="color:#c4b5fd;margin:0;font-size:14px">${dateStr} · Visionex</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
      <p style="color:#374151;font-size:15px;margin:0 0 24px">${str.intro}</p>
      ${articlesHtml}
      <div style="margin-top:28px;text-align:center">
        <a href="https://visionex.app/news" style="background:#6d28d9;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">${str.cta}</a>
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px">
        <p style="margin:0">© 2026 <a href="https://visionex.app" style="color:#6d28d9;text-decoration:none">Visionex</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const cronSecret = Deno.env.get("CRON_SECRET");
  const auth = req.headers.get("Authorization");
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const dateEn = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dateAr = now.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  // newsletter_only=true: skip generation, just send emails for today's articles
  const url = new URL(req.url);
  const newsletterOnly = url.searchParams.get("newsletter_only") === "true";

  let articles: GeneratedArticle[] = [];

  if (!newsletterOnly) {
    // ── 1. Generate en + ar (full articles) ──────────────────────────────────
    let enArArticles: Awaited<ReturnType<typeof generateEnAr>>;
    try {
      enArArticles = await generateEnAr(dateEn);
    } catch (err) {
      console.error("[news-generate] Call 1 failed:", err);
      return Response.json({ error: "AI generation failed", details: String(err) }, { status: 500, headers: CORS });
    }

    const validEnAr = enArArticles.filter(
      (a) => CATEGORIES.some((c) => c.key === a.category) && a.en?.title && a.ar?.title,
    );

    if (validEnAr.length === 0) {
      return Response.json({ error: "AI returned no valid articles" }, { status: 500, headers: CORS });
    }

    // ── 2. Translate title + description to 9 more languages ─────────────────
    let extraTranslations: Record<CategoryKey, Partial<Record<Exclude<SupportedLang, "en" | "ar">, ArticleShort>>> = {} as never;
    try {
      extraTranslations = await translateToOtherLangs(validEnAr);
    } catch (err) {
      console.warn("[news-generate] Call 2 (translations) failed, continuing without extra langs:", err);
    }

    // ── 3. Merge into final articles ──────────────────────────────────────────
    articles = validEnAr.map((a) => ({
      category: a.category,
      translations: {
        en: a.en,
        ar: a.ar,
        ...(extraTranslations[a.category] ?? {}),
      } as TranslationMap,
    }));

    // ── 4. Build DB rows ───────────────────────────────────────────────────────
    const rows = articles.map((a) => ({
      title:        a.translations.en.title,
      description:  a.translations.en.description,
      content:      a.translations.en.content,
      category:     a.category,
      icon_name:    CATEGORIES.find((c) => c.key === a.category)!.icon,
      published:    true,
      published_at: now.toISOString(),
      translations: a.translations,
    }));

    const { error: insertErr } = await supabase.from("news_articles").insert(rows);
    if (insertErr) {
      console.error("[news-generate] insert error:", insertErr);
      return Response.json({ error: "DB insert failed", details: insertErr.message }, { status: 500, headers: CORS });
    }
    console.log(`[news-generate] inserted ${rows.length} articles in 11 languages`);
  } else {
    // Fetch today's articles from DB for newsletter
    const today = now.toISOString().split("T")[0];
    const { data: todayArticles } = await supabase
      .from("news_articles")
      .select("category, translations")
      .gte("published_at", `${today}T00:00:00Z`)
      .eq("published", true);

    if (!todayArticles?.length) {
      return Response.json({ emailsSent: 0, note: "No articles found for today" }, { headers: CORS });
    }

    articles = todayArticles.map((row) => ({
      category: row.category as CategoryKey,
      translations: row.translations as TranslationMap,
    }));
  }

  // ── 5. Send newsletter digests ────────────────────────────────────────────
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return Response.json({ generated: rows.length, emailsSent: 0, note: "RESEND_API_KEY not configured" }, { headers: CORS });
  }

  const { data: subscribers } = await supabase
    .from("newsletter_subscribers")
    .select("email, topics, lang");

  if (!subscribers?.length) {
    return Response.json({ generated: rows.length, emailsSent: 0 }, { headers: CORS });
  }

  const FROM = Deno.env.get("RESEND_FROM") ?? "Visionex News <news@visionex.app>";
  const EMAIL_SUBJECTS: Record<SupportedLang, string> = {
    en: `📰 Visionex Daily News — ${dateEn}`,
    ar: `📰 أخبار Visionex اليومية — ${dateAr}`,
    es: `📰 Noticias diarias de Visionex — ${dateEn}`,
    de: `📰 Visionex Tagesnachrichten — ${dateEn}`,
    pt: `📰 Notícias diárias da Visionex — ${dateEn}`,
    zh: `📰 Visionex 每日新闻 — ${dateEn}`,
    tr: `📰 Visionex Günlük Haberler — ${dateEn}`,
    fr: `📰 Actualités quotidiennes Visionex — ${dateEn}`,
    ru: `📰 Ежедневные новости Visionex — ${dateEn}`,
    ur: `📰 Visionex روزانہ خبریں — ${dateAr}`,
    hi: `📰 Visionex दैनिक समाचार — ${dateEn}`,
  };

  let emailsSent = 0;
  let emailsFailed = 0;

  for (const sub of subscribers) {
    const subTopics: string[] = sub.topics ?? [];
    const subLang: SupportedLang = (sub.lang in EMAIL_STRINGS) ? sub.lang as SupportedLang : "ar";

    const subCategories = subTopics
      .filter((t) => t.startsWith("news-"))
      .map((t) => t.replace("news-", ""));

    const relevantArticles = subCategories.length === 0
      ? articles
      : articles.filter((a) => subCategories.includes(a.category));

    if (relevantArticles.length === 0) continue;

    const dateStr = subLang === "ar" || subLang === "ur" ? dateAr : dateEn;
    const html = buildDigestEmail(relevantArticles, subLang, dateStr);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [sub.email],
          subject: EMAIL_SUBJECTS[subLang] ?? EMAIL_SUBJECTS.en,
          html,
        }),
      });
      if (res.ok) emailsSent++;
      else emailsFailed++;
    } catch {
      emailsFailed++;
    }
  }

  console.log(`[news-generate] emails sent=${emailsSent} failed=${emailsFailed}`);
  return Response.json({ generated: rows.length, emailsSent, emailsFailed, date: now.toISOString().split("T")[0] }, { headers: CORS });
});
