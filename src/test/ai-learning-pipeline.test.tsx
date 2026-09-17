import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "@/i18n/en";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en", dir: "ltr", translateText: (text: string) => text,
  }),
}));

const { AnswerFeedback } = await import("@/components/ai/AnswerFeedback");
const { AILearningPanel } = await import("@/pages/admin/AILearningPanel");

const read = (path: string) => readFileSync(resolve(__dirname, "../..", path), "utf8");

beforeEach(() => rpc.mockReset());

describe("answer feedback", () => {
  it("records a rating as a signal, and says so", async () => {
    rpc.mockResolvedValue({ error: null });
    render(<AnswerFeedback question="What are your opening hours?" />);
    expect(screen.getByRole("group", { name: "Rate this answer" })).toBeTruthy();

    const helpful = screen.getByRole("button", { name: "Helpful" });
    fireEvent.click(helpful);

    await waitFor(() => expect(helpful.getAttribute("aria-pressed")).toBe("true"));
    expect(rpc).toHaveBeenCalledWith("record_ai_signal", {
      _signal: "thumbs_up",
      _channel: "website",
      _assistant_id: "visionex",
      _question: "What are your opening hours?",
    });
    expect(screen.getByRole("status").textContent).toBe("Thanks for the feedback");
    expect((screen.getByRole("button", { name: "Not helpful" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(helpful);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("does not claim a rating that was not stored", async () => {
    rpc.mockResolvedValue({ error: { message: "nope" } });
    render(<AnswerFeedback question="q" />);
    const notHelpful = screen.getByRole("button", { name: "Not helpful" });
    fireEvent.click(notHelpful);
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    await waitFor(() => expect((notHelpful as HTMLButtonElement).disabled).toBe(false));
    expect(notHelpful.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("is only offered under a finished answer to a question", () => {
    const chat = read("src/components/AIChat.tsx");
    expect(chat).toMatch(/messages\[index - 1\]\.role === "user"/);
    expect(chat).toMatch(/!\(isLoading && index === messages\.length - 1\)/);
  });
});

describe("learning dashboard panel", () => {
  it("shows counts from the dashboard function", async () => {
    rpc.mockResolvedValue({
      error: null,
      data: {
        days: 7, requests: 1200, tokens: 450000, avg_latency_ms: 850,
        signals: { thumbs_up: 40, thumbs_down: 3, correction: 1, fallback: 2 },
        failures_by_channel: { website: 4, whatsapp: 1 },
        providers: [{ provider: "openai", model: "gpt-4.1", requests: 900, avg_latency_ms: 800, p95_latency_ms: 2100, tokens: 400000 }],
        provider_failures: { openai: 2 },
        candidates: { new: 2, shipped: 5 }, regressions: 1,
        eval_cases: { open: 1, verified: 3 }, security_events: 17,
      },
    });
    render(<AILearningPanel />);
    expect(rpc).toHaveBeenCalledWith("ai_learning_dashboard", { _days: 7 });
    const row = async (name: string) => (await screen.findByRole("rowheader", { name })).parentElement?.textContent;
    expect(await row("Rated not helpful")).toContain("4");
    expect(await row("Failed requests")).toContain("5");
    expect(await row("Repeated failures to review")).toContain("2");
    expect(await row("Fixed problems that came back")).toContain("1");
    expect(await row("Evaluation cases")).toContain("4");
    expect(screen.getByRole("cell", { name: "gpt-4.1" })).toBeTruthy();
  });

  it("says when it cannot load, instead of showing zeros", async () => {
    rpc.mockResolvedValue({ error: { message: "Admins only" }, data: null });
    render(<AILearningPanel />);
    expect((await screen.findByRole("alert")).textContent).toBe("Could not load the learning summary.");
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("learning pipeline migration", () => {
  const sql = read("supabase/migrations/20261019000000_ai_learning_pipeline.sql");
  const table = (name: string) => sql.slice(sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${name}`)).split(");")[0];

  it("stores no identity and no raw message in signals", () => {
    const signals = table("ai_quality_signals");
    expect(signals).not.toMatch(/user_id|phone|email|message\b|content\b/);
    expect(signals).toMatch(/excerpt\s+text\s+CHECK \(char_length\(excerpt\) <= 240\)/);
    expect(sql).toMatch(/CASE WHEN _negative THEN public\.redact_pii\(/);
  });

  it("lets visitors add only website ratings, metered", () => {
    expect(sql).toMatch(/IF _signal NOT IN \('thumbs_up', 'thumbs_down', 'correction', 'hallucination_report'\)\s+OR coalesce\(_channel, ''\) <> 'website'/);
    expect(sql).toMatch(/check_ai_anon_rate_limit\(_caller, 'ai-feedback'\)/);
  });

  it("never treats a user's correction as a fact", () => {
    expect(sql).toMatch(/WHEN _signal IN \('correction', 'hallucination_report'\) THEN 'unverified_claim'/);
    expect(table("ai_knowledge_entries")).toMatch(/source\s+text\s+NOT NULL/);
    expect(sql).toMatch(/WITH CHECK \(\(SELECT public\.has_role\(\(SELECT auth\.uid\(\)\), 'admin'\)\) AND status = 'draft'\)/);
  });

  it("keeps knowledge versioned and reversible", () => {
    expect(sql).toContain("A knowledge entry is never edited; add a new version");
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_entries_one_active/);
    expect(sql).toMatch(/FUNCTION public\.rollback_knowledge_entry/);
  });

  it("requires a regression test before an eval case is verified", () => {
    expect(table("ai_eval_cases")).toMatch(/CHECK \(status <> 'verified' OR regression_test IS NOT NULL\)/);
  });

  it("keeps server-only functions away from clients", () => {
    for (const fn of ["question_fingerprint(text)", "detect_repeated_failures(integer, integer)", "sweep_ai_quality_signals()"]) {
      expect(sql, fn).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`);
      expect(sql, fn).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    }
    for (const fn of ["ai_learning_dashboard", "activate_knowledge_entry", "rollback_knowledge_entry"]) {
      const body = sql.slice(sql.indexOf(`FUNCTION public.${fn}(`));
      expect(body.slice(0, 900), fn).toContain("RAISE EXCEPTION 'Admins only'");
    }
  });

  it("schedules detection and retention", () => {
    expect(sql).toContain("cron.schedule('ai-repeated-failures'");
    expect(sql).toContain("cron.schedule('ai-quality-signals-sweep'");
    expect(sql).toMatch(/SET excerpt = NULL\s+WHERE excerpt IS NOT NULL AND created_at < now\(\) - interval '30 days'/);
  });

  it("is fed by ai-chat failures and fallbacks", () => {
    const chat = read("supabase/functions/ai-chat/index.ts");
    expect(chat).toMatch(/signal\("fallback"/);
    expect(chat).toMatch(/await signal\("failed_request"/);
  });
});
