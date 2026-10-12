// Two decisions from the 2026-10-12 resource audit, pinned so they are not undone by accident.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const registry = await import("../../supabase/functions/_shared/externalContent/registry.ts");

describe("DOAB", () => {
  it("is listed as unsupported with the measured reason, not registered as a provider", () => {
    expect(registry.CONTENT_PROVIDERS.some((p) => p.id === "doab")).toBe(false);
    const entry = registry.UNSUPPORTED_PROVIDERS.find((p) => p.id === "doab");
    expect(entry?.reason).toMatch(/403/);
    expect(entry?.reason).toMatch(/2026-10-12/);
  });

  it("is in exactly one list, so the health check cannot probe a source we know is closed", () => {
    const ids = [...registry.CONTENT_PROVIDERS.map((p) => p.id), ...registry.UNSUPPORTED_PROVIDERS.map((p) => p.id)];
    expect(ids.filter((id) => id === "doab")).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the Academy library", () => {
  const page = readFileSync("src/pages/academy/AcademyLibrary.tsx", "utf8");

  it("links to Open Sources, carrying the education type and the current search", () => {
    expect(page).toContain("/library/open-sources?type=education");
    expect(page).toContain("encodeURIComponent(query)");
  });

  it("reuses existing translated labels instead of adding untranslated copy", () => {
    expect(page).toContain('t("library.openSources.title")');
    expect(page).toContain('t("library.openSources.category.education")');
  });
});
