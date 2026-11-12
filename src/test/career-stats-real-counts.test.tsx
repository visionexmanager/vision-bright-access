// The careers page may only show totals that the listings it can read support.

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ jobs: [] as unknown[], isLoading: false }));

vi.mock("@/hooks/career/useCareerJobs", () => ({
  useCareerJobs: () => ({ jobs: state.jobs, isLoading: state.isLoading, error: null }),
}));

// The counter animates from 0 when scrolled into view; the test wants its target.
vi.mock("@/components/career/jobs/AnimatedCounter", () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

import { CareerStatsDashboard } from "@/components/career/jobs/CareerStatsDashboard";

const job = (over: Record<string, unknown>) => ({
  company_id: "c1",
  applicant_count: 0,
  remote: false,
  accessibility_friendly: false,
  ...over,
});

function figure(labelKey: string): string {
  const label = screen.getByText(labelKey);
  return within(label.parentElement as HTMLElement).getByText(/^\d/).textContent ?? "";
}

describe("CareerStatsDashboard", () => {
  beforeEach(() => {
    state.jobs = [];
    state.isLoading = false;
  });

  it("draws nothing while there are no listings, instead of inventing totals", () => {
    const { container } = render(<CareerStatsDashboard />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/48,?210/)).toBeNull();
  });

  it("draws nothing while loading", () => {
    state.isLoading = true;
    state.jobs = [job({})];
    const { container } = render(<CareerStatsDashboard />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts what the listings say", () => {
    state.jobs = [
      job({ company_id: "a", applicant_count: 5, remote: true, accessibility_friendly: true }),
      job({ company_id: "a", applicant_count: 2, remote: true }),
      job({ company_id: "b", applicant_count: 0, accessibility_friendly: true }),
    ];
    render(<CareerStatsDashboard />);
    expect(figure("careersPage.stats.jobs")).toBe("3");
    expect(figure("careersPage.stats.companies")).toBe("2");
    expect(figure("careersPage.stats.applications")).toBe("7");
    expect(figure("careersPage.stats.remoteJobs")).toBe("2");
    expect(figure("careersPage.stats.accessibleJobs")).toBe("2");
  });

  it("no longer claims a country count, which no column supports", () => {
    state.jobs = [job({})];
    render(<CareerStatsDashboard />);
    expect(screen.queryByText("careersPage.stats.countries")).toBeNull();
  });
});
