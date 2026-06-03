import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

// Basic email format check (avoids importing a regex library)
function isValidEmail(email: string): boolean {
  return /^[^\s@]{1,64}@[^\s@]{1,255}$/.test(email);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { full_name, email, phone, service_type, message, user_id } = body;

    // ── Input validation ───────────────────────────────────────────────
    if (!full_name || !email || !service_type || !message) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      typeof full_name    !== "string" || full_name.length    > 100  ||
      typeof email        !== "string" || email.length        > 255  ||
      typeof service_type !== "string" || service_type.length > 100  ||
      typeof message      !== "string" || message.length      > 2000 ||
      (phone !== undefined && (typeof phone !== "string" || phone.length > 30))
    ) {
      return new Response(JSON.stringify({ error: "Invalid or oversized field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await serviceClient.from("service_requests").insert({
      user_id:      user_id   ?? null,
      full_name:    full_name.trim(),
      email:        email.trim().toLowerCase(),
      phone:        phone?.trim() || null,
      service_type: service_type.trim(),
      message:      message.trim(),
    });

    if (error) {
      console.error("[contact-form] insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to save request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[contact-form] error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
