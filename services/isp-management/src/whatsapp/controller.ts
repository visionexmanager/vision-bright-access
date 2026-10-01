import { randomUUID } from "node:crypto";
import { ActionService, CUSTOMER_ID_RE, type Actor, type Ctx, type PendingView } from "../actions.js";
import { writeAudit } from "../audit.js";
import type { Db } from "../db.js";
import { Directory, type Profile } from "../directory.js";
import { AppError } from "../errors.js";
import type { SecurityMonitor } from "../events.js";
import type { Logger } from "../logger.js";
import type { Button, Customer, WhatsAppProvider } from "../providers/types.js";
import { LIMITS, type RateLimiter } from "../ratelimit.js";
import { can } from "../rbac.js";
import { WaAdmins, type WaAdmin } from "./admins.js";
import type { InboundMessage } from "./inbound.js";
import { btn, interpret, parseButton, parseText, type ButtonCommand, type Intent, type IntentInterpreter, type View } from "./parser.js";

export const MAX_MESSAGE_AGE_MS = 5 * 60_000;

interface Context {
  customerId?: string;
  view?: View;
  prev?: { customerId?: string; view?: View };
}

const money = (n: number, c: string) => `${n.toFixed(2)} ${c}`;
const date = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "—");

export class WhatsAppAdminController {
  constructor(
    private d: {
      db: Db; admins: WaAdmins; actions: ActionService; directory: Directory; sender: WhatsAppProvider; monitor: SecurityMonitor;
      limiter: RateLimiter; log: Logger; requireUnlock: boolean; ai?: IntentInterpreter; now?: () => number;
    },
  ) {}
  private now = () => this.d.now?.() ?? Date.now();

  /**
   * Entry point for one verified inbound message. The webhook layer has already
   * checked the signature; everything else (freshness, replay, sender,
   * unlock, rate limit, authorisation) is decided here, in this order.
   */
  async handle(m: InboundMessage, ip: string | null = null): Promise<void> {
    if (Math.abs(this.now() - m.timestampMs) > MAX_MESSAGE_AGE_MS) {
      await this.d.monitor.record("WA_STALE_MESSAGE", "WARNING", "Dropped a stale WhatsApp message");
      return;
    }
    // Replay / duplicate delivery: the primary key makes the second insert a no-op.
    const fresh = await this.d.db.query("INSERT INTO wa_inbound (message_id) VALUES ($1) ON CONFLICT DO NOTHING", [m.messageId]);
    if (!fresh.rowCount) return;

    const admin = await this.d.admins.byPhone(m.from);
    if (!admin || admin.status === "DISABLED") return this.unknown(m, ip);

    if (admin.status === "PENDING") {
      const enroll = /^enroll\s+(\d{8})$/i.exec((m.text ?? "").trim());
      if (!enroll || !this.d.limiter.take("wa-unlock", admin.id, LIMITS.waUnlock)) return this.unknown(m, ip);
      const ok = await this.d.admins.enroll(m.from, enroll[1]!);
      if (ok) await this.say(m.from, "Number enrolled. Now send: unlock <6-digit code from your authenticator>.");
      else await this.unknown(m, ip);
      return;
    }

    if (!this.d.limiter.take("wa-admin", admin.id, LIMITS.waAdmin)) {
      await this.d.monitor.record("RATE_LIMITED", "WARNING", "WhatsApp admin rate limit hit", { admin: admin.id });
      return;
    }
    const actor: Actor = { type: "WHATSAPP_ADMIN", id: admin.id, role: admin.role, label: admin.name };
    const ctx: Ctx = { source: "WHATSAPP", ip, requestId: randomUUID() };

    try {
      const sess = await this.d.admins.session(admin.id);
      if (this.d.requireUnlock && !sess.unlocked) return await this.locked(admin, m);
      await this.route(admin, actor, ctx, m, (sess.context ?? {}) as Context);
    } catch (e) {
      await this.fail(m.from, e);
    }
  }

