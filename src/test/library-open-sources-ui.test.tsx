import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/i18n/ar";
import en from "@/i18n/en";
import type { ExternalContentItem, ProviderSummary } from "@/services/library/externalContent";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  search: vi.fn(),
  resolve: vi.fn(),
  providers: vi.fn(),
  health: vi.fn(),
  stored: vi.fn(),
  saved: vi.fn(),
  save: vi.fn(),
  unsave: vi.fn(),
  projects: [] as Array<{ id: string; title: string }>,
  addProjectItem: vi.fn(),
  toast: vi.fn(),
  ytSearch: vi.fn(),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => {
    const dict = (state.lang === "ar" ? ar : en) as Record<string, string>;
    return { t: (key: string) => dict[key] ?? key, lang: state.lang };
  },
}));
vi.mock("@/hooks/useDocumentHead", () => ({ useDocumentHead: () => undefined }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/hooks/library/useResearchProjects", () => ({ useResearchProjects: () => ({ projects: state.projects }) }));
vi.mock("@/services/library/researchProjects", () => ({ addProjectItem: state.addProjectItem }));
vi.mock("@/hooks/use-toast", () => ({ toast: state.toast }));
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
vi.mock("@/components/Layout", () => ({ Layout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/library/layout/LibraryLayout", () => ({
  LibraryLayout: ({ title, children }: { title: string; children: ReactNode }) => <main><h1>{title}</h1>{children}</main>,
}));
vi.mock("@/services/library/externalContent", async () => {
  const types = await vi.importActual<typeof import("../../supabase/functions/_shared/externalContent/types.ts")>("../../supabase/functions/_shared/externalContent/types.ts");
  const embed = await vi.importActual<typeof import("../../supabase/functions/_shared/externalContent/embed.ts")>("../../supabase/functions/_shared/externalContent/embed.ts");
  return {
    CONTENT_CATEGORIES: types.CONTENT_CATEGORIES,
    isAllowedEmbed: embed.isAllowedEmbed,
    searchExternalContent: state.search,
    resolveExternalItem: state.resolve,
    fetchExternalProviders: state.providers,
    runExternalProviderHealthCheck: state.health,
    fetchStoredProviderHealth: state.stored,
    citationFor: (await vi.importActual<typeof import("@/services/library/externalContent")>("@/services/library/externalContent")).citationFor,
    searchYouTube: state.ytSearch,
    YouTubeRequestError: class YouTubeRequestError extends Error {
      constructor(readonly code: string) { super(code); }
    },
    fetchSavedExternalItems: state.saved,
    saveExternalItem: state.save,
    unsaveExternalItem: state.unsave,
    SaveExternalItemError: class SaveExternalItemError extends Error {
      constructor(readonly code: string) { super(code); }
    },
  };
});

import LibraryOpenSources from "@/pages/library/LibraryOpenSources";
import { ExternalContentPreviewDialog, vttToTranscript } from "@/components/library/external/ExternalContentPreviewDialog";
import { ExternalSourcesAdminPanel } from "@/components/library/external/ExternalSourcesAdminPanel";
import { formatDuration, previewAction } from "@/components/library/external/ExternalContentCard";

const item = (provider: string, providerName: string, id: string, over: Partial<ExternalContentItem> = {}) =>
  makeItem(providerName, { provider, providerItemId: id, title: `${providerName} item ${id}`, contentType: "image", externalUrl: `https://${provider}.example/${id}`, ...over });

const COMMONS = item("wikimedia_commons", "Wikimedia Commons", "1", {
  title: "Full Moon", altText: "The full Moon over the sea", thumbnailUrl: "https://upload.wikimedia.org/t.jpg",
  previewUrl: "https://upload.wikimedia.org/f.jpg", downloadUrl: "https://upload.wikimedia.org/f.jpg",
  license: { name: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" }, attribution: "Jane, CC BY-SA 4.0, via Wikimedia Commons", creator: "Jane",
});
const ARCHIVE = item("internet_archive", "Internet Archive", "moonfilm", {
  title: "Moon film", contentType: "video", thumbnailUrl: "https://archive.org/services/img/moonfilm", embedUrl: "https://archive.org/embed/moonfilm", durationSeconds: 125,
});
const PLAIN = item("openalex", "OpenAlex", "w1", { title: "A paper", contentType: "document" });

const PROVIDERS: ProviderSummary[] = [
  { id: "wikimedia_commons", name: "Wikimedia Commons", homepage: "https://commons.wikimedia.org", docs: "https://www.mediawiki.org/wiki/API:Search", categories: ["images", "audio"],
    auth: { kind: "none" }, capabilities: { search: true, preview: true, embed: false, download: true }, licenseNote: "", rateLimit: "", status: "ready", missingEnv: [] },
  { id: "youtube", name: "YouTube", homepage: "https://www.youtube.com", docs: "https://developers.google.com/youtube/v3", categories: ["video"],
    auth: { kind: "api_key", env: ["YOUTUBE_API_KEY"] }, capabilities: { search: true, preview: false, embed: true, download: false }, licenseNote: "", rateLimit: "", status: "configuration_required", missingEnv: ["YOUTUBE_API_KEY"] },
];

const renderPage = (path = "/library/open-sources") => render(<MemoryRouter initialEntries={[path]}><LibraryOpenSources /></MemoryRouter>);

beforeEach(() => {
  state.lang = "en";
  state.search.mockReset();
  state.resolve.mockReset();
  state.providers.mockReset().mockResolvedValue({ providers: PROVIDERS, unsupported: [{ id: "loc", name: "Library of Congress", homepage: "https://www.loc.gov", categories: ["images"], status: "unsupported", reason: "Cloudflare bot challenge (HTTP 403) measured on 2026-09-29." }] });
  state.health.mockReset();
  state.stored.mockReset().mockResolvedValue([]);
  state.saved.mockReset().mockResolvedValue([]);
  state.save.mockReset().mockResolvedValue(undefined);
  state.unsave.mockReset().mockResolvedValue(true);
  state.projects = [];
  state.addProjectItem.mockReset().mockResolvedValue(undefined);
  state.toast.mockReset();
  state.ytSearch.mockReset();
});

describe("Open Sources page", () => {
  it("searches with the reader's language and type, and announces the outcome", async () => {
    state.search.mockResolvedValue({ items: [COMMONS, ARCHIVE, PLAIN], providers: [
      { provider: "wikimedia_commons", state: "ok", count: 1, latencyMs: 900 },
      { provider: "internet_archive", state: "ok", count: 1, latencyMs: 800 },
      { provider: "openalex", state: "ok", count: 1, latencyMs: 700 },
      { provider: "youtube", state: "timeout", count: 0, latencyMs: 8000 },
    ], duplicates: 0, page: 1 });
    renderPage();
    expect(screen.getByRole("heading", { level: 1, name: "Open Sources" })).toBeInTheDocument();
    const search = screen.getByRole("search");
    fireEvent.change(within(search).getByLabelText("What are you looking for?"), { target: { value: "moon" } });
    fireEvent.change(within(search).getByLabelText("Type"), { target: { value: "images" } });
    fireEvent.click(within(search).getByRole("button", { name: "Search" }));

    await screen.findByText("3 results from 3 sources");
    expect(state.search).toHaveBeenCalledWith({ query: "moon", categories: ["images"], language: "en", page: 1, limit: 6 });
    expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("3 results from 3 sources");
    expect(screen.getByText("Not answering right now: YouTube")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Full Moon", "Moon film", "A paper"]);
  });

  it("each result names its source and licence, and says when a link leaves Visionex", async () => {
    state.search.mockResolvedValue({ items: [COMMONS, PLAIN], providers: [], duplicates: 0, page: 1 });
    renderPage("/library/open-sources?q=moon");
    const card = (await screen.findByRole("article", { name: "Full Moon" }));
    expect(within(card).getByText("Source: Wikimedia Commons")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: "The full Moon over the sea" })).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /License: CC BY-SA 4.0 \(opens in a new tab\)/ })).toHaveAttribute("href", "https://creativecommons.org/licenses/by-sa/4.0/");
    expect(within(card).getByRole("link", { name: /Open at Wikimedia Commons.*Full Moon.*opens in a new tab/ })).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(card).getByRole("link", { name: /Download.*Full Moon/ })).toBeInTheDocument();
    expect(within(card).getByText(/Jane, CC BY-SA 4.0, via Wikimedia Commons/)).toBeInTheDocument();

    const paper = screen.getByRole("article", { name: "A paper" });
    expect(within(paper).getByText("License not stated. Check the source before reusing it.")).toBeInTheDocument();
    expect(within(paper).queryByRole("link", { name: /Download/ })).toBeNull();
    // Nothing to play inside the Library: only the link out, and the Save toggle.
    expect(within(paper).queryByRole("button", { name: /^(Play|Read|View):/ })).toBeNull();
    expect(within(paper).getByRole("button", { name: "Save: A paper" })).toBeInTheDocument();
  });

  it("says so when nothing is found or the search fails", async () => {
    state.search.mockResolvedValueOnce({ items: [], providers: [], duplicates: 0, page: 1 });
    renderPage("/library/open-sources?q=zzzz");
    await screen.findByText("Nothing found. Try other words or another type.");
    state.search.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await screen.findByText("The search could not be completed. Try again in a moment.");
  });

  it("'Load more' appends the next page and moves focus to the first new result", async () => {
    const page1 = Array.from({ length: 6 }, (_, i) => item("nasa", "NASA", `a${i}`));
    state.search
      .mockResolvedValueOnce({ items: page1, providers: [{ provider: "nasa", state: "ok", count: 6, latencyMs: 1 }], duplicates: 0, page: 1 })
      .mockResolvedValueOnce({ items: [item("nasa", "NASA", "b0"), page1[0]], providers: [{ provider: "nasa", state: "ok", count: 2, latencyMs: 1 }], duplicates: 0, page: 2 });
    renderPage("/library/open-sources?q=moon");
    fireEvent.click(await screen.findByRole("button", { name: "Load more results" }));
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(7));
    expect(state.search).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3, name: "NASA item b0" }));
    expect(screen.queryByRole("button", { name: "Load more results" })).toBeNull();
  });

  it("lists the sources it searches", async () => {
    state.search.mockResolvedValue({ items: [], providers: [], duplicates: 0, page: 1 });
    renderPage();
    const about = await screen.findByText("Where results come from");
    fireEvent.click(about);
    expect(screen.getByRole("link", { name: /Wikimedia Commons/ })).toHaveAttribute("href", "https://commons.wikimedia.org");
    // A provider without its key is not presented as a source.
    expect(screen.queryByRole("link", { name: /YouTube/ })).toBeNull();
  });

  it("reads in Arabic", async () => {
    state.lang = "ar";
    state.search.mockResolvedValue({ items: [COMMONS], providers: [{ provider: "wikimedia_commons", state: "ok", count: 1, latencyMs: 1 }], duplicates: 0, page: 1 });
    renderPage("/library/open-sources?q=قمر");
    expect(await screen.findByText("المصدر: Wikimedia Commons")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "المصادر المفتوحة" })).toBeInTheDocument();
    expect(state.search).toHaveBeenCalledWith(expect.objectContaining({ query: "قمر", language: "ar" }));
  });
});

