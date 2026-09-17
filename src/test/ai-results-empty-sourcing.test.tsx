// A product search on the website that finds nothing is not the end of it:
// the empty list offers to have the team source what was searched for.

import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en", dir: "ltr", translateText: (text: string) => text,
  }),
}));

const { AIResultList } = await import("@/components/ai/AIResultList");

const empty = { new: [], used: [], refurbished: [] };
const noop = () => {};
const base = { groups: empty, onSelect: noop, onCompare: noop, onDetails: noop, onFilterCondition: noop, onBack: noop };

describe("an empty product search", () => {
  it("offers to ask the team, with a labelled button", () => {
    const request = vi.fn();
    render(<AIResultList {...base} onRequestSourcing={request} />);
    expect(screen.getByText(en["aiResults.emptySourcing"])).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en["aiResults.requestThis"] }));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("shows it is sending, and cannot be pressed twice", () => {
    render(<AIResultList {...base} onRequestSourcing={noop} requesting />);
    const button = screen.getByRole("button", { name: en["aiResults.requesting"] }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("keeps the plain message where no request can be made", () => {
    render(<AIResultList {...base} />);
    expect(screen.getByText(en["aiResults.empty"])).toBeTruthy();
    expect(screen.queryByRole("button", { name: en["aiResults.requestThis"] })).toBeNull();
  });

  it("is wired in the chat, as a sourcing request for what was searched", () => {
    const chat = readFileSync("src/components/AIChat.tsx", "utf8");
    expect(chat).toContain("onRequestSourcing={sourcingQuery ? () => void requestSourcingFor(null) : undefined}");
    expect(chat).toContain('reason: item ? "sourcing_confirmation" : "complex_sourcing"');
  });
});
