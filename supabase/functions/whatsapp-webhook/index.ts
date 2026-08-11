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
import { streamChatCompletion, ProviderError } from "../_shared/aiProvider.ts";
import {
  clampReply,
  collectStream,
  detectLanguage,
  extractMessages,
  failureNotice,
  handoverNotice,
  replySignalsHandover,
  sendWhatsAppText,
  unsupportedTypeNotice,
  userAskedForHuman,
  verifySignature,
  welcomeFor,
} from "../_shared/whatsapp.ts";

/** How much prior conversation the model sees. Enough for context, bounded. */
const HISTORY_LIMIT = 12;

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

  for (const incoming of messages) {
    try {
      const language = detectLanguage(incoming.text);

      // ── Conversation record ───────────────────────────────────────────
      const { data: existing } = await db
        .from("whatsapp_conversations")
        .select("id, escalated")
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
      // user is not talking to both at once.
      if (existing?.escalated) continue;

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
        const stream = await streamChatCompletion({
          provider: assistant.provider,
          model: assistant.model,
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
