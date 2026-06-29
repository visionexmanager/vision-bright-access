/**
 * news-generate — Daily AI news generation + newsletter dispatch
 *
 * Called once per day via GitHub Actions cron.
 * Auth: Bearer CRON_SECRET (no user session needed).
 *
 * Flow:
 *  1. Generate one article per category using OpenAI or Anthropic
 *  2. Insert articles into news_articles (published = true)
 *  3. Fetch newsletter_subscribers and send a personalised digest via Resend
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  { key: "technology",    nameAr: "التكنولوجيا والابتكار",       icon: "Cpu" },
  { key: "ai",            nameAr: "الذكاء الاصطناعي",            icon: "Brain" },
  { key: "marketplace",   nameAr: "التجارة الإلكترونية",          icon: "ShoppingBag" },
  { key: "games",         nameAr: "الألعاب والترفيه",            icon: "Gamepad2" },
  { key: "academy",       nameAr: "التعليم والتدريب",            icon: "GraduationCap" },
  { key: "health",        nameAr: "الصحة والطب",                 icon: "Heart" },
  { key: "legal",         nameAr: "القانون والحقوق",             icon: "Scale" },
  { key: "business",      nameAr: "الأعمال والاقتصاد",           icon: "TrendingUp" },
  { key: "travel",        nameAr: "السفر والسياحة",              icon: "Plane" },
  { key: "beauty",        nameAr: "الجمال وأسلوب الحياة",        icon: "Sparkles" },
  { key: "sports",        nameAr: "الرياضة واللياقة",            icon: "Trophy" },
  { key: "music",         nameAr: "الموسيقى والفنون",            icon: "Music" },
  { key: "psychology",    nameAr: "الصحة النفسية",               icon: "SmilePlus" },
  { key: "community",     nameAr: "المجتمع والتواصل",            icon: "Globe" },
  { key: "accessibility", nameAr: "إمكانية الوصول",              icon: "Accessibility" },
  { key: "platform",      nameAr: "تحديثات المنصة",              icon: "Rocket" },
  { key: "entertainment", nameAr: "البث المباشر والترفيه",        icon: "Tv" },
  { key: "nutrition",     nameAr: "التغذية والعافية",             icon: "Apple" },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

interface GeneratedArticle {
  category: CategoryKey;
  title: string;
  description: string;
  content: string;
}

// ── AI Generation ────────────────────────────────────────────────────────────

async function generateArticles(dateAr: string): Promise<GeneratedArticle[]> {
  const categoryList = CATEGORIES
    .map((c) => `"${c.key}": ${c.nameAr}`)
    .join("\n");

  const prompt = `أنت محرر أخبار احترافي لمنصة Visionex التقنية العربية. اليوم هو ${dateAr}.

اكتب خبراً يومياً لكل فئة من الفئات التالية. يجب أن يكون كل خبر:
- واقعياً ومعلوماتياً يعكس آخر التطورات في هذا المجال
- مكتوباً بالعربية الفصحى السلسة
- محايداً وإخبارياً

الفئات:
${categoryList}

أعد JSON object بهذا الشكل فقط:
{
  "articles": [
    {
      "category": "technology",
      "title": "عنوان الخبر (25-50 حرف)",
      "description": "ملخص الخبر في جملة أو جملتين (80-150 حرف)",
      "content": "نص الخبر المفصّل في فقرتين أو ثلاث (150-250 كلمة)"
    }
  ]
}

اكتب مقالاً لكل فئة من الـ 18 فئة المذكورة.`;

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 10000,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    return parsed.articles ?? [];
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
        max_tokens: 10000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string = data.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found in Anthropic response");
    const parsed = JSON.parse(match[0]);
    return parsed.articles ?? [];
  }

  throw new Error("No AI API key configured — set OPENAI_API_KEY or ANTHROPIC_API_KEY in Supabase secrets");
}

// ── Email Builder ─────────────────────────────────────────────────────────────

function buildDigestEmail(
  articles: GeneratedArticle[],
  dateAr: string,
): string {
  const articlesHtml = articles
    .map((a) => {
      const cat = CATEGORIES.find((c) => c.key === a.category);
      return `
        <div style="margin-bottom:24px;padding:20px;border:1px solid #e5e7eb;border-radius:10px;border-right:4px solid #6d28d9">
          <p style="margin:0 0 4px;font-size:11px;color:#6d28d9;font-weight:700;text-transform:uppercase;letter-spacing:.5px">
            ${cat?.nameAr ?? a.category}
          </p>
          <h2 style="margin:0 0 8px;font-size:17px;color:#111827;font-weight:700;line-height:1.4">${a.title}</h2>
          <p style="margin:0 0 10px;color:#4b5563;font-size:14px;line-height:1.65">${a.description}</p>
          <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.7">${a.content.substring(0, 250)}...</p>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>النشرة الإخبارية اليومية - Visionex</title>
</head>
<body style="margin:0;padding:20px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:620px;margin:auto">
    <div style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:32px 24px;text-align:center;border-radius:12px 12px 0 0">
      <div style="font-size:44px">📰</div>
      <h1 style="color:#fff;margin:12px 0 4px;font-size:22px;font-weight:800">النشرة الإخبارية اليومية</h1>
      <p style="color:#c4b5fd;margin:0;font-size:14px">${dateAr} · Visionex</p>
    </div>
    <div style="background:#fff;padding:28px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
      <p style="color:#374151;font-size:15px;margin:0 0 24px">مرحباً، إليك أبرز أخبار اليوم المختارة لك من Visionex:</p>
      ${articlesHtml}
      <div style="margin-top:28px;text-align:center">
        <a href="https://visionex.app/news"
           style="background:#6d28d9;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">
          قراءة كل الأخبار
        </a>
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px">
        <p style="margin:0">© 2026 <a href="https://visionex.app" style="color:#6d28d9;text-decoration:none">Visionex</a> · لإلغاء الاشتراك يرجى التواصل معنا</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // Verify CRON_SECRET
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
  const dateAr = now.toLocaleDateString("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
  });

  // ── 1. Generate articles ──────────────────────────────────────────────────
  let generated: GeneratedArticle[];
  try {
    generated = await generateArticles(dateAr);
  } catch (err) {
    console.error("[news-generate] AI error:", err);
    return Response.json(
      { error: "AI generation failed", details: String(err) },
      { status: 500, headers: CORS },
    );
  }

  // Validate + enrich with icon_name
  const rows = generated
    .filter((a) => CATEGORIES.some((c) => c.key === a.category) && a.title && a.description)
    .map((a) => ({
      title: a.title.trim(),
      description: a.description.trim(),
      content: a.content?.trim() ?? "",
      category: a.category,
      icon_name: CATEGORIES.find((c) => c.key === a.category)!.icon,
      published: true,
      published_at: now.toISOString(),
    }));

  if (rows.length === 0) {
    return Response.json(
      { error: "AI returned no valid articles" },
      { status: 500, headers: CORS },
    );
  }

  // ── 2. Insert into DB ────────────────────────────────────────────────────
  const { error: insertErr } = await supabase.from("news_articles").insert(rows);
  if (insertErr) {
    console.error("[news-generate] insert error:", insertErr);
    return Response.json(
      { error: "DB insert failed", details: insertErr.message },
      { status: 500, headers: CORS },
    );
  }
  console.log(`[news-generate] inserted ${rows.length} articles`);

  // ── 3. Send newsletter digests ───────────────────────────────────────────
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return Response.json(
      { generated: rows.length, emailsSent: 0, note: "RESEND_API_KEY not configured" },
      { headers: CORS },
    );
  }

  const { data: subscribers } = await supabase
    .from("newsletter_subscribers")
    .select("email, topics");

  if (!subscribers?.length) {
    return Response.json({ generated: rows.length, emailsSent: 0 }, { headers: CORS });
  }

  const FROM = Deno.env.get("RESEND_FROM") ?? "Visionex News <news@visionex.app>";
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const sub of subscribers) {
    const subTopics: string[] = sub.topics ?? [];

    // Map "news-technology" → "technology", keep only news-prefixed topics
    const subCategories = subTopics
      .filter((t) => t.startsWith("news-"))
      .map((t) => t.replace("news-", ""));

    // If subscriber chose no news categories, send all articles
    const relevantArticles = subCategories.length === 0
      ? rows
      : rows.filter((r) => subCategories.includes(r.category));

    if (relevantArticles.length === 0) continue;

    const html = buildDigestEmail(relevantArticles as GeneratedArticle[], dateAr);

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [sub.email],
          subject: `📰 أخبار Visionex اليومية — ${dateAr}`,
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

  return Response.json(
    {
      generated: rows.length,
      emailsSent,
      emailsFailed,
      date: now.toISOString().split("T")[0],
    },
    { headers: CORS },
  );
});
