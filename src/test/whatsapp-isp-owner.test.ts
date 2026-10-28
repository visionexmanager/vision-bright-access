// The owner's ISP desk on WhatsApp: /isp → action → username | name → the
// identifier → Confirm | Reject. Pure machine first, then where the webhook
// puts it: owner-only, and the identifier never reaches a log line.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ISP_ACTIONS,
  ispConfirmId,
  ispMenuMessage,
  ispResultText,
  ispStep,
  parseIspAnswer,
  parseIspCommand,
  parseIspTap,
  cleanIdentifier,
  type IspPending,
  type IspStep,
} from "../../supabase/functions/_shared/whatsappIspOwner.ts";

let n = 0;
const nonce = () => `nonce${String(++n).padStart(6, "0")}`;

const tap = (id: string) => {
  const parsed = parseIspTap(id);
  if (!parsed) throw new Error(`not an isp id: ${id}`);
  return { type: "tap", tap: parsed } as const;
};

/** Walk /isp → Reset MAC → Username → value, returning the step waiting for Confirm. */
function toConfirm(lang: "ar" | "en" = "ar", kind: "username" | "name" = "username", value = "ankiun120"): IspPending {
  let step: IspStep = ispStep(null, { type: "command", lang }, nonce);
  step = ispStep(step.pending, tap(`isp:a:resetmac:${lang}`), nonce);
  step = ispStep(step.pending, tap(`isp:k:${kind}`), nonce);
  step = ispStep(step.pending, { type: "text", text: value }, nonce);
  expect(step.pending?.stage).toBe("await_confirm");
  return step.pending!;
}

describe("the commands and ids", () => {
  it("reads /isp, with an optional language, and nothing else", () => {
    expect(parseIspCommand("/isp")).toEqual({ lang: "ar" });
    expect(parseIspCommand(" /ISP en ")).toEqual({ lang: "en" });
    for (const other of ["isp", "/isp fr", "/isp now", "/ispx", "", undefined]) {
      expect(parseIspCommand(other)).toBeNull();
    }
  });

  it("offers every action as a row whose id round-trips, in both languages", () => {
    for (const lang of ["ar", "en"] as const) {
      const menu = ispMenuMessage(lang);
      expect(menu.interactive.type).toBe("list");
      const rows = menu.interactive.type === "list" ? menu.interactive.action.sections[0].rows : [];
      expect(rows).toHaveLength(ISP_ACTIONS.length);
      for (const row of rows) {
        expect([...row.title].length).toBeLessThanOrEqual(24);
        expect(parseIspTap(row.id)).toMatchObject({ type: "action", lang });
      }
    }
    const ping = ispMenuMessage("en").text;
    expect(ping).toContain("Ping");
    expect(ispMenuMessage("ar").text).toContain("فحص الاتصال");
  });

  it("ignores ids that are not this desk's or are malformed", () => {
    for (const id of ["approve:VX-1", "isp:a:rm-rf:ar", "isp:a:ping:fr", "isp:y:x", "isp:k:other", null, undefined]) {
      expect(parseIspTap(id)).toBeNull();
    }
  });

  it("reads typed answers in Arabic and English", () => {
    for (const w of ["confirm", "Confirm.", "تأكيد", "نعم"]) expect(parseIspAnswer(w)).toBe("confirm");
    for (const w of ["reject", "رفض", "no"]) expect(parseIspAnswer(w)).toBe("reject");
    for (const w of ["cancel", "الغاء", "#"]) expect(parseIspAnswer(w)).toBe("cancel");
    expect(parseIspAnswer("confirm the renewal for everyone")).toBeNull();
  });
});

describe("the identifier", () => {
  it("accepts a username and refuses anything that could be something else", () => {
    expect(cleanIdentifier("username", "ankiun120")).toBe("ankiun120");
    expect(cleanIdentifier("username", "a.b_c-d@x")).toBe("a.b_c-d@x");
    for (const bad of ["", "a b", "a;b", "x".repeat(65), "<script>", "../etc"]) {
      expect(cleanIdentifier("username", bad)).toBeNull();
    }
  });

  it("accepts a name in any script and refuses control and invisible characters", () => {
    expect(cleanIdentifier("name", "  علي   خضر  ")).toBe("علي خضر");
    expect(cleanIdentifier("name", "Ali Dawoud")).toBe("Ali Dawoud");
    const ZWSP = String.fromCharCode(0x200b);
    const RLO = String.fromCharCode(0x202e);
    const NUL = String.fromCharCode(0);
    for (const bad of ["a", "x".repeat(81), `Ali${ZWSP}Dawoud`, `Ali${RLO}Dawoud`, `Ali${NUL}`]) {
      expect(cleanIdentifier("name", bad)).toBeNull();
    }
  });
});