describe("preview dialog", () => {
  it("plays an allow-listed embed in a titled iframe, never autoplaying", async () => {
    render(<ExternalContentPreviewDialog item={ARCHIVE} onClose={() => undefined} />);
    const dialog = await screen.findByRole("dialog", { name: "Moon film" });
    const frame = within(dialog).getByTitle("Moon film — Internet Archive player");
    expect(frame).toHaveAttribute("src", "https://archive.org/embed/moonfilm");
    expect(frame.getAttribute("src")).not.toMatch(/autoplay/);
    expect(frame).toHaveAttribute("sandbox");
  });

  it("refuses an embed that is not on the allow-list", async () => {
    const evil = { ...ARCHIVE, embedUrl: "https://evil.example/embed/x" };
    render(<ExternalContentPreviewDialog item={evil} onClose={() => undefined} />);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector("iframe")).toBeNull();
    expect(within(dialog).getByText("This item can't be played here. Open it at its source instead.")).toBeInTheDocument();
  });

  it("resolves an item first, then plays it with captions and a readable transcript", async () => {
    const created: Blob[] = [];
    const original = URL.createObjectURL;
    URL.createObjectURL = vi.fn((b: Blob) => { created.push(b); return "blob:captions"; });
    URL.revokeObjectURL = vi.fn();
    const pending = item("nasa", "NASA Image and Video Library", "GSFC", { title: "Edge of the Solar System", contentType: "video", needsResolve: true });
    state.resolve.mockResolvedValue({ ...pending, needsResolve: false, previewUrl: "https://images-assets.nasa.gov/v~mobile.mp4", mimeType: "video/mp4",
      captionsUrl: "https://images-assets.nasa.gov/v.vtt", captionsVtt: "WEBVTT\n\n1\n00:00.000 --> 00:02.000\nWhere does the solar system end?\n\n2\n00:02.000 --> 00:04.000\n<i>It depends.</i>" });
    render(<ExternalContentPreviewDialog item={pending} onClose={() => undefined} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(dialog.querySelector("video")).not.toBeNull());
    expect(state.resolve).toHaveBeenCalledWith("nasa:GSFC");
    const video = dialog.querySelector("video")!;
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.querySelector("track")).toHaveAttribute("src", "blob:captions");
    expect(video.querySelector("track")).toHaveAttribute("kind", "captions");
    expect(within(dialog).getByText("Transcript")).toBeInTheDocument();
    expect(within(dialog).getByText(/Where does the solar system end\?\s+It depends\./)).toBeInTheDocument();
    URL.createObjectURL = original;
  });

  it("labels an audio player and tells the reader when an item cannot be resolved", async () => {
    const radio = item("radio_browser", "Radio Browser", "r1", { title: "Quran Radio", contentType: "radio", previewUrl: "https://stream.example/live" });
    const { unmount } = render(<ExternalContentPreviewDialog item={radio} onClose={() => undefined} />);
    expect(await screen.findByLabelText("Audio player: Quran Radio")).toHaveAttribute("preload", "none");
    unmount();
    state.resolve.mockRejectedValue(new Error("404"));
    render(<ExternalContentPreviewDialog item={item("apple_podcasts", "Apple Podcasts", "9", { contentType: "podcast", needsResolve: true })} onClose={() => undefined} />);
    expect(await screen.findByText("This item can't be played here. Open it at its source instead.")).toBeInTheDocument();
  });

  it("helpers: transcript, duration and the action a card offers", () => {
    expect(vttToTranscript("WEBVTT\n\nNOTE x\n\n00:00.000 --> 00:01.000\nHello <b>there</b>")).toBe("Hello there");
    expect(formatDuration(125)).toBe("2:05");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(previewAction(ARCHIVE)).toBe("play");
    expect(previewAction(COMMONS)).toBe("view");
    expect(previewAction(PLAIN)).toBeNull();
  });
});

