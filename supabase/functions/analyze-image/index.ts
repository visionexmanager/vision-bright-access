import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getVisionAnalyst, VISION_SCHEMA } from "../_shared/visionAnalysts.ts";
import { structuredCompletion, ProviderError } from "../_shared/aiProvider.ts";

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analystId, image, lang = "en" } = await req.json();

    const analyst = getVisionAnalyst(analystId);
    if (!analyst) {
      return new Response(JSON.stringify({ error: "Unknown analyst" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!image || typeof image !== "string") {
      return new Response(JSON.stringify({ error: "Image data is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userText = lang === "ar"
      ? "حلّل هذه الصورة وقدّم تقييماً منظماً."
      : "Analyze this photo and provide a structured assessment.";

    try {
      const analysis = await structuredCompletion({
        provider: analyst.provider,
        model: analyst.model,
        system: `${analyst.systemPrompt}\n\nUser's language: ${lang}.`,
        userText,
        image,
        schema: VISION_SCHEMA as unknown as Record<string, unknown>,
        toolName: "vision_analysis",
        maxTokens: 1200,
      });
      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      if (e instanceof ProviderError && e.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }
  } catch (e) {
    console.error("analyze-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
