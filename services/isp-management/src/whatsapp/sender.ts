import type { Button, ListRow, WhatsAppProvider } from "../providers/types.js";

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** WhatsApp Cloud API sender. Interactive buttons/lists, never numbered menus. */
export class CloudApiSender implements WhatsAppProvider {
  constructor(
    private o: { accessToken?: string; phoneNumberId?: string; fetchImpl?: typeof fetch; version?: string },
  ) {}
  configured = () => !!(this.o.accessToken && this.o.phoneNumberId);

  private async post(payload: object) {
    if (!this.configured()) return;
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`https://graph.facebook.com/${this.o.version ?? "v21.0"}/${this.o.phoneNumberId}/messages`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.o.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`WhatsApp send failed (${res.status})`);
  }

  sendText = (to: string, text: string) => this.post({ to, type: "text", text: { body: clip(text, 4000), preview_url: false } });

  sendButtons(to: string, body: string, buttons: Button[]) {
    // Cloud API allows at most 3 reply buttons, 20 characters each.
    return this.post({
      to, type: "interactive",
      interactive: { type: "button", body: { text: clip(body, 1000) }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.title, 20) } })) } },
    });
  }

  sendList(to: string, body: string, buttonLabel: string, rows: ListRow[]) {
    return this.post({
      to, type: "interactive",
      interactive: {
        type: "list", body: { text: clip(body, 1000) },
        action: { button: clip(buttonLabel, 20), sections: [{ title: "Options", rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: clip(r.title, 24), description: r.description ? clip(r.description, 72) : undefined })) }] },
      },
    });
  }
}

/** Collects what would have been sent. Tests and local development. */
export class RecordingSender implements WhatsAppProvider {
  sent: { to: string; kind: "text" | "buttons" | "list"; body: string; buttons?: Button[]; rows?: ListRow[] }[] = [];
  configured = () => true;
  async sendText(to: string, text: string) { this.sent.push({ to, kind: "text", body: text }); }
  async sendButtons(to: string, body: string, buttons: Button[]) { this.sent.push({ to, kind: "buttons", body, buttons }); }
  async sendList(to: string, body: string, _l: string, rows: ListRow[]) { this.sent.push({ to, kind: "list", body, rows }); }
}