describe("admin panel", () => {
  it("shows each provider's state, the secret names it lacks, and the unsupported reasons", async () => {
    render(<ExternalSourcesAdminPanel />);
    const table = await screen.findByRole("table");
    const youtube = within(table).getByRole("row", { name: /YouTube/ });
    expect(within(youtube).getByText("Configuration required")).toBeInTheDocument();
    expect(within(youtube).getByText("YOUTUBE_API_KEY")).toBeInTheDocument();
    expect(within(youtube).getByText(/not set/)).toBeInTheDocument();
    expect(within(youtube).getByText("Never checked")).toBeInTheDocument();
    const commons = within(table).getByRole("row", { name: /Wikimedia Commons/ });
    expect(within(commons).getByText("Ready")).toBeInTheDocument();
    expect(within(commons).getByText("No key needed")).toBeInTheDocument();
    expect(within(commons).getByText("Search, Preview, Download")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 providers ready")).toBeInTheDocument();
    expect(screen.getByText(/Cloudflare bot challenge/)).toBeInTheDocument();
  });

  it("runs a live check and announces the result", async () => {
    state.health.mockResolvedValue([
      { provider: "wikimedia_commons", state: "healthy", latencyMs: 812, resultCount: 3, errorCode: null, checkedAt: "2026-09-29T10:00:00.000Z" },
      { provider: "youtube", state: "not_configured", latencyMs: null, resultCount: 0, errorCode: "not_configured", checkedAt: "2026-09-29T10:00:00.000Z" },
    ]);
    render(<ExternalSourcesAdminPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Run health check" }));
    expect(await screen.findByText("Health check finished: 1 of 2 healthy")).toBeInTheDocument();
    const commons = screen.getByRole("row", { name: /Wikimedia Commons/ });
    expect(within(commons).getByText("Healthy")).toBeInTheDocument();
    expect(within(commons).getByText(/812 ms/)).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /YouTube/ })).getByText("Not configured")).toBeInTheDocument();
  });
});

