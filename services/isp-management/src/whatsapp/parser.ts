import { z } from "zod";
import { CUSTOMER_ID_RE } from "../actions.js";

/**
 * Closed set of things a message can mean. Both the deterministic parser and
 * any optional AI interpreter produce this and nothing else; the controller
 * then authorises, validates and executes independently. CONFIRM is not here:
 * only a backend-issued button id can confirm, never free text or a model.
 */
export type View = "profile" | "services" | "payment" | "radius" | "sessions" | "actions";
export type Intent =
  | { kind: "CUSTOMER"; query: string }
  | { kind: "FIND"; query: string }
  | { kind: "VIEW"; view: View; query: string }
  | { kind: "EXPIRING"; range: "today" | "week" }
  | { kind: "ACTION"; action: "SUSPEND" | "RESUME" | "ACTIVATE"; query: string }
  | { kind: "BACK" | "HOME" | "CANCEL" | "LOCK" | "HELP" | "UNKNOWN" };

const query = z.string().trim().min(1).max(64);
export const intentSchema: z.ZodType<Intent> = z.union([
  z.object({ kind: z.literal("CUSTOMER"), query }).strict(),
  z.object({ kind: z.literal("FIND"), query }).strict(),
  z.object({ kind: z.literal("VIEW"), view: z.enum(["profile", "services", "payment", "radius", "sessions", "actions"]), query }).strict(),
  z.object({ kind: z.literal("EXPIRING"), range: z.enum(["today", "week"]) }).strict(),
  z.object({ kind: z.literal("ACTION"), action: z.enum(["SUSPEND", "RESUME", "ACTIVATE"]), query }).strict(),
  z.object({ kind: z.enum(["BACK", "HOME", "CANCEL", "LOCK", "HELP", "UNKNOWN"]) }).strict(),
]);

/** Optional AI hook. Its output is untrusted input, validated against intentSchema. */
export interface IntentInterpreter {
  interpret(text: string): Promise<unknown>;
}

const W = (s: string) => new RegExp(`^(?:${s})\\b\\s*(.*)$`, "i");
const RULES: { re: RegExp; make: (arg: string) => Intent }[] = [
  { re: W("suspend|disable|block|cut off"), make: (q) => ({ kind: "ACTION", action: "SUSPEND", query: q }) },
  { re: W("resume|unsuspend|unblock|restore"), make: (q) => ({ kind: "ACTION", action: "RESUME", query: q }) },
  { re: W("activate|reactivate"), make: (q) => ({ kind: "ACTION", action: "ACTIVATE", query: q }) },
  { re: /^expiring\s+today\b/i, make: () => ({ kind: "EXPIRING", range: "today" }) },
  { re: /^expiring\s+(this\s+week|week|soon)\b/i, make: () => ({ kind: "EXPIRING", range: "week" }) },
  { re: W("active sessions?|sessions?|online"), make: (q) => ({ kind: "VIEW", view: "sessions", query: q }) },
  { re: W("radius"), make: (q) => ({ kind: "VIEW", view: "radius", query: q }) },
  { re: W("payments?|invoices?|billing|balance"), make: (q) => ({ kind: "VIEW", view: "payment", query: q }) },
  { re: W("services?|package|plan"), make: (q) => ({ kind: "VIEW", view: "services", query: q }) },
  { re: W("find|search|lookup"), make: (q) => ({ kind: "FIND", query: q }) },
  { re: W("username|user"), make: (q) => ({ kind: "CUSTOMER", query: q }) },
  { re: W("check|status|customer|client|info|show|details?"), make: (q) => ({ kind: "CUSTOMER", query: q }) },
  { re: /^(back|return|previous)$/i, make: () => ({ kind: "BACK" }) },
  { re: /^(home|menu|hi|hello|start)$/i, make: () => ({ kind: "HOME" }) },
  { re: /^(cancel|stop|no|abort)$/i, make: () => ({ kind: "CANCEL" }) },
  { re: /^(lock|logout|log out)$/i, make: () => ({ kind: "LOCK" }) },
  { re: /^(help|\?)$/i, make: () => ({ kind: "HELP" }) },
];

export function parseText(text: string): Intent {
  const t = text.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 200);
  for (const r of RULES) {
    const m = r.re.exec(t);
    if (!m) continue;
    const intent = r.make((m[1] ?? "").trim());
    // A target-taking intent without a plausible target is not understood.
    if ("query" in intent && (!intent.query || intent.query.length > 64)) return { kind: "UNKNOWN" };
    if (intent.kind === "ACTION" && !CUSTOMER_ID_RE.test(intent.query)) return { kind: "UNKNOWN" };
    return intent;
  }
  return { kind: "UNKNOWN" };
}

export async function interpret(text: string, ai?: IntentInterpreter): Promise<Intent> {
  const det = parseText(text);
  if (det.kind !== "UNKNOWN" || !ai) return det;
  try {
    const out = intentSchema.safeParse(await ai.interpret(text));
    if (!out.success) return { kind: "UNKNOWN" };
    const i = out.data;
    // The model may propose an action; it still goes through request -> confirm.
    if (i.kind === "ACTION" && !CUSTOMER_ID_RE.test(i.query)) return { kind: "UNKNOWN" };
    return i;
  } catch {
    return { kind: "UNKNOWN" };
  }
}

// ---- button ids: issued by the backend, validated on the way back in ----
const CID = "[A-Za-z0-9._@-]{1,64}";
export type ButtonCommand =
  | { kind: "NAV"; to: "home" | "back" }
  | { kind: "VIEW"; view: View; customerId: string }
  | { kind: "ACTION"; action: "SUSPEND" | "RESUME" | "ACTIVATE"; customerId: string }
  | { kind: "CONFIRM" | "CANCEL"; pendingId: string };

export const btn = {
  nav: (to: "home" | "back") => `nav:${to}`,
  view: (view: View, id: string) => `v:${view}:${id}`,
  action: (a: "SUSPEND" | "RESUME" | "ACTIVATE", id: string) => `a:${a}:${id}`,
  confirm: (pid: string) => `ok:${pid}`,
  cancel: (pid: string) => `no:${pid}`,
};

export function parseButton(id: string): ButtonCommand | null {
  let m: RegExpExecArray | null;
  if ((m = /^nav:(home|back)$/.exec(id))) return { kind: "NAV", to: m[1] as "home" | "back" };
  if ((m = new RegExp(`^v:(profile|services|payment|radius|sessions|actions):(${CID})$`).exec(id))) return { kind: "VIEW", view: m[1] as View, customerId: m[2]! };
  if ((m = new RegExp(`^a:(SUSPEND|RESUME|ACTIVATE):(${CID})$`).exec(id))) return { kind: "ACTION", action: m[1] as "SUSPEND", customerId: m[2]! };
  if ((m = /^(ok|no):([0-9a-f-]{36})$/i.exec(id))) return { kind: m[1] === "ok" ? "CONFIRM" : "CANCEL", pendingId: m[2]! };
  return null;
}
