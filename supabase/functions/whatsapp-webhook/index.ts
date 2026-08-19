// WhatsApp Cloud API webhook → the existing Visionex assistant.
//
// This is the only new surface the WhatsApp AI needs. It does not introduce an
// AI: it looks up "whatsapp-support" in the same assistant registry the site
// uses and streams it through the same provider layer and the same
// OPENAI_API_KEY. No new vendor, no second model configuration.
//
// It stays inert until the Meta credentials below exist, and it never trusts a
// request it cannot cryptographically attribute to Meta.
//
// Required Edge Function secrets (none are committed anywhere):
//   WHATSAPP_VERIFY_TOKEN   - any random string; also typed into the Meta console
//   WHATSAPP_APP_SECRET     - Meta app secret, used to verify X-Hub-Signature-256
//   WHATSAPP_TOKEN          - permanent access token for the sending number
//   WHATSAPP_PHONE_NUMBER_ID- the Cloud API phone number id

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAssistant } from "../_shared/assistants.ts";
import { streamChatCompletionWithFallback, ProviderError } from "../_shared/aiProvider.ts";
import {
  clampReply,
  collectStream,
  detectLanguage,
  extractMessages,
  failureNotice,
  handoverNotice,
  rateLimitDecision,
  rateLimitNotice,
  RATE_LIMIT_COOLDOWN_MS,
  REPEAT_LIMIT,
  replySignalsHandover,
  sendWhatsAppText,
  unsupportedTypeNotice,
  userAskedForHuman,
  verifySignature,
  welcomeFor,
} from "../_shared/whatsapp.ts";
import {
  formatAmbiguityPrompt,
  formatPendingList,
  isOwner,
  parseOwnerCommand,
  type PendingApproval,
} from "../_shared/ownerControl.ts";

/** How much prior conversation the model sees. Enough for context, bounded. */
const HISTORY_LIMIT = 12;

/** Owner commands are cheap but not free; this bounds a compromised handset. */
const OWNER_COMMAND_LIMIT_PER_HOUR = 120;

/** Read the configured owner number. Never hard-coded, never in the client. */
async function ownerPhone(db: ReturnType<typeof service>): Promise<string | null> {
  const { data } = await db
    .from("site_settings")
    .select("value")
    .eq("key", "owner_contact")
    .maybeSingle();
  const value = (data?.value ?? {}) as { whatsapp_number?: string | null };
  return value.whatsapp_number ?? null;
}

/**
 * Handle a message from the configured owner.
 *
 * Reached only after the sender has been positively identified as the owner.
 * Returns the reply to send back, or null when the message was not a command
 * and should fall through to ordinary handling.
 */
