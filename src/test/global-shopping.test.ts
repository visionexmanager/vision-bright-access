import { describe, expect, it } from "vitest";

import {
  EMPTY_SOURCING_DRAFT,
  GLOBAL_SERVICE_TYPE,
  SERVICE_TYPE,
  serviceTypeFor,
  sourcingSummary,
  type SourcingDraft,
} from "@/features/sourcing/requests";
import { STORES } from "@/features/sourcing/stores";

const draft = (patch: Partial<SourcingDraft>): SourcingDraft => ({ ...EMPTY_SOURCING_DRAFT, ...patch });

describe("global shopping desk", () => {
  it("lists the big stores once each over https", () => {
    const ids = STORES.map((store) => store.id);
    for (const id of ["amazon", "alibaba", "aliexpress", "shein", "temu", "ebay"]) expect(ids).toContain(id);
    const hosts = STORES.map((store) => new URL(store.url).hostname);
    expect(new Set(hosts).size).toBe(hosts.length);
    for (const store of STORES) expect(store.url.startsWith("https://")).toBe(true);
  });

  it("files under its own service type, apart from the assistive desk", () => {
    expect(serviceTypeFor("global", "order")).toBe(GLOBAL_SERVICE_TYPE.order);
    expect(serviceTypeFor("assistive", "order")).toBe(SERVICE_TYPE.order);
    expect(GLOBAL_SERVICE_TYPE.order).not.toBe(SERVICE_TYPE.order);
  });

  it("states new or used in the summary the team reads", () => {
    const base = { product: "Kettle", country: "Jordan", vendorId: "ebay", route: "order" as const };
    expect(sourcingSummary(draft({ ...base, condition: "used" }), "global")).toContain("Condition: used only");
    expect(sourcingSummary(draft({ ...base, condition: "new" }), "global")).toContain("Condition: new only");
    expect(sourcingSummary(draft({ ...base }), "global")).toContain("Condition: new or used");
    expect(sourcingSummary(draft({ ...base }), "global")).toContain("eBay");
  });

  it("leaves the assistive summary unchanged", () => {
    const text = sourcingSummary(draft({ product: "Kettle", country: "Jordan", route: "order" }));
    expect(text).not.toContain("Condition:");
    expect(text).not.toContain("Desk:");
  });
});
