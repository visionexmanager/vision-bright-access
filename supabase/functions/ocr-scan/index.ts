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
      "authorization, x-client-info, apikey, content-type",
  };
}

const SYSTEM_PROMPT_EN = `You are an advanced OCR (Optical Character Recognition) engine.
Your sole task is to extract ALL text from the provided image with maximum accuracy.

Rules:
1. Extract every visible character, word, number, symbol, and punctuation mark exactly as it appears.
2. Preserve the original layout as much as possible — use newlines to separate paragraphs and sections.
3. For tables, use tabs or spaces to align columns.
4. For handwritten text, transcribe your best reading and mark uncertain parts with [?].
5. Include text from all areas: headers, footers, watermarks, captions, labels.
6. Do NOT summarize, interpret, or add commentary — just extract the raw text.
7. Detect the primary language of the document.
8. Return a confidence level: High / Medium / Low based on image quality.`;

const SYSTEM_PROMPT_AR = `أنت محرك OCR متقدم (التعرف الضوئي على الحروف).
مهمتك الوحيدة هي استخراج جميع النصوص من الصورة المقدمة بأقصى دقة ممكنة.

القواعد:
1. استخرج كل حرف ورقم ورمز وعلامة ترقيم كما يظهر بالضبط.
2. حافظ على التخطيط الأصلي قدر الإمكان — استخدم أسطراً جديدة للفصل بين الفقرات والأقسام.
3. للجداول، استخدم المسافات لمحاذاة الأعمدة.
4. للخط اليدوي، انسخ أفضل قراءة وضع علامة [؟] على الأجزاء غير المؤكدة.
5. اشمل النص من جميع المناطق: الرؤوس والتذييلات والعلامات المائية والتسميات التوضيحية.
6. لا تلخص أو تفسر أو تضيف تعليقات — فقط استخرج النص الخام.
7. اكتشف اللغة الأساسية للوثيقة.
8. أعد مستوى الثقة: مرتفع / متوسط / منخفض بناءً على جودة الصورة.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { image, lang = "en", hint = "" } = await req.json();

    if (!image || typeof image !== "string") {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = lang === "ar" ? SYSTEM_PROMPT_AR : SYSTEM_PROMPT_EN;
    const userText = hint
      ? (lang === "ar"
          ? `استخرج النص من هذه الصورة. تلميح إضافي: ${hint}`
          : `Extract all text from this image. Additional hint: ${hint}`)
      : (lang === "ar"
          ? "استخرج جميع النصوص من هذه الصورة بدقة تامة."
          : "Extract all text from this image with maximum accuracy.");

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
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "ocr_result",
              description: "Structured OCR text extraction result",
              parameters: {
                type: "object",
                properties: {
                  extracted_text: {
                    type: "string",
                    description: "All text extracted from the image, preserving original layout",
                  },
                  detected_language: {
                    type: "string",
                    description: "Primary language detected (e.g. English, Arabic, Hindi)",
                  },
                  confidence: {
                    type: "string",
                    enum: ["High", "Medium", "Low"],
                    description: "OCR confidence based on image quality",
                  },
                  word_count: {
                    type: "number",
                    description: "Approximate number of words extracted",
                  },
                  has_handwriting: {
                    type: "boolean",
                    description: "Whether handwritten text was detected",
                  },
                },
                required: ["extracted_text", "detected_language", "confidence", "word_count", "has_handwriting"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "ocr_result" } },
        max_tokens: 4000,
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

    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ocr-scan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