describe("My Library: saving an external result", () => {
  const results = () => state.search.mockResolvedValue({ items: [COMMONS, PLAIN], providers: [], duplicates: 0, page: 1 });

  it("Save is a toggle button, announced in words, and keeps the item on the shelf", async () => {
    results();
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    const save = within(card).getByRole("button", { name: "Save: Full Moon" });
    expect(save).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(save);
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    // Only the fields the shelf keeps are sent: no media, no captions, no provider extras.
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({ id: "wikimedia_commons:1", title: "Full Moon" }));
    const pressed = await within(card).findByRole("button", { name: "Saved: Full Moon" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    expect(pressed).toHaveTextContent("Saved");
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Saved to My Library: Full Moon"));
    expect(screen.getByRole("button", { name: "My saved items (1)" })).toBeInTheDocument();

    fireEvent.click(pressed);
    await waitFor(() => expect(state.unsave).toHaveBeenCalledWith("wikimedia_commons:1"));
    await within(card).findByRole("button", { name: "Save: Full Moon" });
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Removed from My Library: Full Moon"));
  });

  it("marks what is already saved when the page opens", async () => {
    results();
    state.saved.mockResolvedValue([COMMONS]);
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    expect(await within(card).findByRole("button", { name: "Saved: Full Moon" })).toHaveAttribute("aria-pressed", "true");
  });

  it("the saved view lists the shelf, lets a reader remove from it, and says when it is empty", async () => {
    state.saved.mockResolvedValue([COMMONS, PLAIN]);
    renderPage("/library/open-sources?view=saved");
    expect(await screen.findByRole("article", { name: "Full Moon" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "A paper" })).toBeInTheDocument();
    expect(screen.queryByRole("search")).toBeNull(); // the search form belongs to the search view
    fireEvent.click(within(screen.getByRole("article", { name: "A paper" })).getByRole("button", { name: "Saved: A paper" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "A paper" })).toBeNull());
    fireEvent.click(within(screen.getByRole("article", { name: "Full Moon" })).getByRole("button", { name: "Saved: Full Moon" }));
    expect(await screen.findByText("You have not saved anything yet. Use Save on a result to keep it here.")).toBeInTheDocument();
  });

  it("switches between search and saved without losing the results", async () => {
    results();
    renderPage("/library/open-sources?q=moon");
    await screen.findByRole("article", { name: "Full Moon" });
    fireEvent.click(screen.getByRole("button", { name: /My saved items/ }));
    expect(screen.queryByRole("search")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Search open sources", pressed: false }));
    expect(await screen.findByRole("article", { name: "Full Moon" })).toBeInTheDocument();
  });

  it("a reader without a plan that includes the Library is told why, and nothing changes", async () => {
    results();
    const { SaveExternalItemError } = await import("@/services/library/externalContent");
    state.save.mockRejectedValue(new SaveExternalItemError("subscription_required"));
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    fireEvent.click(within(card).getByRole("button", { name: "Save: Full Moon" }));
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Saving to My Library needs a plan that includes the Library."));
    expect(within(card).getByRole("button", { name: "Save: Full Moon" })).toHaveAttribute("aria-pressed", "false");
  });

  it("any other failure says so and leaves the button usable", async () => {
    results();
    state.save.mockRejectedValue(new Error("network"));
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    fireEvent.click(within(card).getByRole("button", { name: "Save: Full Moon" }));
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Could not update your saved items. Please try again."));
    expect(within(card).getByRole("button", { name: "Save: Full Moon" })).not.toBeDisabled();
  });

  it("speaks Arabic: the buttons and announcements come from the Arabic dictionary", async () => {
    state.lang = "ar";
    results();
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    fireEvent.click(within(card).getByRole("button", { name: "حفظ: Full Moon" }));
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("تم الحفظ في مكتبتي: Full Moon"));
  });
});

