// A sign-up keeps one language. Regression: a sender who began in Arabic was
// answered in English for the name step and in Portuguese for the email step,
// and the code email came in Portuguese, so the code was never entered.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { isFieldValue, signupLanguage } from "../../supabase/functions/_shared/chatLanguage.ts";

const history = (...rows: (string | null)[]) => vi.fn(async () => rows);

describe("isFieldValue", () => {
  it.each(["zinakhalil626@gmail.com", " a.b@c.co ", "123456", "١٢٣٤٥٦", "123 456"])("%s is data", (v) => {
    expect(isFieldValue(v)).toBe(true);
  });
  it.each(["register here", "سجل هنا", "my email is a@b.co", "", null])("%s is not", (v) => {
    expect(isFieldValue(v)).toBe(false);
  });
});

describe("signupLanguage", () => {
  it("an email address never decides: the earlier Arabic message does", async () => {
    expect(await signupLanguage("zinakhalil626@gmail.com", history("zeina khalil", "سجل هنا"), "pt")).toBe("ar");
  });

  it("a name with no language of its own keeps the language the sign-up began in", async () => {
    expect(await signupLanguage("zeina khalil", history("سجل هنا"), "en")).toBe("ar");
  });

  it("a code keeps it too, in Arabic-Indic digits as well", async () => {
    expect(await signupLanguage("١٢٣٤٥٦", history("zinakhalil626@gmail.com", "سجل هنا"), "en")).toBe("ar");
  });

  it("a clear sentence in another language still switches it", async () => {
    expect(await signupLanguage("quiero crear una cuenta por favor", history("سجل هنا"), "ar")).toBe("es");
  });

  it("does not ask for history when the message decides for itself", async () => {
    const h = history("سجل هنا");
    expect(await signupLanguage("سجلني هنا من فضلك", h, "en")).toBe("ar");
    expect(h).not.toHaveBeenCalled();
  });

  it("falls back only when nothing in the conversation has a language", async () => {
    expect(await signupLanguage("a@b.co", history("a@b.co", null, "ok"), "fr")).toBe("fr");
  });

  it("skips earlier data messages when looking back", async () => {
    expect(await signupLanguage("a@b.co", history("123456", "x@y.com", "inscription ici"), "en")).toBe("fr");
  });
});

describe("where the webhooks use it", () => {
  it("WhatsApp and Messenger/Instagram both pin the language through signupLanguage", () => {
    const wa = readFileSync("supabase/functions/whatsapp-webhook/index.ts", "utf8");
    const meta = readFileSync("supabase/functions/meta-messaging-webhook/index.ts", "utf8");
    expect(wa).toContain("const gateLanguage = await signupLanguage(");
    expect(wa).not.toContain("languageFor(incoming.text, null, answerLanguage)");
    expect(meta).toContain("return signupLanguage(");
  });
});
