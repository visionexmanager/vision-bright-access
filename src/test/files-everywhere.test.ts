import { describe, expect, it, vi } from "vitest";
import { directCandidate, DELIVERY_HOSTS } from "../../supabase/functions/_shared/whatsappExternalFiles";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http";
import { deliverMetaAsset, metaAttachmentType } from "../../supabase/functions/_shared/messaging/metaDelivery";

const item = (provider: string, over: Record<string, unknown>) =>
  makeItem(provider, { provider, providerItemId: "1", title: "Rain", contentType: "audio", externalUrl: "https://example.org/x", ...over } as never);

describe("Freesound, Pexels and Pixabay as delivered files", () => {
  it("sends a Freesound preview from Freesound's own host, under CC0 or CC BY only", () => {
    const url = "https://cdn.freesound.org/previews/123/123456_789-hq.mp3";
    expect(directCandidate(item("freesound", { license: { name: "CC0 1.0" }, previewUrl: url }), "audio")).toMatchObject({ url, mime: "audio/mpeg", hosts: ["cdn.freesound.org"] });
    expect(directCandidate(item("freesound", { license: { name: "CC BY 4.0" }, previewUrl: url }), "audio")).not.toBeNull();
    expect(directCandidate(item("freesound", { license: { name: "CC BY-NC 4.0" }, previewUrl: url }), "audio")).toBeNull();
    expect(directCandidate(item("freesound", { license: { name: "CC0 1.0" }, previewUrl: "https://cdn.freesound.org.evil.org/previews/1/1_1-hq.mp3" }), "audio")).toBeNull();
  });

  it("sends a Pexels or Pixabay video, shrunk on the processor when it is over Meta's limit", () => {
    const pexels = directCandidate(item("pexels", { contentType: "video", license: { name: "Pexels License" }, downloadUrl: "https://videos.pexels.com/video-files/855564/855564-sd_640_360_24fps.mp4" }), "video");
    expect(pexels).toMatchObject({ mime: "video/mp4", hosts: expect.arrayContaining(["videos.pexels.com"]) });
    expect(pexels?.convert).toBeTruthy();
    expect(directCandidate(item("pixabay", { contentType: "video", license: { name: "Pixabay Content License" }, previewUrl: "https://cdn.pixabay.com/video/2020/05/25/40130-424930032_medium.mp4" }), "video")).not.toBeNull();
  });

  it("refuses the wrong kind, an unlicensed item and a foreign host", () => {
    const v = "https://videos.pexels.com/video-files/1/a.mp4";
    expect(directCandidate(item("pexels", { license: { name: "Pexels License" }, downloadUrl: v }), "audio")).toBeNull();
    expect(directCandidate(item("pexels", { license: null, downloadUrl: v }), "video")).toBeNull();
    expect(directCandidate(item("pexels", { license: { name: "Pexels License" }, downloadUrl: "https://evil.example/video-files/1/a.mp4" }), "video")).toBeNull();
  });

  it("keeps Jamendo, Dailymotion, Vimeo and YouTube as links", () => {
    for (const p of ["jamendo", "dailymotion", "vimeo", "youtube"]) {
      expect(DELIVERY_HOSTS[p], p).toBeUndefined();
      expect(directCandidate(item(p, { license: { name: "CC0" }, downloadUrl: "https://example.org/a.mp3", previewUrl: "https://example.org/a.mp3" }), "audio"), p).toBeNull();
    }
  });
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const okFetch = (log: Array<{ url: string; init?: RequestInit }>) => vi.fn(async (url: string, init?: RequestInit) => {
  log.push({ url, init });
  if (url.startsWith("https://images-assets.nasa.gov/")) return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
  return new Response(JSON.stringify({ message_id: "m1" }), { status: 200 });
});

describe("files on Messenger and Instagram", () => {
  const asset = { url: "https://images-assets.nasa.gov/image/A/A~medium.png", allowedHosts: ["images-assets.nasa.gov"], mimeType: "image/png", fileName: "moon.png", caption: "NASA, no known copyright" };

  it("names the platform's attachment types", () => {
    expect(metaAttachmentType("document")).toBe("file");
    expect(metaAttachmentType("image")).toBe("image");
  });

  it("Messenger: uploads the bytes with the message, then sends the credit line", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const result = await deliverMetaAsset({ channel: "messenger", fromAccountId: "PAGE1", toUserId: "PSID1", token: "tok", asset, fetchImpl: okFetch(calls) as never });
    expect(result.outcome).toBe("delivered_image");
    const upload = calls.find((c) => c.url.endsWith("/PAGE1/messages") && c.init?.body instanceof FormData)!;
    expect(upload.init?.headers).toMatchObject({ Authorization: "Bearer tok" });
    expect(String((upload.init!.body as FormData).get("message"))).toContain('"type":"image"');
    expect(calls.some((c) => typeof c.init?.body === "string" && String(c.init.body).includes("no known copyright"))).toBe(true);
  });

  it("Instagram: passes the public address, never bytes", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const sent = await deliverMetaAsset({ channel: "instagram", fromAccountId: "IG1", toUserId: "IGSID1", token: "tok", asset, fetchImpl: okFetch(calls) as never });
    expect(sent.outcome).toBe("delivered_image");
    const body = JSON.parse(String(calls.find((c) => c.url.includes("graph.instagram.com") && String(c.init?.body).includes("attachment"))!.init!.body));
    expect(body.message.attachment).toEqual({ type: "image", payload: { url: asset.url } });
    // A file that exists only as converted bytes cannot go to Instagram.
    const bytesOnly = await deliverMetaAsset({ channel: "instagram", fromAccountId: "IG1", toUserId: "IGSID1", token: "tok", asset: { bytes: PNG, mimeType: "image/png" }, fetchImpl: okFetch([]) as never });
    expect(bytesOnly).toMatchObject({ outcome: "failed", reason: "meta_url_required" });
  });

  it("refuses a host it was not given, a wrong file and a rejected send", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    expect(await deliverMetaAsset({ channel: "messenger", fromAccountId: "P", toUserId: "U", token: "t", asset: { ...asset, url: "https://evil.example/a.png" }, fetchImpl: okFetch(calls) as never })).toMatchObject({ outcome: "failed" });
    expect(calls.length).toBe(0);
    const html = vi.fn(async () => new Response("<html>nope</html>", { status: 200, headers: { "content-type": "image/png" } }));
    expect(await deliverMetaAsset({ channel: "messenger", fromAccountId: "P", toUserId: "U", token: "t", asset, fetchImpl: html as never })).toMatchObject({ outcome: "failed", reason: "asset_content_mismatch" });
    const rejected = vi.fn(async (url: string) => url.startsWith("https://images-assets") ? new Response(PNG, { status: 200, headers: { "content-type": "image/png" } }) : new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 }));
    expect(await deliverMetaAsset({ channel: "messenger", fromAccountId: "P", toUserId: "U", token: "t", asset, fetchImpl: rejected as never })).toMatchObject({ outcome: "failed", reason: "meta_send_rejected" });
  });
});
