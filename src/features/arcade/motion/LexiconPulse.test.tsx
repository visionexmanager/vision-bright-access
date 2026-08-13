import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LexiconPulse } from "./LexiconPulse";

describe("LexiconPulse", () => {
  it("keeps decorative motion hidden from assistive technology", () => {
    render(<LexiconPulse progress={50} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
