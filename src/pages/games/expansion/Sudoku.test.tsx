import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

import { generateSudoku } from "@/lib/games/sudokuEngine";
import Sudoku from "./Sudoku";

const SEED = 2026;
const board = () => screen.getByRole("grid", { name: /Sudoku board/ });
const cells = () => within(board()).getAllByRole("gridcell");
const cellAt = (row: number, column: number) => cells()[row * 9 + column];
const status = () => screen.getByRole("status").textContent ?? "";
const key = (element: HTMLElement, value: string) => act(() => { fireEvent.keyDown(element, { key: value }); });

function mount(props: Parameters<typeof Sudoku>[0] = {}) {
  return render(<ArcadeAccessibilityProvider><Sudoku seed={SEED} {...props} /></ArcadeAccessibilityProvider>);
}

/** The same puzzle the component builds, so a test can look up the answers. */
const reference = (difficulty: "easy" | "medium" | "hard" = "medium") => generateSudoku(SEED, difficulty);

const firstEmpty = (difficulty: "easy" | "medium" | "hard" = "medium") => {
  const { puzzle } = reference(difficulty);
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) if (!puzzle[row][column]) return { row, column };
  }
  throw new Error("the puzzle has no empty cell");
};

beforeEach(() => {
  Object.values(sounds).forEach((fn) => fn.mockClear());
  gameManager.start("sudoku");
});

afterEach(() => {
  cleanup();
  gameManager.stop();
});

describe("Sudoku — the board", () => {
  it("renders a proper nine by nine grid with row and column positions", () => {
    mount();
    expect(cells()).toHaveLength(81);
    expect(cellAt(0, 0)).toHaveAttribute("aria-rowindex", "1");
    expect(cellAt(8, 8)).toHaveAttribute("aria-colindex", "9");
  });

  it("labels every cell by row, column, box and where its digit came from", () => {
    mount();
    expect(cellAt(2, 3).getAttribute("aria-label")).toMatch(/Row 3, column 4, box \d, (empty|\d, (given|yours))\./);
  });

  it("marks the supplied digits read-only", () => {
    mount();
    const { given } = reference();
    const givenCell = given.flatMap((row, r) => row.map((value, c) => (value ? { r, c } : null))).find(Boolean)!;
    expect(cellAt(givenCell.r, givenCell.c)).toHaveAttribute("aria-readonly", "true");
  });

  it("deals a different puzzle for a different difficulty", () => {
    const { unmount } = mount({ initialDifficulty: "easy" });
    const easy = cells().map((cell) => cell.textContent).join("|");
    unmount();

    mount({ initialDifficulty: "hard" });
    const hard = cells().map((cell) => cell.textContent).join("|");
    expect(hard, "the previous game shipped one hard-coded grid for everybody").not.toBe(easy);
  });
});

describe("Sudoku — playing", () => {
  it("moves between cells with the arrow keys and wraps at the edges", () => {
    mount();
    act(() => { cellAt(0, 0).focus(); });
    key(cellAt(0, 0), "ArrowRight");
    expect(document.activeElement).toBe(cellAt(0, 1));
    key(cellAt(0, 1), "ArrowUp");
    expect(document.activeElement).toBe(cellAt(8, 1));
  });

  it("places a digit typed into an empty cell", () => {
    mount();
    const { row, column } = firstEmpty();
    const { solution } = reference();
    act(() => { cellAt(row, column).focus(); });
    key(cellAt(row, column), String(solution[row][column]));
    expect(cellAt(row, column).textContent).toContain(String(solution[row][column]));
  });

  it("clears a cell with Backspace", () => {
    mount();
    const { row, column } = firstEmpty();
    const { solution } = reference();
    act(() => { cellAt(row, column).focus(); });
    key(cellAt(row, column), String(solution[row][column]));
    key(cellAt(row, column), "Backspace");
    expect(cellAt(row, column).getAttribute("aria-label")).toContain("empty");
  });

  it("refuses to change a supplied digit", () => {
    mount();
    const { given, puzzle } = reference();
    const givenCell = given.flatMap((row, r) => row.map((value, c) => (value ? { r, c } : null))).find(Boolean)!;
    const before = puzzle[givenCell.r][givenCell.c];
    act(() => { cellAt(givenCell.r, givenCell.c).focus(); });
    key(cellAt(givenCell.r, givenCell.c), String((before % 9) + 1));
    expect(cellAt(givenCell.r, givenCell.c).textContent).toContain(String(before));
  });

  it("counts a rule-breaking digit as a mistake and marks the cell invalid", () => {
    mount();
    const { row, column } = firstEmpty();
    const { solution } = reference();
    // Any digit already used elsewhere in the same row breaks a rule.
    const clashing = solution[row].find((value, index) => index !== column && value !== solution[row][column])!;

    act(() => { cellAt(row, column).focus(); });
    key(cellAt(row, column), String(clashing));

    expect(cellAt(row, column)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/1 \/ 5/)).toBeInTheDocument();
    expect(sounds.arcadeDanger).toHaveBeenCalled();
  });

  it("keeps pencil marks in notes mode instead of filling the cell", () => {
    mount();
    const { row, column } = firstEmpty();
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Notes mode/ })); });
    act(() => { cellAt(row, column).focus(); });
    key(cellAt(row, column), "4");

    expect(cellAt(row, column).getAttribute("aria-label")).toContain("empty");
    expect(cellAt(row, column).textContent).toContain("4");
  });

  it("places a digit from the number pad and shows how many are left", () => {
    mount();
    const { row, column } = firstEmpty();
    act(() => { cellAt(row, column).focus(); });
    const pad = screen.getByRole("button", { name: /^Place 5, \d+ left$/ });
    act(() => { fireEvent.click(pad); });
    expect(cellAt(row, column).getAttribute("aria-label")).toMatch(/, 5, yours/);
  });

  it("fills a correct digit on a hint and counts it", () => {
    mount();
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Hint/ })); });
    const { solution } = reference();
    const { row, column } = firstEmpty();
    expect(cellAt(row, column).textContent).toContain(String(solution[row][column]));
    expect(screen.getByText("1", { selector: "dd" })).toBeInTheDocument();
  });

  it("deals a fresh puzzle and resets the clock and mistakes", () => {
    mount();
    const { row, column } = firstEmpty();
    const { solution } = reference();
    const clashing = solution[row].find((value, index) => index !== column && value !== solution[row][column])!;
    act(() => { cellAt(row, column).focus(); });
    key(cellAt(row, column), String(clashing));
    expect(screen.getByText(/1 \/ 5/)).toBeInTheDocument();

    act(() => { fireEvent.click(screen.getByRole("button", { name: /New puzzle/ })); });
    expect(screen.getByText(/0 \/ 5/)).toBeInTheDocument();
  });
});

