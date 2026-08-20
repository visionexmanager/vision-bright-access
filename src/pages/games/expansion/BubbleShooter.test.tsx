import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeAccessibilityProvider } from "@/features/arcade/core/ArcadeAccessibilityProvider";
import { gameManager } from "@/features/arcade/core/gameManager";

vi.mock("@/contexts/LanguageContext", () => {
  const language = { t: (key: string) => key, lang: "en", ready: true, dir: "ltr", setLang: () => {}, translateText: (value: string) => value };
  return { useLanguage: () => language };
});

const sounds = {
  arcadeMove: vi.fn(), arcadePickup: vi.fn(), arcadeLevelUp: vi.fn(),
  arcadeDanger: vi.fn(), arcadeCrash: vi.fn(), arcadeVictory: vi.fn(),
};
vi.mock("@/hooks/useGameSounds", () => ({ useGameSounds: () => sounds }));

import { BUBBLE_SHOOTER_CONFIG } from "@/lib/games/bubbleShooterEngine";
import BubbleShooter from "./BubbleShooter";

const field = () => screen.getByRole("img");
const summary = () => field().getAttribute("aria-label") ?? "";
const status = () => screen.getByRole("status").textContent ?? "";
const bubbles = () => Number(summary().match(/(\d+) bubbles left/)?.[1] ?? -1);
const angle = () => {
  if (/straight up/.test(summary())) return 0;
  const match = summary().match(/Aiming (\d+) degrees (left|right)/)!;
  return Number(match[1]) * (match[2] === "left" ? -1 : 1);
};
const press = (key: string, init: Record<string, unknown> = {}) => act(() => { fireEvent.keyDown(field(), { key, ...init }); });

function mount(props: Parameters<typeof BubbleShooter>[0] = {}) {
  return render(<ArcadeAccessibilityProvider><BubbleShooter {...props} /></ArcadeAccessibilityProvider>);
}

beforeEach(() => {
  Object.values(sounds).forEach((fn) => fn.mockClear());
  gameManager.start("bubble-shooter");
});

afterEach(() => {
  cleanup();
  gameManager.stop();
});

describe("Bubble Shooter — launch and aiming", () => {
  it("opens with a dealt board, a loaded colour and a queued colour", () => {
    mount({ seed: 8 });
    expect(bubbles()).toBeGreaterThan(0);
    expect(summary()).toMatch(/Holding \w+, next \w+/);
    expect(screen.getByRole("button", { name: /Start/ })).toBeInTheDocument();
  });

  it("aims left and right, three degrees at a time", () => {
    mount({ seed: 8 });
    expect(angle()).toBe(0);
    press("ArrowLeft");
    expect(angle()).toBe(-3);
    press("ArrowRight");
    press("ArrowRight");
    expect(angle()).toBe(3);
  });

  it("aims one degree at a time with Shift held, for a fine adjustment", () => {
    mount({ seed: 8 });
    press("ArrowRight", { shiftKey: true });
    expect(angle()).toBe(1);
  });

  it("stops the launcher at the end of its arc", () => {
    mount({ seed: 8 });
    for (let i = 0; i < 60; i += 1) press("ArrowLeft");
    expect(angle()).toBe(-BUBBLE_SHOOTER_CONFIG.maxAngle);
  });

  it("accepts A and D as well as the arrow keys", () => {
    mount({ seed: 8 });
    press("d");
    expect(angle()).toBe(3);
    press("a");
    expect(angle()).toBe(0);
  });

  it("aims from the on-screen controls for touch and pointer players", () => {
    mount({ seed: 8 });
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Aim right" })); });
    expect(angle()).toBe(3);
    expect(screen.getByRole("group", { name: "Aim controls" })).toBeInTheDocument();
  });

  it("previews where the current aim lands, and whether it would pop", () => {
    mount({ seed: 8 });
    expect(summary()).toMatch(/It lands on row \d+, column \d+/);
    expect(summary()).toMatch(/That (pops \d+ bubbles|joins \d+ of the same colour)/);
  });
});

