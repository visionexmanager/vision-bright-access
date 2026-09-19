import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/contexts/LanguageContext", () => {
  const language = { t: (key: string) => key, lang: "en", dir: "ltr" };
  return { useLanguage: () => language };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/hooks/useAdmin", () => ({ useAdmin: () => ({ isAdmin: false }) }));

import { LibrarySidebar } from "@/components/library/layout/LibrarySidebar";

function atWidth(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow && query.includes("max-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
  render(
    <MemoryRouter initialEntries={["/library"]}>
      <TooltipProvider>
        <LibrarySidebar />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return within(screen.getByRole("navigation"));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Library sidebar on a phone", () => {
  it("starts collapsed, so a 240px column does not push the page off a 390px screen", () => {
    atWidth(true);
    expect(screen.getByRole("button", { name: "library.nav.expandSidebar" })).toHaveAttribute("aria-expanded", "false");
  });

  it("still names every link when only the icons show", () => {
    const nav = atWidth(true);
    const links = nav.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) expect(link).toHaveAccessibleName();
  });

  it("stays expanded on a wide screen", () => {
    const nav = atWidth(false);
    expect(screen.getByRole("button", { name: "library.nav.collapseSidebar" })).toHaveAttribute("aria-expanded", "true");
    expect(nav.getAllByRole("link")[0]).toHaveTextContent(/\S/);
  });
});
