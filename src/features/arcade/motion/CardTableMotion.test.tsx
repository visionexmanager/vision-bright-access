import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardTableMotion } from "./CardTableMotion";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: (_, tag) => tag }),
  useReducedMotion: () => true,
}));

describe("CardTableMotion", () => {
  it("is decorative and keeps game state available to assistive technology elsewhere", () => {
    const { container } = render(<CardTableMotion kind="dominoes" progress={0.5} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
