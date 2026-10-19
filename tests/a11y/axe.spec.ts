import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Automated accessibility scan (axe-core, WCAG 2.0/2.1 A and AA rules) of public
// routes in English, Arabic (right-to-left) and Spanish, against the built app.
//
// What this is: a regression net for the rules axe can decide. What it is not:
// proof of accessibility. Reading order, announcements, meaning of text and real
// screen-reader behaviour need people (docs/audit/VISIONEX_MANUAL_ACCESSIBILITY_TEST_GUIDE.md).
//
// The backend is a stub: every request to the dummy Supabase URL gets an empty
// answer, and every other origin is blocked, so the page renders its shell and
// static content only. Routes that need data or a session do not render their
// data states here.

const LOCALES = [
  { code: "en", dir: "ltr" },
  { code: "ar", dir: "rtl" },
  { code: "es", dir: "ltr" },
] as const;

const ROUTES = ["/", "/login", "/signup", "/forgot-password", "/services", "/pricing", "/contact-us", "/games", "/library", "/travel", "/bazaar"];

/**
 * Violations that exist today and are not fixed by this change. Key: "<locale> <route>",
 * value: axe rule ids. The test fails on any violation NOT listed here, and also on a
 * listed one that no longer occurs, so this list can only shrink.
 */
const KNOWN: Record<string, string[]> = {
  // Found by this suite on its first run, not fixed here and not explained yet: the
  // active nav link "Games" (teal text on a 10% teal wash, class "bg-primary/10
  // text-primary" in Navbar.tsx) is measured by axe at 3.06:1 against #bbc5c6, a
  // colour that is not what the sticky nav's own background resolves to. Needs a
  // person to look at what sits under the nav on /games. Not a rule exemption:
  // every other route and the Arabic /games page pass.
  "en /games": ["color-contrast"],
  "es /games": ["color-contrast"],
};

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function prepare(page: Page, lang: string) {
  await page.addInitScript((l) => {
    try { localStorage.setItem("visionex-lang", l); } catch { /* storage unavailable */ }
  }, lang);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === "127.0.0.1" && url.port === "4173") return route.continue();
    if (url.hostname === "127.0.0.1" && url.port === "54321") {
      const rest = url.pathname.startsWith("/rest/");
      return route.fulfill({ status: 200, contentType: "application/json", body: rest ? "[]" : "{}" });
    }
    return route.abort();
  });
}

async function settle(page: Page, lang: string, dir: string) {
  await page.waitForFunction(() => (document.querySelector("#root")?.children.length ?? 0) > 0);
  await page.waitForFunction(([l, d]) => document.documentElement.lang === l && document.documentElement.dir === d, [lang, dir]);
  await page.waitForLoadState("networkidle").catch(() => undefined);
  // Lazy route chunks and the locale dictionary resolve after first paint.
  await page.waitForTimeout(600);
  // Freeze CSS motion. axe reads computed colours, and a fade or colour transition
  // caught half-way gives a contrast ratio that differs from run to run.
  await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}" });
  await page.waitForTimeout(100);
}

for (const { code, dir } of LOCALES) {
  test.describe(`axe ${code} (${dir})`, () => {
    for (const route of ROUTES) {
      test(`${route}`, async ({ page }) => {
        await prepare(page, code);
        await page.goto(route);
        await settle(page, code, dir);

        // Guard against scanning a blank or error page and calling it clean.
        const text = (await page.locator("body").innerText()).trim();
        expect(text.length, "page rendered no text").toBeGreaterThan(40);

        const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        const found = new Set(violations.map((v) => v.id));
        const known = new Set(KNOWN[`${code} ${route}`] ?? []);

        const unexpected = violations.filter((v) => !known.has(v.id));
        const stale = [...known].filter((id) => !found.has(id));

        expect(
          unexpected.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`),
          "new accessibility violations",
        ).toEqual([]);
        expect(stale, "listed in KNOWN but no longer occurs - remove it").toEqual([]);
      });
    }
  });
}

test.describe("keyboard and names on the login form", () => {
  test("fields are labelled and reachable by Tab, in order", async ({ page }) => {
    await prepare(page, "en");
    await page.goto("/login");
    await settle(page, "en", "ltr");

    const email = page.getByLabel(/email/i).first();
    const password = page.getByLabel(/password/i).first();
    await expect(email).toBeVisible();
    await expect(password).toBeVisible();

    await email.focus();
    await page.keyboard.press("Tab");
    // Focus must land on something usable after the email field, never be lost to <body>.
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
    expect(["INPUT", "BUTTON", "A"]).toContain(tag);

    // A focused control must show a visible indicator (outline or box-shadow).
    const indicator = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return "none";
      const s = getComputedStyle(el);
      return `${s.outlineStyle}:${s.outlineWidth}|${s.boxShadow}`;
    });
    expect(indicator).not.toMatch(/^none:0px\|none$/);
  });
});
