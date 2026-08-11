import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";

// The Content Hub charged VX on every click and then had nothing to open:
// `content_items` carried no destination, purchases were never read back, and
// the CTA looked up a `content.cta.*` namespace that exists in no dictionary.
// These tests pin the resulting rules — never charge without a destination,
// never charge twice, and never render an English CTA in a translated page.

const contentRows: Array<Record<string, unknown>> = [];
const purchaseRows: Array<{ item_id: string }> = [];
let contentError: { message: string } | null = null;

const spendVX = vi.fn(async () => true);
const earnPoints = vi.fn(async () => true);
const toast = vi.fn();

vi.mock("@/integrations/supabase/client", () => {
  const purchaseQuery = {
    select: () => purchaseQuery,
    eq: () => purchaseQuery,
    in: () => Promise.resolve({ data: purchaseRows, error: null }),
  };
  const contentQuery = {
    select: () => contentQuery,
    order: () => Promise.resolve({ data: contentError ? null : contentRows, error: contentError }),
  };
  return {
    supabase: {
      from: (table: string) => (table === "vx_purchases" ? purchaseQuery : contentQuery),
    },
  };
});

// Stable identity: the real AuthContext keeps the user object in state, and a
// fresh literal per render would restart the purchases effect forever.
const authUser = { id: "user-1" };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authUser }) }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en",
    dir: "ltr",
    translateText: (text: string) => text,
  }),
}));

vi.mock("@/hooks/useVXWallet", () => ({ useVXWallet: () => ({ spendVX, balance: 10_000, isLoading: false }) }));
vi.mock("@/hooks/useEarnPoints", () => ({ useEarnPoints: () => ({ earnPoints }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: (args: unknown) => toast(args) }));

vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/WatchAdButton", () => ({ WatchAdButton: () => null }));
vi.mock("@/components/AITaskPanel", () => ({ AITaskPanel: () => null }));
vi.mock("@/components/SmartSearch", () => ({ SmartSearch: () => null }));

const { default: Content } = await import("./Content");

function contentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    title: "Screen Reader Mastery",
    description: "Navigate confidently with NVDA and VoiceOver.",
    type: "article",
    category: "Accessibility",
    level: "Beginner",
    points: 10,
    duration: 12,
    extra_label: null,
    extra_value: null,
    content_url: "https://example.org/article",
    ...overrides,
  };
}

beforeEach(() => {
  contentRows.length = 0;
  purchaseRows.length = 0;
  contentError = null;
  vi.clearAllMocks();
});

describe("Content Hub", () => {
  it("tells the user the library is empty instead of rendering a blank grid", async () => {
    render(<Content />);
    expect(await screen.findByText(en["content.empty"])).toBeInTheDocument();
  });

  it("offers a retry when the query fails", async () => {
    contentError = { message: "network down" };
    render(<Content />);

    expect(await screen.findByText(en["content.loadFailed"])).toBeInTheDocument();
    expect(screen.getByRole("button", { name: en["content.tryAgain"] })).toBeInTheDocument();
  });

  it("uses the translated CTA for each content type", async () => {
    contentRows.push(contentItem({ id: "a", type: "course" }), contentItem({ id: "b", type: "podcast" }));
    render(<Content />);

    expect(await screen.findByRole("button", { name: new RegExp(en["content.enroll"]) })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(en["content.listen"]) })).toBeInTheDocument();
  });

  it("never charges for an item that has no destination", async () => {
    contentRows.push(contentItem({ content_url: null }));
    render(<Content />);

    expect(await screen.findByText(en["content.notAvailableYet"])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(en["content.read"]) })).not.toBeInTheDocument();
    expect(spendVX).not.toHaveBeenCalled();
  });

  it("rejects a non-http destination rather than putting it in an href", async () => {
    contentRows.push(contentItem({ content_url: "javascript:alert(1)" }));
    render(<Content />);

    expect(await screen.findByText(en["content.notAvailableYet"])).toBeInTheDocument();
  });

  it("charges once, then leaves a plain link to the material", async () => {
    contentRows.push(contentItem());
    render(<Content />);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(en["content.read"]) }));

    await waitFor(() => expect(spendVX).toHaveBeenCalledTimes(1));
    const link = await screen.findByRole("link", { name: new RegExp(en["content.open"]) });
    expect(link).toHaveAttribute("href", "https://example.org/article");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("does not re-charge content the user already bought", async () => {
    contentRows.push(contentItem());
    purchaseRows.push({ item_id: "item-1" });
    render(<Content />);

    expect(await screen.findByRole("link", { name: new RegExp(en["content.open"]) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: new RegExp(en["content.read"]) })).not.toBeInTheDocument();
  });

  it("clamps the reward to the cap award_points() enforces for engagement", async () => {
    contentRows.push(contentItem({ points: 500 }));
    render(<Content />);

    fireEvent.click(await screen.findByRole("button", { name: new RegExp(en["content.read"]) }));

    await waitFor(() => expect(earnPoints).toHaveBeenCalledTimes(1));
    expect(earnPoints).toHaveBeenCalledWith(50, "Engaged: Screen Reader Mastery");
  });
});
