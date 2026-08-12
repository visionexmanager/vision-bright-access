import { readFileSync } from "node:fs";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";
import ar from "@/i18n/ar";

// Phase 7 in the existing control centre. The dashboard gains a section, not a
// second page and not a second approval path. These cover what the owner has to
// be able to do without sight, and the guarantee that choosing "Instagram" here
// posts nothing to Instagram.

const invoke = vi.fn();
const tables: Record<string, unknown[]> = {};
const language = { lang: "en", dir: "ltr" as "ltr" | "rtl", dict: en as Record<string, string> };

function queryFor(table: string) {
  const rows = tables[table] ?? [];
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self, order: self, eq: self, gt: self, or: self,
    limit: () => Promise.resolve({ data: rows, error: null }),
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
    t: (key: string) => language.dict[key] ?? key,
    lang: language.lang, dir: language.dir, translateText: (text: string) => text,
  }),
}));

vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("react-router-dom", () => ({ Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a> }));

const { default: OwnerControlCenter } = await import("@/pages/admin/OwnerControlCenter");

const proposal = {
  id: "cp-1", proposal_ref: "H7K3M", content_type: "post", section: "products",
  platform: "instagram", topic: "Braille displays for students",
  hook: "Reading without looking at a screen",
  body: "A 40-cell braille display turns any page into something you can feel.",
  hashtags: ["#accessibility", "#braille"],
  rationale: "Three braille displays are indexed and none has been posted about.",
  target_audience: "Blind students and their families", language: "en",
  source_refs: [{ source_table: "products", source_id: "prod-11" }],
  proposed_publish_at: new Date(Date.now() + 86400000).toISOString(),
  state: "PROPOSED", revision: 1, rejection_reason: null, owner_notes: null,
  supersedes_id: null, superseded_by_id: null,
  created_at: new Date(Date.now() - 20 * 60000).toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  language.lang = "en"; language.dir = "ltr"; language.dict = en as Record<string, string>;
  tables.support_escalations = [];
  tables.owner_approvals = [];
  tables.ai_feedback_events = [];
  tables.audit_logs = [];
  tables.whatsapp_conversations = [];
  tables.content_proposals = [proposal];
  tables.content_calendar = [];
  tables.site_settings = [{ value: { whatsapp_number: null } }];
  invoke.mockResolvedValue({ data: { ok: true, proposal_ref: "H7K3M" }, error: null });
});

const click = async (element: HTMLElement) => { await act(async () => { element.click(); }); };

const openDetail = async () => {
  const row = (await screen.findByText("H7K3M")).closest("tr")!;
  await click(within(row).getByRole("button", { name: en["owner.review"] }));
};

