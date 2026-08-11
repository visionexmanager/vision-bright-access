import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";
import type { SourcedItem, SourcingResponse } from "@/lib/types";

// Phase 3 wires the result UI to the Commerce Agent. These cover the live
// path: the service-layer contract, the hook's behaviour, and the comparison
// view's semantics.

const sourceProducts = vi.fn();

vi.mock("@/services/ai/aiService", () => ({
  aiService: {
    sourceProducts: (...args: unknown[]) => sourceProducts(...args),
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en", dir: "ltr", translateText: (text: string) => text,
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild: _a, ...props }: { children: ReactNode; asChild?: boolean }) => (
    <button {...props}>{children}</button>
  ),
}));

const { useProductSourcing } = await import("@/hooks/useProductSourcing");
const { AIComparison } = await import("@/components/ai/AIComparison");

function item(overrides: Partial<SourcedItem> = {}): SourcedItem {
  return {
    ref: "VX-1", title: "Dell Latitude 5420", brand: "Dell", model: "5420",
    category: "electronics", specifications: { cpu: "i7", ram: "16GB" },
    condition: "new", availability: "in_visionex", priceUsd: 620, currency: "USD",
    ...overrides,
  };
}

function response(overrides: Partial<SourcingResponse> = {}): SourcingResponse {
  return {
    results: { new: [item()], used: [item({ ref: "VX-2", condition: "used", priceUsd: 399 })], refurbished: [] },
    total: 2,
    searchedExternally: false,
    ...overrides,
  };
}

/** Minimal harness so the hook can be driven without a component under test. */
function Harness({ onReady }: { onReady: (api: ReturnType<typeof useProductSourcing>) => void }) {
  const api = useProductSourcing("website");
  onReady(api);
  return <div data-testid="total">{api.total}</div>;
}

beforeEach(() => {
  vi.clearAllMocks();
  sourceProducts.mockResolvedValue(response());
});

describe("service layer contract", () => {
  it("routes sourcing through aiService, not a direct edge call", () => {
    // The documented rule: no component or hook may call an edge function
    // directly. A violation here is invisible until someone changes transport.
    const hook = readFileSync("src/hooks/useProductSourcing.ts", "utf8");
    expect(hook).toContain('from "@/services/ai/aiService"');
    expect(hook).not.toContain("edgeFunctions");
    expect(hook).not.toContain("supabase.functions.invoke");

    const service = readFileSync("src/services/ai/aiService.ts", "utf8");
    expect(service).toContain("sourceProducts");
    expect(service).toContain("searchServices");
  });
});

describe("useProductSourcing", () => {
  it("passes the query, condition and channel through", async () => {
    let api!: ReturnType<typeof useProductSourcing>;
    render(<Harness onReady={(a) => { api = a; }} />);

    await act(async () => { await api.run("laptop i7 16GB around $500", "all"); });

    expect(sourceProducts).toHaveBeenCalledWith(
      "laptop i7 16GB around $500", "all", "website", expect.anything(),
    );
    await waitFor(() => expect(screen.getByTestId("total")).toHaveTextContent("2"));
  });

  it("ignores a query too short to mean anything", async () => {
    let api!: ReturnType<typeof useProductSourcing>;
    render(<Harness onReady={(a) => { api = a; }} />);
    await act(async () => { await api.run("a"); });
    expect(sourceProducts).not.toHaveBeenCalled();
  });

  it("re-runs the stored query when the condition filter changes", async () => {
    let api!: ReturnType<typeof useProductSourcing>;
    render(<Harness onReady={(a) => { api = a; }} />);

    await act(async () => { await api.run("dell laptop", "all"); });
    await act(async () => { api.filterByCondition("used"); });

    // The user must not have to retype what they asked for.
    await waitFor(() => expect(sourceProducts).toHaveBeenLastCalledWith(
      "dell laptop", "used", "website", expect.anything(),
    ));
  });

  it("surfaces a failure instead of showing a silently empty list", async () => {
    sourceProducts.mockRejectedValueOnce(new Error("upstream down"));
    let api!: ReturnType<typeof useProductSourcing>;
    render(<Harness onReady={(a) => { api = a; }} />);

    await act(async () => { await api.run("dell laptop"); });
    await waitFor(() => expect(api.error).toBe("upstream down"));
    expect(api.total).toBe(0);
  });

  it("treats an aborted request as a no-op, not an error", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    sourceProducts.mockRejectedValueOnce(abort);
    let api!: ReturnType<typeof useProductSourcing>;
    render(<Harness onReady={(a) => { api = a; }} />);

    await act(async () => { await api.run("dell laptop"); });
    expect(api.error).toBeNull();
  });

  it("toggles selection for comparison", async () => {
    let api!: ReturnType<typeof useProductSourcing>;
    render(<Harness onReady={(a) => { api = a; }} />);

    await act(async () => { api.toggleSelected(item()); });
    await waitFor(() => expect(api.selected).toHaveLength(1));
    await act(async () => { api.toggleSelected(item()); });
    await waitFor(() => expect(api.selected).toHaveLength(0));
  });
});

