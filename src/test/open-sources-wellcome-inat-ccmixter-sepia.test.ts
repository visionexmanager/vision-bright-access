import { describe, expect, it } from "vitest";
import { parseCcMixter, parseINaturalist, parseSepia, parseWellcome } from "../../supabase/functions/_shared/externalContent/providers/open";
import { DELIVERY_HOSTS, KIND_SEARCH, directCandidate } from "../../supabase/functions/_shared/whatsappExternalFiles";
import { CONTENT_PROVIDERS } from "../../supabase/functions/_shared/externalContent/registry";

const wellcome = (license: { id: string; url: string }, imageId = "L0013569") => ({
  results: [{ id: "abcd1234", source: { id: "f5m8vvrt", title: "Colossal lion's head" }, locations: [{ url: `https://iiif.wellcomecollection.org/image/${imageId}/info.json`, credit: "Wellcome Collection", license }] }],
});

describe("Wellcome Collection", () => {
  it("keeps a CC BY picture and names the licence from its id", () => {
    const [item] = parseWellcome(wellcome({ id: "cc-by", url: "http://creativecommons.org/licenses/by/4.0/" }));
    expect(item).toMatchObject({ provider: "wellcome", contentType: "image", license: { name: "CC BY" } });
    expect(item.downloadUrl).toBe("https://iiif.wellcomecollection.org/image/L0013569/full/!1200,1200/0/default.jpg");
  });
  it("reads the public domain mark, whatever address its licence carries", () => {
    const [item] = parseWellcome(wellcome({ id: "pdm", url: "https://creativecommons.org/share-your-work/public-domain/pdm/" }));
    expect(item.license?.name).toBe("Public Domain Mark");
  });
  it("drops a NonCommercial picture, an unknown licence and a hostile image id", () => {
    expect(parseWellcome(wellcome({ id: "cc-by-nc", url: "https://creativecommons.org/licenses/by-nc/4.0/" }))).toEqual([]);
    expect(parseWellcome(wellcome({ id: "in-copyright", url: "https://x.example/" }))).toEqual([]);
    expect(parseWellcome(wellcome({ id: "cc-by", url: "https://x.example/" }, "../../etc"))).toEqual([]);
  });
});

const obs = (photo: Record<string, unknown>) => ({ results: [{ id: 7, uri: "https://www.inaturalist.org/observations/7", species_guess: "Mountain lion", taxon: { name: "Puma concolor" }, user: { login: "x" }, photos: [photo] }] });
const square = "https://inaturalist-open-data.s3.amazonaws.com/photos/10820975/square.jpg";

describe("iNaturalist", () => {
  it("keeps a CC BY photo and asks for the large size", () => {
    const [item] = parseINaturalist(obs({ license_code: "cc-by", url: square }));
    expect(item).toMatchObject({ provider: "inaturalist", license: { name: "CC BY" }, downloadUrl: "https://inaturalist-open-data.s3.amazonaws.com/photos/10820975/large.jpg" });
  });
  it("drops NonCommercial, unlicensed and off-host photos", () => {
    expect(parseINaturalist(obs({ license_code: "cc-by-nc", url: square }))).toEqual([]);
    expect(parseINaturalist(obs({ license_code: null, url: square }))).toEqual([]);
    expect(parseINaturalist(obs({ license_code: "cc-by", url: "https://evil.example/photos/1/square.jpg" }))).toEqual([]);
  });
});

const mix = (license_url: string, extra: Record<string, unknown> = {}) => [{
  upload_id: 5, upload_name: "One Man", user_name: "mal", user_real_name: "Mal", file_page_url: "https://ccmixter.org/files/mal/5", license_url, upload_tags: ",jazz,piano,",
  files: [{ download_url: "https://ccmixter.org/content/mal/mal_-_One_Man.mp3", file_filesize: " (4.39MB)", file_format_info: { "default-ext": "mp3", ps: "4:47" } }], ...extra,
}];

describe("ccMixter", () => {
  it("keeps a CC BY track as a page link with its length, and offers no hotlinked file", () => {
    const [item] = parseCcMixter(mix("https://creativecommons.org/licenses/by/4.0/"));
    expect(item).toMatchObject({ provider: "ccmixter", contentType: "audio", durationSeconds: 287, downloadUrl: null, previewUrl: null, externalUrl: "https://ccmixter.org/files/mal/5" });
  });
  it("drops NonCommercial tracks", () => {
    expect(parseCcMixter(mix("https://creativecommons.org/licenses/by-nc/4.0/"))).toEqual([]);
    expect(parseCcMixter(mix("https://creativecommons.org/licenses/by-nc-sa/3.0/"))).toEqual([]);
  });
});

const video = (over: Record<string, unknown> = {}) => ({ data: [{ id: 1, uuid: "4fbf5665-4483-4378-9e27-f42ca92eec43", name: "Nature", url: "https://video.igem.org/videos/watch/4fbf5665-4483-4378-9e27-f42ca92eec43", licence: { id: 1 }, duration: 100, isLive: false, nsfw: false, ...over }] });

describe("SepiaSearch", () => {
  it("keeps a CC BY video as a link to its own server", () => {
    const [item] = parseSepia(video());
    expect(item).toMatchObject({ provider: "sepiasearch", contentType: "video", license: { name: "CC BY" }, downloadUrl: null });
  });
  it("drops NonCommercial, live, adult and unlicensed videos", () => {
    for (const over of [{ licence: { id: 4 } }, { licence: { id: 6 } }, { licence: null }, { isLive: true }, { nsfw: true }]) expect(parseSepia(video(over)), JSON.stringify(over)).toEqual([]);
  });
});

describe("how they reach WhatsApp", () => {
  it("are registered, keyless, and asked for in the right kinds", () => {
    for (const id of ["wellcome", "inaturalist", "ccmixter", "sepiasearch"]) expect(CONTENT_PROVIDERS.find((p) => p.id === id)?.auth.kind, id).toBe("none");
    expect(KIND_SEARCH.image.providers).toEqual(expect.arrayContaining(["wellcome", "inaturalist"]));
    expect(KIND_SEARCH.audio.providers).toContain("ccmixter");
    expect(KIND_SEARCH.video.providers).toContain("sepiasearch");
  });
  it("send Wellcome and iNaturalist pictures from their own hosts, and keep ccMixter and PeerTube as links", () => {
    const [w] = parseWellcome(wellcome({ id: "cc-by", url: "https://creativecommons.org/licenses/by/4.0/" }));
    expect(directCandidate(w, "image")).toMatchObject({ mime: "image/jpeg", hosts: ["iiif.wellcomecollection.org"] });
    const [n] = parseINaturalist(obs({ license_code: "cc0", url: square }));
    expect(directCandidate(n, "image")).toMatchObject({ hosts: ["inaturalist-open-data.s3.amazonaws.com"] });
    for (const p of ["ccmixter", "sepiasearch"]) expect(DELIVERY_HOSTS[p]).toBeUndefined();
    const [c] = parseCcMixter(mix("https://creativecommons.org/licenses/by/4.0/"));
    expect(directCandidate(c, "audio")).toBeNull();
  });
});
