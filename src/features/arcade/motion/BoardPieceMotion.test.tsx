import { render, screen } from "@testing-library/react";
import type { HTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoardPieceMotion } from "./BoardPieceMotion";

const reducedMotion = vi.fn(() => false);

vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducedMotion(),
  motion:{ span:({ children, ...props }: HTMLAttributes<HTMLSpanElement> & { initial?:unknown; animate?:unknown; transition?:unknown }) => {
    const { initial: _initial, animate: _animate, transition: _transition, ...domProps } = props;
    return <span {...domProps}>{children}</span>;
  } },
}));

describe("BoardPieceMotion", () => {
  beforeEach(() => reducedMotion.mockReturnValue(false));

  it("keeps the decorative motion layer out of the accessibility tree", () => {
    render(<BoardPieceMotion>♞</BoardPieceMotion>);
    expect(screen.getByText("♞")).toHaveAttribute("aria-hidden", "true");
  });

  it("renders a static equivalent when reduced motion is requested", () => {
    reducedMotion.mockReturnValue(true);
    render(<BoardPieceMotion selected landed>●</BoardPieceMotion>);
    expect(screen.getByText("●")).not.toHaveAttribute("style");
  });
});