describe("comparison view", () => {
  const items = [
    item({ ref: "A", title: "Dell Latitude", priceUsd: 620, specifications: { cpu: "i7", ram: "16GB" } }),
    item({ ref: "B", title: "HP EliteBook", priceUsd: 399, condition: "used",
      availability: "external_recommendation", specifications: { cpu: "i5", storage: "512GB" } }),
  ];

  it("is a real table with scoped row headers", () => {
    render(<AIComparison items={items} onClose={() => {}} onSelect={() => {}} />);
    // A div grid would give a screen reader no way to say which attribute a
    // cell belongs to.
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Price" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Condition" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Availability" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Dell Latitude" })).toBeInTheDocument();
  });

  it("keeps a spec row even when only one item has it", () => {
    render(<AIComparison items={items} onClose={() => {}} onSelect={() => {}} />);
    // `storage` exists only on B; dropping the row would hide a real difference.
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "storage" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "ram" })).toBeInTheDocument();
  });

  it("states availability per item as words", () => {
    render(<AIComparison items={items} onClose={() => {}} onSelect={() => {}} />);
    expect(screen.getByText("Available in Visionex")).toBeInTheDocument();
    expect(screen.getByText("External recommendation")).toBeInTheDocument();
  });

  it("moves focus to its heading when it opens", () => {
    render(<AIComparison items={items} onClose={() => {}} onSelect={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Comparing 2 items/ }));
  });

  it("keeps the wide table reachable by keyboard", () => {
    render(<AIComparison items={items} onClose={() => {}} onSelect={() => {}} />);
    // A scrollable region that cannot be focused is unreachable without a mouse.
    const scroller = screen.getByRole("group", { name: /Comparing 2 items/ });
    expect(scroller).toHaveAttribute("tabIndex", "0");
  });

  it("offers a selection action naming each item and its price", () => {
    const onSelect = vi.fn();
    render(<AIComparison items={items} onClose={() => {}} onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: /Select: Dell Latitude — USD 620\.00/ });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it("says price on request rather than inventing one", () => {
    render(<AIComparison items={[item({ priceUsd: null })]} onClose={() => {}} onSelect={() => {}} />);
    expect(screen.getByText("Price on request")).toBeInTheDocument();
  });
});

describe("services retrieval", () => {
  const aiSearch = readFileSync("supabase/functions/ai-search/index.ts", "utf8");

  it("hydrates services from the catalogue snapshot, not a table", () => {
    expect(aiSearch).toContain("SERVICES_BY_ID");
    expect(aiSearch).toContain('servicesCatalog.json');
    // There is no services table to select from.
    expect(aiSearch).not.toMatch(/SELECT\s*=\s*\{[^}]*services:/s);
  });

  it("uses the one shared embeddings index", () => {
    expect(aiSearch).toContain("match_embeddings");
  });
});
