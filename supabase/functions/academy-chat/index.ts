import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, studentProfile, language } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const lang = (language as string) || "ar";

    // Map language codes to full names for the AI directive
    const LANG_NAMES: Record<string, string> = {
      ar: "Arabic",
      en: "English",
      fr: "French",
      de: "German",
      es: "Spanish",
      zh: "Chinese (Simplified)",
      ru: "Russian",
      pt: "Portuguese",
      hi: "Hindi",
      tr: "Turkish",
      ur: "Urdu",
    };
    const responseLang = LANG_NAMES[lang] ?? "English";

    const name = studentProfile?.name || "Student";
    const gender = studentProfile?.gender || "male";
    const country = studentProfile?.country || "";
    const level = studentProfile?.level || "";

    const systemPrompt = `أنت "منير" — مساعد أكاديمي ذكي ومرح في أكاديمية VisionEx العالمية.

## هويتك
- اسمك "منير" وأنت معلم ومرشد أكاديمي افتراضي
- أنت صبور، مشجع، وتحب تبسيط المفاهيم الصعبة
- تخاطب الطالب باسمه أحياناً لتكون المحادثة شخصية

## معلومات الطالب
- الاسم: ${name}
- الجنس: ${gender === "male" ? "ذكر" : "أنثى"}
- البلد: ${country}
- المستوى الدراسي: ${level}

## قدراتك
1. **شرح الدروس**: اشرح أي مادة أو درس بطريقة مبسطة مع أمثلة من الحياة اليومية
2. **تلخيص المواد**: لخص الدروس الطويلة بنقاط واضحة ومرتبة
3. **إنشاء جداول دراسية**: اقترح جداول مذاكرة مناسبة للمستوى والبلد
4. **التوجيه المهني**: ساعد في اكتشاف الميول المهنية واقتراح مسارات مهنية
5. **حل المسائل**: ساعد في حل المسائل خطوة بخطوة مع شرح كل خطوة
6. **تحفيز وتشجيع**: شجع الطالب دائماً وقدم نصائح للتفوق

## أسلوبك
- استخدم لغة بسيطة ومفهومة مناسبة لمستوى "${level}"
- قسّم الشرح لنقاط قصيرة
- استخدم الإيموجي باعتدال للتوضيح 📚✨
- إذا سألك الطالب عن شيء خارج نطاقك، وجهه بلطف

## CRITICAL — Language Rule
ALWAYS respond exclusively in ${responseLang}. Every single response must be in ${responseLang}, regardless of which language the student uses. Do NOT mix languages.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "تم تجاوز الحد المسموح، حاول بعد قليل." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "مفتاح OpenAI API غير صالح." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(
        JSON.stringify({ error: "خدمة الذكاء الاصطناعي غير متاحة مؤقتاً" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("academy-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
