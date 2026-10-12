// VisionKids approved sources: three gates between the open web and a child —
// the allow-list, an administrator's approval of each resource, and the database.
// Most assertions are about what must be refused.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  APPROVED_SOURCES, addressAllowed, cleanText, sourceById, toCandidate, validAgeRange,
} from "@/features/visionkids/data/approvedSources";
import { approveResource } from "@/features/visionkids/services/ops/approvedResources";

const migration = readFileSync("supabase/migrations/20261068000000_kids_approved_resources.sql", "utf8");
const panel = readFileSync("src/features/visionkids/components/ops/ApprovedSourcesPanel.tsx", "utf8");
const shelf = readFileSync("src/features/visionkids/components/ApprovedResourcesShelf.tsx", "utf8");
const review = readFileSync("src/features/visionkids/pages/ops/ContentReview.tsx", "utf8");
const academy = readFileSync("src/features/visionkids/pages/academy/AcademyHome.tsx", "utf8");

const openstax = sourceById("openstax")!;
const wikibooks = sourceById("wikibooks")!;

const item = (over: Record<string, unknown> = {}) => ({
  provider: "openstax",
  providerItemId: "algebra-and-trigonometry",
  title: "Algebra and Trigonometry",
  description: "A textbook.",
  externalUrl: "https://openstax.org/details/books/algebra-and-trigonometry",
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  attribution: "OpenStax, Rice University",
  language: "en",
  ...over,
}) as Parameters<typeof toCandidate>[0];

describe("the allow-list is narrow", () => {
  it("starts with exactly OpenStax and Wikibooks", () => {
    expect(APPROVED_SOURCES.map((s) => s.id)).toEqual(["openstax", "wikibooks"]);
  });

  it("offers nothing from any other provider, however ordinary", () => {
    for (const provider of ["youtube", "openverse", "wikimedia_commons", "pixabay", "internet_archive", "open_library", "vimeo", "gutenberg"]) {
      expect(toCandidate(item({ provider })), provider).toEqual({ ok: false, problem: "source_not_allowed" });
    }
  });

  it("each source has a flag that is seeded OFF by the migration", () => {
    for (const s of APPROVED_SOURCES) {
      expect(migration).toContain(`'${s.flagKey}'`);
    }
    expect(migration).toMatch(/\('kids_source_openstax',[^)]*false, 'stable'\)/);
    expect(migration).toMatch(/\('kids_source_wikibooks',[^)]*false, 'stable'\)/);
  });
});

describe("addresses", () => {
  it("accepts https on the source's own hosts only", () => {
    expect(addressAllowed(openstax, "https://openstax.org/details/books/x")).toBe(true);
    expect(addressAllowed(wikibooks, "https://en.wikibooks.org/wiki/Algebra")).toBe(true);
    expect(addressAllowed(wikibooks, "https://ar.wikibooks.org/wiki/x")).toBe(true);
  });

  it.each([
    "http://openstax.org/x",
    "https://openstax.org.evil.example/x",
    "https://notopenstax.org/x",
    "https://openstax.org@evil.example/x",
    "https://user:pass@openstax.org/x",
    "https://openstax.org:8443/x",
    "javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "https://openstax.org/a b",
    "https://openstax.org/<x>",
    "//openstax.org/x",
    "",
  ])("refuses %s", (value) => {
    expect(addressAllowed(openstax, value)).toBe(false);
  });

  it("does not let a Wikibooks look-alike through, or the other source's host", () => {
    expect(addressAllowed(wikibooks, "https://evil.example.wikibooks.org/x")).toBe(false);
    expect(addressAllowed(wikibooks, "https://wikibooks.org/x")).toBe(false);
    expect(addressAllowed(wikibooks, "https://openstax.org/x")).toBe(false);
    expect(addressAllowed(openstax, "https://en.wikibooks.org/x")).toBe(false);
    expect(addressAllowed(wikibooks, "https://wikibooks.org.evil.example/x")).toBe(false);
  });

  it("uses the same hosts as the database constraint", () => {
    expect(migration).toContain("openstax\\.org");
    expect(migration).toContain("[a-z]{2,3}\\.wikibooks\\.org");
  });
});

