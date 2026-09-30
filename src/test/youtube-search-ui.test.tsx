import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/i18n/ar";
import en from "@/i18n/en";
import type { ExternalContentItem, YouTubeErrorCode } from "@/services/library/externalContent";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar", search: vi.fn() }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => {
    const dict = (state.lang === "ar" ? ar : en) as Record<string, string>;
    return { t: (key: string) => dict[key] ?? key, lang: state.lang };
  },
}));
vi.mock("@/services/library/externalContent", () => ({
  searchYouTube: state.search,
  YouTubeRequestError: class YouTubeRequestError extends Error {
    constructor(readonly code: string) { super(code); }
  },
}));

import { YouTubeSearchPanel, youtubeMessageKey } from "@/components/library/external/YouTubeSearchPanel";
import { YouTubeRequestError } from "@/services/library/externalContent";

const video = (id: string, title: string): ExternalContentItem => ({
  ...makeItem("YouTube", { provider: "youtube", providerItemId: id, title, contentType: "video", externalUrl: `https://www.youtube.com/watch?v=${id}`, creator: "Edu Channel" }),
  metadata: { resourceType: "video", channelId: null },
});
const page = (items: ExternalContentItem[], nextPageToken: string | null = null) => ({ items, nextPageToken, prevPageToken: null, totalResults: null, cached: false });

