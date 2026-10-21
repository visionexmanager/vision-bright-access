import { AccessToken } from "npm:livekit-server-sdk@2";
import { createClient } from "npm:@supabase/supabase-js@2";
import { hasActivePaidPlan } from "../_shared/entitlements.ts";

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reply = (cors: Record<string, string>, body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A signed-in account is not a paying one. A LiveKit room is billed per
    // participant-minute by the host, and until now any session, including the
    // free week and a lapsed account, could mint a two-hour token with publish
    // rights. Asked before the body is read or a token is signed. Fails closed.
    const serviceClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const paid = await hasActivePaidPlan(serviceClient, user.id);
    if (!paid.allowed) {
      return new Response(
        JSON.stringify(paid.unavailable
          ? { error: "entitlement_unavailable", message: "We could not confirm your plan just now. Please try again in a moment." }
          : { error: "subscription_required", message: "Voice rooms are available with an active plan." }),
        { status: paid.unavailable ? 503 : 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // The request is parsed only after the plan is proven. A token is signed only for a room that
    // really exists and that this account may be in: before this, any paying account could name ANY
    // string and have LiveKit create that room, join a Kids room by its prefix, or join a room it was
    // banned from (bans and capacity were enforced by the browser alone).
    let body: { roomId?: unknown; userName?: unknown };
    try {
      body = await req.json();
    } catch {
      return reply(corsHeaders, { error: "invalid_request" }, 400);
    }
    const roomId = typeof body?.roomId === "string" ? body.roomId.trim() : "";
    const isKidsRoom = roomId.startsWith("kids-") && UUID.test(roomId.slice(5));
    if (!isKidsRoom && !UUID.test(roomId)) return reply(corsHeaders, { error: "invalid_room" }, 400);

    if (isKidsRoom) {
      const kidsId = roomId.slice(5);
      const { data: room } = await serviceClient.from("kids_voice_rooms").select("id, status").eq("id", kidsId).maybeSingle();
      if (!room || room.status === "ended") return reply(corsHeaders, { error: "room_not_found" }, 404);
      const { data: ban } = await serviceClient.from("kids_voice_room_bans").select("user_id").eq("room_id", kidsId).eq("user_id", user.id).maybeSingle();
      if (ban) return reply(corsHeaders, { error: "banned" }, 403);
    } else {
      const { data: room } = await serviceClient.from("voice_rooms").select("id, is_active").eq("id", roomId).maybeSingle();
      if (!room) return reply(corsHeaders, { error: "room_not_found" }, 404);
      if (!room.is_active) {
        const { data: isAdmin } = await serviceClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (isAdmin !== true) return reply(corsHeaders, { error: "room_not_found" }, 404);
      }
      const { data: ban } = await serviceClient.from("voice_room_bans").select("id").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
      if (ban) return reply(corsHeaders, { error: "banned" }, 403);
    }

    // The display name is the account's own, never an e-mail address and never longer than 40
    // characters: the browser used to send user.email when no name was set, which showed a member's
    // address to everyone in the room. Identity stays the verified user id, never client input.
    const tidy = (v: unknown) => {
      if (typeof v !== "string") return "";
      let out = "";
      for (const ch of v) {
        const code = ch.charCodeAt(0);
        out += code < 32 || code === 127 ? " " : ch;
      }
      return out.replace(/\s{2,}/g, " ").trim().slice(0, 40);
    };
    const { data: profile } = await serviceClient.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    let displayName = tidy(profile?.display_name);
    if (!displayName) {
      const supplied = tidy(body?.userName);
      displayName = supplied && !supplied.includes("@") ? supplied : "Member";
    }

    const apiKey = Deno.env.get("LIVEKIT_API_KEY");
    const apiSecret = Deno.env.get("LIVEKIT_API_SECRET");
    const rawUrl = Deno.env.get("LIVEKIT_URL")?.trim().replace(/^["']|["']$/g, "");
    // URL is optional — if not set, the frontend uses its own fallback
    const livekitUrl = rawUrl?.startsWith("wss://") ? rawUrl : undefined;

    if (!apiKey || !apiSecret) {
      throw new Error("LiveKit credentials not configured on server");
    }

    // Identity is taken from the verified JWT, never from client input,
    // so a caller can't mint a token that impersonates another user.
    const at = new AccessToken(apiKey, apiSecret, {
      identity: user.id,
      name: displayName,
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
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
