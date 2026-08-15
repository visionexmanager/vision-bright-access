import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";
import { Navbar } from "@/components/Navbar";

// The desktop bar used to carry eleven top-level links, which made it 1687px
// wide on a 1280px viewport and put a horizontal scrollbar on every page. Six
// links stayed; the rest moved into a "More" menu. These tests exist so that
// trimming the bar can never quietly strand a destination, and so the menu that
// now holds them stays operable by keyboard — the primary user is blind.

const noop = () => {};

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en",
    dir: "ltr",
    translateText: (text: string) => text,
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null, signOut: noop }) }));
vi.mock("@/contexts/SoundContext", () => ({
  useSound: () => ({ enabled: true, setEnabled: noop, playSound: noop }),
}));
vi.mock("@/hooks/useAdmin", () => ({ useAdmin: () => ({ isAdmin: false }) }));
vi.mock("@/hooks/usePoints", () => ({ usePoints: () => ({ totalPoints: 0 }) }));
vi.mock("@/components/CartDrawer", () => ({ CartDrawer: () => null }));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));

/** Every destination the desktop bar carried before it was trimmed. */
const FORMERLY_TOP_LEVEL = [
  "/", "/bazaar", "/services", "/finance", "/kids", "/library",
  "/content", "/games", "/careers", "/academy", "/news",
];

const renderNavbar = () => render(<MemoryRouter><Navbar /></MemoryRouter>);

const hrefsIn = (root: HTMLElement) =>
  [...root.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));

describe("Navbar destinations survive the trim", () => {
  it("keeps every formerly top-level route reachable from the mobile menu", () => {
    renderNavbar();
    fireEvent.click(screen.getByRole("button", { name: en["nav.openMenu"] }));

    const hrefs = hrefsIn(screen.getByRole("dialog"));
    for (const route of FORMERLY_TOP_LEVEL) {
      expect(hrefs, `${route} vanished from the mobile menu`).toContain(route);
    }
  });

  it("shows six top-level links plus a More trigger on desktop", () => {
    const { container } = renderNavbar();
    const menubar = container.querySelector("[data-nav-item]")?.parentElement?.closest("div");
    expect(menubar).toBeTruthy();

    const topLevel = [...menubar!.querySelectorAll("a[data-nav-item]")].map((a) => a.getAttribute("href"));
    expect(topLevel).toEqual(["/", "/bazaar", "/services", "/games", "/academy", "/careers"]);
  });

  it("routes moved off the bar are still one keypress away", () => {
    renderNavbar();
    const moreTrigger = screen.getByRole("button", { name: en["nav.more"] });

    // Roving arrow-key focus walks [data-nav-item]; a trigger without it would
    // be skipped and the five destinations behind it would be unreachable.
    expect(moreTrigger).toHaveAttribute("data-nav-item");
    expect(moreTrigger).toHaveAttribute("aria-haspopup", "menu");
    expect(moreTrigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(moreTrigger, { key: "Enter" });

    const menu = screen.getByRole("menu");
    expect(hrefsIn(menu)).toEqual(["/finance", "/kids", "/library", "/content", "/news"]);
    expect(moreTrigger).toHaveAttribute("aria-expanded", "true");
  });
});

describe("Navbar breakpoints leave no dead zone", () => {
  it("swaps the desktop bar and the hamburger at the same width", () => {
    const { container } = renderNavbar();

    const desktopBar = container.querySelector("[data-nav-item]")?.parentElement?.closest("div");
    const toggle = screen.getByRole("button", { name: en["nav.openMenu"] });
    const mobileCluster = toggle.closest("div");

    // Both must key off xl. If one said lg and the other xl, one range would
    // render both navigations and another would render neither.
    expect(desktopBar?.className).toMatch(/(^|\s)xl:flex(\s|$)/);
    expect(desktopBar?.className).not.toMatch(/(^|\s)lg:flex(\s|$)/);
    expect(mobileCluster?.className).toMatch(/(^|\s)xl:hidden(\s|$)/);
    expect(mobileCluster?.className).not.toMatch(/(^|\s)lg:hidden(\s|$)/);
  });
});

describe("Language switcher stays announceable while it shrinks", () => {
  it("names the active language even though the bar shows only a flag", () => {
    renderNavbar();
    // The visible text is hidden below 2xl, so the accessible name is the only
    // thing left that says which language is currently active.
    const switchers = screen.getAllByRole("button", { name: /Choose your language/i });
    expect(switchers.length).toBeGreaterThan(0);
    for (const s of switchers) {
      expect(s.getAttribute("aria-label")).toContain("English — English");
    }
  });
});

describe("Navbar links carry current-page state", () => {
  it("marks the active route with aria-current", () => {
    render(<MemoryRouter initialEntries={["/games"]}><Navbar /></MemoryRouter>);
    const games = screen.getAllByRole("link", { name: en["nav.games"] });
    expect(games.some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  });
});
