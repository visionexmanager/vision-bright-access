import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost")
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await serviceClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, subject, html, to, topic } = await req.json();

    // Get recipients
    let recipients: string[] = [];
    if (type === "newsletter") {
      let query = serviceClient.from("newsletter_subscribers").select("email");
      if (topic && topic !== "all") query = query.contains("topics", [topic]);
      const { data: subs } = await query;
      recipients = (subs || []).map((s: { email: string }) => s.email);
    } else if (type === "single" && to) {
      recipients = Array.isArray(to) ? to : [to];
    } else {
      return new Response(JSON.stringify({ error: "Invalid type or missing recipients" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (recipients.length === 0) {
      return new Response(JSON.stringify({ error: "No recipients found", sent: 0 }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SMTP credentials from Supabase secrets
    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "587");
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASS = Deno.env.get("SMTP_PASS");
    const SMTP_FROM = Deno.env.get("SMTP_FROM") || `Visionex <${SMTP_USER}>`;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return new Response(JSON.stringify({
        error: "SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to Supabase Secrets."
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use Resend-compatible SMTP via fetch (works with any SMTP-to-HTTP bridge)
    // Or use denomailer for direct SMTP
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: SMTP_PORT === 465,
        auth: { username: SMTP_USER, password: SMTP_PASS },
      },
    });

    let sent = 0;
    let failed = 0;

    for (const email of recipients) {
      try {
        await client.send({
          from: SMTP_FROM,
          to: email,
          subject,
          html,
        });
        sent++;
      } catch (e) {
        console.error(`Failed to send to ${email}:`, e);
        failed++;
      }
    }

    await client.close();

    // Log the action
    await serviceClient.rpc("log_admin_action", {
      _action: type === "newsletter" ? "send_newsletter" : "send_email",
      _target_type: "email",
      _target_id: null,
      _details: { subject, sent, failed, topic: topic || null },
    });

    return new Response(JSON.stringify({ sent, failed, total: recipients.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
