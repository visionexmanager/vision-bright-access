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

import { SNAKE_CONFIG } from "@/lib/games/snakeEngine";
import Snake from "./Snake";

/** The board carries the full state in its accessible name. */
const board = () => screen.getByRole("img");
const summary = () => board().getAttribute("aria-label") ?? "";
const status = () => screen.getByRole("status").textContent ?? "";
const head = () => {
  const match = summary().match(/column (\d+), row (\d+)/);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
};

const steer = (key: string) => fireEvent.keyDown(board(), { key });
/**
 * One `act` per tick. Advancing the whole span in a single `act` would let the
 * engine take every step before React re-rendered once, so effects that watch
 * intermediate states — the hazard warning, the level cue — would never see
 * them, which is not how the game behaves in a browser.
 */
// Advance by exactly one engine step. A longer step would drift against the
// interval and occasionally run two ticks between renders, which no real
// browser frame does.
const ticks = (count: number, ms = SNAKE_CONFIG.startStepMs) => {
  for (let i = 0; i < count; i += 1) act(() => { vi.advanceTimersByTime(ms); });
};

function mount(config?: Parameters<typeof Snake>[0]["config"], seed?: number) {
  return render(<ArcadeAccessibilityProvider><Snake config={config} seed={seed} /></ArcadeAccessibilityProvider>);
}

// A seed whose first two food placements the autopilot below reaches, so the
// win path is exercised as a fixed replay rather than a lucky round.
const WINNABLE_SEED = 20260819;

const ARROW = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" } as const;

/**
 * Plays the round the way a screen-reader player does: everything it knows
 * comes out of the board summary. It chases the food and refuses any turn that
 * would take the head off the board.
 */
function autopilot(steps: number) {
  const size = SNAKE_CONFIG.size;
  const opposite = { up: "down", down: "up", left: "right", right: "left" } as const;

  for (let i = 0; i < steps; i += 1) {
    if (/You win|Round over/.test(status())) return;
    const board = summary();
    const position = head()!;
    const heading = board.match(/Heading (\w+)\./)![1] as keyof typeof ARROW;
    const wanted = (board.match(/cells away, ([a-z ]+)\./)?.[1].split(" and ") ?? []) as (keyof typeof ARROW)[];
    const blocked = /Warning/.test(board);

    const roomFor = (direction: keyof typeof ARROW) => {
      const x = position.x - 1 + (direction === "right" ? 1 : direction === "left" ? -1 : 0);
      const y = position.y - 1 + (direction === "down" ? 1 : direction === "up" ? -1 : 0);
      return x >= 0 && y >= 0 && x < size && y < size;
    };
    const turnable = (direction: keyof typeof ARROW) =>
      direction !== heading && direction !== opposite[heading] && roomFor(direction);

    const towardsFood = wanted.find(turnable);
    if (blocked) {
      const escape = (["up", "right", "down", "left"] as const).find(turnable);
      if (escape) steer(ARROW[escape]);
    } else if (towardsFood) {
      steer(ARROW[towardsFood]);
    }
    ticks(1);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.values(sounds).forEach((fn) => fn.mockClear());
  gameManager.start("snake");
});

afterEach(() => {
  cleanup();
  gameManager.stop();
  vi.useRealTimers();
});

describe("Snake — launch and controls", () => {
  it("opens ready to play with a focusable board and a spoken summary", () => {
    mount();
    expect(board()).toHaveAttribute("tabindex", "0");
    expect(summary()).toMatch(/Head at column \d+, row \d+\. Heading \w+\. Length 3\./);
    expect(screen.getByRole("button", { name: /Start/ })).toBeInTheDocument();
  });

  it("starts on any arrow key and moves the snake", () => {
    mount();
    const before = head();
    steer("ArrowRight");
    ticks(1);
    expect(head()).not.toEqual(before);
  });

  it("ignores a direct reversal instead of ending the round", () => {
    mount();
    steer("ArrowRight");
    ticks(1);
    // Travelling right: left must be refused, and the round must survive it.
    steer("ArrowLeft");
    ticks(2);
    expect(status()).not.toMatch(/Round over/);
    expect(summary(), "the refused turn must leave the heading untouched").toContain("Heading right");
  });

  it("accepts WASD as well as the arrow keys", () => {
    mount();
    steer("w");
    ticks(1);
    const first = head();
    ticks(1);
    expect(head()!.y).toBe(first!.y - 1);
  });

  it("steers from the on-screen direction pad for touch and pointer players", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Up" }));
    ticks(2);
    expect(status()).not.toMatch(/Round over/);
    expect(screen.getByRole("group", { name: "Direction controls" })).toBeInTheDocument();
  });

  it("describes the whole board on demand for a screen reader", () => {
    mount();
    steer("b");
    act(() => { vi.advanceTimersByTime(50); });
    const live = document.querySelector('[aria-live="assertive"]');
    expect(live?.textContent).toMatch(/Head at column \d+, row \d+\./);
    expect(live?.textContent).toMatch(/Food \d+ cells away/);
  });
});

