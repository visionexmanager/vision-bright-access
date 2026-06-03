import { AccessToken } from "npm:livekit-server-sdk@2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins — production + local dev only
const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  // Local development only — never *.lovable.app in production
  if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  ) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate the caller via Supabase JWT ────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Parse and validate request body ────────────────────────────
    const { roomId, userId, userName } = await req.json();

    // Critical: ensure the caller can only get a token for themselves
    if (!userId || userId !== user.id) {
      return new Response(
        JSON.stringify({ error: "userId must match the authenticated user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roomId || typeof roomId !== "string" || roomId.length > 200) {
      return new Response(
        JSON.stringify({ error: "roomId is required and must be a valid string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Load LiveKit credentials ────────────────────────────────────
    const apiKey    = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (!apiKey || !apiSecret) {
      console.error("[livekit-token] Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET");
      return new Response(
        JSON.stringify({ error: "LiveKit credentials not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Mint a short-lived token (1 hour) ──────────────────────────
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,                                      // always use verified server-side id
      name: userName || user.email || user.id,
      ttl: 3600,                                               // 1 hour — down from 2 hours
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canPublishSources: ["microphone", "camera", "screen_share", "screen_share_audio"],
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[livekit-token] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
