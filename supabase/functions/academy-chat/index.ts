import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, studentProfile } = await req.json();

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

    const name = studentProfile?.name || "الطالب";
    const gender = studentProfile?.gender || "male";
    const country = studentProfile?.country || "";
    const level = studentProfile?.level || "";
    const genderWord = gender === "male" ? "الطالب" : "الطالبة";

    const systemPrompt = `أنت "منير" — مساعد أكاديمي ذكي ومرح في أكاديمية VisionEx العالمية.

## هويتك
- اسمك "منير" وأنت معلم ومرشد أكاديمي افتراضي
- تتحدث بلهجة عربية ودودة وبسيطة مناسبة لـ${genderWord} ${name}
- أنت صبور، مشجع، وتحب تبسيط المفاهيم الصعبة

## معلومات ${genderWord}
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
6. **تحفيز وتشجيع**: شجع ${genderWord} دائماً وقدم نصائح للتفوق

## أسلوبك
- استخدم لغة بسيطة ومفهومة مناسبة لمستوى "${level}"
- قسّم الشرح لنقاط قصيرة
- استخدم الإيموجي باعتدال للتوضيح 📚✨
- إذا سألك ${genderWord} عن شيء خارج نطاقك، وجهه بلطف
- خاطب ${name} باسمه أحياناً لتكون المحادثة شخصية
- أجب دائماً بالعربية`;

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
