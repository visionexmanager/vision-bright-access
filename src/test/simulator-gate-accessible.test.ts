// The simulator's gate screens, focus and filters, for readers who do not see the page.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("the billing hook does not word anything for the reader", () => {
  const source = read("src/hooks/useSimulationBilling.ts");

  it("contains no Arabic literal, so the English page can never show Arabic prose", () => {
    expect(/[؀-ۿ]/.test(source)).toBe(false);
  });

  it("reports a reason the page can translate", () => {
    expect(source).toContain('"login" | "vx" | "error"');
    expect(source).toContain('setReason("login")');
    expect(source).toContain('setReason("vx")');
  });
});

describe("the runner", () => {
  const source = read("src/pages/SimulationRunner.tsx");

  it("sends the back link to the simulator list, not to /services", () => {
    expect(source).not.toContain('to="/services"');
    expect(source.match(/to="\/business-simulator"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("offers signed-out visitors a sign-in link that returns them here", () => {
    expect(source).toContain("/login?returnTo=${encodeURIComponent(location.pathname)}");
  });

  it("announces the blocked card", () => {
    expect(source).toContain('<Card role="alert"');
  });

  it("moves focus to the stage when the phase changes, but not on first arrival", () => {
    expect(source).toContain('before !== "loading"');
    expect(source.match(/ref=\{stageRef\} tabIndex=\{-1\}/g)?.length).toBe(3);
  });
});

describe("the gate wording exists in every locale", () => {
  const dir = join(root, "src/i18n");
  const langs = readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(/\.ts$/, ""))
    .filter((l) => /^[a-z]{2}$/.test(l)); // academyDomText.ts is not a locale

  it("has twenty locales to check", () => {
    expect(langs.length).toBe(20);
  });

  it.each(["bsim.needLogin", "bsim.signIn", "bsim.needVx"])("%s is defined in all of them", (key) => {
    const missing = langs.filter((l) => {
      const files = [`src/i18n/${l}.ts`, `src/i18n/chunks/${l}.ts`].filter((f) => existsSync(join(root, f)));
      return !files.some((f) => read(f).includes(`"${key}":`));
    });
    expect(missing).toEqual([]);
  });

  it("keeps the {amount} placeholder in every translation of bsim.needVx", () => {
    const broken = langs.filter((l) => {
      const files = [`src/i18n/${l}.ts`, `src/i18n/chunks/${l}.ts`].filter((f) => existsSync(join(root, f)));
      const line = files.map(read).join("\n").split(/\r?\n/).find((x) => x.includes('"bsim.needVx":'));
      return !line?.includes("{amount}");
    });
    expect(broken).toEqual([]);
  });
});

describe("the simulator list pages", () => {
  it("mark every filter and sort button with its pressed state", () => {
    const source = read("src/pages/SimulationsSummary.tsx");
    const toggles = source.match(/<Button [^>]*variant=\{[^}]*\? "default" : "outline"\}/g) ?? [];
    expect(toggles.length).toBeGreaterThanOrEqual(8);
    const unpressed = toggles.filter((t) => !t.includes("aria-pressed="));
    expect(unpressed).toEqual([]);
  });

  it.each(["src/pages/BusinessSimulator.tsx", "src/pages/SimulationsSummary.tsx"])(
    "%s announces its loading state",
    (file) => {
      const source = read(file);
      expect(source).toContain('<div role="status"');
      expect(source).toContain('t("common.loading")');
    },
  );
});
