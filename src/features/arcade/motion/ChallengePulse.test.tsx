import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChallengePulse } from "./ChallengePulse";

describe("ChallengePulse", () => {
  it("keeps decorative motion hidden from assistive technology", () => {
    render(<ChallengePulse progress={60} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
