// The two URLs Meta App Review checks, and the strings they must contain.
//
// Both are one edit away from silently breaking. Routing /privacy-policy back
// to /legal restores a page where the policy is a card you have to click, and
// a reviewer who lands there records the app as having no privacy policy —
// which is a rejection, not a warning. Nothing else in the suite would notice.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import en from "@/i18n/en";

const app = readFileSync("src/App.tsx", "utf8");

/** Pull the element expression for one route path out of App.tsx. */
function routeElement(path: string): string {
  const match = app.match(
    new RegExp(`<Route\\s+path="${path.replace("/", "\\/")}"\\s*element=\\{([^}]*)\\}`),
  );
  if (!match) throw new Error(`no route declared for ${path}`);
  return match[1];
}

describe("Meta App Review URLs", () => {
  it("serves the privacy policy at its own URL rather than redirecting to the legal index", () => {
    // A <Navigate> here is the regression: /legal renders a grid of cards and
    // opens each policy in a sheet, so the policy text is never at a URL.
    expect(routeElement("/privacy-policy")).toContain("PrivacyPolicy");
    expect(routeElement("/privacy-policy")).not.toContain("Navigate");
  });

  it("serves data deletion instructions at their own URL", () => {
    expect(routeElement("/data-deletion")).toContain("DataDeletion");
    expect(routeElement("/data-deletion")).not.toContain("Navigate");
  });

  it("keeps the legal index working, since the footer and the other policies use it", () => {
    expect(routeElement("/legal")).toContain("LegalCenter");
  });

  it("discloses what Meta sends us and names Meta as a processor", () => {
    // App Review reads the policy for the platform data the app receives. The
    // scoped id and the AI processing are the two facts a reviewer looks for.
    const messaging = en["legal.privacy.collect.messaging.text"];
    expect(messaging).toBeTruthy();
    expect(messaging).toMatch(/Messenger/);
    expect(messaging).toMatch(/scoped/i);
    expect(messaging).toMatch(/AI/);

    expect(en["legal.privacy.third.meta.name"]).toMatch(/Meta/);
  });

  it("states deletion instructions that name Messenger and a route to reach them", () => {
    expect(en["legal.dataDeletion.whatBody"]).toMatch(/Messenger/);
    // The policy must point at the instructions page; Meta asks for that URL.
    expect(en["legal.privacy.deletionLink"]).toBeTruthy();
    expect(app).toContain('path="/data-deletion"');
  });
});
