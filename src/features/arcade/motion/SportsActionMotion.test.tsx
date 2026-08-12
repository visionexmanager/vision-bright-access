import { act, render, screen } from "@testing-library/react";
import type { HTMLAttributes } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SportsActionMotion } from "./SportsActionMotion";

const reducedMotion = vi.fn(() => false);

vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducedMotion(),
  motion:{ span:({ children, ...props }: HTMLAttributes<HTMLSpanElement> & { initial?:unknown; animate?:unknown; transition?:unknown }) => {
    const { initial: _initial, animate: _animate, transition: _transition, ...domProps } = props;
    return <span {...domProps}>{children}</span>;
  } },
}));

describe("SportsActionMotion", () => {
  beforeEach(() => {
    localStorage.clear();
    reducedMotion.mockReturnValue(false);
  });

  it.each(["penalty", "basketball", "air-hockey"] as const)("keeps the %s scene decorative", (sport) => {
    const { container } = render(<SportsActionMotion sport={sport} attempt={1} scored />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("responds to the Visionex reduced-motion setting", () => {
    render(<SportsActionMotion sport="penalty" attempt={1} scored={false} />);
    act(() => {
      localStorage.setItem("visionex-arcade-settings-v1", JSON.stringify({ reducedMotion:true }));
      window.dispatchEvent(new CustomEvent("visionex:arcade-settings"));
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