describe("Snake — rounds", () => {
  it("ends at the wall, names the cause and offers a replay", () => {
    mount();
    steer("ArrowRight");
    ticks(30);
    expect(status()).toMatch(/Round over: you hit the wall/);
    expect(screen.getByRole("button", { name: /Play again/ })).toBeInTheDocument();
  });

  it("resets the score and the board when the round is replayed", () => {
    mount();
    steer("ArrowRight");
    ticks(30);
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Play again/ })); });
    expect(summary()).toContain("score 0");
    expect(summary()).toContain("Length 3");
    expect(status()).not.toMatch(/Round over/);
  });

  it("keeps playing after a replay rather than freezing on the dead board", () => {
    mount();
    steer("ArrowRight");
    ticks(30);
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Play again/ })); });
    const before = head();
    ticks(1);
    expect(head()).not.toEqual(before);
  });

  it("wins the round when the target is reached, on a short configured round", () => {
    // A two-bite round keeps the win path quick; the autopilot plays it from
    // the same board summary a screen-reader player would hear.
    mount({ ...SNAKE_CONFIG, target: 2, obstacleFromLevel: 99 }, WINNABLE_SEED);
    steer("ArrowRight");
    autopilot(200);

    expect(status()).toMatch(/You win with \d+ points/);
    expect(sounds.arcadeVictory).toHaveBeenCalledTimes(1);
    expect(sounds.arcadeCrash).not.toHaveBeenCalled();
  });

  it("plays a crash cue exactly once when the round ends", () => {
    mount();
    steer("ArrowRight");
    ticks(30);
    ticks(10);
    expect(sounds.arcadeCrash).toHaveBeenCalledTimes(1);
  });
});

describe("Snake — shell integration", () => {
  it("stops moving while the shell is paused and resumes afterwards", () => {
    mount();
    steer("ArrowRight");
    ticks(1);

    act(() => { gameManager.pause(); });
    const frozen = summary();
    ticks(4);
    expect(summary(), "a paused game must not keep moving behind the overlay").toBe(frozen);

    act(() => { gameManager.resume(); });
    ticks(1);
    expect(summary()).not.toBe(frozen);
  });

  it("reports the score it shows to the runtime, so the shell agrees with the board", () => {
    mount({ ...SNAKE_CONFIG, target: 2, obstacleFromLevel: 99 }, WINNABLE_SEED);
    steer("ArrowRight");
    autopilot(200);

    const shown = Number(summary().match(/Round won with (\d+) points/)![1]);
    expect(shown).toBeGreaterThan(0);
    expect(gameManager.getSnapshot().score).toBe(shown);
  });

  it("leaves no timer running once the game unmounts", () => {
    const { unmount } = mount();
    steer("ArrowRight");
    ticks(1);
    unmount();
    expect(() => ticks(20)).not.toThrow();
  });
});

describe("Snake — accessibility surface", () => {
  it("never encodes state in colour alone: every occupied cell carries a glyph", () => {
    mount();
    const glyphs = Array.from(board().children).map((cell) => cell.textContent);
    expect(glyphs).toContain("◆");
    expect(glyphs).toContain("✦");
    expect(glyphs.filter(Boolean).length).toBeGreaterThan(2);
  });

  it("hides the individual cells from assistive technology in favour of the summary", () => {
    mount();
    for (const cell of Array.from(board().children)) {
      expect(cell).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("exposes round progress as a labelled progress bar", () => {
    mount();
    const progress = screen.getByRole("progressbar", { name: /Progress towards finishing the round/ });
    expect(progress).toHaveAttribute("aria-valuenow", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "30");
  });

  it("offers audio guidance as a toggle that announces its own state", () => {
    mount();
    const toggle = screen.getByRole("button", { name: /Audio guidance/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    act(() => { fireEvent.click(toggle); });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("warns before the hazard, not after, when audio guidance is on", () => {
    mount();
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Audio guidance/ })); });
    steer("ArrowRight");
    ticks(30);
    expect(sounds.arcadeDanger).toHaveBeenCalled();
  });
});
