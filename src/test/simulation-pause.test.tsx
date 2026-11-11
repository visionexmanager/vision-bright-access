// The Pause button of the business simulators.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SimulationPauseProvider, useSimulationPause } from "@/contexts/SimulationPauseContext";
import { SimulationPauseControl } from "@/components/SimulationPauseControl";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) =>
      ({ "bsim.pause": "Pause", "bsim.resume": "Resume", "bsim.pausedNotice": "Paused notice" })[key] ?? key,
  }),
}));

/** A simulator in miniature: a clock that follows the same rule as the real ones. */
function Clock() {
  const { pausedRef } = useSimulationPause();
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setTicks((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [pausedRef]);
  return <output data-testid="ticks">{ticks}</output>;
}

describe("pausing a simulation", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("stops the clock while paused and carries on when resumed", () => {
    render(
      <SimulationPauseProvider>
        <SimulationPauseControl />
        <Clock />
      </SimulationPauseProvider>,
    );
    const ticks = () => Number(screen.getByTestId("ticks").textContent);

    act(() => void vi.advanceTimersByTime(3000));
    expect(ticks()).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(ticks()).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    act(() => void vi.advanceTimersByTime(2000));
    expect(ticks()).toBe(5);
  });

  it("names the button for what it does and announces the pause once", () => {
    render(
      <SimulationPauseProvider>
        <SimulationPauseControl />
      </SimulationPauseProvider>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Pause" })).not.toHaveAttribute("aria-pressed");

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("status")).toHaveTextContent("Paused notice");
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("does nothing, and does not crash, outside a provider", () => {
    render(<Clock />);
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByTestId("ticks")).toHaveTextContent("2");
  });
});

describe("every simulator that runs a clock honours the pause", () => {
  const dir = join(process.cwd(), "src/pages/simulations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));

  it("guards each setInterval and reads the pause from the runner", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(join(dir, file), "utf8");
      const intervals = source.match(/setInterval\(\s*\(\)\s*=>\s*\{/g)?.length ?? 0;
      if (intervals === 0) continue;
      const guards = source.match(/if \(pausedRef\.current\) return;/g)?.length ?? 0;
      if (guards < intervals || !source.includes("useSimulationPause()")) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("covers the Network NOC incident countdown, which is a timeout chain", () => {
    const source = readFileSync(join(dir, "NetworkNocSimulation.tsx"), "utf8");
    expect(source).toMatch(/if \(!timerActive \|\| incidentTimer <= 0 \|\| paused\) return;/);
  });
});
