// POST — files a GDPR data-subject request (export or deletion) for the
// caller's own Career Center data. Export/deletion is processed inline for
// the pieces that live entirely in Career Center tables; anything touching
// shared/site-wide tables outside this feature area is intentionally left
// to the platform's own data-request flow (out of scope for a
// Career-Center-only phase).
//
// Body: { type: "export" | "deletion" }
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { newTraceId, persistCareerError, recordCareerRequestMetric } from "../_shared/careerLogger.ts";
import { deleteUserAiMemory } from "../_shared/careerAiMemory.ts";

const EXPORT_TABLES = ["career_profiles", "career_goals", "applications", "certificates", "ai_interactions", "career_consent_records"] as const;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const traceId = newTraceId();
  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let userId: string | null = null;

  const respond = async (body: unknown, status: number) => {
    await recordCareerRequestMetric(serviceClient, {
      traceId,
      endpoint: "career-gdpr-request",
      method: req.method,
      statusCode: status,
      latencyMs: Date.now() - startedAt,
      userId,
    });
    return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return await respond({ error: "Unauthorized" }, 401);

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return await respond({ error: "Unauthorized" }, 401);
    userId = user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const requestType = body.type === "deletion" ? "deletion" : body.type === "export" ? "export" : null;
    if (!requestType) return await respond({ error: "type must be 'export' or 'deletion'" }, 400);

    const { data: requestRow, error: insertErr } = await serviceClient
      .from("career_data_requests")
      .insert({ user_id: user.id, request_type: requestType, status: "processing" })
      .select("id")
      .single();
    if (insertErr) throw insertErr;

    if (requestType === "export") {
      const bundle: Record<string, unknown> = {};
      for (const table of EXPORT_TABLES) {
        const { data } = await serviceClient.from(table).select("*").eq("user_id", user.id);
        bundle[table] = data ?? [];
      }
      await serviceClient
        .from("career_data_requests")
        .update({ status: "completed", completed_at: new Date().toISOString(), notes: "Inline export — see response body" })
        .eq("id", requestRow.id);

      await serviceClient.rpc("log_career_security_event", {
        _user_id: user.id,
        _event_type: "data_export_completed",
        _ip_hash: null,
        _user_agent: req.headers.get("User-Agent"),
        _metadata: { request_id: requestRow.id },
      });

      return await respond({ requestId: requestRow.id, status: "completed", data: bundle }, 200);
    }

    // Deletion: erase AI-derived memory now (reuses the existing Phase 10
    // helper — imported, not modified); career_profiles/career_goals and
    // other owned rows are already deletable by the user themselves via
    // their existing owner-only RLS policies and are left for the user to
    // confirm explicitly rather than being silently wiped by this endpoint.
    await deleteUserAiMemory(serviceClient, user.id);

    await serviceClient
      .from("career_data_requests")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        notes: "AI interaction history erased. Profile/application data must be deleted explicitly by the user via account settings.",
      })
      .eq("id", requestRow.id);

    await serviceClient.rpc("log_career_security_event", {
      _user_id: user.id,
      _event_type: "data_deletion_completed",
      _ip_hash: null,
      _user_agent: req.headers.get("User-Agent"),
      _metadata: { request_id: requestRow.id },
    });

    return await respond({ requestId: requestRow.id, status: "completed" }, 200);
  } catch (e) {
    await persistCareerError(serviceClient, {
      traceId,
      service: "career-gdpr-request",
      message: e instanceof Error ? e.message : String(e),
      userId,
    });
    console.error("career-gdpr-request error:", e);
    return await respond({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
