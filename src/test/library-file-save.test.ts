import { describe, expect, it, vi } from "vitest";
import { libraryFileKind, prepareLibraryFile, toBase64 } from "../../supabase/functions/_shared/libraryFile";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http";
import { canOfferFile } from "@/components/library/external/ExternalContentCard";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const item = (provider: string, over: Record<string, unknown>) =>
  makeItem(provider, { provider, providerItemId: "1", title: "Moon", contentType: "image", externalUrl: "https://example.org/x", ...over } as never);
const pexelsPhoto = item("pexels", { license: { name: "Pexels License" }, previewUrl: "https://images.pexels.com/photos/1/pexels-photo-1.png" });

const serve = (body: Uint8Array, type = "image/png") => vi.fn(async () => new Response(body as BodyInit, { status: 200, headers: { "content-type": type } }));

describe("saving a Library result as a file", () => {
  it("hands over the file under the chat channels' rules, with a safe name", async () => {
    const file = await prepareLibraryFile(pexelsPhoto, { fetch: serve(PNG) as never });
    expect(file).toMatchObject({ ok: true, mimeType: "image/png" });
    expect(file.ok && file.fileName).toMatch(/\.png$/);
    expect(file.ok && Array.from(file.bytes)).toEqual(Array.from(PNG));
  });

  it("refuses a result the chat channels would not deliver", async () => {
    const f = serve(PNG);
    // No licence.
    expect(await prepareLibraryFile(item("pexels", { license: null, previewUrl: "https://images.pexels.com/photos/1/a.png" }), { fetch: f as never })).toEqual({ ok: false, reason: "not_deliverable" });
    // A link-only provider, even with a licence and an address.
    expect(await prepareLibraryFile(item("unsplash", { license: { name: "CC0" }, previewUrl: "https://images.unsplash.com/a.jpg", downloadUrl: "https://images.unsplash.com/a.jpg" }), { fetch: f as never })).toEqual({ ok: false, reason: "not_deliverable" });
    // A result that is not a file at all.
    expect(libraryFileKind(item("openfeeds", { contentType: "podcast" }))).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("will not save a page presented as a picture, or a file that is too big", async () => {
    expect(await prepareLibraryFile(pexelsPhoto, { fetch: serve(new TextEncoder().encode("<html>nope</html>")) as never })).toMatchObject({ ok: false });
    const huge = new Uint8Array(13 * 1024 * 1024);
    huge.set(PNG);
    expect(await prepareLibraryFile(pexelsPhoto, { fetch: serve(huge) as never })).toMatchObject({ ok: false });
  });

  it("encodes bytes as base64 that decodes back", () => {
    expect(Array.from(Uint8Array.from(atob(toBase64(PNG)), (c) => c.charCodeAt(0)))).toEqual(Array.from(PNG));
  });

  it("offers the button only where there is a licence and a file address", () => {
    expect(canOfferFile(pexelsPhoto)).toBe(true);
    expect(canOfferFile(item("pexels", { license: null, previewUrl: "https://images.pexels.com/photos/1/a.png" }))).toBe(false);
    expect(canOfferFile(item("openfeeds", { contentType: "podcast", license: { name: "CC0" }, previewUrl: "https://x.example/a.mp3" }))).toBe(false);
    expect(canOfferFile(item("pexels", { license: { name: "Pexels License" } }))).toBe(false);
  });
});
