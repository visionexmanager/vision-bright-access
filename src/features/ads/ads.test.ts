import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAdEligiblePath } from "./policy";
import { AD_CONSENT_EVENT, readConsent, saveConsent } from "./consent";

describe("advertising route policy", () => {
  it("allows general audience content", () => {
    expect(isAdEligiblePath("/games")).toBe(true);
    expect(isAdEligiblePath("/news/article/example")).toBe(true);
  });

  it("blocks all VisionKids and sensitive routes", () => {
    for (const path of ["/visionkids", "/visionkids/games/play", "/kids", "/login", "/admin/users", "/legal", "/checkout"]) {
      expect(isAdEligiblePath(path)).toBe(false);
    }
  });
});

describe("advertising consent", () => {
  beforeEach(() => localStorage.clear());

  it("does not infer advertising consent from a legacy acceptance", () => {
    localStorage.setItem("vx_cookie_consent", "accepted");
    expect(readConsent()).toBeNull();
  });

  it("stores an explicit choice and notifies consumers", () => {
    const listener = vi.fn();
    window.addEventListener(AD_CONSENT_EVENT, listener);
    const record = saveConsent("all");
    expect(record.advertising).toBe(true);
    expect(readConsent()?.advertising).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(AD_CONSENT_EVENT, listener);
  });

  it("keeps essential-only users free of advertising scripts", () => {
    saveConsent("essential");
    expect(readConsent()?.advertising).toBe(false);
  });
});
