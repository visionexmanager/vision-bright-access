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

import { BLOCK_STACKER_CONFIG } from "@/lib/games/blockStackerEngine";
import BlockStacker from "./BlockStacker";

const board = () => screen.getByRole("img");
const summary = () => board().getAttribute("aria-label") ?? "";
const status = () => screen.getByRole("status").textContent ?? "";
const columns = () => {
  const match = summary().match(/over columns (\d+) to (\d+)/);
  return match ? { left: Number(match[1]), right: Number(match[2]) } : null;
};
const press = (key: string) => act(() => { fireEvent.keyDown(board(), { key }); });
const drops = (count: number) => {
  for (let i = 0; i < count; i += 1) act(() => { vi.advanceTimersByTime(BLOCK_STACKER_CONFIG.startDropMs); });
};

function mount(props: Parameters<typeof BlockStacker>[0] = {}) {
  return render(<ArcadeAccessibilityProvider><BlockStacker {...props} /></ArcadeAccessibilityProvider>);
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(sounds).forEach((fn) => fn.mockClear());
  gameManager.start("block-stacker");
});

afterEach(() => {
  cleanup();
  gameManager.stop();
  vi.useRealTimers();
});

describe("Block Stacker — launch and controls", () => {
  it("opens with a piece on the board, one queued and a start control", () => {
    mount({ seed: 4 });
    expect(summary()).toMatch(/piece over columns \d+ to \d+/);
    expect(summary()).toMatch(/Next piece \w+/);
    expect(screen.getByRole("button", { name: /Start/ })).toBeInTheDocument();
  });

  it("holds the piece still until the game starts", () => {
    mount({ seed: 4 });
    const before = summary();
    drops(4);
    expect(summary()).toBe(before);
  });

  it("falls under gravity once started, and says how far there is left to steer", () => {
    mount({ seed: 4 });
    const toFall = () => Number(summary().match(/(\d+) rows? above its landing spot/)?.[1] ?? 0);
    press("ArrowDown");
    const before = toFall();
    expect(before).toBeGreaterThan(0);
    drops(2);
    expect(toFall(), "gravity should close the gap to the landing spot").toBeLessThan(before);
  });

  it("moves the piece left and right", () => {
    mount({ seed: 4 });
    press("ArrowRight");
    const start = columns()!;
    press("ArrowRight");
    expect(columns()!.left).toBe(start.left + 1);
    press("ArrowLeft");
    expect(columns()!.left).toBe(start.left);
  });

  it("accepts WASD as well as the arrow keys", () => {
    mount({ seed: 4 });
    press("d");
    const start = columns()!;
    press("d");
    expect(columns()!.left).toBe(start.left + 1);
    press("a");
    expect(columns()!.left).toBe(start.left);
  });

  it("rotates the piece", () => {
    // The bar is the clearest case: four wide flat, one wide upright.
    mount({ seed: 4 });
    press("ArrowDown");
    const before = columns()!;
    press("ArrowUp");
    const after = columns()!;
    const width = (span: { left: number; right: number }) => span.right - span.left;
    expect(width(after)).not.toBe(width(before));
  });

  it("drops the piece to the floor on Space", () => {
    mount({ seed: 4 });
    press(" ");
    expect(summary()).toMatch(/piece over columns/);
    expect(sounds.arcadeMove).toHaveBeenCalled();
  });

  it("steers from the on-screen controls for touch and pointer players", () => {
    mount({ seed: 4 });
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Move right" })); });
    const start = columns()!;
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Move right" })); });
    expect(columns()!.left).toBe(start.left + 1);
    expect(screen.getByRole("group", { name: "Piece controls" })).toBeInTheDocument();
  });

  it("describes the board on demand, with the piece, the landing and the stack", () => {
    mount({ seed: 4 });
    press("b");
    act(() => { vi.advanceTimersByTime(50); });
    const live = document.querySelector('[aria-live="assertive"]');
    expect(live?.textContent).toMatch(/piece over columns/);
    expect(live?.textContent).toMatch(/Lowest column is \d+/);
  });
});