describe("Sudoku — endings", () => {
  it("wins, scores and settles when the last cell is filled correctly", { timeout: 60000 }, () => {
    mount({ initialDifficulty: "easy" });
    const { puzzle, solution } = reference("easy");

    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) {
        if (puzzle[row][column]) continue;
        act(() => { cellAt(row, column).focus(); });
        key(cellAt(row, column), String(solution[row][column]));
      }
    }

    expect(status()).toMatch(/Solved in \d\d:\d\d with 0 mistakes/);
    expect(sounds.arcadeVictory).toHaveBeenCalledTimes(1);
    expect(gameManager.getSnapshot().score).toBeGreaterThan(0);
  });

  // Five keystrokes, but each one re-renders eighty-one cells and recomputes
  // every conflict, which costs about three seconds under jsdom. That fits
  // inside the five-second default when this file runs alone and does not when
  // the whole suite runs in parallel, so the test failed intermittently and
  // only ever on a full run. Its neighbour above already carries an explicit
  // timeout for the same reason.
  it("ends the round after five mistakes", { timeout: 30000 }, () => {
    mount();
    const { puzzle, solution } = reference();
    const empties: { row: number; column: number }[] = [];
    for (let row = 0; row < 9; row += 1) {
      for (let column = 0; column < 9; column += 1) if (!puzzle[row][column]) empties.push({ row, column });
    }

    for (const { row, column } of empties.slice(0, 5)) {
      const clashing = solution[row].find((value, index) => index !== column && value !== solution[row][column])!;
      act(() => { cellAt(row, column).focus(); });
      key(cellAt(row, column), String(clashing));
    }

    expect(status()).toMatch(/Out of mistakes/);
    expect(sounds.arcadeCrash).toHaveBeenCalledTimes(1);
    expect(cellAt(0, 0)).toBeDisabled();
  });
});

describe("Sudoku — accessibility surface", () => {
  it("marks a conflict with a symbol and an underline, not colour alone", () => {
    mount();
    const { row, column } = firstEmpty();
    const { solution } = reference();
    const clashing = solution[row].find((value, index) => index !== column && value !== solution[row][column])!;
    act(() => { cellAt(row, column).focus(); });
    key(cellAt(row, column), String(clashing));

    const cell = cellAt(row, column);
    expect(cell.className).toContain("underline");
    expect(cell.textContent).toContain("!");
    expect(cell.getAttribute("aria-label")).toContain("conflicts with another cell");
  });

  it("keeps exactly one cell in the tab order, the way a grid should", () => {
    mount();
    expect(cells().filter((cell) => cell.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("speaks the board and the current cell on demand", () => {
    vi.useFakeTimers();
    try {
      mount();
      act(() => { cellAt(4, 4).focus(); });
      key(cellAt(4, 4), "b");
      act(() => { vi.advanceTimersByTime(50); });
      const live = document.querySelector('[aria-live="assertive"]');
      expect(live?.textContent).toMatch(/medium puzzle\. \d+ cells left\./);
      expect(live?.textContent).toContain("Row 5, column 5");
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers notes mode as a toggle that reports its own state", () => {
    mount();
    const toggle = screen.getByRole("button", { name: /Notes mode/ });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    act(() => { fireEvent.click(toggle); });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("marks the chosen difficulty as pressed", () => {
    mount({ initialDifficulty: "hard" });
    expect(screen.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Easy" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Sudoku — the digit goes where the key was pressed", () => {
  it("writes into the cell that received the keystroke, not the last one focused", () => {
    // Focusing a cell and typing into it in the same tick used to write the
    // digit into whichever cell the cursor state still pointed at.
    mount();
    const { row, column } = firstEmpty();
    const { solution } = reference();

    act(() => { cellAt(0, 0).focus(); });
    act(() => {
      cellAt(row, column).focus();
      fireEvent.keyDown(cellAt(row, column), { key: String(solution[row][column]) });
    });

    expect(cellAt(row, column).getAttribute("aria-label")).toContain(`, ${solution[row][column]}, yours`);
  });
});
