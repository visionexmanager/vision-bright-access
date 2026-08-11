// Owner Control Centre — the dashboard's write path.
//
// The browser cannot decide anything. Both engine functions are service-role
// only, so every action arrives here, is authorized against the caller's real
// session and role, and is then executed by the same Phase 4 engine WhatsApp
// will use. There is one approval path, not one per channel.
//
// A frontend flag never authorizes anything: the admin check below runs
// server-side on every call, and the database transition guards remain the
// final word even if this function were wrong.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

type Action =
  | "decide_approval"
  | "transition_escalation"
  | "mark_viewed"
  | "set_conversation_control";

const ESCALATION_STATES = new Set([
  "OWNER_VIEWED", "OWNER_APPROVED", "OWNER_REJECTED",
  "OWNER_RESPONDED", "RETURNED_TO_AI", "RESOLVED", "FAILED",
]);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // ── Authenticate the real session, not a claim in the body ──────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const asCaller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await asCaller.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Role is read with the service client so a caller cannot influence the
    // answer through their own RLS context.
    const { data: role } = await service
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;

    switch (action) {
      case "decide_approval": {
        const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
        if (!/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/.test(reference)) {
          return json({ error: "A valid approval reference is required" }, 400);
        }
        if (typeof body.approve !== "boolean") {
          return json({ error: "approve must be true or false" }, 400);
        }
        const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

        // The same engine WhatsApp calls. Single-use by construction: a second
        // dashboard session deciding the same reference gets not_pending.
        const { data, error } = await service.rpc("decide_owner_approval", {
          _reference: reference,
          _approve: body.approve,
          _via: "admin_ui",
          _identifier: user.id,
          _note: note,
        });
        if (error) {
          console.error("[owner-control] decide failed:", error.message);
          return json({ error: "Decision could not be recorded" }, 500);
        }

        const result = data as { ok?: boolean; error?: string; escalation_id?: string | null };
        if (!result?.ok) {
          // Concurrency and replay land here identically, which is correct:
          // in both cases the decision was already made by someone else.
          return json({ ok: false, reason: result?.error ?? "not_pending" }, 409);
        }

        if (result.escalation_id) {
          await service.rpc("transition_escalation", {
            _escalation_id: result.escalation_id,
            _next_state: body.approve ? "OWNER_APPROVED" : "OWNER_REJECTED",
            _via: "admin_ui",
            _actor_id: user.id,
            _note: note,
          });
        }

        // Attribute the decision to the signed-in admin. decide_owner_approval
        // stores the identifier it was given; this records who that was.
        await service
          .from("owner_approvals")
          .update({ decided_by_user_id: user.id })
          .eq("reference", reference);

        return json({ ok: true, reference });
      }

      case "transition_escalation": {
        const id = typeof body.escalation_id === "string" ? body.escalation_id : "";
        const next = typeof body.next_state === "string" ? body.next_state : "";
        if (!id || !ESCALATION_STATES.has(next)) {
          return json({ error: "escalation_id and a valid next_state are required" }, 400);
        }
        const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

        const { data, error } = await service.rpc("transition_escalation", {
          _escalation_id: id,
          _next_state: next,
          _via: "admin_ui",
          _actor_id: user.id,
          _note: note,
        });
        if (error) {
          console.error("[owner-control] transition failed:", error.message);
          return json({ error: "Transition could not be applied" }, 500);
        }
        const result = data as { ok?: boolean; error?: string; from?: string; to?: string };
        if (!result?.ok) return json({ ok: false, ...result }, 409);
        return json({ ok: true, state: next });
      }

      case "mark_viewed": {
        const id = typeof body.escalation_id === "string" ? body.escalation_id : "";
        if (!id) return json({ error: "escalation_id is required" }, 400);
        await service.rpc("mark_escalation_viewed", { _escalation_id: id });
        return json({ ok: true });
      }

      case "set_conversation_control": {
        const phone = typeof body.wa_phone === "string" ? body.wa_phone : "";
        const control = body.control === "human" ? "human" : "ai";
        if (!phone) return json({ error: "wa_phone is required" }, 400);

        await service
          .from("whatsapp_conversations")
          .update({
            control,
            control_changed_at: new Date().toISOString(),
            control_changed_by: "admin_ui",
          })
          .eq("wa_phone", phone);

        await service.from("audit_logs").insert({
          actor_id: user.id,
          action: `conversation_control_${control}`,
          entity_type: "whatsapp_conversation",
          entity_id: null,
          metadata: { via: "admin_ui" },
        });

        return json({ ok: true, control });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    console.error("[owner-control] error:", error);
    return json({ error: "Request failed" }, 500);
  }
});
