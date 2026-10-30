import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  EMPTY_SOURCING_DRAFT,
  SERVICE_FEE_PERCENT,
  safeVendorLink,
  sourcingIssues,
  sourcingSummary,
  type SourcingDraft,
} from "@/features/sourcing/requests";
import { VENDORS, VENDOR_CATEGORIES } from "@/features/sourcing/vendors";

const draft = (patch: Partial<SourcingDraft>): SourcingDraft => ({ ...EMPTY_SOURCING_DRAFT, ...patch });

describe("assistive sourcing vendors", () => {
  it("lists real https sites once each, with a check date", () => {
    const hosts = VENDORS.map((v) => new URL(v.url).hostname);
    expect(new Set(hosts).size).toBe(hosts.length);
    for (const v of VENDORS) {
      expect(v.url.startsWith("https://")).toBe(true);
      expect(v.country).toMatch(/^[A-Z]{2}$/);
      expect(v.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(v.categories.length).toBeGreaterThan(0);
      for (const c of v.categories) expect(VENDOR_CATEGORIES).toContain(c);
    }
  });

  it("covers blind and low vision first, and the other disability areas", () => {
    for (const c of VENDOR_CATEGORIES) {
      expect(VENDORS.some((v) => v.categories.includes(c))).toBe(true);
    }
  });

  it("lists MaxiAids as a link only: no product data lives in the repo", () => {
    expect(VENDORS.find((v) => v.id === "maxiaids")?.url).toBe("https://www.maxiaids.com/");
    // A vendor row has no price, image or description field to copy into.
    const source = readFileSync("src/features/sourcing/vendors.ts", "utf8");
    expect(source).not.toMatch(/\bprice\b\s*:|\bimage\s*:|\bdescription\s*:/);
  });
});

describe("assistive sourcing request", () => {
  it("accepts only plain https addresses", () => {
    expect(safeVendorLink("https://shop.example.com/p/1")).toBe("https://shop.example.com/p/1");
    expect(safeVendorLink("http://shop.example.com")).toBeNull();
    expect(safeVendorLink("javascript:alert(1)")).toBeNull();
    expect(safeVendorLink("https://user:pw@shop.example.com")).toBeNull();
    expect(safeVendorLink("https://localhost/x")).toBeNull();
  });

  it("names every missing field", () => {
    expect(sourcingIssues(draft({})).map((i) => i.code)).toEqual([
      "productRequired",
      "countryRequired",
      "routeRequired",
    ]);
    expect(sourcingIssues(draft({ product: "x", country: "LB", route: "order", link: "nope" })).map((i) => i.code)).toEqual(["linkInvalid"]);
    expect(sourcingIssues(draft({ product: "x", country: "LB", route: "support", quantity: 0 })).map((i) => i.code)).toEqual(["quantityInvalid"]);
  });

  it("writes a summary with no contact details", () => {
    const text = sourcingSummary(
      draft({ product: "Talking scale", vendorId: "lss", link: "https://www.lssproducts.com/x", country: "Lebanon", route: "order", specs: "Arabic voice" }),
    );
    expect(text).toContain("Product: Talking scale");
    expect(text).toContain("Preferred vendor: LS&S");
    expect(text).toContain("Vendor page: https://www.lssproducts.com/x");
    expect(text).toContain("Visionex to order it");
    expect(text).not.toMatch(/@|phone|email/i);
  });

  it("tells the team the real service fee, not the name of the constant", () => {
    const text = sourcingSummary(draft({ product: "x", country: "LB", route: "order" }));
    expect(text).toContain(`${SERVICE_FEE_PERCENT}% service fee`);
    expect(text).not.toContain("${");
  });
});
