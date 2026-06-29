/**
 * news-generate — Daily AI news generation + newsletter dispatch
 *
 * Auth: Bearer CRON_SECRET
 *
 * Flow:
 *  1. Generate 18 articles (one per category) in English + Arabic via one AI call
 *  2. Insert into news_articles with translations JSONB column
 *  3. Send personalised digest emails to newsletter subscribers via Resend
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface ArticleLang {
  title: string;
  description: string;
  content: string;
}

interface GeneratedArticle {
  category: CategoryKey;
  en: ArticleLang;
  ar: ArticleLang;
}

// ── AI Generation ─────────────────────────────────────────────────────────────

async function generateArticles(dateEn: string): Promise<GeneratedArticle[]> {
  const categoryList = CATEGORIES
    .map((c) => `"${c.key}": ${c.nameEn} / ${c.nameAr}`)
    .join("\n");

  const prompt = `You are a professional news editor for Visionex, a multilingual tech platform. Today is ${dateEn}.

Write one news article per category, in BOTH English and Arabic.

Categories:
${categoryList}

Requirements:
- Each article should reflect real recent trends or developments in that field
- Neutral, informative, journalistic tone
- English: natural professional English
- Arabic: Modern Standard Arabic (فصحى سلسة)

Return ONLY a JSON object in this exact shape:
{
  "articles": [
    {
      "category": "technology",
      "en": {
        "title": "Article title in English (5-10 words)",
        "description": "One or two sentence summary in English (15-30 words)",
        "content": "Full article body in English, 2-3 paragraphs (120-200 words)"
      },
      "ar": {
        "title": "عنوان المقال بالعربية (5-10 كلمات)",
        "description": "ملخص في جملة أو جملتين بالعربية (15-30 كلمة)",
        "content": "نص المقال الكامل بالعربية، فقرتان أو ثلاث (120-200 كلمة)"
      }
    }
  ]
}

Write one article for each of the 18 categories listed above.`;

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 16000,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return JSON.parse(data.choices[0].message.content).articles ?? [];
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string = data.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in Anthropic response");
    return JSON.parse(match[0]).articles ?? [];
  }

  throw new Error("No AI API key — set OPENAI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets");
}

// ── Email Builder ─────────────────────────────────────────────────────────────

function buildDigestEmail(
  articles: GeneratedArticle[],
  lang: "ar" | "en",
  dateStr: string,
): string {
  const isRtl = lang === "ar";
  const dir = isRtl ? "rtl" : "ltr";

  const header = lang === "ar"
    ? { title: "النشرة الإخبارية اليومية", intro: "إليك أبرز أخبار اليوم المختارة لك:", cta: "قراءة كل الأخبار" }
    : { title: "Daily News Digest", intro: "Here are today's top stories selected for you:", cta: "Read all news" };

  const articlesHtml = articles.map((a) => {
    const t = a[lang];
    const cat = CATEGORIES.find((c) => c.key === a.category);
    const catName = lang === "ar" ? (cat?.nameAr ?? a.category) : (cat?.nameEn ?? a.category);
    const accent = isRtl ? "border-right:4px solid #6d28d9" : "border-left:4px solid #6d28d9";
    return `
      <div style="margin-bottom:24px;padding:20px;border:1px solid #e5e7eb;border-radius:10px;${accent}">
        <p style="margin:0 0 4px;font-size:11px;color:#6d28d9;font-weight:700;text-transform:uppercase">${catName}</p>
        <h2 style="margin:0 0 8px;font-size:17px;color:#111827;font-weight:700;line-height:1.4">${t.title}</h2>
        <p style="margin:0 0 10px;color:#4b5563;font-size:14px;line-height:1.65">${t.description}</p>
        <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.7">${t.content.substring(0, 280)}...</p>
      </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:620px;margin:auto">
    <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0">
      <div style="font-size:44px">📰</div>
      <h1 style="color:#fff;margin:12px 0 4px;font-size:22px;font-weight:800">${header.title}</h1>
      <p style="color:#c4b5fd;margin:0;font-size:14px">${dateStr} · Visionex</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
      <p style="color:#374151;font-size:15px;margin:0 0 24px">${header.intro}</p>
      ${articlesHtml}
      <div style="margin-top:28px;text-align:center">
        <a href="https://visionex.app/news" style="background:#6d28d9;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">${header.cta}</a>
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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const dateEn = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const dateAr = now.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  // ── 1. Generate bilingual articles ────────────────────────────────────────
  let generated: GeneratedArticle[];
  try {
    generated = await generateArticles(dateEn);
  } catch (err) {
    console.error("[news-generate] AI error:", err);
    return Response.json({ error: "AI generation failed", details: String(err) }, { status: 500, headers: CORS });
  }

  // Validate + build DB rows
  const rows = generated
    .filter((a) => CATEGORIES.some((c) => c.key === a.category) && a.en?.title && a.ar?.title)
    .map((a) => {
      const cat = CATEGORIES.find((c) => c.key === a.category)!;
      return {
        // Primary columns use English as canonical (frontend reads from translations)
        title:        a.en.title.trim(),
        description:  a.en.description.trim(),
        content:      a.en.content.trim(),
        category:     a.category,
        icon_name:    cat.icon,
        published:    true,
        published_at: now.toISOString(),
        // Bilingual translations stored as JSONB
        translations: {
          en: { title: a.en.title.trim(), description: a.en.description.trim(), content: a.en.content.trim() },
          ar: { title: a.ar.title.trim(), description: a.ar.description.trim(), content: a.ar.content.trim() },
        },
      };
    });

  if (rows.length === 0) {
    return Response.json({ error: "AI returned no valid articles" }, { status: 500, headers: CORS });
  }

  // ── 2. Insert into DB ─────────────────────────────────────────────────────
  const { error: insertErr } = await supabase.from("news_articles").insert(rows);
  if (insertErr) {
    console.error("[news-generate] insert error:", insertErr);
    return Response.json({ error: "DB insert failed", details: insertErr.message }, { status: 500, headers: CORS });
  }
  console.log(`[news-generate] inserted ${rows.length} bilingual articles`);

  // ── 3. Send newsletter digests ────────────────────────────────────────────
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
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const sub of subscribers) {
    const subTopics: string[] = sub.topics ?? [];
    const subLang: "ar" | "en" = (sub.lang === "en") ? "en" : "ar";

    const subCategories = subTopics
      .filter((t) => t.startsWith("news-"))
      .map((t) => t.replace("news-", ""));

    const relevantArticles = subCategories.length === 0
      ? generated.filter((a) => CATEGORIES.some((c) => c.key === a.category))
      : generated.filter((a) => subCategories.includes(a.category));

    if (relevantArticles.length === 0) continue;

    const html = buildDigestEmail(relevantArticles, subLang, subLang === "ar" ? dateAr : dateEn);
    const subject = subLang === "ar"
      ? `📰 أخبار Visionex اليومية — ${dateAr}`
      : `📰 Visionex Daily News — ${dateEn}`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [sub.email], subject, html }),
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
