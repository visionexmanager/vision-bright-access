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

import { BREAKOUT_CONFIG } from "@/lib/games/breakoutEngine";
import Breakout from "./Breakout";

const field = () => screen.getByRole("img");
const summary = () => field().getAttribute("aria-label") ?? "";
const status = () => screen.getByRole("status").textContent ?? "";
const bricksLeft = () => Number(summary().match(/(\d+) bricks left/)?.[1] ?? -1);
/** The score as the board reports it, live or at the end of the run. */
const score = () =>
  Number(summary().match(/Score (\d+)/)?.[1] ?? summary().match(/with (\d+) points/)?.[1] ?? "0");

/** Field-unit position of the ball, read back out of its inline style. */
const ballAt = () => {
  const ball = field().querySelector<HTMLElement>("span.bg-white");
  return {
    x: (parseFloat(ball!.style.left) / 100) * BREAKOUT_CONFIG.fieldWidth,
    y: (parseFloat(ball!.style.top) / 100) * BREAKOUT_CONFIG.fieldHeight,
  };
};

/** Advances animation frames. Vitest's fake timers stand in for rAF. */
const frames = (count: number) => {
  for (let i = 0; i < count; i += 1) act(() => { vi.advanceTimersByTime(16); });
};

function mount(props: Parameters<typeof Breakout>[0] = {}) {
  return render(<ArcadeAccessibilityProvider><Breakout {...props} /></ArcadeAccessibilityProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(sounds).forEach((fn) => fn.mockClear());
  gameManager.start("breakout");
});

afterEach(() => {
  cleanup();
  gameManager.stop();
  vi.useRealTimers();
});

describe("Breakout — launch and controls", () => {
  it("opens with the ball waiting on the paddle and a full wall", () => {
    mount();
    expect(summary()).toContain("Ball on the paddle");
    expect(bricksLeft()).toBe(BREAKOUT_CONFIG.columns * BREAKOUT_CONFIG.rows);
    expect(screen.getByRole("button", { name: /Launch/ })).toBeInTheDocument();
  });

  it("holds the ball still until it is launched", () => {
    mount();
    const before = ballAt();
    frames(30);
    expect(ballAt()).toEqual(before);
  });

  it("launches on Space and the ball then moves", () => {
    mount();
    fireEvent.keyDown(field(), { key: " " });
    const start = ballAt();
    frames(20);
    const moved = ballAt();
    expect(moved.y, "the ball should travel upwards after launch").toBeLessThan(start.y);
  });

  it("moves the paddle while an arrow key is held and stops when released", () => {
    mount();
    const paddleColumn = () => Number(summary().match(/Paddle at column (\d+)/)![1]);
    const start = paddleColumn();

    fireEvent.keyDown(field(), { key: "ArrowRight" });
    frames(20);
    const moved = paddleColumn();
    expect(moved).toBeGreaterThan(start);

    fireEvent.keyUp(field(), { key: "ArrowRight" });
    frames(20);
    expect(paddleColumn()).toBe(moved);
  });

  it("accepts A and D as well as the arrow keys", () => {
    mount();
    const paddleColumn = () => Number(summary().match(/Paddle at column (\d+)/)![1]);
    const start = paddleColumn();
    fireEvent.keyDown(field(), { key: "a" });
    frames(20);
    expect(paddleColumn()).toBeLessThan(start);
  });

  it("nudges the paddle from the on-screen buttons for pointer and touch players", () => {
    mount();
    const paddleColumn = () => Number(summary().match(/Paddle at column (\d+)/)![1]);
    const start = paddleColumn();
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Move right" })); });
    expect(paddleColumn()).toBeGreaterThanOrEqual(start);
    expect(screen.getByRole("group", { name: "Paddle controls" })).toBeInTheDocument();
  });

  it("describes the board on demand, including where the ball is", () => {
    mount();
    fireEvent.keyDown(field(), { key: " " });
    frames(20);
    fireEvent.keyDown(field(), { key: "b" });
    act(() => { vi.advanceTimersByTime(50); });
    const live = document.querySelector('[aria-live="assertive"]');
    expect(live?.textContent).toMatch(/Level 1\./);
    expect(live?.textContent).toMatch(/bricks left/);
  });
});