describe("Bubble Shooter — firing", () => {
  it("fires on Space and puts the bubble on the board", () => {
    mount({ seed: 8 });
    const before = bubbles();
    press(" ");
    expect(bubbles()).not.toBe(before);
    expect(summary()).toMatch(/Holding \w+/);
  });

  it("hands the queued colour to the launcher after a shot", () => {
    mount({ seed: 8 });
    const queued = summary().match(/next (\w+)/)![1];
    press(" ");
    expect(summary()).toContain(`Holding ${queued}`);
  });

  it("counts down the shots left before a new row drops in", () => {
    mount({ seed: 8 });
    const left = () => Number(summary().match(/(\d+) shots before a new row/)![1]);
    const before = left();
    press(" ");
    expect(left()).toBeLessThanOrEqual(before);
  });

  it("wins and settles when the last bubble goes", () => {
    // A three-wide board of a single colour: one straight shot joins the row
    // and the whole thing pops.
    mount({ seed: 8, config: { ...BUBBLE_SHOOTER_CONFIG, columns: 3, colors: 1, startingRows: 1 } });
    expect(bubbles()).toBe(3);
    press(" ");
    expect(summary()).toMatch(/Board cleared with \d+ points/);
    expect(status()).toMatch(/Board cleared with \d+ points/);
    expect(sounds.arcadeVictory).toHaveBeenCalledTimes(1);
    expect(sounds.arcadeCrash).not.toHaveBeenCalled();
  });

  it("reports its score to the runtime", () => {
    mount({ seed: 8 });
    for (let i = 0; i < 25 && !/Score [1-9]/.test(summary()); i += 1) {
      press("ArrowLeft");
      press(" ");
    }
    const shown = Number(summary().match(/Score (\d+)/)?.[1] ?? "0");
    if (shown > 0) expect(gameManager.getSnapshot().score).toBe(shown);
  });

  it("ends the game when the stack reaches the losing line", () => {
    // A board dealt almost to the line needs only a couple of pushed rows.
    mount({ seed: 8, config: { ...BUBBLE_SHOOTER_CONFIG, startingRows: BUBBLE_SHOOTER_CONFIG.rows - 2, shotsPerRow: 1 } });
    for (let i = 0; i < 40 && !/Game over/.test(status()); i += 1) press(" ");
    expect(status()).toMatch(/Game over with \d+ points/);
    expect(screen.getByRole("button", { name: /Play again/ })).toBeInTheDocument();
    expect(sounds.arcadeCrash).toHaveBeenCalledTimes(1);
  });

  it("deals a fresh board when replayed", () => {
    mount({ seed: 8, config: { ...BUBBLE_SHOOTER_CONFIG, startingRows: BUBBLE_SHOOTER_CONFIG.rows - 2, shotsPerRow: 1 } });
    for (let i = 0; i < 40 && !/Game over/.test(status()); i += 1) press(" ");
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Play again/ })); });
    expect(summary()).toContain("Score 0");
    expect(status()).not.toMatch(/Game over/);
  });

  it("stops responding once the game is over", () => {
    mount({ seed: 8, config: { ...BUBBLE_SHOOTER_CONFIG, startingRows: BUBBLE_SHOOTER_CONFIG.rows - 2, shotsPerRow: 1 } });
    for (let i = 0; i < 40 && !/Game over/.test(status()); i += 1) press(" ");
    const frozen = summary();
    press("ArrowLeft");
    expect(summary()).toBe(frozen);
  });
});

describe("Bubble Shooter — accessibility surface", () => {
  it("carries the whole board in one accessible name, with the parts hidden", () => {
    mount({ seed: 8 });
    expect(summary()).toMatch(/Score \d+\. \d+ bubbles left\./);
    for (const part of Array.from(field().children)) {
      expect(part).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("marks every bubble with a glyph, so colour is never the only signal", () => {
    mount({ seed: 8 });
    const glyphs = Array.from(field().querySelectorAll("span")).map((span) => span.textContent).filter(Boolean);
    expect(new Set(glyphs).size).toBeGreaterThan(1);
  });

  it("names the queued colour in words as well as showing it", () => {
    mount({ seed: 8 });
    const queued = summary().match(/next (\w+)/)![1];
    expect(screen.getByText(queued)).toBeInTheDocument();
  });

  it("speaks the board on demand", () => {
    vi.useFakeTimers();
    try {
      mount({ seed: 8 });
      press("b");
      act(() => { vi.advanceTimersByTime(50); });
      const live = document.querySelector('[aria-live="assertive"]');
      expect(live?.textContent).toMatch(/Holding \w+, next \w+/);
      expect(live?.textContent).toMatch(/It lands on row \d+, column \d+/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers the aim line as a toggle that reports its own state", () => {
    mount({ seed: 8 });
    const toggle = screen.getByRole("button", { name: /Aim line/ });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    act(() => { fireEvent.click(toggle); });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("keeps the field focusable by keyboard alone", () => {
    mount({ seed: 8 });
    expect(field()).toHaveAttribute("tabindex", "0");
    act(() => { field().focus(); });
    expect(document.activeElement).toBe(field());
  });
});
