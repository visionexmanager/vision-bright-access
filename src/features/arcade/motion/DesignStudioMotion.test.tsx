import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesignStudioMotion } from "./DesignStudioMotion";

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: (_, tag) => tag }),
  useReducedMotion: () => true,
}));

describe("DesignStudioMotion", () => {
  it("stays decorative and exposes no duplicate game state", () => {
    const { container } = render(<DesignStudioMotion kind="home" progress={0.5} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
