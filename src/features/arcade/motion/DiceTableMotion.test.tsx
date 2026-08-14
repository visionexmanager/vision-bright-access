import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiceTableMotion } from "./DiceTableMotion";
vi.mock("framer-motion", () => ({ motion: new Proxy({}, { get: (_, tag) => tag }), useReducedMotion: () => true }));
describe("DiceTableMotion", () => {
  it("keeps decorative motion out of the accessibility tree", () => {
    const { container } = render(<DiceTableMotion progress={0.5} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