async function handleOwnerCommand(
  db: ReturnType<typeof service>,
  from: string,
  text: string,
): Promise<string | null> {
  const command = parseOwnerCommand(text);
  if (command.kind === "unknown" && !command.reference) return null;

  // Rate limit: an owner handset that has been taken over should not be able
  // to churn through every pending decision unchecked.
  const { count } = await db
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "owner_command")
    .gte("created_at", new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) >= OWNER_COMMAND_LIMIT_PER_HOUR) {
    console.error("[whatsapp] owner command rate limit reached");
    return "Too many commands in the last hour. Try again shortly.";
  }

  await db.from("audit_logs").insert({
    action: `owner_command_${command.kind}`,
    entity_type: "owner_command",
    entity_id: null,
    metadata: { kind: command.kind, reference: command.reference, choice: command.choice },
  });

  // Content proposals are decided in the Owner Control Centre, where the
  // proposal and its approval move together. Excluding them here is what keeps
  // that true over this channel: a reference the listing never surfaced cannot
  // be found below, so the existing "no pending decision" reply answers it and
  // the engine is never reached. No branch, and nothing else changes.
  const { data: pendingRows } = await db
    .from("owner_approvals")
    .select("reference, action_type, title, summary, escalation_id")
    .eq("state", "WAITING_FOR_APPROVAL")
    .neq("action_type", "content_publish")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);
  const pending = (pendingRows ?? []) as Array<PendingApproval & { escalation_id: string | null }>;

  if (command.kind === "list_pending") return formatPendingList(pending);

  // A bare number carries no reference. It is only safe when exactly one
  // decision is outstanding; otherwise we ask rather than guess, because
  // guessing would apply a decision to the wrong customer's case.
  const target = command.reference
    ? pending.find((item) => item.reference === command.reference) ?? null
    : pending.length === 1
      ? pending[0]
      : null;

  if (!target && command.reference) {
    return `No pending decision with reference ${command.reference}. It may have been answered already or expired.`;
  }
  if (!target && pending.length > 1) return formatAmbiguityPrompt(pending);
  if (!target) return "Nothing is waiting for a decision right now.";

  if (command.kind === "approve" || command.kind === "reject") {
    const { data, error } = await db.rpc("decide_owner_approval", {
      _reference: target.reference,
      _approve: command.kind === "approve",
      _via: "whatsapp",
      _identifier: from,
      _note: command.note,
    });
    if (error) {
      console.error("[whatsapp] decide_owner_approval failed:", error.message);
      return "That decision could not be recorded. Please try again.";
    }
    const result = data as { ok?: boolean; error?: string };
    if (!result?.ok) {
      // Single-use by construction: a redelivered reply lands here.
      return `Reference ${target.reference} is no longer awaiting a decision.`;
    }

    if (target.escalation_id) {
      await db
        .from("support_escalations")
        .update({ state: command.kind === "approve" ? "OWNER_APPROVED" : "OWNER_REJECTED" })
        .eq("id", target.escalation_id);
    }
    return `${command.kind === "approve" ? "Approved" : "Rejected"} — ${target.reference}.`;
  }

  if (command.kind === "take_over" || command.kind === "return_to_ai") {
    const toHuman = command.kind === "take_over";
    if (target.escalation_id) {
      const { data: escalation } = await db
        .from("support_escalations")
        .select("customer_ref, channel")
        .eq("id", target.escalation_id)
        .maybeSingle();

      if (escalation?.channel === "whatsapp" && escalation.customer_ref) {
        await db
          .from("whatsapp_conversations")
          .update({
            control: toHuman ? "human" : "ai",
            control_changed_at: new Date().toISOString(),
            control_changed_by: "owner",
          })
          .eq("wa_phone", escalation.customer_ref);
      }

      await db
        .from("support_escalations")
        .update({ state: toHuman ? "OWNER_RESPONDED" : "RETURNED_TO_AI" })
        .eq("id", target.escalation_id);
    }

    await db.from("ai_feedback_events").insert({
      event_type: toHuman ? "owner_correction" : "action_succeeded",
      channel: "whatsapp",
      subject_type: "escalation",
      subject_id: target.escalation_id,
      summary: toHuman ? "Owner took over the conversation" : "Owner returned the conversation to the AI",
      detail: { reference: target.reference },
    });

    return toHuman
      ? `You now own this conversation (${target.reference}). The assistant will stay quiet until you return it.`
      : `Returned to the assistant (${target.reference}).`;
  }

  if (command.kind === "more_info") {
    return [
      `*${target.title}*  [${target.reference}]`,
      target.summary ?? "No further detail was recorded.",
    ].join("\n\n");
  }

  return null;
}

