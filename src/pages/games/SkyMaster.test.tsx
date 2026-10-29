import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settle = vi.fn();
const click = vi.fn();

vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLanguage: () => ({ lang: "en" }) }));
vi.mock("@/contexts/SoundContext", () => ({ useSound: () => ({ playSound: click }) }));
vi.mock("@/components/game/GameEconomyGate", () => ({ useGameEconomy: () => ({ settleGameResult: settle }) }));
vi.mock("@/features/arcade/audio/playProductionSound", () => ({ playProductionSound: vi.fn() }));
vi.mock("@/components/game/GameHeader", () => ({ GameHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/game/GameInstructions", () => ({ GameInstructions: ({ title }: { title: string }) => <h2>{title}</h2> }));

import SkyMaster from "./SkyMaster";

const press = (name: RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const status = () => screen.getByRole("status").textContent;

describe("Sky Master page", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    settle.mockClear();
    click.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("says exactly what is missing instead of silently refusing take-off", () => {
    render(<SkyMaster />);
    press(/Master power/);
    press(/Rotate and take off/);
    expect(status()).toMatch(/Missing: engine, flaps/);
  });

  it("exposes each switch as a pressed/unpressed toggle", () => {
    render(<SkyMaster />);
    const power = screen.getByRole("button", { name: /Master power/ });
    expect(power).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(power);
    expect(power).toHaveAttribute("aria-pressed", "true");
  });

  it("flies a whole clean flight by button presses and the clock alone, and settles once", () => {
    render(<SkyMaster />);
    press(/Master power/);
    press(/Engine start/);
    press(/Flaps 15/);
    press(/Rotate and take off/);
    press(/Flaps 15/); // retract once airborne
    act(() => { vi.advanceTimersByTime(250 * 25); });
    expect(status()).toMatch(/Cruise altitude reached/);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10000");

    press(/Serve meals/);
    press(/Drinks cart/);
    press(/Announce to passengers/);
    act(() => { vi.advanceTimersByTime(250 * 20); });

    expect(screen.getByText(/landed safely at the international hub/i)).toBeInTheDocument();
    expect(screen.getByText("3 stars")).toBeInTheDocument();
    expect(settle).toHaveBeenCalledTimes(1);
    expect(settle).toHaveBeenCalledWith("win", "Sky Master");
  });

  it("plays one sound per press even under StrictMode double rendering", () => {
    render(<StrictMode><SkyMaster /></StrictMode>);
    press(/Master power/);
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("does not announce every tick, only the 2,500-foot milestones", () => {
    render(<SkyMaster />);
    press(/Master power/);
    press(/Engine start/);
    press(/Flaps 15/);
    press(/Rotate and take off/);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      act(() => { vi.advanceTimersByTime(250); });
      seen.add(status() ?? "");
    }
    expect([...seen].filter((line) => /Altitude/.test(line))).toEqual(["Altitude 2,500 ft.", "Altitude 5,000 ft."]);
  });
});
