// Account deletion: what the request must contain, what the support inbox is
// told, and that all twenty languages carry the words. The decisions (14 days,
// no second free week, service-role only) are SQL and are executed for real by
// scripts/sql/account-deletion-scenarios.mjs.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseDeletionRequest, supportNotice, escapeHtml, REASON_CODES,
} from "../../supabase/functions/_shared/accountDeletion";

describe("parseDeletionRequest", () => {
  const ok = { reason_code: "privacy", reason_text: "  too much data ", confirm_email: " Me@Example.com " };

  it("accepts a complete request and normalises it", () => {
    expect(parseDeletionRequest(ok)).toEqual({
      ok: true, reasonCode: "privacy", reasonText: "too much data", confirmEmail: "me@example.com",
    });
  });
  it("refuses an unknown reason, a missing confirmation and an essay", () => {
    expect(parseDeletionRequest({ ...ok, reason_code: "because" })).toEqual({ ok: false, error: "bad_reason" });
    expect(parseDeletionRequest({ ...ok, confirm_email: "" })).toEqual({ ok: false, error: "confirm_required" });
    expect(parseDeletionRequest({ ...ok, reason_text: "x".repeat(1001) })).toEqual({ ok: false, error: "reason_too_long" });
  });
  it("never throws on junk", () => {
    for (const junk of [null, undefined, 5, "x", []]) {
      expect(parseDeletionRequest(junk).ok).toBe(false);
    }
  });
});

describe("supportNotice", () => {
  it("escapes what the person typed", () => {
    const n = supportNotice({
      email: "a@b.c", reasonCode: "other", reasonText: "<script>alert(1)</script>",
      channel: "web", purgeAfter: "2026-12-01T00:00:00Z",
    });
    expect(n.html).not.toContain("<script>");
    expect(n.html).toContain(escapeHtml("<script>alert(1)</script>"));
    expect(n.html).toContain("2026-12-01");
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261112000000_account_deletion.sql", "utf8");
  it("keeps both tables service-role only (RLS on, no policy)", () => {
    expect(sql).toMatch(/account_deletion_requests ENABLE ROW LEVEL SECURITY/);
    expect(sql).toMatch(/deleted_account_marks ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
  });
  it("revokes from anon and authenticated by name and grants service_role back", () => {
    expect(sql).toMatch(/FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/TO service_role/);
  });
});

describe("locales", () => {
  const KEYS = [
    "title", "intro", "reasonLabel", "detailsLabel", "confirmLabel", "note", "submit", "keep",
    "pendingTitle", "pendingBody", "cancelBtn", "done", "cancelled", "errMismatch", "errFailed", "errStaff",
    ...REASON_CODES.map((r) => `reason.${r}`),
  ];
  const files = [
    "ar", "de", "en", "es", "fa", "fr", "id", "it", "ja", "ko", "nl", "pl", "pt", "tr", "ur", "vi", "zh",
  ].map((l) => `src/i18n/${l}.ts`).concat(["bn", "hi", "ru"].map((l) => `src/i18n/chunks/${l}.ts`));

  it("has every key in all twenty languages", () => {
    expect(files).toHaveLength(20);
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const k of KEYS) expect(src, `${f} ${k}`).toContain(`"settings.delete.${k}":`);
    }
  });
  it("keeps the {date} placeholder in every language", () => {
    for (const f of files) {
      const m = readFileSync(f, "utf8").match(/"settings\.delete\.pendingBody": "([^"]*)"/);
      expect(m?.[1], f).toContain("{date}");
    }
  });
});

// ── The WhatsApp channel ──────────────────────────────────────────────────

import {
  parseAccountIntent, isDeleteConfirmation, isAccountStep, readDeleteReasonText,
  DELETE_CONFIRM_STEP, DELETE_REASON_STEP, DELETE_REASON_MAX,
} from "../../supabase/functions/_shared/whatsappIdentity";
import { gateAllowsAccountTurn } from "../../supabase/functions/_shared/whatsappEntitlements";
import { UI_STRINGS } from "../../supabase/functions/_shared/whatsappStrings";
import { SUPPORTED_LANGUAGES } from "../../supabase/functions/_shared/whatsappLanguages";

