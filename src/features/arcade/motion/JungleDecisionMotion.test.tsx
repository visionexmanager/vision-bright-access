import type { HTMLAttributes, ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { JungleDecisionMotion } from "./JungleDecisionMotion";

const reducedMotion = vi.fn(() => false);
vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducedMotion(),
  motion: { span: ({ children, animate: _animate, transition: _transition, ...props }: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode; animate?: unknown; transition?: unknown }) => <span {...props}>{children}</span> },
}));

describe("JungleDecisionMotion", () => {
  beforeEach(() => reducedMotion.mockReturnValue(false));
  it("keeps the decorative scene out of the accessibility tree", () => {
    const { container } = render(<JungleDecisionMotion step={2} total={8} hp={80} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
  it("renders a static scene when reduced motion is requested", () => {
    reducedMotion.mockReturnValue(true);
    const { container } = render(<JungleDecisionMotion step={4} total={8} hp={20} />);
    expect(container.textContent).not.toContain("❧");
  });
});
