import { createClient } from "npm:@supabase/supabase-js@2";
import { chargeDailyLimit } from "../_shared/aiDailyLimit.ts";
import { subscriptionGate } from "../_shared/subscriptionGate.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getGenerator, GENERATION_SCHEMA } from "../_shared/generators.ts";
import { structuredCompletionWithFallback, ProviderError } from "../_shared/aiProvider.ts";
import { installChatAttemptRecording } from "../_shared/chatRecorder.ts";
import { scriptOfLanguage } from "../_shared/answerLanguage.ts";
import { installUsageMetering } from "../_shared/usageMeter.ts";

installUsageMetering("ai-generate");

// Record each chat/vision provider attempt in the registry (Phase 2K-4). Recording only.
installChatAttemptRecording();

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

    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Subscription gate: no AI work, limit, VX charge or provider call without an active paid plan.
    const refused = await subscriptionGate(serviceClient, req, user.id, corsHeaders);
    if (refused) return refused;

    // Per-user daily ceiling, before anything reaches a provider (Phase 2F-2).
    const limited = await chargeDailyLimit(
      serviceClient,
      user.id, "ai-generate", corsHeaders,
    );
    if (limited) return limited;

    const { generatorId, params = {}, lang = "en" } = await req.json();

    const generator = getGenerator(generatorId);
    if (!generator) {
      return new Response(JSON.stringify({ error: "Unknown generator" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { result } = await structuredCompletionWithFallback({
        targets: generator.targets ?? [{ provider: generator.provider, model: generator.model }],
        system: generator.buildSystem(params, lang),
        userText: generator.buildUser(params, lang),
        // A generator may declare its own result shape. Every generator written
        // before that field existed omits it and keeps the universal plan
        // schema, so this changes nothing for any of them.
        schema: generator.schema ?? (GENERATION_SCHEMA as unknown as Record<string, unknown>),
        toolName: generator.toolName ?? "generated_plan",
        maxTokens: 2000,
        // A plan asked for in Arabic that comes back in English is a failure,
        // not a result: the chain moves on to the next model.
        expectScript: scriptOfLanguage(lang),
      });
      return new Response(JSON.stringify({ result }), {
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
    console.error("ai-generate error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
