import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InferenceCoreMotion } from "./InferenceCoreMotion";

describe("InferenceCoreMotion", () => {
  it("is decorative so semantic progress remains the source of truth", () => {
    render(<InferenceCoreMotion progress={40} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
