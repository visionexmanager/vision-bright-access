// Edge Function: radio-stream-token
// Validates a short-lived token and returns the real audio stream URL.
// This ensures stream_url is never exposed directly to the browser.

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

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json() as { token?: string };

    if (!token || typeof token !== "string" || token.length !== 64) {
      return Response.json(
        { error: "invalid_token" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use service-role client to bypass RLS and read stream_url
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Look up the token
    const { data: tokenRow, error: tokenErr } = await supabase
      .from("radio_stream_tokens")
      .select("id, user_id, station_id, expires_at")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return Response.json({ error: "token_not_found" }, { status: 401, headers: corsHeaders });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      // Clean up expired token
      await supabase.from("radio_stream_tokens").delete().eq("id", tokenRow.id);
      return Response.json({ error: "token_expired" }, { status: 401, headers: corsHeaders });
    }

    // Verify the subscription is still active (double-check server side)
    const { data: sub } = await supabase
      .from("radio_subscriptions")
      .select("id")
      .eq("user_id", tokenRow.user_id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    if (!sub) {
      return Response.json({ error: "subscription_expired" }, { status: 403, headers: corsHeaders });
    }

    // Fetch stream URL (service-role bypasses RLS)
    const { data: station, error: stationErr } = await supabase
      .from("radio_stations")
      .select("id, name, name_ar, stream_url, bitrate, logo_url")
      .eq("id", tokenRow.station_id)
      .eq("is_active", true)
      .single();

    if (stationErr || !station) {
      return Response.json({ error: "station_unavailable" }, { status: 404, headers: corsHeaders });
    }

    return Response.json(
      {
        stream_url: station.stream_url,
        station_id: station.id,
        name:       station.name,
        name_ar:    station.name_ar,
        bitrate:    station.bitrate,
        logo_url:   station.logo_url,
        expires_at: tokenRow.expires_at,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[radio-stream-token]", err);
    return Response.json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
});
