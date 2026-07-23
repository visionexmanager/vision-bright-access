import { describe, expect, it } from "vitest";
import { detectType } from "@/components/OfficialStreamPlayer";

describe("official media stream detection", () => {
  it("detects supported TV sources", () => {
    expect(detectType("https://example.com/live/channel.m3u8")).toBe("hls");
    expect(detectType("https://www.youtube.com/embed/official-channel")).toBe("youtube");
  });

  it("detects direct and HLS radio sources as audio", () => {
    expect(detectType("https://example.com/live/radio.mp3")).toBe("audio");
    expect(detectType("https://streamtheworld.com/station/manifest.m3u8")).toBe("audio");
  });

  it("keeps official platform pages as external destinations", () => {
    expect(detectType("https://www.netflix.com/lb-en/")).toBe("external");
    expect(detectType("https://shahid.mbc.net/en")).toBe("external");
  });

  it("handles missing URLs without throwing", () => {
    expect(detectType("")).toBe("external");
  });
});
