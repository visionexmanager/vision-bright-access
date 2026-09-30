// The browser side of YouTube: what it sends, how it reads an error, and what it
// saves. The Supabase client is a stand-in; nothing leaves the test.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http.ts";

const state = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn(), select: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: state.invoke },
    rpc: state.rpc,
    from: () => ({ select: () => ({ order: () => ({ limit: state.select }) }) }),
  },
}));

import {
  YouTubeRequestError, citationFor, fetchSavedExternalItems, fetchYouTubeResource, saveExternalItem, savedPayload, searchYouTube, unsaveExternalItem,
  type ExternalContentItem,
} from "@/services/library/externalContent";

const CHANNEL = "UCX6OQ3DkcsbYNE6H8uQQuVA";
const video = (): ExternalContentItem => ({
  ...makeItem("YouTube", {
    provider: "youtube", providerItemId: "dQw4w9WgXcQ", title: "Photosynthesis explained", contentType: "video", creator: "Edu Channel",
    externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", publishedAt: "2026-03-12", durationSeconds: 3723, attribution: "Edu Channel · YouTube",
  }),
  metadata: { resourceType: "video", channelId: CHANNEL },
});

beforeEach(() => {
  state.invoke.mockReset();
  state.rpc.mockReset();
  state.select.mockReset();
});

describe("searching", () => {
  it("sends the query and the filters to the one function, and hands back the page", async () => {
    state.invoke.mockResolvedValue({ data: { ok: true, items: [video()], nextPageToken: "T2", prevPageToken: null, totalResults: 9, cached: true }, error: null });
    const page = await searchYouTube({ query: "photosynthesis", type: "video", order: "date", language: "ar", region: "JO", captions: true, hd: true, pageToken: "T1" });
    expect(state.invoke).toHaveBeenCalledWith("library-research-assistant", { body: {
      mode: "youtube_search", query: "photosynthesis",
      youtube: { type: "video", order: "date", language: "ar", region: "JO", captions: true, hd: true, pageToken: "T1" },
    } });
    expect(page).toMatchObject({ nextPageToken: "T2", prevPageToken: null, totalResults: 9, cached: true });
    expect(page.items).toHaveLength(1);
  });

  it("carries no key, no address of Google and no raw API parameter", async () => {
    state.invoke.mockResolvedValue({ data: { ok: true, items: [], nextPageToken: null, prevPageToken: null, totalResults: null, cached: false }, error: null });
    await searchYouTube({ query: "physics" });
    const sent = JSON.stringify(state.invoke.mock.calls[0]);
    expect(sent).not.toMatch(/key|googleapis|AIza|safeSearch|part=/i);
  });

  it("reads a VisionEX error code from a non-2xx answer's body", async () => {
    for (const [status, code] of [[429, "youtube_quota_exceeded"], [503, "youtube_not_configured"], [400, "youtube_invalid_request"], [504, "youtube_timeout"]] as const) {
      const response = new Response(JSON.stringify({ ok: false, error: code }), { status, headers: { "Content-Type": "application/json" } });
      state.invoke.mockResolvedValueOnce({ data: null, error: { name: "FunctionsHttpError", message: "Edge Function returned a non-2xx status code", context: response } });
      await expect(searchYouTube({ query: "physics" })).rejects.toMatchObject({ name: "YouTubeRequestError", code });
    }
  });

  it("reads a code the function put in a 200 body, and the daily ceiling's own message", async () => {
    state.invoke.mockResolvedValueOnce({ data: { ok: false, error: "youtube_failed" }, error: null });
    await expect(searchYouTube({ query: "physics" })).rejects.toMatchObject({ code: "youtube_failed" });
    state.invoke.mockResolvedValueOnce({ data: { error: "Daily limit reached. Try again tomorrow." }, error: null });
    await expect(searchYouTube({ query: "physics" })).rejects.toMatchObject({ code: "daily_limit" });
  });

  it("never lets an unknown or hostile error string through as a code", async () => {
    state.invoke.mockResolvedValueOnce({ data: { ok: false, error: "AIza-SECRET at https://www.googleapis.com/x" }, error: null });
    const err = (await searchYouTube({ query: "physics" }).catch((e: unknown) => e)) as YouTubeRequestError;
    expect(err).toBeInstanceOf(YouTubeRequestError);
    expect(err.code).toBe("youtube_failed");
    expect(JSON.stringify({ m: err.message, c: err.code })).not.toMatch(/SECRET|googleapis/);
  });

  it("an unreadable error body, a thrown call and a plain error all become one safe failure or 'network'", async () => {
    state.invoke.mockResolvedValueOnce({ data: null, error: { context: new Response("<html>", { status: 502 }) } });
    await expect(searchYouTube({ query: "physics" })).rejects.toMatchObject({ code: "youtube_failed" });
    state.invoke.mockResolvedValueOnce({ data: null, error: new Error("boom") });
    await expect(searchYouTube({ query: "physics" })).rejects.toMatchObject({ code: "youtube_failed" });
    state.invoke.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(searchYouTube({ query: "physics" })).rejects.toMatchObject({ code: "network" });
  });

  it("fetches one resource by type and id", async () => {
    state.invoke.mockResolvedValue({ data: { ok: true, item: video() }, error: null });
    const item = await fetchYouTubeResource("video", "dQw4w9WgXcQ");
    expect(state.invoke).toHaveBeenCalledWith("library-research-assistant", { body: { mode: "youtube_resource", resource_type: "video", resource_id: "dQw4w9WgXcQ" } });
    expect(item.providerItemId).toBe("dQw4w9WgXcQ");
    state.invoke.mockResolvedValueOnce({ data: { ok: false, error: "youtube_not_found" }, error: null });
    await expect(fetchYouTubeResource("video", "aaaaaaaaaaa")).rejects.toMatchObject({ code: "youtube_not_found" });
  });
});

