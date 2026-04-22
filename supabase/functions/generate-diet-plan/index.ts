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
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const { name, weight, height, goal, lang } = await req.json();

    if (!weight || !height || !goal) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bmi = (parseFloat(weight) / ((parseFloat(height) / 100) ** 2)).toFixed(1);
    const dailyCal = Math.round(parseFloat(weight) * 30);

    const systemPrompt = lang === "ar"
      ? `أنت أخصائي تغذية محترف. أنشئ خطة غذائية يومية مخصصة لمدة يوم واحد.
بيانات المستخدم: الاسم: ${name}, الوزن: ${weight}كغ, الطول: ${height}سم, BMI: ${bmi}, الهدف: ${goal}, السعرات اليومية: ${dailyCal}.
أعطِ خطة مفصلة مع 5 وجبات (فطور، وجبة خفيفة صباحية، غداء، وجبة خفيفة مسائية، عشاء).
أجب بصيغة JSON فقط مع الحقول التالية:
meals (مصفوفة من: name, time, calories, ingredients (مصفوفة نصية), description),
totalCalories (رقم), tips (مصفوفة نصية 3 نصائح), waterIntake (نص)`
      : `You are a professional nutritionist. Create a personalized daily meal plan.
User data: Name: ${name}, Weight: ${weight}kg, Height: ${height}cm, BMI: ${bmi}, Goal: ${goal}, Daily calories: ${dailyCal}.
Provide a detailed plan with 5 meals (breakfast, morning snack, lunch, afternoon snack, dinner).
IMPORTANT: Use only plain English text with ASCII characters. Do NOT include any non-ASCII characters, emojis, or special Unicode symbols in any field.
Reply in JSON only with fields:
meals (array of: name, time like "08:00 AM", calories, ingredients (string array), description),
totalCalories (number), tips (array of 3 string tips), waterIntake (string like "3.5 Liters per day")`;

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
          { role: "user", content: lang === "ar" ? "أنشئ خطتي الغذائية" : "Generate my diet plan" },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "diet_plan",
              description: "Structured daily diet plan",
              parameters: {
                type: "object",
                properties: {
                  meals: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        time: { type: "string" },
                        calories: { type: "number" },
                        ingredients: { type: "array", items: { type: "string" } },
                        description: { type: "string" },
                      },
                      required: ["name", "time", "calories", "ingredients", "description"],
                      additionalProperties: false,
                    },
                  },
                  totalCalories: { type: "number" },
                  tips: { type: "array", items: { type: "string" } },
                  waterIntake: { type: "string" },
                },
                required: ["meals", "totalCalories", "tips", "waterIntake"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "diet_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 401) {
        return new Response(JSON.stringify({ error: "Invalid OpenAI API key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let plan;

    if (toolCall?.function?.arguments) {
      plan = JSON.parse(toolCall.function.arguments);
    } else {
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) plan = JSON.parse(jsonMatch[0]);
      else throw new Error("Could not parse AI response");
    }

    return new Response(JSON.stringify({ plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-diet-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
