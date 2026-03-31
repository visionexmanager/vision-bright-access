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
    const { name, category, store_type, description } = await req.json();

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are a product data enrichment assistant for an accessibility-focused platform called Visionex.

Given this product information:
- Name: ${name}
- Category: ${category || "unknown"}
- Store type: ${store_type || "general"}
- Current description: ${description || "none"}

Generate enriched product data. Return a JSON object with these fields:
- "description": A compelling 1-2 sentence product description highlighting key features and benefits
- "category_suggestion": The best category for this product (pick from: Electronics, Home, Office, Personal Care, Software, Hardware, Design, Media, Learning, Consulting)
- "accessibility_features": Array of accessibility features this product offers (e.g., "Screen reader compatible", "Voice control", "High contrast display")
- "target_users": Array of target user groups (e.g., "Blind users", "Low vision users", "Students", "Professionals")
- "usage_scenarios": Array of 2-3 usage scenarios
- "missing_info": Array of information that's missing and should be added by an admin (e.g., "Battery life", "Dimensions", "Weight")

Only return valid JSON, no markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            type: "function",
            function: {
              name: "enrich_product",
              description: "Return enriched product data",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  category_suggestion: { type: "string" },
                  accessibility_features: { type: "array", items: { type: "string" } },
                  target_users: { type: "array", items: { type: "string" } },
                  usage_scenarios: { type: "array", items: { type: "string" } },
                  missing_info: { type: "array", items: { type: "string" } },
                },
                required: ["description", "category_suggestion", "accessibility_features", "target_users", "usage_scenarios", "missing_info"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "enrich_product" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI service error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error("No enrichment data returned");
    }

    const enriched = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(enriched), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-product error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
