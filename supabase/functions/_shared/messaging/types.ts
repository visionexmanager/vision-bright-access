// One shape for an inbound customer message, whatever inbox it arrived in.
//
// Visionex answers customers on three Meta surfaces that look alike and are
// not: WhatsApp Cloud API, Facebook Messenger and Instagram Direct. Each has a
// different envelope, a different id for the same human, and a different set of
// events that are not messages at all. The assistant should see none of that.
//
// This file holds no logic and contacts nothing. It exists so the AI pipeline
// takes one type and the per-platform differences stop at the adapter.

/** The inboxes Visionex can receive a customer message in. */
export type Channel = "whatsapp" | "messenger" | "instagram";

/**
 * A customer message, normalised.
 *
 * Deliberately carries no token, no page access credential and no raw payload.
 * An adapter resolves those; what reaches the conversation pipeline is this.
 */
export interface NormalizedMessage {
  readonly channel: Channel;

  /**
   * The platform's id for the person who wrote.
   *
   * A phone number on WhatsApp, a page-scoped id (PSID) on Messenger, an
   * Instagram-scoped id (IGSID) on Instagram. The last two are scoped to the
   * receiving inbox: the same human writing to the page and to the Instagram
   * account is two different ids, and treating them as one would merge two
   * strangers' conversations.
   */
  readonly senderId: string;

  /**
   * The Visionex inbox that received it — page id, Instagram account id, or
   * WhatsApp phone number id. This is what selects which credential answers,
   * which is how the channels stay isolated from one another.
   */
  readonly recipientId: string;

  /** The platform's message id. The idempotency key for webhook retries. */
  readonly messageId: string;

  /** Empty when the message carried no text — see `unsupportedType`. */
  readonly text: string;

  /** Set for anything that is not plain text: image, audio, location, share. */
  readonly unsupportedType?: string;

  /**
   * When the platform says the customer sent it.
   *
   * Load-bearing rather than informational: Meta's standard messaging window is
   * measured from the customer's last message, and a reply outside it is a
   * policy violation rather than a failed request.
   */
  readonly sentAt: string;
}

/**
 * Everything an adapter had to skip, and why.
 *
 * Returned alongside the messages instead of being dropped silently, because
 * "the webhook fired and produced nothing" is otherwise indistinguishable from
 * a parsing bug — and the commonest entry here, an echo of the page's own
 * outbound message, is the one that causes a bot to answer itself in a loop.
 */
export interface SkippedEvent {
  readonly reason:
    | "echo"          // the inbox's own outbound message, reflected back
    | "delivery"      // a delivery receipt
    | "read"          // a read receipt
    | "reaction"      // an emoji reaction
    | "no_message"    // an event with no message payload at all
    | "unreadable";   // present but not in a shape this adapter understands
  readonly messageId?: string;
}

export interface ParsedWebhook {
  readonly messages: NormalizedMessage[];
  readonly skipped: SkippedEvent[];
}

/** Meta's standard messaging window, in hours, for Messenger and Instagram. */
export const MESSAGING_WINDOW_HOURS = 24;

/**
 * Whether a reply is still inside the standard messaging window.
 *
 * Outside it, a reply requires a message tag or a paid channel and is otherwise
 * a policy violation — so this is checked before sending rather than after the
 * platform refuses, and a closed window is recorded as a conversation needing a
 * human rather than as a delivery failure.
 *
 * A conversation with no recorded inbound message is treated as CLOSED. That is
 * the safe direction: it means Visionex has no evidence the customer wrote
 * first, and messaging them would be unsolicited.
 */
export function withinMessagingWindow(
  lastInboundAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!lastInboundAt) return false;
  const sent = Date.parse(lastInboundAt);
  if (!Number.isFinite(sent)) return false;
  const elapsedHours = (nowMs - sent) / 3_600_000;
  return elapsedHours >= 0 && elapsedHours < MESSAGING_WINDOW_HOURS;
}
