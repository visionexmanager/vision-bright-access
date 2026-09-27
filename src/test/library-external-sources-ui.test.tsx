import { readFileSync } from "node:fs";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/i18n/ar";
import en from "@/i18n/en";
import { ExternalSourcesResult } from "@/components/library/research/ExternalSourcesResult";
import type { LibraryExternalSourcesResult } from "@/services/library/researchAssistant";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  projects: [] as Array<{ id: string; title: string }>,
  addProjectItem: vi.fn(async () => undefined),
  user: { id: "user-1" },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => {
    const dict = (state.lang === "ar" ? ar : en) as Record<string, string>;
    return { t: (key: string) => dict[key] ?? key, lang: state.lang };
  },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/hooks/library/useResearchProjects", () => ({ useResearchProjects: () => ({ projects: state.projects }) }));
vi.mock("@/services/library/researchProjects", () => ({ addProjectItem: state.addProjectItem }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
// Radix Select cannot be driven in jsdom; a native select carries the same value.
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: ReactNode; value: string; onValueChange: (v: string) => void }) => (
    <select aria-label="project" value={value} onChange={(e) => onValueChange(e.target.value)}><option value="" />{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => <option value={value}>{children}</option>,
}));

const RESULT: LibraryExternalSourcesResult = {
  sources: { openalex: "ok", openlibrary: "ok", wikipedia: "timeout" },
  references: [
    {
      source: "openalex", kind: "article", title: "Reading habits and attitude in the digital age",
      authors: ["Nor Shahriza Abdul Karim", "Amelia Hasan"], year: 2007,
      url: "https://doi.org/10.1108/02640470710754805", doi: "10.1108/02640470710754805", openAccess: false, snippet: null,
      citation: "Nor Shahriza Abdul Karim & Amelia Hasan (2007). Reading habits and attitude in the digital age. https://doi.org/10.1108/02640470710754805",
    },
    {
      source: "openlibrary", kind: "book", title: "Atomic Habits", authors: ["James Clear"], year: 2016,
      url: "https://openlibrary.org/works/OL17930368W", doi: null, openAccess: false, snippet: null,
      citation: "James Clear (2016). Atomic Habits. Open Library. https://openlibrary.org/works/OL17930368W",
    },
  ],
};

const view = () => render(<MemoryRouter><ExternalSourcesResult result={RESULT} /></MemoryRouter>);

beforeEach(() => {
  state.lang = "en";
  state.projects = [];
  state.addProjectItem.mockClear();
});

describe("open-source references in the research assistant", () => {
  it("lists every reference as a link that says it opens in a new tab", () => {
    view();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const link = screen.getByRole("link", { name: /Reading habits and attitude in the digital age/ });
    expect(link).toHaveAttribute("href", "https://doi.org/10.1108/02640470710754805");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("dir", "auto");
    expect(link).toHaveAccessibleName(/opens in a new tab/);
    expect(screen.getByText("Scholarly paper")).toBeInTheDocument();
    expect(screen.getByText("Book")).toBeInTheDocument();
  });

  it("says which source did not answer", () => {
    view();
    expect(screen.getByRole("status")).toHaveTextContent("Not answering right now: Wikipedia");
  });

  it("points to creating a project when there is none, and cannot add yet", () => {
    view();
    expect(screen.getByRole("link", { name: en["library.researchAssistant.external.noProjects"] })).toHaveAttribute("href", "/library/research-projects");
    for (const button of screen.getAllByRole("button", { name: /^Add to project:/ })) expect(button).toBeDisabled();
  });

  it("adds a reference to the chosen project with its citation, once", async () => {
    state.projects = [{ id: "p1", title: "Reading study" }];
    view();
    fireEvent.change(screen.getByLabelText("project"), { target: { value: "p1" } });
    const button = screen.getByRole("button", { name: "Add to project: Atomic Habits" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(state.addProjectItem).toHaveBeenCalledTimes(1));
    expect(state.addProjectItem).toHaveBeenCalledWith("p1", "user-1", {
      itemType: "reference",
      citationText: "James Clear (2016). Atomic Habits. Open Library. https://openlibrary.org/works/OL17930368W",
    });
    const done = await screen.findByRole("button", { name: "Added: Atomic Habits" });
    expect(done).toBeDisabled();
  });

  it("reads in Arabic", () => {
    state.lang = "ar";
    view();
    expect(screen.getByText("بحث علمي")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("لا تستجيب الآن: ويكيبيديا");
  });

  it("has every new key in all twenty locales", () => {
    const keys = Object.keys(en).filter((k) => k.startsWith("library.researchAssistant.external.") || k.endsWith(".external_sources"));
    expect(keys).toHaveLength(16);
    for (const locale of ["ar", "bn", "de", "es", "fa", "fr", "hi", "id", "it", "ja", "ko", "nl", "pl", "pt", "ru", "tr", "ur", "vi", "zh"]) {
      // Read as text: importing nineteen dictionaries outlasts the test timeout.
      const source = readFileSync(`src/i18n/${locale}.ts`, "utf8");
      for (const key of keys) {
        const line = source.split("\n").find((l) => l.includes(`"${key}": "`));
        expect(line, `${locale}: ${key}`).toBeDefined();
        expect(line!.split(`"${key}": "`)[1].replace(/",?\s*$/, "").trim(), `${locale}: ${key} is empty`).not.toBe("");
      }
      const unavailable = source.split("\n").find((l) => l.includes('"library.researchAssistant.external.unavailable": "'));
      expect(unavailable, locale).toContain("{sources}");
    }
  });

});
