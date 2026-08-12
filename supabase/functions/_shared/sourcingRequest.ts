// Customer sourcing request, served as the "request_sourcing" action of
// contact-form. Extracted verbatim from the request-sourcing function: same
// anon posture, same rate limit, same escalation and approval records.
//
// This only *creates* an escalation and an approval row. The privileged
// approval engine — decide_owner_approval and transition_escalation — stays
// behind owner-control and is not reachable from here.
// Customer-facing: "I want help getting this."
//
// Creates a support escalation and an owner approval through the Phase 4
// engines, so the request appears in the Owner Control Centre alongside
// everything else. It creates no order, because the main catalogue has no
// order system — saying otherwise would be inventing a transaction.
//
// Anonymous callers are allowed: a customer asking for help should not have to
// sign in first. That makes rate limiting and input bounds the load-bearing
// protections here.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

/** Per-identity ceiling. Enough for a real conversation, not for a flood. */
const MAX_REQUESTS_PER_HOUR = 5;

const MAX_MESSAGE = 2000;
const MAX_TRANSCRIPT_TURNS = 20;

interface TranscriptTurn {
  role: string;
  content: string;
}

export async function handleSourcingRequest(req: Request): Promise<Response> {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));

    const request = typeof body.request === "string" ? body.request.trim() : "";
    if (!request || request.length > MAX_MESSAGE) {
      return json({ error: "A request between 1 and 2000 characters is required." }, 400);
    }

    const reason = ["complex_sourcing", "sourcing_confirmation", "customer_requested_human"]
      .includes(body.reason) ? body.reason : "customer_requested_human";

    const authHeader = req.headers.get("Authorization");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      authHeader ? { global: { headers: { Authorization: authHeader } } } : undefined,
    );
    const { data: { user } } = await anon.auth.getUser();

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit on the strongest identity available. An anonymous caller is
    // limited by the session id the client supplies; it is weaker than a user
    // id and is treated as such rather than trusted for anything else.
    const identity = user?.id ?? (typeof body.session_ref === "string" ? body.session_ref.slice(0, 64) : null);
    if (identity) {
      const since = new Date(Date.now() - 3_600_000).toISOString();
      const { count } = await service
        .from("support_escalations")
        .select("id", { count: "exact", head: true })
        .eq(user?.id ? "user_id" : "customer_ref", identity)
        .gte("created_at", since);
      if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
        return json({ error: "Too many requests. Please wait before sending another." }, 429);
      }
    }

    // Bounded, and stored as given: the point of keeping it is so nobody has
    // to repeat themselves.
    const transcript: TranscriptTurn[] = Array.isArray(body.transcript)
      ? (body.transcript as TranscriptTurn[])
          .filter((turn) => turn && typeof turn.content === "string")
          .slice(-MAX_TRANSCRIPT_TURNS)
          .map((turn) => ({
            role: turn.role === "assistant" ? "assistant" : "user",
            content: String(turn.content).slice(0, MAX_MESSAGE),
          }))
      : [];

    const subjectRef = typeof body.result_ref === "string" ? body.result_ref.slice(0, 64) : null;

    // The stored result is the internal record; the customer never saw the
    // supplier, and this does not change that. It gives the owner the sourcing
    // detail they need to decide.
    let subjectTitle: string | null = null;
    let payload: Record<string, unknown> = { request };
    if (subjectRef) {
      const { data: result } = await service
        .from("sourcing_results")
        .select("*")
        .eq("visionex_ref", subjectRef)
        .maybeSingle();
      if (result) {
        subjectTitle = result.title as string;
        payload = {
          request,
          visionex_ref: result.visionex_ref,
          title: result.title,
          brand: result.brand,
          condition: result.condition,
          availability: result.availability,
          final_price_usd: result.final_price_usd,
          // Owner-only sourcing internals, mirrored into the approval so the
          // decision screen has what it needs without a second lookup.
          source_slug: result.source_slug,
          source_price_usd: result.source_price_usd,
          shipping_usd: result.shipping_usd,
          pricing_breakdown: result.pricing_breakdown,
          retrieved_at: result.retrieved_at,
        };
      }
    }

    const { data: escalation, error: escalationError } = await service
      .from("support_escalations")
      .insert({
        user_id: user?.id ?? null,
        customer_ref: user?.id ? null : identity,
        customer_name: typeof body.customer_name === "string" ? body.customer_name.slice(0, 120) : null,
        channel: typeof body.channel === "string" ? body.channel : "website",
        customer_request: request,
        ai_summary: typeof body.ai_summary === "string" ? body.ai_summary.slice(0, 2000) : null,
        suggested_action: subjectRef
          ? "Confirm sourcing and pricing with a verified supplier, then reply to the customer."
          : "Review the request and reply to the customer.",
        reason,
        subject_type: subjectRef ? "sourcing_result" : null,
        subject_id: subjectRef,
        transcript,
      })
      .select("id")
      .single();

    if (escalationError) {
      console.error("[request-sourcing] escalation insert failed:", escalationError.message);
      return json({ error: "Your request could not be recorded. Please try again." }, 500);
    }

    // Same approval engine as everything else. No bespoke path for sourcing.
    const { data: approval, error: approvalError } = await service
      .from("owner_approvals")
      .insert({
        action_type: subjectRef ? "sourcing_approval" : "customer_escalation",
        title: subjectTitle
          ? `Source: ${subjectTitle}`
          : `Customer needs help: ${request.slice(0, 80)}`,
        summary: typeof body.ai_summary === "string" ? body.ai_summary.slice(0, 2000) : request.slice(0, 500),
        payload,
        escalation_id: escalation.id,
      })
      .select("reference")
      .single();

    if (approvalError) {
      // The escalation exists and a human will still see it, so this is
      // reported but not treated as a total failure for the customer.
      console.error("[request-sourcing] approval insert failed:", approvalError.message);
    }

    return json({
      ok: true,
      // A reference the customer can quote. Deliberately not called an order
      // number, and no shipment state is implied.
      reference: approval?.reference ?? null,
      status: "requires_sourcing_confirmation",
    });
  } catch (error) {
    console.error("[request-sourcing] error:", error);
    return json({ error: "Your request could not be recorded. Please try again." }, 500);
  }
}
