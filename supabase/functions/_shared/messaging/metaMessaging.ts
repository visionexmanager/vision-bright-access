// The Facebook Messenger and Instagram Direct adapter.
//
// Parsing in, sending out, and nothing else — no AI, no database, no
// conversation logic. Those belong to the pipeline the WhatsApp webhook already
// established, and duplicating any of them here is exactly what this file is
// shaped to avoid.
//
// ── Why one adapter for two products ───────────────────────────────────────
//
// Messenger and Instagram Direct share an envelope: the same `entry[].messaging[]`
// array, the same message shape, the same send endpoint form. They differ in the
// webhook object name, the id they scope users by, and the permission that
// gates them. Two files would be the same file twice.
//
// ── What must never happen here ────────────────────────────────────────────
//
// An echo — the inbox's own outbound message reflected back by Meta — must not
// reach the pipeline. It arrives on the same webhook, in the same array, and
// looks like an ordinary message except for `is_echo`. Answering one makes the
// assistant reply to itself, and then reply to that, for as long as the window
// is open. It is dropped in parse(), before anything can act on it.

import { GRAPH_BASE, GRAPH_VERSION } from "../meta.ts";
import type {
  Channel,
  NormalizedMessage,
  ParsedWebhook,
  SkippedEvent,
} from "./types.ts";

/** The webhook `object` values Meta sends for the two inboxes. */
export const MESSENGER_OBJECT = "page";
export const INSTAGRAM_OBJECT = "instagram";

/**
 * Instagram's own host.
 *
 * Instagram API with Instagram Login — the configuration Visionex uses, with an
 * Instagram app id distinct from the Meta app id — issues Instagram User tokens
 * that are NOT Page tokens and are not accepted by graph.facebook.com. Its
 * messaging endpoint is `/me/messages` on this host, where `me` is resolved
 * from the token rather than addressed by id.
 *
 * Messenger keeps graph.facebook.com and a page id. The two are not
 * interchangeable, and sending one to the other's host fails with an error that
 * reads like a permission problem.
 */
export const INSTAGRAM_GRAPH = "https://graph.instagram.com";

/** Which channel a webhook body describes, or null when it is neither. */
export function channelForObject(object: unknown): Channel | null {
  if (object === MESSENGER_OBJECT) return "messenger";
  if (object === INSTAGRAM_OBJECT) return "instagram";
  return null;
}

/**
 * The permission each inbox needs before it may answer. Stated here as well as
 * in SQL because the webhook logs which scope was missing, and a code naming
 * the permission is worth more to whoever reads it than one saying `forbidden`.
 *
 * Instagram has two product configurations with two different permission
 * vocabularies, and Visionex uses the newer one:
 *
 *   Instagram API with Facebook Login  →  instagram_manage_messages
 *   Instagram API with Instagram Login →  instagram_business_manage_messages
 *
 * Both are accepted. The account is connected under one or the other, the
 * platform reports whichever it granted, and hard-coding a single name means
 * a correctly-approved app reads as unapproved.
 */
export const MESSAGING_SCOPES: Readonly<Record<Channel, readonly string[]>> = {
  messenger: ["pages_messaging"],
  instagram: ["instagram_business_manage_messages", "instagram_manage_messages"],
  // WhatsApp is not granted through this OAuth flow at all — it is authorised
  // by a permanent System User token configured outside it.
  whatsapp: [],
};

/** The permission to name in a refusal: the current one for that product. */
export const MESSAGING_SCOPE: Readonly<Record<Channel, string | null>> = {
  messenger: "pages_messaging",
  instagram: "instagram_business_manage_messages",
  whatsapp: null,
};