describe("Add to Library", () => {
  it("saves the reference — provider, id, address, channel — and nothing else: no media, no captions, no player address", async () => {
    state.rpc.mockResolvedValue({ data: "row-id", error: null });
    await saveExternalItem(video());
    expect(state.rpc).toHaveBeenCalledWith("library_save_external_item", { _item: expect.any(Object), _note: undefined });
    const sent = state.rpc.mock.calls[0][1]._item as Record<string, unknown>;
    expect(sent).toMatchObject({
      id: "youtube:dQw4w9WgXcQ", provider: "youtube", providerName: "YouTube", title: "Photosynthesis explained", contentType: "video",
      creator: "Edu Channel", externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
      publishedAt: "2026-03-12", metadata: { resourceType: "video", channelId: CHANNEL }, downloadUrl: null,
    });
    for (const never of ["embedUrl", "previewUrl", "captionsVtt", "captionsUrl", "durationSeconds", "needsResolve"]) expect(sent, never).not.toHaveProperty(never);
  });

  it("saves a channel and a playlist as what they are", () => {
    const channel: ExternalContentItem = { ...makeItem("YouTube", { provider: "youtube", providerItemId: `channel:${CHANNEL}`, title: "Edu", contentType: "channel", externalUrl: `https://www.youtube.com/channel/${CHANNEL}` }), metadata: { resourceType: "channel", channelId: CHANNEL } };
    const payload = savedPayload(channel);
    expect(payload).toMatchObject({ id: `youtube:channel:${CHANNEL}`, contentType: "channel", externalUrl: `https://www.youtube.com/channel/${CHANNEL}`, metadata: { resourceType: "channel", channelId: CHANNEL } });
  });

  it("names the reason: no plan for the Library, a full shelf, anything else", async () => {
    for (const [message, code] of [["subscription_required", "subscription_required"], ["library_full", "library_full"], ["boom", "failed"]] as const) {
      state.rpc.mockResolvedValueOnce({ data: null, error: { message } });
      await expect(saveExternalItem(video())).rejects.toMatchObject({ name: "SaveExternalItemError", code });
    }
  });

  it("reads the shelf back with its metadata and the new kinds", async () => {
    state.select.mockResolvedValue({ data: [
      { item_id: "youtube:dQw4w9WgXcQ", provider: "youtube", provider_name: "YouTube", title: "Photosynthesis explained", content_type: "video", description: null, creator: "Edu Channel",
        thumbnail_url: null, external_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", download_url: null, license_name: null, license_url: null, attribution: null, language: null,
        published_at: "2026-03-12", metadata: { resourceType: "video", channelId: CHANNEL } },
      { item_id: `youtube:playlist:PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`, provider: "youtube", provider_name: "YouTube", title: "Course", content_type: "playlist", description: null, creator: null,
        thumbnail_url: null, external_url: "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf", download_url: null, license_name: null, license_url: null, attribution: null, language: null, published_at: null, metadata: [1] },
      { item_id: "x:1", provider: "x", provider_name: "X", title: "Unknown kind", content_type: "malware", description: null, creator: null, thumbnail_url: null, external_url: "https://x.example/1",
        download_url: null, license_name: null, license_url: null, attribution: null, language: null, published_at: null, metadata: null },
    ], error: null });
    const items = await fetchSavedExternalItems();
    expect(items.map((i) => i.contentType)).toEqual(["video", "playlist"]); // a kind we do not know is left out
    expect(items[0]).toMatchObject({ id: "youtube:dQw4w9WgXcQ", providerItemId: "dQw4w9WgXcQ", metadata: { resourceType: "video", channelId: CHANNEL } });
    expect(items[1].providerItemId).toBe("playlist:PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf");
    expect(items[1].metadata).toBeUndefined(); // an array is not metadata
  });

  it("removes by id, whatever the plan", async () => {
    state.rpc.mockResolvedValue({ data: true, error: null });
    expect(await unsaveExternalItem("youtube:dQw4w9WgXcQ")).toBe(true);
    expect(state.rpc).toHaveBeenCalledWith("library_unsave_external_item", { _item_id: "youtube:dQw4w9WgXcQ" });
  });
});

describe("Add to Project", () => {
  it("the citation names YouTube, the channel and the address — a reference, never a claim to have watched it", () => {
    const text = citationFor(video());
    expect(text).toBe("Edu Channel (2026). Photosynthesis explained. YouTube. https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(text).not.toMatch(/transcript|summary|watched|full text/i);
  });
});
