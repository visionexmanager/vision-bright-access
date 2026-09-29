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
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => {
    const dict = (state.lang === "ar" ? ar : en) as Record<string, string>;
    return { t: (key: string) => dict[key] ?? key, lang: state.lang };
  },
}));
vi.mock("@/hooks/useDocumentHead", () => ({ useDocumentHead: () => undefined }));
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
    expect(screen.getByRole("status")).toHaveTextContent("3 results from 3 sources");
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
    // Nothing to play inside the Library: only the link out.
    expect(within(paper).queryByRole("button")).toBeNull();
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