describe("WhatsApp: what counts as asking to delete", () => {
  it("reads the deletion phrases, in Arabic and English", () => {
    for (const t of ["احذف حسابي", "حذف حسابي نهائيا", "delete my account", "Delete account please"]) {
      expect(parseAccountIntent(t), t).toBe("delete");
    }
  });
  it("keeps unlink as unlink — including «احذف حسابي من واتساب»", () => {
    expect(parseAccountIntent("احذف حسابي من واتساب")).toBe("unlink");
    expect(parseAccountIntent("unlink my account")).toBe("unlink");
    expect(parseAccountIntent("remove my account")).toBe("unlink");
  });
  it("never starts a deletion from a cancellation", () => {
    for (const t of ["الغاء حذف حسابي", "cancel deletion", "don't delete my account", "keep my account"]) {
      expect(parseAccountIntent(t), t).toBe("cancel_delete");
    }
  });
  it("leaves everything else alone", () => {
    expect(parseAccountIntent("where is my order")).toBe("orders");
    expect(parseAccountIntent("link my account")).toBe("link");
    expect(parseAccountIntent("what is the weather")).toBeNull();
  });
});

describe("WhatsApp: the two steps", () => {
  it("needs the typed word, never a bare yes", () => {
    for (const t of ["DELETE", "delete", "حذف", "تأكيد"]) expect(isDeleteConfirmation(t), t).toBe(true);
    for (const t of ["yes", "ok", "نعم", "1", "don't delete", ""]) expect(isDeleteConfirmation(t), t).toBe(false);
  });
  it("keeps the reason as written, bounded, and null when empty", () => {
    expect(readDeleteReasonText("  too expensive ")).toBe("too expensive");
    expect(readDeleteReasonText("x".repeat(DELETE_REASON_MAX + 50))).toHaveLength(DELETE_REASON_MAX);
    expect(readDeleteReasonText("   ")).toBeNull();
    expect(readDeleteReasonText(null)).toBeNull();
  });
  it("lets a gated sender through only into the deletion steps", () => {
    expect(isAccountStep(DELETE_CONFIRM_STEP)).toBe(true);
    expect(isAccountStep(DELETE_REASON_STEP)).toBe(true);
    expect(isAccountStep("travel_route")).toBe(false);
    const base = { text: "x", hasMedia: false, hasLocation: false, inAccountStep: false };
    expect(gateAllowsAccountTurn({ ...base, accountIntent: "delete" })).toBe(true);
    expect(gateAllowsAccountTurn({ ...base, accountIntent: "cancel_delete" })).toBe(true);
    expect(gateAllowsAccountTurn({ ...base, accountIntent: "orders" })).toBe(false);
  });
});

describe("WhatsApp: the words and the wiring", () => {
  const KEYS = ["deleteAskConfirm", "deleteAskReason", "deleteDone", "deleteStopped",
    "deleteNotLinked", "deleteStaff", "deleteCancelled", "deleteNothingPending"] as const;
  const table = UI_STRINGS as unknown as Record<string, Record<string, string>>;
  it("has every sentence in every supported language, with {date} kept", () => {
    for (const k of KEYS) {
      for (const lang of SUPPORTED_LANGUAGES) {
        const text = table[k]?.[lang];
        expect(text, `${k}/${lang}`).toBeTruthy();
        if (k === "deleteDone") expect(text, lang).toContain("{date}");
      }
    }
  });
  it("asks for the word DELETE in every language, and teaches no digit", () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(table.deleteAskConfirm[lang], lang).toContain("DELETE");
      for (const k of KEYS) {
        const lines = table[k][lang].split(String.fromCharCode(10));
        for (const line of lines) expect(/^[0-9] /.test(line), `${k}/${lang}: ${line}`).toBe(false);
      }
    }
  });
  it("is wired: the gate, the steps, the database functions, and no phone in the log", () => {
    const hook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(hook).toContain('rpc("whatsapp_request_account_deletion"');
    expect(hook).toContain('rpc("whatsapp_cancel_account_deletion"');
    expect(hook).toContain("inAccountStep: isAccountStep(session.step)");
    const logs = hook.split(String.fromCharCode(10)).filter((l) => l.includes('log("account_delete"')).join(" ");
    expect(logs).toContain("outcome");
    expect(logs.includes("incoming.from") || logs.includes("email") || logs.includes("reason")).toBe(false);
  });
});

