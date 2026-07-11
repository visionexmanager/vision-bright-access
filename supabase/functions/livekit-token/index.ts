import { AccessToken } from "npm:livekit-server-sdk@2";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getAllowedOrigins() {
  const configured = Deno.env.get("ALLOWED_ORIGINS");
  if (!configured) return DEFAULT_ALLOWED_ORIGINS;

  return configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string) {
  if (!origin) return false;
  if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) return true;
  return getAllowedOrigins().includes(origin);
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigins = getAllowedOrigins();
  const allowed = isAllowedOrigin(origin)
    ? origin
    : allowedOrigins[0] || DEFAULT_ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { roomId, userName } = await req.json();

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const rawUrl = Deno.env.get("LIVEKIT_URL")?.trim().replace(/^["']|["']$/g, "");
    // URL is optional — if not set, the frontend uses its own fallback
    const livekitUrl = rawUrl?.startsWith("wss://") ? rawUrl : undefined;

    if (!apiKey || !apiSecret) {
      throw new Error("LiveKit credentials not configured on server");
    }

    if (!roomId) {
      throw new Error("roomId is required");
    }

    // Identity is derived from the verified JWT, never trusted from the client body,
    // so a caller cannot mint a token impersonating another user.
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: userName || user.email || user.id,
      ttl: 7200,
    });

    at.addGrant({
      roomJoin: true,
      room: roomId,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return new Response(JSON.stringify({ token, ...(livekitUrl ? { url: livekitUrl } : {}) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
