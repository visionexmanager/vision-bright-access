// WhatsApp Cloud API helpers.
//
// Everything here is pure or clearly isolated I/O so the parts that decide
// *what* to send can be tested without a Meta account. The webhook itself only
// wires these together.

import { GRAPH_BASE } from "./meta.ts";

/** Greeting sent once per conversation, before the assistant takes over. */
export const WELCOME_AR = `أهلاً وسهلاً في Visionex 👋
شكراً لتواصلك معنا.
أنا المساعد الذكي لـVisionex، وفيني ساعدك مباشرة.
فيني ساعدك بالدعم الفني، الفوترة والدفع، معلومات Visionex، المتاجر والخدمات، أو أي استفسار آخر.
اكتب طلبك مباشرة وأنا رح ساعدك.`;

export const WELCOME_EN = `Welcome to Visionex 👋
Thank you for reaching out.
I'm the Visionex AI assistant, and I can help you right here.
I can help with technical support, billing and payments, information about Visionex, stores and services, or anything else you need.
Just tell me what you need and I'll help.`;

/**
 * Arabic script anywhere in the message means answer in Arabic. WhatsApp gives
 * no locale for the sender, and a name or a phone prefix is not a language, so
 * the text itself is the only honest signal.
 */
export function detectLanguage(text: string): "ar" | "en" {
  return /[؀-ۿ]/.test(text) ? "ar" : "en";
}

export function welcomeFor(language: "ar" | "en"): string {
  return language === "ar" ? WELCOME_AR : WELCOME_EN;
}

/**
 * Said to the user when the assistant hands the conversation over. Kept
 * separate from the model output so the promise is always the same sentence
 * and never an invented timeline.
 */
export function handoverNotice(language: "ar" | "en"): string {
  return language === "ar"
    ? "سأحوّل هذه المحادثة إلى فريق Visionex ليتابعها معك. تم تسجيل رسالتك، وسيتواصل معك أحد أفراد الفريق."
    : "I'm passing this conversation to the Visionex team so they can follow up. Your message has been logged and someone from the team will get back to you.";
}

/** Shown when the AI provider is unreachable, so the user is never left silent. */
export function failureNotice(language: "ar" | "en"): string {
  return language === "ar"
    ? "تعذّر عليّ الرد الآن. تم تسجيل رسالتك وسيتابعها فريق Visionex. يمكنك أيضاً مراسلتنا عبر https://visionex.app/contact"
    : "I couldn't answer just now. Your message has been logged and the Visionex team will follow up. You can also reach us at https://visionex.app/contact";
}

/**
 * Explicit requests for a person, in both languages. Matched on the user's
 * message rather than on the model's reply, so a user can always escape the
 * bot even when the model is confident it can help.
 */
const HUMAN_REQUEST = [
  /\b(human|agent|real person|speak to (someone|a person)|customer service|representative)\b/i,
  /(موظف|شخص حقيقي|بدي احكي مع حدا|بدي أحكي مع حدا|خدمة العملاء|ممثل خدمة|حدا من الفريق|انسان)/,
];

/**
 * Phrases the assistant is instructed to use when it gives up. Detected so the
 * conversation is flagged for the team even though the model, not the code,
 * made the call.
 */
const MODEL_HANDOVER = [
  /passing (this|it) (conversation )?to the visionex team/i,
  /(سأحوّل|سأحول|رح حوّل|رح أحول).{0,40}(الفريق|فريق)/,
];

export function userAskedForHuman(text: string): boolean {
  return HUMAN_REQUEST.some((pattern) => pattern.test(text));
}

export function replySignalsHandover(reply: string): boolean {
  return MODEL_HANDOVER.some((pattern) => pattern.test(reply));
}

/**
 * Verify Meta's X-Hub-Signature-256 header.
 *
 * Meta signs the exact bytes it sent, so the caller must pass the raw body —
 * re-serialising the parsed JSON produces a different string and a signature
 * that never matches. Comparison is constant-time.
 */
export async function verifySignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!header?.startsWith("sha256=")) return false;
  const provided = header.slice("sha256=".length).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(mac)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  // Lengths are equal by construction (both 64 hex chars), so a plain
  // fixed-length XOR accumulate is a constant-time comparison.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

export interface IncomingMessage {
  from: string;
  messageId: string;
  text: string;
  /** Present for anything that is not plain text (image, audio, location…). */
  unsupportedType?: string;
}

/**
 * Pull the text messages out of a Cloud API webhook payload.
 *
 * The envelope is deeply nested and every level is optional; a status callback
 * (delivered/read receipts) carries no `messages` array at all and must yield
 * nothing rather than throwing.
 */
export function extractMessages(payload: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;
  if (!Array.isArray(entries)) return out;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown[] } })?.value?.messages;
      if (!Array.isArray(messages)) continue;

      for (const message of messages) {
        const m = message as {
          from?: string;
          id?: string;
          type?: string;
          text?: { body?: string };
        };
        if (!m.from || !m.id) continue;

        if (m.type === "text" && typeof m.text?.body === "string") {
          out.push({ from: m.from, messageId: m.id, text: m.text.body });
        } else if (m.type) {
          out.push({ from: m.from, messageId: m.id, text: "", unsupportedType: m.type });
        }
      }
    }
  }
  return out;
}

/** Told to the user when they send a photo or voice note the model cannot read. */
export function unsupportedTypeNotice(language: "ar" | "en", kind: string): string {
  return language === "ar"
    ? `لا أستطيع قراءة هذا النوع من الرسائل (${kind}) بعد. لو سمحت اكتب طلبك كنص وسأساعدك مباشرة.`
    : `I can't read that kind of message (${kind}) yet. Please describe it in text and I'll help right away.`;
}

/**
 * WhatsApp rejects a body over 4096 characters. Cut on a paragraph or sentence
 * boundary when there is one nearby so a reply never ends mid-word.
 */
export function clampReply(text: string, limit = 3900): string {
  const trimmed = text.trim();
  if (trimmed.length <= limit) return trimmed;

  const window = trimmed.slice(0, limit);
  const cut = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf(". "), window.lastIndexOf("۔ "));
  return (cut > limit * 0.6 ? window.slice(0, cut + 1) : window).trim() + "…";
}

/** Send a text message through the Cloud API. Returns whether it was accepted. */
export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  token: string;
  to: string;
  body: string;
}): Promise<boolean> {
  const res = await fetch(
    `${GRAPH_BASE}/${params.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: params.to,
        type: "text",
        text: { preview_url: true, body: params.body },
      }),
    },
  );
  if (!res.ok) {
    // The body echoes the recipient number; log the status only.
    console.error("[whatsapp] send rejected:", res.status);
  }
  return res.ok;
}

/**
 * Collapse an OpenAI-shaped SSE stream into one string.
 *
 * WhatsApp takes a whole message, not a stream, but reusing
 * streamChatCompletion means the provider layer, the key handling, and the
 * Anthropic/Gemini translation stay in exactly one place.
 */
export async function collectStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let index: number;
      while ((index = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, "");
        buffer = buffer.slice(index + 1);
        if (!line.startsWith("data:")) continue;

        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const chunk = JSON.parse(payload);
          const piece = chunk?.choices?.[0]?.delta?.content;
          if (typeof piece === "string") out += piece;
        } catch {
          // A frame split across reads; the next chunk completes it.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  return out;
}
