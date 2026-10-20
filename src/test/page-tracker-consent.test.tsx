import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
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

const { PageTracker } = await import("@/components/PageTracker");

let go: (to: string) => void = () => {};
function Nav() {
  go = useNavigate();
  return null;
}
const mount = (path = "/games") =>
  render(<MemoryRouter initialEntries={[path]}><Nav /><PageTracker /></MemoryRouter>);

describe("PageTracker respects analytics consent", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    inserts.length = 0;
  });
  afterEach(cleanup);

  it("records nothing and stores nothing before any consent choice", () => {
    mount();
    act(() => go("/pricing"));
    expect(inserts).toEqual([]);
    expect(sessionStorage.getItem("vx_session_id")).toBeNull();
  });

  it("records nothing when the visitor chose essential cookies only", () => {
    saveConsent("essential");
    mount();
    act(() => go("/pricing"));
    expect(inserts).toEqual([]);
    expect(sessionStorage.getItem("vx_session_id")).toBeNull();
  });

  it("records a page view, with a session id, once analytics is accepted", () => {
    saveConsent("all");
    mount("/games");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ table: "page_events", event_type: "page_view", page_path: "/games" });
    expect(typeof inserts[0].session_id).toBe("string");
    expect(sessionStorage.getItem("vx_session_id")).toBe(inserts[0].session_id);
  });

  it("records each navigation once, and a re-render of the same path not at all", () => {
    saveConsent("all");
    const { rerender } = mount("/games");
    act(() => go("/pricing"));
    rerender(<MemoryRouter initialEntries={["/games"]}><Nav /><PageTracker /></MemoryRouter>);
    expect(inserts.map((r) => r.page_path)).toEqual(["/games", "/pricing"]);
  });

  it("starts recording the current page when consent is granted later, but not the pages before", () => {
    mount("/games");
    act(() => go("/pricing"));
    expect(inserts).toEqual([]);
    act(() => { saveConsent("all"); });
    expect(inserts.map((r) => r.page_path)).toEqual(["/pricing"]);
  });

  it("stops recording as soon as consent is withdrawn", () => {
    saveConsent("all");
    mount("/games");
    act(() => { saveConsent("essential"); });
    act(() => go("/pricing"));
    expect(inserts.map((r) => r.page_path)).toEqual(["/games"]);
  });

  it("treats a corrupt or old-format consent record as no consent", () => {
    localStorage.setItem(AD_CONSENT_KEY, "{not json");
    mount();
    localStorage.setItem(AD_CONSENT_KEY, JSON.stringify({ version: 1, choice: "all", analytics: true }));
    act(() => go("/pricing"));
    expect(inserts).toEqual([]);
  });

  it("treats unavailable storage as no consent", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    mount();
    act(() => go("/pricing"));
    spy.mockRestore();
    expect(inserts).toEqual([]);
  });
});
