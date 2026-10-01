import { z } from "zod";
import { hmacHex, safeEqual } from "../crypto.js";

/** Meta signs the raw body: `X-Hub-Signature-256: sha256=<hmac of body with the app secret>`. */
export function verifyMetaSignature(raw: Buffer, header: string | undefined, appSecret: string | undefined): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  return safeEqual(header.slice(7), hmacHex(appSecret, raw));
}

export const GATEWAY_MAX_SKEW_MS = 60_000;

/**
 * The public VisionEX webhook forwards admin traffic here signed with a shared
 * secret: HMAC(secret, `${timestamp}.${rawBody}`). The timestamp bounds replay;
 * the message id (deduplicated downstream) removes it.
 */
export function verifyGatewaySignature(raw: Buffer, ts: string | undefined, sig: string | undefined, secret: string | undefined, nowMs = Date.now()): boolean {
  if (!secret || !ts || !sig || !/^\d{10,13}$/.test(ts)) return false;
  const t = ts.length <= 10 ? Number(ts) * 1000 : Number(ts);
  if (Math.abs(nowMs - t) > GATEWAY_MAX_SKEW_MS) return false;
  return safeEqual(sig, hmacHex(secret, `${ts}.${raw.toString("utf8")}`));
}

export interface InboundMessage {
  messageId: string;
  from: string; // digits only
  timestampMs: number;
  text?: string;
  buttonId?: string;
}

const message = z
  .object({
    id: z.string().min(1).max(200),
    from: z.string().regex(/^\d{8,15}$/),
    timestamp: z.string().regex(/^\d{9,13}$/),
    type: z.string(),
    text: z.object({ body: z.string().max(2000) }).optional(),
    interactive: z
      .object({
        type: z.string(),
        button_reply: z.object({ id: z.string().max(256) }).optional(),
        list_reply: z.object({ id: z.string().max(256) }).optional(),
      })
      .optional(),
  })
  .passthrough();

const payload = z.object({
  entry: z
    .array(z.object({ changes: z.array(z.object({ value: z.object({ messages: z.array(z.unknown()).optional() }).passthrough() }).passthrough()) }).passthrough())
    .max(20),
});

/** Malformed payloads yield null (rejected); unsupported message types are skipped. */
export function extractMessages(body: unknown): InboundMessage[] | null {
  const p = payload.safeParse(body);
  if (!p.success) return null;
  const out: InboundMessage[] = [];
  for (const e of p.data.entry)
    for (const c of e.changes)
      for (const raw of c.value.messages ?? []) {
        const m = message.safeParse(raw);
        if (!m.success) return null;
        const v = m.data;
        const ts = v.timestamp.length <= 10 ? Number(v.timestamp) * 1000 : Number(v.timestamp);
        if (v.type === "text" && v.text) out.push({ messageId: v.id, from: v.from, timestampMs: ts, text: v.text.body });
        else if (v.type === "interactive" && v.interactive) {
          const id = v.interactive.button_reply?.id ?? v.interactive.list_reply?.id;
          if (id) out.push({ messageId: v.id, from: v.from, timestampMs: ts, buttonId: id });
        }
      }
  return out;
}
