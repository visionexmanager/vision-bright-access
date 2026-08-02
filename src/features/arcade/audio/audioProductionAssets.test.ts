import { describe, expect, it } from "vitest";
import { AUDIO_LIBRARY } from "./audioLibrary";
import { validateAudioAsset } from "./audioQuality";

describe("production Arcade audio assets", () => {
  it("keeps every playable asset licensed and quality-gated", () => {
    const playable = AUDIO_LIBRARY.filter((asset) => asset.quality === "production");

    expect(playable).toHaveLength(13);
    expect(playable.every((asset) => validateAudioAsset(asset).valid)).toBe(true);
    expect(playable.every((asset) => asset.sources.every((source) => source.src.startsWith("/audio/arcade/")))).toBe(true);
    expect(playable.every((asset) => asset.licenseStatus === "approved")).toBe(true);
  });

  it("does not silently approve an asset without a source", () => {
    const pending = AUDIO_LIBRARY.filter((asset) => asset.quality === "replacement-required");

    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((asset) => asset.sources.length === 0 && asset.licenseStatus === "pending")).toBe(true);
  });
});