describe("Add to a research project", () => {
  const results = () => state.search.mockResolvedValue({ items: [COMMONS, PLAIN], providers: [], duplicates: 0, page: 1 });

  it("says where to make a project when there are none, and offers no Add button", async () => {
    results();
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    expect(within(card).queryByRole("button", { name: /Add to project/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Create a research project to save these references." })).toHaveAttribute("href", "/library/research-projects");
  });

  it("adds the result to the chosen project as a reference with its citation, and says so", async () => {
    results();
    state.projects = [{ id: "p1", title: "Moon study" }, { id: "p2", title: "Other" }];
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    const add = within(card).getByRole("button", { name: "Add to project: Full Moon" });
    // No project chosen yet: focusable, announced as unavailable, and it says why.
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).not.toBeDisabled();
    expect(add).toHaveAccessibleDescription("Choose a research project first.");
    fireEvent.click(add);
    expect(state.addProjectItem).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("project"), { target: { value: "p1" } });
    expect(add).toHaveAttribute("aria-disabled", "false");
    expect(add).not.toHaveAccessibleDescription("Choose a research project first.");
    fireEvent.click(add);
    await waitFor(() => expect(state.addProjectItem).toHaveBeenCalledTimes(1));
    expect(state.addProjectItem).toHaveBeenCalledWith("p1", "user-1", {
      itemType: "reference",
      citationText: "Jane (n.d.). Full Moon. Wikimedia Commons. CC BY-SA 4.0. https://wikimedia_commons.example/1",
    });
    expect(state.toast).toHaveBeenCalledWith({ title: "Reference added to the project" });
    // Announced in words as well as by the toast, and the button stays reachable.
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Reference added to the project"));
    const added = await within(card).findByRole("button", { name: "Added: Full Moon" });
    expect(added).toHaveAttribute("aria-disabled", "true");
    expect(added).not.toBeDisabled();
    fireEvent.click(added);
    expect(state.addProjectItem).toHaveBeenCalledTimes(1);
    // The other project is a different target: choosing it makes the item addable again.
    fireEvent.change(screen.getByLabelText("project"), { target: { value: "p2" } });
    expect(within(card).getByRole("button", { name: "Add to project: Full Moon" })).toHaveAttribute("aria-disabled", "false");
  });

  it("says when adding failed, and leaves the button usable", async () => {
    results();
    state.projects = [{ id: "p1", title: "Moon study" }];
    state.addProjectItem.mockRejectedValue(new Error("not an editor"));
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    fireEvent.change(screen.getByLabelText("project"), { target: { value: "p1" } });
    fireEvent.click(within(card).getByRole("button", { name: "Add to project: Full Moon" }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith({ title: "Couldn't add the reference", description: "not an editor", variant: "destructive" }));
    expect(within(card).getByRole("button", { name: "Add to project: Full Moon" })).toHaveAttribute("aria-disabled", "false");
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Couldn't add the reference"));
  });

  it("the saved view offers it too", async () => {
    state.projects = [{ id: "p1", title: "Moon study" }];
    state.saved.mockResolvedValue([COMMONS]);
    renderPage("/library/open-sources?view=saved");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    expect(within(card).getByRole("button", { name: "Add to project: Full Moon" })).toBeInTheDocument();
  });
});

describe("My Library: keyboard and screen-reader behaviour", () => {
  const results = () => state.search.mockResolvedValue({ items: [COMMONS, PLAIN], providers: [], duplicates: 0, page: 1 });

  it("the saved button's name starts with its visible text, and aria-pressed carries the state", async () => {
    results();
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    const button = within(card).getByRole("button", { name: "Save: Full Moon" });
    expect(button).toHaveTextContent("Save");
    expect(button).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(button);
    const pressed = await within(card).findByRole("button", { name: "Saved: Full Moon" });
    expect(pressed).toHaveTextContent("Saved");
    expect(pressed).toHaveAttribute("aria-pressed", "true");
  });

  it("removing a card in the saved view moves focus to its neighbour, never to the page", async () => {
    const third = item("nasa", "NASA", "n1", { title: "Third item" });
    state.saved.mockResolvedValue([COMMONS, PLAIN, third]);
    renderPage("/library/open-sources?view=saved");
    const middle = await screen.findByRole("article", { name: "A paper" });
    const button = within(middle).getByRole("button", { name: "Saved: A paper" });
    button.focus();
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole("article", { name: "A paper" })).toBeNull());
    // The card that took its place: the third one.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3, name: "Third item" })));
    // Removing the last one moves back to the card before it.
    fireEvent.click(within(screen.getByRole("article", { name: "Third item" })).getByRole("button", { name: "Saved: Third item" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 3, name: "Full Moon" })));
  });

  it("removing the last saved card moves focus to the empty-state message", async () => {
    state.saved.mockResolvedValue([COMMONS]);
    renderPage("/library/open-sources?view=saved");
    fireEvent.click(within(await screen.findByRole("article", { name: "Full Moon" })).getByRole("button", { name: "Saved: Full Moon" }));
    const empty = await screen.findByText("You have not saved anything yet. Use Save on a result to keep it here.");
    await waitFor(() => expect(document.activeElement).toBe(empty));
    expect(empty).toHaveAttribute("tabindex", "-1");
  });

  it("the saved view has a heading, and the tab switch clears a stale announcement", async () => {
    results();
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    fireEvent.click(within(card).getByRole("button", { name: "Save: Full Moon" }));
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Saved to My Library: Full Moon"));
    fireEvent.click(screen.getByRole("button", { name: /My saved items/ }));
    expect(screen.getByRole("heading", { level: 2, name: "My saved items" })).toBeInTheDocument();
    expect(screen.getAllByRole("status").map((s) => s.textContent)).not.toContain("Saved to My Library: Full Moon");
  });

  it("the same outcome twice is announced twice: the region is emptied before it is filled again", async () => {
    results();
    state.save.mockRejectedValue(new Error("network"));
    renderPage("/library/open-sources?q=moon");
    const card = await screen.findByRole("article", { name: "Full Moon" });
    const failure = "Could not update your saved items. Please try again.";
    const region = () => screen.getAllByRole("status").find((s) => s.textContent === failure || s.textContent === "");
    fireEvent.click(within(card).getByRole("button", { name: "Save: Full Moon" }));
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain(failure));
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(screen.getAllByRole("status").map((s) => s.textContent).join("|")));
    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    fireEvent.click(within(card).getByRole("button", { name: "Save: Full Moon" }));
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain(failure));
    observer.disconnect();
    expect(region()).toBeDefined();
    // Emptied, then filled: at least one mutation in between where the failure text was absent.
    expect(seen.some((s) => !s.includes(failure))).toBe(true);
  });

  it("the project chooser has a real label and a placeholder", async () => {
    results();
    state.projects = [{ id: "p1", title: "Moon study" }];
    const source = (await import("node:fs")).readFileSync("src/pages/library/LibraryOpenSources.tsx", "utf8");
    expect(source).toMatch(/<label htmlFor=\{projectSelectId\}/);
    expect(source).toMatch(/<SelectTrigger id=\{projectSelectId\}>/);
    expect(source).toContain('placeholder={t("library.openSources.projectPlaceholder")}');
    expect(source).not.toContain("aria-labelledby={projectLabelId}");
    renderPage("/library/open-sources?q=moon");
    expect(await screen.findByLabelText("project")).toBeInTheDocument();
  });
});