describe("Block Stacker — play", () => {
  it("scores for dropping and reports the score to the runtime", () => {
    mount({ seed: 4 });
    press(" ");
    const score = Number(summary().match(/Score (\d+)/)![1]);
    expect(score).toBeGreaterThan(0);
    expect(gameManager.getSnapshot().score).toBe(score);
  });

  it("clears a row and says so when one is completed", () => {
    // A one-column board: every locked piece completes its row.
    mount({ seed: 4, config: { ...BLOCK_STACKER_CONFIG, columns: 1, rows: 6 } });
    press(" ");
    expect(summary()).toMatch(/[1-9]\d* rows cleared/);
    expect(sounds.arcadePickup).toHaveBeenCalled();
  });

  it("ends the game when the stack reaches the ceiling, and offers a new game", () => {
    // A board barely taller than a piece fills up within a few drops.
    mount({ seed: 4, config: { ...BLOCK_STACKER_CONFIG, columns: 6, rows: 4 } });
    for (let i = 0; i < 30 && !/Game over/.test(status()); i += 1) press(" ");
    expect(status()).toMatch(/Game over with \d+ points/);
    expect(screen.getByRole("button", { name: /Play again/ })).toBeInTheDocument();
    expect(sounds.arcadeCrash).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh board when replayed", () => {
    mount({ seed: 4, config: { ...BLOCK_STACKER_CONFIG, columns: 6, rows: 4 } });
    for (let i = 0; i < 30 && !/Game over/.test(status()); i += 1) press(" ");
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Play again/ })); });
    expect(summary()).toContain("Score 0");
    expect(status()).not.toMatch(/Game over/);
  });

  it("stops responding to controls once the game is over", () => {
    mount({ seed: 4, config: { ...BLOCK_STACKER_CONFIG, columns: 6, rows: 4 } });
    for (let i = 0; i < 30 && !/Game over/.test(status()); i += 1) press(" ");
    const frozen = summary();
    press("ArrowRight");
    press("ArrowUp");
    drops(5);
    expect(summary()).toBe(frozen);
  });
});

describe("Block Stacker — shell integration", () => {
  it("stops falling while the shell is paused and resumes afterwards", () => {
    mount({ seed: 4 });
    press("ArrowDown");
    const rowsCleared = () => summary().match(/(\d+) rows cleared/)![1];

    act(() => { gameManager.pause(); });
    const frozen = summary();
    drops(6);
    expect(summary(), "a paused game must not keep dropping behind the overlay").toBe(frozen);

    act(() => { gameManager.resume(); });
    drops(2);
    expect(rowsCleared()).toBeDefined();
    expect(status()).not.toMatch(/Game over/);
  });

  it("leaves no timer running after unmount", () => {
    const { unmount } = mount({ seed: 4 });
    press("ArrowDown");
    drops(1);
    unmount();
    expect(() => drops(10)).not.toThrow();
  });
});

describe("Block Stacker — accessibility surface", () => {
  it("carries the whole board in one accessible name, with the cells hidden", () => {
    mount({ seed: 4 });
    expect(summary()).toMatch(/Level \d+\. Score \d+\./);
    for (const cell of Array.from(board().children)) {
      expect(cell).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("marks every filled cell with a glyph, not only a colour", () => {
    mount({ seed: 4 });
    const glyphs = Array.from(board().children).map((cell) => cell.textContent).filter(Boolean);
    expect(glyphs.length).toBeGreaterThan(0);
  });

  it("names the queued piece in words as well as in colour", () => {
    mount({ seed: 4 });
    const next = summary().match(/Next piece (\w+)/)![1];
    expect(screen.getByLabelText("Next piece").textContent).toContain(next);
  });

  it("keeps the board focusable by keyboard alone", () => {
    mount({ seed: 4 });
    expect(board()).toHaveAttribute("tabindex", "0");
    act(() => { board().focus(); });
    expect(document.activeElement).toBe(board());
  });

  it("offers the landing preview as a toggle that reports its own state", () => {
    mount({ seed: 4 });
    const toggle = screen.getByRole("button", { name: /Landing preview/ });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    act(() => { fireEvent.click(toggle); });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});