// ── Buttons: tapping does what typing does ─────────────────────────────────

import {
  accountButtons, ACCOUNT_TAP, isAccountTap, textForAccountTap,
} from "../../supabase/functions/_shared/whatsappAccountButtons";

describe("WhatsApp: the buttons", () => {
  const table = UI_STRINGS as unknown as Record<string, Record<string, string>>;

  it("turns each tap into the words the flow already reads", () => {
    expect(textForAccountTap(ACCOUNT_TAP.cancel, null)).toBe("cancel deletion");
    expect(parseAccountIntent(textForAccountTap(ACCOUNT_TAP.cancel, null))).toBe("cancel_delete");
    expect(isDeleteConfirmation(textForAccountTap(ACCOUNT_TAP.delete, DELETE_CONFIRM_STEP))).toBe(true);
    expect(readDeleteReasonText(textForAccountTap(ACCOUNT_TAP.skip, DELETE_REASON_STEP))).toBeNull();
    expect(textForAccountTap(ACCOUNT_TAP.keep, DELETE_CONFIRM_STEP)).toBe("#");
    expect(textForAccountTap("menu", null)).toBeNull();
    expect(isAccountTap(ACCOUNT_TAP.delete)).toBe(true);
    expect(isAccountTap("main_menu")).toBe(false);
  });

  it("never lets a stale Delete button confirm anything", () => {
    for (const step of [null, undefined, "account_code", DELETE_REASON_STEP]) {
      const words = textForAccountTap(ACCOUNT_TAP.delete, step);
      expect(isDeleteConfirmation(words), String(step)).toBe(false);
      expect(parseAccountIntent(words), String(step)).toBe("delete"); // starts over and asks again
    }
  });

  it("keeps every button title within Meta's 20 characters in every language", () => {
    for (const key of ["deleteBtnDelete", "deleteBtnKeep", "deleteBtnSkip", "deleteBtnCancel"]) {
      for (const lang of SUPPORTED_LANGUAGES) {
        const title = table[key]?.[lang];
        expect(title, `${key}/${lang}`).toBeTruthy();
        expect([...title].length, `${key}/${lang}: ${title}`).toBeLessThanOrEqual(20);
      }
    }
  });

  it("builds the three sets, with the typed words as the fallback", () => {
    const confirm = accountButtons("confirm", "Sure?", "en");
    const ids = (t: ReturnType<typeof accountButtons>) =>
      (t.interactive as { action: { buttons: Array<{ reply: { id: string } }> } }).action.buttons.map((b) => b.reply.id);
    expect(ids(confirm)).toEqual([ACCOUNT_TAP.delete, ACCOUNT_TAP.keep]);
    expect(ids(accountButtons("reason", "Why?", "ar"))).toEqual([ACCOUNT_TAP.skip, ACCOUNT_TAP.keep]);
    expect(ids(accountButtons("done", "Done", "fr"))).toEqual([ACCOUNT_TAP.cancel]);
    expect(confirm.text).toBe("Sure?");
  });

  it("is wired: taps are translated before the gate, and the three replies carry buttons", () => {
    const hook = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    expect(hook).toContain("textForAccountTap(incoming.selection, session.step)");
    const lines = hook.split(String.fromCharCode(10)).map((l) => l.trim());
    for (const set of ["confirm", "reason"]) expect(hook).toContain(`replyAccount("${set}"`);
    expect(lines.includes('"done",')).toBe(true);
  });
});