describe("YouTube as a source on the Open Sources page", () => {
  const CHANNEL_ID = "UCX6OQ3DkcsbYNE6H8uQQuVA";
  const ytVideo: ExternalContentItem = {
    ...makeItem("YouTube", {
      provider: "youtube", providerItemId: "dQw4w9WgXcQ", title: "Photosynthesis explained", contentType: "video", creator: "Edu Channel",
      externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", publishedAt: "2026-03-12", durationSeconds: 3723, needsResolve: true,
    }),
    metadata: { resourceType: "video", channelId: CHANNEL_ID },
  };
  const ytChannel: ExternalContentItem = {
    ...makeItem("YouTube", {
      provider: "youtube", providerItemId: `channel:${CHANNEL_ID}`, title: "Edu Channel", contentType: "channel", creator: "Edu Channel",
      externalUrl: `https://www.youtube.com/channel/${CHANNEL_ID}`,
    }),
    metadata: { resourceType: "channel", channelId: CHANNEL_ID },
  };
  const openYouTube = async () => {
    state.ytSearch.mockResolvedValue({ items: [ytVideo, ytChannel], nextPageToken: null, prevPageToken: null, totalResults: null, cached: false });
    renderPage("/library/open-sources?source=youtube");
    fireEvent.change(await screen.findByLabelText("What are you looking for?"), { target: { value: "photosynthesis" } });
    fireEvent.click(screen.getByRole("button", { name: "Search YouTube" }));
    return screen.findByRole("article", { name: "Photosynthesis explained" });
  };

  it("is one entry in the source selector, and replaces the general search while chosen", async () => {
    renderPage("/library/open-sources");
    const select = await screen.findByLabelText("Source");
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["All sources", "YouTube"]);
    expect(screen.getByRole("search")).toBeInTheDocument(); // the general search
    expect(screen.queryByRole("search", { name: "Search YouTube" })).toBeNull();
    fireEvent.change(select, { target: { value: "youtube" } });
    expect(screen.getByRole("search", { name: "Search YouTube" })).toBeInTheDocument();
    expect(screen.getByLabelText("Type")).toBeInTheDocument(); // YouTube's own Type filter
    fireEvent.change(select, { target: { value: "all" } });
    expect(screen.queryByRole("search", { name: "Search YouTube" })).toBeNull();
  });

  it("opens straight on YouTube from the address, and the general search is not called", async () => {
    await openYouTube();
    expect(state.search).not.toHaveBeenCalled();
    expect(state.ytSearch).toHaveBeenCalledTimes(1);
  });

  it("a video card shows the source, channel, date and duration, and says 'Open on YouTube'", async () => {
    const card = await openYouTube();
    expect(within(card).getByText("Source: YouTube")).toBeInTheDocument();
    expect(within(card).getByText("Published March 12, 2026")).toBeInTheDocument();
    expect(within(card).getByText("Length 1:02:03")).toBeInTheDocument();
    expect(within(card).getByText("Video")).toBeInTheDocument();
    expect(within(card).getByText(/Edu Channel/)).toBeInTheDocument();
    const open = within(card).getByRole("link", { name: /Open on YouTube.*Photosynthesis explained.*opens in a new tab/ });
    expect(open).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(open).toHaveAttribute("rel", "noopener noreferrer");
    expect(within(card).queryByRole("link", { name: /Download/ })).toBeNull(); // nothing is ever downloadable
    expect(within(card).getByRole("button", { name: "Play: Photosynthesis explained" })).toBeInTheDocument();
  });

  it("a channel card is labelled as a channel and links to it", async () => {
    await openYouTube();
    const card = screen.getByRole("article", { name: "Edu Channel" });
    expect(within(card).getByText("Channel")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /Open on YouTube/ })).toHaveAttribute("href", `https://www.youtube.com/channel/${CHANNEL_ID}`);
    expect(within(card).queryByRole("button", { name: /^(Play|View|Read):/ })).toBeNull(); // no player for a channel: it opens on YouTube
  });

  it("Add to Library saves the reference with its provider, id, address and metadata — and only that", async () => {
    const card = await openYouTube();
    fireEvent.click(within(card).getByRole("button", { name: "Add to Library: Photosynthesis explained" }));
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save).toHaveBeenCalledWith(expect.objectContaining({
      id: "youtube:dQw4w9WgXcQ", provider: "youtube", externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      metadata: { resourceType: "video", channelId: CHANNEL_ID },
    }));
    const pressed = await within(card).findByRole("button", { name: "In Library: Photosynthesis explained" });
    expect(pressed).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Saved to My Library: Photosynthesis explained"));
  });

  it("Add to Project files the reference in the chosen project, with a citation that names YouTube and its address", async () => {
    state.projects = [{ id: "p1", title: "Plants" }];
    const card = await openYouTube();
    fireEvent.change(screen.getByLabelText("project"), { target: { value: "p1" } });
    fireEvent.click(within(card).getByRole("button", { name: "Add to project: Photosynthesis explained" }));
    await waitFor(() => expect(state.addProjectItem).toHaveBeenCalledTimes(1));
    const [projectId, userId, input] = state.addProjectItem.mock.calls[0];
    expect([projectId, userId, input.itemType]).toEqual(["p1", "user-1", "reference"]);
    expect(input.citationText).toContain("YouTube");
    expect(input.citationText).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(input.citationText).not.toMatch(/transcript|full text|watched/i); // a reference, not a claim to have read the video
  });

  it("a reader whose plan lacks the Library is told why, and the button stays off", async () => {
    const { SaveExternalItemError } = await import("@/services/library/externalContent");
    state.save.mockRejectedValue(new SaveExternalItemError("subscription_required"));
    const card = await openYouTube();
    fireEvent.click(within(card).getByRole("button", { name: "Add to Library: Photosynthesis explained" }));
    await waitFor(() => expect(screen.getAllByRole("status").map((s) => s.textContent)).toContain("Saving to My Library needs a plan that includes the Library."));
    expect(within(card).getByRole("button", { name: "Add to Library: Photosynthesis explained" })).toHaveAttribute("aria-pressed", "false");
  });

  it("View opens YouTube's own player, and offers Open on YouTube beside it", async () => {
    state.resolve.mockResolvedValue({ ...ytVideo, needsResolve: false });
    const card = await openYouTube();
    fireEvent.click(within(card).getByRole("button", { name: "Play: Photosynthesis explained" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByTitle(/Photosynthesis explained.*YouTube/)).toBeInTheDocument());
    expect(within(dialog).getByTitle(/YouTube/)).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(within(dialog).getByRole("link", { name: /Open on YouTube/ })).toHaveAttribute("href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(state.resolve).toHaveBeenCalledWith("youtube:dQw4w9WgXcQ");
  });

  it("a video that cannot be embedded is said to be unavailable here, with the link to YouTube still there", async () => {
    state.resolve.mockResolvedValue({ ...ytVideo, needsResolve: false, embedUrl: null });
    const card = await openYouTube();
    fireEvent.click(within(card).getByRole("button", { name: "Play: Photosynthesis explained" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByRole("status")).toBeInTheDocument());
    expect(within(dialog).queryByTitle(/YouTube/)).toBeNull();
    expect(within(dialog).getByRole("link", { name: /Open on YouTube/ })).toBeInTheDocument();
  });

  it("YouTube results can be saved and the saved view keeps them", async () => {
    state.saved.mockResolvedValue([ytVideo]);
    renderPage("/library/open-sources?view=saved");
    const card = await screen.findByRole("article", { name: "Photosynthesis explained" });
    expect(within(card).getByRole("link", { name: /Open on YouTube/ })).toBeInTheDocument();
  });
});
