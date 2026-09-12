// A locked section has to say so, out loud, in the reader's language.
//
// The gate is the only thing between somebody following a bookmark and a page
// that is no longer theirs. Redirecting them somewhere else would be the
// quietest possible answer — worse here than anywhere, because a screen-reader
// user has no visual jump to notice. So these pin the three things that make
// the refusal usable: the page stays where it is, a heading names what is
// needed, and the way out is a link to the plans.
//
// They also pin the direction the default points. A section the catalogue does
// not name, a signed-out visitor, and a lookup that has not come back yet all
// render the page — closing by accident is the failure that costs a user, and
// showing a paid page for a second longer is the one that costs a little money.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import en from "@/i18n/en";
import type { SectionKey } from "@/lib/billing/plans";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en",
    dir: "ltr",
    translateText: (text: string) => text,
  }),
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const authState = { user: null as { id: string } | null, loading: false };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));

const access = { sections: [] as SectionKey[], pending: false };
vi.mock("@/hooks/usePlanAccess", () => ({
  usePlanAccess: () => ({
    access: null,
    isLoading: access.pending,
    has: (section: SectionKey) =>
      !authState.user || access.pending || access.sections.includes(section),
  }),
}));

const { PlanGate } = await import("@/components/PlanGate");

const PAGE = "the academy itself";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PlanGate><p>{PAGE}</p></PlanGate>
    </MemoryRouter>,
  );
}

describe("PlanGate", () => {
  beforeEach(() => {
    authState.user = { id: "user-1" };
    access.sections = ["news", "community", "assistive"];
    access.pending = false;
  });

  it("refuses in place, with a heading and a way out", () => {
    renderAt("/academy/courses");

    expect(screen.getByRole("heading", { name: en["planGate.title"] })).toBeTruthy();
    expect(screen.queryByText(PAGE)).toBeNull();

    const link = screen.getByRole("link", { name: en["planGate.seePlans"] });
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("names the section and the cheapest plan that opens it", () => {
    renderAt("/services/ai-media-studio/video");

    expect(screen.getByText(/AI Media Studio/)).toBeTruthy();
    expect(screen.getByText(/Gold/)).toBeTruthy();
    expect(screen.getByText(/\$?10/)).toBeTruthy();
  });

  it("says what stays open without a plan, so the refusal is not a dead end", () => {
    renderAt("/kids");
    expect(screen.getByText(en["planGate.stillFree"])).toBeTruthy();
  });

  it("opens a section the plan includes", () => {
    access.sections = ["news", "community", "assistive", "academy"];
    renderAt("/academy/courses");
    expect(screen.getByText(PAGE)).toBeTruthy();
  });

  it("never gates a route the catalogue does not name", () => {
    renderAt("/dashboard");
    expect(screen.getByText(PAGE)).toBeTruthy();
  });

  it("never gates a signed-out visitor", () => {
    authState.user = null;
    renderAt("/academy");
    expect(screen.getByText(PAGE)).toBeTruthy();
  });

  it("shows the page while the lookup is still in flight", () => {
    access.pending = true;
    renderAt("/academy");
    expect(screen.getByText(PAGE)).toBeTruthy();
  });
});
