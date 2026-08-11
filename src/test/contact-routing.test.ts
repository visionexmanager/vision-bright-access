import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTACT_DEPARTMENTS, DEFAULT_DEPARTMENT, isContactDepartmentId } from "@/features/contact/departments";

// The department table exists in two places that cannot import each other: the
// React bundle and a Deno edge function. These tests pin them together, and pin
// the rule that internal mailboxes never appear in shipped code.

const routing = readFileSync("supabase/functions/_shared/contactRouting.ts", "utf8");
const contactForm = readFileSync("supabase/functions/contact-form/index.ts", "utf8");
const contactPage = readFileSync("src/pages/ContactUs.tsx", "utf8");

const PUBLIC_ADDRESSES: Record<string, string> = {
  general: "hello@visionex.app",
  support: "support@visionex.app",
  billing: "billing@visionex.app",
  news: "news@visionex.app",
};

/** Never published, never committed — server-side only, from a secret. */
const INTERNAL_ADDRESSES = [
  "admin@visionex.app",
  "mohammad@visionex.app",
  "malak@visionex.app",
];

describe("contact department routing", () => {
  it("publishes exactly the four public departments", () => {
    expect(CONTACT_DEPARTMENTS.map((d) => d.id)).toEqual(["general", "support", "billing", "news"]);
    for (const { id, email } of CONTACT_DEPARTMENTS) {
      expect(email, `${id} address`).toBe(PUBLIC_ADDRESSES[id]);
    }
  });

  it("routes each department to its own inbox on the edge function side", () => {
    for (const [id, address] of Object.entries(PUBLIC_ADDRESSES)) {
      // The route table entry and the address must sit together.
      const entry = routing.slice(routing.indexOf(`  ${id}: {`));
      expect(entry.slice(0, 200), `${id} route`).toContain(`inbox: "${address}"`);
    }
  });

  it("falls back to General instead of dropping an unroutable message", () => {
    expect(DEFAULT_DEPARTMENT).toBe("general");
    expect(isContactDepartmentId("marketing")).toBe(false);
    expect(isContactDepartmentId(undefined)).toBe(false);
    expect(isContactDepartmentId("billing")).toBe(true);
    expect(routing).toContain("return typeof value === \"string\" && value in DEPARTMENT_ROUTES");
  });
});

describe("internal mailboxes stay out of shipped code", () => {
  it("never appears in the contact page, the router, or the edge function", () => {
    for (const address of INTERNAL_ADDRESSES) {
      expect(contactPage, `${address} in ContactUs.tsx`).not.toContain(address);
      expect(routing, `${address} in contactRouting.ts`).not.toContain(address);
      expect(contactForm, `${address} in contact-form`).not.toContain(address);
    }
  });

  it("reads extra internal recipients from a secret with no committed default", () => {
    expect(contactForm).toContain('Deno.env.get("CONTACT_INTERNAL_RECIPIENTS")');
    // An empty-string fallback: unset means "department inbox only", never a
    // hardcoded address.
    expect(contactForm).toContain('?? ""');
  });
});

describe("auto-reply", () => {
  it("does not fail the request when mail cannot be sent", () => {
    // Inside the handler the insert and its 500 path come first, and only then
    // is mail attempted — so a Resend outage cannot turn a stored request into
    // an error the sender sees and retries. Both sends are caught individually.
    const insertFailurePath = contactForm.indexOf('"Failed to save request"');
    const mailStarts = contactForm.indexOf('Deno.env.get("RESEND_API_KEY")');
    expect(insertFailurePath).toBeGreaterThan(-1);
    expect(mailStarts).toBeGreaterThan(insertFailurePath);

    expect(contactForm.match(/\.catch\(\(\) => false\)/g) ?? []).toHaveLength(2);
    // Success is reported regardless of the mail outcome, with the outcome
    // surfaced rather than hidden.
    expect(contactForm).toContain("success: true, department, notified, acknowledged");
  });

  it("answers in Arabic only for the Arabic locale", () => {
    expect(routing).toContain('locale.toLowerCase().startsWith("ar") ? "ar" : "en"');
  });

  it("escapes sender-supplied text before putting it in an HTML body", () => {
    expect(routing).toContain("export function escapeHtml");
    expect(routing).toContain("escapeHtml(params.message)");
    expect(routing).toContain("escapeHtml(body.greeting)");
  });

  it("keeps the promised wording in the shared opening", () => {
    expect(routing).toContain(
      "Thank you for contacting Visionex. We have received your message and our team will review it as soon as possible.",
    );
    expect(routing).toContain("https://visionex.app");
  });
});
