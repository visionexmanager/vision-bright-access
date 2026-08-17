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
import { proposeContent } from "../_shared/contentEngine.ts";
import { decideUnlessContentApproval } from "../_shared/content/proposalRules.ts";
import { normalizePhone } from "../_shared/ownerControl.ts";

type Action =
  | "decide_approval"
  | "transition_escalation"
  | "mark_viewed"
  | "set_conversation_control"
  // Phase 7. Content proposals are administrative decisions like any other, so
  // they arrive through this function and inherit its admin check rather than
  // getting an endpoint — and an authorization story — of their own.
  | "propose_content"
  | "decide_proposal"
  | "edit_proposal"
  | "regenerate_proposal"
  | "schedule_proposal"
  // Configuring which handset owns this account. It arrives here for the same
  // reason every other write does — the admin check below is server-side — and
  // because merging one key into a jsonb object is a read-modify-write that
  // must not be done from a browser, where two admins saving at once would
  // silently drop one of the other keys.
  | "set_owner_contact";

/** Matches generate_action_reference()'s alphabet and length. */
const REFERENCE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/;

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

        // A content proposal also has an approval row. Answering it here would
        // update that row and leave content_proposals.state behind, after which
        // the proposal can never be decided — its own path asks this same
        // engine and is told the approval is already answered. The guard owns
        // the call, so a content approval never reaches the engine at all and
        // no state changes.
        const { data: target } = await service
          .from("owner_approvals")
          .select("action_type")
          .eq("reference", reference)
          .maybeSingle();

        const routed = await decideUnlessContentApproval(
          target as { action_type: string } | null,
          () => service.rpc("decide_owner_approval", {
            _reference: reference,
            _approve: body.approve,
            _via: "admin_ui",
            _identifier: user.id,
            _note: note,
          }),
        );

        if (!routed.ok) {
          return json({ ok: false, reason: routed.error }, 409);
        }

        const { data, error } = routed.result as { data: unknown; error: { message: string } | null };
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

      // ── Phase 7: content proposals ─────────────────────────────────────

      case "propose_content":
      case "regenerate_proposal": {
        const supersedesRef = action === "regenerate_proposal"
          ? (typeof body.proposal_ref === "string" ? body.proposal_ref.trim().toUpperCase() : "")
          : undefined;

        if (action === "regenerate_proposal" && !REFERENCE_PATTERN.test(supersedesRef ?? "")) {
          return json({ error: "A valid proposal reference is required" }, 400);
        }

        // Regenerating inherits the previous proposal's framing: the owner
        // asked for another take on the same brief, not a different brief.
        let section = typeof body.section === "string" ? body.section : "";
        let contentType = typeof body.content_type === "string" ? body.content_type : "post";
        let platform = typeof body.platform === "string" ? body.platform : "website";
        let language: "en" | "ar" = body.language === "ar" ? "ar" : "en";

        if (supersedesRef) {
          const { data: previous } = await service
            .from("content_proposals")
            .select("section, content_type, platform, language, state")
            .eq("proposal_ref", supersedesRef)
            .maybeSingle();
          const row = previous as {
            section: string; content_type: string; platform: string;
            language: string; state: string;
          } | null;
          if (!row) return json({ ok: false, reason: "not_found" }, 409);
          if (!["PROPOSED", "EDITED"].includes(row.state)) {
            return json({ ok: false, reason: "not_pending", state: row.state }, 409);
          }
          section = row.section;
          contentType = row.content_type;
          platform = row.platform;
          language = row.language === "ar" ? "ar" : "en";
        }

        const result = await proposeContent(service, {
          section, contentType, platform, language,
          actorId: user.id,
          supersedesRef,
        });

        // A refusal here is usually the engine working: a duplicate topic, a
        // section on cooldown, or a draft that named something confidential.
        // The owner is told which, because "try again" is the wrong advice for
        // most of them.
        if (!result.ok) {
          return json({ ok: false, reason: result.error, detail: result.detail }, 409);
        }
        return json({ ok: true, proposal_ref: result.proposal_ref, reference: result.reference });
      }

      case "decide_proposal": {
        const proposalRef = typeof body.proposal_ref === "string" ? body.proposal_ref.trim().toUpperCase() : "";
        if (!REFERENCE_PATTERN.test(proposalRef)) {
          return json({ error: "A valid proposal reference is required" }, 400);
        }
        if (typeof body.approve !== "boolean") {
          return json({ error: "approve must be true or false" }, 400);
        }
        const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;

        // Wraps decide_owner_approval rather than replacing it: the existing
        // engine remains the only thing that can decide an approval.
        const { data, error } = await service.rpc("decide_content_proposal", {
          _proposal_ref: proposalRef,
          _approve: body.approve,
          _actor_id: user.id,
          _note: note,
        });
        if (error) {
          console.error("[owner-control] content decision failed:", error.message);
          return json({ error: "Decision could not be recorded" }, 500);
        }

        const result = data as { ok?: boolean; error?: string; state?: string };
        if (!result?.ok) return json({ ok: false, reason: result?.error ?? "not_pending" }, 409);

        await service
          .from("owner_approvals")
          .update({ decided_by_user_id: user.id })
          .eq("action_type", "content_publish")
          .eq("reference", (result as { reference?: string }).reference ?? "");

        return json({ ok: true, state: result.state });
      }

      case "edit_proposal": {
        const proposalRef = typeof body.proposal_ref === "string" ? body.proposal_ref.trim().toUpperCase() : "";
        if (!REFERENCE_PATTERN.test(proposalRef)) {
          return json({ error: "A valid proposal reference is required" }, 400);
        }

        const hashtags = Array.isArray(body.hashtags)
          ? (body.hashtags as unknown[]).filter((h): h is string => typeof h === "string").slice(0, 12)
          : null;

        const { data, error } = await service.rpc("record_content_proposal_edit", {
          _proposal_ref: proposalRef,
          _actor_id: user.id,
          _hook: typeof body.hook === "string" ? body.hook.slice(0, 300) : null,
          _body: typeof body.body === "string" ? body.body.slice(0, 8000) : null,
          _hashtags: hashtags,
          _proposed_publish_at: typeof body.proposed_publish_at === "string" ? body.proposed_publish_at : null,
          _note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
        });
        if (error) {
          console.error("[owner-control] content edit failed:", error.message);
          return json({ error: "Edit could not be recorded" }, 500);
        }

        const result = data as { ok?: boolean; error?: string; revision?: number };
        if (!result?.ok) return json({ ok: false, reason: result?.error ?? "not_editable" }, 409);
        return json({ ok: true, revision: result.revision });
      }

      case "schedule_proposal": {
        const proposalRef = typeof body.proposal_ref === "string" ? body.proposal_ref.trim().toUpperCase() : "";
        if (!REFERENCE_PATTERN.test(proposalRef)) {
          return json({ error: "A valid proposal reference is required" }, 400);
        }
        const when = typeof body.scheduled_for === "string" ? Date.parse(body.scheduled_for) : NaN;
        if (!Number.isFinite(when)) {
          return json({ error: "scheduled_for must be an ISO 8601 timestamp" }, 400);
        }

        // Records a plan. Nothing consumes this table in Phase 7 — there is no
        // publisher on the other side of it.
        const { data, error } = await service.rpc("schedule_content_proposal", {
          _proposal_ref: proposalRef,
          _scheduled_for: new Date(when).toISOString(),
          _actor_id: user.id,
          _note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
        });
        if (error) {
          console.error("[owner-control] scheduling failed:", error.message);
          return json({ error: "Scheduling could not be recorded" }, 500);
        }

        const result = data as { ok?: boolean; error?: string; scheduled_for?: string };
        if (!result?.ok) return json({ ok: false, reason: result?.error ?? "not_approved" }, 409);
        return json({ ok: true, scheduled_for: result.scheduled_for });
      }

      // ── Owner contact configuration ───────────────────────────────────
      //
      // Sets which handset is the owner. Deliberately NOT a new authorization
      // path: it reuses the admin check above, and it does not touch isOwner(),
      // command parsing or the rate limit — it only writes the number those
      // read. Storing a number that cannot be an owner would be worse than
      // storing none, so the value is validated with the SAME normalizePhone()
      // the webhook uses, against the same >= 8 digit floor isOwner() applies.
      case "set_owner_contact": {
        const raw = typeof body.whatsapp_number === "string" ? body.whatsapp_number : "";
        const digits = normalizePhone(raw);

        // isOwner() refuses an owner shorter than 8 digits, so accepting one
        // here would save a number that can never match a sender.
        if (digits.length < 8) return json({ ok: false, reason: "invalid_number" }, 400);
        if (digits.length > 15) return json({ ok: false, reason: "invalid_number" }, 400);

        // Read-modify-write: the row holds notification flags alongside the
        // number and they must survive. A missing row is treated as an empty
        // object rather than an error, so this works even if the seed migration
        // never ran.
        const { data: existing } = await service
          .from("site_settings")
          .select("value")
          .eq("key", "owner_contact")
          .maybeSingle();

        const current = (existing?.value ?? {}) as Record<string, unknown>;
        // A previous save may have stored a string instead of an object; in
        // that case the other keys are already unrecoverable, so start clean
        // rather than spreading a string into the object.
        const preserved = (current && typeof current === "object" && !Array.isArray(current))
          ? current
          : {};

        const value = { ...preserved, whatsapp_number: digits };

        const { error } = existing
          ? await service.from("site_settings").update({ value }).eq("key", "owner_contact")
          : await service.from("site_settings").insert({ key: "owner_contact", value });

        if (error) {
          console.error("[owner-control] owner contact save failed:", error.message);
          return json({ error: "The owner number could not be saved" }, 500);
        }

        // The number itself is never written to the audit log: the log is
        // readable by every admin and the conversation list already masks it.
        await service.from("audit_logs").insert({
          actor_id: user.id,
          action: "owner_contact_updated",
          entity_type: "site_setting",
          entity_id: null,
          metadata: { via: "admin_ui", digits: digits.length },
        });

        return json({ ok: true });
      }

      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (error) {
    console.error("[owner-control] error:", error);
    return json({ error: "Request failed" }, 500);
  }
});
