// The crawler copy of the legal pages.
//
// Meta's automated check reads the response body, and this app answers every
// route with an empty shell until React runs. scripts/prerender-legal.mjs
// writes a filled copy for the two URLs App Review looks at, and it is wired
// into the Vite build as a plugin so it runs whatever build command the VPS
// uses. What is worth testing is the part that can go wrong quietly: the copy
// still containing the disclosures, and the shell still being filled.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPages, injectShell } from "../../scripts/prerender-legal.mjs";
import en from "@/i18n/en";

const privacySource = readFileSync("src/pages/legal/PrivacyPolicy.tsx", "utf8");
const { privacy, deletion } = buildPages(en, privacySource);

const SHELL = [
  "<html><head>",
  "<title>Visionex</title>",
  '<meta name="description" content="platform" />',
  '</head><body><div id="root"></div><script src="/assets/index.js"></script></body></html>',
].join("");

describe("prerendered legal pages", () => {
  it("puts the whole privacy policy in the crawled copy", () => {
    expect(privacy).toContain("Privacy Policy");
    // The sections a reviewer reads for platform data.
    expect(privacy).toContain("Facebook Messenger and Instagram Direct messages");
    expect(privacy).toContain("Meta Platforms");
    expect(privacy).toContain("/data-deletion");
    // Not a stub: the policy is long, and a near-empty page would still pass
    // every assertion above.
    expect(privacy.length).toBeGreaterThan(8000);
  });

  it("puts the deletion instructions in the crawled copy", () => {
    expect(deletion).toContain("Data Deletion Request");
    expect(deletion).toContain("Messenger");
    expect(deletion).toContain("mailto:hello@visionex.app");
    expect(deletion).toMatch(/<ol>(?:.*?<li>){3}/s);
  });

  it("takes its section lists from the component, so a new entry cannot be left out", () => {
    // "messaging" and "meta" were added to the arrays in PrivacyPolicy.tsx and
    // reach the crawled copy without this script naming them.
    expect(privacySource).toContain('"messaging"');
    expect(privacySource).toContain('"meta"');
    expect(privacy).toContain(en["legal.privacy.collect.messaging.heading"]);
    expect(privacy).toContain(en["legal.privacy.third.meta.name"]);
  });

  it("emits no unresolved translation keys", () => {
    expect(privacy).not.toMatch(/legal\.[a-z]+\.[a-z]/i);
    expect(deletion).not.toMatch(/legal\.[a-z]+\.[a-z]/i);
  });

  it("fills the shell's root and corrects the head", () => {
    const html = injectShell(SHELL, {
      body: deletion,
      title: "Data Deletion Request — Visionex",
      description: "How to have your data deleted.",
      canonical: "https://visionex.app/data-deletion",
    });

    expect(html).toContain("<title>Data Deletion Request — Visionex</title>");
    expect(html).toContain('content="How to have your data deleted."');
    expect(html).toContain('<link rel="canonical" href="https://visionex.app/data-deletion" />');
    expect(html).not.toContain('<div id="root"></div>');
    // The asset tags must survive: the file is served from a subdirectory, and
    // the app has to boot from it exactly as it does from the shell.
    expect(html).toContain('src="/assets/index.js"');
  });

  it("refuses to write a page it could not fill", () => {
    // A shell whose root container changed shape would otherwise be published
    // with the policy silently missing.
    expect(() => injectShell("<html><head></head><body><div id=app></div></body></html>", {
      body: privacy,
      title: "x",
      description: "y",
      canonical: "z",
    })).toThrow(/root/);
  });
});