describe("the flow", () => {
  it("asks how to find the customer, then for the value, then confirms with two buttons", () => {
    let step = ispStep(null, { type: "command", lang: "en" }, nonce);
    expect(step.pending).toBeNull();
    step = ispStep(null, tap("isp:a:renew:en"), nonce);
    expect(step.pending).toMatchObject({ action: "renew", stage: "await_kind", lang: "en" });
    const kinds = typeof step.reply === "object" && step.reply?.interactive.type === "button"
      ? step.reply.interactive.action.buttons.map((b) => b.reply.title)
      : [];
    expect(kinds).toEqual(["Username", "Name", "Cancel"]);

    step = ispStep(step.pending, tap("isp:k:username"), nonce);
    expect(step.reply).toBe("Send the customer's username (account).");

    step = ispStep(step.pending, { type: "text", text: "ankiun120" }, nonce);
    const reply = step.reply as Exclude<IspStep["reply"], string | null>;
    const titles = reply.interactive.type === "button" ? reply.interactive.action.buttons.map((b) => b.reply.title) : [];
    expect(titles).toEqual(["Confirm", "Reject"]);
    expect(reply.text).toContain("ankiun120");
    expect(reply.text).toContain("Charges your balance");
    expect(step.run).toBeNull();
  });

  it("uses Arabic button titles in Arabic", () => {
    const pending = toConfirm("ar");
    const step = ispStep(pending, { type: "text", text: "؟" }, nonce);
    const reply = step.reply as Exclude<IspStep["reply"], string | null>;
    const titles = reply.interactive.type === "button" ? reply.interactive.action.buttons.map((b) => b.reply.title) : [];
    expect(titles).toEqual(["تأكيد", "رفض"]);
  });

  it("runs exactly one request, only on the matching Confirm, and clears the step", () => {
    const pending = toConfirm("en", "username", "ankiun120");
    const step = ispStep(pending, tap(ispConfirmId(pending.nonce)), nonce);
    expect(step.run).toEqual({ action: "resetmac", kind: "username", value: "ankiun120" });
    expect(step.pending).toBeNull();
    // A second tap finds nothing waiting and runs nothing.
    expect(ispStep(step.pending, tap(ispConfirmId(pending.nonce)), nonce).run).toBeNull();
  });

  it("does nothing for a stale or foreign confirm, and keeps the step waiting", () => {
    const pending = toConfirm("en");
    const stale = ispStep(pending, tap("isp:y:someoldnonce"), nonce);
    expect(stale.run).toBeNull();
    expect(stale.pending).toEqual(pending);
    // A Confirm tapped before the value was even given.
    const early = ispStep(
      { ...pending, stage: "await_value", value: null },
      tap(ispConfirmId(pending.nonce)),
      nonce,
    );
    expect(early.run).toBeNull();
  });

  it("rejects, cancels and times out without running anything", () => {
    const pending = toConfirm("en");
    expect(ispStep(pending, tap(`isp:n:${pending.nonce}`), nonce)).toMatchObject({ run: null, pending: null });
    expect(ispStep(pending, tap("isp:x"), nonce)).toMatchObject({ run: null, pending: null });
    expect(ispStep(pending, { type: "text", text: "cancel" }, nonce)).toMatchObject({ run: null, pending: null });
    expect(ispStep(pending, { type: "text", text: "reject" }, nonce)).toMatchObject({ run: null, pending: null });
    expect(ispStep(null, tap(ispConfirmId("abcdef123456")), nonce, true)).toMatchObject({ run: null, reply: expect.stringContaining("انتهت") });
  });

  it("confirms by typed word as well as by button", () => {
    const pending = toConfirm("ar", "name", "علي خضر");
    expect(ispStep(pending, { type: "text", text: "تأكيد" }, nonce).run).toEqual({
      action: "resetmac", kind: "name", value: "علي خضر",
    });
  });

  it("asks again for a bad identifier and keeps the step", () => {
    let step = ispStep(null, tap("isp:a:ping:en"), nonce);
    step = ispStep(step.pending, tap("isp:k:username"), nonce);
    const bad = ispStep(step.pending, { type: "text", text: "bad name!" }, nonce);
    expect(bad.pending).toEqual(step.pending);
    expect(bad.reply).toMatch(/not valid/);
    expect(bad.run).toBeNull();
  });

  it("lets a typed 1 or 2 choose the kind, for a sender who only gets the text copy", () => {
    const start = ispStep(null, tap("isp:a:status:en"), nonce);
    expect(ispStep(start.pending, { type: "text", text: "2" }, nonce).pending).toMatchObject({ kind: "name", stage: "await_value" });
  });
});

describe("the closing sentence", () => {
  const request = { action: "ping", kind: "username", value: "ankiun120" } as const;

  it("says plainly that nothing ran when the service is not connected", () => {
    expect(ispResultText(request, { ok: false, reason: "not_connected" }, "en")).toMatch(/not connected/);
    expect(ispResultText(request, { ok: false, reason: "not_connected" }, "ar")).toContain("غير موصولة");
  });

  it("never repeats the identifier", () => {
    for (const result of [{ ok: true }, { ok: false, reason: "failed" }, { ok: false, reason: "unsupported" }] as const) {
      expect(ispResultText(request, result, "en")).not.toContain("ankiun120");
    }
  });
});

describe("the webhook wiring", () => {
  const source = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8").replace(/\r\n/g, "\n");

  it("reaches the desk only behind the owner check", () => {
    const calls = [...source.matchAll(/handleIspOwner\(db,/g)].map((m) => m.index!);
    expect(calls).toHaveLength(2);
    for (const at of calls) {
      const before = source.slice(Math.max(0, at - 700), at);
      expect(before).toMatch(/isOwner\(incoming\.from, configuredOwner\)/);
    }
  });

  it("writes no identifier to a log line or an audit row", () => {
    const start = source.indexOf("async function handleIspOwner");
    const body = source.slice(start, source.indexOf("\n}\n", start));
    expect(body).not.toMatch(/console\.(log|error|warn)/);
    const audit = /owner_isp_action[\s\S]{0,300}metadata: \{([^}]*)\}/.exec(body)![1];
    expect(audit).not.toMatch(/value/);
  });
});
