import { readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";
import { AIResultList, type AIResultGroups } from "@/components/ai/AIResultList";
import { AIMenu } from "@/components/ai/AIMenu";
import { MAIN_MENU_ID } from "@/lib/ai/navigationMenu";

// The primary user is blind, so these assert what a screen reader is handed:
// roles, accessible names, headings, focus and live regions. They are not a
// substitute for a run with a real screen reader — see the Phase 2 report.

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en",
    dir: "ltr",
    translateText: (text: string) => text,
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild: _asChild, ...props }: { children: ReactNode; asChild?: boolean }) => (
    <button {...props}>{children}</button>
  ),
}));

const groups: AIResultGroups = {
  new: [
    {
      ref: "VX-NEW1", title: "Dell Latitude 5420", brand: "Dell", model: "5420",
      condition: "new", availability: "in_visionex", priceUsd: 620, currency: "USD",
    },
  ],
  used: [
    {
      ref: "VX-USED1", title: "HP EliteBook 840", brand: "HP", model: "840",
      condition: "used", availability: "external_recommendation", priceUsd: 399, currency: "USD",
    },
  ],
  refurbished: [],
};

const noop = () => {};

function renderResults(overrides: Partial<AIResultGroups> = {}) {
  return render(
    <AIResultList
      groups={{ ...groups, ...overrides }}
      onSelect={noop}
      onCompare={noop}
      onDetails={noop}
      onFilterCondition={noop}
      onBack={noop}
    />,
  );
}

describe("result list — screen reader semantics", () => {
  it("keeps new and used in separate labelled sections", () => {
    renderResults();
    // A used listing must never be readable as new stock.
    const newHeading = screen.getByRole("heading", { name: /New \(1\)/ });
    const usedHeading = screen.getByRole("heading", { name: /Used \(1\)/ });
    expect(newHeading).toBeInTheDocument();
    expect(usedHeading).toBeInTheDocument();
    expect(screen.getAllByRole("list")).toHaveLength(2);
  });

  it("announces the count in a live region when results arrive", () => {
    renderResults();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    // aria-atomic so the whole sentence is read, not just the changed number.
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveTextContent("2 results: 1 new, 1 used.");
  });

  it("moves focus to the first results heading so the user lands on them", () => {
    renderResults();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /New \(1\)/ }));
  });

  it("states condition and availability as words, not styling", () => {
    renderResults();
    // With CSS off, the state must still be readable.
    expect(screen.getByText("Available in Visionex")).toBeInTheDocument();
    expect(screen.getByText("External recommendation")).toBeInTheDocument();
  });

  it("packs the full state into each action's accessible name", () => {
    renderResults();
    const select = screen.getByRole("button", { name: /Select: 1\. Dell Latitude 5420/ });
    expect(select).toHaveAccessibleName(/Available in Visionex/);
    expect(select).toHaveAccessibleName(/USD 620\.00/);
    expect(select).toHaveAccessibleName(/New/);
  });

  it("never exposes a supplier unless attribution was required", () => {
    renderResults();
    expect(screen.queryByText(/amazon|ebay|supplier/i)).not.toBeInTheDocument();

    render(
      <AIResultList
        groups={{ new: [{ ...groups.new[0], ref: "VX-ATTR", sourceName: "Partner Store" }], used: [], refurbished: [] }}
        onSelect={noop} onCompare={noop} onDetails={noop} onFilterCondition={noop} onBack={noop}
      />,
    );
    expect(screen.getByText("Partner Store")).toBeInTheDocument();
  });

  it("says price on request rather than inventing a number", () => {
    renderResults({ new: [{ ...groups.new[0], priceUsd: null }] });
    expect(screen.getByText("Price on request")).toBeInTheDocument();
  });

  it("shows only what exists instead of padding to ten", () => {
    renderResults({ used: [], refurbished: [] });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("reports an empty result set instead of rendering a blank panel", () => {
    renderResults({ new: [], used: [], refurbished: [] });
    expect(screen.getByText("No matching results.")).toBeInTheDocument();
  });

  it("disables Compare when there is nothing to compare against", () => {
    renderResults({ new: [groups.new[0]], used: [], refurbished: [] });
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
  });

  it("offers every action the spec lists", () => {
    renderResults();
    for (const name of ["Compare", "New products", "Used products", "Go Back"]) {
      expect(screen.getByRole("button", { name }), `${name} action`).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /More details/ }).length).toBeGreaterThan(0);
  });
});

describe("numbered menu — screen reader semantics", () => {
  function renderMenu(menuId = MAIN_MENU_ID, autoFocus = false) {
    return render(
      <AIMenu menuId={menuId} onSelectChild={noop} onControl={noop} autoFocus={autoFocus} />,
    );
  }

  it("is a landmark with an ordered list, so position and count are announced", () => {
    renderMenu();
    const nav = screen.getByRole("navigation", { name: "Main menu" });
    expect(within(nav).getByRole("list")).toBeInTheDocument();
  });

  it("puts the number inside each option's accessible name", () => {
    renderMenu();
    // Typing "1" must do what pressing this button does, so the number has to
    // be spoken as part of the option.
    expect(screen.getByRole("button", { name: "1. Products" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2. Services" })).toBeInTheDocument();
  });

  it("moves focus to the level heading only when the level changed", () => {
    const { unmount } = renderMenu(MAIN_MENU_ID, false);
    expect(document.activeElement).not.toBe(screen.getByRole("heading", { name: "Main menu" }));
    unmount();

    renderMenu("products", true);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Products" }));
  });

  it("offers Back only below the root", () => {
    const { unmount } = renderMenu(MAIN_MENU_ID);
    expect(screen.queryByRole("button", { name: /Go Back/ })).not.toBeInTheDocument();
    unmount();

    renderMenu("products");
    expect(screen.getByRole("button", { name: /Go Back/ })).toBeInTheDocument();
  });

  it("every option is a real button, so keyboard and screen reader both reach it", () => {
    renderMenu("products");
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(9); // 5 children + back, main menu, search, help
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).not.toHaveAttribute("aria-hidden", "true");
      expect(button).toHaveAccessibleName();
    }
  });

  it("reports the selected child id to its caller", () => {
    const onSelectChild = vi.fn();
    render(<AIMenu menuId={MAIN_MENU_ID} onSelectChild={onSelectChild} onControl={noop} />);
    fireEvent.click(screen.getByRole("button", { name: "1. Products" }));
    expect(onSelectChild).toHaveBeenCalledWith("products");
  });
});

describe("no visual-only state", () => {
  it("carries no colour-only signalling in the result list", () => {
    const source = readFileSync("src/components/ai/AIResultList.tsx", "utf8");
    // Availability and condition are rendered through translated text.
    expect(source).toContain("AVAILABILITY_KEYS");
    expect(source).toContain("CONDITION_KEYS");
    // No aria-hidden on a node that carries the only copy of a state word.
    expect(source).not.toMatch(/aria-hidden="true"[^>]*>\s*\{availability\}/);
  });
});