function nonEmpty(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Name the first attachment type, for the "I cannot read this yet" reply.
 *
 * Meta nests attachments differently per product and per media kind; only the
 * `type` is needed and everything else is ignored on purpose.
 */
function attachmentType(message: Record<string, unknown>): string | undefined {
  const attachments = message.attachments;
  if (!Array.isArray(attachments) || attachments.length === 0) return undefined;
  const first = attachments[0];
  if (!first || typeof first !== "object") return "attachment";
  return nonEmpty((first as Record<string, unknown>).type) ?? "attachment";
}

/**
 * Turn one webhook delivery into normalised messages.
 *
 * Never throws. A webhook parser that throws turns a malformed delivery into a
 * non-200, and a non-200 makes Meta redeliver the same bytes — so a parsing bug
 * would become a retry storm against the same bug.
 */
export function parseMetaWebhook(payload: unknown, channel: Channel): ParsedWebhook {
  const messages: NormalizedMessage[] = [];
  const skipped: SkippedEvent[] = [];

  const entries = (payload as { entry?: unknown })?.entry;
  if (!Array.isArray(entries)) return { messages, skipped };

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const events = (entry as Record<string, unknown>).messaging;
    if (!Array.isArray(events)) continue;

    for (const raw of events) {
      if (!raw || typeof raw !== "object") {
        skipped.push({ reason: "unreadable" });
        continue;
      }
      const event = raw as Record<string, unknown>;

      // Receipts and reactions share the array with real messages.
      if (event.delivery) { skipped.push({ reason: "delivery" }); continue; }
      if (event.read)     { skipped.push({ reason: "read" }); continue; }
      if (event.reaction) { skipped.push({ reason: "reaction" }); continue; }

      const message = event.message;
      if (!message || typeof message !== "object") {
        skipped.push({ reason: "no_message" });
        continue;
      }
      const body = message as Record<string, unknown>;

      // The loop-breaker. See the header.
      if (body.is_echo === true) {
        skipped.push({ reason: "echo", messageId: nonEmpty(body.mid) });
        continue;
      }

      const senderId = nonEmpty((event.sender as Record<string, unknown> | undefined)?.id);
      const recipientId = nonEmpty((event.recipient as Record<string, unknown> | undefined)?.id);
      const messageId = nonEmpty(body.mid);

      // Without all three there is nobody to answer, no inbox to answer from,
      // or no id to make the retry idempotent. Any of those is unusable.
      if (!senderId || !recipientId || !messageId) {
        skipped.push({ reason: "unreadable", messageId });
        continue;
      }

      const text = nonEmpty(body.text) ?? "";
      const unsupportedType = text === "" ? attachmentType(body) ?? "unknown" : undefined;

      const timestamp = typeof event.timestamp === "number" ? event.timestamp : Date.now();

      messages.push({
        channel,
        senderId,
        recipientId,
        messageId,
        text,
        unsupportedType,
        sentAt: new Date(timestamp).toISOString(),
      });
    }
  }

  return { messages, skipped };
}

// ── Sending ──────────────────────────────────────────────────────────────────

export type MessagingFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface SendResult {
  readonly ok: boolean;
  /** Meta's id for the message it sent. */
  readonly messageId?: string;
  /** A short machine code. Never anything the platform said. */
  readonly error?: string;
}

/**
 * Send one reply.
 *
 * `messaging_type: "RESPONSE"` is not decoration: it is the declaration that
 * this message answers something the customer sent, which is the only category
 * Visionex uses. The other categories exist to start conversations, and nothing
 * in this codebase does that.
 *
 * The token travels in the Authorization header, never in the query string —
 * a page access token in a URL ends up in every proxy and access log on the way.
 *
 * No retry. A resend after an ambiguous failure is a duplicate message to a
 * real customer, and the caller records the attempt either way.
 */
export async function sendMetaMessage(params: {
  channel: Channel;
  /** The page id or Instagram account id the reply is sent FROM. */
  fromAccountId: string;
  /** The PSID or IGSID the reply is sent TO. */
  toUserId: string;
  text: string;
  token: string;
  fetchImpl: MessagingFetch;
  timeoutMs?: number;
}): Promise<SendResult> {
  const { channel, fromAccountId, toUserId, text, token, fetchImpl } = params;

  // Instagram Login tokens are Instagram User tokens and are refused by
  // graph.facebook.com; the account is identified by the token rather than by
  // an id in the path. Messenger is the opposite on both counts.
  const url = channel === "instagram"
    ? `${INSTAGRAM_GRAPH}/${GRAPH_VERSION}/me/messages`
    : `${GRAPH_BASE}/${fromAccountId}/messages`;
  const payload = JSON.stringify({
    recipient: { id: toUserId },
    message: { text },
    messaging_type: "RESPONSE",
  });

  let response: { ok: boolean; status: number; json(): Promise<unknown> };
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });
  } catch {
    // Nothing came back. The message may or may not have been delivered, so it
    // is recorded as attempted and never re-sent.
    return { ok: false, error: "platform_unreachable" };
  }

  const raw = await response.json().catch(() => null);
  const bodyObj = raw && typeof raw === "object" ? raw as Record<string, unknown> : null;
  const error = bodyObj?.error && typeof bodyObj.error === "object"
    ? bodyObj.error as Record<string, unknown>
    : null;

  if (error) {
    const code = typeof error.code === "number" ? error.code : undefined;
    // 190: the token is expired or revoked — reconnect the account.
    if (code === 190) return { ok: false, error: "token_invalid" };
    // 10 / 200: the permission is missing, which after App Review means the
    // page did not actually grant it.
    if (code === 10 || code === 200) return { ok: false, error: "permission_denied" };
    // 551 / 10900-series: outside the messaging window, or the person blocked
    // the inbox. Not retryable and not a fault.
    if (code === 551) return { ok: false, error: "recipient_unavailable" };
    if (code === 4 || code === 17 || code === 32 || code === 613) {
      return { ok: false, error: "platform_rate_limited" };
    }
    return { ok: false, error: "platform_rejected" };
  }

  if (response.status === 429) return { ok: false, error: "platform_rate_limited" };
  if (!response.ok || !bodyObj) return { ok: false, error: "platform_answer_unreadable" };

  return { ok: true, messageId: nonEmpty(bodyObj.message_id) };
}