const renderPanel = () => render(
  <YouTubeSearchPanel renderCard={(item, ref) => <article aria-label={item.title}><h3 ref={ref} tabIndex={-1}>{item.title}</h3></article>} />,
);
const search = (text = "photosynthesis") => {
  fireEvent.change(screen.getByLabelText("What are you looking for?"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Search YouTube" }));
};

beforeEach(() => {
  state.lang = "en";
  state.search.mockReset();
});

describe("the YouTube search panel", () => {
  it("is a labelled search with the filters YouTube really has, and searches nothing until asked", () => {
    renderPanel();
    expect(screen.getByRole("search", { name: "Search YouTube" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "YouTube" })).toBeInTheDocument();
    for (const label of ["Type", "Sort by", "Language", "Region"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Captions available" })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "HD" })).toBeEnabled();
    expect(state.search).not.toHaveBeenCalled();
  });

  it("searches videos by default in the reader's language, with only the filters that were set", async () => {
    state.search.mockResolvedValue(page([video("dQw4w9WgXcQ", "Photosynthesis"), video("aaaaaaaaaaa", "Chlorophyll")]));
    renderPanel();
    search();
    await screen.findByText("2 YouTube results");
    expect(state.search).toHaveBeenCalledWith({ query: "photosynthesis", type: "video", order: "relevance", language: "en", region: undefined, captions: undefined, hd: undefined, pageToken: undefined });
    expect(screen.getByRole("article", { name: "Photosynthesis" })).toBeInTheDocument();
  });

  it("sends captions, HD, newest and a region when they are chosen", async () => {
    state.search.mockResolvedValue(page([video("dQw4w9WgXcQ", "Photosynthesis")]));
    renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: "Captions available" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "HD" }));
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "viewCount" } });
    fireEvent.change(screen.getByLabelText("Region"), { target: { value: "JO" } });
    search();
    await waitFor(() => expect(state.search).toHaveBeenCalledTimes(1));
    expect(state.search).toHaveBeenCalledWith(expect.objectContaining({ captions: true, hd: true, order: "viewCount", region: "JO", type: "video" }));
  });

  it("switches the video-only filters off, and clears them, for channels and playlists — so an invalid request cannot be built", async () => {
    state.search.mockResolvedValue(page([]));
    renderPanel();
    fireEvent.click(screen.getByRole("checkbox", { name: "Captions available" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "HD" }));
    fireEvent.change(screen.getByLabelText("Sort by"), { target: { value: "viewCount" } });
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "channel" } });
    expect(screen.getByRole("checkbox", { name: "Captions available" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "HD" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Captions available" })).not.toBeChecked();
    expect(screen.getByLabelText("Sort by")).toHaveValue("relevance");
    expect(within(screen.getByLabelText("Sort by")).getByRole("option", { name: "Most viewed" })).toBeDisabled();
    search();
    await waitFor(() => expect(state.search).toHaveBeenCalledTimes(1));
    const sent = state.search.mock.calls[0][0];
    expect(sent).toMatchObject({ type: "channel", order: "relevance" });
    expect(sent).not.toHaveProperty("captions", true);
    expect(sent.captions).toBeUndefined();
    expect(sent.hd).toBeUndefined();
  });

  it("will not search for less than two characters", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("What are you looking for?"), { target: { value: "a" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(state.search).not.toHaveBeenCalled();
  });

  it("pages explicitly: 'Load more' asks for the next token, appends, and moves focus to the first new result", async () => {
    state.search
      .mockResolvedValueOnce(page([video("dQw4w9WgXcQ", "First"), video("aaaaaaaaaaa", "Second")], "TOKEN2"))
      .mockResolvedValueOnce(page([video("bbbbbbbbbbb", "Third"), video("aaaaaaaaaaa", "Second")], null));
    renderPanel();
    search();
    await screen.findByText("2 YouTube results");
    expect(state.search).toHaveBeenCalledTimes(1); // no page was fetched on its own
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("article", { name: "Third" });
    expect(state.search).toHaveBeenLastCalledWith(expect.objectContaining({ pageToken: "TOKEN2", query: "photosynthesis" }));
    expect(screen.getAllByRole("article")).toHaveLength(3); // the repeated one is not shown twice
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Third" })));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("a new search replaces the results and starts again from the first page", async () => {
    state.search
      .mockResolvedValueOnce(page([video("dQw4w9WgXcQ", "First")], "TOKEN2"))
      .mockResolvedValueOnce(page([video("bbbbbbbbbbb", "Other")]));
    renderPanel();
    search();
    await screen.findByRole("article", { name: "First" });
    search("chlorophyll");
    await screen.findByRole("article", { name: "Other" });
    expect(screen.queryByRole("article", { name: "First" })).toBeNull();
    expect(state.search.mock.calls[1][0].pageToken).toBeUndefined();
  });

  it("says so when there is nothing", async () => {
    state.search.mockResolvedValue(page([]));
    renderPanel();
    search();
    expect((await screen.findAllByText("No YouTube results")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});

describe("when YouTube cannot answer", () => {
  it("not configured: says so in words, and offers no retry that could not help", async () => {
    state.search.mockRejectedValue(new YouTubeRequestError("youtube_not_configured"));
    renderPanel();
    search();
    expect(await screen.findByRole("alert")).toHaveTextContent("YouTube integration is not configured yet.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("a key Google refuses looks the same to the reader (the difference is for the operator's log)", async () => {
    state.search.mockRejectedValue(new YouTubeRequestError("youtube_unavailable"));
    renderPanel();
    search();
    expect(await screen.findByRole("alert")).toHaveTextContent("YouTube integration is not configured yet.");
  });

  it("quota or the daily ceiling: a calm message, and a retry", async () => {
    for (const code of ["youtube_quota_exceeded", "youtube_rate_limited", "daily_limit"]) {
      state.search.mockReset().mockRejectedValue(new YouTubeRequestError(code as YouTubeErrorCode | "daily_limit"));
      const { unmount } = renderPanel();
      search();
      expect(await screen.findByRole("alert")).toHaveTextContent("YouTube search is temporarily unavailable. Please try again later.");
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
      unmount();
    }
  });

  it("any other failure: 'Try again' repeats the same request", async () => {
    state.search.mockRejectedValueOnce(new YouTubeRequestError("youtube_timeout")).mockResolvedValueOnce(page([video("dQw4w9WgXcQ", "Recovered")]));
    renderPanel();
    search();
    expect(await screen.findByRole("alert")).toHaveTextContent("YouTube request failed");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("article", { name: "Recovered" });
    expect(state.search).toHaveBeenCalledTimes(2);
    expect(state.search.mock.calls[1][0]).toEqual(state.search.mock.calls[0][0]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("a failed 'Load more' keeps the results already shown and retries that page", async () => {
    state.search
      .mockResolvedValueOnce(page([video("dQw4w9WgXcQ", "First")], "TOKEN2"))
      .mockRejectedValueOnce(new YouTubeRequestError("youtube_failed"))
      .mockResolvedValueOnce(page([video("bbbbbbbbbbb", "Second")]));
    renderPanel();
    search();
    await screen.findByRole("article", { name: "First" });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("article", { name: "First" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("article", { name: "Second" });
    expect(state.search.mock.calls[2][0].pageToken).toBe("TOKEN2");
  });

  it("maps every code to one of three messages, and unknown errors to the generic one", () => {
    expect(youtubeMessageKey(new YouTubeRequestError("youtube_not_configured"))).toBe("library.youtube.notConfigured");
    expect(youtubeMessageKey(new YouTubeRequestError("youtube_unavailable"))).toBe("library.youtube.notConfigured");
    expect(youtubeMessageKey(new YouTubeRequestError("youtube_quota_exceeded"))).toBe("library.youtube.quota");
    expect(youtubeMessageKey(new YouTubeRequestError("daily_limit"))).toBe("library.youtube.quota");
    expect(youtubeMessageKey(new YouTubeRequestError("youtube_bad_response"))).toBe("library.youtube.failed");
    expect(youtubeMessageKey(new YouTubeRequestError("network"))).toBe("library.youtube.failed");
    expect(youtubeMessageKey(new Error("SECRET internal detail"))).toBe("library.youtube.failed");
    expect(youtubeMessageKey(null)).toBe("library.youtube.failed");
  });
});

describe("in another language", () => {
  it("speaks Arabic, names languages and regions in Arabic, and defaults the language filter to the reader's", async () => {
    state.lang = "ar";
    state.search.mockResolvedValue(page([]));
    renderPanel();
    expect(screen.getByRole("search", { name: "ابحث في YouTube" })).toBeInTheDocument();
    const language = screen.getByLabelText("اللغة") as HTMLSelectElement;
    expect(language.value).toBe("ar");
    const names = within(language).getAllByRole("option").map((o) => o.textContent);
    expect(names).toContain("العربية");
    expect(names).not.toContain("Arabic");
    const region = screen.getByLabelText("المنطقة");
    expect(within(region).getAllByRole("option").map((o) => o.textContent)).toContain("الأردن");
  });
});
