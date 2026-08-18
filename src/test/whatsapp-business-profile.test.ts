import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The WhatsApp business profile is the company information every customer sees
// when they tap the business name: the about line, the description, the support
// address, the websites, the industry. It is published from
// `supabase/functions/_shared/business-profile.json` by
// `scripts/whatsapp-profile.mjs`.
//
// Two different things are checked here. First that the file is publishable at
// all — Meta rejects an over-length field with an error that names neither the
// field nor the limit, and the round trip to find that out is a manual workflow
// run. Second that the profile and the assistant tell a customer the same
// story: the profile is written once and forgotten, the prompt is edited often,
// and nothing else would notice the day they start disagreeing about how to
// reach the company.

const PROFILE_PATH = "supabase/functions/_shared/business-profile.json";

const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8"));
const assistants = readFileSync("supabase/functions/_shared/assistants.ts", "utf8");
const englishCopy = readFileSync("src/i18n/en.ts", "utf8");

// The WhatsApp assistant is the last entry in the registry, so everything from
// its key onwards is its prompt. Slicing keeps the assertions off the other
// assistants, several of which quote a different Visionex address.
const whatsappPrompt = assistants.slice(assistants.indexOf('"whatsapp-support": assistant('));

describe("WhatsApp business profile", () => {
  it("passes the validator the publish workflow runs before it writes", () => {
    // Delegating to the script rather than restating its limits is the point:
    // the workflow refuses to publish on exactly this exit code, so a green
    // test here means the publish step will clear its own gate.
    const output = execFileSync(
      process.execPath,
      ["scripts/whatsapp-profile.mjs", "--validate"],
      { encoding: "utf8" },
    );
    expect(output).toContain("is valid");
  });

  it("carries no credential", () => {
    // The file is public company information and is read by a workflow that
    // holds a System User token. Neither belongs in the other.
    const raw = readFileSync(PROFILE_PATH, "utf8");
    expect(raw).not.toMatch(/EAA[A-Za-z0-9]{20,}/);
    expect(Object.keys(profile)).not.toContain("token");
  });

  it("gives the same support address the assistant gives", () => {
    expect(profile.email).toBe("support@visionex.app");
    expect(whatsappPrompt).toContain(profile.email);
  });

  it("states the same support hours as the website", () => {
    // The Contact page is where this claim was made first. If marketing
    // changes it there, the profile and the assistant are now two more places
    // saying something the company no longer promises.
    const hours = englishCopy.match(/"contact\.supportHours":\s*"([^"]+)"/)?.[1];
    expect(hours).toBeTruthy();
    expect(profile.description).toContain(hours);
    expect(whatsappPrompt).toContain(hours);
  });

  it("promises the same response time everywhere", () => {
    const responseTime = englishCopy.match(/"contact\.responseTime":\s*"([^"]+)"/)?.[1];
    expect(responseTime).toBeTruthy();
    // Compared on the duration alone: the page says "Within 24 hours" as a
    // label, the profile and the prompt say it inside a sentence, and only the
    // number is the promise.
    const duration = responseTime!.replace(/^within\s+/i, "").toLowerCase();
    expect(profile.description.toLowerCase()).toContain(duration);
    expect(whatsappPrompt.toLowerCase()).toContain(duration);
  });

  it("advertises only visionex.app, over https", () => {
    expect(profile.websites.length).toBeGreaterThan(0);
    for (const site of profile.websites) {
      expect(site).toMatch(/^https:\/\/visionex\.app(\/|$)/);
    }
  });

  it("claims no office, and the assistant says so rather than inventing one", () => {
    // Meta prints `address` on the profile as a place of business. Visionex has
    // none to print, and a model asked "where are you based?" will happily
    // supply one, so the prompt is told the answer explicitly.
    expect(profile.address).toBe("");
    expect(whatsappPrompt).toContain("no walk-in address");
  });

  it("is answered in both languages the assistant supports", () => {
    // The welcome message and the assistant both work in Arabic and English.
    // A profile only in English is the one surface that would not.
    expect(profile.description).toMatch(/[؀-ۿ]/);
    expect(profile.description).toMatch(/[A-Za-z]/);
  });
});