describe("imported metadata is data, never markup or a claim", () => {
  it("accepts a well-formed item and keeps only plain text", () => {
    const result = toCandidate(item({ title: "  <b>Algebra</b>‮ and <script>x</script> Trig  ", description: "<img src=x onerror=alert(1)>A  textbook\n\nfor you" }));
    expect(result).toMatchObject({ ok: true });
    const c = (result as { candidate: { title: string; summary: string } }).candidate;
    expect(c.title).not.toMatch(/[<>‮]/);
    expect(c.title).toContain("Algebra");
    expect(c.summary).not.toMatch(/[<>]/);
    expect(c.summary).toContain("A textbook for you");
  });

  it("refuses an item with no stated Creative Commons licence", () => {
    for (const license of [null, { name: "All rights reserved", url: null }, { name: "", url: null }, { name: "Public domain", url: null }]) {
      expect(toCandidate(item({ license })), JSON.stringify(license)).toEqual({ ok: false, problem: "licence_missing" });
    }
  });

  it("refuses an item with no credit line rather than inventing one", () => {
    expect(toCandidate(item({ attribution: null }))).toEqual({ ok: false, problem: "credit_missing" });
    expect(toCandidate(item({ attribution: "  <i></i> " }))).toEqual({ ok: false, problem: "credit_missing" });
  });

  it("refuses a bad address and an empty title", () => {
    expect(toCandidate(item({ externalUrl: "https://evil.example/x" }))).toEqual({ ok: false, problem: "address_not_allowed" });
    expect(toCandidate(item({ title: "<br>" }))).toEqual({ ok: false, problem: "title_missing" });
  });

  it("drops a licence link that is not a Creative Commons page", () => {
    const r = toCandidate(item({ license: { name: "CC BY 4.0", url: "https://evil.example/license" } })) as { candidate: { license_url: string | null } };
    expect(r.candidate.license_url).toBeNull();
  });

  it("caps lengths to what the database accepts", () => {
    const r = toCandidate(item({ title: "t".repeat(900), description: "d".repeat(900), attribution: "a".repeat(900) })) as { candidate: { title: string; summary: string; attribution: string } };
    expect(r.candidate.title.length).toBeLessThanOrEqual(200);
    expect(r.candidate.summary.length).toBeLessThanOrEqual(500);
    expect(r.candidate.attribution.length).toBeLessThanOrEqual(300);
    expect(cleanText(42, 10)).toBe("");
  });
});

describe("approval is explicit", () => {
  it("accepts only whole ages 3-17 in order", () => {
    expect(validAgeRange(3, 17)).toBe(true);
    expect(validAgeRange(8, 8)).toBe(true);
    for (const [a, b] of [[2, 10], [10, 18], [12, 8], [7.5, 9], [NaN, 9]]) expect(validAgeRange(a, b), `${a}-${b}`).toBe(false);
  });

  it("refuses to write an invalid age range or an unlisted source, before any request", async () => {
    const candidate = (toCandidate(item()) as { candidate: Parameters<typeof approveResource>[0] }).candidate;
    await expect(approveResource(candidate, { ageMin: 12, ageMax: 8, subject: "math" })).rejects.toThrow("age_range_invalid");
    await expect(approveResource({ ...candidate, source: "youtube" as never }, { ageMin: 8, ageMax: 12, subject: "math" })).rejects.toThrow("source_not_allowed");
  });

  it("is admin-only in the page and in the database", () => {
    expect(review).toMatch(/<AdminGate>[\s\S]*<ApprovedSourcesPanel \/>[\s\S]*<\/AdminGate>/);
    expect(migration).toContain("kids_approved_resources: admins");
    expect(migration).toContain("has_role((SELECT auth.uid()), 'admin')");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).not.toMatch(/GRANT[^;]*TO[^;]*\banon\b/);
  });

  it("lets a signed-in child read only approved rows from a switched-on source", () => {
    expect(migration).toMatch(/status = 'approved'[\s\S]*kids_ops_feature_flags[\s\S]*f\.enabled/);
  });

  it("lets an administrator disable a resource without deleting it", () => {
    expect(panel).toContain('"disabled"');
    expect(migration).toContain("CHECK (status IN ('approved', 'disabled'))");
  });
});

describe("external content cannot run", () => {
  it.each([["panel", panel], ["shelf", shelf]])("the %s never embeds, injects or evaluates anything", (_name, source) => {
    expect(source).not.toMatch(/dangerouslySetInnerHTML|<iframe|<embed|<object|innerHTML|eval\(|new Function/);
  });

  it("opens every outside link as a plain anchor that cannot reach back", () => {
    for (const source of [panel, shelf]) expect(source).toContain('rel="noopener noreferrer"');
    expect(shelf).toContain('target="_blank"');
  });

  it("re-checks the address when it renders, not only when it was saved", () => {
    expect(shelf).toContain("addressAllowed(source, r.url)");
  });

  it("renders nothing when there is nothing approved, and sits on the kids Academy page", () => {
    expect(shelf).toContain("if (rows.length === 0) return null");
    expect(academy).toContain("<ApprovedResourcesShelf />");
  });

  it("shows the credit and licence with every resource", () => {
    expect(shelf).toContain("r.attribution");
    expect(shelf).toContain("r.license_name");
  });
});

describe("the same words in every language", () => {
  const keys = [
    "kids.ops.sources.title", "kids.ops.sources.off", "kids.ops.sources.subject.math", "kids.ops.sources.subject.other",
    "kids.ops.sources.refused", "kids.ops.sources.disable", "kids.sources.title", "kids.sources.ages", "kids.sources.opens",
  ];
  it("has every key in all twenty locales", () => {
    const locales = ["en", "ar", "ur", "hi", "id", "ja", "it", "ko", "nl", "pl", "vi", "bn", "fa", "es", "de", "pt", "zh", "tr", "fr", "ru"];
    for (const locale of locales) {
      const file = readFileSync(`src/i18n/${locale}.ts`, "utf8");
      for (const key of keys) expect(file, `${locale} ${key}`).toContain(`"${key}"`);
    }
  });
});
