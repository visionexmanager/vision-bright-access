import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOwner, normalizePhone } from "../../supabase/functions/_shared/ownerControl.ts";

// Configuring the owner's WhatsApp number.
//
// The number decides who may command the assistant, so the tests here are
// about two things and nothing else: the stored value keeps its shape, and the
// authorization rules that read it are exactly the ones that were already
// there.

const adminSettings = readFileSync("src/pages/admin/AdminSettings.tsx", "utf8");
const ownerControlFn = readFileSync("supabase/functions/owner-control/index.ts", "utf8");
const hook = readFileSync("src/hooks/useOwnerControl.ts", "utf8");
const page = readFileSync("src/pages/admin/OwnerControlCenter.tsx", "utf8");

/** The real owner handset. Only ever a test fixture — never in app source. */
const OWNER_NUMBER = "+96170750609";

/**
 * Source with comments removed.
 *
 * These assertions forbid particular calls, and a file that explains why it
 * does not make a call would otherwise fail its own rule — the comment naming
 * `JSON.stringify()` is the reason it is absent from the code.
 */
function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("owner_contact keeps its jsonb object shape", () => {
  it("is written as an object, never as a stringified string", () => {
    // The whole defect being fixed: JSON.stringify() on a value that is
    // already JSON turns the object into a jsonb string, after which
    // value.whatsapp_number is undefined and there is no owner at all.
    const code = codeOnly(ownerControlFn);
    const action = code.slice(code.indexOf('case "set_owner_contact"'));
    const body = action.slice(0, action.indexOf("default:"));

    expect(body).toContain("whatsapp_number: digits");
    expect(body).not.toContain("JSON.stringify");
  });

  it("merges into the existing row so the notification flags survive", () => {
    const action = ownerControlFn.slice(ownerControlFn.indexOf('case "set_owner_contact"'));
    const body = action.slice(0, action.indexOf('      default:'));

    // Read-modify-write, not replace. Without the spread, saving a number
    // would silently drop notify_escalations and its siblings.
    expect(body).toContain("...preserved");
    expect(body).toContain('.eq("key", "owner_contact")');
    // A value that is not an object is not spread into the new one.
    expect(body).toContain('typeof current === "object"');
  });

  it("reads the stored value defensively rather than asserting its shape", () => {
    // If a bad writer ever left a string there, the dashboard must report
    // "not configured" instead of crashing or claiming an owner exists.
    expect(hook).toContain('typeof contact === "object"');
    expect(hook).toContain("!Array.isArray(contact)");
  });
});

describe("Admin Settings cannot corrupt owner_contact", () => {
  it("only ever reads and writes the keys it owns", () => {
    const code = codeOnly(adminSettings);
    expect(code).toContain("const MANAGED_KEYS");
    // The bug was a save loop over everything that had been loaded.
    expect(code).not.toContain("Object.entries(settings)");
    expect(code).toContain("for (const key of MANAGED_KEYS)");
    // And the load is scoped, so owner_contact never even reaches the state.
    expect(code).toContain('.in("key", [...MANAGED_KEYS])');
    expect(code).not.toContain('.select("*")');
  });

  it("never manages owner_contact from the generic settings screen", () => {
    const list = adminSettings.slice(
      adminSettings.indexOf("const MANAGED_KEYS"),
      adminSettings.indexOf("] as const"),
    );
    expect(list).not.toContain("owner_contact");
  });

  it("does not double-encode a value on the way to a jsonb column", () => {
    const code = codeOnly(adminSettings);
    const save = code.slice(code.indexOf("const handleSave"), code.indexOf("const update ="));
    // supabase-js encodes once for jsonb; a JSON.stringify() here would add a
    // second layer and the stored value would gain quotes on every save.
    expect(save).not.toContain("JSON.stringify");
    expect(save).toContain("update({ value })");
    expect(save).toContain("insert({ key, value })");
  });
});