describe("Breakout — play", () => {
  it("breaks bricks and scores when the ball reaches the wall", () => {
    mount({ seed: 5 });
    fireEvent.keyDown(field(), { key: " " });
    for (let i = 0; i < 200 && bricksLeft() === BREAKOUT_CONFIG.columns * BREAKOUT_CONFIG.rows; i += 1) frames(1);
    expect(bricksLeft()).toBeLessThan(BREAKOUT_CONFIG.columns * BREAKOUT_CONFIG.rows);
  });

  it("loses a life when the ball drops past the paddle, and re-seats the ball", () => {
    mount({ seed: 5 });
    fireEvent.keyDown(field(), { key: " " });
    // Park the paddle in a corner so the ball is guaranteed to get past it.
    fireEvent.keyDown(field(), { key: "ArrowLeft" });
    frames(60);
    for (let i = 0; i < 600 && summary().includes("3 lives"); i += 1) frames(1);
    expect(summary()).toContain("2 lives");
    expect(summary()).toContain("Ball on the paddle");
    expect(sounds.arcadeCrash).toHaveBeenCalled();
  });

  it("ends the game once the last life goes, and offers a new game", () => {
    mount({ seed: 5, config: { ...BREAKOUT_CONFIG, lives: 1 } });
    fireEvent.keyDown(field(), { key: " " });
    fireEvent.keyDown(field(), { key: "ArrowLeft" });
    for (let i = 0; i < 900 && !/Game over/.test(status()); i += 1) frames(1);
    expect(status()).toMatch(/Game over with \d+ points/);
    expect(screen.getByRole("button", { name: /Play again/ })).toBeInTheDocument();
  });

  it("wins the run when the last level is cleared", () => {
    // One level, one row, one column: a single brick decides the run.
    mount({ seed: 5, config: { ...BREAKOUT_CONFIG, levels: 1, rows: 1, columns: 1, lives: 9 } });
    fireEvent.keyDown(field(), { key: " " });
    for (let i = 0; i < 2000 && !/Run won/.test(status()); i += 1) frames(1);
    expect(status()).toMatch(/Run won with \d+ points/);
    expect(sounds.arcadeVictory).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh game when replayed", () => {
    mount({ seed: 5, config: { ...BREAKOUT_CONFIG, lives: 1 } });
    fireEvent.keyDown(field(), { key: " " });
    fireEvent.keyDown(field(), { key: "ArrowLeft" });
    for (let i = 0; i < 900 && !/Game over/.test(status()); i += 1) frames(1);

    act(() => { fireEvent.click(screen.getByRole("button", { name: /Play again/ })); });
    expect(summary()).toContain("Ball on the paddle");
    expect(bricksLeft()).toBe(BREAKOUT_CONFIG.columns * BREAKOUT_CONFIG.rows);
    expect(score()).toBe(0);
  });

  it("reports the score it shows to the runtime", () => {
    mount({ seed: 5 });
    fireEvent.keyDown(field(), { key: " " });
    for (let i = 0; i < 400 && score() === 0; i += 1) frames(1);
    expect(score()).toBeGreaterThan(0);
    expect(gameManager.getSnapshot().score).toBe(score());
  });
});

describe("Breakout — shell integration", () => {
  it("freezes while the shell is paused and resumes afterwards", () => {
    mount({ seed: 5 });
    fireEvent.keyDown(field(), { key: " " });
    frames(10);

    act(() => { gameManager.pause(); });
    const frozen = ballAt();
    frames(30);
    expect(ballAt(), "a paused game must not keep playing behind the overlay").toEqual(frozen);

    act(() => { gameManager.resume(); });
    frames(10);
    expect(ballAt()).not.toEqual(frozen);
  });

  it("leaves no frame loop running after unmount", () => {
    const { unmount } = mount({ seed: 5 });
    fireEvent.keyDown(field(), { key: " " });
    frames(5);
    unmount();
    expect(() => frames(30)).not.toThrow();
  });
});

describe("Breakout — accessibility surface", () => {
  it("carries the whole board state in one accessible name, with the parts hidden", () => {
    mount();
    expect(summary()).toMatch(/Level 1\. \d+ bricks left\. \d+ lives\. Score \d+\./);
    for (const part of Array.from(field().children)) {
      expect(part).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("shows brick damage with a glyph, not only a colour", () => {
    mount();
    const glyphs = new Set(Array.from(field().querySelectorAll("span")).map((span) => span.textContent).filter(Boolean));
    expect(glyphs.size).toBeGreaterThan(1);
  });

  it("exposes lives as text as well as heart icons", () => {
    mount();
    expect(screen.getByText(String(BREAKOUT_CONFIG.lives), { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("offers audio guidance as a toggle that reports its own state", () => {
    mount();
    const toggle = screen.getByRole("button", { name: /Audio guidance/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    act(() => { fireEvent.click(toggle); });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the field reachable and focusable by keyboard alone", () => {
    mount();
    expect(field()).toHaveAttribute("tabindex", "0");
    act(() => { field().focus(); });
    expect(document.activeElement).toBe(field());
  });
});
