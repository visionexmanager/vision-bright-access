import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { providerErrorSummary } from "../_shared/providerInput.ts";
import { meteredFetch } from "../_shared/meteredFetch.ts";
import { installUsageMetering } from "../_shared/usageMeter.ts";

installUsageMetering("moderate-content");

// Flags user-generated text using OpenAI's moderation model.
// Call this at content-creation points (messages, listings, posts, reviews).
//
// Deliberately NOT behind the subscription gate (_shared/subscriptionGate.ts).
// This is a safety control, not an AI service: it calls OpenAI's free
// moderation endpoint (no VX, no charge) and guards children's chat and
// library posts. Every caller (visionkids chat.ts and groups.ts, library
// moderation.ts, aiService.ts) treats a refusal or error as "not flagged", so
// gating it would let an unsubscribed account publish unmoderated content
// rather than stop anything. Trusted callers: signed-in browser sessions only
// (a JWT is required below); input is capped at 8000 characters.

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

    const { text } = await req.json().catch(() => ({}));
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = Deno.env.get("OPENAI_API_KEY");
    if (!key) throw new Error("OPENAI_API_KEY is not configured");

    const res = await meteredFetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text.slice(0, 8000) }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("OpenAI moderation error:", res.status, providerErrorSummary(errText));
      // Fail open (don't block users on moderation outages) but report not-flagged.
      return new Response(JSON.stringify({ flagged: false, categories: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const r = data.results?.[0];
    const flagged = Boolean(r?.flagged);
    const categories = r?.categories
      ? Object.entries(r.categories).filter(([, v]) => v === true).map(([k]) => k)
      : [];

    return new Response(JSON.stringify({ flagged, categories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("moderate-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