  private async unknown(m: InboundMessage, ip: string | null) {
    // Silence: no reply reveals that the number is an admin channel.
    if (this.d.limiter.take("wa-unknown", m.from, LIMITS.waUnknownSender))
      await this.d.monitor.record("WA_UNKNOWN_SENDER", "WARNING", "Message from an unauthorised WhatsApp number", { ip, tail: m.from.slice(-3) });
  }

  private async locked(admin: WaAdmin, m: InboundMessage) {
    const code = /^(?:unlock\s+)?(\d{6})$/i.exec((m.text ?? "").trim())?.[1];
    if (!code) return this.say(m.from, "Locked. Send: unlock <6-digit code>.");
    if (!this.d.limiter.take("wa-unlock", admin.id, LIMITS.waUnlock)) {
      await this.d.monitor.record("RATE_LIMITED", "WARNING", "WhatsApp unlock attempts exceeded", { admin: admin.id });
      return;
    }
    if (await this.d.admins.unlock(admin, code)) {
      await writeAudit(this.d.db, { actorType: "WHATSAPP_ADMIN", actorId: admin.id, action: "WA_UNLOCK", result: "SUCCESS" });
      return this.home(m.from, admin, "Unlocked.");
    }
    await writeAudit(this.d.db, { actorType: "WHATSAPP_ADMIN", actorId: admin.id, action: "WA_UNLOCK", result: "FAILURE" });
    await this.d.monitor.record("WA_UNLOCK_FAILED", "WARNING", "WhatsApp unlock failed", { admin: admin.id });
    return this.say(m.from, "That code did not work.");
  }

  private async route(admin: WaAdmin, actor: Actor, ctx: Ctx, m: InboundMessage, c: Context) {
    const to = m.from;
    if (m.buttonId) {
      const cmd = parseButton(m.buttonId);
      if (!cmd) return this.home(to, admin, "I did not understand that.");
      return this.button(admin, actor, ctx, m, cmd, c);
    }
    const intent = await interpret(m.text ?? "", this.d.ai);
    return this.intent(admin, actor, ctx, m, intent, c);
  }

  private async button(admin: WaAdmin, actor: Actor, ctx: Ctx, m: InboundMessage, cmd: ButtonCommand, c: Context) {
    switch (cmd.kind) {
      case "NAV":
        return cmd.to === "home" ? this.home(m.from, admin) : this.back(admin, actor, ctx, m.from, c);
      case "VIEW":
        return this.view(admin, actor, ctx, m.from, cmd.customerId, cmd.view, c);
      case "ACTION":
        return this.requestAction(admin, actor, ctx, m, cmd.action, cmd.customerId, c);
      case "CANCEL":
        await this.d.actions.cancel(actor, ctx, cmd.pendingId);
        return this.say(m.from, "Cancelled. Nothing was changed.", [{ id: btn.nav("back"), title: "Back" }, { id: btn.nav("home"), title: "Home" }]);
      case "CONFIRM": {
        const r = await this.d.actions.confirm(actor, ctx, cmd.pendingId);
        return this.say(m.from, `${r.ok ? "✔" : "✖"} ${r.message}${r.replayed ? " (already processed)" : ""}`, [{ id: btn.nav("back"), title: "Back" }, { id: btn.nav("home"), title: "Home" }]);
      }
    }
  }

  private async intent(admin: WaAdmin, actor: Actor, ctx: Ctx, m: InboundMessage, i: Intent, c: Context) {
    const to = m.from;
    switch (i.kind) {
      case "HOME":
      case "HELP":
        return this.home(to, admin);
      case "BACK":
        return this.back(admin, actor, ctx, to, c);
      case "CANCEL":
        return this.say(to, "Nothing pending was changed.", [{ id: btn.nav("home"), title: "Home" }]);
      case "LOCK":
        await this.d.admins.lock(admin.id);
        return this.say(to, "Locked.");
      case "UNKNOWN":
        return this.say(to, "I did not understand. Try: customer 12345, find <name>, check <username>.", [{ id: btn.nav("home"), title: "Home" }]);
      case "EXPIRING":
        return this.say(to, "Expiry lists are not available from the connected ISP system yet.", [{ id: btn.nav("home"), title: "Home" }]);
      case "FIND": {
        const page = await this.d.directory.search(actor, ctx, i.query, 8);
        return this.pick(to, page.items, page.truncated);
      }
      case "CUSTOMER":
      case "VIEW":
      case "ACTION": {
        const id = await this.resolve(actor, ctx, to, i.query);
        if (!id) return;
        if (i.kind === "CUSTOMER") return this.view(admin, actor, ctx, to, id, "profile", c);
        if (i.kind === "VIEW") return this.view(admin, actor, ctx, to, id, i.view, c);
        return this.requestAction(admin, actor, ctx, m, i.action, id, c);
      }
    }
  }

