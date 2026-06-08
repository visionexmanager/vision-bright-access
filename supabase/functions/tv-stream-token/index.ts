// Edge Function: tv-stream-token
// Validates a short-lived token and returns the real HLS stream URL.
// This ensures stream_url is never exposed directly to the browser.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { token } = await req.json() as { token?: string };

    if (!token || typeof token !== "string" || token.length !== 64) {
      return Response.json(
        { error: "invalid_token" },
        { status: 400, headers: CORS }
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
      .from("tv_stream_tokens")
      .select("id, user_id, channel_id, expires_at")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenRow) {
      return Response.json({ error: "token_not_found" }, { status: 401, headers: CORS });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      // Clean up expired token
      await supabase.from("tv_stream_tokens").delete().eq("id", tokenRow.id);
      return Response.json({ error: "token_expired" }, { status: 401, headers: CORS });
    }

    // Verify the subscription is still active (double-check server side)
    const { data: sub } = await supabase
      .from("tv_subscriptions")
      .select("id")
      .eq("user_id", tokenRow.user_id)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .single();

    if (!sub) {
      return Response.json({ error: "subscription_expired" }, { status: 403, headers: CORS });
    }

    // Fetch stream URL (service-role bypasses RLS)
    const { data: channel, error: chanErr } = await supabase
      .from("tv_channels")
      .select("id, name, name_ar, stream_url, quality, logo_url")
      .eq("id", tokenRow.channel_id)
      .eq("is_active", true)
      .single();

    if (chanErr || !channel) {
      return Response.json({ error: "channel_unavailable" }, { status: 404, headers: CORS });
    }

    return Response.json(
      {
        stream_url:  channel.stream_url,
        channel_id:  channel.id,
        name:        channel.name,
        name_ar:     channel.name_ar,
        quality:     channel.quality,
        logo_url:    channel.logo_url,
        expires_at:  tokenRow.expires_at,
      },
      { status: 200, headers: CORS }
    );
  } catch (err) {
    console.error("[tv-stream-token]", err);
    return Response.json({ error: "internal_error" }, { status: 500, headers: CORS });
  }
});
