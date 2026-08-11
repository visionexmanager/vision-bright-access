import { readFileSync } from "node:fs";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";

// The dashboard is the second channel into the Phase 4 engines. These cover the
// two things that matter most: it cannot authorize anything by itself, and two
// people deciding the same approval cannot both succeed.

const invoke = vi.fn();
const tables: Record<string, unknown[]> = {};

function queryFor(table: string) {
  const rows = tables[table] ?? [];
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self, order: self, eq: self, gt: self, limit: () => Promise.resolve({ data: rows, error: null }),
    maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
    then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
  });
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => queryFor(table),
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en", dir: "ltr", translateText: (text: string) => text,
  }),
}));

vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router-dom", () => ({ Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a> }));

const { default: OwnerControlCenter } = await import("@/pages/admin/OwnerControlCenter");
const { useOwnerControl } = await import("@/hooks/useOwnerControl");

const escalation = {
  id: "esc-1", customer_name: "Sara", customer_ref: "9611234", channel: "whatsapp",
  reason: "customer_requested_human", customer_request: "Wants a braille display",
  ai_summary: "Asked for a braille display under $900", suggested_action: "Confirm sourcing",
  subject_type: "product", subject_id: "p-1", state: "WAITING_FOR_OWNER",
  created_at: new Date(Date.now() - 90 * 60000).toISOString(), transcript: [],
};

