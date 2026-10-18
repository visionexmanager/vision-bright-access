import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdBanner } from "@/components/AdBanner";
import { saveConsent } from "@/features/ads/consent";

const adScripts = () => document.querySelectorAll('script[src*="googlesyndication"]').length;
const mount = (path = "/games") =>
  render(<MemoryRouter initialEntries={[path]}><AdBanner slot="1234567890" /></MemoryRouter>);

describe("AdBanner respects advertising consent", () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.querySelectorAll('script[src*="googlesyndication"]').forEach((s) => s.remove());
  });
  afterEach(cleanup);

  it("loads no ad script and renders nothing before any consent choice", () => {
    const { container } = mount();
    expect(adScripts()).toBe(0);
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
  });

  it("stays off when the visitor chose essential cookies only", () => {
    saveConsent("essential");
    const { container } = mount();
    expect(adScripts()).toBe(0);
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
  });

  it("never loads on a blocked route even with consent", () => {
    saveConsent("all");
    const { container } = mount("/login");
    expect(adScripts()).toBe(0);
    expect(container.querySelector("ins.adsbygoogle")).toBeNull();
  });

  it("loads once the visitor accepts advertising on an eligible route", () => {
    const { container } = mount();
    expect(adScripts()).toBe(0);
    act(() => { saveConsent("all"); });
    expect(container.querySelector("ins.adsbygoogle")).not.toBeNull();
    expect(adScripts()).toBe(1);
  });
});