describe("proposals are readable without sight", () => {
  it("lists them in a real table with a caption and column headers", async () => {
    render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");

    const table = screen.getByRole("table", { name: en["content.proposalsCaption"] });
    for (const header of [
      en["owner.reference"], en["content.type"], en["content.section"],
      en["content.topic"], en["content.platform"], en["owner.status"],
    ]) {
      expect(within(table).getByRole("columnheader", { name: header })).toBeTruthy();
    }
  });

  it("counts in the heading exactly what the table lets the owner act on", async () => {
    // A heading that says 0 above a visible, actionable row invites a
    // heading-navigating user to skip the section — and an approved proposal
    // still waiting to be scheduled lives in exactly that state.
    const approved = { ...proposal, id: "cp-2", proposal_ref: "K4M9P", state: "APPROVED" };
    tables.content_proposals = [proposal, approved];

    render(<OwnerControlCenter />);
    await screen.findByText("K4M9P");

    const heading = screen.getByRole("heading", { name: /^Content proposals/ });
    const rows = within(screen.getByRole("table", { name: en["content.proposalsCaption"] }))
      .getAllByRole("row")
      .slice(1); // drop the header row

    expect(rows).toHaveLength(2);
    expect(heading.textContent).toContain(`(${rows.length})`);
  });

  it("keeps an approved proposal reachable so it can be scheduled", async () => {
    tables.content_proposals = [{ ...proposal, state: "APPROVED" }];
    render(<OwnerControlCenter />);
    await openDetail();

    // The schedule step is the only thing left for it, so it must be offered.
    expect(await screen.findByRole("button", { name: en["content.schedule"] })).toBeTruthy();
  });

  it("states status in words, not by colour alone", async () => {
    render(<OwnerControlCenter />);
    const row = (await screen.findByText("H7K3M")).closest("tr")!;
    // "Waiting for your decision", not a coloured dot.
    expect(within(row).getByText(en["content.state.PROPOSED"])).toBeTruthy();
    expect(within(row).getByText(en["content.section.products"])).toBeTruthy();
    expect(within(row).getByText(en["content.platform.instagram"])).toBeTruthy();
  });

  it("gives every generation control a real label", async () => {
    render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");
    for (const label of [
      en["content.section"], en["content.type"], en["content.platform"], en["content.language"],
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("announces changes through a live region", async () => {
    const { container } = render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");
    const live = container.querySelector('[role="status"][aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.getAttribute("aria-atomic")).toBe("true");
  });

  it("marks the detail region as controlled by the review button", async () => {
    render(<OwnerControlCenter />);
    const row = (await screen.findByText("H7K3M")).closest("tr")!;
    const review = within(row).getByRole("button", { name: en["owner.review"] });

    expect(review.getAttribute("aria-expanded")).toBe("false");
    expect(review.getAttribute("aria-controls")).toBe("owner-proposal-detail");
    await click(review);
    await waitFor(() => expect(review.getAttribute("aria-expanded")).toBe("true"));
  });

  it("follows the page direction in Arabic", async () => {
    language.lang = "ar"; language.dir = "rtl"; language.dict = ar as Record<string, string>;
    const { container } = render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");
    expect(container.querySelector('[dir="rtl"]')).toBeTruthy();
    expect(screen.getByText(ar["content.state.PROPOSED"])).toBeTruthy();
  });
});

describe("the owner sees why the AI proposed it", () => {
  it("shows the rationale, the audience and the proposed time", async () => {
    render(<OwnerControlCenter />);
    await openDetail();

    expect(await screen.findByText(proposal.rationale)).toBeTruthy();
    expect(screen.getByText(proposal.target_audience)).toBeTruthy();
    expect(screen.getByText(en["content.aiProposes"])).toBeTruthy();
    // Framing: the AI proposes, the human authorizes.
    expect(screen.getByText(en["owner.youAuthorize"])).toBeTruthy();
  });

  it("lists the indexed records the draft was grounded in", async () => {
    render(<OwnerControlCenter />);
    await openDetail();
    expect(await screen.findByText("prod-11")).toBeTruthy();
  });

  it("previews the content and its hashtags", async () => {
    render(<OwnerControlCenter />);
    await openDetail();
    await screen.findByText(en["content.preview"]);

    // The draft appears twice on purpose: once as a read-only preview and once
    // seeded into the edit box. Assert the preview specifically, so a change
    // that dropped it and left only the textarea would fail here.
    const matches = screen.getAllByText(proposal.body);
    expect(matches.some((node) => node.tagName === "P")).toBe(true);
    expect(matches.some((node) => node.tagName === "TEXTAREA")).toBe(true);
    expect(screen.getByText("#accessibility #braille")).toBeTruthy();
  });

  it("says plainly that a platform choice posts nothing", async () => {
    render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");
    expect(screen.getByText(en["content.noPublishNotice"])).toBeTruthy();
  });
});

describe("every owner action goes through owner-control", () => {
  const lastBody = () => (invoke.mock.calls.at(-1)?.[1] as { body: Record<string, unknown> }).body;

  it("approves through decide_proposal", async () => {
    render(<OwnerControlCenter />);
    await openDetail();
    await click(await screen.findByRole("button", { name: en["owner.approve"] }));

    await waitFor(() => expect(invoke).toHaveBeenCalledWith("owner-control", expect.anything()));
    expect(lastBody()).toMatchObject({ action: "decide_proposal", proposal_ref: "H7K3M", approve: true });
  });

  it("rejects through the same action with approve false", async () => {
    render(<OwnerControlCenter />);
    await openDetail();
    await click(await screen.findByRole("button", { name: en["owner.reject"] }));

    await waitFor(() => expect(lastBody()).toMatchObject({ action: "decide_proposal", approve: false }));
  });

  it("sends an edit as edit_proposal, seeded from the draft", async () => {
    render(<OwnerControlCenter />);
    await openDetail();

    const body = await screen.findByLabelText(en["content.editBody"]);
    // Editing starts from what the AI wrote, not an empty box.
    expect((body as HTMLTextAreaElement).value).toBe(proposal.body);
    await act(async () => {
      fireEvent.change(body, { target: { value: "Owner rewrite." } });
    });
    await click(screen.getByRole("button", { name: en["content.saveEdit"] }));

    await waitFor(() => expect(lastBody()).toMatchObject({
      action: "edit_proposal", proposal_ref: "H7K3M", body: "Owner rewrite.",
    }));
  });

  it("asks for another take through regenerate_proposal", async () => {
    render(<OwnerControlCenter />);
    await openDetail();
    await click(await screen.findByRole("button", { name: en["content.regenerate"] }));

    // Carries only the reference: the engine reuses the original brief and
    // creates a linked replacement rather than editing this one.
    await waitFor(() => expect(lastBody()).toMatchObject({
      action: "regenerate_proposal", proposal_ref: "H7K3M",
    }));
  });

  it("generates a new proposal through propose_content", async () => {
    render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");
    await click(screen.getByRole("button", { name: en["content.generate"] }));

    await waitFor(() => expect(lastBody()).toMatchObject({
      action: "propose_content", section: "products", content_type: "post", language: "en",
    }));
  });

  it("offers scheduling only once a proposal is approved", async () => {
    render(<OwnerControlCenter />);
    await openDetail();
    expect(screen.queryByRole("button", { name: en["content.schedule"] })).toBeNull();
  });

  it("reports a refusal in words instead of retrying", async () => {
    invoke.mockResolvedValue({ data: { ok: false, reason: "near_duplicate" }, error: null });
    render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");
    await click(screen.getByRole("button", { name: en["content.generate"] }));

    const { container } = { container: document.body };
    await waitFor(() => {
      const live = container.querySelector('[role="status"][aria-live="polite"]');
      expect(live?.textContent).toBe(en["content.refused.near_duplicate"]);
    });
  });
});

describe("the section offers only what exists", () => {
  it("lists the eleven indexed sections and nothing else", async () => {
    render(<OwnerControlCenter />);
    await screen.findByText("H7K3M");
    const select = screen.getByLabelText(en["content.section"]) as HTMLSelectElement;
    expect(select.options).toHaveLength(11);

    const values = [...select.options].map((o) => o.value);
    for (const invented of ["library_books", "news", "arcade_games", "features"]) {
      expect(values).not.toContain(invented);
    }
  });

  it("keeps the dashboard free of any direct table write", () => {
    const page = readFileSync("src/pages/admin/OwnerControlCenter.tsx", "utf8");
    expect(page).not.toMatch(/\.from\(["']content_/);
    expect(page).not.toMatch(/\.insert\(|\.update\(|\.delete\(/);
  });
});

describe("the existing control centre still works", () => {
  it("renders with no proposals at all", async () => {
    tables.content_proposals = [];
    render(<OwnerControlCenter />);
    expect(await screen.findByText(en["content.noProposals"])).toBeTruthy();
    // The Phase 4/5 sections are untouched by an empty Phase 7 table.
    expect(screen.getByText(en["owner.noApprovals"])).toBeTruthy();
  });
});