  /** A typed target may be an id or a username; resolve it to exactly one customer or ask. */
  private async resolve(actor: Actor, ctx: Ctx, to: string, q: string): Promise<string | null> {
    if (CUSTOMER_ID_RE.test(q)) {
      const page = await this.d.directory.search(actor, ctx, q, 5).catch(() => ({ items: [] as Customer[], truncated: false }));
      const exact = page.items.find((x) => x.externalId === q || x.username.toLowerCase() === q.toLowerCase());
      if (exact) return exact.externalId;
      if (page.items.length === 1 && page.items[0]) return page.items[0].externalId;
      if (page.items.length > 1) {
        await this.pick(to, page.items, page.truncated);
        return null;
      }
    }
    await this.say(to, "No matching customer.", [{ id: btn.nav("home"), title: "Home" }]);
    return null;
  }

  private async pick(to: string, items: Customer[], truncated: boolean) {
    if (!items.length) return this.say(to, "No matching customer.", [{ id: btn.nav("home"), title: "Home" }]);
    const rows = items.slice(0, 9).map((x) => ({ id: btn.view("profile", x.externalId), title: x.fullName ?? x.username, description: `${x.username} · ${x.status}` }));
    rows.push({ id: btn.nav("home"), title: "Back", description: "Return home" });
    await this.d.sender.sendList(to, truncated ? "Several matches. Showing the first few — refine the search for others." : "Choose a customer:", "Customers", rows);
  }

  private async view(admin: WaAdmin, actor: Actor, ctx: Ctx, to: string, id: string, view: View, c: Context) {
    const p = await this.d.directory.profile(actor, ctx, id, { services: true, payments: view === "payment" || view === "profile", radius: view === "radius" || view === "profile" });
    await this.d.admins.setContext(admin.id, { customerId: id, view, prev: c.customerId ? { customerId: c.customerId, view: c.view } : undefined });
    if (view === "actions") {
      const st = p.customer.status;
      const offer = st === "ACTIVE" ? (["SUSPEND"] as const) : st === "SUSPENDED" ? (["RESUME"] as const) : st === "EXPIRED" ? (["ACTIVATE"] as const) : ([] as const);
      const buttons: Button[] = offer.filter((a) => can(actor.role, a === "SUSPEND" ? "service:suspend" : a === "RESUME" ? "service:resume" : "service:activate")).map((a) => ({ id: btn.action(a, id), title: a[0] + a.slice(1).toLowerCase() }));
      return this.say(to, buttons.length ? `Actions for ${p.customer.username} (${st}). Each one asks for confirmation.` : `No actions available for ${p.customer.username} (${st}).`, [...buttons, { id: btn.view("profile", id), title: "Profile" }, { id: btn.nav("back"), title: "Back" }].slice(0, 3));
    }
    if (view === "sessions") {
      const s = await this.d.directory.sessions(actor, id);
      return this.say(to, s.length ? `Active sessions for ${p.customer.username}: ${s.length}\n` + s.slice(0, 3).map((x) => `• since ${x.startedAt?.slice(0, 16).replace("T", " ") ?? "?"}`).join("\n") : `${p.customer.username} has no active session.`, this.nav(id, "sessions"));
    }
    return this.say(to, this.card(p, view), this.nav(id, view));
  }

