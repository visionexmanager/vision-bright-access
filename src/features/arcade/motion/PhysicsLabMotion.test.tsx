import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhysicsLabMotion } from "./PhysicsLabMotion";

describe("PhysicsLabMotion", () => {
  it.each([
    <PhysicsLabMotion kind="balance" value={2}/>,
    <PhysicsLabMotion kind="pendulum" value={2}/>,
    <PhysicsLabMotion kind="trajectory" value={42} attempt={1}/>,
    <PhysicsLabMotion kind="magnet" value={2} attracting attempt={1}/>,
  ])("keeps decorative simulations hidden from assistive technology", (scene) => {
    const { container } = render(scene);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
