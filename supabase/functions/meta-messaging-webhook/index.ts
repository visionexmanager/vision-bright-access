// Facebook Messenger and Instagram Direct → the existing Visionex assistant.
//
// Visionex already answers customers on WhatsApp in production. This adds the
// other two Meta inboxes to the SAME assistant, the same provider chain and the
// same escalation model. It introduces no AI of its own: the model call below
// is `getAssistant(...)` plus `streamChatCompletionWithFallback`, which is what
// whatsapp-webhook does, and the language, handover and clamping helpers are
// imported from _shared/whatsapp.ts rather than reimplemented.
//
// ── Why this is not folded into whatsapp-webhook ───────────────────────────
//
// It is a different Meta webhook object (`page` / `instagram`, not
// `whatsapp_business_account`) with a completely different envelope:
// `entry[].messaging[]` here against `entry[].changes[].value.messages[]` there.
// It is verified with a different app secret, it answers on a different
// endpoint, and its ids are page-scoped rather than phone numbers.
//
// The decisive reason is narrower than any of those: whatsapp-webhook is live
// and carrying real customers. Editing it to add a second envelope means
// redeploying that path to ship this feature, and there is no version of that
// which is safer than leaving it alone.
//
// ── Nothing answers automatically until two separate things are true ───────
//
//   1. The platform granted the messaging permission, recorded from the OAuth
//      grant — `pages_messaging` or `instagram_manage_messages`.
//   2. A human set `messaging_enabled` on the account.
//
// meta_messaging_allowed() is the single statement of that rule. Until it says
// yes, every inbound message is still recorded — so the inbox is never silently
// losing customer messages — and no reply is sent.
//
// Required Edge Function secrets:
//   INSTAGRAM_WEBHOOK_VERIFY_TOKEN          - Instagram subscription handshake
//   FACEBOOK_MESSENGER_WEBHOOK_VERIFY_TOKEN - Messenger subscription handshake
//   INSTAGRAM_APP_SECRET                    - signs Instagram Login deliveries
//   META_APP_SECRET                         - signs Messenger (page) deliveries
//   INSTAGRAM_ACCESS_TOKEN                  - sends Instagram Direct replies
//   FACEBOOK_PAGE_ACCESS_TOKEN              - sends Messenger replies
//   SOCIAL_TOKEN_ENCRYPTION_KEY             - decrypts a stored OAuth grant
//
// ── Two app secrets, not one ───────────────────────────────────────────────
//
// Visionex runs Instagram API with Instagram Login, whose Instagram app has its
// own id and its own secret, separate from the Meta app that owns the page. Meta
// signs each delivery with the secret of the app the SUBSCRIPTION belongs to, so
// an Instagram delivery verified against META_APP_SECRET fails — and it fails as
// a 403, which looks exactly like an attack rather than a misconfiguration.
//
// Both are therefore tried, and a delivery is accepted if either matches. That
// is not a weakening: each is a secret only Meta and this function hold, and
// requiring the caller to declare which one it used would let the caller choose.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAssistant } from "../_shared/assistants.ts";
import { streamChatCompletionWithFallback, ProviderError } from "../_shared/aiProvider.ts";
import {
  clampReply,
  collectStream,
  detectLanguage,
  failureNotice,
  handoverNotice,
  replySignalsHandover,
  unsupportedTypeNotice,
  userAskedForHuman,
  verifySignature,
  welcomeFor,
} from "../_shared/whatsapp.ts";
import {
  channelForObject,
  parseMetaWebhook,
  sendMetaMessage,
  type MessagingFetch,
} from "../_shared/messaging/metaMessaging.ts";
import {
  withinMessagingWindow,
  type Channel,
  type NormalizedMessage,
} from "../_shared/messaging/types.ts";

const env = (name: string) => Deno.env.get(name);

/** How much prior conversation the model sees. Matches the WhatsApp path. */
const HISTORY_LIMIT = 12;

/** One reply must not hold the webhook open long enough for Meta to retry. */
const REPLY_TIMEOUT_MS = 20_000;

function service() {
  return createClient(env("SUPABASE_URL")!, env("SUPABASE_SERVICE_ROLE_KEY")!);
}

