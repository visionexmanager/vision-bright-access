import { describe, expect, it } from "vitest";
import { SERVICE_CATALOG, entriesForHub, getServiceEntry, hubCounts } from "./catalog";
import { HUBS, HUB_ACCENT_CLASSES, INTENTS } from "./hubs";
import type { LocalizedList, LocalizedText } from "./types";

const bothLanguages = (value: LocalizedText) => value.en.trim() !== "" && value.ar.trim() !== "";
const listsAlign = (value: LocalizedList) => value.en.length === value.ar.length;

describe("service catalog", () => {
  it("has unique slugs", () => {
    const slugs = SERVICE_CATALOG.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("assigns every entry to a defined hub", () => {
    const hubIds = new Set(HUBS.map((h) => h.id));
    for (const e of SERVICE_CATALOG) {
      expect(hubIds.has(e.hub), `${e.slug} -> ${e.hub}`).toBe(true);
    }
  });

  it("fills every hub", () => {
    const counts = hubCounts();
    for (const hub of HUBS) {
      expect(counts[hub.id] ?? 0, `hub ${hub.id} is empty`).toBeGreaterThan(0);
      expect(entriesForHub(hub.id).length).toBe(counts[hub.id]);
    }
  });

  it("ships English and Arabic for every visible string", () => {
    for (const e of SERVICE_CATALOG) {
      expect(bothLanguages(e.title), `${e.slug} title`).toBe(true);
      expect(bothLanguages(e.tagline), `${e.slug} tagline`).toBe(true);
      expect(listsAlign(e.keywords), `${e.slug} keywords`).toBe(true);
      expect(listsAlign(e.outcomes), `${e.slug} outcomes`).toBe(true);
      expect(listsAlign(e.skills), `${e.slug} skills`).toBe(true);
      if (e.persona) expect(bothLanguages(e.persona.role), `${e.slug} persona role`).toBe(true);
    }
  });

  it("gives every entry at least one intent so the navigator can reach it", () => {
    const known = new Set(INTENTS.map((i) => i.id));
    for (const e of SERVICE_CATALOG) {
      expect(e.intents.length, `${e.slug} has no intent`).toBeGreaterThan(0);
      for (const intent of e.intents) {
        expect(known.has(intent), `${e.slug} -> unknown intent ${intent}`).toBe(true);
      }
    }
  });

  it("routes every entry to an in-app path", () => {
    for (const e of SERVICE_CATALOG) {
      expect(e.to.startsWith("/"), `${e.slug} -> ${e.to}`).toBe(true);
    }
  });

  it("prices every entry non-negatively", () => {
    for (const e of SERVICE_CATALOG) {
      expect(e.vx, `${e.slug}`).toBeGreaterThanOrEqual(0);
      expect(e.durationMinutes, `${e.slug}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("keeps feasibility inputs internally consistent", () => {
    for (const e of SERVICE_CATALOG) {
      if (!e.feasibility) continue;
      const f = e.feasibility;
      expect(f.startupCostUsd, `${e.slug} startup`).toBeGreaterThan(0);
      expect(f.monthlyCostUsd, `${e.slug} monthly cost`).toBeGreaterThan(0);
      expect(f.monthlyRevenueUsd, `${e.slug} revenue`).toBeGreaterThan(0);
      expect(f.rampUpMonths, `${e.slug} ramp`).toBeGreaterThan(0);
      expect(listsAlign(f.risks), `${e.slug} risks`).toBe(true);
      expect(f.risks.en.length, `${e.slug} needs at least two named risks`).toBeGreaterThanOrEqual(2);
      expect(bothLanguages(f.revenueModel), `${e.slug} revenue model`).toBe(true);
    }
  });

  it("resolves entries by slug", () => {
    expect(getServiceEntry("network-noc")?.hub).toBe("tech-repair");
    expect(getServiceEntry("egg-incubator")?.hub).toBe("business-lab");
    expect(getServiceEntry("nope")).toBeUndefined();
    expect(getServiceEntry(undefined)).toBeUndefined();
  });
});

describe("hub definitions", () => {
  it("has an accent class set for every hub accent", () => {
    for (const hub of HUBS) {
      expect(HUB_ACCENT_CLASSES[hub.accent], `${hub.id}`).toBeDefined();
    }
  });

  it("localises hub copy", () => {
    for (const hub of HUBS) {
      expect(bothLanguages(hub.title)).toBe(true);
      expect(bothLanguages(hub.promise)).toBe(true);
      expect(bothLanguages(hub.description)).toBe(true);
    }
  });

  it("localises intent copy", () => {
    for (const intent of INTENTS) {
      expect(bothLanguages(intent.label)).toBe(true);
      expect(bothLanguages(intent.hint)).toBe(true);
    }
  });
});
