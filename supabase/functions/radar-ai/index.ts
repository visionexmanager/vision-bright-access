import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost")
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const SYSTEM_PROMPT_EN = `You are Radar AI — a visual intelligence assistant designed specifically for blind and visually impaired users on the Visionex platform.

Your mission is to describe images in detail so that the user can fully understand what is in front of them without seeing it.

For every image, provide a structured analysis with these sections:

1. **Scene Overview** — A single sentence summary of what the image shows.
2. **Main Objects** — List the most important objects detected (up to 6), each with a short description.
3. **Text Detected** — Any readable text, signs, labels, prices, or writing in the image. Write "None detected" if nothing.
4. **People** — Number of people visible, their approximate position, and any visible actions or expressions.
5. **Environment** — Describe the setting: indoor/outdoor, lighting, colors, atmosphere.
6. **Safety Notes** — Any hazards, obstacles, steps, traffic, or important warnings relevant for navigation.
7. **Accessibility Tip** — One practical suggestion to help the user interact with or navigate the depicted scene.

Be precise, empathetic, and concise. Use clear language. Avoid poetic descriptions — focus on useful, actionable details.`;

const SYSTEM_PROMPT_AR = `أنت رادار الذكاء الاصطناعي — مساعد بصري ذكي مصمم خصيصاً للمكفوفين وضعاف البصر على منصة Visionex.

مهمتك وصف الصور بدقة تامة لتمكين المستخدم من فهم ما أمامه دون رؤيته.

لكل صورة، قدّم تحليلاً منظماً يشمل هذه الأقسام:

1. **نظرة عامة** — جملة واحدة تلخص ما تُظهره الصورة.
2. **الأشياء الرئيسية** — قائمة بأهم الأشياء المرصودة (حتى 6 أشياء)، مع وصف مختصر لكل منها.
3. **النصوص المكتشفة** — أي نص مقروء، لافتات، ملصقات، أسعار، أو كتابات في الصورة. اكتب "لا يوجد" إذا لم يكن هناك شيء.
4. **الأشخاص** — عدد الأشخاص الظاهرين، موقعهم التقريبي، وأي أفعال أو تعابير وجه مرئية.
5. **البيئة المحيطة** — صِف المكان: داخلي/خارجي، الإضاءة، الألوان، الأجواء.
6. **ملاحظات السلامة** — أي مخاطر، عوائق، درجات، حركة مرور، أو تحذيرات مهمة للتنقل.
7. **نصيحة الوصول** — اقتراح عملي واحد لمساعدة المستخدم على التفاعل مع المشهد أو التنقل فيه.

كن دقيقاً، متعاطفاً، وموجزاً. استخدم لغة واضحة. تجنب الأوصاف الشعرية — ركّز على التفاصيل المفيدة والقابلة للتنفيذ.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { image, lang = "en" } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = lang === "ar" ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;

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
          {
            role: "user",
            content: [
              {
                type: "text",
                text: lang === "ar"
                  ? "حلّل هذه الصورة بدقة وصِف ما فيها بالتفصيل."
                  : "Analyse this image carefully and describe what you see in detail.",
              },
              {
                type: "image_url",
                image_url: { url: image, detail: "high" },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "radar_analysis",
              description: "Structured visual scene analysis for the blind",
              parameters: {
                type: "object",
                properties: {
                  overview:      { type: "string" },
                  objects:       { type: "array", items: { type: "string" } },
                  text_detected: { type: "string" },
                  people:        { type: "string" },
                  environment:   { type: "string" },
                  safety_notes:  { type: "string" },
                  accessibility_tip: { type: "string" },
                },
                required: ["overview", "objects", "text_detected", "people", "environment", "safety_notes", "accessibility_tip"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "radar_analysis" } },
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await response.text();
      console.error("OpenAI error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No structured response from AI");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("radar-ai error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