function service() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // ── Meta's verification handshake ──────────────────────────────────────
  // Called once when the webhook URL is saved in the Meta console.
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (verifyToken && mode === "subscribe" && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Read the raw body: Meta signs the exact bytes it sent, so re-serialising
  // the parsed object would produce a signature that never matches.
  const rawBody = await req.text();

  const appSecret = Deno.env.get("WHATSAPP_APP_SECRET");
  if (!appSecret) {
    console.error("[whatsapp] WHATSAPP_APP_SECRET is not configured — refusing the delivery.");
    return new Response("Not configured", { status: 503 });
  }

  const signed = await verifySignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret);
  if (!signed) {
    console.error("[whatsapp] signature verification failed.");
    return new Response("Forbidden", { status: 403 });
  }

  // Meta retries anything that is not a prompt 200, so acknowledge first and
  // let a processing failure surface in the logs rather than as a retry storm.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("OK", { status: 200 });
  }

  const messages = extractMessages(payload);
  if (messages.length === 0) {
    // Status callbacks (delivered/read) land here and are not errors.
    return new Response("OK", { status: 200 });
  }

  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId) {
    console.error("[whatsapp] sending credentials missing — message logged, no reply sent.");
  }

  const db = service();
  const configuredOwner = await ownerPhone(db);

  for (const incoming of messages) {
    try {
      const language = detectLanguage(incoming.text);

      // ── Owner control centre ──────────────────────────────────────────
      //
      // Authorization is by configured number, checked before anything else.
      // A message from any other number is a customer message and is never
      // interpreted as a command, whatever it says.
      if (incoming.text && isOwner(incoming.from, configuredOwner)) {
        const reply = await handleOwnerCommand(db, incoming.from, incoming.text);
        if (reply) {
          if (token && phoneNumberId) {
            await sendWhatsAppText({ phoneNumberId, token, to: incoming.from, body: reply });
          }
          continue;
        }
        // Not a command — fall through and treat it as an ordinary message.
      }

      // ── Conversation record ───────────────────────────────────────────
      const { data: existing } = await db
        .from("whatsapp_conversations")
        .select("id, escalated, control, blocked_until, rate_notified_at, rate_limit_hits")
        .eq("wa_phone", incoming.from)
        .maybeSingle();

      let conversationId = existing?.id as string | undefined;
      const isNew = !conversationId;

      if (!conversationId) {
        const { data: created, error } = await db
          .from("whatsapp_conversations")
          .insert({ wa_phone: incoming.from, language })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = created.id as string;
      } else {
        await db
          .from("whatsapp_conversations")
          .update({ language, last_message_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      // Meta redelivers on any non-200, so the same message id can arrive
      // twice. The unique index on wa_message_id makes the retry a no-op
      // instead of a second AI call and a duplicate reply.
      const { error: dupe } = await db.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        direction: "inbound",
        wa_message_id: incoming.messageId,
        body: incoming.text || `[${incoming.unsupportedType}]`,
      });
      if (dupe) {
        if (dupe.code === "23505") continue;
        throw dupe;
      }

      const reply = async (body: string, kind: string) => {
        await db.from("whatsapp_messages").insert({
          conversation_id: conversationId,
          direction: "outbound",
          body,
          kind,
        });
        if (token && phoneNumberId) {
          await sendWhatsAppText({ phoneNumberId, token, to: incoming.from, body });
        }
      };

      // ── Abuse control ─────────────────────────────────────────────────
      //
      // Placed after the message is logged, so a throttled sender is still
      // recorded in the transcript and the team can see what was sent. Only
      // the model call and the reply are withheld. The owner is exempt: their
      // commands have their own separate limit above.
      if (!isNew && !isOwner(incoming.from, configuredOwner)) {
        const nowMs = Date.now();
        const [{ count: hourCount }, { count: minuteCount }, { data: recent }] = await Promise.all([
          db.from("whatsapp_messages").select("id", { count: "exact", head: true })
            .eq("conversation_id", conversationId).eq("direction", "inbound")
            .gte("created_at", new Date(nowMs - 3_600_000).toISOString()),
          db.from("whatsapp_messages").select("id", { count: "exact", head: true })
            .eq("conversation_id", conversationId).eq("direction", "inbound")
            .gte("created_at", new Date(nowMs - 60_000).toISOString()),
          db.from("whatsapp_messages").select("body")
            .eq("conversation_id", conversationId).eq("direction", "inbound")
            .order("created_at", { ascending: false }).limit(REPEAT_LIMIT),
        ]);

        const body = incoming.text || `[${incoming.unsupportedType}]`;
        const repeatCount = (recent ?? []).filter((row) => row.body === body).length;

        const verdict = rateLimitDecision({
          now: nowMs,
          blockedUntil: existing?.blocked_until ? Date.parse(existing.blocked_until as string) : null,
          notifiedAt: existing?.rate_notified_at ? Date.parse(existing.rate_notified_at as string) : null,
          lastHourCount: hourCount ?? 0,
          lastMinuteCount: minuteCount ?? 0,
          repeatCount,
        });

        if (!verdict.allow) {
          console.error(
            `[whatsapp] throttled: reason=${verdict.reason} hour=${hourCount} minute=${minuteCount} repeat=${repeatCount}`,
          );
          await db
            .from("whatsapp_conversations")
            .update({
              blocked_until: new Date(nowMs + RATE_LIMIT_COOLDOWN_MS).toISOString(),
              rate_limit_hits: ((existing?.rate_limit_hits as number) ?? 0) + 1,
              ...(verdict.notify ? { rate_notified_at: new Date(nowMs).toISOString() } : {}),
            })
            .eq("id", conversationId);

          if (verdict.notify) await reply(rateLimitNotice(language), "unsupported");
          continue;
        }
      }

      if (isNew) await reply(welcomeFor(language), "welcome");

      // Images, voice notes, locations: acknowledged rather than ignored.
      if (incoming.unsupportedType) {
        await reply(unsupportedTypeNotice(language, incoming.unsupportedType), "unsupported");
        continue;
      }

      // An explicit request for a person is honoured immediately — the model
      // does not get to talk the user out of it.
      if (userAskedForHuman(incoming.text)) {
        await db
          .from("whatsapp_conversations")
          .update({ escalated: true, escalated_at: new Date().toISOString(), escalation_reason: "user_request" })
          .eq("id", conversationId);
        await reply(handoverNotice(language), "handover");
        continue;
      }

      // Once a human owns the conversation, the bot stops answering so the
      // user is not talking to both at once. `control` is the explicit
      // owner-set state; `escalated` is the automatic one. Either silences
      // the assistant, and only the owner can hand control back.
      if (existing?.control === "human" || existing?.escalated) continue;

      // ── Ask the existing assistant ────────────────────────────────────
      const { data: history } = await db
        .from("whatsapp_messages")
        .select("direction, body, kind")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);

      const turns = (history ?? [])
        .filter((row) => row.kind === null || row.kind === "reply")
        .reverse()
        .map((row) => ({
          role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
          content: row.body as string,
        }));

      const assistant = getAssistant("whatsapp-support");
      if (!assistant) throw new Error("whatsapp-support assistant is not registered");

      let answer: string;
      try {
        const { result: stream } = await streamChatCompletionWithFallback({
          targets: assistant.targets,
          system: assistant.systemPrompt,
          messages: turns.length > 0 ? turns : [{ role: "user", content: incoming.text }],
          maxTokens: 700,
        });
        answer = clampReply(await collectStream(stream));
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 0;
        console.error("[whatsapp] provider error:", status || e);
        await db
          .from("whatsapp_conversations")
          .update({ escalated: true, escalated_at: new Date().toISOString(), escalation_reason: "ai_unavailable" })
          .eq("id", conversationId);
        await reply(failureNotice(language), "handover");
        continue;
      }

      if (!answer) {
        await reply(failureNotice(language), "handover");
        continue;
      }

      await reply(answer, "reply");

      // The model was told to say it is handing over when it cannot help.
      // Flag the conversation so the team sees it in the queue.
      if (replySignalsHandover(answer)) {
        await db
          .from("whatsapp_conversations")
          .update({ escalated: true, escalated_at: new Date().toISOString(), escalation_reason: "assistant_handover" })
          .eq("id", conversationId);
      }
    } catch (e) {
      // One bad message must not drop the rest of the batch.
      console.error("[whatsapp] failed to handle a message:", e instanceof Error ? e.message : e);
    }
  }

  return new Response("OK", { status: 200 });
});
