import { describe, expect, it } from "vitest";
import { DELIVERY_HOSTS, KIND_SEARCH, directCandidate } from "../../supabase/functions/_shared/whatsappExternalFiles";
import { makeItem } from "../../supabase/functions/_shared/externalContent/http";

const item = (provider: string, over: Record<string, unknown>) =>
  makeItem(provider, { provider, providerItemId: "1", title: "Moon", contentType: "image", externalUrl: "https://example.org/x", ...over } as never);

const NASA = { name: "No known copyright", url: "https://www.nasa.gov/nasa-brand-center/images-and-media/" };

describe("NASA, the Smithsonian, Pexels and Pixabay as WhatsApp picture sources", () => {
  it("are asked for pictures, after the open sources and before the link-only aggregators", () => {
    const order = KIND_SEARCH.image.providers;
    expect(order.indexOf("rijksmuseum")).toBeLessThan(order.indexOf("nasa"));
    for (const id of ["nasa", "smithsonian", "pexels", "pixabay"]) expect(order.indexOf(id)).toBeLessThan(order.indexOf("unsplash"));
    expect(order.slice(-3)).toEqual(["unsplash", "europeana", "dpla"]);
  });

  it("send a NASA picture from NASA's server, resized on the processor", () => {
    const c = directCandidate(item("nasa", { license: NASA, previewUrl: "https://images-assets.nasa.gov/image/PIA12235/PIA12235~orig.jpg" }), "image");
    expect(c).toMatchObject({ url: "https://images-assets.nasa.gov/image/PIA12235/PIA12235~orig.jpg", mime: "image/jpeg", mustConvert: true, hosts: ["images-assets.nasa.gov"] });
    expect(c?.convert).toBeTruthy();
    // A folder name with an encoded space is a real NASA address.
    expect(directCandidate(item("nasa", { license: NASA, previewUrl: "https://images-assets.nasa.gov/image/Moon%20to%20Mars/Moon%20to%20Mars~orig.png" }), "image")).not.toBeNull();
  });

  it("send a Pexels or Pixabay picture as it is, from their own hosts", () => {
    const pexels = directCandidate(item("pexels", { license: { name: "Pexels License" }, previewUrl: "https://images.pexels.com/photos/1/pexels-photo-1.jpeg?auto=compress&cs=tinysrgb&h=650&w=940" }), "image");
    expect(pexels).toMatchObject({ mime: "image/jpeg", hosts: expect.arrayContaining(["images.pexels.com"]) });
    expect(pexels?.mustConvert).toBeUndefined();
    const pixabay = directCandidate(item("pixabay", { license: { name: "Pixabay Content License" }, previewUrl: "https://pixabay.com/get/g123_640.jpg" }), "image");
    expect(pixabay).toMatchObject({ mime: "image/jpeg", hosts: ["pixabay.com", "cdn.pixabay.com"] });
  });

  it("send a Smithsonian picture only when it is CC0", () => {
    const url = "https://ids.si.edu/ids/deliveryService?id=NMAH-AHB2012q10012";
    expect(directCandidate(item("smithsonian", { license: { name: "CC0" }, downloadUrl: url }), "image")).toMatchObject({ mustConvert: true });
    expect(directCandidate(item("smithsonian", { license: { name: "CC BY-NC" }, downloadUrl: url }), "image")).toBeNull();
  });

  it("refuse a wrong licence, a wrong host, an unlicensed item and any other kind", () => {
    const good = "https://images-assets.nasa.gov/image/PIA1/PIA1~orig.jpg";
    expect(directCandidate(item("nasa", { license: { name: "CC BY" }, previewUrl: good }), "image")).toBeNull();
    expect(directCandidate(item("nasa", { license: NASA, previewUrl: "https://evil.example.org/image/PIA1/PIA1~orig.jpg" }), "image")).toBeNull();
    expect(directCandidate(item("nasa", { license: NASA, previewUrl: "https://images-assets.nasa.gov.evil.org/image/PIA1/a.jpg" }), "image")).toBeNull();
    expect(directCandidate(item("nasa", { license: null, previewUrl: good }), "image")).toBeNull();
    for (const kind of ["video", "audio", "document", "book"] as const) expect(directCandidate(item("pexels", { license: { name: "Pexels License" }, previewUrl: "https://images.pexels.com/photos/1/a.jpeg" }), kind), kind).toBeNull();
  });

  it("leave Unsplash, Europeana and DPLA as links", () => {
    for (const p of ["unsplash", "europeana", "dpla"]) {
      expect(DELIVERY_HOSTS[p]).toBeUndefined();
      expect(directCandidate(item(p, { license: { name: "CC0" }, downloadUrl: "https://example.org/a.jpg", previewUrl: "https://example.org/a.jpg" }), "image")).toBeNull();
    }
  });
});