describe("the Control Centre can set the number without writing to a table", () => {
  it("routes the save through the owner-control function", () => {
    expect(hook).toContain('action: "set_owner_contact"');
    // The two standing guards: neither the hook nor the page may write.
    expect(hook).not.toMatch(/\.update\(|\.insert\(|\.delete\(/);
    expect(page).not.toMatch(/\.update\(|\.insert\(|\.delete\(/);
  });

  it("re-checks the admin role server side before saving", () => {
    // The action sits behind the function's existing gate rather than
    // introducing a second authorization path of its own.
    const gate = ownerControlFn.indexOf("Admin access required");
    const action = ownerControlFn.indexOf('case "set_owner_contact"');
    expect(gate).toBeGreaterThan(-1);
    expect(action).toBeGreaterThan(gate);
  });

  it("shows the configured number masked, never in full", () => {
    expect(page).toContain("control.ownerWhatsappNumber.slice(-4)");
    expect(page).toContain('t("owner.ownerNumberNotSet")');
  });

  it("keeps the number out of the audit log", () => {
    const action = ownerControlFn.slice(ownerControlFn.indexOf('case "set_owner_contact"'));
    const body = action.slice(0, action.indexOf('      default:'));
    const audit = body.slice(body.indexOf("audit_logs"));
    // Length is enough to debug with; the number itself is readable by every
    // admin once it is in a log.
    expect(audit).toContain("digits: digits.length");
    expect(audit).not.toContain("whatsapp_number: digits");
  });
});

describe("validation uses the existing normalization, not a new one", () => {
  it("accepts the real owner number", () => {
    const digits = normalizePhone(OWNER_NUMBER);
    expect(digits).toBe("96170750609");
    expect(digits.length).toBeGreaterThanOrEqual(8);
    expect(digits.length).toBeLessThanOrEqual(15);
  });

  it("accepts international numbers in the formats people actually type", () => {
    for (const written of ["+961 70 750 609", "0096170750609", "+961 (70) 750-609"]) {
      expect(normalizePhone(written)).toBe("96170750609");
    }
    // A long international number is still valid.
    expect(normalizePhone("+44 7732 729713")).toBe("447732729713");
  });

  it("refuses what isOwner() could never match", () => {
    // isOwner() requires at least 8 digits, so anything shorter would be
    // stored and then never match a sender.
    expect(normalizePhone("").length).toBeLessThan(8);
    expect(normalizePhone("123").length).toBeLessThan(8);
    expect(normalizePhone(null).length).toBeLessThan(8);
  });

  it("applies the same floor the function enforces", () => {
    const action = ownerControlFn.slice(ownerControlFn.indexOf('case "set_owner_contact"'));
    expect(action).toContain("normalizePhone");
    expect(action).toContain("digits.length < 8");
  });
});

describe("owner authorization is unchanged", () => {
  it("recognises the configured owner", () => {
    expect(isOwner("96170750609", OWNER_NUMBER)).toBe(true);
    expect(isOwner("96170750609", "96170750609")).toBe(true);
  });

  it("does not treat any other number as the owner", () => {
    // The Cloud API business number is not the owner: it is the number the
    // owner sends TO.
    expect(isOwner("447732729713", OWNER_NUMBER)).toBe(false);
    expect(isOwner("96170750608", OWNER_NUMBER)).toBe(false);
    expect(isOwner("15551234567", OWNER_NUMBER)).toBe(false);
    // A suffix of the owner's number is not the owner either.
    expect(isOwner("750609", OWNER_NUMBER)).toBe(false);
  });

  it("has no owner at all while the number is unset", () => {
    // This is why an empty owner_contact is a safe default: every WhatsApp
    // message is then an ordinary customer message.
    expect(isOwner("96170750609", null)).toBe(false);
    expect(isOwner("96170750609", "")).toBe(false);
  });

  it("does not hard-code the owner number anywhere in the owner path", () => {
    for (const source of [ownerControlFn, hook, page, adminSettings]) {
      expect(source).not.toContain("96170750609");
    }
  });
});
