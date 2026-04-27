import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed =
    ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost")
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller is an admin ──────────────────────────────
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Parse request ──────────────────────────────────────────
    const { type, subject, html, to, topic, from } = await req.json();

    if (!subject || !html) {
      return new Response(
        JSON.stringify({ error: "subject and html are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 3. Resolve recipients ─────────────────────────────────────
    let recipients: string[] = [];

    if (type === "newsletter") {
      let query = serviceClient
        .from("newsletter_subscribers")
        .select("email");
      if (topic && topic !== "all") {
        query = query.contains("topics", [topic]);
      }
      const { data: subs } = await query;
      recipients = (subs ?? []).map((s: { email: string }) => s.email);
    } else if (type === "single" && to) {
      recipients = Array.isArray(to) ? to : [to];
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid type or missing recipients" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found", sent: 0 }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Send via Resend API ────────────────────────────────────
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Email not configured. Add RESEND_API_KEY to Supabase Edge Function Secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Allowed sender addresses (all on verified domain visionex.app)
    const ALLOWED_SENDERS: Record<string, string> = {
      "hello":   "Visionex <hello@visionex.app>",
      "news":    "Visionex News <news@visionex.app>",
      "legal":   "Visionex Legal <legal@visionex.app>",
      "support": "Visionex Support <support@visionex.app>",
      "noreply": "Visionex <no-reply@visionex.app>",
    };

    const DEFAULT_FROM = Deno.env.get("RESEND_FROM") || "Visionex <hello@visionex.app>";
    const FROM = (from && ALLOWED_SENDERS[from]) ? ALLOWED_SENDERS[from] : DEFAULT_FROM;

    // Resend supports up to 50 recipients per request — batch if more
    const BATCH_SIZE = 50;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: batch,
          subject,
          html,
        }),
      });

      if (res.ok) {
        sent += batch.length;
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Resend batch error:", err);
        failed += batch.length;
      }
    }

    // ── 5. Log the admin action ───────────────────────────────────
    await serviceClient.rpc("log_admin_action", {
      _action: type === "newsletter" ? "send_newsletter" : "send_email",
      _target_type: "email",
      _target_id: null,
      _details: { subject, sent, failed, topic: topic ?? null },
    });

    return new Response(
      JSON.stringify({ sent, failed, total: recipients.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("send-email error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
