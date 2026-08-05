import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VideoLibrary } from "./VideoLibrary";

// Radix mounts a closed <SelectContent /> into a DocumentFragment so <SelectValue />
// can resolve the selected item, which means every <SelectItem /> renders on page
// load. An empty-string item value therefore threw during the initial render and
// took the whole Video Studio page down with the app-level error boundary.

vi.mock("@/hooks/useVideoJobs", () => ({
  useVideoJobs: () => ({ data: [], isLoading: false, refetch: vi.fn() }),
  useSignedVideoUrl: () => ({ data: null }),
  useVideoJobMutations: () => ({
    rename:         { mutate: vi.fn(), isPending: false },
    toggleFavorite: { mutate: vi.fn() },
    archive:        { mutate: vi.fn() },
    cancel:         { mutate: vi.fn() },
    remove:         { mutate: vi.fn() },
  }),
}));

describe("VideoLibrary", () => {
  it("renders the filter toolbar without throwing on Select item values", () => {
    expect(() => render(<VideoLibrary />)).not.toThrow();

    expect(screen.getByLabelText("Filter by style")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort videos")).toBeInTheDocument();
  });

  it("shows the empty state when the user has no videos", () => {
    render(<VideoLibrary />);
    expect(screen.getByText("No videos yet")).toBeInTheDocument();
  });
});
