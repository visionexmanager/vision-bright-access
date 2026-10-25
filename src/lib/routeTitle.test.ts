import { describe, expect, it } from "vitest";
import { routeTitle } from "./routeTitle";

const DEFAULT = "Visionex — Global Platform for Commerce, Learning, Services & Community";

describe("routeTitle", () => {
  it("names a page that still carries the default title after its heading", () => {
    expect(routeTitle(DEFAULT, DEFAULT, null, "Service Center")).toBe("Service Center — Visionex");
  });

  it("replaces the title it derived for the previous route", () => {
    expect(routeTitle("Service Center — Visionex", DEFAULT, "Service Center — Visionex", "News Hub")).toBe("News Hub — Visionex");
  });

  it("never overrides a title the page set itself", () => {
    expect(routeTitle("Visionex Arcade — Accessible Games", DEFAULT, null, "Play. Learn. Lead.")).toBeNull();
  });

  it("leaves the title alone when the page has no heading", () => {
    expect(routeTitle(DEFAULT, DEFAULT, null, "  ")).toBeNull();
    expect(routeTitle(DEFAULT, DEFAULT, null, null)).toBeNull();
  });

  it("collapses whitespace in a heading split across elements", () => {
    expect(routeTitle(DEFAULT, DEFAULT, null, "Welcome,\n   champion")).toBe("Welcome, champion — Visionex");
  });
});
