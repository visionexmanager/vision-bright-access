import { createClient } from "npm:@supabase/supabase-js@2";
import {
  DEPARTMENT_ROUTES,
  buildAutoReply,
  buildInternalNotification,
  replyLanguage,
  resolveDepartment,
  type ContactDepartmentId,
} from "../_shared/contactRouting.ts";

const ALLOWED_ORIGINS = ["https://visionex.app", "https://www.visionex.app"];

// Verified senders on the visionex.app domain, mirroring send-email.
const SENDERS: Record<string, string> = {
  hello: "Visionex <hello@visionex.app>",
  support: "Visionex Support <support@visionex.app>",
  billing: "Visionex Billing <billing@visionex.app>",
  news: "Visionex News <news@visionex.app>",
};

/**
 * Extra internal recipients, comma-separated, e.g. an ops mailbox. Unset by
 * default: no staff address is committed, and the department inbox alone is a
 * working configuration.
 */
function internalRecipients(department: ContactDepartmentId): string[] {
  const extra = (Deno.env.get("CONTACT_INTERNAL_RECIPIENTS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return [...new Set([DEPARTMENT_ROUTES[department].inbox, ...extra])];
}

async function sendMail(params: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}): Promise<boolean> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      reply_to: params.replyTo,
    }),
  });
  if (!res.ok) {
    // Body may contain the address; log status only.
    console.error("[contact-form] resend rejected the message:", res.status);
  }
  return res.ok;
}

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
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { full_name, email, phone, service_type, message, user_id, attachment_url } = body;

    // Unknown or absent values fall back to General rather than being rejected:
    // an unroutable message must still reach a human.
    const department = resolveDepartment(body.department);
    const language = replyLanguage(body.locale);

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
      (phone !== undefined && phone !== null && (typeof phone !== "string" || phone.length > 30)) ||
      (attachment_url !== undefined && attachment_url !== null &&
        (typeof attachment_url !== "string" || attachment_url.length > 500))
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
      attachment_url: attachment_url || null,
      department,
    });

    if (error) {
      console.error("[contact-form] insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to save request" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Notification + acknowledgement ─────────────────────────────────
    //
    // The request is already stored, so mail is best-effort: a Resend outage
    // must not turn a saved request into an error the sender sees and retries.
    // Both outcomes are reported in the response so the caller can tell the
    // difference, and the failure is logged for follow-up.
    let notified = false;
    let acknowledged = false;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.error("[contact-form] RESEND_API_KEY is not configured — request saved, no mail sent.");
    } else {
      const route = DEPARTMENT_ROUTES[department];
      const from = SENDERS[route.sender] ?? SENDERS.hello;
      const senderEmail = email.trim().toLowerCase();

      const internal = buildInternalNotification({
        department,
        fullName: full_name,
        email: senderEmail,
        phone,
        serviceType: service_type,
        message,
        attachmentUrl: attachment_url,
      });

      const reply = buildAutoReply(department, language, full_name);

      const [notifyOk, replyOk] = await Promise.all([
        sendMail({
          apiKey: resendKey,
          from,
          to: internalRecipients(department),
          subject: internal.subject,
          html: internal.html,
          // Lets the team answer the sender directly from the notification.
          replyTo: senderEmail,
        }).catch(() => false),
        sendMail({
          apiKey: resendKey,
          from,
          to: [senderEmail],
          subject: reply.subject,
          html: reply.html,
          text: reply.text,
          replyTo: route.inbox,
        }).catch(() => false),
      ]);

      notified = notifyOk;
      acknowledged = replyOk;
    }

    return new Response(JSON.stringify({ success: true, department, notified, acknowledged }), {
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