type Service = ReturnType<typeof service>;

/**
 * Compare two strings without leaking their common prefix through timing.
 *
 * Length is compared first and separately: it is not secret — an attacker can
 * learn it from the token they submit — and folding it into the loop would
 * either short-circuit or read past the end of the shorter string.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Race a promise against a deadline, returning null when the deadline wins. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: number | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ── The conversation ─────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  escalated: boolean;
  control: string;
  last_inbound_at: string | null;
  isNew: boolean;
}

async function upsertConversation(
  db: Service,
  incoming: NormalizedMessage,
  language: string,
  accountId: string | null,
): Promise<Conversation> {
  const { data: existing } = await db
    .from("meta_conversations")
    .select("id, escalated, control, last_inbound_at")
    .eq("channel", incoming.channel)
    .eq("external_user_id", incoming.senderId)
    .maybeSingle();

  if (existing) {
    await db
      .from("meta_conversations")
      .update({
        language,
        last_message_at: new Date().toISOString(),
        last_inbound_at: incoming.sentAt,
        ...(accountId ? { account_id: accountId } : {}),
      })
      .eq("id", existing.id);
    return { ...(existing as Omit<Conversation, "isNew">), isNew: false };
  }

  const { data: created, error } = await db
    .from("meta_conversations")
    .insert({
      channel: incoming.channel,
      external_user_id: incoming.senderId,
      external_account_id: incoming.recipientId,
      account_id: accountId,
      language,
      last_inbound_at: incoming.sentAt,
    })
    .select("id, escalated, control, last_inbound_at")
    .single();
  if (error) throw error;

  return { ...(created as Omit<Conversation, "isNew">), isNew: true };
}

async function escalate(db: Service, conversationId: string, reason: string) {
  await db
    .from("meta_conversations")
    .update({
      escalated: true,
      escalated_at: new Date().toISOString(),
      escalation_reason: reason,
    })
    .eq("id", conversationId);
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // ── The subscription handshake ──────────────────────────────────────────
  //
  // Meta calls this once, with a token typed into its console, to prove the URL
  // belongs to whoever is configuring it. Its own secret, not the WhatsApp one:
  // the two inboxes stay isolated so that rotating one cannot disturb the other.
  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    // Messenger and Instagram are configured as SEPARATE webhooks in the Meta
    // console — separate objects, separate field subscriptions, separate verify
    // tokens — that happen to point at this one callback URL. Each console
    // screen sends its own token, so both are accepted here.
    //
    // Keeping them as two secrets rather than one is what makes the channels
    // independently revocable: rotating Messenger's token cannot break the
    // Instagram subscription, and neither can touch WhatsApp's.
    const verifyTokens = [
      env("FACEBOOK_MESSENGER_WEBHOOK_VERIFY_TOKEN"),
      env("INSTAGRAM_WEBHOOK_VERIFY_TOKEN"),
    ].filter((value): value is string => typeof value === "string" && value !== "");

    if (verifyTokens.length === 0) return new Response("Not configured", { status: 503 });

    const mode = params.get("hub.mode");
    const provided = params.get("hub.verify_token");
    const challenge = params.get("hub.challenge");

    // Compared in constant time, and every candidate is compared even after a
    // match, so the reply time does not reveal WHICH channel's token was sent.
    let matched = false;
    for (const candidate of verifyTokens) {
      if (provided !== null && constantTimeEquals(provided, candidate)) matched = true;
    }

    if (mode === "subscribe" && matched) {
      // Meta requires the challenge echoed verbatim. A subscribe with no
      // challenge is malformed, and answering 200 with an empty body would let
      // Meta record the subscription as verified when nothing was proved.
      if (!challenge) return new Response("Bad Request", { status: 400 });
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Meta signs the exact bytes it sent, so the raw body is read before any
  // parsing — re-serialising the parsed object produces a signature that can
  // never match.
  const rawBody = await req.text();

  // Instagram Login deliveries are signed with the Instagram app's secret and
  // Messenger deliveries with the Meta app's. Both are tried; see the header.
  const secrets = [env("INSTAGRAM_APP_SECRET"), env("META_APP_SECRET")]
    .filter((value): value is string => typeof value === "string" && value !== "");

  if (secrets.length === 0) {
    // Fails closed. An unverifiable delivery is refused rather than trusted.
    console.error("[meta-messaging] no app secret configured — refusing the delivery.");
    return new Response("Not configured", { status: 503 });
  }

  let signed = false;
  for (const secret of secrets) {
    if (await verifySignature(rawBody, req.headers.get("x-hub-signature-256"), secret)) {
      signed = true;
      break;
    }
  }
  if (!signed) {
    console.error("[meta-messaging] signature verification failed.");
    return new Response("Forbidden", { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Acknowledged: Meta redelivers anything that is not a prompt 200, and a
    // body this function cannot parse will not parse on the retry either.
    return new Response("OK", { status: 200 });
  }

  const channel = channelForObject((payload as { object?: unknown })?.object);
  if (!channel) return new Response("OK", { status: 200 });

  const { messages, skipped } = parseMetaWebhook(payload, channel);

  // Echoes are the interesting half of this: they are the inbox's own outbound
  // messages coming back, and answering one starts a loop with a real customer
  // watching. Counted rather than silent so the log shows it is working.
  const echoes = skipped.filter((event) => event.reason === "echo").length;
  if (echoes > 0) console.log(`[meta-messaging] ${channel}: ignored ${echoes} echo(es).`);

  if (messages.length === 0) return new Response("OK", { status: 200 });

  const db = service();
  const encryptionKey = env("SOCIAL_TOKEN_ENCRYPTION_KEY");

  for (const incoming of messages) {
    try {
      const language = detectLanguage(incoming.text);

      // ── May this inbox answer at all? ─────────────────────────────────
      //
      // Asked before the conversation is touched, and its answer never stops
      // the message being recorded — an inbox that is not switched on must
      // still not lose what a customer wrote.
      const { data: permission } = await db.rpc("meta_messaging_allowed", {
        _channel: incoming.channel,
        _external_account_id: incoming.recipientId,
      });
      const allowed = permission?.ok === true;
      const accountId = (permission?.account_id as string | undefined) ?? null;

      const conversation = await upsertConversation(db, incoming, language, accountId);

      // ── Idempotency ───────────────────────────────────────────────────
      //
      // Meta redelivers on any non-200 with the SAME message id. The partial
      // unique index turns the retry into a no-op here, before the AI is
      // called and before anything is sent — so a retry storm costs nothing
      // and can never produce a second reply.
      const { error: duplicate } = await db.from("meta_messages").insert({
        conversation_id: conversation.id,
        direction: "inbound",
        external_message_id: incoming.messageId,
        body: incoming.text || `[${incoming.unsupportedType}]`,
      });
      if (duplicate) {
        if (duplicate.code === "23505") continue;
        throw duplicate;
      }

      if (!allowed) {
        // Recorded, not answered. The reason is logged as a code so the
        // difference between "not switched on" and "the platform never granted
        // the permission" is visible without opening the database.
        console.log(
          `[meta-messaging] ${incoming.channel}: recorded without replying — ${permission?.error ?? "not_allowed"}`,
        );
        continue;
      }

      // ── The messaging window ──────────────────────────────────────────
      //
      // Checked against what the customer last sent. Outside 24 hours a reply
      // needs a message tag or a paid channel; sending anyway would be a policy
      // violation, so the conversation goes to a human instead.
      if (!withinMessagingWindow(incoming.sentAt)) {
        await db.from("meta_messages").insert({
          conversation_id: conversation.id,
          direction: "outbound",
          kind: "window_closed",
          body: "[not sent: outside the 24-hour messaging window]",
        });
        await escalate(db, conversation.id, "messaging_window_closed");
        continue;
      }

      // ── The sending credential ────────────────────────────────────────
      //
      // Preferred: the encrypted per-account grant from the OAuth flow, which
      // is what a connected account has and what a second business would use.
      //
      // Fallback for Instagram: INSTAGRAM_ACCESS_TOKEN, the long-lived
      // Instagram User token generated in the app dashboard for an account
      // Visionex owns. This is the same shape as WHATSAPP_TOKEN — a permanent
      // credential for one owned identity — and it is why a single-account
      // deployment needs no Instagram Business Login onboarding at all. The
      // gate above still decides WHETHER to reply; this only decides with what.
      let token: string | null = null;

      if (encryptionKey && accountId) {
        const { data: grant } = await db.rpc("resolve_social_account_token", {
          _account_id: accountId,
          _key: encryptionKey,
        });
        if (grant?.ok === true && typeof grant.access_token === "string") {
          token = grant.access_token;
        } else {
          console.error(`[meta-messaging] stored grant unusable — ${grant?.error ?? "unknown"}.`);
        }
      }

      if (!token) {
        // Per-channel, and never shared. A Page token cannot send as Instagram
        // and an Instagram User token cannot post to a page, so falling back to
        // "whichever token exists" would produce an error that reads like a
        // permission problem on the wrong channel.
        token = incoming.channel === "instagram"
          ? env("INSTAGRAM_ACCESS_TOKEN") ?? null
          : env("FACEBOOK_PAGE_ACCESS_TOKEN") ?? null;
      }

      if (!token) {
        console.error("[meta-messaging] no sending credential available — recorded, no reply.");
        await escalate(db, conversation.id, "no_access_token");
        continue;
      }

      /** Record first, then send. A recorded reply that failed to send is
       *  recoverable; a sent reply nobody recorded is a duplicate waiting to
       *  happen on the next retry. */
      const reply = async (body: string, kind: string) => {
        await db.from("meta_messages").insert({
          conversation_id: conversation.id,
          direction: "outbound",
          kind,
          body,
        });
        const sent = await sendMetaMessage({
          channel: incoming.channel as Channel,
          fromAccountId: incoming.recipientId,
          toUserId: incoming.senderId,
          text: body,
          token,
          fetchImpl: fetch as unknown as MessagingFetch,
        });
        if (!sent.ok) {
          console.error(`[meta-messaging] send failed: ${sent.error}`);
          if (sent.error === "token_invalid" || sent.error === "permission_denied") {
            await escalate(db, conversation.id, sent.error);
          }
        }
        return sent.ok;
      };

      if (conversation.isNew) await reply(welcomeFor(language), "welcome");

      if (incoming.unsupportedType) {
        await reply(unsupportedTypeNotice(language, incoming.unsupportedType), "unsupported");
        continue;
      }

      // An explicit request for a person is honoured immediately.
      if (userAskedForHuman(incoming.text)) {
        await escalate(db, conversation.id, "user_request");
        await reply(handoverNotice(language), "handover");
        continue;
      }

      // Once a human owns the conversation the assistant stops answering, so
      // the customer is not talking to both at once.
      if (conversation.control === "human" || conversation.escalated) continue;

      // ── The existing assistant, unchanged ─────────────────────────────
      const { data: history } = await db
        .from("meta_messages")
        .select("direction, body, kind")
        .eq("conversation_id", conversation.id)
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
        const streamed = await withTimeout(
          streamChatCompletionWithFallback({
            targets: assistant.targets,
            system: assistant.systemPrompt,
            messages: turns.length > 0 ? turns : [{ role: "user", content: incoming.text }],
            maxTokens: 700,
          }),
          REPLY_TIMEOUT_MS,
        );
        if (!streamed) throw new Error("assistant timed out");
        answer = clampReply(await collectStream(streamed.result));
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 0;
        console.error("[meta-messaging] provider error:", status || e);
        await escalate(db, conversation.id, "ai_unavailable");
        await reply(failureNotice(language), "handover");
        continue;
      }

      if (!answer) {
        await escalate(db, conversation.id, "empty_reply");
        await reply(failureNotice(language), "handover");
        continue;
      }

      await reply(answer, "reply");

      if (replySignalsHandover(answer)) {
        await escalate(db, conversation.id, "assistant_handover");
      }
    } catch (e) {
      // One bad message must not drop the rest of the batch, and must not turn
      // into a non-200 — that would make Meta redeliver every message in this
      // delivery, including the ones already answered.
      console.error("[meta-messaging] failed to handle a message:", e instanceof Error ? e.message : e);
    }
  }

  return new Response("OK", { status: 200 });
});