const approval = {
  id: "ap-1", reference: "A7K2M", action_type: "sourcing_approval",
  title: "Source a braille display from a verified supplier", summary: "Customer budget is $900",
  payload: { source_slug: "supplier-x", source_price_usd: 610, final_price_usd: 720 },
  state: "WAITING_FOR_APPROVAL", escalation_id: "esc-1",
  created_at: new Date(Date.now() - 30 * 60000).toISOString(),
  expires_at: new Date(Date.now() + 6 * 86400000).toISOString(),
  decided_at: null, decided_via: null, decision_note: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  tables.support_escalations = [escalation];
  tables.owner_approvals = [approval];
  tables.ai_feedback_events = [{ id: "f-1", event_type: "owner_approval", channel: "admin_ui",
    subject_type: "sourcing_approval", subject_id: "A7K2M", summary: "Owner approved", created_at: new Date().toISOString() }];
  tables.audit_logs = [{ id: "a-1", action: "owner_approved", entity_type: "owner_approval",
    entity_id: "ap-1", metadata: {}, created_at: new Date().toISOString() }];
  tables.whatsapp_conversations = [{ id: "c-1", wa_phone: "96170750609", control: "human",
    escalated: true, escalation_reason: "user_request", control_changed_at: null,
    last_message_at: new Date().toISOString() }];
  tables.site_settings = [{ value: { whatsapp_number: null } }];
  invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

describe("no client-side authorization", () => {
  it("routes every write through the owner-control function", () => {
    const hook = readFileSync("src/hooks/useOwnerControl.ts", "utf8");
    // A direct table write from the browser would bypass the state machine.
    expect(hook).toContain('supabase.functions.invoke("owner-control"');
    expect(hook).not.toMatch(/\.update\(|\.insert\(|\.delete\(/);
    expect(hook).not.toContain("decide_owner_approval");
  });

  it("re-checks admin role server side on every call", () => {
    const fn = readFileSync("supabase/functions/owner-control/index.ts", "utf8");
    expect(fn).toContain("auth.getUser()");
    expect(fn).toContain('.eq("role", "admin")');
    expect(fn).toContain("Admin access required");
    // Role must be read with the service client, not the caller's context.
    // Matched on normalised whitespace: the file is checked out with CRLF on
    // Windows, so a literal "\n" in the needle finds nothing.
    const flat = fn.replace(/\s+/g, " ");
    const serviceAt = flat.indexOf("const service = createClient");
    const roleAt = flat.indexOf('await service .from("user_roles")');
    expect(serviceAt).toBeGreaterThan(-1);
    expect(roleAt).toBeGreaterThan(serviceAt);
  });

  it("uses the Phase 4 engines rather than a second approval path", () => {
    const fn = readFileSync("supabase/functions/owner-control/index.ts", "utf8");
    expect(fn).toContain('rpc("decide_owner_approval"');
    expect(fn).toContain('rpc("transition_escalation"');
    expect(fn).toContain('_via: "admin_ui"');
  });
});

describe("concurrent approval", () => {
  it("lets only one of two sessions succeed", async () => {
    // The database claims the row; the loser sees not_pending, which the
    // function surfaces as 409 rather than as an error to retry.
    let claimed = false;
    invoke.mockImplementation(async () => {
      if (claimed) return { data: { ok: false, reason: "not_pending" }, error: { message: "409" } };
      claimed = true;
      return { data: { ok: true, reference: "A7K2M" }, error: null };
    });

    let api!: ReturnType<typeof useOwnerControl>;
    function Harness() { api = useOwnerControl(); return null; }
    render(<Harness />);
    await waitFor(() => expect(api).toBeDefined());

    let first!: { ok: boolean; reason?: string };
    let second!: { ok: boolean; reason?: string };
    await act(async () => {
      [first, second] = await Promise.all([
        api.decideApproval("A7K2M", true),
        api.decideApproval("A7K2M", true),
      ]);
    });

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    const loser = first.ok ? second : first;
    expect(loser.reason).toBe("not_pending");
  });

  it("the engine claims the row only while it is still pending", () => {
    const migration = readFileSync("supabase/migrations/20260902000000_owner_control_and_escalations.sql", "utf8");
    expect(migration).toContain("AND state = 'WAITING_FOR_APPROVAL'");
    expect(migration).toContain("'not_pending'");
  });
});

describe("dashboard semantics", () => {
  it("renders escalations and approvals as tables with column headers", async () => {
    render(<OwnerControlCenter />);
    // Wait for a data-dependent node, not the static heading. The heading
    // renders before the rows load, so asserting on it raced under full-suite
    // load and passed only when the machine happened to be idle.
    await screen.findByRole("columnheader", { name: "Customer" });

    expect(screen.getAllByRole("table").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("columnheader", { name: "Reference" }).length).toBeGreaterThan(0);
  });

  it("gives every table a caption for context", async () => {
    render(<OwnerControlCenter />);
    await screen.findByRole("heading", { name: /Support escalations/ });

    // Every table on the page carries a caption, so a screen reader user
    // landing on one knows what it lists before reading any row.
    const captions = screen.getAllByRole("table").map(
      (table) => table.querySelector("caption")?.textContent?.trim() ?? "",
    );
    expect(captions.every(Boolean), `a table has no caption: ${JSON.stringify(captions)}`).toBe(true);
    expect(captions).toContain("Customer cases waiting for a person");
    expect(captions).toContain("Actions the AI is asking you to authorize");
  });

  it("states control and status as words, not colour", async () => {
    render(<OwnerControlCenter />);
    await screen.findByRole("heading", { name: /Conversations/ });
    expect(screen.getByText("Human controlled")).toBeInTheDocument();
    expect(screen.getByText("Waiting for you")).toBeInTheDocument();
  });

  it("frames the AI as proposing and the human as authorizing", async () => {
    render(<OwnerControlCenter />);
    const review = await screen.findByRole("button", { name: "Review" });
    await act(async () => { review.click(); });

    expect(await screen.findByRole("heading", { name: "The AI proposes this action" })).toBeInTheDocument();
    expect(screen.getByText(/You are authorizing it/)).toBeInTheDocument();
  });

  it("keeps internal sourcing detail out of anything customer-facing", async () => {
    render(<OwnerControlCenter />);
    const review = await screen.findByRole("button", { name: "Review" });
    await act(async () => { review.click(); });

    // Owner-only, behind a disclosure, and clearly labelled as internal.
    const disclosure = screen.getByText("Internal detail (not shown to customers)");
    expect(disclosure).toBeInTheDocument();
    expect(within(disclosure.closest("details")!).getByText(/source_price_usd/)).toBeInTheDocument();
  });

  it("never prints a full phone number", async () => {
    render(<OwnerControlCenter />);
    await screen.findByRole("heading", { name: /Conversations/ });
    expect(screen.queryByText(/96170750609/)).not.toBeInTheDocument();
    expect(screen.getByText("•••0609")).toBeInTheDocument();
  });

  it("announces changes through a live region", async () => {
    render(<OwnerControlCenter />);
    await screen.findByRole("heading", { name: /Support escalations/ });
    const status = screen.getAllByRole("status")[0];
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
  });

  it("links each expander to the region it controls", async () => {
    render(<OwnerControlCenter />);
    const open = await screen.findByRole("button", { name: "Open" });
    expect(open).toHaveAttribute("aria-controls", "owner-escalation-detail");
    expect(open).toHaveAttribute("aria-expanded", "false");
  });

  it("never claims WhatsApp is connected when it is not", async () => {
    render(<OwnerControlCenter />);
    await screen.findByRole("heading", { name: /Owner Control Center/ });
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();
  });
});

describe("whatsapp status reporting", () => {
  it("reports CONFIGURED, never CONNECTED, from the browser", () => {
    const hook = readFileSync("src/hooks/useOwnerControl.ts", "utf8");
    // The browser cannot observe a verified Meta integration, so it must not
    // assert one.
    expect(hook).toContain('setWhatsappStatus(ownerNumber ? "CONFIGURED" : "NOT_CONFIGURED")');
    expect(hook).not.toMatch(/setWhatsappStatus\("CONNECTED"\)/);
  });
});