  private card(p: Profile, view: View): string {
    const c = p.customer;
    const svc = p.services?.available ? p.services.data[0] : undefined;
    if (view === "services")
      return svc ? `Service\nPackage: ${svc.package ?? "—"}\nSpeed: ${svc.speed ?? "—"}\nStatus: ${svc.status}\nExpires: ${date(svc.expirationDate)}` : "Service details unavailable.";
    if (view === "payment")
      return p.payments?.available ? (p.payments.data.length ? "Recent payments\n" + p.payments.data.slice(0, 4).map((x) => `${date(x.paymentDate)} ${money(x.amount, x.currency)} ${x.status}`).join("\n") : "No payments on record.") : "Payment details unavailable.";
    if (view === "radius")
      return p.radius?.available ? `RADIUS\nAccount: ${p.radius.data.enabled === null ? "unknown" : p.radius.data.enabled ? "enabled" : "disabled"}\nOnline: ${p.radius.data.online === null ? "unknown" : p.radius.data.online ? "yes" : "no"}` : "RADIUS status unavailable.";
    return [`Customer`, `Name: ${c.fullName ?? "—"}`, `Username: ${c.username}`, `Status: ${c.status}`, `Package: ${svc?.package ?? "—"}`, `Expires: ${date(svc?.expirationDate)}`].join("\n");
  }

  private nav(id: string, view: View): Button[] {
    const first = view === "profile" ? { id: btn.view("services", id), title: "Services" } : { id: btn.view("profile", id), title: "Profile" };
    return [first, { id: btn.view("actions", id), title: "Actions" }, { id: btn.nav("back"), title: "Back" }];
  }

  private async requestAction(admin: WaAdmin, actor: Actor, ctx: Ctx, m: InboundMessage, action: "SUSPEND" | "RESUME" | "ACTIVATE", id: string, c: Context) {
    // "Actions" view: offer only what this admin may do and the state allows.
    // The idempotency key is the WhatsApp message id, so a redelivery cannot create a second request.
    const p: PendingView = await this.d.actions.request(actor, ctx, action, id, `wa:${m.messageId}`);
    await this.d.admins.setContext(admin.id, { ...c, customerId: id });
    return this.d.sender.sendButtons(
      m.from,
      `Confirm ${action.toLowerCase()} of ${p.customer.fullName ?? p.customer.username} (${p.customer.username})?\nNow: ${p.currentStatus} → After: ${p.resultingStatus}\nExpires in 2 minutes.`,
      [{ id: btn.confirm(p.id), title: `Confirm ${action[0]}${action.slice(1).toLowerCase()}`.slice(0, 20) }, { id: btn.cancel(p.id), title: "Cancel" }, { id: btn.nav("back"), title: "Back" }],
    );
  }

  private async back(admin: WaAdmin, actor: Actor, ctx: Ctx, to: string, c: Context) {
    if (c.prev?.customerId) return this.view(admin, actor, ctx, to, c.prev.customerId, c.prev.view ?? "profile", { prev: undefined });
    return this.home(to, admin);
  }

  private async home(to: string, admin: WaAdmin, prefix?: string) {
    await this.d.admins.setContext(admin.id, {});
    const canWrite = can(admin.role, "service:suspend");
    await this.d.sender.sendText(
      to,
      `${prefix ? prefix + "\n" : ""}ISP admin. Send: customer <id|username>, find <name>, check <username>, radius <username>, payment <id>${canWrite ? ", suspend / resume / activate <username>" : ""}. Say "lock" to end the session.`,
    );
  }

  private say(to: string, text: string, buttons?: Button[]) {
    return buttons?.length ? this.d.sender.sendButtons(to, text, buttons) : this.d.sender.sendText(to, text);
  }

  /** Detail stays in the logs; the admin sees a fixed sentence. */
  private async fail(to: string, e: unknown) {
    let msg = "Service temporarily unavailable.";
    if (e instanceof AppError && e.status < 500) msg = e.message;
    else this.d.log.error("whatsapp handler failed", { err: String(e) });
    await this.d.sender.sendButtons(to, msg, [{ id: btn.nav("back"), title: "Back" }, { id: btn.nav("home"), title: "Home" }]).catch(() => undefined);
  }
}

export { parseText };
