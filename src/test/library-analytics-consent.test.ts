import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveConsent, AD_CONSENT_KEY } from "@/features/ads/consent";

const inserts: Record<string, unknown>[] = [];
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, ...row });
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

const { logLibraryAnalyticsEvent } = await import("@/services/library/analytics");

describe("Library analytics respects analytics consent", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    inserts.length = 0;
  });

  it("sends nothing and stores nothing before any consent choice", async () => {
    await logLibraryAnalyticsEvent("page_view", { entityType: "explorer" });
    expect(inserts).toEqual([]);
    expect(sessionStorage.getItem("library:analytics-session-id")).toBeNull();
  });

  it("sends nothing when the visitor chose essential cookies only", async () => {
    saveConsent("essential");
    await logLibraryAnalyticsEvent("search", { userId: "u1", entityType: "explorer", metadata: { q: "x" } });
    expect(inserts).toEqual([]);
    expect(sessionStorage.getItem("library:analytics-session-id")).toBeNull();
  });

  it("sends the event, with its fields, once analytics is accepted", async () => {
    saveConsent("all");
    await logLibraryAnalyticsEvent("card_click", { userId: "u1", entityType: "book", entityId: "b1", metadata: { a: 1 } });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ table: "library_analytics_events", event_type: "card_click", user_id: "u1", entity_type: "book", entity_id: "b1" });
    expect(typeof inserts[0].session_id).toBe("string");
  });

  it("stops the moment consent is withdrawn, and resumes if it is granted again", async () => {
    saveConsent("all");
    await logLibraryAnalyticsEvent("book_open");
    saveConsent("essential");
    await logLibraryAnalyticsEvent("book_open");
    await logLibraryAnalyticsEvent("share");
    expect(inserts).toHaveLength(1);
    saveConsent("all");
    await logLibraryAnalyticsEvent("share");
    expect(inserts.map((r) => r.event_type)).toEqual(["book_open", "share"]);
  });

  it("is off for a corrupt or old-format consent record", async () => {
    localStorage.setItem(AD_CONSENT_KEY, "{not json");
    await logLibraryAnalyticsEvent("page_view");
    localStorage.setItem(AD_CONSENT_KEY, JSON.stringify({ version: 1, choice: "all", analytics: true }));
    await logLibraryAnalyticsEvent("page_view");
    expect(inserts).toEqual([]);
  });

  it("is off when storage is unavailable", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    await logLibraryAnalyticsEvent("page_view");
    spy.mockRestore();
    expect(inserts).toEqual([]);
  });

  it("never throws, with or without consent", async () => {
    await expect(logLibraryAnalyticsEvent("page_view")).resolves.toBeUndefined();
    saveConsent("all");
    await expect(logLibraryAnalyticsEvent("page_view")).resolves.toBeUndefined();
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return /^(test|integrations)$/.test(name) ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("there is no second path into library_analytics_events", () => {
  it("only src/services/library/analytics.ts writes the table", () => {
    const writer = /\.from\(\s*["']library_analytics_events["']\s*\)\s*\.(insert|upsert)/;
    const writers = sourceFiles("src").filter((f) => writer.test(readFileSync(f, "utf8"))).map((f) => f.replace(/\\/g, "/"));
    expect(writers).toEqual(["src/services/library/analytics.ts"]);
  });

  it("no Edge Function writes it either", () => {
    const offenders = sourceFiles("supabase/functions").filter((f) => readFileSync(f, "utf8").includes("library_analytics_events"));
    expect(offenders).toEqual([]);
  });
});
